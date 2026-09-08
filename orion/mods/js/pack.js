/* ORION MODS — read a resource pack and judge whether it will work
 *
 * A .zip is read here rather than on a server because the answer is for the
 * person uploading: they want to know before publishing that a pack will
 * actually load. No library — the central directory of a ZIP is
 * straightforward to walk, and DecompressionStream('deflate-raw') does the
 * inflating, so nothing has to be fetched from a CDN.
 *
 * What "compatible" means for Eaglercraft: it is Minecraft 1.8 and 1.12.2, so
 * a pack must declare a pack_format those versions understand, and put its
 * files where those versions look for them. Anything newer silently fails to
 * load in-game, which is the failure this is meant to catch.
 */
window.ORION_MODS = window.ORION_MODS || {};
(function (NS) {
  'use strict';

  /* pack_format was bumped whenever Mojang moved the goalposts. Only the first
   * three matter to us. */
  const FORMATS = {
    1: { label: '1.6 – 1.8', versions: ['1.8'] },
    2: { label: '1.9 – 1.10', versions: [] },
    3: { label: '1.11 – 1.12', versions: ['1.12.2'] },
    4: { label: '1.13 – 1.14', versions: [] },
    5: { label: '1.15 – 1.16', versions: [] },
    6: { label: '1.16.2 – 1.16.5', versions: [] },
    7: { label: '1.17', versions: [] },
    8: { label: '1.18', versions: [] }
  };
  NS.FORMATS = FORMATS;

  const dec = new TextDecoder();

  /* ------------------------------------------------------------- zip reading */

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  /* Walk back from the end for the end-of-central-directory signature; the
   * comment field means it is not always the last 22 bytes. */
  function findEOCD(b) {
    const min = Math.max(0, b.length - 66000);
    for (let i = b.length - 22; i >= min; i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) return i;
    }
    return -1;
  }

  NS.readZip = async function (buffer) {
    const b = new Uint8Array(buffer);
    if (!(b[0] === 0x50 && b[1] === 0x4b)) throw new Error('That is not a .zip file.');

    const eocd = findEOCD(b);
    if (eocd < 0) throw new Error('That .zip looks damaged — no directory at the end of it.');

    let count = u16(b, eocd + 10);
    let dirAt = u32(b, eocd + 16);
    /* Zip64: the 32-bit fields saturate and the real values live elsewhere.
     * A resource pack that big is beyond what we accept anyway. */
    if (dirAt === 0xffffffff || count === 0xffff) {
      throw new Error('That .zip uses the Zip64 format, which is far larger than a resource pack needs.');
    }

    const entries = [];
    let p = dirAt;
    for (let i = 0; i < count; i++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10);
      const csize = u32(b, p + 20);
      const usize = u32(b, p + 24);
      const nameLen = u16(b, p + 28);
      const extraLen = u16(b, p + 30);
      const commentLen = u16(b, p + 32);
      const localAt = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name, method, csize, usize, localAt, dir: name.endsWith('/') });
      p += 46 + nameLen + extraLen + commentLen;
    }

    async function read(entry) {
      /* The local header repeats the name and extra field, and its lengths are
       * the ones that count for finding the data. */
      const lp = entry.localAt;
      if (u32(b, lp) !== 0x04034b50) throw new Error('Damaged entry: ' + entry.name);
      const nameLen = u16(b, lp + 26);
      const extraLen = u16(b, lp + 28);
      const from = lp + 30 + nameLen + extraLen;
      const raw = b.subarray(from, from + entry.csize);

      if (entry.method === 0) return raw.slice();
      if (entry.method !== 8) throw new Error('Unsupported compression in ' + entry.name);
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    return { entries: entries, read: read };
  };

  /* ------------------------------------------------------------ png header */

  function pngSize(bytes) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
    const be = (o) => (bytes[o] << 24 | bytes[o + 1] << 16 | bytes[o + 2] << 8 | bytes[o + 3]) >>> 0;
    return { w: be(16), h: be(20) };
  }

  const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;

  /* --------------------------------------------------------------- verdict */

  NS.inspect = async function (file) {
    const out = {
      file: file.name,
      size: file.size,
      /* Set up front so every early return still answers the question, rather
       * than leaving it undefined for the caller to trip over. */
      compatible: false,
      errors: [],
      warnings: [],
      notes: [],
      versions: [],
      pack_format: null,
      description: '',
      counts: { textures: 0, sounds: 0, lang: 0, models: 0, other: 0 },
      icon: null
    };

    if (file.size > 25 * 1024 * 1024) {
      out.errors.push('The pack is ' + (file.size / 1048576).toFixed(1) + ' MB. The limit is 25 MB.');
      return out;
    }

    let zip;
    try {
      zip = await NS.readZip(await file.arrayBuffer());
    } catch (e) {
      out.errors.push(e.message);
      return out;
    }

    const names = zip.entries.filter((e) => !e.dir).map((e) => e.name);
    if (!names.length) {
      out.errors.push('The .zip is empty.');
      return out;
    }

    /* A pack whose contents sit inside a wrapper folder is the single most
     * common mistake, and the game just ignores it. */
    const hasRootMeta = names.includes('pack.mcmeta');
    const nestedMeta = names.find((n) => /^[^/]+\/pack\.mcmeta$/.test(n));
    if (!hasRootMeta && nestedMeta) {
      out.errors.push(
        'pack.mcmeta is inside a folder (' + nestedMeta.split('/')[0] + '/), not at the top of the zip. ' +
        'Zip the contents of the pack folder, not the folder itself.'
      );
    } else if (!hasRootMeta) {
      out.errors.push('There is no pack.mcmeta. Every resource pack needs one at the top of the zip.');
    }

    /* Entry names that climb out of the folder are never legitimate. */
    const escaping = names.filter((n) => n.startsWith('/') || n.includes('..') || /^[a-zA-Z]:/.test(n));
    if (escaping.length) {
      out.errors.push('The zip contains unsafe paths (' + escaping[0] + '). It was not built by a normal packer.');
    }

    if (hasRootMeta) {
      const entry = zip.entries.find((e) => e.name === 'pack.mcmeta');
      try {
        const text = dec.decode(await zip.read(entry));
        let meta;
        try {
          meta = JSON.parse(text);
        } catch (e) {
          /* Minecraft tolerates a UTF-8 BOM here, so try again without it. */
          meta = JSON.parse(text.replace(/^﻿/, ''));
        }
        const pack = meta && meta.pack;
        if (!pack) {
          out.errors.push('pack.mcmeta has no "pack" section.');
        } else {
          const fmt = Number(pack.pack_format);
          out.pack_format = Number.isFinite(fmt) ? fmt : null;
          out.description = typeof pack.description === 'string' ? pack.description
            : pack.description ? JSON.stringify(pack.description) : '';

          const known = FORMATS[out.pack_format];
          if (!out.pack_format) {
            out.errors.push('pack.mcmeta does not say which pack_format it is.');
          } else if (!known) {
            out.errors.push('pack_format ' + out.pack_format + ' is newer than anything Eaglercraft understands.');
          } else if (!known.versions.length) {
            out.errors.push(
              'pack_format ' + out.pack_format + ' targets Minecraft ' + known.label +
              ', and Orion runs 1.8 and 1.12.2. Change it to 1 for 1.8, or 3 for 1.12.2.'
            );
          } else {
            out.versions = known.versions.slice();
            out.notes.push('pack_format ' + out.pack_format + ' — Minecraft ' + known.label + '.');
          }
        }
      } catch (e) {
        out.errors.push('pack.mcmeta could not be read: ' + e.message);
      }
    }

    /* Where the files are is as important as what they say. */
    const assets = names.filter((n) => n.startsWith('assets/'));
    if (!assets.length) {
      out.errors.push('There is no assets/ folder, so the pack replaces nothing.');
    } else if (!names.some((n) => n.startsWith('assets/minecraft/'))) {
      out.warnings.push('Nothing under assets/minecraft/, so this pack changes no vanilla content.');
    }

    let badPng = [];
    let nonSquareIcon = null;

    for (const e of zip.entries) {
      if (e.dir) continue;
      const n = e.name.toLowerCase();
      if (n.endsWith('.png')) {
        out.counts.textures++;
        /* Only a sample: reading every texture in a large pack is slow and
         * tells us nothing new. */
        if (badPng.length < 4 && out.counts.textures <= 60) {
          try {
            const head = (await zip.read(e)).subarray(0, 26);
            const size = pngSize(head);
            if (!size) badPng.push(e.name + ' is not really a PNG');
            else if (!isPow2(size.w) || !isPow2(size.h)) {
              badPng.push(e.name + ' is ' + size.w + '×' + size.h);
            }
          } catch (err) { /* a single unreadable texture is not fatal */ }
        }
      } else if (n.endsWith('.ogg')) out.counts.sounds++;
      else if (n.endsWith('.lang') || n.endsWith('.json') && n.includes('/lang/')) out.counts.lang++;
      else if (n.endsWith('.json')) out.counts.models++;
      else out.counts.other++;
    }

    if (badPng.length) {
      out.warnings.push(
        'Some textures are not a power-of-two size (' + badPng.slice(0, 3).join('; ') +
        '). Minecraft 1.8 stretches or rejects those.'
      );
    }
    if (out.counts.sounds) {
      out.notes.push(out.counts.sounds + ' sound file' + (out.counts.sounds === 1 ? '' : 's') + ' — Eaglercraft plays .ogg.');
    }
    if (names.some((n) => /^assets\/minecraft\/shaders\//i.test(n))) {
      out.warnings.push('This pack includes shaders, which Eaglercraft does not run. The rest will still load.');
    }
    if (names.some((n) => /optifine/i.test(n))) {
      out.warnings.push('There are OptiFine-specific files in here. Eaglercraft ignores them.');
    }
    if (!out.counts.textures && !out.counts.sounds && !out.counts.lang) {
      out.warnings.push('No textures, sounds or language files found — is this really a resource pack?');
    }

    /* pack.png is the pack's own icon, which is exactly what a store listing
     * wants to show. */
    const iconEntry = zip.entries.find((e) => e.name === 'pack.png');
    if (iconEntry && iconEntry.usize < 512 * 1024) {
      try {
        const bytes = await zip.read(iconEntry);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        out.icon = 'data:image/png;base64,' + btoa(bin);
      } catch (e) { /* the listing just has no picture */ }
    } else if (!iconEntry) {
      out.notes.push('No pack.png, so the listing will have no picture.');
    }

    out.compatible = out.errors.length === 0 && out.versions.length > 0;
    return out;
  };
})(window.ORION_MODS);
