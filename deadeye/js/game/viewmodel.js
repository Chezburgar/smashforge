/* DEADEYE — weapon models and the first-person viewmodel
 *
 * Models are assembled from the `model.parts` list in weapons.js using the
 * same geometry builder the maps use, so guns and world share one flat-shaded
 * look. Static parts bake into a single mesh; parts that need to animate
 * (magazine, bolt, slide, pump, hammer) stay separate and are addressed by
 * name.
 *
 * The viewmodel renders in its own scene with its own camera. That is what
 * stops the gun clipping through walls when you back into cover: the main
 * scene is drawn, the depth buffer is cleared, then the gun is drawn on top.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

/* Parts addressed by the animation code. Everything else is baked flat. */
var ANIMATED = { mag: 1, bolt: 1, boltKnob: 1, slide: 1, pump: 1, hammer: 1,
                 lever: 1, pin: 1, cyl: 1, belt: 1, trigger: 1 };

/* ------------------------------------------------------------------
 * part emitters
 * ------------------------------------------------------------------ */

function emitPart( b, p, scale ) {
	var s = scale === undefined ? 1 : scale;
	var x = p.x * s, y = p.y * s, z = p.z * s;
	var w = p.w * s, h = p.h * s, d = p.d * s;
	var opts = { collide: false, tint: p.glow ? 1.6 : 1 };

	// box() takes the base Y, the specs give centres.
	var by = y - h * 0.5;

	if ( p.hollow ) {
		// Rectangular outline — iron-sight apertures, trigger guards.
		var t = Math.min( w, h ) * 0.26;
		b.deco( x, y + h * 0.5 - t, z, w, t, d, p.c, opts );
		b.deco( x, y - h * 0.5, z, w, t, d, p.c, opts );
		b.deco( x - w * 0.5 + t * 0.5, by, z, t, h, d, p.c, opts );
		b.deco( x + w * 0.5 - t * 0.5, by, z, t, h, d, p.c, opts );
		return;
	}

	if ( p.round ) {
		// Cylinder along Z (revolver cylinder, grenade body).
		b.cylinder( x, by, z, w * 0.5, h, 9, p.c, { collide: false } );
		return;
	}

	if ( p.blade ) {
		// Tapered blade: a wedge-ish quad pair with a spine.
		var hw = w * 0.5, hh = h * 0.5, hd = d * 0.5;
		var tip = z - hd;
		var col = p.c;
		b.quad( [ x - hw, y + hh, z + hd ], [ x + hw, y + hh, z + hd ],
		        [ x + hw * 0.15, y, tip ], [ x - hw * 0.15, y, tip ],
		        U.shade( col, 1.0 ) );
		b.quad( [ x - hw, y - hh, z + hd ], [ x - hw * 0.15, y, tip ],
		        [ x + hw * 0.15, y, tip ], [ x + hw, y - hh, z + hd ],
		        U.shade( col, 0.72 ) );
		b.quad( [ x - hw, y - hh, z + hd ], [ x - hw, y + hh, z + hd ],
		        [ x - hw * 0.15, y, tip ], [ x - hw * 0.15, y, tip ],
		        U.shade( col, 0.86 ) );
		b.deco( x, y, z + hd * 0.6, w * 0.35, h * 0.9, d * 0.5, U.shade( col, 0.9 ), opts );
		return;
	}

	if ( p.vents ) {
		b.deco( x, by, z, w, h, d, p.c, opts );
		var slots = 5;
		for ( var i = 0; i < slots; i++ ) {
			var vz = z - d * 0.5 + d * ( i + 0.5 ) / slots;
			b.deco( x, y + h * 0.5 * 0.6, vz, w * 1.04, h * 0.22, d * 0.06,
			        U.shade( p.c, 0.5 ), opts );
		}
		return;
	}

	if ( p.curve ) {
		// Curved magazine — three stacked segments with increasing rake.
		var segs = 3;
		for ( var k = 0; k < segs; k++ ) {
			var t = k / ( segs - 1 || 1 );
			b.deco( x, by + h * ( k / segs ), z + t * d * 0.22,
			        w, h / segs * 1.08, d * ( 1 - t * 0.14 ),
			        U.shade( p.c, 1 - t * 0.06 ), opts );
		}
		return;
	}

	if ( p.tilt ) {
		b.deco( x, by, z, w, h, d, p.c, { collide: false, yaw: 0 } );
		// Approximate a raked grip by stacking offset slices.
		return;
	}

	b.deco( x, by, z, w, h, d, p.c, opts );
}

/* Build a weapon model. Returns a THREE.Group with `.parts` mapping animated
 * part names to their meshes, and `.muzzle` / `.eject` marker Object3Ds. */
DE.buildWeaponModel = function( def, opts ) {
	opts = opts || {};
	var scale = opts.scale === undefined ? 1 : opts.scale;
	var group = new THREE.Group();
	group.parts = {};

	var spec = def.model;
	var staticB = new DE.Builder();
	var hasStatic = false;

	for ( var i = 0; i < spec.parts.length; i++ ) {
		var p = spec.parts[ i ];
		if ( ANIMATED[ p.n ] ) {
			var pb = new DE.Builder();
			// Animated parts are built at the origin and positioned by the
			// group transform, so rotation pivots make sense.
			emitPart( pb, {
				n: p.n, x: 0, y: 0, z: 0, w: p.w, h: p.h, d: p.d, c: p.c,
				hollow: p.hollow, round: p.round, blade: p.blade,
				vents: p.vents, curve: p.curve, glow: p.glow
			}, scale );
			var m = pb.toMesh( { castShadow: !!opts.castShadow, receiveShadow: false } );
			m.matrixAutoUpdate = true;
			m.position.set( p.x * scale, p.y * scale, p.z * scale );
			m.userData.home = m.position.clone();
			group.add( m );
			group.parts[ p.n ] = m;
		} else {
			emitPart( staticB, p, scale );
			hasStatic = true;
		}
	}

	if ( hasStatic ) {
		var sm = staticB.toMesh( { castShadow: !!opts.castShadow, receiveShadow: false } );
		sm.matrixAutoUpdate = false;
		sm.updateMatrix();
		group.add( sm );
		group.staticMesh = sm;
	}

	var mz = new THREE.Object3D();
	mz.position.set( spec.muzzle[ 0 ] * scale, spec.muzzle[ 1 ] * scale, spec.muzzle[ 2 ] * scale );
	group.add( mz );
	group.muzzle = mz;

	if ( spec.eject ) {
		var ej = new THREE.Object3D();
		ej.position.set( spec.eject[ 0 ] * scale, spec.eject[ 1 ] * scale, spec.eject[ 2 ] * scale );
		group.add( ej );
		group.eject = ej;
	}

	return group;
};

/* ------------------------------------------------------------------
 * Viewmodel
 * ------------------------------------------------------------------ */

/* Rest and aim poses, per weapon class. The aim pose puts the sight line on
 * the screen centre; `aimY` is tuned per weapon so irons line up. */
/* Weapon models are authored at real-world scale (a rifle is ~0.75m long).
 * Rendered at 1:1 that close to the near plane the gun swallows a third of
 * the screen, so the viewmodel is drawn smaller and pushed further out —
 * the standard trick, and the ratio every FPS ends up at. */
var VM_SCALE = 0.66;

var POSE = {
	rest:  { x: 0.175, y: -0.150, z: -0.46, rx: 0.02, ry: -0.07, rz: 0.02 },
	aim:   { x: 0.0,   y: -0.055, z: -0.34, rx: 0,    ry: 0,     rz: 0 },
	sprint:{ x: 0.20,  y: -0.21,  z: -0.42, rx: -0.32, ry: -0.55, rz: 0.22 },
	down:  { x: 0.19,  y: -0.44,  z: -0.40, rx: -0.85, ry: -0.25, rz: 0.1 }
};

/* Per-weapon aim offset so each gun's sights sit on the crosshair. Values are
 * the model-space sight height times VM_SCALE, negated. */
var AIM_Y = {
	rk77: -0.066, vector9: -0.065, breach12: -0.041, longbow: -0.076,
	m14: -0.071, saw60: -0.066, p9: -0.037, hcannon: -0.041,
	knife: -0.14, frag: -0.12
};

function Viewmodel( renderer ) {
	this.renderer = renderer;
	this.scene = new THREE.Scene();
	this.camera = new THREE.PerspectiveCamera( 70, 1, 0.005, 6 );

	// Lighting tuned so the gun reads clearly against any map palette. Fixed
	// relative to the camera, so it never goes black in a dark corner.
	var key = new THREE.DirectionalLight( 0xfff4e0, 1.5 );
	key.position.set( -0.4, 0.9, 0.7 );
	this.scene.add( key );
	var fill = new THREE.DirectionalLight( 0xbdd4ff, 0.7 );
	fill.position.set( 0.9, -0.1, 0.35 );
	this.scene.add( fill );
	// A rim from behind separates the dark receiver from a dark background.
	var rim = new THREE.DirectionalLight( 0xffffff, 0.5 );
	rim.position.set( 0.2, 0.4, -1 );
	this.scene.add( rim );
	this.scene.add( new THREE.AmbientLight( 0xffffff, 0.55 ) );
	this.keyLight = key;

	this.root = new THREE.Group();
	this.scene.add( this.root );

	this.models = {};      // id -> Group, built lazily and cached
	this.current = null;
	this.def = null;

	// Motion state.
	this.bob = 0;
	this.bobAmt = 0;
	this.sway = { x: 0, y: 0 };
	this.swayVel = { x: 0, y: 0 };
	this.recoilPos = new U.Spring( 190, 17 );
	this.recoilRot = new U.Spring( 170, 15 );
	this.aimT = 0;
	this.lowerT = 0;      // 1 = fully lowered (switching / sprinting)
	this.reloadT = -1;
	this.reloadDur = 0;
	this.reloadKind = "mag";
	this.meleeT = -1;
	this.throwT = -1;
	this.pumpT = -1;
	this.boltT = -1;
	this.slideT = 0;
	this.hidden = false;

	this.muzzleFlash = this._makeFlash();
	this.scene.add( this.muzzleFlash );
	this.muzzleFlash.visible = false;
	this.flashT = 0;
}

Viewmodel.prototype._makeFlash = function() {
	var g = new THREE.Group();
	// A star of intersecting quads reads as a flash from any angle without a
	// texture or a sprite sheet.
	var mat = new THREE.MeshBasicMaterial( {
		color: 0xffe8a8, transparent: true, opacity: 0.95,
		blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
	} );
	this.flashMat = mat;
	var core = new THREE.Mesh( new THREE.SphereGeometry( 0.028, 6, 4 ), mat );
	g.add( core );
	for ( var i = 0; i < 3; i++ ) {
		var pl = new THREE.Mesh( new THREE.PlaneGeometry( 0.20, 0.075 ), mat );
		pl.rotation.z = ( i / 3 ) * Math.PI;
		g.add( pl );
	}
	var cone = new THREE.Mesh( new THREE.ConeGeometry( 0.035, 0.13, 5, 1, true ), mat );
	cone.rotation.x = -Math.PI / 2;
	cone.position.z = -0.06;
	g.add( cone );
	return g;
};

Viewmodel.prototype.setWeapon = function( def ) {
	if ( this.current ) this.root.remove( this.current );
	if ( !this.models[ def.id ] ) {
		this.models[ def.id ] = DE.buildWeaponModel( def, { scale: VM_SCALE } );
	}
	this.current = this.models[ def.id ];
	this.def = def;
	this.root.add( this.current );
	this.reloadT = -1;
	this.meleeT = -1;
	this.throwT = -1;
	this.lowerT = 1;      // raise animation on switch
	// Reset animated parts to their home transforms.
	for ( var k in this.current.parts ) {
		var m = this.current.parts[ k ];
		m.position.copy( m.userData.home );
		m.rotation.set( 0, 0, 0 );
		m.visible = true;
	}
};

Viewmodel.prototype.fire = function( recoilScale ) {
	var s = recoilScale === undefined ? 1 : recoilScale;
	this.recoilPos.kick( 2.6 * s * ( this.def.kick / 0.03 ) );
	this.recoilRot.kick( 3.4 * s * ( this.def.kick / 0.03 ) );
	this.flashT = 0.045;
	this.slideT = 1;
	if ( this.def.pump ) this.pumpT = 0;
	if ( this.def.bolt ) this.boltT = 0;
};

Viewmodel.prototype.startReload = function( duration, kind ) {
	this.reloadT = 0;
	this.reloadDur = duration;
	this.reloadKind = kind || "mag";
};

Viewmodel.prototype.startMelee = function() { this.meleeT = 0; };
Viewmodel.prototype.startThrow = function() { this.throwT = 0; };

/* dt, and a state bag from the player controller. */
Viewmodel.prototype.update = function( dt, st ) {
	if ( !this.current ) return;
	var def = this.def;

	/* --- aim blend --- */
	var aimTarget = st.aiming && !st.sprinting && this.reloadT < 0 &&
	                this.meleeT < 0 && this.throwT < 0 ? 1 : 0;
	var aimRate = 1 / Math.max( 0.05, def.adsTime );
	this.aimT = U.moveTowards( this.aimT, aimTarget, aimRate * dt );

	/* --- lower blend (switching, sprinting) --- */
	var lowerTarget = st.sprinting && !st.aiming ? 0.55 : 0;
	if ( st.switching ) lowerTarget = 1;
	this.lowerT = U.damp( this.lowerT, lowerTarget, 12, dt );

	/* --- weapon sway from look input --- */
	// Spring the sway so fast flicks whip the gun and it settles back.
	var swayScale = ( 1 - this.aimT * 0.72 );
	this.swayVel.x += ( -st.lookDX * 0.9 - this.sway.x * 26 ) * dt * 26;
	this.swayVel.y += ( -st.lookDY * 0.9 - this.sway.y * 26 ) * dt * 26;
	this.swayVel.x *= Math.exp( -12 * dt );
	this.swayVel.y *= Math.exp( -12 * dt );
	this.sway.x = U.clamp( this.sway.x + this.swayVel.x * dt, -0.09, 0.09 );
	this.sway.y = U.clamp( this.sway.y + this.swayVel.y * dt, -0.09, 0.09 );

	/* --- walk bob --- */
	var speedN = U.clamp( st.speed / 7.5, 0, 1.4 );
	this.bobAmt = U.damp( this.bobAmt, st.grounded ? speedN : 0, 8, dt );
	this.bob += dt * ( 7.5 + speedN * 4.5 ) * ( st.grounded ? speedN : 0 );

	/* --- springs --- */
	this.recoilPos.target = 0;
	this.recoilRot.target = 0;
	this.recoilPos.step( dt );
	this.recoilRot.step( dt );

	/* --- pose --- */
	var rest = POSE.rest, aim = POSE.aim;
	var px = U.lerp( rest.x, aim.x, this.aimT );
	var py = U.lerp( rest.y, AIM_Y[ def.id ] === undefined ? aim.y : AIM_Y[ def.id ], this.aimT );
	var pz = U.lerp( rest.z, aim.z, this.aimT );
	var rx = U.lerp( rest.rx, aim.rx, this.aimT );
	var ry = U.lerp( rest.ry, aim.ry, this.aimT );
	var rz = U.lerp( rest.rz, aim.rz, this.aimT );

	// Sprint / lower pose blended on top.
	var lp = st.switching ? POSE.down : POSE.sprint;
	px = U.lerp( px, lp.x, this.lowerT );
	py = U.lerp( py, lp.y, this.lowerT );
	pz = U.lerp( pz, lp.z, this.lowerT );
	rx = U.lerp( rx, lp.rx, this.lowerT );
	ry = U.lerp( ry, lp.ry, this.lowerT );
	rz = U.lerp( rz, lp.rz, this.lowerT );

	// Bob: a figure-eight, halved while aiming.
	var bobScale = ( 1 - this.aimT * 0.8 ) * this.bobAmt;
	px += Math.sin( this.bob ) * 0.022 * bobScale;
	py += Math.abs( Math.cos( this.bob ) ) * -0.018 * bobScale;
	rz += Math.sin( this.bob ) * 0.030 * bobScale;
	rx += Math.abs( Math.cos( this.bob ) ) * 0.012 * bobScale;

	// Idle breathing.
	var t = st.time;
	px += Math.sin( t * 1.1 ) * 0.0035 * ( 1 - this.aimT * 0.5 );
	py += Math.sin( t * 1.6 + 1 ) * 0.0035 * ( 1 - this.aimT * 0.5 );

	// Sway.
	px += this.sway.x * swayScale;
	py += this.sway.y * swayScale;
	ry += this.sway.x * 0.9 * swayScale;
	rx += -this.sway.y * 0.9 * swayScale;

	// Airborne tilt.
	rz += U.clamp( -st.vy * 0.006, -0.09, 0.09 ) * ( 1 - this.aimT );

	// Recoil.
	var rc = this.recoilPos.value;
	pz += rc * 0.016;
	py += rc * 0.004;
	rx += this.recoilRot.value * 0.020;
	rz += this.recoilRot.value * 0.004;

	/* --- reload / melee / throw overrides --- */
	this._animateAction( dt, def );
	var a = this._actionPose;
	if ( a ) {
		px += a.x; py += a.y; pz += a.z;
		rx += a.rx; ry += a.ry; rz += a.rz;
	}

	this.root.position.set( px, py, pz );
	this.root.rotation.set( rx, ry, rz );

	/* --- muzzle flash --- */
	if ( this.flashT > 0 ) {
		this.flashT -= dt;
		var f = this.current.muzzle;
		f.updateWorldMatrix( true, false );
		this.muzzleFlash.position.setFromMatrixPosition( f.matrixWorld );
		this.muzzleFlash.rotation.copy( this.root.rotation );
		this.muzzleFlash.rotation.z = Math.random() * 6.28;
		var k = U.clamp( this.flashT / 0.045, 0, 1 );
		var sc = ( 0.75 + Math.random() * 0.5 ) * ( 0.5 + k );
		this.muzzleFlash.scale.setScalar( sc * ( def.kick / 0.03 ) * 0.9 * VM_SCALE );
		this.flashMat.opacity = 0.95 * k;
		this.muzzleFlash.visible = !this.hidden && this.aimT < 0.98;
	} else {
		this.muzzleFlash.visible = false;
	}

	/* --- animated sub-parts --- */
	this._animateParts( dt, def );

	this.root.visible = !this.hidden;
};

/* Slide/bolt cycling, magazine drop, pump action. */
Viewmodel.prototype._animateParts = function( dt, def ) {
	var parts = this.current.parts;

	// Reciprocating bolt or slide on each shot.
	this.slideT = Math.max( 0, this.slideT - dt / 0.055 );
	var cyc = Math.sin( this.slideT * Math.PI ) * 0.03;
	if ( parts.slide ) parts.slide.position.z = parts.slide.userData.home.z + cyc;
	if ( parts.bolt ) parts.bolt.position.z = parts.bolt.userData.home.z + cyc * 0.8;
	if ( parts.boltKnob ) parts.boltKnob.position.z = parts.boltKnob.userData.home.z + cyc * 0.8;
	if ( parts.hammer ) parts.hammer.rotation.x = -cyc * 12;
	if ( parts.trigger ) parts.trigger.rotation.x = cyc * 8;

	// Revolver cylinder indexes round.
	if ( parts.cyl && this.slideT > 0 ) {
		parts.cyl.rotation.z += dt * 10;
	}

	// Pump action after a shotgun shot.
	if ( this.pumpT >= 0 ) {
		this.pumpT += dt;
		var pd = def.pump || 0.6;
		var pt = U.clamp( this.pumpT / pd, 0, 1 );
		var back = Math.sin( pt * Math.PI );
		if ( parts.pump ) parts.pump.position.z = parts.pump.userData.home.z + back * 0.085;
		if ( this.pumpT >= pd ) this.pumpT = -1;
	}

	// Bolt cycle after a sniper shot.
	if ( this.boltT >= 0 ) {
		this.boltT += dt;
		var bd = def.bolt || 1.0;
		var bt = U.clamp( this.boltT / bd, 0, 1 );
		var lift = Math.sin( U.clamp( bt * 3, 0, 1 ) * Math.PI );
		var pull = Math.sin( U.clamp( ( bt - 0.15 ) * 1.6, 0, 1 ) * Math.PI );
		if ( parts.boltKnob ) {
			parts.boltKnob.rotation.z = -lift * 1.1;
			parts.boltKnob.position.z = parts.boltKnob.userData.home.z + pull * 0.075;
			parts.boltKnob.position.y = parts.boltKnob.userData.home.y + lift * 0.018;
		}
		if ( parts.bolt ) parts.bolt.position.z = parts.bolt.userData.home.z + pull * 0.075;
		if ( this.boltT >= bd ) this.boltT = -1;
	}

	// Magazine leaves the gun during a mag reload.
	if ( parts.mag ) {
		var drop = 0;
		if ( this.reloadT >= 0 && this.reloadKind === "mag" ) {
			var t = this.reloadT / this.reloadDur;
			if ( t < 0.42 ) drop = U.smoothstep( t / 0.42 );
			else if ( t < 0.62 ) drop = 1;
			else drop = 1 - U.smoothstep( ( t - 0.62 ) / 0.38 );
		}
		parts.mag.position.y = parts.mag.userData.home.y - drop * 0.30;
		parts.mag.rotation.x = drop * 0.5;
		parts.mag.visible = drop < 0.98;
	}
};

/* Additive pose offsets for reload / melee / grenade, written to
 * this._actionPose. */
Viewmodel.prototype._animateAction = function( dt, def ) {
	this._actionPose = null;

	if ( this.reloadT >= 0 ) {
		this.reloadT += dt;
		var t = U.clamp( this.reloadT / this.reloadDur, 0, 1 );
		// Dip down and rotate in, hold, come back up.
		var dip = Math.sin( U.clamp( t * 1.35, 0, 1 ) * Math.PI ) ;
		this._actionPose = {
			x: dip * 0.045, y: -dip * 0.10, z: dip * 0.035,
			rx: -dip * 0.42, ry: dip * 0.30, rz: dip * 0.22
		};
		if ( this.reloadT >= this.reloadDur ) this.reloadT = -1;
		return;
	}

	if ( this.meleeT >= 0 ) {
		this.meleeT += dt;
		var md = 0.42;
		var mt = U.clamp( this.meleeT / md, 0, 1 );
		// Wind up, slash across, recover.
		var swing = mt < 0.3 ? -U.smoothstep( mt / 0.3 ) * 0.4
		          : ( mt < 0.55 ? U.lerp( -0.4, 1, ( mt - 0.3 ) / 0.25 )
		                        : 1 - U.smoothstep( ( mt - 0.55 ) / 0.45 ) );
		this._actionPose = {
			x: -swing * 0.16, y: swing * 0.05, z: swing * 0.11,
			rx: swing * 0.30, ry: swing * 0.85, rz: -swing * 0.65
		};
		if ( this.meleeT >= md ) this.meleeT = -1;
		return;
	}

	if ( this.throwT >= 0 ) {
		this.throwT += dt;
		var td = 0.55;
		var tt = U.clamp( this.throwT / td, 0, 1 );
		var wind = tt < 0.35 ? U.smoothstep( tt / 0.35 ) : 1 - U.smoothstep( ( tt - 0.35 ) / 0.3 );
		var fwd = tt > 0.35 ? U.smoothstep( ( tt - 0.35 ) / 0.25 ) : 0;
		this._actionPose = {
			x: 0, y: wind * 0.10 - fwd * 0.04, z: wind * 0.14 - fwd * 0.10,
			rx: -wind * 0.9 + fwd * 0.5, ry: 0, rz: 0
		};
		if ( this.throwT >= td ) this.throwT = -1;
		return;
	}
};

/* Draw on top of the main scene. Called after the world render. */
Viewmodel.prototype.render = function( fov, aspect ) {
	if ( this.hidden || !this.current ) return;
	// A narrower FOV than the world keeps the gun from distorting at high FOV.
	this.camera.fov = U.lerp( 62, fov, 0.35 );
	this.camera.aspect = aspect;
	this.camera.updateProjectionMatrix();
	this.renderer.clearDepth();
	this.renderer.render( this.scene, this.camera );
};

/* World-space position of the muzzle in the MAIN scene, used to spawn tracers
 * so they leave the barrel rather than the camera. */
Viewmodel.prototype.muzzleWorld = function( camera, out ) {
	out = out || new THREE.Vector3();
	if ( !this.current ) { out.copy( camera.position ); return out; }
	this.current.muzzle.updateWorldMatrix( true, false );
	out.setFromMatrixPosition( this.current.muzzle.matrixWorld );
	// The viewmodel camera sits at the origin looking down -Z, so viewmodel
	// space maps onto camera space directly.
	out.applyMatrix4( camera.matrixWorld );
	return out;
};

DE.Viewmodel = Viewmodel;
DE.WEAPON_AIM_Y = AIM_Y;

} )( window );
