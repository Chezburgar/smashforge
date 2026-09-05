/* DEADEYE — geometry builder
 *
 * Maps are authored as a stream of primitives (boxes, wedges, cylinders,
 * prisms). Rather than creating a THREE.Mesh per primitive — which would mean
 * thousands of draw calls — the builder bakes every vertex into one flat
 * non-indexed BufferGeometry with per-vertex colour. A whole map ends up as a
 * single MeshLambertMaterial mesh, so the renderer issues one draw call for the
 * static world plus one shadow pass.
 *
 * Each primitive can also register a collider. Colliders are yaw-rotated boxes
 * (OBBs constrained to the Y axis), which covers everything the maps need
 * without the cost of a general SAT solver. */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

/* Per-face brightness. Baked into vertex colour on top of real lighting; this
 * is what gives the flat-shaded look its readable silhouettes even where the
 * directional light doesn't reach. */
var FACE_TINT = {
	py: 1.00,   // top — catches the sun
	ny: 0.52,   // underside
	px: 0.84,
	nx: 0.72,
	pz: 0.94,
	nz: 0.64
};

/* Surface types drive impact particles, decal colour and footstep timbre. */
var SURFACE = {
	CONCRETE: "concrete",
	METAL: "metal",
	WOOD: "wood",
	SAND: "sand",
	SNOW: "snow",
	DIRT: "dirt",
	GLASS: "glass",
	FOLIAGE: "foliage",
	WATER: "water",
	/* Invisible blocking volumes (rail guards, ceiling caps, map bounds).
	 * Solid to movement and bullets, but never a surface you stand on — so
	 * navigation must not sample nodes onto them. */
	CLIP: "clip"
};

DE.SURFACE = SURFACE;

/* ------------------------------------------------------------------ */

function Builder() {
	this.pos = [];
	this.nrm = [];
	this.col = [];
	this.colliders = [];
	// Separate stream for anything that must not receive/cast shadows or must
	// render transparent (water planes, glass, light glows).
	this.extra = [];
	this.bounds = { minX: Infinity, minY: Infinity, minZ: Infinity,
	                maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
}

Builder.prototype._vert = function( x, y, z, nx, ny, nz, r, g, b ) {
	this.pos.push( x, y, z );
	this.nrm.push( nx, ny, nz );
	this.col.push( r, g, b );
	var bd = this.bounds;
	if ( x < bd.minX ) bd.minX = x;
	if ( y < bd.minY ) bd.minY = y;
	if ( z < bd.minZ ) bd.minZ = z;
	if ( x > bd.maxX ) bd.maxX = x;
	if ( y > bd.maxY ) bd.maxY = y;
	if ( z > bd.maxZ ) bd.maxZ = z;
};

/* Push a triangle with a flat normal derived from its winding. */
Builder.prototype.tri = function( ax, ay, az, bx, by, bz, cx, cy, cz, hex ) {
	var ux = bx - ax, uy = by - ay, uz = bz - az;
	var vx = cx - ax, vy = cy - ay, vz = cz - az;
	var nx = uy * vz - uz * vy;
	var ny = uz * vx - ux * vz;
	var nz = ux * vy - uy * vx;
	var len = Math.sqrt( nx * nx + ny * ny + nz * nz ) || 1;
	nx /= len; ny /= len; nz /= len;

	var r = ( ( hex >> 16 ) & 255 ) / 255;
	var g = ( ( hex >> 8 ) & 255 ) / 255;
	var b = ( hex & 255 ) / 255;

	this._vert( ax, ay, az, nx, ny, nz, r, g, b );
	this._vert( bx, by, bz, nx, ny, nz, r, g, b );
	this._vert( cx, cy, cz, nx, ny, nz, r, g, b );
	return this;
};

/* Convenience: a planar quad as two triangles, wound a->b->c->d. */
Builder.prototype.quad = function( a, b, c, d, hex ) {
	this.tri( a[ 0 ], a[ 1 ], a[ 2 ], b[ 0 ], b[ 1 ], b[ 2 ], c[ 0 ], c[ 1 ], c[ 2 ], hex );
	this.tri( a[ 0 ], a[ 1 ], a[ 2 ], c[ 0 ], c[ 1 ], c[ 2 ], d[ 0 ], d[ 1 ], d[ 2 ], hex );
	return this;
};

/* ------------------------------------------------------------------
 * box
 *   x,y,z : centre of the footprint, y is the BOTTOM of the box
 *   w,h,d : full extents
 *   hex   : base colour
 *   o     : { yaw, collide, tag, tint, skipFaces, top }
 * ------------------------------------------------------------------ */
Builder.prototype.box = function( x, y, z, w, h, d, hex, o ) {
	o = o || {};
	var yaw = o.yaw || 0;
	var hw = w * 0.5, hd = d * 0.5;
	var cy = y + h * 0.5;
	var s = Math.sin( yaw ), c = Math.cos( yaw );
	var tint = o.tint === undefined ? 1 : o.tint;
	var skip = o.skipFaces || null;

	// Local-space corner -> world.
	var self = this;
	function P( lx, ly, lz ) {
		return [ x + lx * c - lz * s, y + ly, z + lx * s + lz * c ];
	}

	var p000 = P( -hw, 0, -hd ), p100 = P( hw, 0, -hd ),
	    p101 = P( hw, 0, hd ),   p001 = P( -hw, 0, hd ),
	    p010 = P( -hw, h, -hd ), p110 = P( hw, h, -hd ),
	    p111 = P( hw, h, hd ),   p011 = P( -hw, h, hd );

	function face( key, a, b, cc, dd ) {
		if ( skip && skip.indexOf( key ) !== -1 ) return;
		var col = U.shade( ( key === "py" && o.top !== undefined ) ? o.top : hex,
		                   FACE_TINT[ key ] * tint );
		self.quad( a, b, cc, dd, col );
	}

	face( "py", p010, p011, p111, p110 );   // top
	face( "ny", p000, p100, p101, p001 );   // bottom
	face( "nz", p000, p010, p110, p100 );   // -Z
	face( "pz", p001, p101, p111, p011 );   // +Z
	face( "nx", p000, p001, p011, p010 );   // -X
	face( "px", p100, p110, p111, p101 );   // +X

	if ( o.collide !== false ) {
		this.collider( x, cy, z, hw, h * 0.5, hd, yaw, o.tag || SURFACE.CONCRETE );
	}
	return this;
};

/* A box that is purely decorative (no collider). Shorthand used constantly by
 * the map files for trim, decals and detail geometry. */
Builder.prototype.deco = function( x, y, z, w, h, d, hex, o ) {
	o = o || {};
	o.collide = false;
	return this.box( x, y, z, w, h, d, hex, o );
};

/* ------------------------------------------------------------------
 * wedge — a ramp. `dir` names the direction the surface climbs toward:
 * "+x", "-x", "+z", "-z". Height goes 0 -> h across that axis.
 *
 * Collision uses a short stack of steps rather than a true slope: the player
 * controller has step-up assist, so a stepped collider walks exactly like a
 * ramp while keeping the whole world AABB-only.
 * ------------------------------------------------------------------ */
Builder.prototype.wedge = function( x, y, z, w, h, d, dir, hex, o ) {
	o = o || {};
	var hw = w * 0.5, hd = d * 0.5;
	var lo = 0.0001; // avoid a degenerate zero-area end cap

	// Corner heights, indexed [-x/-z, +x/-z, +x/+z, -x/+z]
	var hA, hB, hC, hD;
	if ( dir === "+x" )      { hA = lo; hB = h;  hC = h;  hD = lo; }
	else if ( dir === "-x" ) { hA = h;  hB = lo; hC = lo; hD = h;  }
	else if ( dir === "+z" ) { hA = lo; hB = lo; hC = h;  hD = h;  }
	else                     { hA = h;  hB = h;  hC = lo; hD = lo; } // "-z"

	var a = [ x - hw, y + hA, z - hd ];
	var b = [ x + hw, y + hB, z - hd ];
	var c = [ x + hw, y + hC, z + hd ];
	var dd = [ x - hw, y + hD, z + hd ];
	var a0 = [ x - hw, y, z - hd ];
	var b0 = [ x + hw, y, z - hd ];
	var c0 = [ x + hw, y, z + hd ];
	var d0 = [ x - hw, y, z + hd ];

	var top = o.top === undefined ? hex : o.top;
	this.quad( a, dd, c, b, U.shade( top, FACE_TINT.py * 0.97 ) );  // sloped face
	this.quad( a0, b0, c0, d0, U.shade( hex, FACE_TINT.ny ) );      // underside
	this.quad( a0, a, b, b0, U.shade( hex, FACE_TINT.nz ) );
	this.quad( c0, c, dd, d0, U.shade( hex, FACE_TINT.pz ) );
	this.quad( d0, dd, a, a0, U.shade( hex, FACE_TINT.nx ) );
	this.quad( b0, b, c, c0, U.shade( hex, FACE_TINT.px ) );

	if ( o.collide !== false ) {
		var steps = Math.max( 2, Math.min( 14, Math.ceil( h / 0.34 ) ) );
		var horiz = ( dir === "+x" || dir === "-x" ) ? w : d;
		var seg = horiz / steps;
		for ( var i = 0; i < steps; i++ ) {
			var t = ( i + 1 ) / steps;          // fraction of full height
			var sh = h * t;
			var off = -horiz * 0.5 + seg * ( i + 0.5 );
			var sx = x, sz = z, sw = w, sd = d;
			if ( dir === "+x" )      { sx = x + off; sw = seg; }
			else if ( dir === "-x" ) { sx = x - off; sw = seg; }
			else if ( dir === "+z" ) { sz = z + off; sd = seg; }
			else                     { sz = z - off; sd = seg; }
			this.collider( sx, y + sh * 0.5, sz, sw * 0.5, sh * 0.5, sd * 0.5, 0,
			               o.tag || SURFACE.CONCRETE );
		}
	}
	return this;
};

/* ------------------------------------------------------------------
 * cylinder — pillars, barrels, tree trunks, pipes.
 * Collision approximates with a single box; at 8+ sides the visual and the
 * collider agree closely enough that players never notice.
 * ------------------------------------------------------------------ */
Builder.prototype.cylinder = function( x, y, z, r, h, segs, hex, o ) {
	o = o || {};
	segs = segs || 8;
	var rTop = o.rTop === undefined ? r : o.rTop;
	var yaw = o.yaw || 0;
	var i, a0, a1, c0, s0, c1, s1;

	for ( i = 0; i < segs; i++ ) {
		a0 = yaw + ( i / segs ) * U.TAU;
		a1 = yaw + ( ( i + 1 ) / segs ) * U.TAU;
		c0 = Math.cos( a0 ); s0 = Math.sin( a0 );
		c1 = Math.cos( a1 ); s1 = Math.sin( a1 );

		// Shade each facet by how much it faces the key light (roughly +X+Z).
		var facing = ( c0 + c1 ) * 0.35 + ( s0 + s1 ) * 0.2;
		var k = 0.70 + U.clamp( facing, -1, 1 ) * 0.16;

		this.quad(
			[ x + c0 * r,    y,     z + s0 * r ],
			[ x + c1 * r,    y,     z + s1 * r ],
			[ x + c1 * rTop, y + h, z + s1 * rTop ],
			[ x + c0 * rTop, y + h, z + s0 * rTop ],
			U.shade( hex, k )
		);

		if ( rTop > 0.001 ) {
			this.tri( x, y + h, z,
			          x + c0 * rTop, y + h, z + s0 * rTop,
			          x + c1 * rTop, y + h, z + s1 * rTop,
			          U.shade( o.top === undefined ? hex : o.top, FACE_TINT.py ) );
		}
		if ( o.bottom !== false ) {
			this.tri( x, y, z,
			          x + c1 * r, y, z + s1 * r,
			          x + c0 * r, y, z + s0 * r,
			          U.shade( hex, FACE_TINT.ny ) );
		}
	}

	if ( o.collide !== false ) {
		var rr = Math.max( r, rTop ) * 0.92;
		this.collider( x, y + h * 0.5, z, rr, h * 0.5, rr, 0, o.tag || SURFACE.METAL );
	}
	return this;
};

/* Low-poly faceted sphere-ish blob — rocks, tree canopies, sandbags. */
Builder.prototype.blob = function( x, y, z, r, hex, o ) {
	o = o || {};
	var rings = o.rings || 3, segs = o.segs || 6;
	var sy = o.squash === undefined ? 1 : o.squash;
	var rnd = o.rnd || null;
	var i, j;

	function pt( ring, seg ) {
		var phi = ( ring / rings ) * Math.PI;
		var th = ( seg / segs ) * U.TAU + ( o.yaw || 0 );
		var rr = r * ( rnd ? ( 0.82 + rnd() * 0.30 ) : 1 );
		return [
			x + Math.sin( phi ) * Math.cos( th ) * rr,
			y + r * sy + Math.cos( phi ) * rr * sy * -1,
			z + Math.sin( phi ) * Math.sin( th ) * rr
		];
	}

	for ( i = 0; i < rings; i++ ) {
		for ( j = 0; j < segs; j++ ) {
			var a = pt( i, j ), b = pt( i, j + 1 ), c = pt( i + 1, j + 1 ), d = pt( i + 1, j );
			var k = 0.66 + ( 1 - i / rings ) * 0.34;
			var col = U.shade( hex, k );
			if ( i === 0 ) this.tri( a[ 0 ], a[ 1 ], a[ 2 ], d[ 0 ], d[ 1 ], d[ 2 ], c[ 0 ], c[ 1 ], c[ 2 ], col );
			else if ( i === rings - 1 ) this.tri( a[ 0 ], a[ 1 ], a[ 2 ], b[ 0 ], b[ 1 ], b[ 2 ], c[ 0 ], c[ 1 ], c[ 2 ], col );
			else this.quad( a, b, c, d, col );
		}
	}

	if ( o.collide ) {
		this.collider( x, y + r * sy, z, r * 0.78, r * sy * 0.9, r * 0.78, 0,
		               o.tag || SURFACE.DIRT );
	}
	return this;
};

/* Cone — roofs, conifers, traffic cones. */
Builder.prototype.cone = function( x, y, z, r, h, segs, hex, o ) {
	o = o || {};
	segs = segs || 8;
	for ( var i = 0; i < segs; i++ ) {
		var a0 = ( i / segs ) * U.TAU + ( o.yaw || 0 );
		var a1 = ( ( i + 1 ) / segs ) * U.TAU + ( o.yaw || 0 );
		var c0 = Math.cos( a0 ), s0 = Math.sin( a0 );
		var c1 = Math.cos( a1 ), s1 = Math.sin( a1 );
		var k = 0.70 + ( ( c0 + c1 ) * 0.3 + ( s0 + s1 ) * 0.18 ) * 0.18;
		this.tri(
			x + c0 * r, y, z + s0 * r,
			x + c1 * r, y, z + s1 * r,
			x, y + h, z,
			U.shade( hex, k )
		);
		if ( o.bottom !== false ) {
			this.tri( x, y, z, x + c1 * r, y, z + s1 * r, x + c0 * r, y, z + s0 * r,
			          U.shade( hex, FACE_TINT.ny ) );
		}
	}
	if ( o.collide ) {
		this.collider( x, y + h * 0.5, z, r * 0.6, h * 0.5, r * 0.6, 0, o.tag || SURFACE.FOLIAGE );
	}
	return this;
};

/* ------------------------------------------------------------------
 * colliders
 * ------------------------------------------------------------------ */

/* cx,cy,cz is the CENTRE (unlike box(), which takes the base) because that is
 * what every query wants. */
Builder.prototype.collider = function( cx, cy, cz, hx, hy, hz, yaw, tag ) {
	var s = Math.sin( yaw || 0 ), c = Math.cos( yaw || 0 );
	this.colliders.push( {
		cx: cx, cy: cy, cz: cz,
		hx: hx, hy: hy, hz: hz,
		yaw: yaw || 0,
		rot: Math.abs( yaw || 0 ) > 0.0001,
		sin: s, cos: c,
		tag: tag || SURFACE.CONCRETE,
		// Broadphase AABB, expanded to contain the rotated box.
		minX: cx - ( Math.abs( c ) * hx + Math.abs( s ) * hz ),
		maxX: cx + ( Math.abs( c ) * hx + Math.abs( s ) * hz ),
		minY: cy - hy, maxY: cy + hy,
		minZ: cz - ( Math.abs( s ) * hx + Math.abs( c ) * hz ),
		maxZ: cz + ( Math.abs( s ) * hx + Math.abs( c ) * hz )
	} );
	return this;
};

/* An invisible wall — used for map boundaries and to stop players wedging into
 * decorative geometry. */
Builder.prototype.clip = function( cx, cy, cz, hx, hy, hz, yaw ) {
	return this.collider( cx, cy, cz, hx, hy, hz, yaw || 0, SURFACE.CLIP );
};

/* ------------------------------------------------------------------
 * output
 * ------------------------------------------------------------------ */

Builder.prototype.toMesh = function( opts ) {
	opts = opts || {};
	var g = new THREE.BufferGeometry();
	g.setAttribute( "position", new THREE.Float32BufferAttribute( this.pos, 3 ) );
	g.setAttribute( "normal", new THREE.Float32BufferAttribute( this.nrm, 3 ) );
	g.setAttribute( "color", new THREE.Float32BufferAttribute( this.col, 3 ) );
	g.computeBoundingSphere();
	g.computeBoundingBox();

	var m = new THREE.MeshLambertMaterial( {
		vertexColors: true,
		side: THREE.FrontSide,
		dithering: true
	} );

	var mesh = new THREE.Mesh( g, m );
	mesh.castShadow = opts.castShadow !== false;
	mesh.receiveShadow = opts.receiveShadow !== false;
	mesh.matrixAutoUpdate = false;
	mesh.updateMatrix();
	return mesh;
};

Builder.prototype.triangleCount = function() { return this.pos.length / 9; };

DE.Builder = Builder;
DE.FACE_TINT = FACE_TINT;

} )( window );
