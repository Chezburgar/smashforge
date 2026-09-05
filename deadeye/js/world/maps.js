/* DEADEYE — maps
 *
 * Each map supplies a palette, a lighting rig, an ambience profile, a build()
 * that emits geometry through the builder, and a list of spawn points.
 * Bot navigation points are sampled from the finished geometry at load time
 * (see nav.js), so maps never hand-author a waypoint graph.
 *
 * Layouts follow the same rules throughout: a strong central landmark, two
 * flanking routes, at least one elevated firing position reachable without
 * jumping puzzles, and no spawn with a sightline onto another spawn.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;
var S = DE.SURFACE;
var P = DE.props;

var MAPS = {};

/* Ground plane plus a perimeter wall tall enough that nothing can be jumped
 * out of. Returns the inner half-extent. */
function arena( b, size, groundColor, wallColor, wallH, groundTag ) {
	var half = size * 0.5;
	b.box( 0, -1.2, 0, size + 12, 1.2, size + 12, groundColor,
	       { tag: groundTag || S.CONCRETE } );
	wallH = wallH || 9;
	for ( var i = 0; i < 4; i++ ) {
		var ax = i < 2 ? 1 : 0;
		var sgn = i % 2 ? 1 : -1;
		if ( ax ) b.box( sgn * half, 0, 0, 1.2, wallH, size + 2.4, wallColor, { tag: S.CONCRETE } );
		else b.box( 0, 0, sgn * half, size + 2.4, wallH, 1.2, wallColor, { tag: S.CONCRETE } );

		/* Relief on the inward face. A bare wall this tall is a featureless
		 * wash of one colour that gives the eye nothing to judge distance or
		 * movement against; pilasters and a capping course fix that for a few
		 * hundred triangles. */
		var inset = half - 0.62;
		var pil = U.shade( wallColor, 0.86 );
		var cap = U.shade( wallColor, 1.14 );
		var span = size + 2.4;
		var count = Math.round( span / 6 );
		for ( var p = 0; p <= count; p++ ) {
			var t = -span * 0.5 + ( span / count ) * p;
			if ( ax ) b.deco( sgn * inset, 0, t, 0.28, wallH - 0.5, 1.5, pil );
			else b.deco( t, 0, sgn * inset, 1.5, wallH - 0.5, 0.28, pil );
		}
		// Capping course and a plinth at the base.
		if ( ax ) {
			b.deco( sgn * half, wallH - 0.5, 0, 1.6, 0.5, span, cap );
			b.deco( sgn * ( half - 0.1 ), 0, 0, 1.5, 0.45, span, U.shade( wallColor, 0.7 ) );
		} else {
			b.deco( 0, wallH - 0.5, sgn * half, span, 0.5, 1.6, cap );
			b.deco( 0, 0, sgn * ( half - 0.1 ), span, 0.45, 1.5, U.shade( wallColor, 0.7 ) );
		}
	}
	// Invisible ceiling clip so grenades and players can't leave the box.
	b.clip( 0, wallH + 14, 0, half, 0.6, half );
	// Record the playable half-extent so navigation ignores the apron of
	// ground that extends past the perimeter wall.
	b.playHalf = half;
	return half;
}

/* True when (x,z) is far enough from every spawn to place a solid prop there.
 * Scattered decoration is randomised, so without this a tree can land on a
 * spawn point and wedge whoever appears in it. */
function clearOfSpawns( spawns, x, z, r ) {
	for ( var i = 0; i < spawns.length; i++ ) {
		var dx = spawns[ i ].x - x, dz = spawns[ i ].z - z;
		if ( dx * dx + dz * dz < r * r ) return false;
	}
	return true;
}

/* ==================================================================
 * 1. DUNE — desert outpost, bright and open with long diagonals
 * ================================================================== */
MAPS.dune = {
	id: "dune", name: "DUNE", subtitle: "Desert Outpost",
	sky: { top: 0x3f7fc4, bottom: 0xe6c99a, fog: 0xe0c49b, fogNear: 55, fogFar: 165 },
	sun: { color: 0xfff0d0, intensity: 0.58, pos: [ 60, 82, 30 ],
	       ambSky: 0xa9cdf0, ambGround: 0xc9a878, ambInt: 0.56 },
	ambience: { wind: 0.055, windFreq: 430, space: 1.1, wet: 0.16 },
	build: function( b, rnd ) {
		var SAND = 0xd7bd8c, WALL = 0xc2a67d, WALL2 = 0xb09368;
		var STONE = 0xa89070, ROOF = 0x9c7d55, RUST = 0x9c5f3c;
		var half = arena( b, 74, SAND, WALL2, 10, S.SAND );

		/* --- central ruin: two-storey stone block, the map's landmark --- */
		P.building( b, 0, 0, 0, 15, 13, 3.4, STONE, {
			tag: S.CONCRETE, roof: true, roofColor: ROOF, floor: false,
			n: [ { at: 5.5, width: 4, sill: 0, head: 2.6 } ],
			s: [ { at: 5.5, width: 4, sill: 0, head: 2.6 } ],
			w: [ { at: 4.0, width: 3.2, sill: 1.0, head: 2.4 } ],
			e: [ { at: 4.0, width: 3.2, sill: 1.0, head: 2.4 } ]
		} );
		// Upper deck, reached by external stairs on both flanks.
		P.parapet( b, 0, 3.7, -6.2, 15, 1.1, 0.4, "x", STONE );
		P.parapet( b, 0, 3.7, 6.2, 15, 1.1, 0.4, "x", STONE );
		P.parapet( b, -7.3, 3.7, 0, 12.4, 1.1, 0.4, "z", STONE );
		P.parapet( b, 7.3, 3.7, 0, 12.4, 1.1, 0.4, "z", STONE );
		// Gaps in the parapet to shoot through.
		P.stairs( b, -9.6, 0, 0, 3.0, 3.7, 5.2, 11, "+x", STONE );
		P.stairs( b, 9.6, 0, 0, 3.0, 3.7, 5.2, 11, "-x", STONE );
		// A tower on one corner gives a commanding but exposed angle.
		P.building( b, 5.6, 3.7, -4.2, 5.4, 5.0, 3.2, STONE, {
			tag: S.CONCRETE, roof: false, floor: false,
			n: [ { at: 1.6, width: 2.2, sill: 1.1, head: 2.6 } ],
			e: [ { at: 1.6, width: 2.0, sill: 1.1, head: 2.6 } ],
			s: [ { at: 1.6, width: 2.2, sill: 0, head: 2.4 } ]
		} );
		P.parapet( b, 5.6, 6.9, -4.2, 5.4, 0.7, 0.4, "x", STONE );

		/* --- north compound --- */
		P.building( b, -17, 0, -21, 13, 10, 3.2, WALL, {
			tag: S.CONCRETE, roof: true, roofColor: ROOF,
			floorTag: S.CONCRETE,
			s: [ { at: 4.5, width: 3.4, sill: 0, head: 2.5 } ],
			e: [ { at: 3.2, width: 2.6, sill: 1.1, head: 2.4 } ],
			n: [ { at: 2.0, width: 2.4, sill: 1.1, head: 2.4 },
			     { at: 8.0, width: 2.4, sill: 1.1, head: 2.4 } ]
		} );
		// Stairs climb toward the building so the top tread meets the roof edge
		// at x = -10.5; parapets sit on the roof perimeter, not across it.
		P.stairs( b, -8.2, 0, -21, 2.6, 3.5, 4.6, 10, "-x", WALL2 );
		P.parapet( b, -17, 3.5, -25.8, 13, 0.9, 0.35, "x", WALL2 );
		P.parapet( b, -17, 3.5, -16.2, 13, 0.9, 0.35, "x", WALL2 );
		P.parapet( b, -23.3, 3.5, -21, 9.6, 0.9, 0.35, "z", WALL2 );

		/* --- south compound --- */
		P.building( b, 18, 0, 20, 12, 11, 3.2, WALL, {
			tag: S.CONCRETE, roof: true, roofColor: ROOF,
			n: [ { at: 4.0, width: 3.4, sill: 0, head: 2.5 } ],
			w: [ { at: 3.4, width: 2.6, sill: 1.1, head: 2.4 } ],
			s: [ { at: 4.4, width: 2.6, sill: 1.1, head: 2.4 } ]
		} );
		P.stairs( b, 9.7, 0, 20, 2.6, 3.5, 4.6, 10, "+x", WALL2 );
		P.parapet( b, 18, 3.5, 14.5, 12, 0.9, 0.35, "x", WALL2 );
		P.parapet( b, 18, 3.5, 25.5, 12, 0.9, 0.35, "x", WALL2 );
		P.parapet( b, 23.8, 3.5, 20, 10.6, 0.9, 0.35, "z", WALL2 );

		/* --- market awnings: soft cover across the open west side --- */
		for ( var m = 0; m < 3; m++ ) {
			var mx = -25 + m * 2.5, mz = 4 + m * 9;
			for ( var leg = -1; leg <= 1; leg += 2 ) {
				b.box( mx + leg * 2.4, 0, mz - 2.2, 0.18, 2.5, 0.18, RUST, { tag: S.WOOD } );
				b.box( mx + leg * 2.4, 0, mz + 2.2, 0.18, 2.5, 0.18, RUST, { tag: S.WOOD } );
			}
			b.box( mx, 2.5, mz, 5.6, 0.16, 5.0, U.pick( [ 0xb8503f, 0xc98a3a, 0x8a7f6a ] ),
			       { tag: S.WOOD } );
			P.crateStack( b, mx - 1.4, 0, mz - 1.2, 2, 1.05, 0x9c6b3f, rnd );
			P.barrel( b, mx + 1.6, 0, mz + 1.3, U.pick( [ 0x8a5c33, 0x4a6b52 ] ) );
		}

		/* --- sandbag emplacements around the centre --- */
		P.sandbags( b, -9, 0, 11, 6, 3, 0xbaa478, { yaw: 0.3, rnd: rnd } );
		P.sandbags( b, 11, 0, -11, 6, 3, 0xbaa478, { yaw: -0.4, rnd: rnd } );
		P.sandbags( b, -13, 0, -6, 5, 2, 0xbaa478, { yaw: 1.35, rnd: rnd } );
		P.sandbags( b, 14, 0, 6, 5, 2, 0xbaa478, { yaw: 1.2, rnd: rnd } );

		/* --- vehicles --- */
		P.truck( b, -22, 0, 22, 0x8a7a4a, { yaw: 0.5 } );
		P.truck( b, 24, 0, -22, 0x6d6b48, { yaw: -2.2, cargo: false } );

		/* --- scattered cover --- */
		var spots = [ [ -6, 22 ], [ 7, 25 ], [ -24, -8 ], [ 25, 8 ], [ 2, -24 ],
		              [ -14, 17 ], [ 20, -6 ], [ -20, 4 ], [ 15, 14 ], [ -3, -14 ] ];
		for ( var i = 0; i < spots.length; i++ ) {
			var sx = spots[ i ][ 0 ], sz = spots[ i ][ 1 ];
			if ( rnd() < 0.55 ) P.crateStack( b, sx, 0, sz, 1 + ( rnd() < 0.5 ? 1 : 0 ), 1.15, 0x9c6b3f, rnd );
			else {
				P.barrel( b, sx, 0, sz, U.pick( [ 0x8a5c33, 0x4a6b52, 0x7a7a72 ] ) );
				P.barrel( b, sx + 0.8, 0, sz + 0.5, U.pick( [ 0x8a5c33, 0x4a6b52 ] ) );
			}
		}

		/* --- palms and rocks for silhouette --- */
		var palmSpots = [ [ -28, -26 ], [ -30, 12 ], [ 29, 26 ], [ 27, -14 ],
		                  [ -8, 30 ], [ 12, -30 ], [ 31, 2 ], [ -31, -14 ] ];
		for ( var p = 0; p < palmSpots.length; p++ ) {
			if ( !clearOfSpawns( MAPS.dune.spawns, palmSpots[ p ][ 0 ], palmSpots[ p ][ 1 ], 4.0 ) ) continue;
			P.palm( b, palmSpots[ p ][ 0 ], 0, palmSpots[ p ][ 1 ], 5.5 + rnd() * 2.5,
			        { rnd: rnd } );
		}
		for ( var r = 0; r < 16; r++ ) {
			var a = rnd() * U.TAU, d = 18 + rnd() * 16;
			var rx2 = Math.cos( a ) * d, rz2 = Math.sin( a ) * d;
			if ( !clearOfSpawns( MAPS.dune.spawns, rx2, rz2, 3.0 ) ) continue;
			P.rock( b, rx2, 0, rz2, 0.5 + rnd() * 0.9, 0x9c8a6c, { rnd: rnd, squash: 0.6 } );
		}

		// Low dunes at the edges so the ground isn't a flat plane.
		for ( var dn = 0; dn < 10; dn++ ) {
			var da = rnd() * U.TAU, dd = 26 + rnd() * 8;
			P.rock( b, Math.cos( da ) * dd, -0.6, Math.sin( da ) * dd, 3 + rnd() * 3,
			        U.jitterHex( SAND, 0.06, rnd ),
			        { rnd: rnd, squash: 0.22, collide: false, tag: S.SAND } );
		}

		P.pickupPad( b, 0, 3.7, 0, "health" );
		P.pickupPad( b, -17, 0, -21, "ammo" );
		P.pickupPad( b, 18, 0, 20, "ammo" );
	},
	spawns: [
		{ x: -28, y: 0, z: -28, yaw: 2.4 }, { x: -30, y: 0, z: 0, yaw: 1.57 },
		{ x: -26, y: 0, z: 26, yaw: 0.8 },  { x: 0, y: 0, z: 30, yaw: 0 },
		{ x: 28, y: 0, z: 28, yaw: -2.4 },  { x: 30, y: 0, z: 2, yaw: -1.57 },
		{ x: 26, y: 0, z: -26, yaw: -0.8 }, { x: 0, y: 0, z: -30, yaw: 3.14 },
		{ x: -17, y: 3.6, z: -21, yaw: 1.2 }, { x: 18, y: 3.6, z: 20, yaw: -1.9 },
		{ x: -14, y: 0, z: 12, yaw: 0.5 },  { x: 15, y: 0, z: -12, yaw: -2.6 }
	]
};

/* ==================================================================
 * 2. DEPOT — enclosed warehouse, tight lanes and a catwalk ring
 * ================================================================== */
MAPS.depot = {
	id: "depot", name: "DEPOT", subtitle: "Storage Facility",
	sky: { top: 0x2a3038, bottom: 0x3c444e, fog: 0x39414a, fogNear: 40, fogFar: 120 },
	sun: { color: 0xdce8f5, intensity: 0.42, pos: [ 30, 70, 45 ],
	       ambSky: 0x8fa4bd, ambGround: 0x4a4f56, ambInt: 0.7 },
	ambience: { rumble: 0.05, rumbleFreq: 70, hiss: 0.012, space: 2.2, wet: 0.5 },
	build: function( b, rnd ) {
		var FLOOR = 0x64676d, WALL = 0x7d838c, BEAM = 0x555b63;
		var LINE = 0xc7a83f, DECK = 0x6e747c;
		var half = arena( b, 70, FLOOR, WALL, 13, S.CONCRETE );

		// Painted floor lanes — pure decoration, but they read the layout.
		for ( var l = -2; l <= 2; l++ ) {
			b.deco( l * 13, 0.01, 0, 0.16, 0.02, 62, LINE );
		}
		b.deco( 0, 0.01, 0, 62, 0.02, 0.16, LINE );

		/* --- roof structure: trusses and skylights --- */
		for ( var t = -3; t <= 3; t++ ) {
			b.deco( 0, 12.2, t * 9, 68, 0.5, 0.55, BEAM );
			b.deco( 0, 11.6, t * 9, 68, 0.3, 0.28, BEAM );
			// Skylight strips brighten the lanes below.
			if ( t % 2 === 0 ) b.deco( 0, 12.9, t * 9, 60, 0.14, 3.2, 0xdff0ff, { tint: 1.5 } );
		}
		for ( var c = -3; c <= 3; c++ ) {
			if ( Math.abs( c ) === 1 ) continue;
			b.box( c * 11, 0, -26, 0.55, 12.2, 0.55, BEAM, { tag: S.METAL } );
			b.box( c * 11, 0, 26, 0.55, 12.2, 0.55, BEAM, { tag: S.METAL } );
		}

		/* --- perimeter catwalk ring at 5.2m --- */
		var CY = 5.2;
		// Rail gaps at x = ∓24 are where the two stair flights arrive.
		P.catwalk( b, 0, CY, -29, 55, 2.6, "x", DECK,
		           { floorY: 0, railSides: [ 1 ], railGaps: [ { at: -24, width: 4.0 } ] } );
		P.catwalk( b, 0, CY, 29, 55, 2.6, "x", DECK,
		           { floorY: 0, railSides: [ -1 ], railGaps: [ { at: 24, width: 4.0 } ] } );
		P.catwalk( b, -29, CY, 0, 55, 2.6, "z", DECK, { floorY: 0, railSides: [ 1 ] } );
		P.catwalk( b, 29, CY, 0, 55, 2.6, "z", DECK, { floorY: 0, railSides: [ -1 ] } );
		// Corner platforms. Without them the four runs only clip each other
		// over a 0.2m square and the ring is not actually a ring — each arm
		// becomes its own island.
		for ( var cq = 0; cq < 4; cq++ ) {
			var qx = ( cq < 2 ? -1 : 1 ) * 29, qz = ( cq % 2 ? 1 : -1 ) * 29;
			b.box( qx, CY, qz, 4.4, 0.16, 4.4, DECK, { tag: S.METAL } );
			// Guard the two outer faces only, leaving the inner corner open.
			P.parapet( b, qx, CY + 0.16, qz + ( qz < 0 ? -2.1 : 2.1 ), 4.4, 1.05, 0.09,
			           "x", U.shade( DECK, 0.72 ), { tag: S.METAL } );
			P.parapet( b, qx + ( qx < 0 ? -2.1 : 2.1 ), CY + 0.16, qz, 4.4, 1.05, 0.09,
			           "z", U.shade( DECK, 0.72 ), { tag: S.METAL } );
		}
		// Two stairs and two ladders up, on opposite corners.
		// Top tread must land on the catwalk deck (z = ∓27.7), so each flight
		// climbs toward its own wall, not away from it.
		P.stairs( b, -24, 0, -24, 3.0, 5.2, 6.4, 14, "-z", DECK, { tag: S.METAL } );
		P.stairs( b, 24, 0, 24, 3.0, 5.2, 6.4, 14, "+z", DECK, { tag: S.METAL } );
		P.ladder( b, -28.4, 0, 20, 5.2, "x", 0x8a9099 );
		P.ladder( b, 28.4, 0, -20, 5.2, "x", 0x8a9099 );
		// A bridge across the middle at catwalk height — the map's power spot.
		P.catwalk( b, 0, CY, 0, 58, 2.2, "z", DECK, { floorY: 0, legs: false } );

		/* --- container blocks: the main cover grid --- */
		var CONT = [ 0xb5563c, 0x3f6f8c, 0x5a8a52, 0xc49a3a, 0x8a4f7a, 0x6d7480 ];
		function block( x, z, yaw, stack ) {
			for ( var i = 0; i < stack; i++ ) {
				P.container( b, x + ( i ? ( rnd() - 0.5 ) * 0.5 : 0 ), i * 2.62, z,
				             U.pick( CONT ), { yaw: yaw + ( i ? ( rnd() - 0.5 ) * 0.06 : 0 ) } );
			}
		}
		block( -18, -12, 0, 2 );
		block( -18, -5.5, 0, 1 );
		block( -11, -14, Math.PI / 2, 1 );
		block( 18, 12, 0, 2 );
		block( 18, 5.5, 0, 1 );
		block( 11, 14, Math.PI / 2, 1 );
		block( -19, 14, 0.06, 2 );
		block( 19, -14, -0.06, 2 );
		block( -6, 22, Math.PI / 2, 1 );
		block( 6, -22, Math.PI / 2, 1 );
		block( -24, 2, Math.PI / 2, 2 );
		block( 24, -2, Math.PI / 2, 2 );

		/* --- racking along two walls --- */
		function rack( x, z, len, axis ) {
			var lvls = 3;
			for ( var lv = 0; lv < lvls; lv++ ) {
				var y = lv * 2.1;
				if ( axis === "x" ) b.box( x, y + 2.0, z, len, 0.14, 1.5, 0x8a6a3c, { tag: S.METAL } );
				else b.box( x, y + 2.0, z, 1.5, 0.14, len, 0x8a6a3c, { tag: S.METAL } );
			}
			var posts = Math.round( len / 3 );
			for ( var p2 = 0; p2 <= posts; p2++ ) {
				var off = -len * 0.5 + ( len / posts ) * p2;
				for ( var sd = -1; sd <= 1; sd += 2 ) {
					var px = axis === "x" ? x + off : x + sd * 0.65;
					var pz = axis === "x" ? z + sd * 0.65 : z + off;
					b.box( px, 0, pz, 0.16, 6.3, 0.16, 0xb06a2a, { tag: S.METAL } );
				}
			}
			// Palletised goods on the shelves.
			for ( var g = 0; g < Math.round( len / 2.6 ); g++ ) {
				var go = -len * 0.5 + 1.3 + g * 2.6;
				var gy = [ 2.14, 4.24 ][ Math.floor( rnd() * 2 ) ];
				var gx = axis === "x" ? x + go : x;
				var gz = axis === "x" ? z : z + go;
				P.crate( b, gx, gy, gz, 1.15, U.jitterHex( 0x9c6b3f, 0.12, rnd ), { plain: true } );
			}
		}
		rack( -28, -12, 20, "z" );
		rack( 28, 12, 20, "z" );

		/* --- floor clutter --- */
		P.forklift( b, -8, 0, 8, 0xd6a12a, { yaw: 0.8 } );
		P.forklift( b, 9, 0, -7, 0xd6a12a, { yaw: -2.1 } );
		for ( var pl = 0; pl < 12; pl++ ) {
			var pa = rnd() * U.TAU, pd = 6 + rnd() * 22;
			P.pallet( b, Math.cos( pa ) * pd, 0, Math.sin( pa ) * pd,
			          0x9a7a52, { yaw: rnd() * 3 } );
		}
		for ( var bl = 0; bl < 10; bl++ ) {
			var ba = rnd() * U.TAU, bd = 8 + rnd() * 20;
			P.barrel( b, Math.cos( ba ) * bd, 0, Math.sin( ba ) * bd,
			          U.pick( [ 0x3f6b4a, 0x8a5c33, 0x4a5a6b ] ) );
		}
		P.generator( b, -26, 0, 26, 0xc9a13c, { yaw: 0.4 } );
		P.generator( b, 26, 0, -26, 0xc9a13c, { yaw: -2.7 } );
		P.dumpster( b, 22, 0, 22, 0x2f6b4f, { yaw: 0.2 } );
		P.dumpster( b, -22, 0, -22, 0x4a5a7a, { yaw: -1.3 } );

		// Pipe runs under the catwalks add vertical interest.
		P.pipeRun( b, 0, 7.4, -31, 60, "x", 0x6a7078 );
		P.pipeRun( b, 0, 8.0, 31, 60, "x", 0x7a6a58 );

		P.pickupPad( b, 0, CY + 0.2, 0, "health" );
		P.pickupPad( b, -24, 0, 12, "ammo" );
		P.pickupPad( b, 24, 0, -12, "ammo" );
	},
	spawns: [
		{ x: -30, y: 0, z: -30, yaw: 2.4 }, { x: -31, y: 0, z: 8, yaw: 1.57 },
		{ x: -28, y: 0, z: 28, yaw: 0.8 },  { x: -4, y: 0, z: 31, yaw: 0 },
		{ x: 30, y: 0, z: 30, yaw: -2.4 },  { x: 31, y: 0, z: -8, yaw: -1.57 },
		{ x: 28, y: 0, z: -28, yaw: -0.8 }, { x: 4, y: 0, z: -31, yaw: 3.14 },
		{ x: -29, y: 5.4, z: 24, yaw: 0.4 }, { x: 29, y: 5.4, z: -24, yaw: -2.7 },
		{ x: -14, y: 0, z: 20, yaw: 0.6 },  { x: 14, y: 0, z: -20, yaw: -2.5 }
	]
};

/* ==================================================================
 * 3. FROST — snowbound research station, mid-range engagements
 * ================================================================== */
MAPS.frost = {
	id: "frost", name: "FROST", subtitle: "Arctic Station",
	sky: { top: 0x8fb4d4, bottom: 0xdfe9f2, fog: 0xd3e0ec, fogNear: 38, fogFar: 130 },
	sun: { color: 0xeaf2ff, intensity: 0.5, pos: [ -45, 68, 40 ],
	       ambSky: 0xcfe2f5, ambGround: 0xb4c4d2, ambInt: 0.7 },
	ambience: { wind: 0.085, windFreq: 620, space: 1.5, wet: 0.22 },
	build: function( b, rnd ) {
		var SNOW = 0xe6edf4, ICE = 0xa9c9dd, WOOD = 0x6a5340, WOOD2 = 0x836a52;
		var ROOF = 0x4a5560, METAL = 0x8d959d, RED = 0x9c4238;
		var half = arena( b, 72, SNOW, 0xd0dae4, 10, S.SNOW );

		/* --- frozen pond in the centre: open, dangerous, fast --- */
		b.box( 0, -0.16, 0, 22, 0.18, 20, ICE, { tag: S.SNOW } );
		b.deco( 0, 0.02, 0, 21, 0.02, 19, 0xbcd8e8 );
		// Cracked slabs.
		for ( var ic = 0; ic < 14; ic++ ) {
			var ia = rnd() * U.TAU, id = rnd() * 9;
			b.deco( Math.cos( ia ) * id, 0.03, Math.sin( ia ) * id * 0.9,
			        1.5 + rnd() * 2.5, 0.02, 1.5 + rnd() * 2.5,
			        U.jitterHex( 0xc9e0ee, 0.05, rnd ), { yaw: rnd() * 3 } );
		}

		/* --- main lodge, north --- */
		P.building( b, -3, 0, -20, 16, 11, 3.4, WOOD, {
			tag: S.WOOD, roof: true, roofColor: ROOF, roofThick: 0.4, eave: 0.9,
			floorTag: S.WOOD, trimColor: WOOD2,
			s: [ { at: 5.0, width: 3.2, sill: 0, head: 2.6 },
			     { at: 11.0, width: 2.4, sill: 1.1, head: 2.5 } ],
			n: [ { at: 3.0, width: 2.4, sill: 1.1, head: 2.5 },
			     { at: 10.5, width: 2.4, sill: 1.1, head: 2.5 } ],
			w: [ { at: 4.0, width: 2.6, sill: 0, head: 2.5 } ],
			e: [ { at: 4.0, width: 2.4, sill: 1.1, head: 2.5 } ]
		} );
		// Snow on the roof, and a usable roof deck.
		b.deco( -3, 3.8, -20, 17, 0.22, 12, 0xf2f7fb );
		P.stairs( b, -12.5, 0, -20, 2.6, 3.8, 4.4, 11, "+x", WOOD2, { tag: S.WOOD } );
		P.parapet( b, -3, 4.0, -25.4, 16, 0.85, 0.3, "x", WOOD2, { tag: S.WOOD } );
		P.parapet( b, -3, 4.0, -14.6, 16, 0.85, 0.3, "x", WOOD2, { tag: S.WOOD } );

		/* --- outbuildings, south --- */
		P.building( b, 14, 0, 19, 11, 9, 3.0, WOOD2, {
			tag: S.WOOD, roof: true, roofColor: ROOF, eave: 0.8,
			n: [ { at: 4.0, width: 3.0, sill: 0, head: 2.4 } ],
			w: [ { at: 3.0, width: 2.4, sill: 1.1, head: 2.4 } ],
			s: [ { at: 4.0, width: 2.4, sill: 1.1, head: 2.4 } ]
		} );
		b.deco( 14, 3.4, 19, 12, 0.22, 10, 0xf2f7fb );
		P.building( b, -18, 0, 17, 9, 8, 2.9, WOOD, {
			tag: S.WOOD, roof: true, roofColor: ROOF, eave: 0.8,
			e: [ { at: 3.0, width: 2.8, sill: 0, head: 2.4 } ],
			n: [ { at: 3.0, width: 2.2, sill: 1.1, head: 2.3 } ]
		} );
		b.deco( -18, 3.3, 17, 10, 0.22, 9, 0xf2f7fb );

		/* --- watchtower: the long-range perch --- */
		var TX = 22, TZ = -18;
		for ( var lg = 0; lg < 4; lg++ ) {
			var lx = TX + ( lg < 2 ? -1 : 1 ) * 1.7;
			var lz = TZ + ( lg % 2 ? 1 : -1 ) * 1.7;
			b.box( lx, 0, lz, 0.3, 6.2, 0.3, WOOD, { tag: S.WOOD } );
		}
		for ( var br = 1; br <= 2; br++ ) {
			b.deco( TX, br * 2.0, TZ, 3.7, 0.16, 3.7, WOOD2 );
		}
		b.box( TX, 6.2, TZ, 5.0, 0.22, 5.0, WOOD2, { tag: S.WOOD } );
		P.parapet( b, TX, 6.42, TZ - 2.3, 5.0, 1.0, 0.22, "x", WOOD, { tag: S.WOOD } );
		P.parapet( b, TX, 6.42, TZ + 2.3, 5.0, 1.0, 0.22, "x", WOOD, { tag: S.WOOD } );
		P.parapet( b, TX - 2.3, 6.42, TZ, 4.6, 1.0, 0.22, "z", WOOD, { tag: S.WOOD } );
		b.deco( TX, 7.6, TZ, 5.4, 0.25, 5.4, ROOF );
		P.ladder( b, TX + 2.4, 0, TZ, 6.2, "x", WOOD );

		/* --- snow berms: the cover that defines the lanes --- */
		function berm( x, z, len, yaw ) {
			var n = Math.round( len / 1.6 );
			for ( var i = 0; i < n; i++ ) {
				var t = ( i / ( n - 1 ) - 0.5 ) * len;
				P.rock( b, x + Math.cos( yaw ) * t, -0.15, z + Math.sin( yaw ) * t,
				        1.1 + rnd() * 0.5, U.jitterHex( 0xeff5fa, 0.03, rnd ),
				        { rnd: rnd, squash: 0.62, tag: S.SNOW } );
			}
		}
		berm( -10, 6, 12, 0.15 );
		berm( 10, -6, 12, 0.15 );
		berm( 4, 15, 10, 1.4 );
		berm( -6, -8, 9, 1.2 );
		berm( 24, 8, 11, 0.9 );
		berm( -24, -8, 11, 0.9 );

		/* --- pines around the perimeter --- */
		for ( var pn = 0; pn < 34; pn++ ) {
			var pa = rnd() * U.TAU;
			var pd = 25 + rnd() * 10;
			var px = Math.cos( pa ) * pd, pz = Math.sin( pa ) * pd;
			if ( Math.abs( px ) > 33 || Math.abs( pz ) > 33 ) continue;
			if ( !clearOfSpawns( MAPS.frost.spawns, px, pz, 4.5 ) ) continue;
			P.pine( b, px, 0, pz, 5.5 + rnd() * 4.5,
			        { rnd: rnd, leafColor: U.jitterHex( 0x2c5138, 0.12, rnd ) } );
		}
		// A few inside the play space for cover.
		var inner = [ [ -14, -4 ], [ 16, 4 ], [ -8, 24 ], [ 8, -24 ], [ 26, 22 ], [ -26, -22 ] ];
		for ( var ip = 0; ip < inner.length; ip++ ) {
			P.pine( b, inner[ ip ][ 0 ], 0, inner[ ip ][ 1 ], 6 + rnd() * 3, { rnd: rnd } );
		}

		/* --- supplies --- */
		P.truck( b, -24, 0, 4, 0x8a9aa8, { yaw: 1.3 } );
		for ( var cr = 0; cr < 9; cr++ ) {
			var ca = rnd() * U.TAU, cd = 9 + rnd() * 18;
			P.crateStack( b, Math.cos( ca ) * cd, 0, Math.sin( ca ) * cd,
			              1 + ( rnd() < 0.4 ? 1 : 0 ), 1.1,
			              U.pick( [ 0x7a6a52, 0x9c6b3f, RED ] ), rnd );
		}
		for ( var bb = 0; bb < 8; bb++ ) {
			var bba = rnd() * U.TAU, bbd = 12 + rnd() * 16;
			P.barrel( b, Math.cos( bba ) * bbd, 0, Math.sin( bba ) * bbd,
			          U.pick( [ RED, 0x4a6b52, METAL ] ) );
		}
		P.antenna( b, -28, 0, -28, 9, METAL );
		P.antenna( b, 28, 0, 28, 8, METAL );

		P.pickupPad( b, 0, 0.06, 0, "health" );
		P.pickupPad( b, -3, 0, -20, "ammo" );
		P.pickupPad( b, 14, 0, 19, "ammo" );
	},
	spawns: [
		{ x: -29, y: 0, z: -29, yaw: 2.4 }, { x: -30, y: 0, z: 6, yaw: 1.57 },
		{ x: -27, y: 0, z: 27, yaw: 0.7 },  { x: -2, y: 0, z: 30, yaw: 0 },
		{ x: 29, y: 0, z: 29, yaw: -2.4 },  { x: 30, y: 0, z: -6, yaw: -1.57 },
		{ x: 27, y: 0, z: -27, yaw: -0.7 }, { x: 2, y: 0, z: -30, yaw: 3.14 },
		{ x: -3, y: 3.9, z: -20, yaw: 1.4 }, { x: 14, y: 0, z: 24, yaw: -1.8 },
		{ x: -18, y: 0, z: 22, yaw: 0.3 },  { x: 20, y: 0, z: -8, yaw: -2.2 }
	]
};

/* ==================================================================
 * 4. TEMPLE — jungle ruins, heavy verticality around a central pyramid
 * ================================================================== */
MAPS.temple = {
	id: "temple", name: "TEMPLE", subtitle: "Jungle Ruins",
	sky: { top: 0x3d6f8f, bottom: 0x9fbf8a, fog: 0x89ab7e, fogNear: 30, fogFar: 110 },
	sun: { color: 0xfff4d8, intensity: 0.56, pos: [ 40, 75, -50 ],
	       ambSky: 0x9fc4a8, ambGround: 0x5a6b48, ambInt: 0.6 },
	ambience: { wind: 0.03, windFreq: 320, hiss: 0.010, space: 1.7, wet: 0.34 },
	build: function( b, rnd ) {
		var STONE = 0x9d9482, STONE2 = 0x877f6e, MOSS = 0x5f7c4a;
		var DIRT = 0x6b5a42, WATER = 0x35707f, GOLD = 0xc9a248;
		var half = arena( b, 72, DIRT, 0x6a6152, 11, S.DIRT );

		// Mossy ground patches.
		for ( var mp = 0; mp < 30; mp++ ) {
			var ma = rnd() * U.TAU, md = rnd() * 32;
			b.deco( Math.cos( ma ) * md, 0.015, Math.sin( ma ) * md,
			        2 + rnd() * 5, 0.02, 2 + rnd() * 5,
			        U.jitterHex( MOSS, 0.16, rnd ), { yaw: rnd() * 3 } );
		}

		/* --- central stepped pyramid --- */
		var TIERS = 4, TIER_H = 1.5, BASE = 22;
		for ( var t = 0; t < TIERS; t++ ) {
			var sz = BASE - t * 4.4;
			b.box( 0, t * TIER_H, 0, sz, TIER_H, sz,
			       U.shade( STONE, 1 - t * 0.035 ), { tag: S.CONCRETE } );
			// Trim course on each tier.
			b.deco( 0, ( t + 1 ) * TIER_H - 0.18, 0, sz + 0.25, 0.2, sz + 0.25,
			        STONE2 );
		}
		// Grand stair up the south face.
		P.stairs( b, 0, 0, BASE * 0.5 - 1.0, 5.0, TIERS * TIER_H, 9.0, 18, "-z",
		          STONE2, { tag: S.CONCRETE } );
		// A narrower stair on the north face for flanking.
		P.stairs( b, 0, 0, -BASE * 0.5 + 1.0, 3.0, TIERS * TIER_H, 8.0, 16, "+z",
		          STONE2, { tag: S.CONCRETE } );

		/* --- summit shrine --- */
		var TOP = TIERS * TIER_H;
		P.idol( b, 0, TOP, 0, 3.0, STONE, { accent: GOLD } );
		for ( var cx = -1; cx <= 1; cx += 2 ) {
			for ( var cz = -1; cz <= 1; cz += 2 ) {
				P.column( b, cx * 4.0, TOP, cz * 4.0, 3.6, 0.36, STONE2 );
			}
		}
		// Lintels between the columns frame the summit without sealing it.
		b.box( 0, TOP + 3.6, -4.0, 8.6, 0.45, 0.7, STONE, { tag: S.CONCRETE } );
		b.box( 0, TOP + 3.6, 4.0, 8.6, 0.45, 0.7, STONE, { tag: S.CONCRETE } );
		P.brazier( b, -3.2, TOP, -3.2 );
		P.brazier( b, 3.2, TOP, 3.2 );
		P.parapet( b, 0, TOP, -5.6, 12, 0.8, 0.4, "x", STONE2 );
		P.parapet( b, 0, TOP, 5.6, 12, 0.8, 0.4, "x", STONE2 );

		/* --- colonnade along the west --- */
		for ( var col = 0; col < 7; col++ ) {
			var cz2 = -21 + col * 7;
			P.column( b, -22, 0, cz2, 5.2, 0.44, STONE, { broken: rnd() < 0.28 } );
			P.column( b, -28, 0, cz2, 5.2, 0.44, STONE, { broken: rnd() < 0.4 } );
		}
		// Surviving roof slabs over part of the colonnade — a covered lane.
		for ( var sl = 0; sl < 3; sl++ ) {
			b.box( -25, 5.2, -14 + sl * 9, 8.0, 0.6, 6.0, STONE2, { tag: S.CONCRETE } );
		}
		// Aligned with the surviving roof slab at z = -14 so the flight
		// actually arrives somewhere.
		P.stairs( b, -18.5, 0, -14, 3.0, 5.8, 5.0, 13, "-x", STONE2 );

		/* --- water channel across the east --- */
		b.box( 24, -0.5, 0, 8, 0.5, 56, 0x2a4a3a, { tag: S.DIRT } );
		b.deco( 24, 0.02, 0, 7.6, 0.04, 55, WATER, { tint: 1.15 } );
		// Stepping platforms so the channel is crossable under fire.
		for ( var st = -2; st <= 2; st++ ) {
			b.box( 24 + ( st % 2 ? 1.8 : -1.8 ), 0, st * 9, 2.6, 0.55, 2.6,
			       STONE2, { tag: S.CONCRETE } );
		}
		// Ruined aqueduct arches over the channel.
		for ( var aq = -1; aq <= 1; aq++ ) {
			var az = aq * 16;
			P.column( b, 20.5, 0, az, 5.0, 0.5, STONE );
			P.column( b, 27.5, 0, az, 5.0, 0.5, STONE );
			b.box( 24, 5.0, az, 9.0, 0.8, 1.4, STONE2, { tag: S.CONCRETE } );
		}

		/* --- outer ruin blocks --- */
		P.building( b, -14, 0, 24, 10, 9, 3.2, STONE2, {
			tag: S.CONCRETE, roof: false, floor: false,
			n: [ { at: 3.5, width: 3.0, sill: 0, head: 2.6 } ],
			e: [ { at: 3.0, width: 3.0, sill: 0, head: 2.6 } ],
			w: [ { at: 3.0, width: 2.4, sill: 1.2, head: 2.5 } ]
		} );
		b.box( -14, 3.2, 24, 11, 0.5, 10, STONE, { tag: S.CONCRETE } );
		// Clear of the roof slab (which starts at x = -8.5); a flight further in
		// would run under its own roof and be unstandable for its last metres.
		P.stairs( b, -6.5, 0, 24, 2.6, 3.7, 4.2, 10, "-x", STONE2 );
		P.parapet( b, -14, 3.7, 19.4, 10, 0.8, 0.35, "x", STONE2 );

		P.building( b, 14, 0, -24, 10, 9, 3.2, STONE2, {
			tag: S.CONCRETE, roof: false, floor: false,
			s: [ { at: 3.5, width: 3.0, sill: 0, head: 2.6 } ],
			w: [ { at: 3.0, width: 3.0, sill: 0, head: 2.6 } ]
		} );
		b.box( 14, 3.2, -24, 11, 0.5, 10, STONE, { tag: S.CONCRETE } );
		P.stairs( b, 6.5, 0, -24, 2.6, 3.7, 4.2, 10, "+x", STONE2 );
		P.parapet( b, 14, 3.7, -19.4, 10, 0.8, 0.35, "x", STONE2 );

		/* --- jungle --- */
		for ( var jt = 0; jt < 30; jt++ ) {
			var ja = rnd() * U.TAU, jd = 26 + rnd() * 9;
			var jx = Math.cos( ja ) * jd, jz = Math.sin( ja ) * jd;
			if ( Math.abs( jx ) > 33 || Math.abs( jz ) > 33 ) continue;
			if ( jx > 19 && jx < 29 ) continue;  // keep the channel clear
			if ( !clearOfSpawns( MAPS.temple.spawns, jx, jz, 4.5 ) ) continue;
			P.jungleTree( b, jx, 0, jz, 8 + rnd() * 5, { rnd: rnd } );
		}
		for ( var bs = 0; bs < 26; bs++ ) {
			var ba2 = rnd() * U.TAU, bd2 = 10 + rnd() * 22;
			P.bush( b, Math.cos( ba2 ) * bd2, 0, Math.sin( ba2 ) * bd2,
			        0.8 + rnd() * 0.7, U.jitterHex( 0x3d6b34, 0.2, rnd ), { rnd: rnd } );
		}
		P.rubble( b, -8, 0, -14, 5, 12, STONE2, rnd );
		P.rubble( b, 9, 0, 15, 5, 12, STONE2, rnd );
		P.rubble( b, 18, 0, -8, 4, 8, STONE2, rnd );

		P.pickupPad( b, 0, TOP, 0, "health" );
		P.pickupPad( b, -25, 0, 0, "ammo" );
		P.pickupPad( b, 14, 3.7, -24, "ammo" );
	},
	spawns: [
		{ x: -29, y: 0, z: -28, yaw: 2.3 }, { x: -25, y: 0, z: 10.5, yaw: 1.57 },
		{ x: -26, y: 0, z: 29, yaw: 0.7 },  { x: 0, y: 0, z: 31, yaw: 0 },
		{ x: 30, y: 0, z: 27, yaw: -2.3 },  { x: 31, y: 0, z: -12, yaw: -1.57 },
		{ x: 27, y: 0, z: -29, yaw: -0.7 }, { x: -2, y: 0, z: -31, yaw: 3.14 },
		{ x: -14, y: 3.8, z: 24, yaw: 1.0 }, { x: 14, y: 3.8, z: -24, yaw: -2.1 },
		{ x: -25, y: 5.9, z: -14, yaw: 0.4 }, { x: 16, y: 0, z: 14, yaw: -2.5 }
	]
};

/* ==================================================================
 * 5. HARBOR — working quay, long water sightlines and container mazes
 * ================================================================== */
MAPS.harbor = {
	id: "harbor", name: "HARBOR", subtitle: "Container Port",
	sky: { top: 0x4a86bd, bottom: 0xc2d8e8, fog: 0xb5cddd, fogNear: 45, fogFar: 150 },
	sun: { color: 0xfff6e6, intensity: 0.58, pos: [ -55, 70, -35 ],
	       ambSky: 0xb0d2f0, ambGround: 0x8a9098, ambInt: 0.56 },
	ambience: { wind: 0.05, windFreq: 380, rumble: 0.028, space: 1.3, wet: 0.2 },
	build: function( b, rnd ) {
		var QUAY = 0x8d918f, QUAY2 = 0x777b79, WATER = 0x2b5f78;
		var STRIPE = 0xd8c445, RUST = 0x9a5636, ORANGE = 0xd4622f;
		var half = arena( b, 74, WATER, 0x5a6470, 9, S.WATER );

		/* --- the quay itself: a raised deck with water on the east --- */
		b.box( -8, 0, 0, 58, 1.6, 74, QUAY, { tag: S.CONCRETE } );
		// Edge kerb + hazard stripe.
		b.deco( 21, 1.6, 0, 0.6, 0.25, 74, STRIPE );
		b.deco( 20.2, 1.6, 0, 1.0, 0.06, 74, QUAY2 );
		// Bollards along the edge.
		for ( var bo = -4; bo <= 4; bo++ ) {
			b.cylinder( 19.6, 1.6, bo * 8, 0.28, 0.75, 8, 0x3a3f44,
			            { tag: S.METAL, rTop: 0.34 } );
		}
		// Water surface + a couple of moored hulls.
		b.deco( 28, 0.55, 0, 22, 0.06, 74, U.shade( WATER, 1.25 ), { tint: 1.1 } );

		/* --- moored barge, reachable by a gangway: an isolated flank --- */
		b.box( 30, 0.5, -6, 15, 1.9, 22, 0x4a5560, { tag: S.METAL } );
		b.box( 30, 2.4, -6, 15.4, 0.35, 22.4, 0x5a6570, { tag: S.METAL } );
		P.parapet( b, 30, 2.75, -17.0, 15.4, 0.9, 0.3, "x", 0x6a7580, { tag: S.METAL } );
		P.parapet( b, 30, 2.75, 5.0, 15.4, 0.9, 0.3, "x", 0x6a7580, { tag: S.METAL } );
		P.parapet( b, 37.5, 2.75, -6, 22.0, 0.9, 0.3, "z", 0x6a7580, { tag: S.METAL } );
		// Deckhouse.
		P.building( b, 34, 2.75, -13, 6, 6, 2.8, 0xc4cad0, {
			tag: S.METAL, roof: true, roofColor: 0x6a7580,
			s: [ { at: 2.0, width: 2.0, sill: 0, head: 2.3 } ],
			w: [ { at: 2.0, width: 2.2, sill: 1.0, head: 2.2 } ]
		} );
		// Gangway from the quay. Kept 3m wide: a 2m deck with 0.12m rails
		// leaves under 1.8m of walkable width, which reads as a tightrope and
		// is barely wider than the player.
		b.box( 24.5, 2.2, -2, 9, 0.22, 3.0, 0x8a9098, { tag: S.METAL } );
		P.parapet( b, 24.5, 2.42, -3.5, 9, 0.85, 0.12, "x", 0x6a7580, { tag: S.METAL } );
		P.parapet( b, 24.5, 2.42, -0.5, 9, 0.85, 0.12, "x", 0x6a7580, { tag: S.METAL } );
		P.stairs( b, 20.0, 1.6, -2, 3.0, 0.7, 1.6, 4, "+x", 0x8a9098, { tag: S.METAL } );

		/* --- container stacks: the core of the layout --- */
		var CONT = [ 0xb5563c, 0x3f6f8c, 0x5a8a52, 0xc49a3a, 0x8a4f7a, 0x6d7480, 0xa8683a ];
		function stack( x, z, yaw, h ) {
			for ( var i = 0; i < h; i++ ) {
				P.container( b, x, 1.6 + i * 2.62, z, U.pick( CONT ),
				             { yaw: yaw + ( i ? ( rnd() - 0.5 ) * 0.05 : 0 ) } );
			}
		}
		// A rough grid with deliberate gaps forming lanes.
		stack( -30, -26, 0, 3 ); stack( -30, -19, 0, 2 );
		stack( -22, -26, 0, 2 ); stack( -22, -19, 0, 3 );
		stack( -30, 18, 0, 2 );  stack( -30, 25, 0, 3 );
		stack( -22, 18, 0, 3 );  stack( -22, 25, 0, 2 );
		stack( -6, -28, Math.PI / 2, 2 );
		stack( -6, 28, Math.PI / 2, 2 );
		stack( 8, -22, 0, 2 );   stack( 8, 22, 0, 2 );
		stack( -14, -8, Math.PI / 2, 3 );
		stack( -14, 8, Math.PI / 2, 3 );
		stack( 2, 0, 0, 1 );
		stack( 10, -6, Math.PI / 2, 2 );
		stack( 10, 6, Math.PI / 2, 2 );
		// A walkable container bridge across the central lane.
		P.container( b, -14, 1.6 + 3 * 2.62, 0, 0x4a5560, { yaw: Math.PI / 2, len: 12.2 } );

		/* --- gantry crane straddling the quay --- */
		P.crane( b, -4, 1.6, -14, 14, 26, ORANGE, { yaw: 0 } );
		P.crane( b, -4, 1.6, 16, 12, 22, ORANGE, { yaw: Math.PI } );

		/* --- warehouse on the west --- */
		P.building( b, -30, 1.6, 0, 14, 22, 5.0, 0xb8bcc0, {
			tag: S.METAL, roof: true, roofColor: 0x8a9098, thick: 0.4,
			e: [ { at: 4.0, width: 4.0, sill: 0, head: 4.0 },
			     { at: 14.0, width: 4.0, sill: 0, head: 4.0 } ],
			n: [ { at: 5.0, width: 4.0, sill: 0, head: 3.6 } ],
			s: [ { at: 5.0, width: 4.0, sill: 0, head: 3.6 } ],
			w: [ { at: 6.0, width: 3.0, sill: 2.5, head: 4.2 } ]
		} );
		// Roof access + a firing position over the container yard. The flight
		// sits outside the footprint (east wall is x = -23) and climbs onto it.
		P.stairs( b, -20.5, 1.6, 9, 2.6, 5.4, 5.0, 13, "-x", 0x9aa0a6, { tag: S.METAL } );
		P.parapet( b, -30, 6.9, -10.6, 14, 0.9, 0.3, "x", 0x9aa0a6, { tag: S.METAL } );
		P.parapet( b, -30, 6.9, 10.6, 14, 0.9, 0.3, "x", 0x9aa0a6, { tag: S.METAL } );
		P.parapet( b, -36.6, 6.9, 0, 21.4, 0.9, 0.3, "z", 0x9aa0a6, { tag: S.METAL } );
		P.acUnit( b, -33, 6.9, -6, 0x9aa1a8, {} );
		P.acUnit( b, -33, 6.9, 5, 0x9aa1a8, { yaw: 0.3 } );

		/* --- yard clutter --- */
		P.truck( b, -12, 1.6, -18, 0x4a6b8a, { yaw: 1.5 } );
		P.truck( b, 4, 1.6, 14, 0x8a5a4a, { yaw: -0.4, cargo: false } );
		P.forklift( b, -18, 1.6, -2, 0xd6a12a, { yaw: 2.4 } );
		P.forklift( b, 6, 1.6, -12, 0xd6a12a, { yaw: 0.3 } );
		for ( var cl = 0; cl < 16; cl++ ) {
			var ca = rnd() * U.TAU, cd = 6 + rnd() * 22;
			var cx2 = -8 + Math.cos( ca ) * cd, cz2 = Math.sin( ca ) * cd;
			if ( cx2 > 19 || cx2 < -35 ) continue;
			if ( rnd() < 0.5 ) P.barrel( b, cx2, 1.6, cz2, U.pick( [ RUST, 0x3f6b4a, 0x4a5a6b ] ) );
			else P.crateStack( b, cx2, 1.6, cz2, 1 + ( rnd() < 0.4 ? 1 : 0 ), 1.15, 0x9c6b3f, rnd );
		}
		for ( var pa2 = 0; pa2 < 10; pa2++ ) {
			P.pallet( b, -30 + rnd() * 44, 1.6, -30 + rnd() * 60, 0x9a7a52, { yaw: rnd() * 3 } );
		}
		P.fence( b, -8, 1.6, -35.5, 50, 2.4, "x", 0x6f7780 );
		P.fence( b, -8, 1.6, 35.5, 50, 2.4, "x", 0x6f7780 );
		P.streetLight( b, -20, 1.6, -30, 6.5, 0x565c63, { dir: 1.57 } );
		P.streetLight( b, -20, 1.6, 30, 6.5, 0x565c63, { dir: -1.57 } );
		P.streetLight( b, 12, 1.6, 0, 6.5, 0x565c63, { dir: 3.14 } );

		P.pickupPad( b, -14, 1.6 + 3 * 2.62 + 2.62, 0, "health" );
		P.pickupPad( b, -30, 6.9, 0, "ammo" );
		P.pickupPad( b, 30, 2.75, -6, "ammo" );
	},
	spawns: [
		{ x: -34, y: 1.7, z: -32, yaw: 2.2 }, { x: -34, y: 1.7, z: 32, yaw: 0.9 },
		{ x: -2, y: 1.7, z: -33, yaw: 3.0 },  { x: -2, y: 1.7, z: 33, yaw: 0.1 },
		{ x: 16, y: 1.7, z: -30, yaw: -2.6 }, { x: 16, y: 1.7, z: 30, yaw: -0.4 },
		{ x: 14, y: 1.7, z: 0, yaw: 3.14 },   { x: -34, y: 1.7, z: 0, yaw: 0 },
		{ x: -30, y: 7.0, z: 6, yaw: -1.2 },  { x: 30, y: 2.9, z: -6, yaw: 2.6 },
		{ x: -18, y: 1.7, z: -30, yaw: 1.2 }, { x: -18, y: 1.7, z: 30, yaw: -1.2 }
	]
};

/* ==================================================================
 * 6. ROOFTOP — night city, split levels connected by planks and walkways
 * ================================================================== */
MAPS.rooftop = {
	id: "rooftop", name: "ROOFTOP", subtitle: "Night District",
	sky: { top: 0x101733, bottom: 0x3a2c56, fog: 0x272c45, fogNear: 34, fogFar: 125 },
	sun: { color: 0xa8c0e8, intensity: 0.46, pos: [ -40, 60, -30 ],
	       ambSky: 0x5a6d99, ambGround: 0x3b3450, ambInt: 0.80 },
	ambience: { rumble: 0.055, rumbleFreq: 58, wind: 0.045, windFreq: 700,
	            space: 1.0, wet: 0.14 },
	build: function( b, rnd ) {
		var DECK = 0x5c636e, DECK2 = 0x6b7480, WALL = 0x474e59;
		var TRIM = 0x7d8794, NEON_A = 0xff3d7a, NEON_B = 0x2ee6d6, NEON_C = 0xffb03a;
		/* No ground plane and no perimeter wall on this one: the roof slabs are
		 * the only floor, the gaps between them are real drops, and going over
		 * a parapet kills you. arena() would fill the voids in solid. */

		/* Roof block helper: a slab with a parapet around the edge.
		 *
		 * `gaps` opens the parapet where a ramp, plank or stair arrives —
		 * without them the ring wall seals each roof off completely and the
		 * whole map becomes five disconnected islands. Each gap is
		 * { side: "n"|"s"|"w"|"e", at, width } where `at` is a world
		 * coordinate along that edge (x for n/s, z for w/e). */
		function roof( x, z, w, d, y, color, gaps ) {
			b.box( x, y - 0.8, z, w, 0.8, d, color || DECK, { tag: S.CONCRETE } );
			// Facade below, so the block reads as a building from a distance.
			b.box( x, y - 12, z, w - 0.6, 11.2, d - 0.6, U.shade( color || DECK, 0.55 ),
			       { tag: S.CONCRETE, collide: false } );

			// Convert world-space gaps into per-side openings measured from
			// each wall run's start.
			function openings( side, len, origin ) {
				var out = [];
				for ( var i = 0; gaps && i < gaps.length; i++ ) {
					var g = gaps[ i ];
					if ( g.side !== side ) continue;
					out.push( { at: ( g.at - g.width * 0.5 ) - origin, width: g.width } );
				}
				return out;
			}
			var opt = { capColor: TRIM, trim: false, tag: S.CONCRETE };
			function side( px, pz, len, axis, sideKey, origin ) {
				P.parapet( b, px, y, pz, len, 1.0, 0.4, axis, WALL, {
					capColor: TRIM, trim: false,
					openings: openings( sideKey, len, origin )
				} );
			}
			side( x, z - d * 0.5 + 0.2, w, "x", "n", x - w * 0.5 );
			side( x, z + d * 0.5 - 0.2, w, "x", "s", x - w * 0.5 );
			side( x - w * 0.5 + 0.2, z, d - 0.8, "z", "w", z - ( d - 0.8 ) * 0.5 );
			side( x + w * 0.5 - 0.2, z, d - 0.8, "z", "e", z - ( d - 0.8 ) * 0.5 );
		}

		/* --- five roof blocks at three heights ---
		 * Extents are written out because every bridge, ramp and stair below
		 * is derived from these edges rather than eyeballed. */
		var NW = { x: -20, z: -18, w: 26, d: 26, y: 0.0 };   // x[-33,-7]  z[-31,-5]
		var NE = { x: 19, z: -20, w: 24, d: 22, y: 2.4 };    // x[  7,31]  z[-31,-9]
		var SW = { x: -21, z: 20, w: 24, d: 24, y: 2.4 };    // x[-33,-9]  z[  8,32]
		var SE = { x: 20, z: 20, w: 26, d: 24, y: 0.0 };     // x[  7,33]  z[  8,32]
		var TW = { x: 0, z: 0, w: 18, d: 18, y: 6.0 };       // x[ -9, 9]  z[ -9, 9]
		/* Parapet gaps, one per arriving connection. Coordinates are the world
		 * position along that edge — see the connection list below. */
		roof( NW.x, NW.z, NW.w, NW.d, NW.y, DECK, [
			{ side: "e", at: -20, width: 3.4 },     // ramp to NE
			{ side: "s", at: -21, width: 3.4 }      // ramp to SW
		] );
		roof( NE.x, NE.z, NE.w, NE.d, NE.y, DECK2, [
			{ side: "w", at: -20, width: 3.4 },     // ramp from NW
			{ side: "s", at: 21, width: 3.4 }       // ramp to SE
		] );
		roof( SW.x, SW.z, SW.w, SW.d, SW.y, DECK2, [
			{ side: "n", at: -21, width: 3.4 },     // ramp from NW
			{ side: "e", at: 20, width: 3.4 }       // ramp to SE
		] );
		roof( SE.x, SE.z, SE.w, SE.d, SE.y, DECK, [
			{ side: "w", at: 20, width: 3.4 },      // ramp from SW
			{ side: "n", at: 21, width: 3.4 },      // ramp from NE
			{ side: "n", at: 8, width: 3.6 }        // stairs to tower
		] );
		roof( TW.x, TW.z, TW.w, TW.d, TW.y, 0x474d57, [
			{ side: "w", at: -7, width: 3.6 },      // stairs from NW
			{ side: "w", at: 8.5, width: 2.4 },     // ladder from SW
			{ side: "s", at: 8, width: 3.6 },       // stairs from SE
			{ side: "n", at: -8, width: 2.4 },      // ladder from NW
			{ side: "n", at: 8, width: 2.4 }        // ladder from NE
		] );

		/* --- ring connections ---
		 * Each gap between two outer roofs is spanned by a ramp when the two
		 * differ in height, and a plank when they match. Ramps are wedges so
		 * the 2.4m step is walkable without jumping. */
		// NW (y0, x<=-7) -> NE (y2.4, x>=7) across z = -20.
		b.wedge( 0, 0, -20, 14, 2.4, 2.6, "+x", 0x5a616b, { tag: S.METAL } );
		// SW (y2.4, x<=-9) -> SE (y0, x>=7) across z = 20.
		b.wedge( -1, 0, 20, 16, 2.4, 2.6, "-x", 0x5a616b, { tag: S.METAL } );
		// NW (y0, z<=-5) -> SW (y2.4, z>=8) across x = -21.
		b.wedge( -21, 0, 1.5, 2.6, 2.4, 13, "+z", 0x5a616b, { tag: S.METAL } );
		// NE (y2.4, z<=-9) -> SE (y0, z>=8) across x = 21.
		b.wedge( 21, 0, -0.5, 2.6, 2.4, 17, "-z", 0x5a616b, { tag: S.METAL } );

		/* --- access to the centre tower ---
		 * Each flight starts on solid deck and finishes exactly on a tower
		 * edge; each ladder stands on the roof directly outside a tower face. */
		P.stairs( b, -12.25, NW.y, -7, 2.8, 6.0, 6.5, 15, "+x", DECK2 );  // NW -> x = -9
		P.stairs( b, 8, SE.y, 12.25, 2.8, 6.0, 6.5, 15, "-z", DECK2 );    // SE -> z =  9
		P.ladder( b, -8.0, NW.y, -9.6, 6.0, "x", 0x6a7078 );              // NW -> tower
		P.ladder( b, 8.0, NE.y, -9.6, 3.6, "x", 0x6a7078 );               // NE -> tower
		P.ladder( b, -9.6, SW.y, 8.5, 3.6, "z", 0x6a7078 );               // SW -> tower

		/* --- stair housings and roof clutter --- */
		function housing( x, z, y, yaw ) {
			P.building( b, x, y, z, 4.4, 4.0, 2.6, 0x454b55, {
				tag: S.CONCRETE, roof: true, roofColor: 0x363b43,
				s: [ { at: 1.3, width: 1.8, sill: 0, head: 2.2 } ]
			} );
			b.deco( x, y + 2.9, z, 1.2, 0.5, 1.2, 0x2a2e34 );
		}
		housing( -26, -24, NW.y );
		housing( 24, -26, NE.y );
		housing( -28, 26, SW.y );
		housing( 26, 26, SE.y );

		var clutter = [
			[ -14, -22, NW.y ], [ -24, -12, NW.y ], [ -12, -12, NW.y ], [ -30, -20, NW.y ],
			[ 22, -14, NE.y ], [ 12, -25, NE.y ], [ 28, -22, NE.y ],
			[ -16, 14, SW.y ], [ -27, 16, SW.y ], [ -18, 27, SW.y ],
			[ 14, 14, SE.y ], [ 26, 16, SE.y ], [ 16, 27, SE.y ], [ 30, 24, SE.y ]
		];
		for ( var i = 0; i < clutter.length; i++ ) {
			var cx = clutter[ i ][ 0 ], cz = clutter[ i ][ 1 ], cy = clutter[ i ][ 2 ];
			var pick = rnd();
			if ( pick < 0.45 ) P.acUnit( b, cx, cy, cz, 0x6a7078, { yaw: rnd() * 3 } );
			else if ( pick < 0.62 ) P.dumpster( b, cx, cy, cz, 0x3a4a5a, { yaw: rnd() * 3 } );
			else if ( pick < 0.80 ) P.crateStack( b, cx, cy, cz, 2, 1.1, 0x5a4a3a, rnd );
			else {
				b.box( cx, cy, cz, 2.4, 1.9, 1.6, 0x4a5058, { tag: S.METAL, yaw: rnd() } );
				b.deco( cx, cy + 1.9, cz, 1.0, 0.7, 1.0, 0x3a4046 );
			}
		}
		// Water tanks — tall cover on the low roofs.
		for ( var wt = 0; wt < 3; wt++ ) {
			var wx = [ -22, 22, -8 ][ wt ], wz = [ -26, 28, -26 ][ wt ];
			var wy = [ 0, 0, 0 ][ wt ];
			for ( var lg2 = 0; lg2 < 4; lg2++ ) {
				b.box( wx + ( lg2 < 2 ? -1 : 1 ) * 1.1, wy, wz + ( lg2 % 2 ? 1 : -1 ) * 1.1,
				       0.18, 1.6, 0.18, 0x4a4038, { tag: S.WOOD } );
			}
			b.cylinder( wx, wy + 1.6, wz, 1.5, 2.4, 10, 0x6a5a48, { tag: S.WOOD } );
			b.cone( wx, wy + 4.0, wz, 1.6, 0.8, 10, 0x4a4038, { collide: false } );
		}

		/* --- skyline and signage --- */
		P.billboard( b, -5, TW.y, -7, 9, 4.0, 2.2, NEON_A, { yaw: 0 } );
		P.billboard( b, 6, TW.y, 7, 8, 3.6, 2.2, NEON_B, { yaw: Math.PI } );
		P.billboard( b, -30, SW.y, 14, 7, 3.2, 2.4, NEON_C, { yaw: Math.PI / 2 } );
		P.antenna( b, 6, TW.y, -6, 11, 0x5a616b );
		P.antenna( b, -28, NW.y, -28, 8, 0x4a5058 );
		P.antenna( b, 28, NE.y, -28, 7, 0x4a5058 );
		var lights = [
			[ -20, -8, NW.y ], [ 18, -13, NE.y ], [ -22, 13, SW.y ],
			[ 20, 13, SE.y ], [ -6, 5, TW.y ]
		];
		for ( var sl2 = 0; sl2 < lights.length; sl2++ ) {
			P.streetLight( b, lights[ sl2 ][ 0 ], lights[ sl2 ][ 2 ], lights[ sl2 ][ 1 ],
			               4.2, 0x3a4046,
			               { dir: rnd() * 6.28, lampColor: 0xfff0c0 } );
		}
		// Distant skyline: non-colliding towers beyond the play space.
		for ( var sk = 0; sk < 26; sk++ ) {
			var ka = ( sk / 26 ) * U.TAU + rnd() * 0.1;
			var kd = 46 + rnd() * 30;
			var kh = 14 + rnd() * 40;
			var kx = Math.cos( ka ) * kd, kz = Math.sin( ka ) * kd;
			b.box( kx, -22, kz, 6 + rnd() * 8, kh, 6 + rnd() * 8,
			       U.jitterHex( 0x1b1f2b, 0.3, rnd ), { collide: false, yaw: rnd() } );
			// Lit windows.
			for ( var wq = 0; wq < 5; wq++ ) {
				b.deco( kx + ( rnd() - 0.5 ) * 6, -22 + rnd() * kh, kz + ( rnd() - 0.5 ) * 6,
				        0.7, 0.5, 7, U.pick( [ 0xffe9a8, 0x9fd8ff, 0xffb87a ] ),
				        { tint: 1.4 } );
			}
		}

		P.pickupPad( b, 0, TW.y, 0, "health" );
		P.pickupPad( b, -20, NW.y, -18, "ammo" );
		P.pickupPad( b, 20, SE.y, 20, "ammo" );
	},
	spawns: [
		{ x: -28, y: 0.0, z: -14, yaw: 1.4 }, { x: -14, y: 0.0, z: -27, yaw: 2.8 },
		{ x: 24, y: 2.4, z: -14, yaw: -1.4 }, { x: 12, y: 2.4, z: -27, yaw: 3.0 },
		{ x: -28, y: 2.4, z: 14, yaw: 0.4 },  { x: -14, y: 2.4, z: 28, yaw: 0.2 },
		{ x: 28, y: 0.0, z: 14, yaw: -1.8 },  { x: 14, y: 0.0, z: 28, yaw: -0.2 },
		{ x: 0, y: 6.0, z: -6, yaw: 3.14 },   { x: 0, y: 6.0, z: 6, yaw: 0 },
		{ x: -20, y: 0.0, z: -26, yaw: 0.8 }, { x: 20, y: 0.0, z: 26, yaw: -2.4 }
	]
};

DE.MAPS = MAPS;
DE.MAP_ORDER = [ "dune", "depot", "frost", "temple", "harbor", "rooftop" ];

/* Build a map: run its emitter, hand back the mesh, colliders and metadata. */
DE.buildMap = function( id, seed ) {
	var def = MAPS[ id ];
	if ( !def ) throw new Error( "unknown map: " + id );
	var rnd = U.rng( seed === undefined ? 1337 : seed );
	var b = new DE.Builder();
	def.build( b, rnd );
	return {
		def: def,
		// Half-extent of the playable box; rooftop has no perimeter wall and
		// leaves this undefined, so navigation falls back to the mesh bounds.
		play: b.playHalf,
		mesh: b.toMesh(),
		colliders: b.colliders,
		pickups: b.pickups || [],
		ladders: b.ladders || [],
		bounds: b.bounds,
		triangles: b.triangleCount()
	};
};

} )( window );
