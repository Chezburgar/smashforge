/* DEADEYE — procedural audio
 *
 * Every sound is synthesised on the fly with the Web Audio API. Nothing is
 * downloaded, which matters for a static host: no audio files to serve, no
 * decode stall on first shot, and the whole game stays a few hundred KB.
 *
 * Gunshots are built the way real ones read to the ear:
 *   transient  — a 3ms highpassed tick (the firing pin / gas port)
 *   crack      — a short bright snap (supersonic bullet)
 *   body       — bandpassed noise with a falling filter and fast decay
 *   thump      — a low oscillator sweeping down (chest punch)
 *   tail       — a send to a synthesised convolution reverb
 * Varying five numbers per weapon gives each gun a distinct voice.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

function AudioEngine() {
	this.ctx = null;
	this.ready = false;
	this.enabled = true;
	this.volumes = { master: 0.8, sfx: 1.0, ui: 0.7, ambient: 0.5 };
	this._noise = null;
	this._ambientNodes = [];
	this._lastFootstep = 0;
	this._voices = 0;
	this._voiceCap = 48;
}

AudioEngine.prototype.init = function() {
	if ( this.ready ) return true;
	var Ctx = global.AudioContext || global.webkitAudioContext;
	if ( !Ctx ) { this.enabled = false; return false; }

	var ctx = this.ctx = new Ctx();

	// master -> compressor -> destination. The compressor stops a shotgun
	// blast plus three bots firing from clipping into distortion.
	this.comp = ctx.createDynamicsCompressor();
	this.comp.threshold.value = -14;
	this.comp.knee.value = 22;
	this.comp.ratio.value = 8;
	this.comp.attack.value = 0.002;
	this.comp.release.value = 0.18;
	this.comp.connect( ctx.destination );

	this.master = ctx.createGain();
	this.master.gain.value = this.volumes.master;
	this.master.connect( this.comp );

	this.busSfx = ctx.createGain();
	this.busSfx.gain.value = this.volumes.sfx;
	this.busSfx.connect( this.master );

	this.busUi = ctx.createGain();
	this.busUi.gain.value = this.volumes.ui;
	this.busUi.connect( this.master );

	this.busAmb = ctx.createGain();
	this.busAmb.gain.value = this.volumes.ambient;
	this.busAmb.connect( this.master );

	// Reverb send, fed by gunshots and explosions.
	this.convolver = ctx.createConvolver();
	this.convolver.buffer = this._makeImpulse( 1.6, 2.4 );
	this.reverbSend = ctx.createGain();
	this.reverbSend.gain.value = 0.32;
	this.reverbSend.connect( this.convolver );
	var revOut = ctx.createGain();
	revOut.gain.value = 0.9;
	this.convolver.connect( revOut );
	revOut.connect( this.busSfx );
	this.reverbOut = revOut;

	this._noise = this._makeNoise( 2.0 );

	// Listener defaults; updated per frame from the camera.
	this.listener = ctx.listener;

	this.ready = true;
	return true;
};

AudioEngine.prototype.resume = function() {
	if ( !this.ready ) this.init();
	if ( this.ctx && this.ctx.state === "suspended" ) this.ctx.resume();
};

AudioEngine.prototype.setVolume = function( bus, v ) {
	this.volumes[ bus ] = v;
	if ( !this.ready ) return;
	var node = { master: this.master, sfx: this.busSfx, ui: this.busUi, ambient: this.busAmb }[ bus ];
	if ( node ) node.gain.setTargetAtTime( v, this.ctx.currentTime, 0.02 );
};

/* ---------- buffers ---------- */

AudioEngine.prototype._makeNoise = function( seconds ) {
	var len = Math.floor( this.ctx.sampleRate * seconds );
	var buf = this.ctx.createBuffer( 1, len, this.ctx.sampleRate );
	var d = buf.getChannelData( 0 );
	for ( var i = 0; i < len; i++ ) d[ i ] = Math.random() * 2 - 1;
	return buf;
};

/* Exponentially-decaying stereo noise makes a serviceable room impulse. */
AudioEngine.prototype._makeImpulse = function( seconds, decay ) {
	var rate = this.ctx.sampleRate;
	var len = Math.floor( rate * seconds );
	var buf = this.ctx.createBuffer( 2, len, rate );
	for ( var ch = 0; ch < 2; ch++ ) {
		var d = buf.getChannelData( ch );
		for ( var i = 0; i < len; i++ ) {
			var t = i / len;
			// A short pre-delay keeps the direct sound distinct from the tail.
			var env = Math.pow( 1 - t, decay );
			d[ i ] = ( Math.random() * 2 - 1 ) * env * ( i < rate * 0.008 ? 0.15 : 1 );
		}
	}
	return buf;
};

/* Set the reverb character per map: outdoor maps get a short, dry tail,
 * interiors a long one. */
AudioEngine.prototype.setSpace = function( size, wet ) {
	if ( !this.ready ) return;
	this.convolver.buffer = this._makeImpulse( size, 2.0 + ( 2.2 - size ) );
	this.reverbSend.gain.setTargetAtTime( wet, this.ctx.currentTime, 0.1 );
};

/* ---------- routing helpers ---------- */

/* Returns the node a voice should connect to. When `pos` is supplied the voice
 * is spatialised; otherwise it is played flat (the local player's own gun). */
AudioEngine.prototype._dest = function( pos, refDist ) {
	if ( !pos ) return { input: this.busSfx, panner: null };
	var p = this.ctx.createPanner();
	p.panningModel = "HRTF";
	p.distanceModel = "inverse";
	p.refDistance = refDist || 8;
	p.maxDistance = 200;
	p.rolloffFactor = 1.1;
	if ( p.positionX ) {
		p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
	} else {
		p.setPosition( pos.x, pos.y, pos.z );
	}
	p.connect( this.busSfx );
	return { input: p, panner: p };
};

AudioEngine.prototype.updateListener = function( camera ) {
	if ( !this.ready ) return;
	var l = this.listener;
	var p = camera.position;
	var m = camera.matrixWorld.elements;
	// -Z of the camera basis is forward; +Y is up.
	var fx = -m[ 8 ], fy = -m[ 9 ], fz = -m[ 10 ];
	var ux = m[ 4 ], uy = m[ 5 ], uz = m[ 6 ];
	var t = this.ctx.currentTime;
	if ( l.positionX ) {
		l.positionX.setTargetAtTime( p.x, t, 0.02 );
		l.positionY.setTargetAtTime( p.y, t, 0.02 );
		l.positionZ.setTargetAtTime( p.z, t, 0.02 );
		l.forwardX.setTargetAtTime( fx, t, 0.02 );
		l.forwardY.setTargetAtTime( fy, t, 0.02 );
		l.forwardZ.setTargetAtTime( fz, t, 0.02 );
		l.upX.setTargetAtTime( ux, t, 0.02 );
		l.upY.setTargetAtTime( uy, t, 0.02 );
		l.upZ.setTargetAtTime( uz, t, 0.02 );
	} else {
		l.setPosition( p.x, p.y, p.z );
		l.setOrientation( fx, fy, fz, ux, uy, uz );
	}
};

/* A one-shot slice of the noise buffer through a filter, with an exponential
 * gain envelope. This is the workhorse behind nearly every sound here. */
AudioEngine.prototype._noiseBurst = function( o ) {
	var ctx = this.ctx;
	var t0 = o.at || ctx.currentTime;

	var src = ctx.createBufferSource();
	src.buffer = this._noise;
	src.loop = true;
	// Random offset so repeated shots aren't bit-identical.
	var offset = Math.random() * 1.5;

	var filt = ctx.createBiquadFilter();
	filt.type = o.type || "bandpass";
	filt.frequency.setValueAtTime( o.f0, t0 );
	if ( o.f1 !== undefined ) {
		filt.frequency.exponentialRampToValueAtTime( Math.max( 40, o.f1 ), t0 + o.dur );
	}
	filt.Q.value = o.q === undefined ? 1 : o.q;

	var g = ctx.createGain();
	g.gain.setValueAtTime( 0.0001, t0 );
	g.gain.linearRampToValueAtTime( o.gain, t0 + ( o.attack || 0.001 ) );
	g.gain.exponentialRampToValueAtTime( 0.0001, t0 + o.dur );

	src.connect( filt );
	filt.connect( g );
	g.connect( o.out );
	if ( o.reverb ) {
		var rg = ctx.createGain();
		rg.gain.value = o.reverb;
		g.connect( rg );
		rg.connect( this.reverbSend );
	}

	src.start( t0, offset );
	src.stop( t0 + o.dur + 0.02 );
	return g;
};

AudioEngine.prototype._tone = function( o ) {
	var ctx = this.ctx;
	var t0 = o.at || ctx.currentTime;
	var osc = ctx.createOscillator();
	osc.type = o.wave || "sine";
	osc.frequency.setValueAtTime( o.f0, t0 );
	if ( o.f1 !== undefined ) {
		osc.frequency.exponentialRampToValueAtTime( Math.max( 20, o.f1 ), t0 + o.dur );
	}
	var g = ctx.createGain();
	g.gain.setValueAtTime( 0.0001, t0 );
	g.gain.linearRampToValueAtTime( o.gain, t0 + ( o.attack || 0.004 ) );
	g.gain.exponentialRampToValueAtTime( 0.0001, t0 + o.dur );
	osc.connect( g );
	g.connect( o.out );
	if ( o.reverb ) {
		var rg = ctx.createGain();
		rg.gain.value = o.reverb;
		g.connect( rg );
		rg.connect( this.reverbSend );
	}
	osc.start( t0 );
	osc.stop( t0 + o.dur + 0.02 );
	return g;
};

/* ---------- weapons ---------- */

/* v: the weapon's `sound` block — see weapons.js
 *    { level, bright, decay, thump, crack, q } */
AudioEngine.prototype.gunshot = function( v, pos ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 10 );
	var out = d.input;
	var t0 = this.ctx.currentTime;
	var lvl = ( v.level === undefined ? 1 : v.level ) * ( pos ? 1.35 : 1 );
	var det = 1 + ( Math.random() - 0.5 ) * 0.09;  // slight per-shot variation

	// Firing-pin transient.
	this._noiseBurst( {
		out: out, at: t0, f0: 5200 * det, type: "highpass",
		dur: 0.012, gain: 0.30 * lvl, q: 0.7
	} );

	// Supersonic crack.
	if ( v.crack ) {
		this._noiseBurst( {
			out: out, at: t0 + 0.001, f0: 3400 * det, f1: 1500,
			type: "bandpass", q: 0.9,
			dur: 0.035, gain: v.crack * lvl, reverb: 0.5
		} );
	}

	// Main body — falling bandpass is what makes it read as a gunshot rather
	// than a generic noise burst.
	this._noiseBurst( {
		out: out, at: t0, f0: v.bright * det, f1: v.bright * 0.28,
		type: "bandpass", q: v.q === undefined ? 1.1 : v.q,
		dur: v.decay, gain: 0.55 * lvl, reverb: 0.6
	} );

	// Low-mid weight.
	this._noiseBurst( {
		out: out, at: t0, f0: 700, f1: 180,
		type: "lowpass", q: 0.8,
		dur: v.decay * 1.4, gain: 0.42 * lvl, reverb: 0.35
	} );

	// Chest punch.
	this._tone( {
		out: out, at: t0, wave: "triangle",
		f0: v.thump * 2.6 * det, f1: v.thump * 0.55,
		dur: Math.min( 0.16, v.decay * 1.8 ), gain: 0.5 * lvl, attack: 0.001, reverb: 0.25
	} );

	// Mechanical action clatter for automatics.
	if ( v.action ) {
		this._noiseBurst( {
			out: out, at: t0 + 0.028, f0: 2600, f1: 1400, type: "bandpass",
			q: 2.2, dur: 0.05, gain: 0.10 * lvl * v.action
		} );
	}
};

AudioEngine.prototype.suppressedShot = function( v, pos ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 8 ), out = d.input, t0 = this.ctx.currentTime;
	this._noiseBurst( { out: out, at: t0, f0: 900, f1: 300, type: "lowpass", q: 1,
	                    dur: 0.10, gain: 0.30 } );
	this._tone( { out: out, at: t0, wave: "sine", f0: 210, f1: 90, dur: 0.10, gain: 0.22 } );
	this._noiseBurst( { out: out, at: t0 + 0.03, f0: 3000, f1: 1800, type: "bandpass",
	                    q: 3, dur: 0.05, gain: 0.12 } );
};

AudioEngine.prototype.dryFire = function() {
	if ( !this.ready || !this.enabled ) return;
	this._noiseBurst( { out: this.busSfx, f0: 2400, f1: 900, type: "bandpass",
	                    q: 4, dur: 0.05, gain: 0.20 } );
};

/* kind: "mag" | "shell" | "bolt" | "pump" */
AudioEngine.prototype.reloadStep = function( kind, delay ) {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime + ( delay || 0 );
	var out = this.busSfx;
	if ( kind === "mag-out" ) {
		this._noiseBurst( { out: out, at: t0, f0: 1800, f1: 700, type: "bandpass", q: 2.4,
		                    dur: 0.09, gain: 0.20 } );
		this._tone( { out: out, at: t0, wave: "square", f0: 320, f1: 180, dur: 0.05, gain: 0.05 } );
	} else if ( kind === "mag-in" ) {
		this._noiseBurst( { out: out, at: t0, f0: 2600, f1: 900, type: "bandpass", q: 3,
		                    dur: 0.07, gain: 0.26 } );
		this._tone( { out: out, at: t0, wave: "triangle", f0: 420, f1: 150, dur: 0.06, gain: 0.10 } );
	} else if ( kind === "bolt" ) {
		this._noiseBurst( { out: out, at: t0, f0: 3200, f1: 1600, type: "bandpass", q: 2,
		                    dur: 0.06, gain: 0.18 } );
		this._noiseBurst( { out: out, at: t0 + 0.09, f0: 2200, f1: 1000, type: "bandpass", q: 3,
		                    dur: 0.07, gain: 0.22 } );
	} else if ( kind === "pump" ) {
		this._noiseBurst( { out: out, at: t0, f0: 1500, f1: 800, type: "bandpass", q: 1.6,
		                    dur: 0.10, gain: 0.24 } );
		this._noiseBurst( { out: out, at: t0 + 0.13, f0: 2000, f1: 900, type: "bandpass", q: 2.4,
		                    dur: 0.09, gain: 0.26 } );
	} else if ( kind === "shell" ) {
		this._noiseBurst( { out: out, at: t0, f0: 2000, f1: 1100, type: "bandpass", q: 3,
		                    dur: 0.06, gain: 0.18 } );
	}
};

/* Brass hitting the floor a moment after the shot. Small detail, big
 * contribution to the sense of a real weapon. */
AudioEngine.prototype.shellDrop = function( delay ) {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime + ( delay || 0.42 ) + Math.random() * 0.08;
	for ( var i = 0; i < 2; i++ ) {
		this._tone( {
			out: this.busSfx, at: t0 + i * ( 0.045 + Math.random() * 0.03 ),
			wave: "triangle",
			f0: 2600 + Math.random() * 1800, f1: 1400,
			dur: 0.05, gain: 0.045 / ( i + 1 )
		} );
	}
};

AudioEngine.prototype.weaponSwitch = function() {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	this._noiseBurst( { out: this.busSfx, at: t0, f0: 1400, f1: 2600, type: "bandpass",
	                    q: 2, dur: 0.10, gain: 0.16 } );
	this._noiseBurst( { out: this.busSfx, at: t0 + 0.12, f0: 2400, f1: 1200, type: "bandpass",
	                    q: 3, dur: 0.06, gain: 0.14 } );
};

/* ---------- impacts & feedback ---------- */

AudioEngine.prototype.impact = function( tag, pos ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 6 ), out = d.input, t0 = this.ctx.currentTime;
	var S = DE.SURFACE;
	var p = { f0: 2400, f1: 700, q: 1.4, dur: 0.09, gain: 0.24, type: "bandpass" };

	if ( tag === S.METAL ) { p = { f0: 4200, f1: 2200, q: 4, dur: 0.16, gain: 0.26, type: "bandpass" }; }
	else if ( tag === S.WOOD ) { p = { f0: 1600, f1: 500, q: 1.6, dur: 0.09, gain: 0.22, type: "bandpass" }; }
	else if ( tag === S.SAND ) { p = { f0: 1200, f1: 300, q: 0.8, dur: 0.12, gain: 0.18, type: "lowpass" }; }
	else if ( tag === S.SNOW ) { p = { f0: 900, f1: 240, q: 0.7, dur: 0.13, gain: 0.15, type: "lowpass" }; }
	else if ( tag === S.DIRT ) { p = { f0: 1100, f1: 280, q: 0.8, dur: 0.11, gain: 0.19, type: "lowpass" }; }
	else if ( tag === S.GLASS ) { p = { f0: 6000, f1: 3000, q: 5, dur: 0.22, gain: 0.24, type: "bandpass" }; }
	else if ( tag === S.FOLIAGE ) { p = { f0: 3000, f1: 1200, q: 0.9, dur: 0.10, gain: 0.13, type: "highpass" }; }
	else if ( tag === S.WATER ) { p = { f0: 700, f1: 2200, q: 1.2, dur: 0.16, gain: 0.20, type: "bandpass" }; }

	p.out = out; p.at = t0; p.reverb = 0.2;
	this._noiseBurst( p );

	if ( tag === S.METAL ) {
		// A short ringing partial sells the metallic ping.
		this._tone( { out: out, at: t0, wave: "triangle",
		              f0: 1800 + Math.random() * 1600, dur: 0.20, gain: 0.06 } );
	}
};

AudioEngine.prototype.fleshHit = function( pos ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 6 ), out = d.input, t0 = this.ctx.currentTime;
	this._noiseBurst( { out: out, at: t0, f0: 620, f1: 170, type: "lowpass", q: 1.1,
	                    dur: 0.10, gain: 0.30 } );
	this._tone( { out: out, at: t0, wave: "sine", f0: 150, f1: 60, dur: 0.09, gain: 0.16 } );
};

/* The hitmarker tick. Kept short and bright so it cuts through gunfire — this
 * is the single most important piece of feedback in the game. */
AudioEngine.prototype.hitmarker = function( headshot ) {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	var f = headshot ? 1750 : 1150;
	this._tone( { out: this.busUi, at: t0, wave: "square", f0: f, dur: 0.045,
	              gain: 0.12, attack: 0.001 } );
	if ( headshot ) {
		this._tone( { out: this.busUi, at: t0 + 0.045, wave: "square", f0: f * 1.5,
		              dur: 0.06, gain: 0.11, attack: 0.001 } );
	}
};

AudioEngine.prototype.killConfirm = function() {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	var notes = [ 880, 1174, 1568 ];
	for ( var i = 0; i < notes.length; i++ ) {
		this._tone( { out: this.busUi, at: t0 + i * 0.055, wave: "square",
		              f0: notes[ i ], dur: 0.10, gain: 0.085, attack: 0.002 } );
	}
};

AudioEngine.prototype.damageTaken = function( severity ) {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	this._noiseBurst( { out: this.busUi, at: t0, f0: 420, f1: 120, type: "lowpass",
	                    q: 1.2, dur: 0.16, gain: 0.26 * ( 0.6 + severity ) } );
	this._tone( { out: this.busUi, at: t0, wave: "sine", f0: 110, f1: 55,
	              dur: 0.18, gain: 0.20 } );
};

AudioEngine.prototype.death = function() {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	this._tone( { out: this.busUi, at: t0, wave: "sawtooth", f0: 320, f1: 45,
	              dur: 0.9, gain: 0.16 } );
	this._noiseBurst( { out: this.busUi, at: t0, f0: 1200, f1: 120, type: "lowpass",
	                    q: 1, dur: 0.7, gain: 0.16, reverb: 0.6 } );
};

AudioEngine.prototype.respawn = function() {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	this._tone( { out: this.busUi, at: t0, wave: "sine", f0: 300, f1: 900,
	              dur: 0.28, gain: 0.12 } );
};

/* A round passing close to the player's head. Directional, and one of the few
 * cues that tells you where you're being shot from. */
AudioEngine.prototype.whizby = function( pos, closeness ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 3 ), out = d.input, t0 = this.ctx.currentTime;
	this._noiseBurst( { out: out, at: t0, f0: 2600 + Math.random() * 1500, f1: 900,
	                    type: "bandpass", q: 2.6, dur: 0.07,
	                    gain: 0.22 * closeness } );
};

AudioEngine.prototype.explosion = function( pos ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 16 ), out = d.input, t0 = this.ctx.currentTime;
	this._noiseBurst( { out: out, at: t0, f0: 900, f1: 60, type: "lowpass", q: 1.4,
	                    dur: 0.85, gain: 0.85, reverb: 1.0 } );
	this._noiseBurst( { out: out, at: t0, f0: 5000, f1: 1200, type: "bandpass", q: 0.8,
	                    dur: 0.25, gain: 0.45, reverb: 0.6 } );
	this._tone( { out: out, at: t0, wave: "triangle", f0: 120, f1: 28,
	              dur: 0.7, gain: 0.6, attack: 0.002, reverb: 0.5 } );
	// Debris rattle.
	this._noiseBurst( { out: out, at: t0 + 0.18, f0: 3000, f1: 900, type: "bandpass",
	                    q: 1.4, dur: 0.5, gain: 0.14 } );
};

AudioEngine.prototype.grenadeBounce = function( pos ) {
	if ( !this.ready || !this.enabled ) return;
	var d = this._dest( pos, 6 );
	this._tone( { out: d.input, wave: "triangle", f0: 900 + Math.random() * 400, f1: 400,
	              dur: 0.07, gain: 0.10 } );
};

AudioEngine.prototype.grenadePin = function() {
	if ( !this.ready || !this.enabled ) return;
	this._tone( { out: this.busSfx, wave: "square", f0: 2200, f1: 1600, dur: 0.05, gain: 0.10 } );
};

/* ---------- movement ---------- */

AudioEngine.prototype.footstep = function( tag, pos, loud ) {
	if ( !this.ready || !this.enabled ) return;
	var S = DE.SURFACE;
	var d = this._dest( pos, 5 ), out = d.input;
	var p;
	if ( tag === S.METAL ) p = { f0: 2200, f1: 700, q: 1.6, dur: 0.10, gain: 0.16, type: "bandpass" };
	else if ( tag === S.WOOD ) p = { f0: 900, f1: 260, q: 1.2, dur: 0.09, gain: 0.14, type: "bandpass" };
	else if ( tag === S.SAND ) p = { f0: 1900, f1: 700, q: 0.6, dur: 0.11, gain: 0.10, type: "highpass" };
	else if ( tag === S.SNOW ) p = { f0: 2600, f1: 1100, q: 0.7, dur: 0.10, gain: 0.11, type: "highpass" };
	else if ( tag === S.DIRT ) p = { f0: 700, f1: 200, q: 0.9, dur: 0.09, gain: 0.12, type: "lowpass" };
	else if ( tag === S.WATER ) p = { f0: 1400, f1: 500, q: 0.8, dur: 0.16, gain: 0.16, type: "bandpass" };
	else p = { f0: 1100, f1: 300, q: 1.0, dur: 0.08, gain: 0.13, type: "bandpass" };

	p.out = out;
	p.gain *= ( loud === undefined ? 1 : loud );
	// Slight random detune so a run doesn't sound like a metronome.
	p.f0 *= 0.88 + Math.random() * 0.24;
	this._noiseBurst( p );
};

AudioEngine.prototype.jump = function() {
	if ( !this.ready || !this.enabled ) return;
	this._noiseBurst( { out: this.busSfx, f0: 800, f1: 300, type: "bandpass", q: 1,
	                    dur: 0.07, gain: 0.10 } );
};

AudioEngine.prototype.land = function( tag, hard ) {
	if ( !this.ready || !this.enabled ) return;
	this.footstep( tag, null, 1.6 );
	if ( hard ) {
		this._tone( { out: this.busSfx, wave: "sine", f0: 130, f1: 55, dur: 0.16, gain: 0.24 } );
	}
};

/* ---------- UI ---------- */

AudioEngine.prototype.ui = function( kind ) {
	if ( !this.ready || !this.enabled ) return;
	var t0 = this.ctx.currentTime;
	if ( kind === "hover" ) {
		this._tone( { out: this.busUi, at: t0, wave: "sine", f0: 620, dur: 0.035, gain: 0.035 } );
	} else if ( kind === "click" ) {
		this._tone( { out: this.busUi, at: t0, wave: "square", f0: 780, f1: 1150,
		              dur: 0.055, gain: 0.07 } );
	} else if ( kind === "back" ) {
		this._tone( { out: this.busUi, at: t0, wave: "square", f0: 700, f1: 420,
		              dur: 0.06, gain: 0.06 } );
	} else if ( kind === "start" ) {
		var n = [ 523, 659, 784, 1046 ];
		for ( var i = 0; i < n.length; i++ ) {
			this._tone( { out: this.busUi, at: t0 + i * 0.07, wave: "triangle",
			              f0: n[ i ], dur: 0.16, gain: 0.09 } );
		}
	} else if ( kind === "error" ) {
		this._tone( { out: this.busUi, at: t0, wave: "square", f0: 260, f1: 160,
		              dur: 0.16, gain: 0.07 } );
	}
};

/* ---------- ambience ---------- */

/* Looping bed per map: filtered noise for wind/room tone, plus an optional
 * low drone. Cross-faded on map change. */
AudioEngine.prototype.setAmbient = function( cfg ) {
	if ( !this.ready ) return;
	var ctx = this.ctx, t = ctx.currentTime;

	// Fade out whatever is playing.
	this._ambientNodes.forEach( function( n ) {
		n.gain.gain.setTargetAtTime( 0.0001, t, 0.4 );
		setTimeout( function() { try { n.src.stop(); } catch ( e ) {} }, 1600 );
	} );
	this._ambientNodes = [];
	if ( !cfg ) return;

	var self = this;
	function bed( f0, q, gain, type, lfoRate, lfoDepth ) {
		var src = ctx.createBufferSource();
		src.buffer = self._noise;
		src.loop = true;
		var filt = ctx.createBiquadFilter();
		filt.type = type || "bandpass";
		filt.frequency.value = f0;
		filt.Q.value = q;
		var g = ctx.createGain();
		g.gain.setValueAtTime( 0.0001, t );
		g.gain.setTargetAtTime( gain, t, 0.8 );
		src.connect( filt ); filt.connect( g ); g.connect( self.busAmb );

		if ( lfoRate ) {
			// Slow filter sweep keeps wind from sounding like static.
			var lfo = ctx.createOscillator();
			lfo.frequency.value = lfoRate;
			var lg = ctx.createGain();
			lg.gain.value = lfoDepth;
			lfo.connect( lg ); lg.connect( filt.frequency );
			lfo.start();
		}
		src.start( 0, Math.random() );
		self._ambientNodes.push( { src: src, gain: g } );
	}

	if ( cfg.wind ) bed( cfg.windFreq || 500, 0.5, cfg.wind, "bandpass", 0.06, ( cfg.windFreq || 500 ) * 0.5 );
	if ( cfg.rumble ) bed( cfg.rumbleFreq || 90, 1.2, cfg.rumble, "lowpass", 0.035, 30 );
	if ( cfg.hiss ) bed( 5200, 0.6, cfg.hiss, "highpass" );

	this.setSpace( cfg.space || 1.4, cfg.wet === undefined ? 0.28 : cfg.wet );
};

DE.audio = new AudioEngine();

} )( window );
