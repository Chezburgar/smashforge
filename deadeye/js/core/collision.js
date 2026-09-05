/* DEADEYE — collision
 *
 * The world is a soup of yaw-rotated boxes produced by the geometry builder.
 * The player is a vertical cylinder, which is rotation-invariant about Y — so
 * every query can be done in a collider's local frame without the cylinder
 * deforming. That single fact is what keeps this file small.
 *
 * Broadphase is a flat XZ spatial hash. Maps are ~80m square with a few
 * thousand colliders, so a 4m grid keeps candidate lists in the single digits.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

var CELL = 4;
var STEP_HEIGHT = 0.58;   // how tall a lip the player walks up without jumping
var SKIN = 0.001;
var BIG = 1e30;           // stand-in for 1/0 in slab tests — see raycast()

function World() {
	this.colliders = [];
	this.grid = new Map();
	this.minY = -50;
	this._queryTag = 0;
	this._seen = [];
	this._cand = [];
}

World.prototype.key = function( ix, iz ) { return ix * 73856093 ^ iz * 19349663; };

World.prototype.setColliders = function( list ) {
	this.colliders = list;
	this.grid.clear();
	this._seen = new Int32Array( list.length );
	this._queryTag = 0;

	for ( var i = 0; i < list.length; i++ ) {
		var c = list[ i ];
		var x0 = Math.floor( c.minX / CELL ), x1 = Math.floor( c.maxX / CELL );
		var z0 = Math.floor( c.minZ / CELL ), z1 = Math.floor( c.maxZ / CELL );
		for ( var x = x0; x <= x1; x++ ) {
			for ( var z = z0; z <= z1; z++ ) {
				var k = this.key( x, z );
				var bucket = this.grid.get( k );
				if ( !bucket ) { bucket = []; this.grid.set( k, bucket ); }
				bucket.push( i );
			}
		}
	}
};

/* Collect unique collider indices overlapping an XZ rectangle. Uses a
 * generation counter instead of clearing a Set each call. */
World.prototype.query = function( minX, minZ, maxX, maxZ, out ) {
	out.length = 0;
	var tag = ++this._queryTag;
	var seen = this._seen;
	var x0 = Math.floor( minX / CELL ), x1 = Math.floor( maxX / CELL );
	var z0 = Math.floor( minZ / CELL ), z1 = Math.floor( maxZ / CELL );
	for ( var x = x0; x <= x1; x++ ) {
		for ( var z = z0; z <= z1; z++ ) {
			var bucket = this.grid.get( this.key( x, z ) );
			if ( !bucket ) continue;
			for ( var i = 0; i < bucket.length; i++ ) {
				var idx = bucket[ i ];
				if ( seen[ idx ] === tag ) continue;
				seen[ idx ] = tag;
				out.push( idx );
			}
		}
	}
	return out;
};

/* Penetration of a vertical cylinder (centre px,pz; base py; radius r; height h)
 * into collider c. Writes into `res` and returns true when overlapping.
 * `mode`: 0 = consider all axes, 1 = Y only, 2 = XZ only. */
var _res = { nx: 0, ny: 0, nz: 0, depth: 0, axis: 0 };

World.prototype.penetration = function( c, px, py, pz, r, h, mode, res ) {
	var dx = px - c.cx, dz = pz - c.cz;
	var lx, lz;
	if ( c.rot ) {
		lx = dx * c.cos + dz * c.sin;
		lz = -dx * c.sin + dz * c.cos;
	} else { lx = dx; lz = dz; }

	var px1 = ( c.hx + r ) - Math.abs( lx );
	if ( px1 <= 0 ) return false;
	var pz1 = ( c.hz + r ) - Math.abs( lz );
	if ( pz1 <= 0 ) return false;

	var pcy = py + h * 0.5, ph = h * 0.5;
	var dy = pcy - c.cy;
	var py1 = ( c.hy + ph ) - Math.abs( dy );
	if ( py1 <= 0 ) return false;

	// Choose the shallowest escape among the permitted axes.
	var best = Infinity, axis = -1;
	if ( mode !== 2 && py1 < best ) { best = py1; axis = 1; }
	if ( mode !== 1 ) {
		if ( px1 < best ) { best = px1; axis = 0; }
		if ( pz1 < best ) { best = pz1; axis = 2; }
	}
	if ( axis === -1 ) return false;

	res.depth = best;
	res.axis = axis;
	res.nx = res.ny = res.nz = 0;

	if ( axis === 1 ) {
		res.ny = dy >= 0 ? 1 : -1;
	} else if ( axis === 0 ) {
		var sx = lx >= 0 ? 1 : -1;
		if ( c.rot ) { res.nx = c.cos * sx; res.nz = c.sin * sx; }
		else { res.nx = sx; }
	} else {
		var sz = lz >= 0 ? 1 : -1;
		if ( c.rot ) { res.nx = -c.sin * sz; res.nz = c.cos * sz; }
		else { res.nz = sz; }
	}
	return true;
};

World.prototype.overlaps = function( px, py, pz, r, h ) {
	var cand = this.query( px - r, pz - r, px + r, pz + r, this._cand );
	for ( var i = 0; i < cand.length; i++ ) {
		if ( this.penetration( this.colliders[ cand[ i ] ], px, py, pz, r, h, 0, _res ) ) return true;
	}
	return false;
};

/* ------------------------------------------------------------------
 * move — the player/bot movement solver.
 *
 * body: { x, y, z, vx, vy, vz, radius, height, grounded, groundTag }
 * Resolves the vertical axis first (establishing ground contact), then the
 * horizontal plane with step-up assist.
 * ------------------------------------------------------------------ */
World.prototype.move = function( body, dt ) {
	var r = body.radius, h = body.height;
	var i, c, cand;

	body.grounded = false;
	body.groundTag = null;
	body.hitWall = false;
	body.wallNx = 0; body.wallNz = 0;

	/* --- vertical --- */
	var dy = body.vy * dt;
	// Long frames could tunnel through a floor; cap the step.
	if ( Math.abs( dy ) > 2.5 ) dy = U.sign( dy ) * 2.5;
	body.y += dy;

	cand = this.query( body.x - r, body.z - r, body.x + r, body.z + r, this._cand );
	for ( i = 0; i < cand.length; i++ ) {
		c = this.colliders[ cand[ i ] ];
		if ( !this.penetration( c, body.x, body.y, body.z, r, h, 1, _res ) ) continue;
		body.y += _res.ny * ( _res.depth + SKIN );
		if ( _res.ny > 0 ) {
			// Landed on top of something.
			if ( body.vy < 0 ) {
				body.landSpeed = -body.vy;
				body.vy = 0;
			}
			body.grounded = true;
			body.groundTag = c.tag;
		} else if ( body.vy > 0 ) {
			body.vy = 0;   // head bonk
		}
	}

	/* --- horizontal, with step-up --- */
	var dx = body.vx * dt, dz = body.vz * dt;
	var stepLen = Math.sqrt( dx * dx + dz * dz );
	// Substep fast movement so we cannot skip past thin geometry.
	var sub = stepLen > r * 0.75 ? Math.ceil( stepLen / ( r * 0.75 ) ) : 1;
	if ( sub > 6 ) sub = 6;
	dx /= sub; dz /= sub;

	for ( var s = 0; s < sub; s++ ) {
		var startX = body.x, startZ = body.z, startY = body.y;
		body.x += dx;
		body.z += dz;

		var blocked = this._depenetrateXZ( body, r, h );

		if ( blocked && ( body.grounded || body.stepInAir ) ) {
			// Retry the same move from a raised position; if that is clear,
			// the obstruction was a step/kerb rather than a wall.
			var testY = startY + STEP_HEIGHT;
			if ( !this.overlaps( startX, testY, startZ, r, h ) ) {
				var sx = startX + dx, sz = startZ + dz;
				if ( !this.overlaps( sx, testY, sz, r, h ) ) {
					// Drop back onto the surface.
					var landY = this._dropTo( sx, testY, sz, r, h, STEP_HEIGHT + 0.05 );
					if ( landY !== null ) {
						body.x = sx; body.z = sz; body.y = landY;
						body.grounded = true;
						body.hitWall = false;
						continue;
					}
				}
			}
		}
	}

	if ( body.y < this.minY ) {
		body.outOfBounds = true;
	}
	return body;
};

/* Push the body out of anything it overlaps horizontally. Returns true if it
 * had to. Velocity into each contact normal is removed so the body slides. */
World.prototype._depenetrateXZ = function( body, r, h ) {
	var blocked = false;
	for ( var pass = 0; pass < 4; pass++ ) {
		var moved = false;
		var cand = this.query( body.x - r, body.z - r, body.x + r, body.z + r, this._cand );
		for ( var i = 0; i < cand.length; i++ ) {
			var c = this.colliders[ cand[ i ] ];
			if ( !this.penetration( c, body.x, body.y, body.z, r, h, 2, _res ) ) continue;
			body.x += _res.nx * ( _res.depth + SKIN );
			body.z += _res.nz * ( _res.depth + SKIN );
			var vn = body.vx * _res.nx + body.vz * _res.nz;
			if ( vn < 0 ) {
				body.vx -= _res.nx * vn;
				body.vz -= _res.nz * vn;
			}
			body.hitWall = true;
			body.wallNx = _res.nx;
			body.wallNz = _res.nz;
			blocked = true;
			moved = true;
		}
		if ( !moved ) break;
	}
	return blocked;
};

/* Find the Y at which a cylinder dropped from (x,y,z) comes to rest, searching
 * down at most maxDrop. Returns null if nothing is within reach. */
World.prototype._dropTo = function( x, y, z, r, h, maxDrop ) {
	var step = 0.06;
	for ( var d = 0; d <= maxDrop; d += step ) {
		var ty = y - d;
		if ( this.overlaps( x, ty, z, r, h ) ) {
			return d === 0 ? null : y - d + step;
		}
	}
	return null;
};

/* Is there ground within `dist` below? Used for coyote time and bot edge
 * avoidance. */
World.prototype.groundBelow = function( x, y, z, r, maxDist ) {
	var hit = this.raycast( x, y + 0.1, z, 0, -1, 0, maxDist + 0.1 );
	return hit.hit ? hit : null;
};

/* ------------------------------------------------------------------
 * raycast — slab test against every collider along the ray, using a 2D DDA
 * over the broadphase grid so long shots don't test the whole map.
 * ------------------------------------------------------------------ */
var _hit = {
	hit: false, dist: 0, x: 0, y: 0, z: 0,
	nx: 0, ny: 0, nz: 0, tag: null, collider: null
};

World.prototype.raycast = function( ox, oy, oz, dx, dy, dz, maxDist, out ) {
	out = out || _hit;
	out.hit = false;
	out.dist = maxDist;
	out.collider = null;
	out.tag = null;

	/* A large finite value rather than Infinity for zero direction components.
	 * With Infinity, a ray lying exactly in the plane of a box face computes
	 * ( face - origin ) * inv === 0 * Infinity === NaN, which then poisons the
	 * min/max chain and reports a hit at distance NaN. That happens constantly
	 * in practice — axis-aligned shots at axis-aligned walls — so the slab test
	 * uses a finite substitute, which degenerates to the correct answer. */
	var invX = dx !== 0 ? 1 / dx : BIG;
	var invY = dy !== 0 ? 1 / dy : BIG;
	var invZ = dz !== 0 ? 1 / dz : BIG;

	var best = maxDist;
	var bestIdx = -1, bestNx = 0, bestNy = 0, bestNz = 0;
	var self = this;
	var tag = ++this._queryTag;
	var seen = this._seen;

	function testCell( ix, iz ) {
		var bucket = self.grid.get( self.key( ix, iz ) );
		if ( !bucket ) return;
		for ( var i = 0; i < bucket.length; i++ ) {
			var idx = bucket[ i ];
			if ( seen[ idx ] === tag ) continue;
			seen[ idx ] = tag;
			var c = self.colliders[ idx ];

			var rox, roy = oy - c.cy, roz, rdx, rdy = dy, rdz, rinvX, rinvY = invY, rinvZ;
			if ( c.rot ) {
				var px = ox - c.cx, pz = oz - c.cz;
				rox = px * c.cos + pz * c.sin;
				roz = -px * c.sin + pz * c.cos;
				rdx = dx * c.cos + dz * c.sin;
				rdz = -dx * c.sin + dz * c.cos;
				rinvX = rdx !== 0 ? 1 / rdx : BIG;
				rinvZ = rdz !== 0 ? 1 / rdz : BIG;
			} else {
				rox = ox - c.cx; roz = oz - c.cz;
				rdx = dx; rdz = dz;
				rinvX = invX; rinvZ = invZ;
			}

			var t1 = ( -c.hx - rox ) * rinvX, t2 = ( c.hx - rox ) * rinvX;
			var tmin = Math.min( t1, t2 ), tmax = Math.max( t1, t2 );
			var axis = 0, sgn = t1 > t2 ? 1 : -1;

			t1 = ( -c.hy - roy ) * rinvY; t2 = ( c.hy - roy ) * rinvY;
			var lo = Math.min( t1, t2 ), hi = Math.max( t1, t2 );
			if ( lo > tmin ) { tmin = lo; axis = 1; sgn = t1 > t2 ? 1 : -1; }
			if ( hi < tmax ) tmax = hi;

			t1 = ( -c.hz - roz ) * rinvZ; t2 = ( c.hz - roz ) * rinvZ;
			lo = Math.min( t1, t2 ); hi = Math.max( t1, t2 );
			if ( lo > tmin ) { tmin = lo; axis = 2; sgn = t1 > t2 ? 1 : -1; }
			if ( hi < tmax ) tmax = hi;

			if ( tmax < 0 || tmin > tmax ) continue;
			var t = tmin >= 0 ? tmin : tmax;
			if ( t < 0 || t >= best ) continue;

			best = t;
			bestIdx = idx;
			if ( axis === 1 ) { bestNx = 0; bestNy = sgn; bestNz = 0; }
			else if ( axis === 0 ) {
				if ( c.rot ) { bestNx = c.cos * sgn; bestNy = 0; bestNz = c.sin * sgn; }
				else { bestNx = sgn; bestNy = 0; bestNz = 0; }
			} else {
				if ( c.rot ) { bestNx = -c.sin * sgn; bestNy = 0; bestNz = c.cos * sgn; }
				else { bestNx = 0; bestNy = 0; bestNz = sgn; }
			}
		}
	}

	// DDA across the XZ grid.
	var cx = Math.floor( ox / CELL ), cz = Math.floor( oz / CELL );
	var stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
	var tMaxX = dx !== 0 ? ( ( ( dx > 0 ? cx + 1 : cx ) * CELL ) - ox ) * invX : Infinity;
	var tMaxZ = dz !== 0 ? ( ( ( dz > 0 ? cz + 1 : cz ) * CELL ) - oz ) * invZ : Infinity;
	var tDeltaX = dx !== 0 ? Math.abs( CELL * invX ) : Infinity;
	var tDeltaZ = dz !== 0 ? Math.abs( CELL * invZ ) : Infinity;

	var travelled = 0;
	var guard = 0;
	testCell( cx, cz );
	while ( travelled < maxDist && guard++ < 512 ) {
		// Once we have a hit closer than the near edge of the next cell, stop.
		if ( bestIdx !== -1 && best < travelled ) break;
		if ( tMaxX < tMaxZ ) {
			cx += stepX; travelled = tMaxX; tMaxX += tDeltaX;
		} else {
			cz += stepZ; travelled = tMaxZ; tMaxZ += tDeltaZ;
		}
		if ( travelled > maxDist ) break;
		testCell( cx, cz );
	}

	if ( bestIdx !== -1 ) {
		var c2 = this.colliders[ bestIdx ];
		out.hit = true;
		out.dist = best;
		out.x = ox + dx * best;
		out.y = oy + dy * best;
		out.z = oz + dz * best;
		out.nx = bestNx; out.ny = bestNy; out.nz = bestNz;
		out.tag = c2.tag;
		out.collider = c2;
	}
	return out;
};

/* Cheap boolean visibility test between two points. Bots call this a lot, so
 * it early-outs on the first blocker rather than finding the nearest. */
var _losHit = { hit: false, dist: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, tag: null, collider: null };

World.prototype.lineOfSight = function( ax, ay, az, bx, by, bz ) {
	var dx = bx - ax, dy = by - ay, dz = bz - az;
	var len = Math.sqrt( dx * dx + dy * dy + dz * dz );
	if ( len < 0.0001 ) return true;
	dx /= len; dy /= len; dz /= len;
	var h = this.raycast( ax, ay, az, dx, dy, dz, len - 0.05, _losHit );
	return !h.hit;
};

DE.World = World;
DE.CELL = CELL;
DE.STEP_HEIGHT = STEP_HEIGHT;

} )( window );
