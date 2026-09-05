/* DEADEYE — local player controller
 *
 * Movement is an accelerate/friction model rather than direct velocity
 * assignment: input sets a wish-direction and a wish-speed, and velocity is
 * accelerated toward it. That is what makes strafing feel like an arena
 * shooter instead of a top-down mover.
 *
 * Recoil is "real": the kick is added to the view angles, so the player must
 * pull down to stay on target. It decays back toward the pre-fire angle,
 * but only partially, which is what makes a spray pattern learnable.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

var GRAVITY = 24.0;
var JUMP_VEL = 8.15;
var WALK_SPEED = 7.2;
var SPRINT_SPEED = 9.7;
var CROUCH_SPEED = 3.7;
var ACCEL_GROUND = 78;
var ACCEL_AIR = 26;
var FRICTION = 9.5;
var AIR_FRICTION = 0.28;
var EYE_STAND = 1.66;
var EYE_CROUCH = 1.06;
var HEIGHT_STAND = 1.80;
var HEIGHT_CROUCH = 1.22;
var RADIUS = 0.40;
var COYOTE = 0.11;
var JUMP_BUFFER = 0.12;
var REGEN_DELAY = 5.0;
var REGEN_RATE = 22;

function Player( game ) {
	this.game = game;
	this.input = game.input;

	/* transform */
	this.x = 0; this.y = 0; this.z = 0;
	this.vx = 0; this.vy = 0; this.vz = 0;
	this.yaw = 0; this.pitch = 0;
	this.radius = RADIUS;
	this.height = HEIGHT_STAND;
	this.grounded = false;
	this.groundTag = null;
	this.landSpeed = 0;
	this.hitWall = false;

	/* stance */
	this.crouching = false;
	this.crouchT = 0;
	this.sprinting = false;
	this.eyeY = EYE_STAND;
	this.viewOffsetY = 0;     // stair smoothing
	this.coyoteT = 0;
	this.jumpBufferT = -1;
	this.wasGrounded = true;

	/* combat */
	this.health = 100;
	this.maxHealth = 100;
	this.alive = true;
	this.lastDamageT = -99;
	this.team = 0;
	this.name = "YOU";
	this.kills = 0; this.deaths = 0; this.streak = 0; this.score = 0;
	this.damageDealt = 0;

	/* weapons */
	this.loadout = [ "rk77", "p9", "knife", "frag" ];
	this.slot = 0;
	this.lastSlot = 1;
	this.ammo = {};        // id -> { mag, reserve }
	this.grenades = 2;
	this.fireT = 0;        // time until next shot allowed
	this.reloadT = -1;
	this.reloadKind = "mag";
	this.switchT = 0;
	this.shellPending = 0; // shotgun shell-by-shell state
	this.aiming = false;
	this.shotIndex = 0;
	this.triggerHeld = false;
	this.meleeT = -1;
	this.throwT = -1;
	this.pendingThrow = false;

	/* recoil & spread */
	this.recoilPitch = 0;
	this.recoilYaw = 0;
	this.spreadExtra = 0;
	this.viewPunchX = new U.Spring( 150, 13 );
	this.viewPunchY = new U.Spring( 150, 13 );

	/* camera feel */
	this.bob = 0;
	this.bobAmt = 0;
	this.landDip = 0;
	this.landDipVel = 0;
	this.shake = 0;
	this.fovBase = U.storage.get( "fov", 90 );
	this.fov = this.fovBase;
	this.tilt = 0;

	/* footsteps */
	this.stepDist = 0;

	this.lookDX = 0; this.lookDY = 0;
	this.time = 0;

	this._v = new THREE.Vector3();
	this._muzzle = new THREE.Vector3();
	this._fwd = new THREE.Vector3();

	this.resetAmmo();
}

/* ------------------------------------------------------------------ */

Player.prototype.def = function() { return DE.WEAPONS[ this.loadout[ this.slot ] ]; };

Player.prototype.resetAmmo = function() {
	this.ammo = {};
	for ( var i = 0; i < this.loadout.length; i++ ) {
		var d = DE.WEAPONS[ this.loadout[ i ] ];
		if ( !d || d.melee || d.grenade ) continue;
		this.ammo[ d.id ] = { mag: d.magSize, reserve: d.reserve };
	}
	this.grenades = DE.WEAPONS.frag.count;
};

Player.prototype.setLoadout = function( primary, secondary ) {
	this.loadout = [ primary, secondary, "knife", "frag" ];
	this.resetAmmo();
	this.slot = 0;
	this.lastSlot = 1;
	this.switchT = 0;
	this.reloadT = -1;
	if ( this.game.viewmodel ) this.game.viewmodel.setWeapon( this.def() );
};

Player.prototype.spawn = function( sp ) {
	this.x = sp.x; this.y = sp.y; this.z = sp.z;
	this.vx = this.vy = this.vz = 0;
	this.yaw = sp.yaw === undefined ? 0 : sp.yaw;
	this.pitch = 0;
	this.health = this.maxHealth;
	this.alive = true;
	this.crouching = false;
	this.crouchT = 0;
	this.height = HEIGHT_STAND;
	this.recoilPitch = this.recoilYaw = 0;
	this.spreadExtra = 0;
	this.reloadT = -1;
	this.meleeT = -1;
	this.throwT = -1;
	this.fireT = 0;
	this.switchT = 0;
	this.streak = 0;
	this.viewOffsetY = 0;
	this.landDip = 0;
	this.shake = 0;
	this.resetAmmo();
	this.slot = 0;
	if ( this.game.viewmodel ) {
		this.game.viewmodel.setWeapon( this.def() );
		this.game.viewmodel.hidden = false;
	}
};

/* ------------------------------------------------------------------
 * update
 * ------------------------------------------------------------------ */

Player.prototype.update = function( dt ) {
	this.time += dt;
	var input = this.input;
	var locked = input.locked && this.game.state === "playing";

	if ( !this.alive ) {
		this.updateDead( dt );
		return;
	}

	/* ---- look ---- */
	if ( locked ) {
		// Scale sensitivity down while zoomed so the same wrist movement
		// covers the same on-screen distance at any FOV.
		var sensScale = 1;
		if ( this.aiming ) {
			var vmAim = this.game.viewmodel ? this.game.viewmodel.aimT : 1;
			var zoom = U.lerp( 1, this.def().adsFov / this.fovBase, vmAim );
			sensScale = input.adsSensScale * zoom;
		}
		var look = input.takeLook( sensScale );
		this.yaw += look.yaw;
		this.pitch += look.pitch;
		this.lookDX = look.yaw;
		this.lookDY = look.pitch;
	} else {
		this.lookDX = this.lookDY = 0;
	}
	this.pitch = U.clamp( this.pitch, -1.553, 1.553 );
	this.yaw = U.wrapAngle( this.yaw );

	/* Recoil recovery: pull the accumulated kick back toward zero. Any mouse
	 * movement the player made this frame has already been applied to yaw and
	 * pitch, so compensating manually reduces the recoil that returns. */
	var def = this.def();
	var rec = Math.exp( -def.recoilRecover * dt );
	var dPitch = this.recoilPitch * ( 1 - rec );
	var dYaw = this.recoilYaw * ( 1 - rec );
	this.pitch -= dPitch;
	this.yaw -= dYaw;
	this.recoilPitch -= dPitch;
	this.recoilYaw -= dYaw;

	/* ---- stance ---- */
	var wantCrouch = locked && input.down( "crouch" );
	if ( !wantCrouch && this.crouching ) {
		// Only stand up if there is room.
		if ( !this.game.world.overlaps( this.x, this.y, this.z, RADIUS, HEIGHT_STAND ) ) {
			this.crouching = false;
		}
	} else if ( wantCrouch ) {
		this.crouching = true;
	}
	this.crouchT = U.damp( this.crouchT, this.crouching ? 1 : 0, 15, dt );
	this.height = U.lerp( HEIGHT_STAND, HEIGHT_CROUCH, this.crouchT );

	/* ---- movement ---- */
	var axis = locked ? input.moveAxis() : { x: 0, z: 0 };
	var moving = axis.x !== 0 || axis.z !== 0;

	this.sprinting = locked && input.down( "sprint" ) && axis.z > 0.1 &&
	                 !this.crouching && !this.aiming && this.reloadT < 0 &&
	                 this.grounded && !def.melee;

	var wishSpeed = this.crouching ? CROUCH_SPEED
	              : ( this.sprinting ? SPRINT_SPEED : WALK_SPEED );
	wishSpeed *= def.moveMult;
	if ( this.aiming ) wishSpeed *= def.adsMoveMult;
	if ( this.reloadT >= 0 ) wishSpeed *= 0.92;

	// Wish direction in world space. The camera looks down -Z at yaw 0, so
	// forward = (-sin yaw, 0, -cos yaw) and right = (cos yaw, 0, -sin yaw).
	var fwdX = -Math.sin( this.yaw ), fwdZ = -Math.cos( this.yaw );
	var rgtX = Math.cos( this.yaw ), rgtZ = -Math.sin( this.yaw );
	var wishX = rgtX * axis.x + fwdX * axis.z;
	var wishZ = rgtZ * axis.x + fwdZ * axis.z;

	var wishLen = Math.sqrt( wishX * wishX + wishZ * wishZ );
	if ( wishLen > 0.0001 ) { wishX /= wishLen; wishZ /= wishLen; }

	var accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;

	if ( this.grounded ) {
		// Friction first, so stopping is crisp.
		var sp = Math.sqrt( this.vx * this.vx + this.vz * this.vz );
		if ( sp > 0.0001 ) {
			var drop = Math.max( sp, 3.0 ) * FRICTION * dt;
			var k = Math.max( 0, sp - drop ) / sp;
			this.vx *= k; this.vz *= k;
		}
	} else {
		this.vx *= Math.exp( -AIR_FRICTION * dt );
		this.vz *= Math.exp( -AIR_FRICTION * dt );
	}

	if ( wishLen > 0.0001 ) {
		// Accelerate toward the wish direction, capped at wishSpeed along it.
		var current = this.vx * wishX + this.vz * wishZ;
		var add = wishSpeed * wishLen - current;
		if ( add > 0 ) {
			var accelAmt = Math.min( add, accel * dt * wishSpeed / WALK_SPEED );
			this.vx += wishX * accelAmt;
			this.vz += wishZ * accelAmt;
		}
	}

	/* ---- jump ---- */
	if ( locked && input.justPressed( "jump" ) ) this.jumpBufferT = JUMP_BUFFER;
	if ( this.jumpBufferT >= 0 ) this.jumpBufferT -= dt;
	if ( this.grounded ) this.coyoteT = COYOTE;
	else if ( this.coyoteT > 0 ) this.coyoteT -= dt;

	if ( this.jumpBufferT > 0 && this.coyoteT > 0 && !this.crouching ) {
		this.vy = JUMP_VEL;
		this.grounded = false;
		this.coyoteT = 0;
		this.jumpBufferT = -1;
		DE.audio.jump();
	}

	this.vy -= GRAVITY * dt;
	if ( this.vy < -60 ) this.vy = -60;

	/* ---- integrate + collide ---- */
	var prevY = this.y;
	this.wasGrounded = this.grounded;
	this.landSpeed = 0;
	this.game.world.move( this, dt );

	// Stair smoothing: the collider steps up instantly, the eye catches up.
	var dy = this.y - prevY;
	if ( this.grounded && dy > 0.02 && dy < DE.STEP_HEIGHT + 0.1 ) {
		this.viewOffsetY -= dy;
	}
	this.viewOffsetY = U.damp( this.viewOffsetY, 0, 16, dt );
	this.viewOffsetY = U.clamp( this.viewOffsetY, -0.7, 0.7 );

	/* ---- landing ---- */
	if ( this.grounded && !this.wasGrounded ) {
		var impact = U.clamp( this.landSpeed / 16, 0, 1.4 );
		this.landDipVel -= impact * 3.6;
		DE.audio.land( this.groundTag, impact > 0.55 );
		if ( this.landSpeed > 22 ) {
			// Fall damage above terminal-ish speed.
			this.damage( Math.round( ( this.landSpeed - 22 ) * 4.5 ), null, "fall" );
		}
	}
	// Landing dip spring.
	this.landDipVel += ( -this.landDip * 130 - this.landDipVel * 15 ) * dt;
	this.landDip += this.landDipVel * dt;
	this.landDip = U.clamp( this.landDip, -0.42, 0.15 );

	/* ---- footsteps ---- */
	var hs = Math.sqrt( this.vx * this.vx + this.vz * this.vz );
	if ( this.grounded && hs > 1.2 ) {
		this.stepDist += hs * dt;
		var stride = this.crouching ? 2.4 : ( this.sprinting ? 2.05 : 1.85 );
		if ( this.stepDist >= stride ) {
			this.stepDist = 0;
			DE.audio.footstep( this.groundTag, null, this.crouching ? 0.35 : 1 );
			this.game.net.sendFootstep && this.game.net.sendFootstep();
		}
	} else if ( !this.grounded ) {
		this.stepDist = 0;
	}

	/* ---- camera feel ---- */
	var speedN = U.clamp( hs / WALK_SPEED, 0, 1.4 );
	this.bobAmt = U.damp( this.bobAmt, this.grounded ? speedN : 0, 9, dt );
	this.bob += dt * ( 8.2 + speedN * 4.0 ) * ( this.grounded ? speedN : 0 );
	this.shake = U.damp( this.shake, 0, 6, dt );

	// Lean into strafes.
	var strafeAmt = ( this.vx * rgtX + this.vz * rgtZ ) / WALK_SPEED;
	this.tilt = U.damp( this.tilt, U.clamp( -strafeAmt, -1, 1 ) * 0.022 *
	                    ( 1 - ( this.aiming ? 0.7 : 0 ) ), 9, dt );

	this.viewPunchX.target = 0;
	this.viewPunchY.target = 0;
	this.viewPunchX.step( dt );
	this.viewPunchY.step( dt );

	this.eyeY = U.lerp( EYE_STAND, EYE_CROUCH, this.crouchT );

	/* ---- weapons ---- */
	this.updateWeapons( dt, locked );

	/* ---- health regen ---- */
	if ( this.time - this.lastDamageT > REGEN_DELAY && this.health < this.maxHealth ) {
		this.health = Math.min( this.maxHealth, this.health + REGEN_RATE * dt );
	}

	/* ---- fell out of the world ---- */
	if ( this.y < this.game.world.minY + 5 ) {
		this.die( null, "void" );
	}
};

Player.prototype.updateDead = function( dt ) {
	// Fall to the ground and keep the camera there until respawn.
	this.vy -= GRAVITY * dt;
	this.vx *= Math.exp( -3 * dt );
	this.vz *= Math.exp( -3 * dt );
	this.game.world.move( this, dt );
	this.eyeY = U.damp( this.eyeY, 0.35, 5, dt );
	this.shake = U.damp( this.shake, 0, 4, dt );
};

/* ------------------------------------------------------------------
 * weapons
 * ------------------------------------------------------------------ */

Player.prototype.updateWeapons = function( dt, locked ) {
	var input = this.input;
	var def = this.def();
	var am = this.ammo[ def.id ];

	if ( this.fireT > 0 ) this.fireT -= dt;
	if ( this.switchT > 0 ) {
		this.switchT -= dt;
		if ( this.switchT <= 0 ) {
			this.game.viewmodel.setWeapon( this.def() );
		}
	}

	/* spread recovery */
	this.spreadExtra = Math.max( 0, this.spreadExtra - def.spreadRecover * dt );

	/* ---- ADS ---- */
	var wantAim = locked && input.mouseDown( 2 ) && !this.sprinting &&
	              this.switchT <= 0 && this.meleeT < 0 && this.throwT < 0 &&
	              !def.melee && !def.grenade;
	if ( wantAim && this.reloadT >= 0 && def.reloadType === "shell" ) {
		// Aiming cancels a shell-by-shell reload.
		this.reloadT = -1;
	}
	this.aiming = wantAim && this.reloadT < 0;

	/* ---- weapon switching ---- */
	if ( locked && this.switchT <= 0 && this.meleeT < 0 && this.throwT < 0 ) {
		var newSlot = -1;
		if ( input.justPressed( "slot1" ) ) newSlot = 0;
		else if ( input.justPressed( "slot2" ) ) newSlot = 1;
		else if ( input.justPressed( "slot3" ) ) newSlot = 2;
		else if ( input.justPressed( "lastWeapon" ) ) newSlot = this.lastSlot;
		var w = input.takeWheel();
		if ( w !== 0 ) {
			newSlot = ( this.slot + ( w > 0 ? 1 : -1 ) + 3 ) % 3;
		}
		if ( newSlot >= 0 && newSlot !== this.slot ) this.switchTo( newSlot );
	}

	/* ---- reload ---- */
	if ( this.reloadT >= 0 ) {
		this.reloadT -= dt;
		if ( this.reloadT <= 0 ) this.finishReload();
	} else if ( locked && input.justPressed( "reload" ) ) {
		this.tryReload();
	}

	/* ---- melee (quick knife) ---- */
	if ( this.meleeT >= 0 ) {
		this.meleeT += dt;
		if ( this.meleeT > 0.16 && !this._meleeHit ) {
			this._meleeHit = true;
			this.doMelee();
		}
		if ( this.meleeT > 0.45 ) { this.meleeT = -1; this._meleeHit = false; }
	} else if ( locked && input.justPressed( "melee" ) && this.switchT <= 0 ) {
		this.meleeT = 0;
		this._meleeHit = false;
		this.game.viewmodel.startMelee();
	}

	/* ---- grenade ---- */
	if ( this.throwT >= 0 ) {
		this.throwT += dt;
		if ( this.throwT > 0.26 && this.pendingThrow ) {
			this.pendingThrow = false;
			this.game.throwGrenade( this );
			this.grenades--;
		}
		if ( this.throwT > 0.55 ) this.throwT = -1;
	} else if ( locked && input.justPressed( "grenade" ) && this.grenades > 0 &&
	            this.switchT <= 0 && this.reloadT < 0 ) {
		this.throwT = 0;
		this.pendingThrow = true;
		this.game.viewmodel.startThrow();
		DE.audio.grenadePin();
	}

	/* ---- firing ---- */
	var wantFire = locked && input.mouseDown( 0 ) && this.switchT <= 0 &&
	               this.meleeT < 0 && this.throwT < 0 && !this.sprinting;
	var pressed = locked && input.mouseJustPressed( 0 );

	if ( def.melee ) {
		if ( pressed && this.fireT <= 0 ) {
			this.fireT = def.interval;
			this.meleeT = 0;
			this._meleeHit = false;
			this.game.viewmodel.startMelee();
		}
	} else if ( def.grenade ) {
		if ( pressed && this.grenades > 0 && this.throwT < 0 ) {
			this.throwT = 0;
			this.pendingThrow = true;
			this.game.viewmodel.startThrow();
		}
	} else if ( wantFire && this.fireT <= 0 && this.reloadT < 0 ) {
		if ( def.auto || pressed ) {
			if ( am.mag > 0 ) {
				this.shoot( def, am );
			} else if ( pressed ) {
				DE.audio.dryFire();
				this.fireT = 0.25;
				this.tryReload();
			}
		}
	}

	if ( !wantFire ) this.shotIndexReset( dt );

	/* Auto-reload when the magazine runs dry. */
	if ( !def.melee && !def.grenade && am && am.mag === 0 && this.reloadT < 0 &&
	     this.fireT <= 0 && am.reserve > 0 ) {
		this.tryReload();
	}
};

Player.prototype.shotIndexReset = function( dt ) {
	// Reset the recoil pattern after a short pause in fire.
	this._idleFire = ( this._idleFire || 0 ) + dt;
	if ( this._idleFire > 0.34 ) this.shotIndex = 0;
};

Player.prototype.switchTo = function( slot ) {
	if ( slot === this.slot ) return;
	var d = DE.WEAPONS[ this.loadout[ slot ] ];
	if ( !d ) return;
	this.lastSlot = this.slot;
	this.slot = slot;
	this.switchT = d.switchTime;
	this.reloadT = -1;
	this.aiming = false;
	this.shotIndex = 0;
	DE.audio.weaponSwitch();
};

Player.prototype.tryReload = function() {
	var def = this.def();
	if ( def.melee || def.grenade ) return;
	var am = this.ammo[ def.id ];
	if ( !am || am.mag >= def.magSize || am.reserve <= 0 || this.reloadT >= 0 ) return;
	if ( this.switchT > 0 ) return;

	if ( def.reloadType === "shell" ) {
		this.reloadT = am.mag === 0 ? def.reloadTime + def.reloadFirst : def.reloadTime;
		this.reloadKind = "shell";
		this.game.viewmodel.startReload( this.reloadT, "shell" );
		DE.audio.reloadStep( "shell", 0.12 );
	} else {
		var dur = am.mag === 0 ? def.reloadEmpty : def.reloadTime;
		this.reloadT = dur;
		this.reloadKind = "mag";
		this.game.viewmodel.startReload( dur, "mag" );
		DE.audio.reloadStep( "mag-out", dur * 0.16 );
		DE.audio.reloadStep( "mag-in", dur * 0.62 );
		if ( am.mag === 0 ) DE.audio.reloadStep( "bolt", dur * 0.84 );
	}
	this.aiming = false;
};

Player.prototype.finishReload = function() {
	var def = this.def();
	var am = this.ammo[ def.id ];
	this.reloadT = -1;
	if ( !am ) return;

	if ( def.reloadType === "shell" ) {
		// One shell at a time; repeat until full or out of reserve.
		am.mag++;
		am.reserve--;
		if ( am.mag < def.magSize && am.reserve > 0 ) {
			this.reloadT = def.reloadTime;
			this.game.viewmodel.startReload( this.reloadT, "shell" );
			DE.audio.reloadStep( "shell", 0.1 );
		} else {
			DE.audio.reloadStep( "pump", 0.05 );
		}
	} else {
		var need = def.magSize - am.mag;
		var take = Math.min( need, am.reserve );
		am.mag += take;
		am.reserve -= take;
	}
};

/* ------------------------------------------------------------------
 * shooting
 * ------------------------------------------------------------------ */

Player.prototype.currentSpread = function() {
	var def = this.def();
	var base = this.aiming ? def.spreadADS : def.spreadHip;
	var hs = Math.sqrt( this.vx * this.vx + this.vz * this.vz );
	if ( hs > 1.0 ) {
		var moveMix = U.clamp( hs / WALK_SPEED, 0, 1 );
		base = U.lerp( base, this.aiming ? def.spreadADS * 3.2 : def.spreadMove, moveMix );
	}
	if ( !this.grounded ) base = Math.max( base, def.spreadJump );
	if ( this.crouching && this.grounded ) base *= 0.72;
	return base + this.spreadExtra;
};

Player.prototype.shoot = function( def, am ) {
	am.mag--;
	this.fireT = def.interval;
	this._idleFire = 0;

	var spread = this.currentSpread();
	var pellets = def.pellets || 1;

	// Aim origin: eye position, direction from view angles.
	var eye = this.eyePosition( this._v );
	var baseDir = this.forward( this._fwd );

	for ( var i = 0; i < pellets; i++ ) {
		this.fireRay( eye, baseDir, spread, def, i === 0 );
	}

	/* --- recoil --- */
	var pat = def.pattern;
	var pv = 1, ph = 0;
	if ( pat ) {
		var idx = Math.min( this.shotIndex, pat.length - 1 );
		ph = pat[ idx ][ 0 ];
		pv = pat[ idx ][ 1 ];
	} else {
		ph = ( Math.random() - 0.5 ) * 2;
	}
	var aimScale = this.aiming ? 0.78 : 1;
	this.recoilPitch += def.recoilV * U.DEG * pv * aimScale * ( 0.9 + Math.random() * 0.2 );
	this.recoilYaw += def.recoilH * U.DEG * ph * aimScale * ( 0.7 + Math.random() * 0.6 );
	this.pitch += def.recoilV * U.DEG * pv * aimScale;
	this.yaw += def.recoilH * U.DEG * ph * aimScale;
	this.shotIndex++;

	this.spreadExtra = Math.min( def.spreadMax, this.spreadExtra + def.spreadGrow );

	this.viewPunchX.kick( -def.kick * 34 );
	this.viewPunchY.kick( ( Math.random() - 0.5 ) * def.kick * 22 );
	this.shake = Math.min( 1.2, this.shake + def.kick * 1.6 );

	/* --- presentation --- */
	this.game.viewmodel.fire( 1 );
	DE.audio.gunshot( def.sound, null );
	if ( def.model.eject ) {
		var mz = this.game.viewmodel.muzzleWorld( this.game.camera, this._muzzle );
		var rgtX = Math.cos( this.yaw ), rgtZ = -Math.sin( this.yaw );
		this.game.fx.casing( mz.x, mz.y - 0.05, mz.z, rgtX, 0, rgtZ );
		DE.audio.shellDrop( 0.35 + Math.random() * 0.2 );
	}
	if ( this.shotIndex % 5 === 4 ) {
		var mz2 = this.game.viewmodel.muzzleWorld( this.game.camera, this._muzzle );
		var f = this.forward( this._fwd );
		this.game.fx.muzzleSmoke( mz2.x, mz2.y, mz2.z, f.x, f.y, f.z );
	}

	this.game.net.sendShot( this, def );
};

/* One hitscan ray with spread applied. */
Player.prototype.fireRay = function( eye, baseDir, spreadDeg, def, isFirst ) {
	var dir = this._spreadDir( baseDir, spreadDeg );
	var maxDist = def.melee ? def.range : 300;

	var hit = this.game.traceShot(
		eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, maxDist, this );

	// Tracer starts at the barrel, not the eye, so it looks right in third
	// person and doesn't appear to spawn inside the player's face.
	var mz = this.game.viewmodel.muzzleWorld( this.game.camera, this._muzzle );
	var endX, endY, endZ;
	if ( hit.hit ) {
		endX = hit.x; endY = hit.y; endZ = hit.z;
	} else {
		endX = eye.x + dir.x * maxDist;
		endY = eye.y + dir.y * maxDist;
		endZ = eye.z + dir.z * maxDist;
	}

	if ( !def.melee ) {
		this.game.fx.tracer( mz.x, mz.y, mz.z, endX, endY, endZ,
		                     def.bulletSpeed, 0xffeaa8, def.pellets > 1 ? 0.022 : 0.034 );
	}

	if ( !hit.hit ) return;

	if ( hit.entity ) {
		var dist = hit.dist;
		var mult = hit.zone === "head" ? def.headMult
		         : ( hit.zone === "legs" ? def.limbMult : 1 );
		var dmg = def.damage * mult * DE.falloff( def, dist );
		this.game.damageEntity( hit.entity, dmg, this, hit.zone, def, dir );
		this.game.fx.blood( hit.x, hit.y, hit.z, dir.x, dir.y, dir.z, hit.zone === "head" );
		DE.audio.fleshHit( { x: hit.x, y: hit.y, z: hit.z } );
	} else {
		this.game.fx.impact( hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.tag );
		DE.audio.impact( hit.tag, { x: hit.x, y: hit.y, z: hit.z } );
	}
};

var _sd = new THREE.Vector3();
Player.prototype._spreadDir = function( dir, spreadDeg ) {
	if ( spreadDeg <= 0.0001 ) { _sd.copy( dir ); return _sd; }
	var rad = spreadDeg * U.DEG;
	// Gaussian so shots cluster at the centre of the cone.
	var a = Math.random() * U.TAU;
	var r = Math.abs( U.gauss() ) * 0.5;
	if ( r > 1 ) r = 1;
	var off = r * rad;

	// Build a basis around the aim direction.
	var upX = 0, upY = 1, upZ = 0;
	if ( Math.abs( dir.y ) > 0.99 ) { upX = 1; upY = 0; }
	var rx = dir.y * upZ - dir.z * upY;
	var ry = dir.z * upX - dir.x * upZ;
	var rz = dir.x * upY - dir.y * upX;
	var rl = Math.sqrt( rx * rx + ry * ry + rz * rz ) || 1;
	rx /= rl; ry /= rl; rz /= rl;
	var ux = ry * dir.z - rz * dir.y;
	var uy = rz * dir.x - rx * dir.z;
	var uz = rx * dir.y - ry * dir.x;

	var sx = Math.cos( a ) * Math.sin( off );
	var sy = Math.sin( a ) * Math.sin( off );
	var cz = Math.cos( off );

	_sd.set(
		dir.x * cz + rx * sx + ux * sy,
		dir.y * cz + ry * sx + uy * sy,
		dir.z * cz + rz * sx + uz * sy
	).normalize();
	return _sd;
};

Player.prototype.doMelee = function() {
	var def = DE.WEAPONS.knife;
	var eye = this.eyePosition( this._v );
	var dir = this.forward( this._fwd );
	var hit = this.game.traceShot( eye.x, eye.y, eye.z, dir.x, dir.y, dir.z,
	                               def.range, this );
	if ( hit.hit && hit.entity ) {
		// Backstab: check whether we are behind the target.
		var e = hit.entity;
		var toX = this.x - e.x, toZ = this.z - e.z;
		var eFx = -Math.sin( e.yaw ), eFz = -Math.cos( e.yaw );
		var behind = ( toX * eFx + toZ * eFz ) < 0;
		var dmg = behind ? def.backstab : def.damage;
		this.game.damageEntity( e, dmg, this, "torso", def, dir );
		this.game.fx.blood( hit.x, hit.y, hit.z, dir.x, dir.y, dir.z, behind );
		DE.audio.fleshHit( { x: hit.x, y: hit.y, z: hit.z } );
	} else if ( hit.hit ) {
		this.game.fx.impact( hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.tag );
		DE.audio.impact( hit.tag, { x: hit.x, y: hit.y, z: hit.z } );
	}
	DE.audio.gunshot( def.sound, null );
};

/* ------------------------------------------------------------------
 * damage & death
 * ------------------------------------------------------------------ */

Player.prototype.damage = function( amount, source, cause ) {
	if ( !this.alive || this.game.state !== "playing" ) return;
	if ( this.game.warmup ) return;
	this.health -= amount;
	this.lastDamageT = this.time;
	var severity = U.clamp( amount / 50, 0, 1 );
	this.shake = Math.min( 1.6, this.shake + severity * 0.9 );
	DE.audio.damageTaken( severity );
	this.game.hud.damageFlash( severity, source ? this.angleTo( source ) : null );
	if ( this.health <= 0 ) this.die( source, cause );
};

Player.prototype.angleTo = function( src ) {
	var dx = src.x - this.x, dz = src.z - this.z;
	var world = Math.atan2( -dx, -dz );
	return U.wrapAngle( world - this.yaw );
};

Player.prototype.die = function( source, cause ) {
	if ( !this.alive ) return;
	this.alive = false;
	this.health = 0;
	this.deaths++;
	this.streak = 0;
	this.aiming = false;
	this.game.viewmodel.hidden = true;
	DE.audio.death();
	this.game.onPlayerDeath( this, source, cause );
};

/* ------------------------------------------------------------------
 * camera
 * ------------------------------------------------------------------ */

Player.prototype.eyePosition = function( out ) {
	out = out || new THREE.Vector3();
	out.set( this.x, this.y + this.eyeY + this.viewOffsetY, this.z );
	return out;
};

Player.prototype.forward = function( out ) {
	out = out || new THREE.Vector3();
	var cp = Math.cos( this.pitch );
	out.set( -Math.sin( this.yaw ) * cp, Math.sin( this.pitch ), -Math.cos( this.yaw ) * cp );
	return out;
};

/* Write the final camera transform. Applies bob, dip, punch, tilt and shake on
 * top of the logical eye position. */
Player.prototype.applyCamera = function( camera, dt ) {
	var bobScale = this.bobAmt * ( this.aiming ? 0.28 : 1 );
	var bobX = Math.sin( this.bob ) * 0.030 * bobScale;
	var bobY = Math.abs( Math.cos( this.bob ) ) * -0.026 * bobScale;

	var shakeX = 0, shakeY = 0, shakeZ = 0;
	if ( this.shake > 0.001 ) {
		var t = this.time * 42;
		shakeX = Math.sin( t * 1.7 ) * this.shake * 0.035;
		shakeY = Math.sin( t * 2.3 + 1.4 ) * this.shake * 0.035;
		shakeZ = Math.sin( t * 1.1 + 0.6 ) * this.shake * 0.012;
	}

	var rgtX = Math.cos( this.yaw ), rgtZ = -Math.sin( this.yaw );
	var ey = this.y + this.eyeY + this.viewOffsetY + this.landDip + bobY + shakeY;

	camera.position.set(
		this.x + ( bobX + shakeX ) * rgtX,
		ey,
		this.z + ( bobX + shakeX ) * rgtZ
	);

	camera.rotation.set( 0, 0, 0 );
	camera.rotation.order = "YXZ";
	camera.rotation.y = this.yaw + this.viewPunchY.value * 0.01 + shakeZ * 0.5;
	camera.rotation.x = this.pitch + this.viewPunchX.value * 0.01 + shakeZ;
	camera.rotation.z = this.tilt + shakeZ * 0.5;

	/* FOV: zoom while aiming, widen slightly while sprinting. */
	var def = this.def();
	var vm = this.game.viewmodel;
	var targetFov = this.fovBase;
	if ( vm && vm.aimT > 0 ) {
		targetFov = U.lerp( this.fovBase, def.adsFov, vm.aimT );
	}
	if ( this.sprinting ) targetFov += 6;
	this.fov = U.damp( this.fov, targetFov, 14, dt );
	if ( Math.abs( camera.fov - this.fov ) > 0.01 ) {
		camera.fov = this.fov;
		camera.updateProjectionMatrix();
	}
};

Player.prototype.viewState = function() {
	return {
		aiming: this.aiming,
		sprinting: this.sprinting,
		switching: this.switchT > 0,
		speed: Math.sqrt( this.vx * this.vx + this.vz * this.vz ),
		grounded: this.grounded,
		vy: this.vy,
		time: this.time,
		lookDX: this.lookDX,
		lookDY: this.lookDY
	};
};

DE.Player = Player;
DE.MOVE = {
	GRAVITY: GRAVITY, JUMP_VEL: JUMP_VEL, WALK_SPEED: WALK_SPEED,
	SPRINT_SPEED: SPRINT_SPEED, CROUCH_SPEED: CROUCH_SPEED,
	ACCEL_GROUND: ACCEL_GROUND, ACCEL_AIR: ACCEL_AIR, FRICTION: FRICTION,
	HEIGHT_STAND: HEIGHT_STAND, HEIGHT_CROUCH: HEIGHT_CROUCH,
	EYE_STAND: EYE_STAND, RADIUS: RADIUS
};

} )( window );
