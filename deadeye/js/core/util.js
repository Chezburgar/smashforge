/* DEADEYE — core utilities
 * Math helpers, deterministic RNG, object pooling, small data structures.
 * No dependencies beyond THREE. */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util = {};

/* ---------- math ---------- */

U.TAU = Math.PI * 2;
U.DEG = Math.PI / 180;

U.clamp = function( v, lo, hi ) { return v < lo ? lo : ( v > hi ? hi : v ); };
U.lerp = function( a, b, t ) { return a + ( b - a ) * t; };
U.invLerp = function( a, b, v ) { return a === b ? 0 : ( v - a ) / ( b - a ); };
U.smoothstep = function( t ) { t = U.clamp( t, 0, 1 ); return t * t * ( 3 - 2 * t ); };
U.sign = function( v ) { return v < 0 ? -1 : ( v > 0 ? 1 : 0 ); };

/* Frame-rate independent exponential approach. `rate` is the fraction of the
 * remaining distance covered per second, so behaviour is identical at 30 and
 * 240 fps (a naive lerp(a,b,0.2) is not). */
U.damp = function( a, b, rate, dt ) {
	return b + ( a - b ) * Math.exp( -rate * dt );
};

U.dampAngle = function( a, b, rate, dt ) {
	return b + U.wrapAngle( a - b ) * Math.exp( -rate * dt );
};

/* Wrap to (-PI, PI]. */
U.wrapAngle = function( a ) {
	a = a % U.TAU;
	if ( a > Math.PI ) a -= U.TAU;
	else if ( a <= -Math.PI ) a += U.TAU;
	return a;
};

U.moveTowards = function( a, b, maxDelta ) {
	var d = b - a;
	if ( Math.abs( d ) <= maxDelta ) return b;
	return a + U.sign( d ) * maxDelta;
};

/* ---------- random ---------- */

/* mulberry32 — small, fast, seedable. Used for anything that must be
 * reproducible (map decoration, spread patterns for recoil previews). */
U.rng = function( seed ) {
	var s = seed >>> 0;
	var f = function() {
		s = ( s + 0x6D2B79F5 ) >>> 0;
		var t = s;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
	f.range = function( lo, hi ) { return lo + f() * ( hi - lo ); };
	f.int = function( lo, hi ) { return Math.floor( lo + f() * ( hi - lo + 1 ) ); };
	f.pick = function( arr ) { return arr[ Math.floor( f() * arr.length ) ]; };
	f.sign = function() { return f() < 0.5 ? -1 : 1; };
	f.chance = function( p ) { return f() < p; };
	return f;
};

U.rand = function( lo, hi ) { return lo + Math.random() * ( hi - lo ); };
U.randInt = function( lo, hi ) { return Math.floor( lo + Math.random() * ( hi - lo + 1 ) ); };
U.pick = function( arr ) { return arr[ Math.floor( Math.random() * arr.length ) ]; };
U.chance = function( p ) { return Math.random() < p; };

/* Normally-distributed noise (Box-Muller), used for weapon spread so the
 * pattern clusters toward the centre instead of filling the cone uniformly. */
U.gauss = function() {
	var u = 0, v = 0;
	while ( u === 0 ) u = Math.random();
	while ( v === 0 ) v = Math.random();
	return Math.sqrt( -2 * Math.log( u ) ) * Math.cos( U.TAU * v );
};

U.shuffle = function( arr ) {
	for ( var i = arr.length - 1; i > 0; i-- ) {
		var j = Math.floor( Math.random() * ( i + 1 ) );
		var t = arr[ i ]; arr[ i ] = arr[ j ]; arr[ j ] = t;
	}
	return arr;
};

/* ---------- colour ---------- */

/* Multiply an 0xRRGGBB integer by a scalar, clamping each channel. Used to
 * shade individual faces of baked map geometry without needing extra
 * materials. */
U.shade = function( hex, k ) {
	var r = U.clamp( Math.round( ( ( hex >> 16 ) & 255 ) * k ), 0, 255 );
	var g = U.clamp( Math.round( ( ( hex >> 8 ) & 255 ) * k ), 0, 255 );
	var b = U.clamp( Math.round( ( hex & 255 ) * k ), 0, 255 );
	return ( r << 16 ) | ( g << 8 ) | b;
};

U.mixHex = function( a, b, t ) {
	var ar = ( a >> 16 ) & 255, ag = ( a >> 8 ) & 255, ab = a & 255;
	var br = ( b >> 16 ) & 255, bg = ( b >> 8 ) & 255, bb = b & 255;
	return ( Math.round( U.lerp( ar, br, t ) ) << 16 ) |
	       ( Math.round( U.lerp( ag, bg, t ) ) << 8 ) |
	         Math.round( U.lerp( ab, bb, t ) );
};

/* Slight per-instance colour jitter so repeated props (crates, containers)
 * don't read as identical copies. */
U.jitterHex = function( hex, amount, rnd ) {
	var r = rnd ? rnd : Math.random;
	return U.shade( hex, 1 + ( r() - 0.5 ) * 2 * amount );
};

/* ---------- pooling ---------- */

/* Fixed-capacity pool. Everything transient in the game (tracers, decals,
 * particles, damage numbers) comes from one of these so the GC never runs
 * mid-firefight. */
U.Pool = function( size, factory ) {
	this.items = new Array( size );
	this.free = new Array( size );
	this.freeCount = size;
	for ( var i = 0; i < size; i++ ) {
		this.items[ i ] = factory( i );
		this.free[ i ] = i;
	}
};

U.Pool.prototype.acquire = function() {
	if ( this.freeCount === 0 ) return null;
	return this.items[ this.free[ --this.freeCount ] ];
};

/* Returns the index so callers can release by index later. */
U.Pool.prototype.acquireIndex = function() {
	if ( this.freeCount === 0 ) return -1;
	return this.free[ --this.freeCount ];
};

U.Pool.prototype.release = function( index ) {
	this.free[ this.freeCount++ ] = index;
};

U.Pool.prototype.reset = function() {
	this.freeCount = this.items.length;
	for ( var i = 0; i < this.items.length; i++ ) this.free[ i ] = i;
};

/* ---------- spring ---------- */

/* Critically-damped-ish spring used for weapon recoil, camera kick and view
 * punch. Overshoots slightly at low damping which is exactly what reads as
 * "snappy" on a gun. */
U.Spring = function( stiffness, damping ) {
	this.value = 0;
	this.vel = 0;
	this.target = 0;
	this.stiffness = stiffness || 120;
	this.damping = damping || 14;
};

U.Spring.prototype.step = function( dt ) {
	// Sub-step so a long frame can't make the spring explode.
	var steps = Math.min( 4, Math.ceil( dt / 0.008 ) ) || 1;
	var h = dt / steps;
	for ( var i = 0; i < steps; i++ ) {
		var a = ( this.target - this.value ) * this.stiffness - this.vel * this.damping;
		this.vel += a * h;
		this.value += this.vel * h;
	}
	return this.value;
};

U.Spring.prototype.kick = function( amount ) { this.vel += amount; };
U.Spring.prototype.reset = function( v ) { this.value = v || 0; this.vel = 0; this.target = v || 0; };

/* ---------- timing ---------- */

/* Rolling average, for the fps counter and net stats. */
U.Rolling = function( n ) {
	this.buf = new Float32Array( n );
	this.n = n;
	this.i = 0;
	this.count = 0;
	this.sum = 0;
};

U.Rolling.prototype.push = function( v ) {
	if ( this.count === this.n ) this.sum -= this.buf[ this.i ];
	else this.count++;
	this.buf[ this.i ] = v;
	this.sum += v;
	this.i = ( this.i + 1 ) % this.n;
	return this.sum / this.count;
};

U.Rolling.prototype.avg = function() { return this.count ? this.sum / this.count : 0; };

/* ---------- misc ---------- */

U.formatTime = function( seconds ) {
	seconds = Math.max( 0, Math.floor( seconds ) );
	var m = Math.floor( seconds / 60 );
	var s = seconds % 60;
	return m + ":" + ( s < 10 ? "0" : "" ) + s;
};

/* Escape user-supplied strings (player names) before they touch innerHTML. */
U.esc = function( s ) {
	return String( s ).replace( /[&<>"']/g, function( c ) {
		return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ c ];
	} );
};

U.storage = {
	get: function( key, fallback ) {
		try {
			var v = localStorage.getItem( "deadeye." + key );
			return v === null ? fallback : JSON.parse( v );
		} catch ( e ) { return fallback; }
	},
	set: function( key, value ) {
		try { localStorage.setItem( "deadeye." + key, JSON.stringify( value ) ); }
		catch ( e ) { /* private mode / quota — non-fatal */ }
	}
};

} )( window );
