/* DEADEYE — navigation
 *
 * Maps don't hand-author waypoints. Instead the finished collision world is
 * sampled on a grid: at every cell the column is probed downward, each surface
 * found is tested for standing clearance, and the survivors become nodes.
 * Nodes are then linked where a player could actually walk (or drop) between
 * them.
 *
 * The result is a graph that adapts automatically when a map changes, and a
 * connectivity check that catches stairs leading nowhere.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

var SPACING = 1.6;          // grid pitch — must resolve a 2-3m walkway
var CLEAR_R = 0.44;         // slightly wider than the player, for margin
var CLEAR_H = 1.85;
var LINK_DIST = 2.6;        // max horizontal link length (covers a diagonal)
var STEP_UP = 0.60;         // matches the controller's step-up assist
var DROP_MAX = 5.5;         // a one-way drop this deep is still survivable
var MAX_SURFACES = 6;       // levels probed per column
/* Slope sampling pitch. Must be well under the tread depth of the shallowest
 * staircase in any map (~0.40m) — at a comparable pitch, consecutive probes
 * can land two treads apart and report an unclimbable 0.69m rise, which
 * silently disconnects every staircase in the game. */
var WALK_STEP = 0.12;

/* Can a player stand on the surface at (x, surfY, z)?
 *
 * A naive full-height, full-radius cylinder test fails on every staircase: a
 * player standing on one tread always overlaps the next riser, which is
 * exactly the case the controller's step-up assist exists to handle. So the
 * body probe skips the bottom 0.45m — where treads and ramp lips intrude —
 * and uses a slightly narrower radius, then headroom is checked separately.
 * That still rejects walls and crawlspaces while accepting slopes. */
function standable( world, x, surfY, z ) {
	if ( world.overlaps( x, surfY + 0.45, z, 0.34, 1.42 ) ) return false;
	var up = world.raycast( x, surfY + 0.08, z, 0, 1, 0, CLEAR_H + 0.2 );
	return !up.hit || up.dist >= CLEAR_H - 0.1;
}

function NavGraph() {
	this.nodes = [];
	this.links = [];        // parallel array of arrays of node indices
	this.grid = new Map();  // spatial hash for nearest-node queries
	this.cell = 4;
}

NavGraph.prototype._key = function( ix, iz ) { return ix * 73856093 ^ iz * 19349663; };

NavGraph.prototype.build = function( world, bounds, opts ) {
	opts = opts || {};
	var minX = Math.max( bounds.minX, opts.minX === undefined ? -1e9 : opts.minX );
	var maxX = Math.min( bounds.maxX, opts.maxX === undefined ? 1e9 : opts.maxX );
	var minZ = Math.max( bounds.minZ, opts.minZ === undefined ? -1e9 : opts.minZ );
	var maxZ = Math.min( bounds.maxZ, opts.maxZ === undefined ? 1e9 : opts.maxZ );
	var topY = bounds.maxY + 4;
	var floorY = bounds.minY - 2;

	var nodes = this.nodes = [];

	for ( var x = minX + SPACING * 0.5; x <= maxX; x += SPACING ) {
		for ( var z = minZ + SPACING * 0.5; z <= maxZ; z += SPACING ) {
			var y = topY;
			for ( var s = 0; s < MAX_SURFACES; s++ ) {
				var hit = world.raycast( x, y, z, 0, -1, 0, y - floorY );
				if ( !hit.hit ) break;
				var surfY = hit.y;
				// Only upward-facing surfaces are standable, and never an
				// invisible clip volume — the map's ceiling cap would otherwise
				// grow a phantom floor across the whole level.
				if ( hit.ny > 0.5 && hit.tag !== DE.SURFACE.CLIP &&
				     standable( world, x, surfY, z ) ) {
					nodes.push( { x: x, y: surfY, z: z, tag: hit.tag,
					              open: 0, cover: 0, height: 0 } );
				}
				// Continue probing below this surface.
				y = surfY - 0.35;
				if ( y <= floorY ) break;
			}
		}
	}

	this._link( world );
	this._index();
	this._annotate( world );
	return this;
};

/* Walk the floor from node a to node b in small increments, requiring that
 * each successive surface is within one step-up and never disappears. This is
 * what lets a stair flight or a ramp form links despite its endpoints being
 * well over STEP_UP apart. */
function traceWalk( world, a, b ) {
	var dx = b.x - a.x, dz = b.z - a.z;
	var hd = Math.sqrt( dx * dx + dz * dz );
	var steps = Math.max( 2, Math.ceil( hd / WALK_STEP ) );
	var prevY = a.y;
	for ( var i = 1; i <= steps; i++ ) {
		var t = i / steps;
		var px = a.x + dx * t, pz = a.z + dz * t;
		// Probe from just above the highest point we could step onto.
		var top = prevY + STEP_UP + 0.05;
		var hit = world.raycast( px, top, pz, 0, -1, 0, STEP_UP + DROP_MAX + 0.1 );
		if ( !hit.hit || hit.ny < 0.5 ) return false;     // gap or a wall face
		var rise = hit.y - prevY;
		if ( rise > STEP_UP + 0.001 ) return false;       // too tall to climb
		if ( rise < -DROP_MAX ) return false;
		prevY = hit.y;
	}
	// Must actually arrive at the target surface.
	return Math.abs( prevY - b.y ) < 0.45;
}

NavGraph.prototype._link = function( world ) {
	var nodes = this.nodes;
	var n = nodes.length;
	this.links = new Array( n );

	// Bucket nodes by XZ cell so linking is not O(n^2).
	var buckets = new Map();
	var cell = LINK_DIST;
	var self = this;
	function key( ix, iz ) { return ix * 73856093 ^ iz * 19349663; }
	for ( var i = 0; i < n; i++ ) {
		var k = key( Math.floor( nodes[ i ].x / cell ), Math.floor( nodes[ i ].z / cell ) );
		var bk = buckets.get( k );
		if ( !bk ) { bk = []; buckets.set( k, bk ); }
		bk.push( i );
	}

	for ( var a = 0; a < n; a++ ) {
		var na = nodes[ a ];
		var out = [];
		var cx = Math.floor( na.x / cell ), cz = Math.floor( na.z / cell );
		for ( var ox = -1; ox <= 1; ox++ ) {
			for ( var oz = -1; oz <= 1; oz++ ) {
				var bucket = buckets.get( key( cx + ox, cz + oz ) );
				if ( !bucket ) continue;
				for ( var bi = 0; bi < bucket.length; bi++ ) {
					var bIdx = bucket[ bi ];
					if ( bIdx === a ) continue;
					var nb = nodes[ bIdx ];
					var dx = nb.x - na.x, dz = nb.z - na.z;
					var hd = Math.sqrt( dx * dx + dz * dz );
					if ( hd > LINK_DIST || hd < 0.01 ) continue;
					var dy = nb.y - na.y;
					if ( dy < -DROP_MAX ) continue;

					if ( dy <= STEP_UP ) {
						// Flat or a single step. Two cheap visibility probes
						// settle the common case.
						var ay = na.y + 0.95, by = nb.y + 0.95;
						if ( !world.lineOfSight( na.x, ay, na.z, nb.x, by, nb.z ) ||
						     !world.lineOfSight( na.x, na.y + 0.35, na.z,
						                         nb.x, nb.y + 0.35, nb.z ) ) {
							// The low probe also clips things the player simply
							// steps over — a stair nosing, a roof edge, the lip
							// where a flight meets a deck. Fall back to walking
							// the surface, which models that correctly.
							if ( !traceWalk( world, na, nb ) ) continue;
						}
					} else {
						// A climb steeper than one step. Stairs and ramps are
						// legitimately walkable here even though the endpoints
						// differ by more than STEP_UP, so trace the surface and
						// require every individual rise to be climbable.
						if ( !traceWalk( world, na, nb ) ) continue;
					}
					out.push( bIdx );
				}
			}
		}
		this.links[ a ] = out;
	}
};

NavGraph.prototype._index = function() {
	this.grid.clear();
	for ( var i = 0; i < this.nodes.length; i++ ) {
		var nd = this.nodes[ i ];
		var k = this._key( Math.floor( nd.x / this.cell ), Math.floor( nd.z / this.cell ) );
		var bk = this.grid.get( k );
		if ( !bk ) { bk = []; this.grid.set( k, bk ); }
		bk.push( i );
	}
};

/* Score each node for how exposed it is and how much headroom it has. Bots use
 * `cover` to pick where to retreat to and `open` to avoid hugging walls. */
NavGraph.prototype._annotate = function( world ) {
	var DIRS = 8;
	for ( var i = 0; i < this.nodes.length; i++ ) {
		var nd = this.nodes[ i ];
		var openSum = 0;
		for ( var d = 0; d < DIRS; d++ ) {
			var a = ( d / DIRS ) * U.TAU;
			var h = world.raycast( nd.x, nd.y + 1.2, nd.z, Math.cos( a ), 0, Math.sin( a ), 18 );
			openSum += h.hit ? h.dist : 18;
		}
		nd.open = openSum / ( DIRS * 18 );      // 0 = boxed in, 1 = wide open
		nd.cover = 1 - nd.open;
		// Headroom above, used to prefer nodes you can stand and jump in.
		var up = world.raycast( nd.x, nd.y + 0.1, nd.z, 0, 1, 0, 6 );
		nd.height = up.hit ? up.dist : 6;
	}
};

/* Nearest node to a world position, preferring ones at a similar height. */
NavGraph.prototype.nearest = function( x, y, z, maxDist ) {
	maxDist = maxDist || 8;
	var best = -1, bestScore = Infinity;
	var r = Math.ceil( maxDist / this.cell );
	var cx = Math.floor( x / this.cell ), cz = Math.floor( z / this.cell );
	for ( var ox = -r; ox <= r; ox++ ) {
		for ( var oz = -r; oz <= r; oz++ ) {
			var bucket = this.grid.get( this._key( cx + ox, cz + oz ) );
			if ( !bucket ) continue;
			for ( var i = 0; i < bucket.length; i++ ) {
				var nd = this.nodes[ bucket[ i ] ];
				var dx = nd.x - x, dy = nd.y - y, dz = nd.z - z;
				// Weight vertical distance heavily so a node on the floor below
				// is never picked over one on the catwalk you're standing on.
				var score = dx * dx + dz * dz + dy * dy * 9;
				if ( score < bestScore ) { bestScore = score; best = bucket[ i ]; }
			}
		}
	}
	return bestScore <= maxDist * maxDist * 4 ? best : -1;
};

/* A* over the link graph. Returns an array of node indices, or null. */
NavGraph.prototype.path = function( startIdx, goalIdx, maxNodes ) {
	if ( startIdx < 0 || goalIdx < 0 ) return null;
	if ( startIdx === goalIdx ) return [ startIdx ];
	var nodes = this.nodes, links = this.links;
	var n = nodes.length;
	maxNodes = maxNodes || 4000;

	if ( !this._g || this._g.length !== n ) {
		this._g = new Float32Array( n );
		this._f = new Float32Array( n );
		this._from = new Int32Array( n );
		this._state = new Uint8Array( n );
		this._stamp = new Int32Array( n );
		this._gen = 0;
	}
	var g = this._g, f = this._f, from = this._from, state = this._state;
	var stamp = this._stamp, gen = ++this._gen;

	var goal = nodes[ goalIdx ];
	function h( i ) {
		var d = nodes[ i ];
		var dx = d.x - goal.x, dy = d.y - goal.y, dz = d.z - goal.z;
		return Math.sqrt( dx * dx + dy * dy + dz * dz );
	}

	// Binary heap keyed on f.
	var heap = this._heap || ( this._heap = [] );
	heap.length = 0;
	function push( i ) {
		heap.push( i );
		var c = heap.length - 1;
		while ( c > 0 ) {
			var p = ( c - 1 ) >> 1;
			if ( f[ heap[ p ] ] <= f[ heap[ c ] ] ) break;
			var t = heap[ p ]; heap[ p ] = heap[ c ]; heap[ c ] = t;
			c = p;
		}
	}
	function pop() {
		var top = heap[ 0 ];
		var last = heap.pop();
		if ( heap.length ) {
			heap[ 0 ] = last;
			var c = 0;
			for ( ;; ) {
				var l = c * 2 + 1, r = l + 1, m = c;
				if ( l < heap.length && f[ heap[ l ] ] < f[ heap[ m ] ] ) m = l;
				if ( r < heap.length && f[ heap[ r ] ] < f[ heap[ m ] ] ) m = r;
				if ( m === c ) break;
				var t2 = heap[ m ]; heap[ m ] = heap[ c ]; heap[ c ] = t2;
				c = m;
			}
		}
		return top;
	}

	stamp[ startIdx ] = gen;
	g[ startIdx ] = 0;
	f[ startIdx ] = h( startIdx );
	from[ startIdx ] = -1;
	state[ startIdx ] = 1;
	push( startIdx );

	var expanded = 0;
	while ( heap.length && expanded++ < maxNodes ) {
		var cur = pop();
		if ( cur === goalIdx ) {
			var out = [];
			var w = cur;
			while ( w !== -1 ) { out.push( w ); w = from[ w ]; }
			out.reverse();
			return out;
		}
		state[ cur ] = 2;
		var ln = links[ cur ];
		for ( var i = 0; i < ln.length; i++ ) {
			var nb = ln[ i ];
			if ( stamp[ nb ] === gen && state[ nb ] === 2 ) continue;
			var a = nodes[ cur ], b = nodes[ nb ];
			var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
			var step = Math.sqrt( dx * dx + dz * dz ) + Math.abs( dy ) * 1.4;
			// Nudge routes away from wide-open ground.
			var tentative = g[ cur ] + step * ( 1 + b.open * 0.15 );
			if ( stamp[ nb ] !== gen ) {
				stamp[ nb ] = gen;
				state[ nb ] = 0;
				g[ nb ] = Infinity;
			}
			if ( tentative < g[ nb ] ) {
				g[ nb ] = tentative;
				f[ nb ] = tentative + h( nb ) * 1.05;   // slight overestimate = faster
				from[ nb ] = cur;
				if ( state[ nb ] !== 1 ) { state[ nb ] = 1; push( nb ); }
			}
		}
	}
	return null;
};

/* Connected components, used to verify a map has no stranded islands. */
NavGraph.prototype.components = function() {
	var n = this.nodes.length;
	var comp = new Int32Array( n ).fill( -1 );
	var sizes = [];
	var stack = [];
	for ( var i = 0; i < n; i++ ) {
		if ( comp[ i ] !== -1 ) continue;
		var id = sizes.length;
		var count = 0;
		stack.length = 0;
		stack.push( i );
		comp[ i ] = id;
		while ( stack.length ) {
			var c = stack.pop();
			count++;
			var ln = this.links[ c ];
			for ( var j = 0; j < ln.length; j++ ) {
				if ( comp[ ln[ j ] ] === -1 ) {
					comp[ ln[ j ] ] = id;
					stack.push( ln[ j ] );
				}
			}
		}
		sizes.push( count );
	}
	return { comp: comp, sizes: sizes };
};

/* Pick a random node, optionally biased toward cover or away from a position. */
NavGraph.prototype.randomNode = function( rnd, filter ) {
	var r = rnd || Math.random;
	for ( var tries = 0; tries < 40; tries++ ) {
		var i = Math.floor( r() * this.nodes.length );
		if ( !filter || filter( this.nodes[ i ], i ) ) return i;
	}
	return Math.floor( r() * this.nodes.length );
};

DE.NavGraph = NavGraph;
DE.NAV = { SPACING: SPACING, LINK_DIST: LINK_DIST, STEP_UP: STEP_UP, DROP_MAX: DROP_MAX };

} )( window );
