/* DEADEYE — third-person character
 *
 * A blocky soldier assembled from baked limb meshes hung off a small skeleton.
 * Geometry is built once per team colour and shared between every instance, so
 * spawning a full lobby costs a handful of meshes rather than a rebuild.
 *
 * Hit detection uses three yaw-rotated boxes (head / torso / legs) rather than
 * the render meshes. They are wider than the visual limbs on purpose —
 * registering hits is more important than pixel-perfect fidelity.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

/* Fatigues stay dark and desaturated on every team; only the carrier, helmet
 * and trim carry the team colour. A figure coloured all one hue reads as a
 * silhouette blob at range — the contrast between dark limbs and a bright
 * torso is what makes a target identifiable across a map. */
var TEAM_COLORS = [
	{ // 0 — blue
		vest: 0x3a63a2, helmet: 0x2f4d82, trim: 0x6f9ede,
		cloth: 0x2f353d, skin: 0xc99a72, boot: 0x1c2026, pack: 0x272d36
	},
	{ // 1 — red
		vest: 0xb3403a, helmet: 0x8a302b, trim: 0xe8705f,
		cloth: 0x35302e, skin: 0xc08a63, boot: 0x1f1b1a, pack: 0x2c2624
	},
	{ // 2 — neutral / spectator
		vest: 0x6b727b, helmet: 0x545b64, trim: 0x99a1aa,
		cloth: 0x33383f, skin: 0xc99a72, boot: 0x1e2126, pack: 0x2b3038
	}
];

/* Standing hip height; the whole skeleton hangs off this. */
var HIP_Y = 0.98;

var geomCache = {};

/* Build the shared geometry for one team palette. */
function buildTeamGeometry( team ) {
	if ( geomCache[ team ] ) return geomCache[ team ];
	var C = TEAM_COLORS[ team ];
	var out = {};

	function bake( fn ) {
		var b = new DE.Builder();
		fn( b );
		var g = new THREE.BufferGeometry();
		g.setAttribute( "position", new THREE.Float32BufferAttribute( b.pos, 3 ) );
		g.setAttribute( "normal", new THREE.Float32BufferAttribute( b.nrm, 3 ) );
		g.setAttribute( "color", new THREE.Float32BufferAttribute( b.col, 3 ) );
		g.computeBoundingSphere();
		return g;
	}

	/* Proportions are laid out against a 1.80m standing figure with the feet at
	 * y = 0, matching the player's collision height exactly:
	 *
	 *   0.00 - 0.16  boot        0.98 - 1.50  torso
	 *   0.16 - 0.60  shin        1.34         shoulder joints
	 *   0.60         knee        1.48 - 1.70  skull
	 *   0.60 - 0.98  thigh       1.63 - 1.78  helmet
	 *   0.98         hips
	 *
	 * Getting this wrong is not cosmetic: the hitboxes below are derived from
	 * these numbers, so a model that floats or sits short makes every shot
	 * land somewhere other than where it looks. */

	/* Torso: plate carrier over fatigues. Origin at the hips so the chest
	 * pitches around the waist. */
	out.torso = bake( function( b ) {
		b.deco( 0, 0, 0, 0.42, 0.52, 0.25, C.cloth );              // body
		b.deco( 0, 0.08, 0, 0.46, 0.36, 0.29, C.vest );            // carrier
		b.deco( 0, 0.08, -0.15, 0.38, 0.32, 0.03, C.trim );        // front plate
		b.deco( 0, 0.38, 0, 0.48, 0.10, 0.31, C.vest );            // shoulder yoke
		// Magazine pouches across the chest.
		for ( var i = -1; i <= 1; i++ ) {
			b.deco( i * 0.12, 0.05, -0.16, 0.09, 0.14, 0.06, C.pack );
		}
		b.deco( 0, 0.14, 0.15, 0.32, 0.24, 0.07, C.pack );         // back pack
		b.deco( -0.16, 0.26, 0.16, 0.10, 0.17, 0.05, C.trim );     // radio
		b.deco( 0, -0.06, 0, 0.36, 0.10, 0.27, C.boot );           // belt
	} );

	/* Head: origin at the base of the neck (world 1.48 when standing). */
	out.head = bake( function( b ) {
		b.deco( 0, -0.08, 0, 0.14, 0.10, 0.15, C.cloth );          // neck
		b.deco( 0, 0, 0, 0.21, 0.22, 0.22, C.skin );               // skull
		b.deco( 0, 0.15, 0, 0.255, 0.15, 0.265, C.helmet );        // dome
		b.deco( 0, 0.11, -0.11, 0.245, 0.06, 0.09, C.helmet );     // brim
		b.deco( 0, 0.21, 0.02, 0.21, 0.05, 0.215, C.trim );        // top band
		b.deco( 0, 0.06, -0.115, 0.19, 0.08, 0.035, 0x1d2228 );    // visor
		for ( var s = -1; s <= 1; s += 2 ) {
			b.deco( s * 0.13, 0.06, 0.01, 0.05, 0.10, 0.115, C.helmet );   // ear cups
		}
		b.deco( 0.105, 0.05, -0.07, 0.05, 0.05, 0.10, C.pack );    // mic boom
	} );

	out.upperArm = bake( function( b ) {
		b.deco( 0, -0.26, 0, 0.12, 0.26, 0.13, C.cloth );
		b.deco( 0, -0.04, 0, 0.14, 0.11, 0.145, C.vest );          // shoulder pad
	} );

	out.lowerArm = bake( function( b ) {
		b.deco( 0, -0.25, 0, 0.105, 0.25, 0.11, C.cloth );
		b.deco( 0, -0.06, 0, 0.115, 0.08, 0.12, C.pack );          // elbow pad
		b.deco( 0, -0.31, 0, 0.10, 0.09, 0.105, C.boot );          // glove
	} );

	out.thigh = bake( function( b ) {
		b.deco( 0, -0.38, 0, 0.155, 0.38, 0.165, C.cloth );
		b.deco( 0, -0.26, -0.075, 0.135, 0.16, 0.05, C.pack );     // drop pouch
	} );

	out.shin = bake( function( b ) {
		b.deco( 0, -0.44, 0, 0.13, 0.44, 0.135, C.cloth );
		b.deco( 0, -0.10, -0.065, 0.12, 0.11, 0.05, C.pack );      // knee pad
		b.deco( 0, -0.60, -0.035, 0.145, 0.16, 0.235, C.boot );    // boot
	} );

	geomCache[ team ] = out;
	return out;
}

/* ------------------------------------------------------------------ */

function Character( opts ) {
	opts = opts || {};
	this.team = opts.team === undefined ? 2 : opts.team;
	var G = buildTeamGeometry( this.team );

	this.mat = new THREE.MeshLambertMaterial( { vertexColors: true } );

	this.root = new THREE.Group();
	this.root.matrixAutoUpdate = true;

	function mesh( geo ) {
		var m = new THREE.Mesh( geo, this.mat );
		m.castShadow = true;
		m.receiveShadow = false;
		return m;
	}
	mesh = mesh.bind( this );

	// hips -> chest -> ( head, arms ) ; hips -> legs
	this.hips = new THREE.Group();
	this.hips.position.y = HIP_Y;
	this.root.add( this.hips );

	this.chest = new THREE.Group();
	this.hips.add( this.chest );
	this.torso = mesh( G.torso );
	this.chest.add( this.torso );

	this.neck = new THREE.Group();
	this.neck.position.y = 0.50;          // world 1.48 standing
	this.chest.add( this.neck );
	this.head = mesh( G.head );
	this.neck.add( this.head );

	this.arms = [];
	for ( var s = 0; s < 2; s++ ) {
		var sign = s === 0 ? -1 : 1;
		var shoulder = new THREE.Group();
		shoulder.position.set( sign * 0.28, 0.36, 0 );   // world 1.34
		this.chest.add( shoulder );
		var upper = mesh( G.upperArm );
		shoulder.add( upper );
		var elbow = new THREE.Group();
		elbow.position.y = -0.26;
		shoulder.add( elbow );
		var lower = mesh( G.lowerArm );
		elbow.add( lower );
		this.arms.push( { shoulder: shoulder, elbow: elbow, sign: sign } );
	}

	this.legs = [];
	for ( var l = 0; l < 2; l++ ) {
		var lsign = l === 0 ? -1 : 1;
		var hip = new THREE.Group();
		hip.position.set( lsign * 0.13, 0, 0 );
		this.hips.add( hip );
		var thigh = mesh( G.thigh );
		hip.add( thigh );
		var knee = new THREE.Group();
		knee.position.y = -0.38;
		hip.add( knee );
		var shin = mesh( G.shin );
		knee.add( shin );
		this.legs.push( { hip: hip, knee: knee, sign: lsign } );
	}

	/* The weapon hangs off the chest rather than the hand.
	 *
	 * Parenting it to the hand means its aim is whatever falls out of the
	 * accumulated shoulder and elbow rotations, which never points where the
	 * character is actually shooting. Mounting it to the chest and pitching it
	 * to the aim angle makes the barrel agree with the bullet, and the arms are
	 * then posed to look like they are holding it. */
	this.weaponMount = new THREE.Group();
	this.weaponMount.position.set( 0.15, 0.20, -0.20 );
	this.chest.add( this.weaponMount );
	this.weaponModel = null;
	this.weaponId = null;

	/* state */
	this.phase = Math.random() * 6.28;
	this.crouch = 0;
	this.dead = false;
	this.deathT = 0;
	this.deathAxis = 0;
	this.yaw = 0;
	this.pitch = 0;
	this.visible = true;
	this.speed = 0;
	this.grounded = true;
	this.lean = 0;
	this.muzzleWorld = new THREE.Vector3();
	this._v = new THREE.Vector3();

	/* Hitboxes in local space (before yaw), derived from the proportions above:
	 * head 1.46-1.80, torso 0.92-1.50, legs 0.00-0.92. Slightly wider than the
	 * visual limbs — registering the hit matters more than pixel fidelity. */
	this.hitboxes = [
		{ zone: "head",  cy: 1.63, hx: 0.16, hy: 0.17, hz: 0.16 },
		{ zone: "torso", cy: 1.21, hx: 0.27, hy: 0.29, hz: 0.20 },
		{ zone: "legs",  cy: 0.46, hx: 0.25, hy: 0.46, hz: 0.21 }
	];
}


/* Clear the death pose and put the figure back on its feet.
 *
 * The topple animation writes root.rotation.x/z and fades the shared material.
 * update() only ever assigns rotation.y, so anything that clears `dead`
 * without coming through here leaves the model lying at an angle for the rest
 * of its life — which is exactly what a respawn does. */
Character.prototype.reset = function() {
	this.dead = false;
	this.deathT = 0;
	this.root.rotation.set( 0, 0, 0 );
	this.hips.position.y = HIP_Y;
	this.mat.opacity = 1;
	this.mat.transparent = false;
	this.mat.depthWrite = true;
	this.root.visible = this.visible;
};

Character.prototype.setWeapon = function( def ) {
	if ( this.weaponId === def.id ) return;
	if ( this.weaponModel ) this.weaponMount.remove( this.weaponModel );
	this.weaponModel = DE.buildWeaponModel( def, { scale: 0.9, castShadow: true } );
	// The model already points down -Z, which is the mount's forward, so no
	// rotation is needed — the barrel lines up with the aim by construction.
	this.weaponModel.position.set( 0, 0, 0 );
	this.weaponMount.add( this.weaponModel );
	this.weaponId = def.id;
};

/* st: { x, y, z, yaw, pitch, speed, grounded, crouch, dead, firing } */
Character.prototype.update = function( dt, st ) {
	this.root.position.set( st.x, st.y, st.z );
	this.yaw = st.yaw;
	this.pitch = st.pitch;
	this.speed = st.speed;
	this.grounded = st.grounded;

	if ( st.dead ) {
		if ( !this.dead ) {
			this.dead = true;
			this.deathT = 0;
			this.deathAxis = ( Math.random() - 0.5 ) * 2;
		}
		this._animateDeath( dt );
		return;
	}
	if ( this.dead ) this.reset();

	this.root.rotation.y = st.yaw;
	this.crouch = U.damp( this.crouch, st.crouch ? 1 : 0, 14, dt );

	/* --- locomotion --- */
	var sp = st.speed;
	var moving = sp > 0.4 && st.grounded;
	var stride = moving ? ( 5.0 + U.clamp( sp, 0, 9 ) * 0.62 ) : 0;
	this.phase += dt * stride;

	var amp = U.clamp( sp / 7.5, 0, 1.25 ) * ( 1 - this.crouch * 0.45 );
	var swing = Math.sin( this.phase );
	var swing2 = Math.sin( this.phase + Math.PI );

	// Legs.
	var lift = 0.9 * amp;
	this.legs[ 0 ].hip.rotation.x = swing * lift;
	this.legs[ 1 ].hip.rotation.x = swing2 * lift;
	// Knees only bend one way.
	this.legs[ 0 ].knee.rotation.x = Math.max( 0, -swing ) * 1.25 * amp;
	this.legs[ 1 ].knee.rotation.x = Math.max( 0, -swing2 ) * 1.25 * amp;

	if ( !st.grounded ) {
		// Tuck in the air.
		var tuck = U.clamp( -st.vy * 0.05, -0.4, 0.7 );
		this.legs[ 0 ].hip.rotation.x = -0.35 - tuck * 0.3;
		this.legs[ 1 ].hip.rotation.x = 0.25 + tuck * 0.2;
		this.legs[ 0 ].knee.rotation.x = 0.75 + tuck * 0.4;
		this.legs[ 1 ].knee.rotation.x = 0.35;
	}

	// Crouch: fold the legs and drop the hips.
	var crouchFold = this.crouch;
	this.legs[ 0 ].hip.rotation.x += crouchFold * -0.85;
	this.legs[ 1 ].hip.rotation.x += crouchFold * -0.85;
	this.legs[ 0 ].knee.rotation.x += crouchFold * 1.5;
	this.legs[ 1 ].knee.rotation.x += crouchFold * 1.5;

	var bobY = moving ? Math.abs( Math.cos( this.phase ) ) * 0.035 * amp : 0;
	this.hips.position.y = HIP_Y - crouchFold * 0.40 - bobY;
	this.hips.rotation.z = swing * 0.045 * amp;
	this.hips.rotation.y = -swing * 0.10 * amp;

	/* --- upper body --- */
	// The chest carries the aim pitch so the whole torso leans into the shot.
	this.chest.rotation.x = U.clamp( st.pitch, -0.9, 0.7 ) * 0.55 + crouchFold * 0.22;
	this.chest.rotation.y = swing * 0.09 * amp;
	this.chest.rotation.z = -swing * 0.03 * amp;
	// Head counter-rotates so it keeps looking where the player aims.
	this.neck.rotation.x = U.clamp( st.pitch, -0.9, 0.7 ) * 0.45;
	this.neck.rotation.y = -this.chest.rotation.y * 0.6;

	/* The weapon mount pitches to the true aim angle. chest.rotation.x already
	 * carries part of the pitch, so the mount takes the remainder — the sum is
	 * exactly the angle the shot is fired along. */
	var aimPitch = U.clamp( st.pitch, -1.2, 0.9 );
	this.weaponMount.rotation.x = aimPitch - this.chest.rotation.x;
	this.weaponMount.rotation.y = -this.chest.rotation.y;

	// Arms hold the weapon in front of the chest, independent of the walk.
	var a0 = this.arms[ 0 ], a1 = this.arms[ 1 ];
	// Right arm at the grip, left arm across to the handguard.
	a1.shoulder.rotation.set( -1.18 + aimPitch * 0.35, -0.34, -0.20 );
	a1.elbow.rotation.set( -0.72, 0, 0.10 );
	a0.shoulder.rotation.set( -1.30 + aimPitch * 0.35, 0.58, 0.34 );
	a0.elbow.rotation.set( -1.05, 0, -0.12 );

	// Weapon-specific grip tweaks.
	if ( this.weaponId === "p9" || this.weaponId === "hcannon" ) {
		a1.shoulder.rotation.set( -1.05 + aimPitch * 0.4, -0.16, -0.10 );
		a1.elbow.rotation.set( -0.44, 0, 0 );
		a0.shoulder.rotation.set( -1.08 + aimPitch * 0.4, 0.30, 0.18 );
		a0.elbow.rotation.set( -0.62, 0, 0 );
	} else if ( this.weaponId === "knife" ) {
		a1.shoulder.rotation.set( -0.72, -0.38, -0.30 );
		a1.elbow.rotation.set( -1.30, 0, 0 );
		a0.shoulder.rotation.set( -0.52, 0.26, 0.28 );
		a0.elbow.rotation.set( -0.90, 0, 0 );
	}

	// A little arm sway while running so it doesn't look welded on.
	var armSway = swing * 0.12 * amp;
	a1.shoulder.rotation.x += armSway * 0.35;
	a0.shoulder.rotation.x -= armSway * 0.35;

	this.root.visible = this.visible;
};

Character.prototype._animateDeath = function( dt ) {
	this.deathT += dt;
	var t = U.clamp( this.deathT / 0.75, 0, 1 );
	var e = U.smoothstep( t );
	this.root.rotation.y = this.yaw;
	// Topple backwards or sideways depending on a per-death random axis.
	this.root.rotation.x = e * 1.45 * ( this.deathAxis > 0 ? 1 : 0.4 );
	this.root.rotation.z = e * 1.2 * this.deathAxis;
	this.hips.position.y = 0.92 - e * 0.42;
	// Limbs go slack.
	for ( var i = 0; i < 2; i++ ) {
		this.legs[ i ].hip.rotation.x = U.damp( this.legs[ i ].hip.rotation.x, -0.25, 5, dt );
		this.legs[ i ].knee.rotation.x = U.damp( this.legs[ i ].knee.rotation.x, 0.55, 5, dt );
		this.arms[ i ].shoulder.rotation.x = U.damp( this.arms[ i ].shoulder.rotation.x, -0.2, 5, dt );
		this.arms[ i ].elbow.rotation.x = U.damp( this.arms[ i ].elbow.rotation.x, -0.3, 5, dt );
	}
	this.chest.rotation.set( 0.2, 0, 0 );
	this.neck.rotation.set( 0.3, 0, 0 );

	// Fade out over the last second of the corpse's life.
	if ( this.deathT > 4.0 ) {
		if ( !this.mat.transparent ) { this.mat.transparent = true; this.mat.depthWrite = false; }
		this.mat.opacity = U.clamp( 1 - ( this.deathT - 4.0 ), 0, 1 );
	}
	this.root.visible = this.visible && this.deathT < 5.2;
};

/* Recompute world-space hitbox centres. Called before hit tests each frame. */
Character.prototype.updateHitboxes = function( x, y, z, yaw, crouch ) {
	/* Crouching drops the collision height from 1.80 to 1.22, so the boxes move
	 * down by the same amount the hips do (0.40) plus the extra fold in the
	 * torso, keeping them on the visible model. */
	var hb = this.hitboxes;
	hb[ 0 ].cy = 1.63 - crouch * 0.50;
	hb[ 0 ].hy = 0.17;
	hb[ 1 ].cy = 1.21 - crouch * 0.36;
	hb[ 1 ].hy = 0.29 * ( 1 - crouch * 0.14 );
	hb[ 2 ].cy = 0.44 - crouch * 0.06;
	hb[ 2 ].hy = 0.46 * ( 1 - crouch * 0.30 );
	this._hx = x; this._hy = y; this._hz = z; this._hyaw = yaw;
	this._sin = Math.sin( -yaw ); this._cos = Math.cos( -yaw );
};

/* Ray vs the three hitboxes. Returns the nearest { dist, zone } or null.
 * Ray is in world space; boxes are yaw-rotated about the character origin. */
Character.prototype.raycast = function( ox, oy, oz, dx, dy, dz, maxDist ) {
	// Into the character's local frame (yaw only).
	var px = ox - this._hx, pz = oz - this._hz;
	var lox = px * this._cos - pz * this._sin;
	var loz = px * this._sin + pz * this._cos;
	var ldx = dx * this._cos - dz * this._sin;
	var ldz = dx * this._sin + dz * this._cos;
	var loy = oy - this._hy;

	// Finite stand-in for 1/0: with Infinity, a ray lying exactly in a hitbox
	// face's plane yields 0 * Infinity = NaN and the hit is lost.
	var invX = ldx !== 0 ? 1 / ldx : 1e30;
	var invY = dy !== 0 ? 1 / dy : 1e30;
	var invZ = ldz !== 0 ? 1 / ldz : 1e30;

	var best = maxDist, bestZone = null;

	for ( var i = 0; i < this.hitboxes.length; i++ ) {
		var b = this.hitboxes[ i ];
		var t1 = ( -b.hx - lox ) * invX, t2 = ( b.hx - lox ) * invX;
		var tmin = Math.min( t1, t2 ), tmax = Math.max( t1, t2 );

		t1 = ( b.cy - b.hy - loy ) * invY; t2 = ( b.cy + b.hy - loy ) * invY;
		tmin = Math.max( tmin, Math.min( t1, t2 ) );
		tmax = Math.min( tmax, Math.max( t1, t2 ) );

		t1 = ( -b.hz - loz ) * invZ; t2 = ( b.hz - loz ) * invZ;
		tmin = Math.max( tmin, Math.min( t1, t2 ) );
		tmax = Math.min( tmax, Math.max( t1, t2 ) );

		if ( tmax < 0 || tmin > tmax ) continue;
		var t = tmin >= 0 ? tmin : tmax;
		if ( t >= 0 && t < best ) { best = t; bestZone = b.zone; }
	}

	return bestZone ? { dist: best, zone: bestZone } : null;
};

/* World position of the held weapon's muzzle, for remote-player tracers. */
Character.prototype.getMuzzle = function( out ) {
	out = out || this.muzzleWorld;
	if ( this.weaponModel && this.weaponModel.muzzle ) {
		this.weaponModel.muzzle.updateWorldMatrix( true, false );
		out.setFromMatrixPosition( this.weaponModel.muzzle.matrixWorld );
	} else {
		out.set( this.root.position.x, this.root.position.y + 1.4, this.root.position.z );
	}
	return out;
};

Character.prototype.dispose = function() {
	this.mat.dispose();
};

Character.TEAM_COLORS = TEAM_COLORS;
DE.Character = Character;

} )( window );
