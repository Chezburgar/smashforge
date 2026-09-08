/* ORION CLIENT — writing a .zip in the browser
 *
 * Orion builds resource packs on the fly: the disc printer turns music into a
 * pack, the theme builder turns a palette into one. Both need to hand the
 * player a real .zip, and neither is allowed to depend on a CDN, so the format
 * is written out by hand.
 *
 * A zip is simpler to write than to read: each file gets a local header
 * followed by its bytes, then a central directory repeating those headers with
 * an offset each, then a 22-byte record saying where the directory starts.
 * CompressionStream('deflate-raw') does the deflating — the same API
 * mods/js/pack.js uses in reverse to read one.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const Z = {};
  O.Zip = Z;

  /* CRC-32, table built once. Every entry carries one and the reader checks it,
   * so this cannot be skipped. */
  const TABLE = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  Z.crc32 = function (bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const enc = new TextEncoder();

  async function deflate(bytes) {
    if (typeof CompressionStream !== 'function') return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const out = new Uint8Array(await new Response(stream).arrayBuffer());
      /* Deflating already-compressed audio can come out larger; storing is
       * then both smaller and quicker for the game to read. */
      return out.length < bytes.length ? out : null;
    } catch (e) {
      return null;
    }
  }

  /* MS-DOS date and time, which is what a zip records. */
  function dosTime(d) {
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: date };
  }

  /* files: [{ name, bytes }] — bytes is a Uint8Array, or a string, which is
   * encoded as UTF-8. Directory entries are implied by the names and are not
   * written: every unzipper creates the folders it needs. */
  Z.build = async function (files, opts) {
    const when = dosTime((opts && opts.date) || new Date());
    const parts = [];
    const dir = [];
    let offset = 0;

    for (const f of files) {
      const name = enc.encode(f.name);
      const raw = typeof f.bytes === 'string' ? enc.encode(f.bytes) : f.bytes;
      const crc = Z.crc32(raw);
      const packed = (opts && opts.store) ? null : await deflate(raw);
      const body = packed || raw;
      const method = packed ? 8 : 0;

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);              // version needed
      local.setUint16(6, 0x0800, true);          // UTF-8 names
      local.setUint16(8, method, true);
      local.setUint16(10, when.time, true);
      local.setUint16(12, when.date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, raw.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);              // no extra field

      parts.push(new Uint8Array(local.buffer), name, body);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);            // version made by
      central.setUint16(6, 20, true);            // version needed
      central.setUint16(8, 0x0800, true);
      central.setUint16(10, method, true);
      central.setUint16(12, when.time, true);
      central.setUint16(14, when.date, true);
      central.setUint32(16, crc, true);
      central.setUint32(20, body.length, true);
      central.setUint32(24, raw.length, true);
      central.setUint16(28, name.length, true);
      central.setUint32(42, offset, true);
      dir.push({ head: new Uint8Array(central.buffer), name: name });

      offset += 30 + name.length + body.length;
    }

    let dirSize = 0;
    for (const e of dir) { parts.push(e.head, e.name); dirSize += e.head.length + e.name.length; }

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, dir.length, true);
    end.setUint16(10, dir.length, true);
    end.setUint32(12, dirSize, true);
    end.setUint32(16, offset, true);
    parts.push(new Uint8Array(end.buffer));

    let total = 0;
    for (const b of parts) total += b.length;
    const out = new Uint8Array(total);
    let at = 0;
    for (const b of parts) { out.set(b, at); at += b.length; }
    return out;
  };

  /* Hand a built pack to the player. */
  Z.download = function (bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  };
})(window.ORION);
