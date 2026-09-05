/* DEADEYE — menus
 *
 * A small screen stack over the DOM. The same code drives the pre-match menu
 * and the in-game pause menu; `game.state` decides which buttons appear.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

function Menu( game, root ) {
	this.game = game;
	this.root = root;
	this.stack = [];
	this.cfg = {
		mode: U.storage.get( "mode", "ffa" ),
		map: U.storage.get( "map", "dune" ),
		bots: U.storage.get( "bots", 7 ),
		difficulty: U.storage.get( "difficulty", "regular" ),
		primary: U.storage.get( "primary", "rk77" ),
		secondary: U.storage.get( "secondary", "p9" ),
		playerName: U.storage.get( "name", "PLAYER" )
	};
	this.rebindAction = null;

	this.screens = {};
	var ids = [ "main", "play", "loadout", "settings", "controls", "pause", "multiplayer" ];
	for ( var i = 0; i < ids.length; i++ ) {
		this.screens[ ids[ i ] ] = root.querySelector( "#screen-" + ids[ i ] );
	}
	this.overlay = root.querySelector( "#menu-overlay" );

	this._wire();
	this._buildPlay();
	this._buildLoadout();
	this._buildSettings();
	this._buildControls();
	this.show( "main" );
}

Menu.prototype._wire = function() {
	var self = this;
	this.root.addEventListener( "click", function( e ) {
		var btn = e.target.closest( "[data-go]" );
		if ( btn ) {
			DE.audio.ui( "click" );
			var go = btn.getAttribute( "data-go" );
			if ( go === "back" ) self.back();
			else self.show( go );
			return;
		}
		var act = e.target.closest( "[data-act]" );
		if ( act ) {
			DE.audio.ui( "click" );
			self._action( act.getAttribute( "data-act" ), act );
		}
	} );
	this.root.addEventListener( "mouseover", function( e ) {
		if ( e.target.closest( "button, .card, .wcard" ) ) DE.audio.ui( "hover" );
	} );

	// Key capture for rebinding.
	global.addEventListener( "keydown", function( e ) {
		if ( !self.rebindAction ) return;
		e.preventDefault();
		if ( e.code !== "Escape" ) {
			self.game.input.setBind( self.rebindAction, [ e.code ] );
		}
		self.rebindAction = null;
		self._buildControls();
	}, true );
};

Menu.prototype._action = function( name, el ) {
	var g = this.game;
	switch ( name ) {
		case "deploy":
			this.hide();
			g.startMatch( this.cfg );
			g.input.requestLock();
			DE.audio.ui( "start" );
			break;
		case "resume":
			this.hide();
			g.input.requestLock();
			break;
		case "quit":
			g.state = "menu";
			g.clearBots();
			this.show( "main" );
			break;
		case "rematch":
			g.hud.hideResults();
			this.hide();
			g.startMatch( this.cfg );
			g.input.requestLock();
			break;
		case "reset-binds":
			g.input.resetBinds();
			this._buildControls();
			break;
	}
};

/* ---------- screen stack ---------- */

Menu.prototype.show = function( id ) {
	for ( var k in this.screens ) {
		if ( this.screens[ k ] ) this.screens[ k ].classList.remove( "show" );
	}
	if ( this.screens[ id ] ) this.screens[ id ].classList.add( "show" );
	this.overlay.classList.add( "show" );
	this.current = id;
	if ( id !== "pause" && id !== "main" ) {
		if ( this.stack[ this.stack.length - 1 ] !== id ) this.stack.push( id );
	} else {
		this.stack = [ id ];
	}
	if ( id === "settings" ) this._syncSettings();
	if ( id === "controls" ) this._buildControls();
};

Menu.prototype.back = function() {
	DE.audio.ui( "back" );
	this.stack.pop();
	var prev = this.stack.length ? this.stack[ this.stack.length - 1 ]
	         : ( this.game.state === "playing" ? "pause" : "main" );
	this.stack.pop();
	this.show( prev );
};

Menu.prototype.hide = function() {
	this.overlay.classList.remove( "show" );
	for ( var k in this.screens ) {
		if ( this.screens[ k ] ) this.screens[ k ].classList.remove( "show" );
	}
	this.current = null;
};

Menu.prototype.isOpen = function() { return !!this.current; };

Menu.prototype.openPause = function() {
	this.stack = [];
	this.show( "pause" );
};

/* ---------- play screen ---------- */

Menu.prototype._buildPlay = function() {
	var self = this, g = this.game;
	var mapWrap = this.root.querySelector( "#map-list" );
	var html = "";
	for ( var i = 0; i < DE.MAP_ORDER.length; i++ ) {
		var id = DE.MAP_ORDER[ i ];
		var m = DE.MAPS[ id ];
		html += "<div class=\"card map-card\" data-map=\"" + id + "\">" +
		        "<div class=\"thumb\" data-thumb=\"" + id + "\"></div>" +
		        "<div class=\"card-name\">" + m.name + "</div>" +
		        "<div class=\"card-sub\">" + m.subtitle + "</div></div>";
	}
	mapWrap.innerHTML = html;
	this._paintThumbs();

	mapWrap.addEventListener( "click", function( e ) {
		var c = e.target.closest( "[data-map]" );
		if ( !c ) return;
		self.cfg.map = c.getAttribute( "data-map" );
		U.storage.set( "map", self.cfg.map );
		self._syncPlay();
	} );

	this.root.querySelector( "#mode-list" ).addEventListener( "click", function( e ) {
		var c = e.target.closest( "[data-mode]" );
		if ( !c ) return;
		self.cfg.mode = c.getAttribute( "data-mode" );
		U.storage.set( "mode", self.cfg.mode );
		self._syncPlay();
	} );

	this.root.querySelector( "#diff-list" ).addEventListener( "click", function( e ) {
		var c = e.target.closest( "[data-diff]" );
		if ( !c ) return;
		self.cfg.difficulty = c.getAttribute( "data-diff" );
		U.storage.set( "difficulty", self.cfg.difficulty );
		self._syncPlay();
	} );

	var botSlider = this.root.querySelector( "#bot-count" );
	botSlider.value = this.cfg.bots;
	botSlider.addEventListener( "input", function() {
		self.cfg.bots = parseInt( botSlider.value, 10 );
		U.storage.set( "bots", self.cfg.bots );
		self.root.querySelector( "#bot-count-label" ).textContent = self.cfg.bots;
	} );

	var nameInput = this.root.querySelector( "#player-name" );
	nameInput.value = this.cfg.playerName;
	nameInput.addEventListener( "input", function() {
		self.cfg.playerName = nameInput.value.slice( 0, 14 ).toUpperCase() || "PLAYER";
		U.storage.set( "name", self.cfg.playerName );
	} );

	this._syncPlay();
};

/* Paint a tiny top-down sketch of each map as its thumbnail, generated from
 * the map's own collider set — so the picture can never drift from the level. */
Menu.prototype._paintThumbs = function() {
	var nodes = this.root.querySelectorAll( "[data-thumb]" );
	for ( var i = 0; i < nodes.length; i++ ) {
		var el = nodes[ i ];
		var id = el.getAttribute( "data-thumb" );
		var built = DE.buildMap( id, 1337 );
		var def = built.def;

		var W = 220, H = 132;
		var cv = document.createElement( "canvas" );
		cv.width = W * 2; cv.height = H * 2;
		cv.style.width = "100%"; cv.style.height = "100%";
		var ctx = cv.getContext( "2d" );
		ctx.scale( 2, 2 );

		var half = built.play || 40;
		var sc = Math.min( W, H ) / ( half * 2.15 );

		var grd = ctx.createLinearGradient( 0, 0, 0, H );
		grd.addColorStop( 0, "#" + ( def.sky.top ).toString( 16 ).padStart( 6, "0" ) );
		grd.addColorStop( 1, "#" + ( def.sky.bottom ).toString( 16 ).padStart( 6, "0" ) );
		ctx.fillStyle = grd;
		ctx.fillRect( 0, 0, W, H );
		ctx.fillStyle = "rgba(0,0,0,0.42)";
		ctx.fillRect( 0, 0, W, H );

		// Draw colliders as footprints, darker where taller.
		var cols = built.colliders;
		for ( var c = 0; c < cols.length; c++ ) {
			var col = cols[ c ];
			if ( col.tag === DE.SURFACE.CLIP ) continue;
			var top = col.cy + col.hy;
			if ( top < 0.35 ) continue;            // skip ground slabs
			if ( col.hx > half * 0.9 || col.hz > half * 0.9 ) continue;  // skip walls
			var a = U.clamp( 0.16 + top * 0.055, 0.16, 0.62 );
			ctx.fillStyle = "rgba(255,255,255," + a.toFixed( 2 ) + ")";
			ctx.save();
			ctx.translate( W / 2 + col.cx * sc, H / 2 + col.cz * sc );
			ctx.rotate( col.yaw );
			ctx.fillRect( -col.hx * sc, -col.hz * sc, col.hx * 2 * sc, col.hz * 2 * sc );
			ctx.restore();
		}

		// Spawn markers.
		ctx.fillStyle = "rgba(255,214,102,0.95)";
		for ( var s = 0; s < def.spawns.length; s++ ) {
			var sp = def.spawns[ s ];
			ctx.beginPath();
			ctx.arc( W / 2 + sp.x * sc, H / 2 + sp.z * sc, 1.7, 0, 6.283 );
			ctx.fill();
		}

		el.innerHTML = "";
		el.appendChild( cv );
	}
};

Menu.prototype._syncPlay = function() {
	var r = this.root;
	function mark( sel, attr, value ) {
		var els = r.querySelectorAll( sel );
		for ( var i = 0; i < els.length; i++ ) {
			els[ i ].classList.toggle( "sel", els[ i ].getAttribute( attr ) === value );
		}
	}
	mark( "[data-map]", "data-map", this.cfg.map );
	mark( "[data-mode]", "data-mode", this.cfg.mode );
	mark( "[data-diff]", "data-diff", this.cfg.difficulty );
	r.querySelector( "#bot-count-label" ).textContent = this.cfg.bots;
};

/* ---------- loadout ---------- */

Menu.prototype._buildLoadout = function() {
	var self = this;

	function cards( list, attr ) {
		var out = "";
		for ( var i = 0; i < list.length; i++ ) {
			var w = DE.WEAPONS[ list[ i ] ];
			var ttk = w.melee || w.grenade ? "—"
			        : Math.ceil( 100 / w.damage ) + " shots";
			out += "<div class=\"wcard\" " + attr + "=\"" + w.id + "\">" +
			  "<div class=\"wcard-top\"><span class=\"wname\">" + w.name + "</span>" +
			  "<span class=\"wcls\">" + w.cls + "</span></div>" +
			  "<div class=\"wstats\">" +
			    stat( "DMG", w.damage, 100 ) +
			    stat( "RPM", w.rpm, 950 ) +
			    stat( "RANGE", Math.round( w.falloffStart ), 90 ) +
			    stat( "MOBILITY", Math.round( w.moveMult * 100 ), 125 ) +
			  "</div>" +
			  "<div class=\"wmeta\"><span>" + w.magSize + " rnd</span><span>" +
			  ttk + " to kill</span></div></div>";
		}
		return out;
	}
	function stat( label, v, max ) {
		var pct = U.clamp( v / max, 0, 1 ) * 100;
		return "<div class=\"wstat\"><span>" + label + "</span>" +
		       "<div class=\"bar\"><i style=\"width:" + pct.toFixed( 0 ) + "%\"></i></div>" +
		       "<b>" + v + "</b></div>";
	}

	this.root.querySelector( "#primary-list" ).innerHTML =
		cards( DE.PRIMARIES, "data-primary" );
	this.root.querySelector( "#secondary-list" ).innerHTML =
		cards( DE.SECONDARIES, "data-secondary" );

	this.root.querySelector( "#screen-loadout" ).addEventListener( "click", function( e ) {
		var p = e.target.closest( "[data-primary]" );
		if ( p ) {
			self.cfg.primary = p.getAttribute( "data-primary" );
			U.storage.set( "primary", self.cfg.primary );
		}
		var s = e.target.closest( "[data-secondary]" );
		if ( s ) {
			self.cfg.secondary = s.getAttribute( "data-secondary" );
			U.storage.set( "secondary", self.cfg.secondary );
		}
		if ( p || s ) {
			self._syncLoadout();
			// Apply immediately if a match is already running.
			if ( self.game.state === "playing" ) {
				self.game.player.setLoadout( self.cfg.primary, self.cfg.secondary );
			}
		}
	} );
	this._syncLoadout();
};

Menu.prototype._syncLoadout = function() {
	var r = this.root, cfg = this.cfg;
	var a = r.querySelectorAll( "[data-primary]" );
	for ( var i = 0; i < a.length; i++ ) {
		a[ i ].classList.toggle( "sel", a[ i ].getAttribute( "data-primary" ) === cfg.primary );
	}
	var b = r.querySelectorAll( "[data-secondary]" );
	for ( var j = 0; j < b.length; j++ ) {
		b[ j ].classList.toggle( "sel", b[ j ].getAttribute( "data-secondary" ) === cfg.secondary );
	}
};

/* ---------- settings ---------- */

Menu.prototype._buildSettings = function() {
	var self = this, g = this.game, r = this.root;

	function slider( id, get, set, fmt ) {
		var el = r.querySelector( id );
		var lab = r.querySelector( id + "-label" );
		el.addEventListener( "input", function() {
			set( parseFloat( el.value ) );
			lab.textContent = fmt( parseFloat( el.value ) );
		} );
	}

	slider( "#set-sens", null, function( v ) {
		g.input.setSensitivity( v / 10000 );
	}, function( v ) { return ( v / 100 ).toFixed( 2 ); } );

	slider( "#set-adssens", null, function( v ) {
		g.input.adsSensScale = v / 100;
		U.storage.set( "adsSens", g.input.adsSensScale );
	}, function( v ) { return ( v / 100 ).toFixed( 2 ); } );

	slider( "#set-fov", null, function( v ) {
		g.settings.fov = v;
		g.player.fovBase = v;
		U.storage.set( "fov", v );
	}, function( v ) { return v + "°"; } );

	slider( "#set-vol-master", null, function( v ) {
		DE.audio.setVolume( "master", v / 100 );
		U.storage.set( "volMaster", v / 100 );
	}, function( v ) { return v + "%"; } );

	slider( "#set-vol-sfx", null, function( v ) {
		DE.audio.setVolume( "sfx", v / 100 );
		U.storage.set( "volSfx", v / 100 );
	}, function( v ) { return v + "%"; } );

	slider( "#set-vol-amb", null, function( v ) {
		DE.audio.setVolume( "ambient", v / 100 );
		U.storage.set( "volAmb", v / 100 );
	}, function( v ) { return v + "%"; } );

	r.querySelector( "#set-invert" ).addEventListener( "change", function( e ) {
		g.input.invertY = e.target.checked;
		U.storage.set( "invertY", e.target.checked );
	} );
	r.querySelector( "#set-shadows" ).addEventListener( "change", function( e ) {
		g.settings.shadows = e.target.checked;
		g.applyQuality();
	} );
	r.querySelector( "#set-fps" ).addEventListener( "change", function( e ) {
		g.settings.showFps = e.target.checked;
		U.storage.set( "showFps", e.target.checked );
	} );
	r.querySelector( "#set-quality" ).addEventListener( "change", function( e ) {
		g.settings.quality = e.target.value;
		g.applyQuality();
	} );
};

Menu.prototype._syncSettings = function() {
	var g = this.game, r = this.root;
	function set( id, v, fmt ) {
		var el = r.querySelector( id );
		el.value = v;
		var lab = r.querySelector( id + "-label" );
		if ( lab ) lab.textContent = fmt( v );
	}
	set( "#set-sens", Math.round( g.input.sensitivity * 10000 ),
	     function( v ) { return ( v / 100 ).toFixed( 2 ); } );
	set( "#set-adssens", Math.round( g.input.adsSensScale * 100 ),
	     function( v ) { return ( v / 100 ).toFixed( 2 ); } );
	set( "#set-fov", g.settings.fov, function( v ) { return v + "°"; } );
	set( "#set-vol-master", Math.round( DE.audio.volumes.master * 100 ),
	     function( v ) { return v + "%"; } );
	set( "#set-vol-sfx", Math.round( DE.audio.volumes.sfx * 100 ),
	     function( v ) { return v + "%"; } );
	set( "#set-vol-amb", Math.round( DE.audio.volumes.ambient * 100 ),
	     function( v ) { return v + "%"; } );
	r.querySelector( "#set-invert" ).checked = g.input.invertY;
	r.querySelector( "#set-shadows" ).checked = g.settings.shadows;
	r.querySelector( "#set-fps" ).checked = g.settings.showFps;
	r.querySelector( "#set-quality" ).value = g.settings.quality;
};

/* ---------- controls ---------- */

Menu.prototype._buildControls = function() {
	var self = this;
	var labels = {
		forward: "MOVE FORWARD", back: "MOVE BACK", left: "STRAFE LEFT",
		right: "STRAFE RIGHT", jump: "JUMP", crouch: "CROUCH", sprint: "SPRINT",
		reload: "RELOAD", melee: "MELEE", grenade: "GRENADE",
		slot1: "PRIMARY", slot2: "SECONDARY", slot3: "KNIFE",
		lastWeapon: "LAST WEAPON", scoreboard: "SCOREBOARD"
	};
	var binds = this.game.input.binds;
	var html = "";
	for ( var k in labels ) {
		var codes = binds[ k ] || [];
		html += "<div class=\"bindrow\"><span>" + labels[ k ] + "</span>" +
		        "<button class=\"bindkey" + ( this.rebindAction === k ? " listening" : "" ) +
		        "\" data-bind=\"" + k + "\">" +
		        ( this.rebindAction === k ? "PRESS A KEY"
		          : codes.map( DE.Input.label ).join( " / " ) ) +
		        "</button></div>";
	}
	html += "<div class=\"bindrow static\"><span>FIRE</span><b>MOUSE 1</b></div>" +
	        "<div class=\"bindrow static\"><span>AIM</span><b>MOUSE 2</b></div>" +
	        "<div class=\"bindrow static\"><span>SWITCH WEAPON</span><b>SCROLL</b></div>" +
	        "<div class=\"bindrow static\"><span>PAUSE</span><b>ESC</b></div>";

	var wrap = this.root.querySelector( "#bind-list" );
	wrap.innerHTML = html;
	wrap.onclick = function( e ) {
		var b = e.target.closest( "[data-bind]" );
		if ( !b ) return;
		DE.audio.ui( "click" );
		self.rebindAction = b.getAttribute( "data-bind" );
		self._buildControls();
	};
};

DE.Menu = Menu;

} )( window );
