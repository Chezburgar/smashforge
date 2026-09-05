/* DEADEYE — game
 *
 * Owns the scene, the loaded map, every entity, and the match rules. The
 * player, bots and remote peers all present the same interface to this module
 * ( x/y/z, alive, team, damage() ), so scoring and hit resolution never branch
 * on what kind of thing they're talking to.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};
var U = DE.util;
var M = DE.MOVE;

var MODES = {
	ffa: { id: "ffa", name: "FREE FOR ALL", teams: false, scoreLimit: 30, timeLimit: 600 },
	tdm: { id: "tdm", name: "TEAM DEATHMATCH", teams: true, scoreLimit: 75, timeLimit: 600 }
};

function Game( opts ) {
	opts = opts || {};
	this.canvas = opts.canvas;
	this.state = "menu";       // menu | loading | playing | ended
	this.time = 0;
	this.matchTime = 0;
	this.warmup = false;

	this.settings = {
		shadows: U.storage.get( "shadows", true ),
		quality: U.storage.get( "quality", "high" ),
		fov: U.storage.get( "fov", 90 ),
		showFps: U.storage.get( "showFps", false )
	};

	this._initRenderer();

	this.world = new DE.World();
	this.nav = new DE.NavGraph();
	this.fx = new DE.FX( this.scene );
	this.viewmodel = new DE.Viewmodel( this.renderer );
	this.input = new DE.Input( this.canvas );

	this.player = new DE.Player( this );
	this.entities = [ this.player ];
	this.bots = [];
	this.map = null;
	this.mapMesh = null;

	this.grenades = [];
	this.pickups = [];
	this.killfeed = [];
	this.mode = MODES.ffa;
	this.teamMode = false;
	this.teamScore = [ 0, 0 ];

	this.net = { sendShot: function() {}, sendFootstep: null, connected: false };
	this.hud = null;   // assigned by main once the DOM is ready

	this._hitResult = {
		hit: false, dist: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0,
		tag: null, entity: null, zone: null
	};
	this._worldHit = {
		hit: false, dist: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0,
		tag: null, collider: null
	};
	this._v = new THREE.Vector3();
	this.fps = new U.Rolling( 60 );
}

/* ------------------------------------------------------------------
 * renderer & scene
 * ------------------------------------------------------------------ */

Game.prototype._initRenderer = function() {
	var r = this.renderer = new THREE.WebGLRenderer( {
		canvas: this.canvas,
		antialias: this.settings.quality !== "low",
		powerPreference: "high-performance",
		stencil: false
	} );
	r.setPixelRatio( Math.min( global.devicePixelRatio || 1,
	                           this.settings.quality === "high" ? 2 : 1 ) );
	r.setSize( global.innerWidth, global.innerHeight );
	r.autoClear = false;
	r.shadowMap.enabled = this.settings.shadows;
	r.shadowMap.type = THREE.PCFSoftShadowMap;
	r.outputColorSpace = THREE.SRGBColorSpace || r.outputColorSpace;

	this.scene = new THREE.Scene();
	this.camera = new THREE.PerspectiveCamera( this.settings.fov,
	                                           global.innerWidth / global.innerHeight,
	                                           0.06, 480 );
	this.camera.rotation.order = "YXZ";

	/* Lighting rig, reconfigured per map. */
	this.sun = new THREE.DirectionalLight( 0xffffff, 1.2 );
	this.sun.castShadow = this.settings.shadows;
	var sc = this.sun.shadow;
	var span = this.settings.quality === "high" ? 2048 : 1024;
	sc.mapSize.width = sc.mapSize.height = span;
	sc.camera.near = 1;
	sc.camera.far = 220;
	sc.camera.left = -55; sc.camera.right = 55;
	sc.camera.top = 55; sc.camera.bottom = -55;
	// The shadow frustum spans a whole map, so texels are coarse (~4cm) and
	// acne shows as moire on large flat ground planes. Normal-bias pushes the
	// sample along the surface normal, which fixes it without peter-panning.
	sc.bias = -0.0004;
	sc.normalBias = 0.07;
	this.scene.add( this.sun );
	this.scene.add( this.sun.target );

	this.hemi = new THREE.HemisphereLight( 0xa9cdf0, 0x6b6152, 0.8 );
	this.scene.add( this.hemi );

	/* Sky dome — a vertical gradient, cheap and reads well behind low-poly. */
	var skyGeo = new THREE.SphereGeometry( 400, 24, 14 );
	var skyMat = new THREE.ShaderMaterial( {
		side: THREE.BackSide,
		depthWrite: false,
		uniforms: {
			top: { value: new THREE.Color( 0x3f7fc4 ) },
			bottom: { value: new THREE.Color( 0xe6c99a ) },
			offset: { value: 0.06 },
			exponent: { value: 0.85 }
		},
		vertexShader: [
			"varying vec3 vWorld;",
			"void main() {",
			"  vec4 wp = modelMatrix * vec4( position, 1.0 );",
			"  vWorld = wp.xyz;",
			"  gl_Position = projectionMatrix * viewMatrix * wp;",
			"}"
		].join( "\n" ),
		fragmentShader: [
			"uniform vec3 top; uniform vec3 bottom;",
			"uniform float offset; uniform float exponent;",
			"varying vec3 vWorld;",
			"void main() {",
			"  float h = normalize( vWorld ).y + offset;",
			"  float t = pow( clamp( h, 0.0, 1.0 ), exponent );",
			"  gl_FragColor = vec4( mix( bottom, top, t ), 1.0 );",
			"}"
		].join( "\n" )
	} );
	this.sky = new THREE.Mesh( skyGeo, skyMat );
	this.sky.frustumCulled = false;
	this.scene.add( this.sky );
};

Game.prototype.resize = function() {
	var w = global.innerWidth, h = global.innerHeight;
	this.renderer.setSize( w, h );
	this.camera.aspect = w / h;
	this.camera.updateProjectionMatrix();
};

Game.prototype.applyQuality = function() {
	var q = this.settings.quality;
	this.renderer.setPixelRatio( Math.min( global.devicePixelRatio || 1,
	                                       q === "high" ? 2 : 1 ) );
	this.renderer.shadowMap.enabled = this.settings.shadows;
	this.sun.castShadow = this.settings.shadows;
	var span = q === "high" ? 2048 : ( q === "medium" ? 1024 : 512 );
	if ( this.sun.shadow.mapSize.width !== span ) {
		this.sun.shadow.mapSize.width = this.sun.shadow.mapSize.height = span;
		if ( this.sun.shadow.map ) {
			this.sun.shadow.map.dispose();
			this.sun.shadow.map = null;
		}
	}
	this.player.fovBase = this.settings.fov;
	U.storage.set( "shadows", this.settings.shadows );
	U.storage.set( "quality", q );
	U.storage.set( "fov", this.settings.fov );
};

/* ------------------------------------------------------------------
 * map loading
 * ------------------------------------------------------------------ */

Game.prototype.loadMap = function( id ) {
	if ( this.mapMesh ) {
		this.scene.remove( this.mapMesh );
		this.mapMesh.geometry.dispose();
		this.mapMesh.material.dispose();
	}

	var built = DE.buildMap( id, 1337 );
	this.map = built;
	this.mapMesh = built.mesh;
	this.scene.add( this.mapMesh );
	this.world.setColliders( built.colliders );
	this.world.minY = built.bounds.minY - 40;

	// Navigation, clipped to the playable box so the apron of ground outside
	// the perimeter wall isn't sampled.
	var h = built.play;
	var opts = h ? { minX: -h + 1, maxX: h - 1, minZ: -h + 1, maxZ: h - 1 } : {};
	this.nav.build( this.world, built.bounds, opts );

	/* lighting & atmosphere */
	var def = built.def;
	this.sun.color.setHex( def.sun.color );
	this.sun.intensity = def.sun.intensity;
	this.sun.position.set( def.sun.pos[ 0 ], def.sun.pos[ 1 ], def.sun.pos[ 2 ] );
	this.sun.target.position.set( 0, 0, 0 );
	this.hemi.color.setHex( def.sun.ambSky );
	this.hemi.groundColor.setHex( def.sun.ambGround );
	this.hemi.intensity = def.sun.ambInt;

	this.sky.material.uniforms.top.value.setHex( def.sky.top );
	this.sky.material.uniforms.bottom.value.setHex( def.sky.bottom );
	this.scene.fog = new THREE.Fog( def.sky.fog, def.sky.fogNear, def.sky.fogFar );
	this.renderer.setClearColor( def.sky.fog, 1 );

	// Fit the shadow frustum to the map so resolution isn't wasted.
	var extent = Math.max(
		Math.abs( built.bounds.maxX ), Math.abs( built.bounds.minX ),
		Math.abs( built.bounds.maxZ ), Math.abs( built.bounds.minZ ) );
	extent = Math.min( extent, h ? h + 6 : 48 );
	var sc = this.sun.shadow.camera;
	sc.left = -extent; sc.right = extent;
	sc.top = extent; sc.bottom = -extent;
	sc.updateProjectionMatrix();

	DE.audio.setAmbient( def.ambience );

	/* pickups */
	this.pickups = built.pickups.map( function( p ) {
		return { x: p.x, y: p.y, z: p.z, kind: p.kind, active: true, respawnT: 0 };
	} );
	this._buildPickupVisuals();

	this.fx.clear();
	return built;
};

Game.prototype._buildPickupVisuals = function() {
	if ( this.pickupGroup ) this.scene.remove( this.pickupGroup );
	var g = this.pickupGroup = new THREE.Group();
	for ( var i = 0; i < this.pickups.length; i++ ) {
		var p = this.pickups[ i ];
		var col = p.kind === "health" ? 0x3ad46f : 0xf5b731;
		var mat = new THREE.MeshBasicMaterial( { color: col, transparent: true,
		                                         opacity: 0.9 } );
		var mesh = new THREE.Mesh( new THREE.OctahedronGeometry( 0.32, 0 ), mat );
		mesh.position.set( p.x, p.y + 0.75, p.z );
		g.add( mesh );
		p.mesh = mesh;
	}
	this.scene.add( g );
};

/* ------------------------------------------------------------------
 * match lifecycle
 * ------------------------------------------------------------------ */

Game.prototype.startMatch = function( cfg ) {
	cfg = cfg || {};
	this.mode = MODES[ cfg.mode || "ffa" ] || MODES.ffa;
	this.teamMode = this.mode.teams;
	this.teamScore = [ 0, 0 ];
	this.matchTime = this.mode.timeLimit;
	this.killfeed.length = 0;
	this.grenades.length = 0;

	this.loadMap( cfg.map || "dune" );

	/* entities */
	this.clearBots();
	// The player needs a hitbox owner too, or bots can never register a hit on
	// them. The model is built but never added to the scene — in first person
	// there is nothing to draw.
	this.ensurePlayerHitbox();
	this.player.team = this.teamMode ? 0 : 2;
	this.player.name = cfg.playerName || "YOU";
	this.player.kills = this.player.deaths = this.player.streak = 0;
	this.player.setLoadout( cfg.primary || "rk77", cfg.secondary || "p9" );

	var count = cfg.bots === undefined ? 7 : cfg.bots;
	var names = U.shuffle( DE.Bot.NAMES.slice() );
	for ( var i = 0; i < count; i++ ) {
		var team = this.teamMode ? ( i % 2 === 0 ? 1 : 0 ) : 1;
		var bot = new DE.Bot( this, {
			id: "bot" + i,
			name: names[ i % names.length ],
			team: team,
			difficulty: cfg.difficulty || "regular"
		} );
		this.bots.push( bot );
		this.entities.push( bot );
		this.scene.add( bot.character.root );
	}

	/* spawn everyone */
	this.player.spawn( this.pickSpawn( this.player ) );
	for ( var b = 0; b < this.bots.length; b++ ) {
		this.bots[ b ].spawn( this.pickSpawn( this.bots[ b ] ) );
	}

	this.state = "playing";
	this.time = 0;
	DE.audio.resume();
};

Game.prototype.clearBots = function() {
	for ( var i = 0; i < this.bots.length; i++ ) {
		this.scene.remove( this.bots[ i ].character.root );
		this.bots[ i ].character.dispose();
	}
	this.bots.length = 0;
	this.entities.length = 0;
	this.entities.push( this.player );
};

Game.prototype.endMatch = function() {
	this.state = "ended";
	this.input.exitLock();
	if ( this.hud ) this.hud.showResults();
};

/* Choose the spawn point furthest from any living enemy, so nobody appears in
 * front of a gun. */
Game.prototype.pickSpawn = function( ent ) {
	var spawns = this.map.def.spawns;
	var best = null, bestScore = -Infinity;
	for ( var i = 0; i < spawns.length; i++ ) {
		var s = spawns[ i ];
		var score = Math.random() * 6;   // tie-break so spawns aren't cyclic
		for ( var j = 0; j < this.entities.length; j++ ) {
			var e = this.entities[ j ];
			if ( e === ent || !e.alive ) continue;
			var friendly = this.teamMode && e.team === ent.team;
			var dx = e.x - s.x, dy = e.y - s.y, dz = e.z - s.z;
			var d = Math.sqrt( dx * dx + dy * dy + dz * dz );
			if ( friendly ) {
				score += U.clamp( 30 - d, 0, 30 ) * 0.15;    // cluster with allies
			} else {
				score += Math.min( d, 70 ) * 0.6;
				// Heavily penalise a spawn an enemy can already see.
				if ( d < 45 && this.world.lineOfSight( s.x, s.y + 1.6, s.z,
				                                       e.x, e.y + 1.6, e.z ) ) {
					score -= 120;
				}
			}
		}
		if ( score > bestScore ) { bestScore = score; best = s; }
	}
	return best || spawns[ 0 ];
};

/* ------------------------------------------------------------------
 * hit resolution
 * ------------------------------------------------------------------ */

/* Trace a shot against the world and every entity, returning the nearest hit.
 * Both the player and bots go through here, so neither has an advantage. */
Game.prototype.traceShot = function( ox, oy, oz, dx, dy, dz, maxDist, shooter ) {
	var out = this._hitResult;
	out.hit = false;
	out.entity = null;
	out.zone = null;

	var wh = this.world.raycast( ox, oy, oz, dx, dy, dz, maxDist, this._worldHit );
	var best = wh.hit ? wh.dist : maxDist;
	var hitWorld = wh.hit;

	var bestEnt = null, bestZone = null, bestDist = best;
	for ( var i = 0; i < this.entities.length; i++ ) {
		var e = this.entities[ i ];
		if ( e === shooter || !e.alive ) continue;
		if ( this.teamMode && shooter && e.team === shooter.team ) continue;
		var ch = e.character;
		if ( !ch ) continue;
		ch.updateHitboxes( e.x, e.y, e.z, e.yaw, e.crouching ? 1 : 0 );
		var r = ch.raycast( ox, oy, oz, dx, dy, dz, bestDist );
		if ( r && r.dist < bestDist ) {
			bestDist = r.dist;
			bestEnt = e;
			bestZone = r.zone;
		}
	}

	if ( bestEnt ) {
		out.hit = true;
		out.dist = bestDist;
		out.x = ox + dx * bestDist;
		out.y = oy + dy * bestDist;
		out.z = oz + dz * bestDist;
		out.entity = bestEnt;
		out.zone = bestZone;
		out.nx = -dx; out.ny = -dy; out.nz = -dz;
		out.tag = null;
	} else if ( hitWorld ) {
		out.hit = true;
		out.dist = wh.dist;
		out.x = wh.x; out.y = wh.y; out.z = wh.z;
		out.nx = wh.nx; out.ny = wh.ny; out.nz = wh.nz;
		out.tag = wh.tag;
	}
	return out;
};

/* The local player's character isn't in `entities` as a hitbox owner, so the
 * player is added lazily the first time something needs to shoot at them. */
Game.prototype.ensurePlayerHitbox = function() {
	if ( !this.player.character ) {
		this.player.character = new DE.Character( { team: this.player.team } );
		this.player.character.visible = false;   // never drawn in first person
		this.player.character.root.visible = false;
	}
};

Game.prototype.damageEntity = function( ent, amount, source, zone, weapon, dir ) {
	if ( !ent || !ent.alive ) return;
	if ( this.warmup ) return;
	amount = Math.max( 1, Math.round( amount ) );

	if ( source === this.player ) {
		this.player.damageDealt += Math.min( amount, ent.health );
		if ( this.hud ) this.hud.hitmarker( zone === "head" );
		DE.audio.hitmarker( zone === "head" );
		// A remote player owns their own health, so tell them about the hit
		// rather than deciding it here.
		if ( ent.isRemote ) DE.net.sendHit( ent, amount, weapon ? weapon.id : null );
	}
	ent.damage( amount, source, weapon ? weapon.id : null );
};

Game.prototype.killEntity = function( ent, source, cause ) {
	if ( !ent.alive ) return;
	ent.alive = false;
	ent.health = 0;
	ent.deaths++;
	ent.streak = 0;
	if ( ent.character ) ent.character.dead = true;

	this.registerKill( source, ent, cause );

	// Bots respawn on a timer; the player respawns from the death screen.
	if ( ent !== this.player ) {
		var self = this;
		ent.respawnAt = this.time + U.rand( 3.2, 5.0 );
	}
};

Game.prototype.onPlayerDeath = function( player, source, cause ) {
	this.registerKill( source, player, cause );
	player.respawnAt = this.time + 3.0;
	if ( this.hud ) this.hud.showDeath( source, cause );
};

Game.prototype.registerKill = function( source, victim, cause ) {
	var self = this;
	if ( source && source !== victim ) {
		source.kills++;
		source.streak++;
		source.score += 100;
		if ( this.teamMode ) {
			this.teamScore[ source.team ] += 1;
		}
		if ( source === this.player ) {
			DE.audio.killConfirm();
			if ( this.hud ) this.hud.showKill( victim, source.streak );
		}
	} else if ( this.teamMode ) {
		// Suicide or environmental: credit the other team.
		this.teamScore[ victim.team === 0 ? 1 : 0 ] += 1;
	}

	this.killfeed.unshift( {
		killer: source ? source.name : null,
		killerTeam: source ? source.team : -1,
		victim: victim.name,
		victimTeam: victim.team,
		cause: cause || null,
		headshot: false,
		t: this.time
	} );
	if ( this.killfeed.length > 6 ) this.killfeed.pop();

	// Win conditions.
	if ( this.teamMode ) {
		if ( this.teamScore[ 0 ] >= this.mode.scoreLimit ||
		     this.teamScore[ 1 ] >= this.mode.scoreLimit ) this.endMatch();
	} else if ( source && source.kills >= this.mode.scoreLimit ) {
		this.endMatch();
	}
};

/* Bots and the player broadcast gunfire so nearby bots can react to it. */
Game.prototype.onNoise = function( x, y, z, loudness, source ) {
	for ( var i = 0; i < this.bots.length; i++ ) {
		var b = this.bots[ i ];
		if ( b === source ) continue;
		if ( this.teamMode && source && b.team === source.team ) continue;
		b.hear( x, y, z, loudness );
	}
};

/* If a bot's shot passes close to the player's head, play a crack. */
Game.prototype.checkWhizby = function( ox, oy, oz, dir ) {
	var p = this.player;
	if ( !p.alive ) return;
	var px = p.x - ox, py = ( p.y + p.eyeY ) - oy, pz = p.z - oz;
	var t = px * dir.x + py * dir.y + pz * dir.z;
	if ( t < 1 || t > 200 ) return;
	var cx = ox + dir.x * t, cy = oy + dir.y * t, cz = oz + dir.z * t;
	var dx = cx - p.x, dy = cy - ( p.y + p.eyeY ), dz = cz - p.z;
	var d = Math.sqrt( dx * dx + dy * dy + dz * dz );
	if ( d < 2.4 ) {
		DE.audio.whizby( { x: cx, y: cy, z: cz }, 1 - d / 2.4 );
	}
};

/* ------------------------------------------------------------------
 * grenades
 * ------------------------------------------------------------------ */

Game.prototype.throwGrenade = function( thrower ) {
	var def = DE.WEAPONS.frag;
	var cp = Math.cos( thrower.pitch );
	var dir = {
		x: -Math.sin( thrower.yaw ) * cp,
		y: Math.sin( thrower.pitch ) + 0.22,
		z: -Math.cos( thrower.yaw ) * cp
	};
	var eyeY = thrower.y + ( thrower.eyeY === undefined ? M.EYE_STAND : thrower.eyeY );

	var mesh = new THREE.Mesh(
		new THREE.IcosahedronGeometry( 0.10, 0 ),
		new THREE.MeshLambertMaterial( { color: 0x46543c } )
	);
	mesh.castShadow = true;
	this.scene.add( mesh );

	this.grenades.push( {
		x: thrower.x + dir.x * 0.6,
		y: eyeY - 0.1,
		z: thrower.z + dir.z * 0.6,
		vx: dir.x * def.throwSpeed + ( thrower.vx || 0 ) * 0.5,
		vy: dir.y * def.throwSpeed,
		vz: dir.z * def.throwSpeed + ( thrower.vz || 0 ) * 0.5,
		fuse: def.fuse,
		owner: thrower,
		mesh: mesh,
		spin: { x: U.rand( -12, 12 ), y: U.rand( -12, 12 ), z: U.rand( -12, 12 ) }
	} );
};

Game.prototype.updateGrenades = function( dt ) {
	var def = DE.WEAPONS.frag;
	for ( var i = this.grenades.length - 1; i >= 0; i-- ) {
		var g = this.grenades[ i ];
		g.fuse -= dt;

		g.vy -= M.GRAVITY * dt;
		var steps = 2;
		for ( var s = 0; s < steps; s++ ) {
			var h = dt / steps;
			var nx = g.x + g.vx * h, ny = g.y + g.vy * h, nz = g.z + g.vz * h;
			// Sphere-ish sweep: probe the segment and reflect off what it hits.
			var dx = nx - g.x, dy = ny - g.y, dz = nz - g.z;
			var len = Math.sqrt( dx * dx + dy * dy + dz * dz );
			if ( len > 0.0001 ) {
				var hit = this.world.raycast( g.x, g.y, g.z, dx / len, dy / len, dz / len,
				                              len + 0.12 );
				if ( hit.hit ) {
					// Reflect velocity about the surface normal and lose energy.
					var vn = g.vx * hit.nx + g.vy * hit.ny + g.vz * hit.nz;
					g.vx -= 1.45 * vn * hit.nx;
					g.vy -= 1.45 * vn * hit.ny;
					g.vz -= 1.45 * vn * hit.nz;
					g.vx *= 0.62; g.vy *= 0.62; g.vz *= 0.62;
					g.x = hit.x + hit.nx * 0.12;
					g.y = hit.y + hit.ny * 0.12;
					g.z = hit.z + hit.nz * 0.12;
					if ( Math.abs( vn ) > 2.2 ) {
						DE.audio.grenadeBounce( { x: g.x, y: g.y, z: g.z } );
					}
					continue;
				}
			}
			g.x = nx; g.y = ny; g.z = nz;
		}

		g.mesh.position.set( g.x, g.y, g.z );
		g.mesh.rotation.x += g.spin.x * dt;
		g.mesh.rotation.y += g.spin.y * dt;
		g.mesh.rotation.z += g.spin.z * dt;

		if ( g.fuse <= 0 || g.y < this.world.minY ) {
			this.explode( g );
			this.scene.remove( g.mesh );
			g.mesh.geometry.dispose();
			g.mesh.material.dispose();
			this.grenades.splice( i, 1 );
		}
	}
};

Game.prototype.explode = function( g ) {
	var def = DE.WEAPONS.frag;
	this.fx.explosion( g.x, g.y, g.z, def.radius );
	DE.audio.explosion( { x: g.x, y: g.y, z: g.z } );
	this.onNoise( g.x, g.y, g.z, 2.0, null );

	for ( var i = 0; i < this.entities.length; i++ ) {
		var e = this.entities[ i ];
		if ( !e.alive ) continue;
		if ( this.teamMode && g.owner && e !== g.owner && e.team === g.owner.team ) continue;
		var cx = e.x, cy = e.y + 0.9, cz = e.z;
		var dx = cx - g.x, dy = cy - g.y, dz = cz - g.z;
		var d = Math.sqrt( dx * dx + dy * dy + dz * dz );
		if ( d > def.radius ) continue;
		// Cover blocks the blast.
		if ( !this.world.lineOfSight( g.x, g.y, g.z, cx, cy, cz ) ) continue;
		var falloff = 1 - ( d / def.radius );
		var dmg = def.damage * falloff * falloff;
		if ( e === g.owner ) dmg *= 0.55;
		if ( dmg < 3 ) continue;
		this.damageEntity( e, dmg, g.owner, "torso", def, { x: dx / d, y: dy / d, z: dz / d } );
	}

	if ( this.player.alive ) {
		var pd = Math.sqrt( ( this.player.x - g.x ) * ( this.player.x - g.x ) +
		                    ( this.player.z - g.z ) * ( this.player.z - g.z ) );
		if ( pd < def.radius * 2.5 ) {
			this.player.shake = Math.min( 2.0, this.player.shake +
			                              ( 1 - pd / ( def.radius * 2.5 ) ) * 1.6 );
		}
	}
};

/* ------------------------------------------------------------------
 * pickups
 * ------------------------------------------------------------------ */

Game.prototype.updatePickups = function( dt ) {
	for ( var i = 0; i < this.pickups.length; i++ ) {
		var p = this.pickups[ i ];
		if ( !p.active ) {
			p.respawnT -= dt;
			if ( p.respawnT <= 0 ) {
				p.active = true;
				p.mesh.visible = true;
			}
			continue;
		}
		p.mesh.rotation.y += dt * 1.6;
		p.mesh.position.y = p.y + 0.75 + Math.sin( this.time * 2.4 + i ) * 0.10;

		for ( var j = 0; j < this.entities.length; j++ ) {
			var e = this.entities[ j ];
			if ( !e.alive ) continue;
			var dx = e.x - p.x, dy = ( e.y + 0.9 ) - ( p.y + 0.75 ), dz = e.z - p.z;
			if ( dx * dx + dy * dy + dz * dz > 2.0 ) continue;
			if ( !this.grantPickup( e, p.kind ) ) continue;
			p.active = false;
			p.mesh.visible = false;
			p.respawnT = 18;
			if ( e === this.player ) {
				DE.audio.ui( "click" );
				this.hud.notify( p.kind === "health" ? "+HEALTH" : "+AMMO" );
			}
			break;
		}
	}
};

Game.prototype.grantPickup = function( ent, kind ) {
	if ( kind === "health" ) {
		if ( ent.health >= ent.maxHealth ) return false;
		ent.health = Math.min( ent.maxHealth, ent.health + 50 );
		return true;
	}
	// Ammo: refill reserves, and top up the current magazine's spare pool.
	var any = false;
	for ( var id in ent.ammo ) {
		var d = DE.WEAPONS[ id ];
		var a = ent.ammo[ id ];
		if ( a.reserve < d.reserve ) {
			a.reserve = Math.min( d.reserve, a.reserve + Math.ceil( d.reserve * 0.5 ) );
			any = true;
		}
	}
	if ( ent.grenades !== undefined && ent.grenades < DE.WEAPONS.frag.count ) {
		ent.grenades++;
		any = true;
	}
	return any;
};

/* ------------------------------------------------------------------
 * main step
 * ------------------------------------------------------------------ */

Game.prototype.update = function( dt ) {
	this.time += dt;

	if ( this.state === "playing" ) {
		this.matchTime -= dt;
		if ( this.matchTime <= 0 ) {
			this.matchTime = 0;
			this.endMatch();
		}
	}

	this.player.update( dt );

	for ( var i = 0; i < this.bots.length; i++ ) {
		var b = this.bots[ i ];
		b.update( dt );
		if ( !b.alive && b.respawnAt !== undefined && this.time >= b.respawnAt &&
		     this.state === "playing" ) {
			b.respawnAt = undefined;
			b.spawn( this.pickSpawn( b ) );
		}
	}

	if ( !this.player.alive && this.player.respawnAt !== undefined &&
	     this.time >= this.player.respawnAt && this.state === "playing" ) {
		if ( this.input.locked || this.hud.autoRespawn ) {
			this.respawnPlayer();
		}
	}

	this.updateGrenades( dt );
	this.updatePickups( dt );
	this.fx.update( dt, this.camera );

	this.player.applyCamera( this.camera, dt );
	this.camera.updateMatrixWorld();
	this.viewmodel.update( dt, this.player.viewState() );
	DE.audio.updateListener( this.camera );

	// Keep the shadow frustum centred on the player so a large map still gets
	// crisp shadows near the action.
	this.sun.target.position.set( this.player.x, 0, this.player.z );
	this.sun.position.set(
		this.player.x + this.map.def.sun.pos[ 0 ] * 0.5,
		this.map.def.sun.pos[ 1 ],
		this.player.z + this.map.def.sun.pos[ 2 ] * 0.5 );
	this.sun.target.updateMatrixWorld();

	this.sky.position.copy( this.camera.position );
};

Game.prototype.respawnPlayer = function() {
	this.player.respawnAt = undefined;
	this.player.spawn( this.pickSpawn( this.player ) );
	DE.audio.respawn();
	if ( this.hud ) this.hud.hideDeath();
};

Game.prototype.render = function() {
	this.renderer.clear();
	this.renderer.render( this.scene, this.camera );
	if ( this.player.alive ) {
		this.viewmodel.render( this.player.fov,
		                       this.camera.aspect );
	}
};

/* Scoreboard rows, sorted. */
Game.prototype.scoreboard = function() {
	var rows = this.entities.map( function( e ) {
		return {
			name: e.name, team: e.team, kills: e.kills, deaths: e.deaths,
			score: e.score, isPlayer: e === this.player, alive: e.alive
		};
	}, this );
	rows.sort( function( a, b ) {
		return b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare( b.name );
	} );
	return rows;
};

Game.MODES = MODES;
DE.Game = Game;

} )( window );
