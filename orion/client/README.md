# The Eaglercraft client builds

Orion Client is the launcher — the menu, the server book, the launch button.
The games themselves live here, one directory per version.

```
orion/client/1.8/      classes.js, signature.txt
orion/client/1.12.2/   classes.js, assets.js
```

Which version launches is chosen on the **Play** tab and remembered per
browser. **1.8 is the default**, and deliberately: 1.12.2's own first-run screen
calls itself early, unofficial and buggy.

## What is installed

| | 1.8 | 1.12.2 |
|---|---|---|
| Build | EaglercraftX 1.8-u53 | Eaglercraft 1.12.2-u3 |
| Signed | yes | no |
| Scripts | `classes.js` | `classes.js`, then `assets.js` |
| Assets | compiled into `classes.js` | separate `assets.js` |
| Options via | `eaglercraftXOptsHints` | `eaglercraftXOpts` |
| Starts itself | yes | **no** — Orion calls `window.main()` |
| Worlds database | `worlds` | `worlds_1_12_2` |
| Size | 33 MB | 79 MB |

Those differences are declared in `orion/js/versions.js`, so `launch.js` has no
per-version branches.

## Why the launcher cannot just load the offline `.html`

An Eaglercraft *offline* build is one self-contained HTML file, and it is
tempting to drop it in an iframe. It does not work:

- **Its page sets its own launch options.** An inline script assigns
  `window.eaglercraftXOpts` before the client loads, so Orion's server book,
  relays and join-on-launch would all be overwritten.
- **Its boot code waits for the page `load` event.** 1.12.2 starts from a
  six-second countdown wired to `window.addEventListener("load", …)`. Injected
  after the page has loaded, that event has already fired and the game never
  starts.
- **The countdown needs DOM elements** (`launch_countdown_screen`,
  `skipCountdown`, …) that exist only in the original page.

So the pieces are unpacked out of it instead.

## Unpacking a build

```
node tools/unpack-eaglercraft.js <offline.html> orion/client/<version>/
```

It recognises both shapes in circulation and prints the two settings the new
version needs:

- **signed** — the client is gzipped and base64'd into a
  `<style type="eaglercraft" id="eaglercraftXClientBundle">` element, with a
  detached signature beside it. Assets are compiled in. → `optsMode: 'hints'`,
  `autoStart: true`.
- **inline** — the client is one enormous `<script>`, and a second script adds
  the asset packages to `window.eaglercraftXOpts` before starting the game. The
  tool keeps the asset assignment and drops the countdown boot code, closing
  the IIFE the original left open. → `optsMode: 'direct'`, `autoStart: false`.

Then add an entry to `orion/js/versions.js` with the directory, the scripts in
load order, and those settings.

The tool is deterministic: re-running it on the 1.8 build reproduces the
committed `classes.js` and `signature.txt` byte for byte.

## Why `optsMode` matters

The 1.8 build's tail reads:

```js
if (window.eaglercraftXOptsHints && window.eaglercraftXOptsHints.hintsVersion === 1) {
    window.eaglercraftXOpts = window.eaglercraftXOptsHints;   // adopts ours
} else {
    window.eaglercraftXOpts = { /* its own defaults */ };      // discards ours
}
```

Write only `eaglercraftXOpts` there and it is overwritten a moment later — the
symptom is a server list that never appears in-game. 1.12.2 is the opposite: it
reads `eaglercraftXOpts` and *mutates* it to add its assets. Orion sets both
globals from one object, so neither build can be handed a stale copy.

## Why `signature.txt` matters

A signed build verifies itself. The client reads
`window.eaglercraftXClientSignature` **once** during startup and immediately
nulls it, so Orion fetches the file and sets that global before injecting
`classes.js`.

- **With it:** the main menu reads `Digitally Signed`, and a *Download Offline*
  button appears.
- **Without it:** a red `Signature Invalid!` sits on the menu. The game plays
  fine, but it can no longer prove it is what its author published.

1.12.2 is unsigned and has no such file.

## Size limits

GitHub rejects any single file over 100 MB and warns past 50 MB, so pushes
mention `classes.js`. Both builds are inside the hard limit. GitHub Pages
compresses JavaScript in transit, so players download roughly a third of the
figures above, and the browser caches it after the first launch.

If a future build exceeds 100 MB, host that version's directory elsewhere and
set the client location on the *Setup* tab; that host must send
`Access-Control-Allow-Origin`.
