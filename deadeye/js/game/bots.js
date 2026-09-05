/* DEADEYE — bot opponents
 *
 * Bots share the player's physics body and the same hitscan path, so a bot's
 * bullet and yours are resolved identically. What differs is intent: a small
 * state machine drives where they go, and a deliberately imperfect aim model
 * decides whether they hit.
 *
 * The aim model matters more than the navigation. A bot that snaps to your
 * head is not difficult, it is unfair — so aim is a point that *chases* the
 * target with a bounded turn rate, carries a slowly-decaying error, and leads
 * a moving target only partially. Difficulty scales those numbers rather than
 * granting extra damage or health.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;
var M = DE.MOVE;

var DIFFICULTY = {
	recruit: {
		name: "RECRUIT",
		reaction: [ 0.45, 0.80 ],   // seconds before reacting to a new target
		turnRate: 2.8,              // radians/sec the aim point can swing
		aimError: 0.300,            // radians of standing error
		errorDecay: 1.0,            // how fast error shrinks while tracking
		leadFactor: 0.10,
		burst: [ 3, 5 ], burstPause: [ 0.60, 1.20 ],
		range: 38, fov: 0.75,
		strafe: 0.30, jumpChance: 0.02, headBias: 0.04,
		hearRange: 20
	},
	regular: {
		name: "REGULAR",
		reaction: [ 0.30, 0.52 ],
		turnRate: 4.2,
		aimError: 0.210,
		errorDecay: 1.6,
		leadFactor: 0.35,
		burst: [ 4, 7 ], burstPause: [ 0.45, 0.90 ],
		range: 50, fov: 0.85,
		strafe: 0.55, jumpChance: 0.05, headBias: 0.10,
		hearRange: 28
	},
	veteran: {
		name: "VETERAN",
		reaction: [ 0.20, 0.34 ],
		turnRate: 6.0,
		aimError: 0.135,
		errorDecay: 2.2,
		leadFactor: 0.60,
		burst: [ 5, 9 ], burstPause: [ 0.32, 0.62 ],
		range: 65, fov: 0.95,
		strafe: 0.75, jumpChance: 0.09, headBias: 0.20,
		hearRange: 36
	},
	elite: {
		name: "ELITE",
		reaction: [ 0.12, 0.22 ],
		turnRate: 8.5,
		aimError: 0.085,
		errorDecay: 3.0,
		leadFactor: 0.85,
		burst: [ 6, 12 ], burstPause: [ 0.24, 0.48 ],
		range: 82, fov: 1.05,
		strafe: 0.92, jumpChance: 0.13, headBias: 0.32,
		hearRange: 44
	}
};

var NAMES = [
	"VIPER", "ECHO", "RAZOR", "NOMAD", "GHOST", "TALON", "SABLE", "KILO",
	"ONYX", "RIFT", "HAVOC", "CINDER", "VECTOR", "MAGPIE", "BASTION", "CROW",
	"HOLLOW", "JUNO", "KESTREL", "LANCE", "MERCY", "NOVA", "OSPREY", "PIKE",
	"QUARRY", "RIPTIDE", "SLATE", "TUNDRA", "UMBRA", "VANTAGE", "WRAITH", "ZEPHYR"
];

var LOADOUTS = [
	[ "rk77", "p9" ], [ "vector9", "p9" ], [ "breach12", "p9" ],
	[ "m14", "hcannon" ], [ "saw60", "p9" ], [ "rk77", "hcannon" ],
	[ "longbow", "p9" ], [ "vector9", "hcannon" ]
];

/* ------------------------------------------------------------------ */

function Bot( game, opts ) {
	opts = opts || {};
	this.game = game;
	this.isBot = true;
	this.id = opts.id;
	this.name = opts.name || U.pick( NAMES );
	this.team = opts.team === undefined ? 1 : opts.team;
	this.diff = DIFFICULTY[ opts.difficulty || "regular" ];

	/* body — the same shape the player uses */
	this.x = 0; this.y = 0; this.z = 0;
	this.vx = 0; this.vy = 0; this.vz = 0;
	this.radius = M.RADIUS;
	this.height = M.HEIGHT_STAND;
	this.grounded = false;
	this.groundTag = null;
	this.yaw = 0;
	this.pitch = 0;
	this.crouching = false;

	/* state */
	this.health = 100;
	this.maxHealth = 100;
	this.alive = true;
	this.kills = 0; this.deaths = 0; this.streak = 0; this.score = 0;
	this.state = "patrol";
	this.stateT = 0;
	this.target = null;
	this.targetSeenAt = -99;
	this.lastKnown = { x: 0, y: 0, z: 0, t: -99 };
	this.reactT = 0;
	this.acquiring = false;
	this.lastDamageT = -99;

	/* aim */
	this.aimYaw = 0;
	this.aimPitch = 0;
	this.errYaw = 0;
	this.errPitch = 0;
	this.errT = 0;
	this.errRetarget = 0;
	this.errTargetYaw = 0;
	this.errTargetPitch = 0;
	this._wantYaw = undefined;
	this._wantPitch = undefined;

	/* weapons */
	var lo = opts.loadout || U.pick( LOADOUTS );
	this.loadout = [ lo[ 0 ], lo[ 1 ], "knife" ];
	this.slot = 0;
	this.ammo = {};
	this.fireT = 0;
	this.reloadT = -1;
	this.switchT = 0;
	this.burstLeft = 0;
	this.burstPauseT = 0;
	this.resetAmmo();

	/* navigation */
	this.path = null;
	this.pathIdx = 0;
	this.repathT = 0;
	this.goalNode = -1;
	this.stuckT = 0;
	this.lastPos = { x: 0, z: 0 };
	this.strafeDir = U.chance( 0.5 ) ? 1 : -1;
	this.strafeT = 0;
	this.jumpT = 0;

	this.character = new DE.Character( { team: this.team } );
	this.character.setWeapon( DE.WEAPONS[ this.loadout[ 0 ] ] );
	this.time = 0;
	this.stepDist = 0;
	this._muzzle = new THREE.Vector3();
	this._dir = new THREE.Vector3();
}

Bot.prototype.def = function() { return DE.WEAPONS[ this.loadout[ this.slot ] ]; };

Bot.prototype.resetAmmo = function() {
	this.ammo = {};
	for ( var i = 0; i < this.loadout.length; i++ ) {
		var d = DE.WEAPONS[ this.loadout[ i ] ];
		if ( !d || d.melee ) continue;
		this.ammo[ d.id ] = { mag: d.magSize, reserve: d.reserve };
	}
};

Bot.prototype.spawn = function( sp ) {
	this.x = sp.x; this.y = sp.y; this.z = sp.z;
	this.vx = this.vy = this.vz = 0;
	this.yaw = this.aimYaw = sp.yaw === undefined ? Math.random() * 6.28 : sp.yaw;
	this.pitch = this.aimPitch = 0;
	this.health = this.maxHealth;
	this.alive = true;
	this.state = "patrol";
	this.stateT = 0;
	this.target = null;
	this.path = null;
	this.goalNode = -1;
	this.reloadT = -1;
	this.fireT = 0;
	this.streak = 0;
	this.slot = 0;
	this.crouching = false;
	this.height = M.HEIGHT_STAND;
	this.lastDamageT = -99;
	this.resetAmmo();
	this.character.reset();
};

/* ------------------------------------------------------------------
 * perception
 * ------------------------------------------------------------------ */

Bot.prototype.canSee = function( e ) {
	if ( !e.alive ) return false;
	var dx = e.x - this.x, dz = e.z - this.z;
	var distSq = dx * dx + dz * dz;
	if ( distSq > this.diff.range * this.diff.range ) return false;

	// Field of view, as a half-angle from the bot's facing. Kept near a real
	// screen's coverage: at 1.65rad this was 189 degrees total and bots tracked
	// targets standing behind them.
	var ang = Math.atan2( -dx, -dz );
	if ( Math.abs( U.wrapAngle( ang - this.yaw ) ) > this.diff.fov ) return false;

	// Eye-to-chest and eye-to-head, so a target behind low cover is only
	// spotted when actually exposed.
	var ex = this.x, ey = this.y + M.EYE_STAND - ( this.crouching ? 0.6 : 0 ), ez = this.z;
	var w = this.game.world;
	var ty = e.y + ( e.crouching ? 0.75 : 1.15 );
	if ( w.lineOfSight( ex, ey, ez, e.x, ty, e.z ) ) return true;
	return w.lineOfSight( ex, ey, ez, e.x, e.y + ( e.crouching ? 1.05 : 1.62 ), e.z );
};

/* Called by the match when a shot is fired nearby — bots turn toward noise. */
Bot.prototype.hear = function( x, y, z, loudness ) {
	if ( !this.alive ) return;
	var dx = x - this.x, dz = z - this.z;
	var d = Math.sqrt( dx * dx + dz * dz );
	if ( d > this.diff.hearRange * ( loudness || 1 ) ) return;
	if ( this.state === "engage" ) return;
	// Only a rough bearing, and only if we have nothing better to do.
	this.lastKnown.x = x + ( Math.random() - 0.5 ) * 6;
	this.lastKnown.y = y;
	this.lastKnown.z = z + ( Math.random() - 0.5 ) * 6;
	this.lastKnown.t = this.time;
	if ( this.state === "patrol" ) {
		this.state = "seek";
		this.stateT = 0;
		this.path = null;
	}
};

Bot.prototype.pickTarget = function() {
	var ents = this.game.entities;
	var best = null, bestScore = Infinity;
	for ( var i = 0; i < ents.length; i++ ) {
		var e = ents[ i ];
		if ( e === this || !e.alive ) continue;
		if ( this.game.teamMode && e.team === this.team ) continue;
		if ( !this.canSee( e ) ) continue;
		var dx = e.x - this.x, dz = e.z - this.z;
		var d = Math.sqrt( dx * dx + dz * dz );
		// Prefer whoever is closest, but strongly prefer the current target so
		// bots don't flip between two equidistant enemies every frame.
		var score = d - ( e === this.target ? 12 : 0 );
		if ( score < bestScore ) { bestScore = score; best = e; }
	}
	return best;
};

/* ------------------------------------------------------------------
 * update
 * ------------------------------------------------------------------ */

Bot.prototype.update = function( dt ) {
	this.time += dt;
	if ( !this.alive ) {
		this.vy -= M.GRAVITY * dt;
		this.vx *= Math.exp( -4 * dt );
		this.vz *= Math.exp( -4 * dt );
		this.game.world.move( this, dt );
		this.syncCharacter( dt );
		return;
	}

	this.stateT += dt;
	if ( this.fireT > 0 ) this.fireT -= dt;
	if ( this.switchT > 0 ) this.switchT -= dt;
	if ( this.burstPauseT > 0 ) this.burstPauseT -= dt;
	if ( this.jumpT > 0 ) this.jumpT -= dt;

	/* --- target acquisition --- */
	var seen = this.pickTarget();
	if ( seen ) {
		if ( this.target !== seen ) {
			this.target = seen;
			this.acquiring = true;
			this.reactT = U.rand( this.diff.reaction[ 0 ], this.diff.reaction[ 1 ] );
			// A fresh target starts with full aim error, which then converges.
			this.errT = 0;
			var a = Math.random() * U.TAU;
			this.errYaw = Math.cos( a ) * this.diff.aimError * 2.4;
			this.errPitch = Math.sin( a ) * this.diff.aimError * 2.4;
		}
		this.targetSeenAt = this.time;
		this.lastKnown.x = seen.x;
		this.lastKnown.y = seen.y;
		this.lastKnown.z = seen.z;
		this.lastKnown.t = this.time;
		if ( this.state !== "engage" ) { this.state = "engage"; this.stateT = 0; }
	} else if ( this.state === "engage" && this.time - this.targetSeenAt > 1.4 ) {
		this.state = "seek";
		this.stateT = 0;
		this.path = null;
		this.target = null;
	}

	if ( this.acquiring ) {
		this.reactT -= dt;
		if ( this.reactT <= 0 ) this.acquiring = false;
	}

	/* --- reload / weapon management --- */
	this.updateWeapon( dt );

	/* --- behaviour --- */
	switch ( this.state ) {
		case "engage": this.doEngage( dt ); break;
		case "seek":   this.doSeek( dt ); break;
		default:       this.doPatrol( dt ); break;
	}

	/* --- health regeneration ---
	 * The player heals after five quiet seconds; bots did not, so every graze
	 * they ever took stayed on the books and they died to stray rounds minutes
	 * later. Same rule for both sides. */
	if ( this.time - this.lastDamageT > 5.0 && this.health < this.maxHealth ) {
		this.health = Math.min( this.maxHealth, this.health + 22 * dt );
	}

	/* --- physics --- */
	this.vy -= M.GRAVITY * dt;
	if ( this.vy < -60 ) this.vy = -60;
	var wasGrounded = this.grounded;
	this.game.world.move( this, dt );

	if ( this.y < this.game.world.minY + 5 ) {
		this.game.killEntity( this, null, "void" );
		return;
	}

	/* footsteps, so players can hear bots coming */
	var hs = Math.sqrt( this.vx * this.vx + this.vz * this.vz );
	if ( this.grounded && hs > 1.2 ) {
		this.stepDist += hs * dt;
		if ( this.stepDist >= 1.9 ) {
			this.stepDist = 0;
			DE.audio.footstep( this.groundTag, { x: this.x, y: this.y, z: this.z },
			                   this.crouching ? 0.4 : 1 );
		}
	}

	this.syncCharacter( dt );
};

Bot.prototype.updateWeapon = function( dt ) {
	var def = this.def();
	var am = this.ammo[ def.id ];

	if ( this.reloadT >= 0 ) {
		this.reloadT -= dt;
		if ( this.reloadT <= 0 ) {
			this.reloadT = -1;
			if ( am ) {
				if ( def.reloadType === "shell" ) {
					am.mag = Math.min( def.magSize, am.mag + Math.min( 3, am.reserve ) );
					am.reserve = Math.max( 0, am.reserve - 3 );
				} else {
					var take = Math.min( def.magSize - am.mag, am.reserve );
					am.mag += take;
					am.reserve -= take;
				}
			}
		}
		return;
	}

	if ( am && am.mag === 0 ) {
		if ( am.reserve > 0 ) {
			this.reloadT = def.reloadEmpty;
			DE.audio.reloadStep( "mag-out", 0.1 );
		} else {
			// Out of ammo entirely — fall back down the loadout.
			var next = this.slot + 1;
			while ( next < this.loadout.length ) {
				var d2 = DE.WEAPONS[ this.loadout[ next ] ];
				if ( d2.melee || ( this.ammo[ d2.id ] && this.ammo[ d2.id ].mag > 0 ) ) break;
				next++;
			}
			if ( next < this.loadout.length ) {
				this.slot = next;
				this.switchT = DE.WEAPONS[ this.loadout[ next ] ].switchTime;
				this.character.setWeapon( this.def() );
			}
		}
	}
};

/* ------------------------------------------------------------------
 * behaviours
 * ------------------------------------------------------------------ */

Bot.prototype.doPatrol = function( dt ) {
	if ( !this.path || this.pathIdx >= this.path.length ) {
		this.pickPatrolGoal();
	}
	this.followPath( dt, 1.0 );
	this.faceMovement( dt );
};

Bot.prototype.doSeek = function( dt ) {
	// Head for the last known position; give up after a while.
	if ( this.stateT > 7 || this.time - this.lastKnown.t > 9 ) {
		this.state = "patrol";
		this.stateT = 0;
		this.path = null;
		return;
	}
	if ( !this.path || this.pathIdx >= this.path.length ) {
		var nav = this.game.nav;
		var goal = nav.nearest( this.lastKnown.x, this.lastKnown.y, this.lastKnown.z, 10 );
		if ( goal >= 0 ) this.setPath( goal );
		else { this.state = "patrol"; return; }
	}
	this.followPath( dt, 1.0 );
	// Look toward the noise while moving to it.
	var dx = this.lastKnown.x - this.x, dz = this.lastKnown.z - this.z;
	if ( dx * dx + dz * dz > 4 ) {
		this.aimYaw = U.dampAngle( this.aimYaw, Math.atan2( -dx, -dz ), 6, dt );
		this.aimPitch = U.damp( this.aimPitch, 0, 5, dt );
	} else {
		this.faceMovement( dt );
	}
	this.applyAim( dt );
};

Bot.prototype.doEngage = function( dt ) {
	var t = this.target;
	if ( !t || !t.alive ) { this.state = "patrol"; this.path = null; return; }

	var dx = t.x - this.x, dz = t.z - this.z;
	var dist = Math.sqrt( dx * dx + dz * dz );
	var def = this.def();

	/* --- aim --- */
	this.aimAt( t, dt, dist );

	/* --- positioning --- */
	var ideal = def.melee ? 2 : ( def.cls === "Shotgun" ? 8
	          : ( def.cls === "Sniper" ? 34 : ( def.cls === "SMG" ? 12 : 18 ) ) );
	var move = 0;
	if ( dist > ideal * 1.35 ) move = 1;
	else if ( dist < ideal * 0.55 ) move = -1;

	// Strafe around the target rather than standing still.
	this.strafeT -= dt;
	if ( this.strafeT <= 0 ) {
		this.strafeT = U.rand( 0.5, 1.4 );
		if ( U.chance( 0.45 ) ) this.strafeDir = -this.strafeDir;
	}

	var fwdX = -Math.sin( this.yaw ), fwdZ = -Math.cos( this.yaw );
	var rgtX = Math.cos( this.yaw ), rgtZ = -Math.sin( this.yaw );
	var strafe = this.strafeDir * this.diff.strafe;

	var wishX = fwdX * move + rgtX * strafe;
	var wishZ = fwdZ * move + rgtZ * strafe;

	// Don't strafe off a ledge or into a wall.
	if ( !this.probeAhead( wishX, wishZ ) ) {
		this.strafeDir = -this.strafeDir;
		wishX = fwdX * move - rgtX * strafe;
		wishZ = fwdZ * move - rgtZ * strafe;
		if ( !this.probeAhead( wishX, wishZ ) ) { wishX = 0; wishZ = 0; }
	}

	this.drive( wishX, wishZ, dt, 1.0 );

	// Occasional jump to break aim, but never while sniping.
	if ( this.grounded && this.jumpT <= 0 && def.cls !== "Sniper" &&
	     U.chance( this.diff.jumpChance * dt * 8 ) ) {
		this.vy = M.JUMP_VEL;
		this.jumpT = U.rand( 0.9, 2.2 );
	}

	/* --- shooting --- */
	if ( !this.acquiring && this.reloadT < 0 && this.switchT <= 0 ) {
		this.tryShoot( dt, t, dist );
	}
};

/* Would moving in this direction keep us on solid ground and out of a wall? */
Bot.prototype.probeAhead = function( wx, wz ) {
	var len = Math.sqrt( wx * wx + wz * wz );
	if ( len < 0.01 ) return true;
	wx /= len; wz /= len;
	var w = this.game.world;
	var ax = this.x + wx * 1.1, az = this.z + wz * 1.1;
	// Wall in the way?
	if ( w.overlaps( ax, this.y + 0.2, az, this.radius, this.height ) ) return false;
	// Floor still there?
	var g = w.raycast( ax, this.y + 0.5, az, 0, -1, 0, 3.2 );
	return g.hit;
};

/* ------------------------------------------------------------------
 * aiming
 * ------------------------------------------------------------------ */

Bot.prototype.aimAt = function( t, dt, dist ) {
	var d = this.diff;

	// Aim at the chest, drifting toward the head with skill.
	var aimY = t.y + 1.15 + ( d.headBias * 0.5 );
	if ( U.chance( d.headBias * dt * 2 ) ) aimY = t.y + 1.6;

	// Partial lead on a moving target.
	var travel = dist / ( this.def().bulletSpeed || 400 );
	var lx = t.x + ( t.vx || 0 ) * travel * d.leadFactor;
	var lz = t.z + ( t.vz || 0 ) * travel * d.leadFactor;

	var dx = lx - this.x;
	var dz = lz - this.z;
	var dy = aimY - ( this.y + M.EYE_STAND );
	var flat = Math.sqrt( dx * dx + dz * dz );

	var wantYaw = Math.atan2( -dx, -dz );
	var wantPitch = Math.atan2( dy, flat );

	/* Aim error: a slow wander around the true bearing.
	 *
	 * Damping toward a fresh random value every frame is a low-pass filter on
	 * white noise, which averages to almost exactly zero — the bot ends up with
	 * machine-perfect aim no matter what `aimError` says. Instead pick a new
	 * offset every few tenths of a second and ease toward it, so the aim point
	 * drifts the way a human's does and the magnitude actually means something. */
	this.errT += dt;
	this.errRetarget -= dt;
	if ( this.errRetarget <= 0 ) {
		this.errRetarget = U.rand( 0.22, 0.55 );
		var a = Math.random() * U.TAU;
		var r = Math.min( 1.6, Math.abs( U.gauss() ) * 0.7 );
		this.errTargetYaw = Math.cos( a ) * r * d.aimError;
		this.errTargetPitch = Math.sin( a ) * r * d.aimError * 0.7;
	}
	this.errYaw = U.damp( this.errYaw, this.errTargetYaw, 7, dt );
	this.errPitch = U.damp( this.errPitch, this.errTargetPitch, 7, dt );

	// Freshly-acquired targets are aimed at worse, converging as it tracks.
	var conv = 1 + Math.exp( -d.errorDecay * this.errT ) * 1.6;
	wantYaw += this.errYaw * conv;
	wantPitch += this.errPitch * conv;

	// Remember where the bot is *trying* to point. tryShoot compares against
	// this, not the true bearing — otherwise the fire gate would filter out
	// exactly the inaccurate shots and hand the bot perfect aim again.
	this._wantYaw = wantYaw;
	this._wantPitch = wantPitch;

	// Bounded turn rate — this is what makes a bot flankable.
	var maxTurn = d.turnRate * dt;
	var dYaw = U.wrapAngle( wantYaw - this.aimYaw );
	var dPitch = wantPitch - this.aimPitch;
	this.aimYaw = U.wrapAngle( this.aimYaw + U.clamp( dYaw, -maxTurn, maxTurn ) );
	this.aimPitch = U.clamp( this.aimPitch + U.clamp( dPitch, -maxTurn, maxTurn ), -1.4, 1.4 );

	this.applyAim( dt );
};

Bot.prototype.applyAim = function( dt ) {
	this.yaw = this.aimYaw;
	this.pitch = this.aimPitch;
};

Bot.prototype.faceMovement = function( dt ) {
	var sp = Math.sqrt( this.vx * this.vx + this.vz * this.vz );
	if ( sp > 0.5 ) {
		var want = Math.atan2( -this.vx, -this.vz );
		this.aimYaw = U.dampAngle( this.aimYaw, want, 7, dt );
	}
	this.aimPitch = U.damp( this.aimPitch, 0, 4, dt );
	this.applyAim( dt );
};

Bot.prototype.tryShoot = function( dt, t, dist ) {
	var def = this.def();
	var am = this.ammo[ def.id ];
	if ( this.fireT > 0 || this.burstPauseT > 0 ) return;
	if ( am && am.mag <= 0 ) return;
	if ( dist > def.falloffEnd * 1.15 ) return;
	if ( def.melee && dist > def.range ) return;

	/* Hold fire until the aim is actually on target.
	 *
	 * A fixed yaw tolerance is worthless here: 0.2rad is 4 metres of miss at
	 * 20m, so the bot empties its magazine while its aim is still swinging and
	 * lands about one round in fourteen. Gate on the true 3D angle between the
	 * fire direction and the target's chest instead, with a tolerance that
	 * shrinks with distance — i.e. "is the target actually under my sights",
	 * which is the same question a player answers before pulling the trigger. */
	var eyeY = this.y + M.EYE_STAND - ( this.crouching ? 0.6 : 0 );
	var tx = t.x - this.x;
	var ty = ( t.y + 1.21 ) - eyeY;
	var tz = t.z - this.z;
	var tl = Math.sqrt( tx * tx + ty * ty + tz * tz ) || 1;

	var cp = Math.cos( this.pitch );
	var fx = -Math.sin( this.yaw ) * cp;
	var fy = Math.sin( this.pitch );
	var fz = -Math.cos( this.yaw ) * cp;

	/* Fire once the aim has settled where the bot meant to put it. Whether that
	 * is actually on target is the error model's business — checking the true
	 * bearing here would silently discard every inaccurate shot. */
	if ( this._wantYaw !== undefined ) {
		if ( Math.abs( U.wrapAngle( this.aimYaw - this._wantYaw ) ) > 0.045 ) return;
		if ( Math.abs( this.aimPitch - this._wantPitch ) > 0.045 ) return;
	}

	// Loose sanity cone so a bot never fires at something it isn't facing.
	var cosAng = U.clamp( ( fx * tx + fy * ty + fz * tz ) / tl, -1, 1 );
	var allow = Math.atan2( 2.2, Math.max( 2, dist ) ) +
	            this.diff.aimError * 2.2 + def.spreadHip * U.DEG * 0.5;
	if ( Math.acos( cosAng ) > allow ) return;

	// And only with a clear line from the muzzle.
	if ( !this.game.world.lineOfSight( this.x, eyeY, this.z, t.x, t.y + 1.15, t.z ) ) return;

	if ( this.burstLeft <= 0 ) {
		this.burstLeft = U.randInt( this.diff.burst[ 0 ], this.diff.burst[ 1 ] );
	}

	this.shoot( def, am );
	this.burstLeft--;
	if ( this.burstLeft <= 0 || !def.auto ) {
		this.burstPauseT = U.rand( this.diff.burstPause[ 0 ], this.diff.burstPause[ 1 ] );
	}
};

Bot.prototype.shoot = function( def, am ) {
	if ( am ) am.mag--;
	this.fireT = def.interval;

	var eyeY = this.y + M.EYE_STAND - ( this.crouching ? 0.6 : 0 );
	var cp = Math.cos( this.pitch );
	var dir = this._dir.set( -Math.sin( this.yaw ) * cp, Math.sin( this.pitch ),
	                         -Math.cos( this.yaw ) * cp );

	var pellets = def.pellets || 1;
	var spread = def.spreadHip * 0.55 + this.diff.aimError * 12;
	var mz = this.character.getMuzzle( this._muzzle );

	for ( var i = 0; i < pellets; i++ ) {
		var d = this._spread( dir, spread );
		var maxDist = def.melee ? def.range : 300;
		var hit = this.game.traceShot( this.x, eyeY, this.z, d.x, d.y, d.z, maxDist, this );

		var ex, ey, ez;
		if ( hit.hit ) { ex = hit.x; ey = hit.y; ez = hit.z; }
		else { ex = this.x + d.x * maxDist; ey = eyeY + d.y * maxDist; ez = this.z + d.z * maxDist; }

		if ( !def.melee ) {
			this.game.fx.tracer( mz.x, mz.y, mz.z, ex, ey, ez, def.bulletSpeed,
			                     0xffd98a, pellets > 1 ? 0.02 : 0.03 );
		}

		if ( !hit.hit ) continue;
		if ( hit.entity ) {
			var mult = hit.zone === "head" ? def.headMult
			         : ( hit.zone === "legs" ? def.limbMult : 1 );
			var dmg = def.damage * mult * DE.falloff( def, hit.dist );
			this.game.damageEntity( hit.entity, dmg, this, hit.zone, def, d );
			this.game.fx.blood( hit.x, hit.y, hit.z, d.x, d.y, d.z, hit.zone === "head" );
			DE.audio.fleshHit( { x: hit.x, y: hit.y, z: hit.z } );
		} else {
			this.game.fx.impact( hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, hit.tag );
			DE.audio.impact( hit.tag, { x: hit.x, y: hit.y, z: hit.z } );
		}
	}

	DE.audio.gunshot( def.sound, { x: this.x, y: eyeY, z: this.z } );
	this.game.onNoise( this.x, eyeY, this.z, 1.0, this );

	// A round passing near the local player should be audible.
	this.game.checkWhizby( this.x, eyeY, this.z, dir );
};

var _bs = new THREE.Vector3();
Bot.prototype._spread = function( dir, spreadDeg ) {
	var rad = spreadDeg * U.DEG;
	var a = Math.random() * U.TAU;
	var r = Math.abs( U.gauss() ) * 0.5;
	if ( r > 1 ) r = 1;
	var off = r * rad;
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
	return _bs.set( dir.x * cz + rx * sx + ux * sy,
	                dir.y * cz + ry * sx + uy * sy,
	                dir.z * cz + rz * sx + uz * sy ).normalize();
};

/* ------------------------------------------------------------------
 * navigation
 * ------------------------------------------------------------------ */

Bot.prototype.pickPatrolGoal = function() {
	var nav = this.game.nav;
	if ( !nav || !nav.nodes.length ) return;
	var self = this;
	// Wander toward somewhere reasonably far away, favouring open routes.
	var goal = nav.randomNode( null, function( n ) {
		var dx = n.x - self.x, dz = n.z - self.z;
		return dx * dx + dz * dz > 200;
	} );
	this.setPath( goal );
};

Bot.prototype.setPath = function( goalNode ) {
	var nav = this.game.nav;
	var start = nav.nearest( this.x, this.y, this.z, 6 );
	if ( start < 0 || goalNode < 0 ) { this.path = null; return; }
	this.path = nav.path( start, goalNode );
	this.pathIdx = 0;
	this.goalNode = goalNode;
	// Skip the first node if we're basically standing on it.
	if ( this.path && this.path.length > 1 ) {
		var n0 = nav.nodes[ this.path[ 0 ] ];
		var dx = n0.x - this.x, dz = n0.z - this.z;
		if ( dx * dx + dz * dz < 1.2 ) this.pathIdx = 1;
	}
};

Bot.prototype.followPath = function( dt, speedScale ) {
	if ( !this.path || this.pathIdx >= this.path.length ) {
		this.drive( 0, 0, dt, 0 );
		return;
	}
	var nav = this.game.nav;
	var node = nav.nodes[ this.path[ this.pathIdx ] ];
	var dx = node.x - this.x, dz = node.z - this.z;
	var dist = Math.sqrt( dx * dx + dz * dz );

	if ( dist < 1.0 && Math.abs( node.y - this.y ) < 1.6 ) {
		this.pathIdx++;
		if ( this.pathIdx >= this.path.length ) {
			this.path = null;
			return;
		}
		node = nav.nodes[ this.path[ this.pathIdx ] ];
		dx = node.x - this.x; dz = node.z - this.z;
		dist = Math.sqrt( dx * dx + dz * dz ) || 1;
	}

	this.drive( dx / ( dist || 1 ), dz / ( dist || 1 ), dt, speedScale );

	// Jump up onto a step the mover can't walk.
	if ( this.grounded && node.y - this.y > DE.STEP_HEIGHT && dist < 2.4 ) {
		this.vy = M.JUMP_VEL;
	}

	/* stuck detection */
	var moved = Math.abs( this.x - this.lastPos.x ) + Math.abs( this.z - this.lastPos.z );
	this.lastPos.x = this.x; this.lastPos.z = this.z;
	if ( moved < 0.02 && ( Math.abs( this.vx ) + Math.abs( this.vz ) > 0.5 ) ) {
		this.stuckT += dt;
		if ( this.stuckT > 0.7 ) {
			this.stuckT = 0;
			// Re-plan, and hop in case we're caught on a lip.
			this.path = null;
			if ( this.grounded ) this.vy = M.JUMP_VEL * 0.8;
		}
	} else {
		this.stuckT = Math.max( 0, this.stuckT - dt );
	}
};

/* Accelerate toward a world-space direction, using the player's model so bots
 * and players share the same feel and top speed. */
Bot.prototype.drive = function( wx, wz, dt, speedScale ) {
	var len = Math.sqrt( wx * wx + wz * wz );
	var wishSpeed = M.WALK_SPEED * this.def().moveMult * ( speedScale === undefined ? 1 : speedScale );

	if ( this.grounded ) {
		var sp = Math.sqrt( this.vx * this.vx + this.vz * this.vz );
		if ( sp > 0.0001 ) {
			var drop = Math.max( sp, 3.0 ) * M.FRICTION * dt;
			var k = Math.max( 0, sp - drop ) / sp;
			this.vx *= k; this.vz *= k;
		}
	}

	if ( len > 0.0001 ) {
		wx /= len; wz /= len;
		var accel = this.grounded ? M.ACCEL_GROUND : M.ACCEL_AIR;
		var current = this.vx * wx + this.vz * wz;
		var add = wishSpeed - current;
		if ( add > 0 ) {
			var amt = Math.min( add, accel * dt );
			this.vx += wx * amt;
			this.vz += wz * amt;
		}
	}
};

/* ------------------------------------------------------------------ */

Bot.prototype.syncCharacter = function( dt ) {
	this.character.update( dt, {
		x: this.x, y: this.y, z: this.z,
		yaw: this.yaw, pitch: this.pitch,
		speed: Math.sqrt( this.vx * this.vx + this.vz * this.vz ),
		grounded: this.grounded,
		crouch: this.crouching,
		dead: !this.alive,
		vy: this.vy
	} );
	if ( this.character.weaponId !== this.loadout[ this.slot ] ) {
		this.character.setWeapon( this.def() );
	}
};

Bot.prototype.damage = function( amount, source, cause ) {
	if ( !this.alive ) return;
	this.health -= amount;
	this.lastDamageT = this.time;
	// Being shot from an unseen angle makes a bot look, but not instantly aim.
	if ( source && this.state !== "engage" ) {
		this.lastKnown.x = source.x;
		this.lastKnown.y = source.y;
		this.lastKnown.z = source.z;
		this.lastKnown.t = this.time;
		this.state = "seek";
		this.stateT = 0;
		this.path = null;
	}
	if ( this.health <= 0 ) this.game.killEntity( this, source, cause );
};

Bot.DIFFICULTY = DIFFICULTY;
Bot.NAMES = NAMES;
Bot.LOADOUTS = LOADOUTS;
DE.Bot = Bot;

} )( window );
