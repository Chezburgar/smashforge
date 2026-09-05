/* DEADEYE — prop library
 *
 * Reusable pieces of set dressing and architecture, all emitted through the
 * geometry builder so they cost nothing extra at draw time. Maps call these
 * instead of placing raw boxes, which is what keeps each map file readable.
 *
 * Convention: every prop takes ( b, x, y, z, o ) where y is the BOTTOM of the
 * prop and o is an options bag. Props register their own colliders.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;
var S = DE.SURFACE;
var P = DE.props = {};

/* ------------------------------------------------------------------
 * walls & architecture
 * ------------------------------------------------------------------ */

/* A wall run with door/window cut-outs.
 *   axis: "x" or "z" — the direction the wall runs
 *   openings: [ { at, width, sill, head } ] positions measured from the wall's
 *   start along `axis`; `sill` is the bottom of the hole, `head` the top. */
P.wall = function( b, x, y, z, len, height, thick, axis, color, o ) {
	o = o || {};
	var openings = ( o.openings || [] ).slice().sort( function( a, c ) { return a.at - c.at; } );
	var tag = o.tag || S.CONCRETE;
	var half = len * 0.5;

	function seg( from, to, y0, y1 ) {
		if ( to - from < 0.01 || y1 - y0 < 0.01 ) return;
		var mid = ( from + to ) * 0.5 - half;
		var w = to - from;
		if ( axis === "x" ) {
			b.box( x + mid, y + y0, z, w, y1 - y0, thick, color, { tag: tag, top: o.top } );
		} else {
			b.box( x, y + y0, z + mid, thick, y1 - y0, w, color, { tag: tag, top: o.top } );
		}
	}

	var cursor = 0;
	for ( var i = 0; i < openings.length; i++ ) {
		var op = openings[ i ];
		var a = U.clamp( op.at, 0, len );
		var bEnd = U.clamp( op.at + op.width, 0, len );
		var sill = op.sill || 0;
		var head = op.head === undefined ? height : Math.min( op.head, height );

		seg( cursor, a, 0, height );          // solid pier before the opening
		if ( sill > 0 ) seg( a, bEnd, 0, sill );          // under a window
		if ( head < height ) seg( a, bEnd, head, height ); // lintel above
		cursor = bEnd;
	}
	seg( cursor, len, 0, height );

	// Frame trim around each opening reads as a doorway rather than a hole.
	if ( o.trim !== false ) {
		var trimCol = o.trimColor === undefined ? U.shade( color, 0.78 ) : o.trimColor;
		for ( var j = 0; j < openings.length; j++ ) {
			var op2 = openings[ j ];
			var cx = op2.at + op2.width * 0.5 - half;
			var h2 = ( op2.head === undefined ? height : op2.head );
			var sill2 = op2.sill || 0;
			if ( axis === "x" ) {
				b.deco( x + cx, y + h2 - 0.06, z, op2.width + 0.2, 0.12, thick + 0.1, trimCol );
				if ( sill2 > 0 ) b.deco( x + cx, y + sill2 - 0.06, z, op2.width + 0.2, 0.12, thick + 0.14, trimCol );
			} else {
				b.deco( x, y + h2 - 0.06, z + cx, thick + 0.1, 0.12, op2.width + 0.2, trimCol );
				if ( sill2 > 0 ) b.deco( x, y + sill2 - 0.06, z + cx, thick + 0.14, 0.12, op2.width + 0.2, trimCol );
			}
		}
	}
	return b;
};

/* Rectangular structure with a floor, four walls and an optional roof.
 * `doors` / `windows` are per-side arrays keyed n/s/e/w. */
P.building = function( b, x, y, z, w, d, height, color, o ) {
	o = o || {};
	var t = o.thick || 0.35;
	var tag = o.tag || S.CONCRETE;
	var floorCol = o.floorColor === undefined ? U.shade( color, 0.82 ) : o.floorColor;

	if ( o.floor !== false ) {
		b.box( x, y - 0.16, z, w, 0.18, d, floorCol, { tag: o.floorTag || tag } );
	}

	// -Z and +Z walls run along x; -X and +X run along z.
	P.wall( b, x, y, z - d * 0.5 + t * 0.5, w, height, t, "x", color,
	        { openings: o.n || [], tag: tag, trimColor: o.trimColor } );
	P.wall( b, x, y, z + d * 0.5 - t * 0.5, w, height, t, "x", color,
	        { openings: o.s || [], tag: tag, trimColor: o.trimColor } );
	P.wall( b, x - w * 0.5 + t * 0.5, y, z, d - t * 2, height, t, "z", color,
	        { openings: o.w || [], tag: tag, trimColor: o.trimColor } );
	P.wall( b, x + w * 0.5 - t * 0.5, y, z, d - t * 2, height, t, "z", color,
	        { openings: o.e || [], tag: tag, trimColor: o.trimColor } );

	if ( o.roof ) {
		var rc = o.roofColor === undefined ? U.shade( color, 0.7 ) : o.roofColor;
		b.box( x, y + height, z, w + ( o.eave || 0.3 ), o.roofThick || 0.3, d + ( o.eave || 0.3 ),
		       rc, { tag: o.roofTag || tag } );
	}
	return b;
};

/* Free-standing perimeter wall with a coping stone on top. The coping is
 * emitted in segments around any openings, so a gap left for a ramp or stair
 * isn't spanned by a floating beam at head height. */
P.parapet = function( b, x, y, z, len, height, thick, axis, color, o ) {
	o = o || {};
	P.wall( b, x, y, z, len, height, thick, axis, color, o );
	var cap = o.capColor === undefined ? U.shade( color, 1.12 ) : o.capColor;
	var half = len * 0.5;

	function capSeg( from, to ) {
		if ( to - from < 0.01 ) return;
		var mid = ( from + to ) * 0.5 - half;
		var w = to - from;
		if ( axis === "x" ) b.deco( x + mid, y + height, z, w, 0.12, thick + 0.16, cap );
		else b.deco( x, y + height, z + mid, thick + 0.16, 0.12, w, cap );
	}

	var ops = ( o.openings || [] ).filter( function( op ) {
		// Only full-height openings break the coping; a window keeps it.
		return op.head === undefined || op.head >= height;
	} ).slice().sort( function( a, c ) { return a.at - c.at; } );

	var cursor = 0;
	for ( var i = 0; i < ops.length; i++ ) {
		var a = U.clamp( ops[ i ].at, 0, len );
		var e = U.clamp( ops[ i ].at + ops[ i ].width, 0, len );
		capSeg( cursor, a );
		cursor = Math.max( cursor, e );
	}
	capSeg( cursor, len );
	return b;
};

/* Straight stair flight. Emitted as real steps so it both looks and collides
 * correctly, and the player's step-up assist walks it without input. */
P.stairs = function( b, x, y, z, width, rise, run, steps, dir, color, o ) {
	o = o || {};
	var sh = rise / steps, sd = run / steps;
	var tag = o.tag || S.CONCRETE;
	for ( var i = 0; i < steps; i++ ) {
		var h = sh * ( i + 1 );
		var off = -run * 0.5 + sd * ( i + 0.5 );
		if ( dir === "+x" )      b.box( x + off, y, z, sd, h, width, color, { tag: tag } );
		else if ( dir === "-x" ) b.box( x - off, y, z, sd, h, width, color, { tag: tag } );
		else if ( dir === "+z" ) b.box( x, y, z + off, width, h, sd, color, { tag: tag } );
		else                     b.box( x, y, z - off, width, h, sd, color, { tag: tag } );
	}
	return b;
};

/* Elevated walkway with posts and a two-rail guard. */
P.catwalk = function( b, x, y, z, len, width, axis, color, o ) {
	o = o || {};
	var deckCol = color;
	var railCol = o.railColor === undefined ? U.shade( color, 0.72 ) : o.railColor;
	var tag = o.tag || S.METAL;

	if ( axis === "x" ) b.box( x, y, z, len, 0.16, width, deckCol, { tag: tag } );
	else b.box( x, y, z, width, 0.16, len, deckCol, { tag: tag } );

	// Support legs down to the given floor level.
	if ( o.legs !== false && o.floorY !== undefined ) {
		var legCount = Math.max( 2, Math.round( len / 5 ) );
		for ( var i = 0; i <= legCount; i++ ) {
			var t = i / legCount;
			var lp = -len * 0.5 + len * t;
			var lx = axis === "x" ? x + lp : x;
			var lz = axis === "x" ? z : z + lp;
			for ( var s = -1; s <= 1; s += 2 ) {
				var ox = axis === "x" ? 0 : s * ( width * 0.5 - 0.15 );
				var oz = axis === "x" ? s * ( width * 0.5 - 0.15 ) : 0;
				b.box( lx + ox, o.floorY, lz + oz, 0.16, y - o.floorY, 0.16, railCol,
				       { tag: S.METAL, collide: false } );
			}
		}
	}

	if ( o.rails !== false ) {
		var rh = o.railHeight || 1.05;
		var sides = o.railSides || [ -1, 1 ];
		/* `railGaps` are openings in the guard rail, given as world coordinates
		 * along the run ({ at, width }). A stair or ramp arriving at a railed
		 * catwalk is otherwise walled off by its own handrail — the rail's
		 * clip volume sits exactly where the player would step on. */
		var gaps = ( o.railGaps || [] ).map( function( g ) {
			var origin = ( axis === "x" ? x : z ) - len * 0.5;
			return { from: g.at - g.width * 0.5 - origin, to: g.at + g.width * 0.5 - origin };
		} ).sort( function( a, c ) { return a.from - c.from; } );

		for ( var k = 0; k < sides.length; k++ ) {
			var sgn = sides[ k ];
			var rx = axis === "x" ? x : x + sgn * ( width * 0.5 - 0.06 );
			var rz = axis === "x" ? z + sgn * ( width * 0.5 - 0.06 ) : z;

			// Emit the rail as spans between the gaps.
			var cursor = 0;
			for ( var g = 0; g <= gaps.length; g++ ) {
				var from = cursor;
				var to = g < gaps.length ? U.clamp( gaps[ g ].from, 0, len ) : len;
				if ( g < gaps.length ) cursor = Math.max( cursor, U.clamp( gaps[ g ].to, 0, len ) );
				if ( to - from < 0.05 ) continue;
				var segLen = to - from;
				var mid = ( from + to ) * 0.5 - len * 0.5;
				var sxp = axis === "x" ? rx + mid : rx;
				var szp = axis === "x" ? rz : rz + mid;
				var rw = axis === "x" ? segLen : 0.09;
				var rd = axis === "x" ? 0.09 : segLen;
				// Top and mid rail; solid so players can't shoot or fall through.
				b.box( sxp, y + rh, szp, rw, 0.09, rd, railCol, { tag: S.METAL } );
				b.deco( sxp, y + rh * 0.5, szp, rw, 0.07, rd, railCol );
				// A thin full-height clip stops the player vaulting the rail.
				b.clip( sxp, y + 0.16 + rh * 0.5, szp, rw * 0.5, rh * 0.5, rd * 0.5, 0 );
				// Posts.
				var posts = Math.max( 1, Math.round( segLen / 2.2 ) );
				for ( var pI = 0; pI <= posts; pI++ ) {
					var pt = from + ( segLen / posts ) * pI - len * 0.5;
					var px = axis === "x" ? rx + pt : rx;
					var pz = axis === "x" ? rz : rz + pt;
					b.deco( px, y + 0.16, pz, 0.08, rh - 0.16, 0.08, railCol );
				}
			}
		}
	}
	return b;
};

/* Ladder — climbable via the player controller's ladder volume check. */
P.ladder = function( b, x, y, z, height, facing, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x8a8f96 : color;
	var w = 0.62;
	var ax = facing === "x" ? 0.06 : w * 0.5;
	var az = facing === "x" ? w * 0.5 : 0.06;
	for ( var s = -1; s <= 1; s += 2 ) {
		var sx = facing === "x" ? x : x + s * ( w * 0.5 - 0.05 );
		var sz = facing === "x" ? z + s * ( w * 0.5 - 0.05 ) : z;
		b.deco( sx, y, sz, 0.08, height, 0.08, col );
	}
	for ( var r = 0.3; r < height; r += 0.34 ) {
		b.deco( x, y + r, z, ax * 2, 0.06, az * 2, U.shade( col, 1.1 ) );
	}
	// Registered on the map so the controller can find it.
	( b.ladders = b.ladders || [] ).push( {
		x: x, y: y, z: z, height: height,
		radius: 0.9, facing: facing
	} );
	return b;
};

/* ------------------------------------------------------------------
 * cover & clutter
 * ------------------------------------------------------------------ */

P.crate = function( b, x, y, z, size, color, o ) {
	o = o || {};
	size = size || 1.1;
	var col = color === undefined ? 0x9c6b3f : color;
	var yaw = o.yaw || 0;
	b.box( x, y, z, size, size * ( o.squash || 1 ), size, col,
	       { yaw: yaw, tag: o.tag || S.WOOD } );
	// Corner banding and a diagonal brace on two faces.
	var band = U.shade( col, 0.72 );
	var h = size * ( o.squash || 1 );
	b.deco( x, y + h - 0.05, z, size + 0.03, 0.06, size + 0.03, band, { yaw: yaw } );
	b.deco( x, y + 0.04, z, size + 0.03, 0.06, size + 0.03, band, { yaw: yaw } );
	if ( o.plain !== true ) {
		var c = Math.cos( yaw ), s = Math.sin( yaw );
		var off = size * 0.5 + 0.015;
		b.deco( x - s * off, y + h * 0.5, z + c * off, size * 0.86, 0.05, 0.03, band,
		        { yaw: yaw } );
		b.deco( x + s * off, y + h * 0.5, z - c * off, size * 0.86, 0.05, 0.03, band,
		        { yaw: yaw } );
	}
	return b;
};

/* Stack of crates with slight random offsets so no two read the same. */
P.crateStack = function( b, x, y, z, count, size, color, rnd ) {
	var r = rnd || Math.random;
	var cy = y;
	for ( var i = 0; i < count; i++ ) {
		var s = size * ( 0.86 + r() * 0.2 );
		P.crate( b, x + ( r() - 0.5 ) * 0.22, cy, z + ( r() - 0.5 ) * 0.22, s,
		         U.jitterHex( color === undefined ? 0x9c6b3f : color, 0.1, r ),
		         { yaw: ( r() - 0.5 ) * 0.5 } );
		cy += s;
	}
	return b;
};

/* Shipping container — the workhorse of arena cover. Corrugated sides and a
 * door end make it read at any distance. */
P.container = function( b, x, y, z, color, o ) {
	o = o || {};
	var len = o.len || 6.1;
	var w = o.width || 2.44;
	var h = o.height || 2.59;
	var yaw = o.yaw || 0;
	var col = color === undefined ? 0xb5563c : color;
	var c = Math.cos( yaw ), s = Math.sin( yaw );

	b.box( x, y, z, len, h, w, col, { yaw: yaw, tag: S.METAL } );

	var rib = U.shade( col, 0.86 );
	var ribCount = Math.floor( len / 0.42 );
	for ( var i = 0; i < ribCount; i++ ) {
		var lx = -len * 0.5 + 0.28 + i * 0.42;
		for ( var side = -1; side <= 1; side += 2 ) {
			var lz = side * ( w * 0.5 + 0.02 );
			b.deco( x + lx * c - lz * s, y + 0.14, z + lx * s + lz * c,
			        0.13, h - 0.28, 0.06, rib, { yaw: yaw } );
		}
	}
	// Top and bottom rails.
	b.deco( x, y + h - 0.09, z, len + 0.05, 0.11, w + 0.05, U.shade( col, 0.7 ), { yaw: yaw } );
	b.deco( x, y + 0.02, z, len + 0.05, 0.10, w + 0.05, U.shade( col, 0.6 ), { yaw: yaw } );
	// Corner castings.
	for ( var sx = -1; sx <= 1; sx += 2 ) {
		for ( var sz = -1; sz <= 1; sz += 2 ) {
			var px = sx * ( len * 0.5 - 0.13 ), pz = sz * ( w * 0.5 - 0.13 );
			for ( var yy = 0; yy <= 1; yy++ ) {
				b.deco( x + px * c - pz * s, y + yy * ( h - 0.26 ), z + px * s + pz * c,
				        0.3, 0.26, 0.3, U.shade( col, 0.55 ), { yaw: yaw } );
			}
		}
	}
	// Door end: two leaves with vertical locking bars.
	var dx = -len * 0.5 - 0.02;
	var doorCol = U.shade( col, 0.92 );
	b.deco( x + dx * c, y + 0.12, z + dx * s, 0.06, h - 0.24, w - 0.12, doorCol, { yaw: yaw } );
	for ( var barI = -2; barI <= 2; barI++ ) {
		if ( barI === 0 ) continue;
		var bz = barI * ( w * 0.19 );
		b.deco( x + ( dx - 0.05 ) * c - bz * s, y + 0.2, z + ( dx - 0.05 ) * s + bz * c,
		        0.07, h - 0.4, 0.07, U.shade( col, 0.62 ), { yaw: yaw } );
	}
	return b;
};

P.barrel = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x3f6b4a : color;
	var r = o.radius || 0.34, h = o.height || 0.95;
	b.cylinder( x, y, z, r, h, 9, col, { tag: S.METAL, yaw: o.yaw || 0 } );
	var band = U.shade( col, 0.68 );
	b.cylinder( x, y + h * 0.28, z, r + 0.035, 0.09, 9, band, { collide: false, bottom: false } );
	b.cylinder( x, y + h * 0.66, z, r + 0.035, 0.09, 9, band, { collide: false, bottom: false } );
	b.cylinder( x, y + h - 0.04, z, r * 0.98, 0.06, 9, U.shade( col, 1.12 ),
	            { collide: false, bottom: false } );
	return b;
};

P.pallet = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x9a7a52 : color;
	var yaw = o.yaw || 0;
	b.box( x, y, z, 1.2, 0.14, 1.0, col, { yaw: yaw, tag: S.WOOD } );
	for ( var i = -1; i <= 1; i++ ) {
		b.deco( x, y + 0.14, z + i * 0.36, 1.2, 0.05, 0.2, U.shade( col, 1.08 ), { yaw: yaw } );
	}
	return b;
};

P.sandbags = function( b, x, y, z, len, rows, color, o ) {
	o = o || {};
	var col = color === undefined ? 0xa89267 : color;
	var yaw = o.yaw || 0;
	var rnd = o.rnd || Math.random;
	var c = Math.cos( yaw ), s = Math.sin( yaw );
	var perRow = Math.max( 2, Math.round( len / 0.52 ) );
	for ( var r = 0; r < rows; r++ ) {
		var inset = r * 0.045;
		for ( var i = 0; i < perRow; i++ ) {
			var t = ( i + ( r % 2 ? 0.5 : 0 ) ) / perRow;
			var lx = -len * 0.5 + len * t + 0.26;
			if ( lx > len * 0.5 ) continue;
			b.blob( x + lx * c, y + 0.16 + r * 0.29, z + lx * s, 0.3 - inset,
			        U.jitterHex( col, 0.09, rnd ),
			        { rings: 2, segs: 5, squash: 0.62, yaw: rnd() * 3, collide: false } );
		}
	}
	// One clean collider for the whole emplacement.
	b.collider( x, y + rows * 0.29 * 0.5, z,
	            ( len * 0.5 ) * Math.abs( c ) + 0.34 * Math.abs( s ),
	            rows * 0.29 * 0.5,
	            ( len * 0.5 ) * Math.abs( s ) + 0.34 * Math.abs( c ),
	            0, S.SAND );
	return b;
};

/* Jersey barrier. */
P.barrier = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0xb9b5aa : color;
	var yaw = o.yaw || 0;
	var len = o.len || 2.4;
	b.box( x, y, z, len, 0.32, 0.78, col, { yaw: yaw, tag: S.CONCRETE } );
	b.box( x, y + 0.32, z, len, 0.58, 0.44, col, { yaw: yaw, tag: S.CONCRETE, collide: false } );
	b.deco( x, y + 0.9, z, len, 0.09, 0.5, U.shade( col, 0.8 ), { yaw: yaw } );
	b.collider( x, y + 0.5, z,
	            ( len * 0.5 ) * Math.abs( Math.cos( yaw ) ) + 0.39 * Math.abs( Math.sin( yaw ) ),
	            0.5,
	            ( len * 0.5 ) * Math.abs( Math.sin( yaw ) ) + 0.39 * Math.abs( Math.cos( yaw ) ),
	            0, S.CONCRETE );
	return b;
};

/* Chain-link fence: posts and a rail are solid, the mesh is a thin clip so
 * players can see through but not walk through. */
P.fence = function( b, x, y, z, len, height, axis, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x6f7780 : color;
	var posts = Math.max( 2, Math.round( len / 2.6 ) );
	for ( var i = 0; i <= posts; i++ ) {
		var t = -len * 0.5 + ( len / posts ) * i;
		var px = axis === "x" ? x + t : x;
		var pz = axis === "x" ? z : z + t;
		b.deco( px, y, pz, 0.11, height, 0.11, col );
	}
	var rw = axis === "x" ? len : 0.07;
	var rd = axis === "x" ? 0.07 : len;
	b.deco( x, y + height - 0.06, z, rw, 0.07, rd, U.shade( col, 1.1 ) );
	b.deco( x, y + height * 0.5, z, rw, 0.04, rd, U.shade( col, 0.9 ) );
	if ( o.solid !== false ) {
		b.clip( x, y + height * 0.5, z,
		        ( axis === "x" ? len : 0.09 ) * 0.5, height * 0.5,
		        ( axis === "x" ? 0.09 : len ) * 0.5, 0 );
	}
	return b;
};

P.pipeRun = function( b, x, y, z, len, axis, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x7d8792 : color;
	var r = o.radius || 0.22;
	var segs = Math.max( 2, Math.round( len / 3 ) );
	// Modelled as boxes because a horizontal cylinder isn't worth the vertices.
	var w = axis === "x" ? len : r * 2;
	var d = axis === "x" ? r * 2 : len;
	b.box( x, y, z, w, r * 2, d, col, { tag: S.METAL, collide: o.collide !== false } );
	for ( var i = 0; i <= segs; i++ ) {
		var t = -len * 0.5 + ( len / segs ) * i;
		var fx = axis === "x" ? x + t : x;
		var fz = axis === "x" ? z : z + t;
		b.deco( fx, y - 0.03, fz, axis === "x" ? 0.12 : r * 2.3, r * 2 + 0.06,
		        axis === "x" ? r * 2.3 : 0.12, U.shade( col, 0.75 ) );
	}
	return b;
};

/* ------------------------------------------------------------------
 * nature
 * ------------------------------------------------------------------ */

P.pine = function( b, x, y, z, height, o ) {
	o = o || {};
	var rnd = o.rnd || Math.random;
	var trunk = o.trunkColor === undefined ? 0x53412e : o.trunkColor;
	var leaf = o.leafColor === undefined ? 0x2f5b39 : o.leafColor;
	var th = height * 0.28;
	b.cylinder( x, y, z, height * 0.045, th, 6, trunk, { tag: S.WOOD } );
	var tiers = o.tiers || 3;
	for ( var i = 0; i < tiers; i++ ) {
		var t = i / tiers;
		var ry = y + th * 0.6 + ( height - th ) * t * 0.85;
		var rr = height * 0.24 * ( 1 - t * 0.55 );
		var rh = height * 0.34 * ( 1 - t * 0.2 );
		b.cone( x, ry, z, rr, rh, 7, U.shade( leaf, 0.86 + t * 0.24 ),
		        { yaw: rnd() * 3, collide: false, bottom: false } );
	}
	b.collider( x, y + height * 0.35, z, height * 0.06, height * 0.35, height * 0.06, 0, S.WOOD );
	return b;
};

P.palm = function( b, x, y, z, height, o ) {
	o = o || {};
	var rnd = o.rnd || Math.random;
	var trunk = o.trunkColor === undefined ? 0x7a6448 : o.trunkColor;
	var leaf = o.leafColor === undefined ? 0x4c7a35 : o.leafColor;
	var lean = ( rnd() - 0.5 ) * 0.5;
	var segs = 6;
	var px = x, pz = z, py = y;
	for ( var i = 0; i < segs; i++ ) {
		var t = i / segs;
		var sh = height / segs;
		var r = height * 0.038 * ( 1 - t * 0.35 );
		b.cylinder( px, py, pz, r, sh * 1.05, 6, U.shade( trunk, 0.92 + t * 0.16 ),
		            { collide: false, bottom: false } );
		px += Math.cos( lean * 3 ) * lean * 0.14;
		pz += Math.sin( lean * 3 ) * lean * 0.14;
		py += sh;
	}
	var fronds = 7;
	for ( var f = 0; f < fronds; f++ ) {
		var a = ( f / fronds ) * U.TAU + rnd();
		var dropX = Math.cos( a ), dropZ = Math.sin( a );
		var L = height * 0.34;
		b.tri(
			px, py + 0.1, pz,
			px + dropX * L, py - height * 0.06, pz + dropZ * L,
			px + dropX * L * 0.55 - dropZ * 0.34, py + height * 0.05, pz + dropZ * L * 0.55 + dropX * 0.34,
			U.shade( leaf, 0.85 + rnd() * 0.3 ) );
		b.tri(
			px, py + 0.1, pz,
			px + dropX * L * 0.55 + dropZ * 0.34, py + height * 0.05, pz + dropZ * L * 0.55 - dropX * 0.34,
			px + dropX * L, py - height * 0.06, pz + dropZ * L,
			U.shade( leaf, 0.8 + rnd() * 0.3 ) );
	}
	b.collider( x, y + height * 0.4, z, height * 0.05, height * 0.4, height * 0.05, 0, S.WOOD );
	return b;
};

/* Broad-leaf jungle tree. */
P.jungleTree = function( b, x, y, z, height, o ) {
	o = o || {};
	var rnd = o.rnd || Math.random;
	var trunk = o.trunkColor === undefined ? 0x554233 : o.trunkColor;
	var leaf = o.leafColor === undefined ? 0x2e5c2a : o.leafColor;
	b.cylinder( x, y, z, height * 0.055, height * 0.62, 6, trunk, { tag: S.WOOD } );
	var blobs = 4;
	for ( var i = 0; i < blobs; i++ ) {
		var a = ( i / blobs ) * U.TAU + rnd();
		var rr = height * ( 0.16 + rnd() * 0.09 );
		b.blob( x + Math.cos( a ) * height * 0.13,
		        y + height * ( 0.52 + rnd() * 0.22 ),
		        z + Math.sin( a ) * height * 0.13,
		        rr, U.shade( leaf, 0.82 + rnd() * 0.36 ),
		        { rings: 3, segs: 6, squash: 0.78, rnd: rnd, collide: false } );
	}
	return b;
};

P.rock = function( b, x, y, z, size, color, o ) {
	o = o || {};
	var rnd = o.rnd || Math.random;
	b.blob( x, y, z, size, color === undefined ? 0x77726a : color,
	        { rings: 3, segs: 6, squash: o.squash || 0.7, rnd: rnd, yaw: rnd() * 3,
	          collide: o.collide !== false, tag: o.tag || S.CONCRETE } );
	return b;
};

P.bush = function( b, x, y, z, size, color, o ) {
	o = o || {};
	var rnd = o.rnd || Math.random;
	for ( var i = 0; i < 3; i++ ) {
		b.blob( x + ( rnd() - 0.5 ) * size, y, z + ( rnd() - 0.5 ) * size,
		        size * ( 0.6 + rnd() * 0.4 ),
		        U.shade( color === undefined ? 0x3d6b34 : color, 0.8 + rnd() * 0.4 ),
		        { rings: 2, segs: 5, squash: 0.8, rnd: rnd, collide: false } );
	}
	return b;
};

/* ------------------------------------------------------------------
 * industrial / urban
 * ------------------------------------------------------------------ */

P.acUnit = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x9aa1a8 : color;
	var w = o.w || 1.6, d = o.d || 1.3, h = o.h || 0.95;
	var yaw = o.yaw || 0;
	b.box( x, y, z, w, h, d, col, { yaw: yaw, tag: S.METAL } );
	b.deco( x, y + h, z, w * 0.72, 0.09, d * 0.72, U.shade( col, 0.7 ), { yaw: yaw } );
	b.cylinder( x, y + h + 0.02, z, Math.min( w, d ) * 0.3, 0.07, 10, U.shade( col, 0.55 ),
	            { collide: false } );
	// Grille slats on the long face.
	var c = Math.cos( yaw ), s = Math.sin( yaw );
	for ( var i = 0; i < 5; i++ ) {
		var ly = y + 0.16 + i * ( h - 0.3 ) / 5;
		var lz = d * 0.5 + 0.02;
		b.deco( x - s * lz, ly, z + c * lz, w * 0.84, 0.05, 0.03, U.shade( col, 0.62 ),
		        { yaw: yaw } );
	}
	return b;
};

P.dumpster = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x2f6b4f : color;
	var yaw = o.yaw || 0;
	b.box( x, y + 0.16, z, 2.0, 1.05, 1.15, col, { yaw: yaw, tag: S.METAL } );
	b.deco( x, y + 1.2, z, 2.1, 0.1, 1.25, U.shade( col, 1.1 ), { yaw: yaw } );
	for ( var sx = -1; sx <= 1; sx += 2 ) {
		for ( var sz = -1; sz <= 1; sz += 2 ) {
			var px = sx * 0.8, pz = sz * 0.45;
			b.deco( x + px * Math.cos( yaw ) - pz * Math.sin( yaw ), y,
			        z + px * Math.sin( yaw ) + pz * Math.cos( yaw ),
			        0.16, 0.18, 0.16, 0x2a2a2a, { yaw: yaw } );
		}
	}
	return b;
};

P.generator = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0xc9a13c : color;
	var yaw = o.yaw || 0;
	b.box( x, y, z, 2.2, 1.25, 1.2, col, { yaw: yaw, tag: S.METAL } );
	b.deco( x, y + 1.25, z, 1.6, 0.14, 0.9, U.shade( col, 0.72 ), { yaw: yaw } );
	var ex = 0.85, ez = 0.3;
	b.cylinder( x + ex * Math.cos( yaw ) - ez * Math.sin( yaw ), y + 1.25,
	            z + ex * Math.sin( yaw ) + ez * Math.cos( yaw ),
	            0.12, 0.7, 7, 0x4a4a4a, { collide: false } );
	return b;
};

P.streetLight = function( b, x, y, z, height, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x565c63 : color;
	b.cylinder( x, y, z, 0.11, height, 7, col, { tag: S.METAL } );
	var reach = o.reach || 1.3;
	var dir = o.dir === undefined ? 0 : o.dir;
	var hx = Math.cos( dir ) * reach, hz = Math.sin( dir ) * reach;
	b.deco( x + hx * 0.5, y + height - 0.1, z + hz * 0.5,
	        Math.abs( hx ) + 0.12, 0.12, Math.abs( hz ) + 0.12, col );
	b.deco( x + hx, y + height - 0.24, z + hz, 0.5, 0.16, 0.34,
	        o.lampColor === undefined ? 0xfff2c4 : o.lampColor );
	return b;
};

P.antenna = function( b, x, y, z, height, color ) {
	var col = color === undefined ? 0x8b9099 : color;
	b.cylinder( x, y, z, 0.09, height, 6, col, { tag: S.METAL } );
	for ( var i = 1; i <= 3; i++ ) {
		var t = i / 4;
		var r = 0.42 * ( 1 - t * 0.6 );
		b.deco( x, y + height * t, z, r * 2, 0.05, 0.05, col );
		b.deco( x, y + height * t, z, 0.05, 0.05, r * 2, col );
	}
	b.deco( x, y + height, z, 0.09, 0.5, 0.09, 0xd04a3a );
	return b;
};

/* Backlit sign panel — the emissive colour is faked with a bright vertex
 * colour, which reads correctly against the dark night palette. */
P.billboard = function( b, x, y, z, w, h, height, faceColor, o ) {
	o = o || {};
	var yaw = o.yaw || 0;
	var frame = o.frameColor === undefined ? 0x3a3f47 : o.frameColor;
	var c = Math.cos( yaw ), s = Math.sin( yaw );
	for ( var sx = -1; sx <= 1; sx += 2 ) {
		var lx = sx * ( w * 0.5 - 0.35 );
		b.cylinder( x + lx * c, y, z + lx * s, 0.13, height, 6, frame, { tag: S.METAL } );
	}
	b.box( x, y + height, z, w, h, 0.18, frame, { yaw: yaw, tag: S.METAL } );
	b.deco( x - s * 0.12, y + height + 0.12, z + c * 0.12, w - 0.24, h - 0.24, 0.06,
	        faceColor, { yaw: yaw, tint: 1.25 } );
	return b;
};

/* Simple truck body — cover plus a climbable bed. */
P.truck = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x5a6b4a : color;
	var yaw = o.yaw || 0;
	var c = Math.cos( yaw ), s = Math.sin( yaw );
	function at( lx, lz ) { return [ x + lx * c - lz * s, z + lx * s + lz * c ]; }

	// Chassis + bed.
	b.box( x, y + 0.62, z, 5.6, 0.42, 2.3, U.shade( col, 0.7 ), { yaw: yaw, tag: S.METAL } );
	// Cab.
	var cab = at( 1.85, 0 );
	b.box( cab[ 0 ], y + 1.04, cab[ 1 ], 1.9, 1.25, 2.2, col, { yaw: yaw, tag: S.METAL } );
	var win = at( 1.2, 0 );
	b.deco( win[ 0 ], y + 1.55, win[ 1 ], 0.1, 0.62, 1.9, 0x27323a, { yaw: yaw } );
	// Cargo box or open bed with side rails.
	if ( o.cargo !== false ) {
		var cg = at( -1.15, 0 );
		b.box( cg[ 0 ], y + 1.04, cg[ 1 ], 3.4, 1.55, 2.3, U.shade( col, 0.88 ),
		       { yaw: yaw, tag: S.METAL } );
		var ribs = 6;
		for ( var i = 0; i < ribs; i++ ) {
			var lx = -2.7 + i * 0.58;
			for ( var side = -1; side <= 1; side += 2 ) {
				var p = at( lx, side * 1.17 );
				b.deco( p[ 0 ], y + 1.14, p[ 1 ], 0.1, 1.35, 0.06, U.shade( col, 0.72 ),
				        { yaw: yaw } );
			}
		}
	} else {
		for ( var side2 = -1; side2 <= 1; side2 += 2 ) {
			var r = at( -1.15, side2 * 1.1 );
			b.box( r[ 0 ], y + 0.84, r[ 1 ], 3.4, 0.5, 0.12, U.shade( col, 0.8 ),
			       { yaw: yaw, tag: S.METAL } );
		}
	}
	// Wheels.
	for ( var wx = 0; wx < 3; wx++ ) {
		var lxw = [ 1.75, -0.7, -1.9 ][ wx ];
		for ( var sw = -1; sw <= 1; sw += 2 ) {
			var wp = at( lxw, sw * 1.12 );
			b.cylinder( wp[ 0 ], y, wp[ 1 ], 0.5, 0.36, 8, 0x22242a,
			            { yaw: yaw + Math.PI / 2, collide: false } );
		}
	}
	return b;
};

P.forklift = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0xd6a12a : color;
	var yaw = o.yaw || 0;
	var c = Math.cos( yaw ), s = Math.sin( yaw );
	function at( lx, lz ) { return [ x + lx * c - lz * s, z + lx * s + lz * c ]; }
	b.box( x, y + 0.34, z, 1.9, 0.85, 1.25, col, { yaw: yaw, tag: S.METAL } );
	var seat = at( -0.35, 0 );
	b.deco( seat[ 0 ], y + 1.19, seat[ 1 ], 0.55, 0.5, 0.7, 0x2c2f34, { yaw: yaw } );
	// Mast.
	var mast = at( 1.0, 0 );
	for ( var sm = -1; sm <= 1; sm += 2 ) {
		var mp = at( 1.0, sm * 0.42 );
		b.box( mp[ 0 ], y + 0.2, mp[ 1 ], 0.14, 2.2, 0.14, U.shade( col, 0.6 ),
		       { yaw: yaw, tag: S.METAL } );
	}
	// Forks.
	for ( var sf = -1; sf <= 1; sf += 2 ) {
		var fp = at( 1.55, sf * 0.32 );
		b.deco( fp[ 0 ], y + 0.12, fp[ 1 ], 1.0, 0.08, 0.14, 0x555a60, { yaw: yaw } );
	}
	// Overhead guard.
	b.deco( mast[ 0 ] - c * 0.7, y + 2.15, mast[ 1 ] - s * 0.7, 1.5, 0.1, 1.2,
	        U.shade( col, 0.7 ), { yaw: yaw } );
	for ( var wx2 = -1; wx2 <= 1; wx2 += 2 ) {
		for ( var sw2 = -1; sw2 <= 1; sw2 += 2 ) {
			var wp2 = at( wx2 * 0.65, sw2 * 0.6 );
			b.cylinder( wp2[ 0 ], y, wp2[ 1 ], 0.34, 0.28, 8, 0x24262b,
			            { yaw: yaw + Math.PI / 2, collide: false } );
		}
	}
	return b;
};

/* Gantry crane leg + boom, used as a skyline element on the harbour map. */
P.crane = function( b, x, y, z, height, reach, color, o ) {
	o = o || {};
	var col = color === undefined ? 0xd4622f : color;
	var yaw = o.yaw || 0;
	var c = Math.cos( yaw ), s = Math.sin( yaw );
	for ( var sx = -1; sx <= 1; sx += 2 ) {
		for ( var sz = -1; sz <= 1; sz += 2 ) {
			var lx = sx * 1.6, lz = sz * 1.6;
			b.box( x + lx * c - lz * s, y, z + lx * s + lz * c, 0.34, height, 0.34,
			       col, { tag: S.METAL } );
		}
	}
	// Cross bracing.
	for ( var i = 1; i < 4; i++ ) {
		var by = y + height * ( i / 4 );
		b.deco( x, by, z, 3.5, 0.18, 3.5, U.shade( col, 0.85 ), { yaw: yaw } );
	}
	// Horizontal boom.
	var bx = reach * 0.5 - 1.0;
	b.box( x + bx * c, y + height, z + bx * s, reach, 0.55, 0.9, col,
	       { yaw: yaw, tag: S.METAL } );
	b.deco( x + bx * c, y + height + 0.55, z + bx * s, reach * 0.9, 0.18, 0.5,
	        U.shade( col, 0.75 ), { yaw: yaw } );
	// Cab.
	var cabx = 1.4;
	b.deco( x + cabx * c, y + height - 1.1, z + cabx * s, 1.3, 1.1, 1.3, 0x39424c,
	        { yaw: yaw } );
	return b;
};

/* ------------------------------------------------------------------
 * temple / ruins
 * ------------------------------------------------------------------ */

P.column = function( b, x, y, z, height, radius, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x9d9482 : color;
	var r = radius || 0.42;
	b.box( x, y, z, r * 2.5, 0.22, r * 2.5, U.shade( col, 0.9 ), { tag: S.CONCRETE } );
	if ( o.broken ) {
		height *= 0.35 + Math.random() * 0.3;
	}
	b.cylinder( x, y + 0.22, z, r, height - 0.22, 10, col, { tag: S.CONCRETE } );
	// Fluting.
	for ( var i = 0; i < 10; i++ ) {
		var a = ( i / 10 ) * U.TAU;
		b.deco( x + Math.cos( a ) * r * 0.98, y + 0.3, z + Math.sin( a ) * r * 0.98,
		        0.06, height - 0.5, 0.06, U.shade( col, 0.86 ) );
	}
	if ( !o.broken ) {
		b.box( x, y + height, z, r * 2.6, 0.28, r * 2.6, U.shade( col, 1.06 ),
		       { tag: S.CONCRETE } );
	}
	return b;
};

P.idol = function( b, x, y, z, height, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x8f8571 : color;
	var gold = o.accent === undefined ? 0xc9a248 : o.accent;
	b.box( x, y, z, 2.4, 0.4, 2.4, U.shade( col, 0.86 ), { tag: S.CONCRETE } );
	b.box( x, y + 0.4, z, 1.8, 0.35, 1.8, col, { tag: S.CONCRETE } );
	b.box( x, y + 0.75, z, 1.1, height * 0.5, 0.9, col, { tag: S.CONCRETE } );
	b.box( x, y + 0.75 + height * 0.5, z, 0.85, height * 0.28, 0.75, U.shade( col, 1.05 ),
	       { tag: S.CONCRETE } );
	// Head + eyes.
	b.deco( x, y + 0.75 + height * 0.78, z, 0.62, 0.55, 0.58, U.shade( col, 1.1 ) );
	for ( var s = -1; s <= 1; s += 2 ) {
		b.deco( x + s * 0.16, y + 0.75 + height * 0.9, z + 0.3, 0.14, 0.1, 0.06, gold,
		        { tint: 1.4 } );
	}
	b.deco( x, y + 0.75 + height * 1.06, z, 0.72, 0.14, 0.66, gold );
	return b;
};

P.brazier = function( b, x, y, z, color, o ) {
	o = o || {};
	var col = color === undefined ? 0x5d5347 : color;
	b.cylinder( x, y, z, 0.18, 0.85, 7, col, { tag: S.METAL } );
	b.cylinder( x, y + 0.85, z, 0.28, 0.34, 9, U.shade( col, 1.1 ),
	            { rTop: 0.44, collide: false } );
	b.blob( x, y + 1.06, z, 0.3, 0xe8763a, { rings: 2, segs: 6, squash: 0.9, collide: false } );
	return b;
};

P.rubble = function( b, x, y, z, spread, count, color, rnd ) {
	var r = rnd || Math.random;
	for ( var i = 0; i < count; i++ ) {
		var a = r() * U.TAU, d = r() * spread;
		P.rock( b, x + Math.cos( a ) * d, y, z + Math.sin( a ) * d,
		        0.18 + r() * 0.34, U.jitterHex( color === undefined ? 0x8b8578 : color, 0.14, r ),
		        { rnd: r, collide: r() > 0.6, squash: 0.5 + r() * 0.4 } );
	}
	return b;
};

/* ------------------------------------------------------------------
 * shared
 * ------------------------------------------------------------------ */

/* Health / ammo pickup pad — the visual only; the pickup logic lives in the
 * match module and reads `b.pickups`. */
P.pickupPad = function( b, x, y, z, kind ) {
	var col = kind === "health" ? 0x39c46a : 0xf0b429;
	b.deco( x, y + 0.01, z, 1.3, 0.05, 1.3, U.shade( col, 0.5 ) );
	b.deco( x, y + 0.06, z, 1.05, 0.03, 1.05, col, { tint: 1.3 } );
	( b.pickups = b.pickups || [] ).push( { x: x, y: y, z: z, kind: kind } );
	return b;
};

/* Scatter helper: places `count` items via `fn` inside a rectangle, rejecting
 * positions that land inside existing colliders. */
P.scatter = function( b, world, x, z, w, d, count, rnd, fn ) {
	var placed = 0, tries = 0;
	while ( placed < count && tries < count * 12 ) {
		tries++;
		var px = x + ( rnd() - 0.5 ) * w;
		var pz = z + ( rnd() - 0.5 ) * d;
		if ( world && world.overlaps( px, 0.2, pz, 0.8, 1.0 ) ) continue;
		fn( px, pz, rnd );
		placed++;
	}
	return b;
};

} )( window );
