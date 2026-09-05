/* DEADEYE — input
 *
 * Pointer-lock mouse look plus a rebindable action map. Mouse deltas are
 * accumulated raw and consumed once per frame by the player controller, so
 * aim resolution is never limited by the frame rate — several mousemove events
 * inside one frame all count.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

var DEFAULT_BINDS = {
	forward:   [ "KeyW", "ArrowUp" ],
	back:      [ "KeyS", "ArrowDown" ],
	left:      [ "KeyA", "ArrowLeft" ],
	right:     [ "KeyD", "ArrowRight" ],
	jump:      [ "Space" ],
	crouch:    [ "ControlLeft", "KeyC" ],
	sprint:    [ "ShiftLeft" ],
	reload:    [ "KeyR" ],
	melee:     [ "KeyV" ],
	grenade:   [ "KeyG" ],
	interact:  [ "KeyF" ],
	scoreboard:[ "Tab" ],
	slot1:     [ "Digit1" ],
	slot2:     [ "Digit2" ],
	slot3:     [ "Digit3" ],
	lastWeapon:[ "KeyQ" ],
	chat:      [ "KeyT", "Enter" ]
};

function Input( element ) {
	this.el = element;
	this.keys = Object.create( null );
	this.binds = U.storage.get( "binds", null ) || JSON.parse( JSON.stringify( DEFAULT_BINDS ) );
	this.actions = Object.create( null );
	this.pressed = Object.create( null );   // edge-triggered, cleared each frame
	this.released = Object.create( null );

	this.mouseDX = 0;
	this.mouseDY = 0;
	this.wheel = 0;
	this.buttons = [ false, false, false ];
	this.buttonPressed = [ false, false, false ];
	this.buttonReleased = [ false, false, false ];

	this.locked = false;
	this.enabled = true;
	this.sensitivity = U.storage.get( "sensitivity", 0.0022 );
	this.adsSensScale = U.storage.get( "adsSens", 0.72 );
	this.invertY = U.storage.get( "invertY", false );
	this.rawInput = true;

	this._listeners = { lock: [], unlock: [] };
	this._bind();
	this._rebuildActionMap();
}

Input.prototype._rebuildActionMap = function() {
	this._codeToActions = Object.create( null );
	for ( var action in this.binds ) {
		var codes = this.binds[ action ];
		for ( var i = 0; i < codes.length; i++ ) {
			var c = codes[ i ];
			( this._codeToActions[ c ] = this._codeToActions[ c ] || [] ).push( action );
		}
	}
};

Input.prototype.setBind = function( action, codes ) {
	this.binds[ action ] = codes;
	this._rebuildActionMap();
	U.storage.set( "binds", this.binds );
};

Input.prototype.resetBinds = function() {
	this.binds = JSON.parse( JSON.stringify( DEFAULT_BINDS ) );
	this._rebuildActionMap();
	U.storage.set( "binds", this.binds );
};

Input.prototype.setSensitivity = function( v ) {
	this.sensitivity = v;
	U.storage.set( "sensitivity", v );
};

Input.prototype._bind = function() {
	var self = this;

	global.addEventListener( "keydown", function( e ) {
		// Never swallow keys while the player is typing in a field.
		if ( self._typing( e ) ) return;
		if ( self.keys[ e.code ] ) { self._maybePrevent( e ); return; }  // ignore auto-repeat
		self.keys[ e.code ] = true;
		var acts = self._codeToActions[ e.code ];
		if ( acts ) {
			for ( var i = 0; i < acts.length; i++ ) {
				self.actions[ acts[ i ] ] = true;
				self.pressed[ acts[ i ] ] = true;
			}
		}
		self._maybePrevent( e );
	}, false );

	global.addEventListener( "keyup", function( e ) {
		if ( self._typing( e ) ) return;
		self.keys[ e.code ] = false;
		var acts = self._codeToActions[ e.code ];
		if ( acts ) {
			for ( var i = 0; i < acts.length; i++ ) {
				// An action stays held if any other bound key is still down.
				var still = false, codes = self.binds[ acts[ i ] ];
				for ( var j = 0; j < codes.length; j++ ) {
					if ( self.keys[ codes[ j ] ] ) { still = true; break; }
				}
				if ( !still ) {
					self.actions[ acts[ i ] ] = false;
					self.released[ acts[ i ] ] = true;
				}
			}
		}
	}, false );

	// Losing focus mid-strafe would otherwise leave the key stuck down.
	global.addEventListener( "blur", function() { self.clearAll(); } );

	document.addEventListener( "pointerlockchange", function() {
		var was = self.locked;
		self.locked = document.pointerLockElement === self.el;
		if ( !self.locked ) {
			self.clearAll();
			if ( was ) self._emit( "unlock" );
		} else if ( !was ) {
			self._emit( "lock" );
		}
	}, false );

	document.addEventListener( "pointerlockerror", function() {
		self.locked = false;
	}, false );

	global.addEventListener( "mousemove", function( e ) {
		if ( !self.locked || !self.enabled ) return;
		var mx = e.movementX, my = e.movementY;
		if ( mx === undefined ) return;
		// Chrome can emit a single enormous delta on lock acquisition; drop it.
		if ( Math.abs( mx ) > 500 || Math.abs( my ) > 500 ) return;
		self.mouseDX += mx;
		self.mouseDY += my;
	}, false );

	global.addEventListener( "mousedown", function( e ) {
		if ( !self.enabled ) return;
		if ( e.button < 3 && !self.buttons[ e.button ] ) {
			self.buttons[ e.button ] = true;
			self.buttonPressed[ e.button ] = true;
		}
		if ( self.locked ) e.preventDefault();
	}, false );

	global.addEventListener( "mouseup", function( e ) {
		if ( e.button < 3 ) {
			self.buttons[ e.button ] = false;
			self.buttonReleased[ e.button ] = true;
		}
	}, false );

	global.addEventListener( "wheel", function( e ) {
		if ( !self.locked || !self.enabled ) return;
		self.wheel += Math.sign( e.deltaY );
		e.preventDefault();
	}, { passive: false } );

	global.addEventListener( "contextmenu", function( e ) {
		if ( self.locked ) e.preventDefault();
	}, false );
};

Input.prototype._typing = function( e ) {
	var t = e.target;
	return t && ( t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable );
};

/* Stop the browser acting on keys the game owns — Tab moving focus, Space
 * scrolling, / opening quick-find — but only while pointer-locked so the menus
 * keep normal keyboard behaviour. */
Input.prototype._maybePrevent = function( e ) {
	if ( !this.locked ) return;
	if ( e.code === "Tab" || e.code === "Space" || e.code.indexOf( "Arrow" ) === 0 ||
	     e.code === "Slash" || e.code === "Quote" ) {
		e.preventDefault();
	}
};

Input.prototype.clearAll = function() {
	this.keys = Object.create( null );
	this.actions = Object.create( null );
	this.buttons[ 0 ] = this.buttons[ 1 ] = this.buttons[ 2 ] = false;
	this.mouseDX = this.mouseDY = 0;
};

Input.prototype.requestLock = function() {
	if ( this.locked ) return;
	var p = this.el.requestPointerLock( { unadjustedMovement: this.rawInput } );
	// unadjustedMovement is unsupported on some platforms and rejects; retry plain.
	if ( p && p.catch ) {
		var self = this;
		p.catch( function() {
			try { self.el.requestPointerLock(); } catch ( e ) {}
		} );
	}
};

Input.prototype.exitLock = function() {
	if ( document.pointerLockElement ) document.exitPointerLock();
};

Input.prototype.on = function( evt, fn ) { this._listeners[ evt ].push( fn ); };
Input.prototype._emit = function( evt ) {
	var l = this._listeners[ evt ];
	for ( var i = 0; i < l.length; i++ ) l[ i ]();
};

/* ---------- per-frame query API ---------- */

Input.prototype.down = function( action ) { return !!this.actions[ action ]; };
Input.prototype.justPressed = function( action ) { return !!this.pressed[ action ]; };
Input.prototype.justReleased = function( action ) { return !!this.released[ action ]; };
Input.prototype.mouseDown = function( b ) { return this.buttons[ b ]; };
Input.prototype.mouseJustPressed = function( b ) { return this.buttonPressed[ b ]; };
Input.prototype.mouseJustReleased = function( b ) { return this.buttonReleased[ b ]; };

/* Consume accumulated look delta. Returns radians. */
Input.prototype.takeLook = function( sensScale ) {
	var s = this.sensitivity * ( sensScale === undefined ? 1 : sensScale );
	var yaw = -this.mouseDX * s;
	var pitch = -this.mouseDY * s * ( this.invertY ? -1 : 1 );
	this.mouseDX = 0;
	this.mouseDY = 0;
	return { yaw: yaw, pitch: pitch };
};

Input.prototype.takeWheel = function() {
	var w = this.wheel;
	this.wheel = 0;
	return w;
};

/* Called at the very end of each frame. */
Input.prototype.endFrame = function() {
	this.pressed = Object.create( null );
	this.released = Object.create( null );
	this.buttonPressed[ 0 ] = this.buttonPressed[ 1 ] = this.buttonPressed[ 2 ] = false;
	this.buttonReleased[ 0 ] = this.buttonReleased[ 1 ] = this.buttonReleased[ 2 ] = false;
};

/* Normalised movement vector in local space (x = strafe, z = forward). */
Input.prototype.moveAxis = function( out ) {
	out = out || { x: 0, z: 0 };
	var x = ( this.down( "right" ) ? 1 : 0 ) - ( this.down( "left" ) ? 1 : 0 );
	var z = ( this.down( "forward" ) ? 1 : 0 ) - ( this.down( "back" ) ? 1 : 0 );
	if ( x !== 0 && z !== 0 ) {
		// Diagonal input must not be faster than cardinal.
		var inv = Math.SQRT1_2;
		x *= inv; z *= inv;
	}
	out.x = x; out.z = z;
	return out;
};

Input.KEY_LABELS = {
	Space: "SPACE", ControlLeft: "L-CTRL", ControlRight: "R-CTRL",
	ShiftLeft: "L-SHIFT", ShiftRight: "R-SHIFT", AltLeft: "L-ALT",
	Tab: "TAB", Enter: "ENTER", Escape: "ESC", Backspace: "BKSP",
	ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→"
};

Input.label = function( code ) {
	if ( !code ) return "—";
	if ( Input.KEY_LABELS[ code ] ) return Input.KEY_LABELS[ code ];
	if ( code.indexOf( "Key" ) === 0 ) return code.slice( 3 );
	if ( code.indexOf( "Digit" ) === 0 ) return code.slice( 5 );
	if ( code.indexOf( "Numpad" ) === 0 ) return "NUM" + code.slice( 6 );
	return code.toUpperCase();
};

DE.Input = Input;
DE.DEFAULT_BINDS = DEFAULT_BINDS;

} )( window );
