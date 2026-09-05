#!/usr/bin/env node
/* ORION CLIENT — unpack an Eaglercraft offline build for Orion to load.
 *
 * An "offline" build is one self-contained HTML file. Orion cannot use it as
 * it stands: the page sets its own launch options, so the server list and
 * join-on-launch that Orion passes in would be discarded, and its boot code
 * waits on a window "load" event that has long since fired by the time Orion
 * would inject it. This pulls the pieces out instead.
 *
 * Two shapes exist in the wild:
 *
 *   signed   the client is gzipped and base64'd into
 *            <style type="eaglercraft" id="eaglercraftXClientBundle">, with a
 *            detached signature in a sibling element. Assets are compiled into
 *            the client. Seen in EaglercraftX 1.8 u53.
 *
 *   inline   the client is one enormous <script>, and a second <script> adds
 *            the asset packages to window.eaglercraftXOpts before starting the
 *            game with a countdown screen. Unsigned. Seen in Eaglercraft
 *            1.12.2 u3.
 *
 * Usage:
 *   node tools/unpack-eaglercraft.js <offline.html> <output-dir>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) {
  console.error('usage: node tools/unpack-eaglercraft.js <offline.html> <output-dir>');
  process.exit(2);
}

const html = fs.readFileSync(src, 'utf8');
fs.mkdirSync(outDir, { recursive: true });

const write = (name, body) => {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, body);
  console.log(`  ${name}  ${(Buffer.byteLength(body) / 1048576).toFixed(1)} MB`);
  return p;
};

/* ------------------------------------------------------------ signed shape */

const bundleEl = /<style type="eaglercraft" id="eaglercraftXClientBundle">data:[^;]*;base64,([A-Za-z0-9+/=]+)<\/style>/.exec(html);
if (bundleEl) {
  console.log('shape: signed (gzipped bundle in a <style> element)');
  const gz = Buffer.from(bundleEl[1], 'base64');
  write('classes.js', zlib.gunzipSync(gz));

  const sigEl = /id="eaglercraftXClientSignature">(data:[^<]+)<\/style>/.exec(html);
  if (sigEl) {
    /* The client reads this once at startup to verify itself. Without it a
     * signed build shows "Signature Invalid!" on the main menu. */
    write('signature.txt', sigEl[1].trim());
  } else {
    console.log('  (no signature element — build is unsigned)');
  }
  console.log('\nOrion settings: optsMode "hints", autoStart true');
  process.exit(0);
}

/* ------------------------------------------------------------ inline shape */

console.log('shape: inline (client and assets as <script> blocks)');

/* Walk the real script elements. The bundle contains "<script>" inside string
 * literals, so scanning for the tag alone finds phantoms; stepping open tag to
 * matching close tag skips them. */
const blocks = [];
let i = 0;
while (true) {
  const open = html.indexOf('<script', i);
  if (open === -1) break;
  const bodyStart = html.indexOf('>', open) + 1;
  const close = html.indexOf('</script>', bodyStart);
  if (close === -1) break;
  blocks.push({ start: bodyStart, end: close, body: html.slice(bodyStart, close) });
  i = close + 9;
}
console.log(`  ${blocks.length} script blocks`);

const game = blocks.find((b) => b.body.includes('$rt_exports.main'));
if (!game) {
  console.error('error: no script defines $rt_exports.main — is this an Eaglercraft offline build?');
  process.exit(1);
}
write('classes.js', game.body);

/* The asset script assigns the packages onto the existing opts object, then
 * runs a launch countdown that needs DOM elements from the original page and
 * fires on "load". Keep the assignment; drop the boot code, because Orion
 * calls main() itself once both scripts are in. */
const assetScript = blocks.find((b) => /window\.eaglercraftXOpts\.assetsURI\s*=\s*\[/.test(b.body));
if (assetScript) {
  const m = /window\.eaglercraftXOpts\.assetsURI\s*=\s*\[/.exec(assetScript.body);
  let depth = 1;
  let pos = m.index + m[0].length;
  while (depth > 0 && pos < assetScript.body.length) {
    const ch = assetScript.body[pos];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    pos++;
  }
  if (depth !== 0) {
    console.error('error: could not find the end of the assetsURI array');
    process.exit(1);
  }
  /* Include the ';' that ends the statement, then close the IIFE the original
   * opened, since its own closing brace lived in the boot code we dropped. */
  const semi = assetScript.body.indexOf(';', pos);
  const kept = assetScript.body.slice(0, (semi === -1 ? pos : semi + 1));
  write('assets.js', kept + '\n})();\n');
} else {
  console.log('  (no separate asset script — assets are compiled into the client)');
}

console.log('\nOrion settings: optsMode "direct", autoStart false (Orion calls window.main())');
