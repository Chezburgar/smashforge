/* DEADEYE — bootstrap and main loop */
( function( global ) {
"use strict";

var DE = global.DE;
var U = DE.util;

var game, hud, menu;
var last = 0;
var running = false;

function boot() {
	var canvas = document.getElementById( "view" );

	try {
		game = new DE.Game( { canvas: canvas } );
	} catch ( e ) {
		fail( "This browser could not start WebGL.", e );
		return;
	}

	hud = new DE.HUD( game, document.body );
	game.hud = hud;
	menu = new DE.Menu( game, document.body );
	game.menu = menu;
	DE.net.attach( game, menu );

	/* Restore stored audio levels before the context exists; the values are
	 * applied again on first resume. */
	DE.audio.volumes.master = U.storage.get( "volMaster", 0.8 );
	DE.audio.volumes.sfx = U.storage.get( "volSfx", 1.0 );
	DE.audio.volumes.ambient = U.storage.get( "volAmb", 0.5 );

	global.addEventListener( "resize", function() {
		game.resize();
		hud.resize();
	} );

	/* Escape / losing pointer lock opens the pause menu mid-match. */
	game.input.on( "unlock", function() {
		if ( game.state === "playing" && !menu.isOpen() ) {
			menu.openPause();
		}
	} );

	document.addEventListener( "keydown", function( e ) {
		if ( e.code !== "Escape" ) return;
		if ( game.state === "playing" ) {
			if ( menu.isOpen() ) {
				if ( menu.current === "pause" ) {
					menu.hide();
					game.input.requestLock();
				} else {
					menu.back();
				}
			} else {
				game.input.exitLock();
				menu.openPause();
			}
		}
	} );

	/* Click anywhere on the canvas to (re)capture the mouse. */
	canvas.addEventListener( "mousedown", function() {
		DE.audio.resume();
		if ( game.state === "playing" && !menu.isOpen() && !game.input.locked ) {
			game.input.requestLock();
		}
	} );

	/* Respawn on click / space from the death screen. */
	document.addEventListener( "mousedown", function() {
		if ( game.state === "playing" && !game.player.alive &&
		     game.player.respawnAt !== undefined && game.time >= game.player.respawnAt ) {
			game.respawnPlayer();
			game.input.requestLock();
		}
	} );

	document.getElementById( "boot" ).classList.add( "gone" );
	running = true;
	last = performance.now();
	requestAnimationFrame( frame );
}

function frame( now ) {
	requestAnimationFrame( frame );
	var dt = ( now - last ) / 1000;
	last = now;
	// Clamp so an alt-tab or a GC pause can't teleport anyone through a wall.
	if ( dt > 0.05 ) dt = 0.05;
	if ( dt <= 0 ) return;

	game.fps.push( 1 / dt );

	// The HUD is hidden by CSS outside a match, so toggling one class keeps
	// every panel's visibility in one place.
	document.body.classList.toggle( "playing",
		game.state === "playing" && !menu.isOpen() && game.player.alive );

	if ( game.state === "playing" || game.state === "ended" ) {
		game.update( dt );
		DE.net.update( dt );
		game.render();
		hud.update( dt );
	} else {
		// Idle in the menu: keep the canvas cleared to the map palette.
		game.renderer.clear();
		hud.update( dt );
	}

	game.input.endFrame();
}

function fail( msg, err ) {
	var b = document.getElementById( "boot" );
	b.innerHTML = "<div class=\"boot-fail\"><h1>DEADEYE</h1><p>" + U.esc( msg ) +
	              "</p><pre>" + U.esc( err && err.message ? err.message : "" ) + "</pre></div>";
	if ( err ) console.error( err );
}

if ( document.readyState === "loading" ) {
	document.addEventListener( "DOMContentLoaded", boot );
} else {
	boot();
}

} )( window );
