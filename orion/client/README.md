# Drop an EaglercraftX 1.8 bundle here

Orion Client is the launcher — the menu, the server book, the launch button.
The game itself is the EaglercraftX 1.8 bundle, which is Minecraft code and so
is **not** committed to this repository. Orion looks for it here.

## What Orion expects

```
orion/client/classes.js     the compiled game
orion/client/assets.epk     its textures, sounds and language files
orion/client/lang/          optional, extra .lang files
```

Put those two files in this folder, commit, push. GitHub Pages redeploys and
**Launch client** becomes active. Nothing else needs configuring — `client/` is
the default location Orion probes on load.

## If `classes.js` is too big for git

The compiled bundle is tens of megabytes, and GitHub rejects any single file
over 100 MB. Two ways around it:

- **Git LFS** — `git lfs track "orion/client/classes.js"`. The Pages workflow
  already checks out with `lfs: true`.
- **Host it elsewhere** — put the bundle on any HTTPS host and paste that URL
  into *Client setup → Bundle location* in Orion. That host must send
  `Access-Control-Allow-Origin` for the fetch of `assets.epk` to succeed;
  a folder inside this site never needs CORS, which is why it is the default.

## How Orion talks to the bundle

Before loading `classes.js`, Orion sets `window.eaglercraftXOpts`:

```js
window.eaglercraftXOpts = {
  container:  "game_frame",
  assetsURI:  "client/assets.epk",
  localesURI: "client/lang/",
  worldsDB:   "orion_worlds",
  servers: [ /* seeded from your server book */ ],
  relays:  [ /* lax1dude public relays, for shared singleplayer worlds */ ],
  joinServer: "wss://…"   /* only when you launched into a specific server */
};
```

`servers` seeds the in-game multiplayer list. The client keeps its own copy once
it has run, so servers you add in Orion later show up as defaults rather than
overwriting what you have changed in-game — `joinServer` is what reliably drops
you straight onto a server, and it is what the **Join** buttons use.

You can see the exact object Orion will pass, filled in with your own server
list, at the bottom of the *Client setup* tab.
