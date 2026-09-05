/* DEADEYE — peer-to-peer networking
 *
 * WebRTC data channels with no signalling server. The host generates an offer,
 * waits for ICE gathering, then compresses the whole SDP into a paste-able
 * lobby code; the guest returns an answer code the same way. Metered's TURN
 * service is fetched at connect time so peers behind symmetric NAT still meet.
 *
 * Authority model: each peer simulates its own player and broadcasts state at
 * 20Hz; the host additionally simulates the bots. Hits are claimed by the
 * shooter and accepted by the victim. That is trivially cheatable and entirely
 * fine for playing with people you know — it avoids a server, and it keeps
 * shooting feeling instant because you never wait for a round trip.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

var TURN_API =
	"https://deadshota.metered.live/api/v1/turn/credentials?apiKey=f34db030310d91038e914d40132517a4b0a7";

var FALLBACK_ICE = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:stun1.l.google.com:19302" }
];

var SEND_HZ = 20;
var PROTOCOL = 1;

/* ------------------------------------------------------------------
 * lobby codes
 * ------------------------------------------------------------------ */

function b64encode( bytes ) {
	var s = "";
	for ( var i = 0; i < bytes.length; i++ ) s += String.fromCharCode( bytes[ i ] );
	return btoa( s ).replace( /\+/g, "-" ).replace( /\//g, "_" ).replace( /=+$/, "" );
}

function b64decode( str ) {
	str = str.replace( /-/g, "+" ).replace( /_/g, "/" ).replace( /\s+/g, "" );
	while ( str.length % 4 ) str += "=";
	var bin = atob( str );
	var out = new Uint8Array( bin.length );
	for ( var i = 0; i < bin.length; i++ ) out[ i ] = bin.charCodeAt( i );
	return out;
}

/* SDP is enormously redundant; deflate takes a ~4KB blob to a few hundred
 * bytes, which is short enough to send over chat. */
function compress( text ) {
	var bytes = new TextEncoder().encode( text );
	if ( typeof CompressionStream !== "function" ) {
		return Promise.resolve( "R" + b64encode( bytes ) );
	}
	var cs = new CompressionStream( "deflate-raw" );
	var writer = cs.writable.getWriter();
	writer.write( bytes );
	writer.close();
	return new Response( cs.readable ).arrayBuffer().then( function( buf ) {
		return "D" + b64encode( new Uint8Array( buf ) );
	} );
}

function decompress( code ) {
	code = code.trim();
	var kind = code[ 0 ];
	var body = code.slice( 1 );
	var bytes = b64decode( body );
	if ( kind === "R" || typeof DecompressionStream !== "function" ) {
		return Promise.resolve( new TextDecoder().decode( bytes ) );
	}
	var ds = new DecompressionStream( "deflate-raw" );
	var writer = ds.writable.getWriter();
	writer.write( bytes );
	writer.close();
	return new Response( ds.readable ).arrayBuffer().then( function( buf ) {
		return new TextDecoder().decode( new Uint8Array( buf ) );
	} );
}

/* Strip the parts of an SDP that add bulk without affecting a data-channel-only
 * session. Keeps codes short enough to paste comfortably. */
function trimSdp( sdp ) {
	return sdp.split( "\r\n" ).filter( function( line ) {
		return !/^a=(extmap|rtcp-fb|rtpmap|fmtp|ssrc|msid|rtcp-mux-only)/.test( line );
	} ).join( "\r\n" );
}

/* ------------------------------------------------------------------
 * Net
 * ------------------------------------------------------------------ */

function Net() {
	this.game = null;
	this.menu = null;
	this.pc = null;
	this.channel = null;
	this.connected = false;
	this.isHost = false;
	this.peers = {};           // id -> RemotePlayer
	this.selfId = "p" + Math.floor( Math.random() * 1e9 ).toString( 36 );
	this.sendT = 0;
	this.iceServers = null;
	this.status = "idle";
	this.onStatus = null;
	this._seq = 0;
}

Net.prototype.attach = function( game, menu ) {
	this.game = game;
	this.menu = menu;
	var self = this;
	// The game calls these unconditionally; they are no-ops offline.
	game.net = {
		sendShot: function( shooter, def ) { self.sendShot( shooter, def ); },
		sendFootstep: null,
		connected: false
	};
	this._wireUi();
};

Net.prototype._setStatus = function( s, detail ) {
	this.status = s;
	if ( this.onStatus ) this.onStatus( s, detail );
	var el = document.getElementById( "mp-status" );
	if ( el ) el.textContent = detail || s;
};

Net.prototype.fetchIce = function() {
	if ( this.iceServers ) return Promise.resolve( this.iceServers );
	var self = this;
	return fetch( TURN_API ).then( function( r ) {
		if ( !r.ok ) throw new Error( "TURN " + r.status );
		return r.json();
	} ).then( function( list ) {
		self.iceServers = Array.isArray( list ) && list.length ? list : FALLBACK_ICE;
		return self.iceServers;
	} ).catch( function( e ) {
		// A blocked or exhausted TURN account must not stop a LAN game.
		console.warn( "TURN unavailable, falling back to STUN:", e.message );
		self.iceServers = FALLBACK_ICE;
		return self.iceServers;
	} );
};

Net.prototype._makePc = function( iceServers ) {
	var pc = new RTCPeerConnection( { iceServers: iceServers, iceCandidatePoolSize: 4 } );
	var self = this;
	pc.oniceconnectionstatechange = function() {
		if ( pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected" ) {
			self._setStatus( "lost", "connection lost" );
			self.connected = false;
			self.game.net.connected = false;
		}
	};
	return pc;
};

/* Resolve once ICE gathering finishes, so the code contains every candidate
 * and no trickle channel is needed. */
function waitForIce( pc, timeoutMs ) {
	return new Promise( function( resolve ) {
		if ( pc.iceGatheringState === "complete" ) return resolve();
		var done = false;
		function finish() {
			if ( done ) return;
			done = true;
			pc.removeEventListener( "icegatheringstatechange", check );
			resolve();
		}
		function check() {
			if ( pc.iceGatheringState === "complete" ) finish();
		}
		pc.addEventListener( "icegatheringstatechange", check );
		// Don't wait forever on a slow TURN allocation.
		setTimeout( finish, timeoutMs || 5000 );
	} );
}

/* ---------- host ---------- */

Net.prototype.host = function() {
	var self = this;
	this._setStatus( "working", "fetching relay credentials…" );
	return this.fetchIce().then( function( ice ) {
		self.isHost = true;
		var pc = self.pc = self._makePc( ice );
		var ch = self.channel = pc.createDataChannel( "deadeye", {
			ordered: false, maxRetransmits: 0
		} );
		self._wireChannel( ch );

		self._setStatus( "working", "creating lobby…" );
		return pc.createOffer().then( function( offer ) {
			offer.sdp = trimSdp( offer.sdp );
			return pc.setLocalDescription( offer );
		} ).then( function() {
			return waitForIce( pc );
		} ).then( function() {
			return compress( pc.localDescription.sdp );
		} ).then( function( code ) {
			self._setStatus( "hosting", "share this code, then paste their reply" );
			return code;
		} );
	} );
};

Net.prototype.acceptAnswer = function( code ) {
	var self = this;
	this._setStatus( "working", "connecting…" );
	return decompress( code ).then( function( sdp ) {
		return self.pc.setRemoteDescription( { type: "answer", sdp: sdp } );
	} ).catch( function( e ) {
		self._setStatus( "error", "that reply code isn't valid" );
		throw e;
	} );
};

/* ---------- guest ---------- */

Net.prototype.join = function( code ) {
	var self = this;
	this._setStatus( "working", "fetching relay credentials…" );
	return this.fetchIce().then( function( ice ) {
		self.isHost = false;
		var pc = self.pc = self._makePc( ice );
		pc.ondatachannel = function( e ) {
			self.channel = e.channel;
			self._wireChannel( e.channel );
		};
		return decompress( code );
	} ).then( function( sdp ) {
		return self.pc.setRemoteDescription( { type: "offer", sdp: sdp } );
	} ).then( function() {
		return self.pc.createAnswer();
	} ).then( function( answer ) {
		answer.sdp = trimSdp( answer.sdp );
		return self.pc.setLocalDescription( answer );
	} ).then( function() {
		return waitForIce( self.pc );
	} ).then( function() {
		return compress( self.pc.localDescription.sdp );
	} ).then( function( reply ) {
		self._setStatus( "joining", "send this reply code back to the host" );
		return reply;
	} ).catch( function( e ) {
		self._setStatus( "error", "that lobby code isn't valid" );
		throw e;
	} );
};

/* ---------- channel ---------- */

Net.prototype._wireChannel = function( ch ) {
	var self = this;
	ch.binaryType = "arraybuffer";
	ch.onopen = function() {
		self.connected = true;
		self.game.net.connected = true;
		self._setStatus( "connected", "connected" );
		self.send( { t: "hello", id: self.selfId, name: self.game.player.name,
		             map: self.game.map ? self.game.map.def.id : null,
		             host: self.isHost } );
	};
	ch.onclose = function() {
		self.connected = false;
		self.game.net.connected = false;
		self._setStatus( "closed", "peer disconnected" );
		self._removeAllPeers();
	};
	ch.onmessage = function( e ) { self._onMessage( e.data ); };
};

Net.prototype.send = function( obj ) {
	if ( !this.channel || this.channel.readyState !== "open" ) return;
	try { this.channel.send( JSON.stringify( obj ) ); } catch ( e ) {}
};

Net.prototype._onMessage = function( raw ) {
	var msg;
	try { msg = JSON.parse( raw ); } catch ( e ) { return; }
	if ( !msg || !msg.t ) return;
	var g = this.game;

	switch ( msg.t ) {
		case "hello":
			this._ensurePeer( msg.id, msg.name );
			// The guest adopts the host's map so both sides agree.
			if ( !this.isHost && msg.map && g.map && msg.map !== g.map.def.id ) {
				g.startMatch( Object.assign( {}, this.menu.cfg, { map: msg.map, bots: 0 } ) );
			}
			break;

		case "state": {
			var p = this._ensurePeer( msg.id, msg.n );
			p.applyState( msg );
			break;
		}

		case "shot": {
			var s = this.peers[ msg.id ];
			var def = DE.WEAPONS[ msg.w ];
			if ( !def ) break;
			DE.audio.gunshot( def.sound, { x: msg.x, y: msg.y, z: msg.z } );
			if ( s ) s.onShot();
			g.onNoise( msg.x, msg.y, msg.z, 1, s );
			if ( msg.d ) {
				g.checkWhizby( msg.x, msg.y, msg.z,
				               { x: msg.d[ 0 ], y: msg.d[ 1 ], z: msg.d[ 2 ] } );
			}
			break;
		}

		case "hit":
			// A peer claims to have hit us. Accept it — see the note at the top.
			if ( msg.target === this.selfId && g.player.alive ) {
				var src = this.peers[ msg.id ];
				g.player.damage( msg.dmg, src || null, msg.w );
			}
			break;

		case "died": {
			var d = this.peers[ msg.id ];
			if ( d ) d.alive = false;
			break;
		}

		case "spawn": {
			var sp = this._ensurePeer( msg.id, msg.n );
			sp.alive = true;
			sp.health = 100;
			break;
		}

		case "bye":
			this._removePeer( msg.id );
			break;
	}
};

/* ---------- peers ---------- */

function RemotePlayer( game, id, name ) {
	this.game = game;
	this.id = id;
	this.name = name || "PEER";
	this.isRemote = true;
	this.team = 1;
	this.x = 0; this.y = -999; this.z = 0;
	this.vx = 0; this.vy = 0; this.vz = 0;
	this.yaw = 0; this.pitch = 0;
	this.crouching = false;
	this.grounded = true;
	this.alive = true;
	this.health = 100;
	this.maxHealth = 100;
	this.kills = 0; this.deaths = 0; this.streak = 0; this.score = 0;
	this.radius = DE.MOVE.RADIUS;
	this.height = DE.MOVE.HEIGHT_STAND;
	this.weaponId = "rk77";

	// Interpolation buffer: render ~100ms in the past so jitter is smoothed.
	this.buf = [];
	this.delay = 0.10;

	this.character = new DE.Character( { team: this.team } );
	this.character.setWeapon( DE.WEAPONS.rk77 );
	game.scene.add( this.character.root );
}

RemotePlayer.prototype.applyState = function( m ) {
	this.buf.push( {
		t: performance.now() / 1000,
		x: m.p[ 0 ], y: m.p[ 1 ], z: m.p[ 2 ],
		yaw: m.r[ 0 ], pitch: m.r[ 1 ],
		crouch: !!m.c, grounded: !!m.g, alive: !!m.a, health: m.h,
		speed: m.s || 0
	} );
	if ( this.buf.length > 20 ) this.buf.shift();
	this.alive = !!m.a;
	this.health = m.h;
	if ( m.w && m.w !== this.weaponId ) {
		this.weaponId = m.w;
		if ( DE.WEAPONS[ m.w ] ) this.character.setWeapon( DE.WEAPONS[ m.w ] );
	}
};

RemotePlayer.prototype.update = function( dt ) {
	var now = performance.now() / 1000 - this.delay;
	var b = this.buf;
	if ( !b.length ) return;

	// Find the pair of snapshots straddling the render time.
	var a = null, c = null;
	for ( var i = b.length - 1; i >= 0; i-- ) {
		if ( b[ i ].t <= now ) { a = b[ i ]; c = b[ i + 1 ] || null; break; }
	}
	if ( !a ) a = b[ 0 ];

	var st;
	if ( c ) {
		var span = c.t - a.t;
		var k = span > 0.0001 ? U.clamp( ( now - a.t ) / span, 0, 1 ) : 0;
		st = {
			x: U.lerp( a.x, c.x, k ), y: U.lerp( a.y, c.y, k ), z: U.lerp( a.z, c.z, k ),
			yaw: a.yaw + U.wrapAngle( c.yaw - a.yaw ) * k,
			pitch: U.lerp( a.pitch, c.pitch, k ),
			crouch: c.crouch, grounded: c.grounded, alive: c.alive, speed: c.speed
		};
	} else {
		st = a;
	}

	this.x = st.x; this.y = st.y; this.z = st.z;
	this.yaw = st.yaw; this.pitch = st.pitch;
	this.crouching = st.crouch;
	this.grounded = st.grounded;

	this.character.update( dt, {
		x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch,
		speed: st.speed, grounded: st.grounded, crouch: st.crouch,
		dead: !this.alive, vy: 0
	} );
};

RemotePlayer.prototype.onShot = function() {
	// Muzzle flash on the remote model would go here; the audio already fires.
};

RemotePlayer.prototype.damage = function( amount, source, cause ) {
	// Damage on a remote player is decided by that peer; we only predict.
	this.health -= amount;
};

RemotePlayer.prototype.dispose = function() {
	this.game.scene.remove( this.character.root );
	this.character.dispose();
};

Net.prototype._ensurePeer = function( id, name ) {
	if ( id === this.selfId ) return null;
	if ( !this.peers[ id ] ) {
		var p = new RemotePlayer( this.game, id, name );
		p.team = this.game.teamMode ? ( this.isHost ? 1 : 0 ) : 1;
		this.peers[ id ] = p;
		this.game.entities.push( p );
	} else if ( name ) {
		this.peers[ id ].name = name;
	}
	return this.peers[ id ];
};

Net.prototype._removePeer = function( id ) {
	var p = this.peers[ id ];
	if ( !p ) return;
	var i = this.game.entities.indexOf( p );
	if ( i >= 0 ) this.game.entities.splice( i, 1 );
	p.dispose();
	delete this.peers[ id ];
};

Net.prototype._removeAllPeers = function() {
	for ( var id in this.peers ) this._removePeer( id );
};

/* ---------- outgoing ---------- */

Net.prototype.update = function( dt ) {
	for ( var id in this.peers ) this.peers[ id ].update( dt );
	if ( !this.connected ) return;

	this.sendT -= dt;
	if ( this.sendT > 0 ) return;
	this.sendT = 1 / SEND_HZ;

	var p = this.game.player;
	this.send( {
		t: "state", id: this.selfId, n: p.name,
		p: [ round2( p.x ), round2( p.y ), round2( p.z ) ],
		r: [ round2( p.yaw ), round2( p.pitch ) ],
		c: p.crouching ? 1 : 0,
		g: p.grounded ? 1 : 0,
		a: p.alive ? 1 : 0,
		h: Math.round( p.health ),
		s: round2( Math.sqrt( p.vx * p.vx + p.vz * p.vz ) ),
		w: p.loadout[ p.slot ]
	} );
};

function round2( v ) { return Math.round( v * 100 ) / 100; }

Net.prototype.sendShot = function( shooter, def ) {
	if ( !this.connected || shooter !== this.game.player ) return;
	var d = shooter.forward( new THREE.Vector3() );
	this.send( {
		t: "shot", id: this.selfId, w: def.id,
		x: round2( shooter.x ), y: round2( shooter.y + shooter.eyeY ), z: round2( shooter.z ),
		d: [ round2( d.x ), round2( d.y ), round2( d.z ) ]
	} );
};

Net.prototype.sendHit = function( target, dmg, weaponId ) {
	if ( !this.connected || !target || !target.isRemote ) return;
	this.send( { t: "hit", id: this.selfId, target: target.id,
	             dmg: Math.round( dmg ), w: weaponId } );
};

Net.prototype.disconnect = function() {
	this.send( { t: "bye", id: this.selfId } );
	if ( this.channel ) try { this.channel.close(); } catch ( e ) {}
	if ( this.pc ) try { this.pc.close(); } catch ( e ) {}
	this.channel = null;
	this.pc = null;
	this.connected = false;
	if ( this.game ) this.game.net.connected = false;
	this._removeAllPeers();
	this._setStatus( "idle", "" );
};

/* ------------------------------------------------------------------
 * UI wiring
 * ------------------------------------------------------------------ */

Net.prototype._wireUi = function() {
	var self = this;
	var root = document;

	function el( id ) { return root.getElementById( id ); }

	var hostBtn = el( "mp-host" );
	var joinBtn = el( "mp-join" );
	if ( !hostBtn ) return;

	hostBtn.addEventListener( "click", function() {
		el( "mp-code-out" ).value = "generating…";
		el( "mp-step-host" ).style.display = "block";
		el( "mp-step-join" ).style.display = "none";
		self.host().then( function( code ) {
			el( "mp-code-out" ).value = code;
		} ).catch( function( e ) {
			el( "mp-code-out" ).value = "failed: " + e.message;
		} );
	} );

	joinBtn.addEventListener( "click", function() {
		el( "mp-step-join" ).style.display = "block";
		el( "mp-step-host" ).style.display = "none";
	} );

	var acceptBtn = el( "mp-accept" );
	if ( acceptBtn ) {
		acceptBtn.addEventListener( "click", function() {
			var code = el( "mp-answer-in" ).value.trim();
			if ( !code ) return;
			self.acceptAnswer( code ).catch( function() {} );
		} );
	}

	var joinGo = el( "mp-join-go" );
	if ( joinGo ) {
		joinGo.addEventListener( "click", function() {
			var code = el( "mp-code-in" ).value.trim();
			if ( !code ) return;
			el( "mp-reply-out" ).value = "generating…";
			self.join( code ).then( function( reply ) {
				el( "mp-reply-out" ).value = reply;
			} ).catch( function( e ) {
				el( "mp-reply-out" ).value = "failed: " + e.message;
			} );
		} );
	}

	var copyBtns = root.querySelectorAll( "[data-copy]" );
	for ( var i = 0; i < copyBtns.length; i++ ) {
		copyBtns[ i ].addEventListener( "click", function( e ) {
			var target = el( e.currentTarget.getAttribute( "data-copy" ) );
			if ( !target ) return;
			target.select();
			try { document.execCommand( "copy" ); } catch ( err ) {}
			if ( navigator.clipboard ) navigator.clipboard.writeText( target.value );
			e.currentTarget.textContent = "COPIED";
			setTimeout( function() { e.currentTarget.textContent = "COPY"; }, 1200 );
		} );
	}

	var dc = el( "mp-disconnect" );
	if ( dc ) dc.addEventListener( "click", function() { self.disconnect(); } );
};

DE.net = new Net();

} )( window );
