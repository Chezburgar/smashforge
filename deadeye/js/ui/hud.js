/* DEADEYE — heads-up display
 *
 * The crosshair, hit feedback and damage indicators are drawn on a 2D canvas
 * because they change every frame and need to track the dynamic spread value;
 * everything with text (ammo, killfeed, scoreboard) is DOM, which is cheaper to
 * lay out and far easier to style.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;

function HUD( game, root ) {
	this.game = game;
	this.root = root;
	this.canvas = root.querySelector( "#hud-canvas" );
	this.ctx = this.canvas.getContext( "2d" );

	this.el = {
		health: root.querySelector( "#hud-health-value" ),
		healthBar: root.querySelector( "#hud-health-bar" ),
		ammoMag: root.querySelector( "#hud-ammo-mag" ),
		ammoReserve: root.querySelector( "#hud-ammo-reserve" ),
		weaponName: root.querySelector( "#hud-weapon-name" ),
		grenades: root.querySelector( "#hud-grenades" ),
		killfeed: root.querySelector( "#hud-killfeed" ),
		score: root.querySelector( "#hud-score" ),
		timer: root.querySelector( "#hud-timer" ),
		scoreboard: root.querySelector( "#scoreboard" ),
		scoreboardBody: root.querySelector( "#scoreboard-body" ),
		scoreboardTitle: root.querySelector( "#scoreboard-title" ),
		death: root.querySelector( "#death-screen" ),
		deathBy: root.querySelector( "#death-by" ),
		deathTimer: root.querySelector( "#death-timer" ),
		notify: root.querySelector( "#hud-notify" ),
		streak: root.querySelector( "#hud-streak" ),
		fps: root.querySelector( "#hud-fps" ),
		results: root.querySelector( "#results" ),
		resultsBody: root.querySelector( "#results-body" ),
		resultsTitle: root.querySelector( "#results-title" ),
		hint: root.querySelector( "#hud-hint" ),
		reloadPrompt: root.querySelector( "#hud-reload-prompt" )
	};

	this.hitT = 0;
	this.hitHead = false;
	this.killT = 0;
	this.damageDirs = [];     // { angle, t }
	this.notifyT = 0;
	this.streakT = 0;
	this.autoRespawn = true;
	this.showScoreboard = false;
	this._lastKillfeedLen = -1;
	this._lastAmmo = "";
	this._lastHealth = -1;

	this.resize();
}

HUD.prototype.resize = function() {
	var dpr = Math.min( global.devicePixelRatio || 1, 2 );
	this.canvas.width = global.innerWidth * dpr;
	this.canvas.height = global.innerHeight * dpr;
	this.canvas.style.width = global.innerWidth + "px";
	this.canvas.style.height = global.innerHeight + "px";
	this.ctx.setTransform( dpr, 0, 0, dpr, 0, 0 );
	this.w = global.innerWidth;
	this.h = global.innerHeight;
};

/* ---------- events ---------- */

HUD.prototype.hitmarker = function( head ) {
	this.hitT = 0.28;
	this.hitHead = head;
};

HUD.prototype.showKill = function( victim, streak ) {
	this.killT = 0.5;
	if ( streak >= 2 ) {
		this.streakT = 2.2;
		var labels = { 2: "DOUBLE", 3: "TRIPLE", 4: "RAMPAGE", 5: "UNSTOPPABLE",
		               7: "DOMINATING", 10: "LEGENDARY" };
		this.streakLabel = labels[ streak ] || ( streak + " KILL STREAK" );
		this.el.streak.textContent = this.streakLabel;
		this.el.streak.classList.add( "show" );
	}
};

/* `angle` is relative to the player's facing: 0 = front, PI = behind. */
HUD.prototype.damageFlash = function( severity, angle ) {
	if ( angle !== null && angle !== undefined ) {
		this.damageDirs.push( { angle: angle, t: 1.1, sev: severity } );
		if ( this.damageDirs.length > 6 ) this.damageDirs.shift();
	}
	this.hurtT = Math.min( 1, ( this.hurtT || 0 ) + severity * 0.9 );
};

HUD.prototype.notify = function( text ) {
	this.el.notify.textContent = text;
	this.el.notify.classList.add( "show" );
	this.notifyT = 1.4;
};

HUD.prototype.showDeath = function( source, cause ) {
	var by = source ? U.esc( source.name )
	       : ( cause === "void" ? "THE FALL" : ( cause === "fall" ? "THE FALL" : "—" ) );
	this.el.deathBy.innerHTML = source ? "ELIMINATED BY <b>" + by + "</b>"
	                                   : "ELIMINATED BY " + by;
	this.el.death.classList.add( "show" );
};

HUD.prototype.hideDeath = function() {
	this.el.death.classList.remove( "show" );
};

HUD.prototype.showResults = function() {
	var g = this.game;
	var rows = g.scoreboard();
	var title;
	if ( g.teamMode ) {
		var win = g.teamScore[ 0 ] > g.teamScore[ 1 ] ? 0
		        : ( g.teamScore[ 1 ] > g.teamScore[ 0 ] ? 1 : -1 );
		title = win === -1 ? "DRAW"
		      : ( win === g.player.team ? "VICTORY" : "DEFEAT" );
	} else {
		title = rows[ 0 ] && rows[ 0 ].isPlayer ? "VICTORY" : "MATCH OVER";
	}
	this.el.resultsTitle.textContent = title;
	this.el.resultsTitle.className = title === "VICTORY" ? "win" : "lose";
	this.el.resultsBody.innerHTML = this._rowsHtml( rows );
	this.el.results.classList.add( "show" );
	this.el.death.classList.remove( "show" );
};

HUD.prototype.hideResults = function() {
	this.el.results.classList.remove( "show" );
};

HUD.prototype._rowsHtml = function( rows ) {
	var g = this.game;
	var out = "";
	for ( var i = 0; i < rows.length; i++ ) {
		var r = rows[ i ];
		var cls = r.isPlayer ? " class=\"me\"" : "";
		var team = g.teamMode ? "<span class=\"team t" + r.team + "\"></span>" : "";
		out += "<tr" + cls + "><td>" + ( i + 1 ) + "</td><td>" + team +
		       U.esc( r.name ) + "</td><td>" + r.kills + "</td><td>" + r.deaths +
		       "</td><td>" + ( r.deaths ? ( r.kills / r.deaths ).toFixed( 2 ) : r.kills.toFixed( 2 ) ) +
		       "</td></tr>";
	}
	return out;
};

/* ---------- per-frame ---------- */

HUD.prototype.update = function( dt ) {
	var g = this.game, p = g.player;

	if ( this.hitT > 0 ) this.hitT -= dt;
	if ( this.killT > 0 ) this.killT -= dt;
	if ( this.hurtT > 0 ) this.hurtT = Math.max( 0, this.hurtT - dt * 1.6 );
	for ( var i = this.damageDirs.length - 1; i >= 0; i-- ) {
		this.damageDirs[ i ].t -= dt;
		if ( this.damageDirs[ i ].t <= 0 ) this.damageDirs.splice( i, 1 );
	}
	if ( this.notifyT > 0 ) {
		this.notifyT -= dt;
		if ( this.notifyT <= 0 ) this.el.notify.classList.remove( "show" );
	}
	if ( this.streakT > 0 ) {
		this.streakT -= dt;
		if ( this.streakT <= 0 ) this.el.streak.classList.remove( "show" );
	}

	this._updateText( dt );
	this._draw( dt );
};

HUD.prototype._updateText = function( dt ) {
	var g = this.game, p = g.player;
	var def = p.def();
	var am = p.ammo[ def.id ];

	/* health */
	var hp = Math.max( 0, Math.round( p.health ) );
	if ( hp !== this._lastHealth ) {
		this._lastHealth = hp;
		this.el.health.textContent = hp;
		this.el.healthBar.style.width = ( hp / p.maxHealth * 100 ) + "%";
		this.el.healthBar.className = hp <= 25 ? "critical" : ( hp <= 55 ? "low" : "" );
	}

	/* ammo */
	var magStr, resStr;
	if ( def.melee ) { magStr = "—"; resStr = ""; }
	else if ( def.grenade ) { magStr = p.grenades; resStr = ""; }
	else { magStr = am ? am.mag : 0; resStr = am ? am.reserve : 0; }
	var key = def.id + "|" + magStr + "|" + resStr;
	if ( key !== this._lastAmmo ) {
		this._lastAmmo = key;
		this.el.ammoMag.textContent = magStr;
		this.el.ammoReserve.textContent = resStr === "" ? "" : "/ " + resStr;
		this.el.weaponName.textContent = def.name;
		this.el.ammoMag.className = ( !def.melee && !def.grenade && am &&
		                              am.mag <= def.magSize * 0.25 ) ? "low" : "";
		this.el.grenades.textContent = p.grenades;
	}

	var needsReload = !def.melee && !def.grenade && am && am.mag === 0 && am.reserve > 0;
	this.el.reloadPrompt.classList.toggle( "show", !!needsReload && p.alive );

	/* score & timer */
	if ( g.teamMode ) {
		this.el.score.innerHTML = "<span class=\"t0\">" + g.teamScore[ 0 ] +
		                          "</span><i>:</i><span class=\"t1\">" +
		                          g.teamScore[ 1 ] + "</span>";
	} else {
		this.el.score.innerHTML = "<span>" + p.kills + "</span><i>/</i><span class=\"dim\">" +
		                          g.mode.scoreLimit + "</span>";
	}
	this.el.timer.textContent = U.formatTime( g.matchTime );
	this.el.timer.classList.toggle( "urgent", g.matchTime < 30 );

	/* killfeed */
	if ( g.killfeed.length !== this._lastKillfeedLen ||
	     ( g.killfeed[ 0 ] && g.killfeed[ 0 ].t !== this._lastKillfeedT ) ) {
		this._lastKillfeedLen = g.killfeed.length;
		this._lastKillfeedT = g.killfeed[ 0 ] ? g.killfeed[ 0 ].t : 0;
		var html = "";
		for ( var i = 0; i < g.killfeed.length; i++ ) {
			var k = g.killfeed[ i ];
			var age = g.time - k.t;
			if ( age > 7 ) continue;
			var kn = k.killer ? U.esc( k.killer ) : "";
			var me = ( k.killer === g.player.name ) || ( k.victim === g.player.name );
			html += "<div class=\"kf" + ( me ? " me" : "" ) + "\">" +
			        ( kn ? "<span class=\"k\">" + kn + "</span>" : "" ) +
			        "<span class=\"x\">" + ( k.killer ? "✖" : "☠" ) + "</span>" +
			        "<span class=\"v\">" + U.esc( k.victim ) + "</span></div>";
		}
		this.el.killfeed.innerHTML = html;
	}

	/* death timer */
	if ( !p.alive && p.respawnAt !== undefined ) {
		var left = Math.max( 0, p.respawnAt - g.time );
		this.el.deathTimer.textContent = left > 0.05 ? left.toFixed( 1 ) : "READY";
	}

	/* scoreboard */
	var want = this.game.input.down( "scoreboard" ) && g.state === "playing";
	if ( want !== this.showScoreboard ) {
		this.showScoreboard = want;
		this.el.scoreboard.classList.toggle( "show", want );
		if ( want ) {
			this.el.scoreboardTitle.textContent =
				g.mode.name + " · " + g.map.def.name;
			this.el.scoreboardBody.innerHTML = this._rowsHtml( g.scoreboard() );
		}
	}

	if ( this.game.settings.showFps ) {
		this.el.fps.textContent = Math.round( this.game.fps.avg() ) + " FPS";
		this.el.fps.style.display = "block";
	} else {
		this.el.fps.style.display = "none";
	}
};

/* ---------- canvas layer ---------- */

HUD.prototype._draw = function( dt ) {
	var ctx = this.ctx, g = this.game, p = g.player;
	var cx = this.w * 0.5, cy = this.h * 0.5;
	ctx.clearRect( 0, 0, this.w, this.h );

	if ( g.state !== "playing" ) return;

	/* --- hurt vignette --- */
	if ( this.hurtT > 0.001 ) {
		var grad = ctx.createRadialGradient( cx, cy, Math.min( this.w, this.h ) * 0.28,
		                                     cx, cy, Math.max( this.w, this.h ) * 0.62 );
		grad.addColorStop( 0, "rgba(180,20,20,0)" );
		grad.addColorStop( 1, "rgba(170,15,15," + ( this.hurtT * 0.6 ).toFixed( 3 ) + ")" );
		ctx.fillStyle = grad;
		ctx.fillRect( 0, 0, this.w, this.h );
	}

	/* --- low-health pulse --- */
	if ( p.alive && p.health <= 30 ) {
		var pulse = 0.10 + Math.sin( g.time * 5 ) * 0.05;
		var g2 = ctx.createRadialGradient( cx, cy, Math.min( this.w, this.h ) * 0.30,
		                                   cx, cy, Math.max( this.w, this.h ) * 0.66 );
		g2.addColorStop( 0, "rgba(150,0,0,0)" );
		g2.addColorStop( 1, "rgba(150,0,0," + pulse.toFixed( 3 ) + ")" );
		ctx.fillStyle = g2;
		ctx.fillRect( 0, 0, this.w, this.h );
	}

	if ( !p.alive ) return;

	/* --- directional damage indicators --- */
	for ( var i = 0; i < this.damageDirs.length; i++ ) {
		var d = this.damageDirs[ i ];
		var a = U.clamp( d.t / 1.1, 0, 1 );
		var r = Math.min( this.w, this.h ) * 0.20;
		ctx.save();
		ctx.translate( cx, cy );
		ctx.rotate( d.angle );
		ctx.globalAlpha = a * 0.85;
		ctx.strokeStyle = "#e8402e";
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc( 0, 0, r, -Math.PI / 2 - 0.34, -Math.PI / 2 + 0.34 );
		ctx.stroke();
		ctx.restore();
	}
	ctx.globalAlpha = 1;

	/* --- crosshair --- */
	var def = p.def();
	if ( p.aiming && def.scope && g.viewmodel.aimT > 0.85 ) {
		this._drawScope( ctx, cx, cy );
	} else {
		this._drawCrosshair( ctx, cx, cy, p, def );
	}

	/* --- hitmarker --- */
	if ( this.hitT > 0 ) {
		var k = U.clamp( this.hitT / 0.28, 0, 1 );
		var size = 11 + ( 1 - k ) * 5;
		ctx.save();
		ctx.globalAlpha = k;
		ctx.strokeStyle = this.hitHead ? "#ff4d4d" : "#ffffff";
		ctx.lineWidth = this.hitHead ? 3 : 2.4;
		ctx.lineCap = "round";
		for ( var q = 0; q < 4; q++ ) {
			var ax = ( q & 1 ) ? 1 : -1;
			var ay = ( q & 2 ) ? 1 : -1;
			ctx.beginPath();
			ctx.moveTo( cx + ax * 5, cy + ay * 5 );
			ctx.lineTo( cx + ax * size, cy + ay * size );
			ctx.stroke();
		}
		ctx.restore();
	}
};

HUD.prototype._drawCrosshair = function( ctx, cx, cy, p, def ) {
	var c = def.crosshair;
	// Gap tracks the actual spread cone, converted to screen pixels through the
	// current projection — so the crosshair tells the truth about accuracy.
	var spreadDeg = p.currentSpread();
	var halfFov = p.fov * 0.5 * U.DEG;
	var pxPerRad = ( this.h * 0.5 ) / Math.tan( halfFov );
	var spreadPx = Math.tan( spreadDeg * U.DEG ) * pxPerRad;
	var gap = Math.max( c.gap * 0.55, Math.min( spreadPx, this.h * 0.32 ) );
	var len = c.len;
	var th = c.thick;

	ctx.save();
	ctx.strokeStyle = "rgba(255,255,255,0.92)";
	ctx.lineWidth = th;
	ctx.lineCap = "butt";
	// Outline for readability on bright surfaces.
	ctx.shadowColor = "rgba(0,0,0,0.85)";
	ctx.shadowBlur = 2;

	var dirs = [ [ 0, -1 ], [ 0, 1 ], [ -1, 0 ], [ 1, 0 ] ];
	for ( var i = 0; i < dirs.length; i++ ) {
		var dx = dirs[ i ][ 0 ], dy = dirs[ i ][ 1 ];
		ctx.beginPath();
		ctx.moveTo( cx + dx * gap, cy + dy * gap );
		ctx.lineTo( cx + dx * ( gap + len ), cy + dy * ( gap + len ) );
		ctx.stroke();
	}
	// Centre dot.
	ctx.shadowBlur = 0;
	ctx.fillStyle = "rgba(255,255,255,0.9)";
	ctx.fillRect( cx - 1, cy - 1, 2, 2 );
	ctx.restore();
};

HUD.prototype._drawScope = function( ctx, cx, cy ) {
	var r = Math.min( this.w, this.h ) * 0.42;
	ctx.save();
	// Black surround outside the scope circle.
	ctx.fillStyle = "#000";
	ctx.beginPath();
	ctx.rect( 0, 0, this.w, this.h );
	ctx.arc( cx, cy, r, 0, Math.PI * 2, true );
	ctx.fill();

	ctx.strokeStyle = "rgba(0,0,0,0.9)";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc( cx, cy, r, 0, Math.PI * 2 );
	ctx.stroke();

	// Reticle.
	ctx.strokeStyle = "rgba(15,15,15,0.95)";
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo( cx - r, cy ); ctx.lineTo( cx - 14, cy );
	ctx.moveTo( cx + 14, cy ); ctx.lineTo( cx + r, cy );
	ctx.moveTo( cx, cy - r ); ctx.lineTo( cx, cy - 14 );
	ctx.moveTo( cx, cy + 14 ); ctx.lineTo( cx, cy + r );
	ctx.stroke();
	// Mil dots below centre.
	for ( var i = 1; i <= 4; i++ ) {
		var y = cy + i * ( r * 0.13 );
		ctx.beginPath();
		ctx.moveTo( cx - 5, y ); ctx.lineTo( cx + 5, y );
		ctx.stroke();
	}
	ctx.fillStyle = "rgba(15,15,15,0.95)";
	ctx.beginPath();
	ctx.arc( cx, cy, 1.6, 0, Math.PI * 2 );
	ctx.fill();
	ctx.restore();
};

DE.HUD = HUD;

} )( window );
