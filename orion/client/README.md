# The EaglercraftX client bundle

Orion Client is the launcher — the menu, the server book, the launch button.
The game itself is the EaglercraftX 1.8 bundle, and it lives here.

## What is installed

An **EaglercraftX 1.8-u53** offline signed build, unpacked into the two files
Orion loads:

```
classes.js       the compiled game, with its asset packages embedded
signature.txt    the build's detached signature
```

There is no `assets.epk`, and that is correct for this build: the asset and
language packages are compiled into `classes.js` as data URIs, which the bundle
appends to its own options at startup. Orion detects this ("self-contained")
and does not ask for an `.epk`.

## The two bundle shapes

| | Split build | Self-contained build |
|---|---|---|
| Files | `classes.js` + `assets.epk` | `classes.js` only |
| Orion sets | `assetsURI`, `localesURI` | neither — the bundle supplies its own |

Orion probes for both and adapts. Only `classes.js` decides whether it can
launch.

## How Orion passes settings in

The tail of `classes.js` decides where its options come from:

```js
if (window.eaglercraftXOptsHints && window.eaglercraftXOptsHints.hintsVersion === 1) {
    window.eaglercraftXOpts = window.eaglercraftXOptsHints;   // adopts ours
} else {
    window.eaglercraftXOpts = { /* its own built-in defaults */ };  // discards ours
}
window.eaglercraftXOpts.assetsURI = [ /* embedded packages */ ];
main();
```

So settings must be written to **`window.eaglercraftXOptsHints` with
`hintsVersion: 1`**. Writing only `eaglercraftXOpts` is silently thrown away on
these builds — the bundle overwrites it a moment later. Orion sets both, with
the same object, so older bundles that read `eaglercraftXOpts` directly still
work.

What gets passed:

- `servers` — your server book, so it appears in the in-game multiplayer list.
- `joinServer` — set only when you launched into a specific server, which is
  what makes **Join** land on the server instead of the main menu.
- `relays` — your relay book, with one marked `primary`. That is the relay a
  shared world registers itself with.
- `worldsDB: "worlds"` — the stock name, so worlds are where the client
  normally keeps them.

The bundle rewrites `window.eaglercraftXOpts` as it boots, so to see what it
actually ran with, read that global after launch — not what Orion requested.
The *Client setup* tab shows the object Orion will send.

## Why signature.txt matters

A signed build verifies itself. The client reads
`window.eaglercraftXClientSignature` **once** during startup and immediately
nulls it, so Orion fetches `signature.txt` and sets that global *before*
injecting `classes.js`.

- **With it:** the main menu reads `Digitally Signed (7/06/2025)`, and a
  *Download Offline* button appears so players can save their own copy.
- **Without it:** a red `Signature Invalid!` sits on the main menu. The game
  plays fine, but the build can no longer prove it is what its author
  published, and the warning worries people.

The signature is detached and only ~1 KB, so keep the two files together. An
unsigned build simply has no `signature.txt` and Orion skips this.

## Replacing the bundle

Drop in a new `classes.js` (plus `assets.epk` if it is a split build, plus its
`signature.txt` if signed), commit, push. If you would rather host the bundle
elsewhere, paste that URL into *Client setup → Bundle location*; that host must
send `Access-Control-Allow-Origin`, which is why a folder inside this site is
the default.

`classes.js` is ~34 MB. That is under GitHub's 100 MB hard limit but over its
50 MB advisory warning, so pushes mention it. GitHub Pages compresses
JavaScript in transit, so players download roughly a third of that.
