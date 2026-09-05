/* DEADEYE — visual effects
 *
 * Everything here is pooled and instanced. Nothing is allocated after init, so
 * a heavy firefight never triggers a GC pause. Four systems:
 *
 *   tracers   — InstancedMesh of stretched boxes travelling at bullet speed
 *   particles — one THREE.Points buffer, CPU-integrated
 *   decals    — InstancedMesh of quads, oriented to the surface, oldest reused
 *   casings   — InstancedMesh of small boxes with a cheap bounce
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

var MAX_TRACERS = 96;
var MAX_PARTICLES = 1400;
var MAX_DECALS = 160;
var MAX_CASINGS = 64;

/* Impact particle colour and behaviour per surface. */
var SURFACE_FX = {
	concrete: { color: 0xb8b2a6, spark: 0,    count: 8,  spread: 2.2, life: 0.55, smoke: 0.5 },
	metal:    { color: 0xffd88a, spark: 0.85, count: 10, spread: 3.4, life: 0.42, smoke: 0.15 },
	wood:     { color: 0x9a7346, spark: 0,    count: 8,  spread: 2.0, life: 0.6,  smoke: 0.25 },
	sand:     { color: 0xd6c08c, spark: 0,    count: 12, spread: 1.7, life: 0.7,  smoke: 0.9 },
	snow:     { color: 0xf2f6fa, spark: 0,    count: 12, spread: 1.6, life: 0.8,  smoke: 0.8 },
	dirt:     { color: 0x8a7355, spark: 0,    count: 10, spread: 1.8, life: 0.65, smoke: 0.7 },
	glass:    { color: 0xbfe6f2, spark: 0.3,  count: 12, spread: 3.0, life: 0.7,  smoke: 0 },
	foliage:  { color: 0x4f8a3e, spark: 0,    count: 7,  spread: 1.6, life: 0.7,  smoke: 0 },
	water:    { color: 0x9fd0e6, spark: 0,    count: 12, spread: 2.2, life: 0.6,  smoke: 0.2 }
};

var DECAL_COLOR = {
	concrete: 0x3c3934, metal: 0x2b2d31, wood: 0x3a2a1a, sand: 0x6b5a3c,
	snow: 0x8fa3b5, dirt: 0x3a2f22, glass: 0x8fc4d6, foliage: 0x24401d, water: 0x2a4a58
};

function FX( scene ) {
	this.scene = scene;
	this.time = 0;

	/* ---- tracers ---- */
	var tgeo = new THREE.BoxGeometry( 1, 1, 1 );
	var tmat = new THREE.MeshBasicMaterial( {
		color: 0xffffff, transparent: true, opacity: 0.9,
		blending: THREE.AdditiveBlending, depthWrite: false
	} );
	this.tracerMesh = new THREE.InstancedMesh( tgeo, tmat, MAX_TRACERS );
	this.tracerMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
	this.tracerMesh.frustumCulled = false;
	this.tracerMesh.castShadow = false;
	scene.add( this.tracerMesh );
	this.tracers = [];
	for ( var i = 0; i < MAX_TRACERS; i++ ) {
		this.tracers.push( { active: false, t: 0, dur: 0, len: 2.5, w: 0.045,
		                     ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 1, dist: 0,
		                     speed: 400, color: new THREE.Color( 0xfff0c0 ) } );
	}
	this._tracerColorSet = false;

	/* ---- particles ---- */
	var pgeo = new THREE.BufferGeometry();
	this.pPos = new Float32Array( MAX_PARTICLES * 3 );
	this.pCol = new Float32Array( MAX_PARTICLES * 3 );
	this.pSize = new Float32Array( MAX_PARTICLES );
	pgeo.setAttribute( "position", new THREE.BufferAttribute( this.pPos, 3 ) );
	pgeo.setAttribute( "color", new THREE.BufferAttribute( this.pCol, 3 ) );
	pgeo.setAttribute( "size", new THREE.BufferAttribute( this.pSize, 1 ) );
	// Park unused particles far below the map rather than resizing the buffer.
	for ( var p = 0; p < MAX_PARTICLES; p++ ) this.pPos[ p * 3 + 1 ] = -9999;

	var pmat = new THREE.PointsMaterial( {
		size: 0.085, vertexColors: true, transparent: true, opacity: 0.95,
		sizeAttenuation: true, depthWrite: false
	} );
	this.points = new THREE.Points( pgeo, pmat );
	this.points.frustumCulled = false;
	scene.add( this.points );

	this.parts = [];
	for ( var q = 0; q < MAX_PARTICLES; q++ ) {
		this.parts.push( { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
		                   life: 0, maxLife: 1, grav: -14, drag: 2.4,
		                   r: 1, g: 1, b: 1, fade: 1 } );
	}
	this.pHead = 0;

	/* ---- decals ---- */
	var dgeo = new THREE.PlaneGeometry( 1, 1 );
	var dmat = new THREE.MeshBasicMaterial( {
		color: 0xffffff, transparent: true, opacity: 0.85,
		depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
		polygonOffsetUnits: -4
	} );
	this.decalMesh = new THREE.InstancedMesh( dgeo, dmat, MAX_DECALS );
	this.decalMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
	this.decalMesh.frustumCulled = false;
	scene.add( this.decalMesh );
	this.decals = [];
	for ( var d = 0; d < MAX_DECALS; d++ ) {
		this.decals.push( { active: false, t: 0, life: 14, size: 0.16 } );
	}
	this.decalHead = 0;

	/* ---- casings ---- */
	var cgeo = new THREE.BoxGeometry( 0.016, 0.016, 0.045 );
	var cmat = new THREE.MeshLambertMaterial( { color: 0xc9a94e } );
	this.casingMesh = new THREE.InstancedMesh( cgeo, cmat, MAX_CASINGS );
	this.casingMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
	this.casingMesh.frustumCulled = false;
	scene.add( this.casingMesh );
	this.casings = [];
	for ( var c = 0; c < MAX_CASINGS; c++ ) {
		this.casings.push( { active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
		                     rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, t: 0, life: 2.2 } );
	}
	this.casingHead = 0;

	/* ---- explosion flashes ---- */
	this.flashes = [];
	for ( var f = 0; f < 6; f++ ) {
		var fm = new THREE.Mesh(
			new THREE.SphereGeometry( 1, 10, 8 ),
			new THREE.MeshBasicMaterial( { color: 0xffb347, transparent: true,
			                               opacity: 0, blending: THREE.AdditiveBlending,
			                               depthWrite: false } )
		);
		fm.visible = false;
		scene.add( fm );
		this.flashes.push( { mesh: fm, t: 0, dur: 0, radius: 1 } );
	}

	this._m = new THREE.Matrix4();
	this._q = new THREE.Quaternion();
	this._v = new THREE.Vector3();
	this._v2 = new THREE.Vector3();
	this._e = new THREE.Euler();
	this._up = new THREE.Vector3( 0, 1, 0 );
	this._scale = new THREE.Vector3( 1, 1, 1 );
	this._zero = new THREE.Matrix4().makeScale( 0, 0, 0 );

	// Start every instance hidden.
	for ( var z = 0; z < MAX_TRACERS; z++ ) this.tracerMesh.setMatrixAt( z, this._zero );
	for ( var z2 = 0; z2 < MAX_DECALS; z2++ ) this.decalMesh.setMatrixAt( z2, this._zero );
	for ( var z3 = 0; z3 < MAX_CASINGS; z3++ ) this.casingMesh.setMatrixAt( z3, this._zero );
	this.tracerMesh.instanceMatrix.needsUpdate = true;
	this.decalMesh.instanceMatrix.needsUpdate = true;
	this.casingMesh.instanceMatrix.needsUpdate = true;
}

/* ------------------------------------------------------------------ */

FX.prototype._nextTracer = function() {
	for ( var i = 0; i < MAX_TRACERS; i++ ) {
		if ( !this.tracers[ i ].active ) return i;
	}
	return -1;
};

/* A visible round travelling from the muzzle to its impact point. */
FX.prototype.tracer = function( ox, oy, oz, tx, ty, tz, speed, color, thick ) {
	var i = this._nextTracer();
	if ( i === -1 ) return;
	var t = this.tracers[ i ];
	var dx = tx - ox, dy = ty - oy, dz = tz - oz;
	var dist = Math.sqrt( dx * dx + dy * dy + dz * dz );
	if ( dist < 0.01 ) return;
	t.active = true;
	t.ox = ox; t.oy = oy; t.oz = oz;
	t.dx = dx / dist; t.dy = dy / dist; t.dz = dz / dist;
	t.dist = dist;
	t.speed = speed || 400;
	t.t = 0;
	t.dur = dist / t.speed;
	t.len = Math.min( 3.2, Math.max( 1.0, dist * 0.25 ) );
	t.w = thick || 0.035;
	t.color.setHex( color === undefined ? 0xffe9b0 : color );
	this.tracerMesh.setColorAt( i, t.color );
	if ( this.tracerMesh.instanceColor ) this.tracerMesh.instanceColor.needsUpdate = true;
};

FX.prototype._spawnParticle = function( x, y, z, vx, vy, vz, life, hex, grav, drag, size ) {
	// Ring buffer: the oldest particle is overwritten when full.
	var i = this.pHead;
	this.pHead = ( this.pHead + 1 ) % MAX_PARTICLES;
	var p = this.parts[ i ];
	p.active = true;
	p.x = x; p.y = y; p.z = z;
	p.vx = vx; p.vy = vy; p.vz = vz;
	p.life = life; p.maxLife = life;
	p.grav = grav === undefined ? -14 : grav;
	p.drag = drag === undefined ? 2.4 : drag;
	p.r = ( ( hex >> 16 ) & 255 ) / 255;
	p.g = ( ( hex >> 8 ) & 255 ) / 255;
	p.b = ( hex & 255 ) / 255;
	this.pSize[ i ] = size === undefined ? 1 : size;
	return p;
};

/* Bullet hitting the world. */
FX.prototype.impact = function( x, y, z, nx, ny, nz, tag ) {
	var cfg = SURFACE_FX[ tag ] || SURFACE_FX.concrete;
	var n = cfg.count;
	for ( var i = 0; i < n; i++ ) {
		// Cone around the surface normal.
		var sx = nx + ( Math.random() - 0.5 ) * 1.5;
		var sy = ny + ( Math.random() - 0.5 ) * 1.5 + 0.35;
		var sz = nz + ( Math.random() - 0.5 ) * 1.5;
		var sp = cfg.spread * ( 0.4 + Math.random() * 1.2 );
		var isSpark = Math.random() < cfg.spark;
		this._spawnParticle(
			x + nx * 0.02, y + ny * 0.02, z + nz * 0.02,
			sx * sp, sy * sp, sz * sp,
			cfg.life * ( 0.6 + Math.random() * 0.8 ),
			isSpark ? 0xffd070 : U.jitterHex( cfg.color, 0.18 ),
			isSpark ? -22 : -14, isSpark ? 1.4 : 3.0,
			isSpark ? 0.7 : 1
		);
	}
	// Dust puff that drifts upward.
	if ( cfg.smoke > 0 ) {
		var puffs = Math.round( cfg.smoke * 4 );
		for ( var s = 0; s < puffs; s++ ) {
			this._spawnParticle(
				x + nx * 0.05 + ( Math.random() - 0.5 ) * 0.16,
				y + ny * 0.05 + ( Math.random() - 0.5 ) * 0.16,
				z + nz * 0.05 + ( Math.random() - 0.5 ) * 0.16,
				( Math.random() - 0.5 ) * 0.7, 0.5 + Math.random() * 0.8,
				( Math.random() - 0.5 ) * 0.7,
				0.55 + Math.random() * 0.5,
				U.shade( cfg.color, 1.15 ), 1.2, 1.4, 2.4
			);
		}
	}
	this.decal( x, y, z, nx, ny, nz, tag );
};

/* Bullet hitting a player. */
FX.prototype.blood = function( x, y, z, dx, dy, dz, big ) {
	var n = big ? 16 : 9;
	for ( var i = 0; i < n; i++ ) {
		var sp = 2.2 + Math.random() * 3.6;
		this._spawnParticle(
			x, y, z,
			( dx + ( Math.random() - 0.5 ) * 1.1 ) * sp,
			( dy + ( Math.random() - 0.5 ) * 1.1 ) * sp + 1.2,
			( dz + ( Math.random() - 0.5 ) * 1.1 ) * sp,
			0.45 + Math.random() * 0.4,
			U.pick( [ 0xb01c1c, 0x8f1414, 0xd32b2b ] ),
			-18, 1.6, big ? 1.4 : 1.0
		);
	}
};

FX.prototype.decal = function( x, y, z, nx, ny, nz, tag ) {
	var i = this.decalHead;
	this.decalHead = ( this.decalHead + 1 ) % MAX_DECALS;
	var d = this.decals[ i ];
	d.active = true;
	d.t = 0;
	d.size = 0.13 + Math.random() * 0.09;

	// Orient the quad to face along the surface normal, with a random roll.
	this._v.set( nx, ny, nz );
	this._q.setFromUnitVectors( new THREE.Vector3( 0, 0, 1 ), this._v );
	var roll = new THREE.Quaternion().setFromAxisAngle( this._v, Math.random() * 6.28 );
	this._q.premultiply( roll );
	// Lift slightly off the surface so it doesn't z-fight.
	this._v2.set( x + nx * 0.012, y + ny * 0.012, z + nz * 0.012 );
	this._scale.set( d.size, d.size, 1 );
	this._m.compose( this._v2, this._q, this._scale );
	this.decalMesh.setMatrixAt( i, this._m );
	this.decalMesh.instanceMatrix.needsUpdate = true;
	d.matrixPos = this._v2.clone();
	d.matrixQuat = this._q.clone();

	var col = DECAL_COLOR[ tag ] === undefined ? DECAL_COLOR.concrete : DECAL_COLOR[ tag ];
	this.decalMesh.setColorAt( i, new THREE.Color( col ) );
	if ( this.decalMesh.instanceColor ) this.decalMesh.instanceColor.needsUpdate = true;
};

FX.prototype.casing = function( x, y, z, dx, dy, dz ) {
	var i = this.casingHead;
	this.casingHead = ( this.casingHead + 1 ) % MAX_CASINGS;
	var c = this.casings[ i ];
	c.active = true;
	c.t = 0;
	c.x = x; c.y = y; c.z = z;
	var sp = 2.4 + Math.random() * 1.8;
	c.vx = dx * sp + ( Math.random() - 0.5 ) * 0.9;
	c.vy = 2.0 + Math.random() * 1.4;
	c.vz = dz * sp + ( Math.random() - 0.5 ) * 0.9;
	c.rx = Math.random() * 6.28; c.ry = Math.random() * 6.28; c.rz = Math.random() * 6.28;
	c.wx = ( Math.random() - 0.5 ) * 26;
	c.wy = ( Math.random() - 0.5 ) * 26;
	c.wz = ( Math.random() - 0.5 ) * 26;
};

FX.prototype.explosion = function( x, y, z, radius ) {
	radius = radius || 6;
	// Flash sphere.
	for ( var i = 0; i < this.flashes.length; i++ ) {
		var f = this.flashes[ i ];
		if ( f.t > 0 ) continue;
		f.t = 0.0001; f.dur = 0.32; f.radius = radius * 0.5;
		f.mesh.position.set( x, y, z );
		f.mesh.visible = true;
		break;
	}
	// Fireball + debris.
	for ( var p = 0; p < 60; p++ ) {
		var a = Math.random() * U.TAU;
		var el = Math.random() * Math.PI - Math.PI * 0.5;
		var sp = 6 + Math.random() * 16;
		var ce = Math.cos( el );
		this._spawnParticle(
			x, y, z,
			Math.cos( a ) * ce * sp, Math.sin( el ) * sp + 4, Math.sin( a ) * ce * sp,
			0.4 + Math.random() * 0.7,
			U.pick( [ 0xffd070, 0xff9a3c, 0xff5c22, 0x8a5030 ] ),
			-16, 2.0, 1.6
		);
	}
	// Smoke column.
	for ( var s = 0; s < 26; s++ ) {
		this._spawnParticle(
			x + ( Math.random() - 0.5 ) * 1.6, y + Math.random() * 0.8,
			z + ( Math.random() - 0.5 ) * 1.6,
			( Math.random() - 0.5 ) * 2.4, 1.6 + Math.random() * 2.6,
			( Math.random() - 0.5 ) * 2.4,
			1.2 + Math.random() * 0.9,
			U.pick( [ 0x4a4a4a, 0x5e5a55, 0x333333 ] ),
			0.8, 1.0, 3.4
		);
	}
};

/* Muzzle smoke drifting from a barrel after sustained fire. */
FX.prototype.muzzleSmoke = function( x, y, z, dx, dy, dz ) {
	this._spawnParticle(
		x, y, z,
		dx * 1.2 + ( Math.random() - 0.5 ) * 0.5,
		dy * 1.2 + 0.5 + Math.random() * 0.4,
		dz * 1.2 + ( Math.random() - 0.5 ) * 0.5,
		0.5 + Math.random() * 0.4, 0x9a9a96, 0.6, 1.6, 1.8
	);
};

/* ------------------------------------------------------------------ */

FX.prototype.update = function( dt, camera ) {
	this.time += dt;
	var i, n;

	/* tracers */
	var tm = this.tracerMesh;
	for ( i = 0; i < MAX_TRACERS; i++ ) {
		var t = this.tracers[ i ];
		if ( !t.active ) continue;
		t.t += dt;
		var travelled = t.t * t.speed;
		if ( travelled >= t.dist + t.len ) {
			t.active = false;
			tm.setMatrixAt( i, this._zero );
			continue;
		}
		// The visible segment is the tail of the round.
		var head = Math.min( travelled, t.dist );
		var tail = Math.max( 0, head - t.len );
		var seg = head - tail;
		if ( seg <= 0.001 ) { tm.setMatrixAt( i, this._zero ); continue; }
		var mx = t.ox + t.dx * ( tail + seg * 0.5 );
		var my = t.oy + t.dy * ( tail + seg * 0.5 );
		var mz = t.oz + t.dz * ( tail + seg * 0.5 );
		this._v.set( mx, my, mz );
		this._v2.set( t.dx, t.dy, t.dz );
		this._q.setFromUnitVectors( new THREE.Vector3( 0, 0, 1 ), this._v2 );
		this._scale.set( t.w, t.w, seg );
		this._m.compose( this._v, this._q, this._scale );
		tm.setMatrixAt( i, this._m );
	}
	tm.instanceMatrix.needsUpdate = true;

	/* particles */
	var pos = this.pPos, col = this.pCol;
	for ( i = 0; i < MAX_PARTICLES; i++ ) {
		var p = this.parts[ i ];
		if ( !p.active ) continue;
		p.life -= dt;
		if ( p.life <= 0 ) {
			p.active = false;
			pos[ i * 3 + 1 ] = -9999;
			continue;
		}
		var drag = Math.exp( -p.drag * dt );
		p.vx *= drag; p.vz *= drag;
		p.vy = ( p.vy + p.grav * dt ) * drag;
		p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
		pos[ i * 3 ] = p.x; pos[ i * 3 + 1 ] = p.y; pos[ i * 3 + 2 ] = p.z;
		// Fade by dimming toward black — cheaper than per-point alpha and
		// reads correctly against every map palette.
		var k = U.clamp( p.life / p.maxLife, 0, 1 );
		var f = k > 0.6 ? 1 : k / 0.6;
		col[ i * 3 ] = p.r * f; col[ i * 3 + 1 ] = p.g * f; col[ i * 3 + 2 ] = p.b * f;
	}
	this.points.geometry.attributes.position.needsUpdate = true;
	this.points.geometry.attributes.color.needsUpdate = true;

	/* decals — scale down over the last second of life */
	var dm = this.decalMesh;
	var decalDirty = false;
	for ( i = 0; i < MAX_DECALS; i++ ) {
		var d = this.decals[ i ];
		if ( !d.active ) continue;
		d.t += dt;
		if ( d.t >= d.life ) {
			d.active = false;
			dm.setMatrixAt( i, this._zero );
			decalDirty = true;
			continue;
		}
		var remain = d.life - d.t;
		if ( remain < 1.0 ) {
			var sc = d.size * remain;
			this._scale.set( sc, sc, 1 );
			this._m.compose( d.matrixPos, d.matrixQuat, this._scale );
			dm.setMatrixAt( i, this._m );
			decalDirty = true;
		}
	}
	if ( decalDirty ) dm.instanceMatrix.needsUpdate = true;

	/* casings */
	var cm = this.casingMesh;
	for ( i = 0; i < MAX_CASINGS; i++ ) {
		var c = this.casings[ i ];
		if ( !c.active ) continue;
		c.t += dt;
		if ( c.t >= c.life ) {
			c.active = false;
			cm.setMatrixAt( i, this._zero );
			continue;
		}
		c.vy -= 22 * dt;
		c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
		c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
		// Cheap floor bounce; the exact surface height doesn't matter visually.
		if ( c.groundY === undefined ) c.groundY = c.y - 3;
		if ( c.y < c.groundY ) {
			c.y = c.groundY;
			c.vy *= -0.32;
			c.vx *= 0.6; c.vz *= 0.6;
			c.wx *= 0.4; c.wy *= 0.4; c.wz *= 0.4;
		}
		this._v.set( c.x, c.y, c.z );
		this._e.set( c.rx, c.ry, c.rz );
		this._q.setFromEuler( this._e );
		var fade = c.t > c.life - 0.4 ? ( c.life - c.t ) / 0.4 : 1;
		this._scale.set( fade, fade, fade );
		this._m.compose( this._v, this._q, this._scale );
		cm.setMatrixAt( i, this._m );
	}
	cm.instanceMatrix.needsUpdate = true;

	/* explosion flashes */
	for ( i = 0; i < this.flashes.length; i++ ) {
		var fl = this.flashes[ i ];
		if ( fl.t <= 0 ) continue;
		fl.t += dt;
		var ft = fl.t / fl.dur;
		if ( ft >= 1 ) {
			fl.t = 0;
			fl.mesh.visible = false;
			continue;
		}
		var grow = U.smoothstep( ft * 1.6 );
		fl.mesh.scale.setScalar( fl.radius * ( 0.35 + grow * 1.1 ) );
		fl.mesh.material.opacity = ( 1 - ft ) * 0.85;
	}
};

/* Set the ground reference for casings so bounces land near the floor the
 * shooter is standing on. */
FX.prototype.setCasingGround = function( y ) { this._casingGround = y; };

FX.prototype.clear = function() {
	var i;
	for ( i = 0; i < MAX_TRACERS; i++ ) {
		this.tracers[ i ].active = false;
		this.tracerMesh.setMatrixAt( i, this._zero );
	}
	for ( i = 0; i < MAX_PARTICLES; i++ ) {
		this.parts[ i ].active = false;
		this.pPos[ i * 3 + 1 ] = -9999;
	}
	for ( i = 0; i < MAX_DECALS; i++ ) {
		this.decals[ i ].active = false;
		this.decalMesh.setMatrixAt( i, this._zero );
	}
	for ( i = 0; i < MAX_CASINGS; i++ ) {
		this.casings[ i ].active = false;
		this.casingMesh.setMatrixAt( i, this._zero );
	}
	for ( i = 0; i < this.flashes.length; i++ ) {
		this.flashes[ i ].t = 0;
		this.flashes[ i ].mesh.visible = false;
	}
	this.tracerMesh.instanceMatrix.needsUpdate = true;
	this.decalMesh.instanceMatrix.needsUpdate = true;
	this.casingMesh.instanceMatrix.needsUpdate = true;
	this.points.geometry.attributes.position.needsUpdate = true;
};

DE.FX = FX;
DE.SURFACE_FX = SURFACE_FX;

} )( window );
