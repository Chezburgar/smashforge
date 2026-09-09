/* ORION CLIENT — installing a resource pack into the game
 *
 * The client keeps resource packs in an IndexedDB database of its own, and the
 * game runs inside this page, so that database belongs to this origin: Orion
 * can put a pack there itself instead of making you find the file, open
 * Options, open Resource Packs and pick it. That is what turns "print my
 * discs" into one button.
 *
 * The layout was read off a real install rather than guessed. Adding a pack
 * through the client's own "Open resource pack" button produces:
 *
 *   database  _net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_8_8_<opts.resourcePacksDB>
 *   store     "filesystem", keyPath ["path"]
 *   rows      { path: "resourcepacks/<folder>/<file inside the zip>", data: bytes }
 *   index     resourcepacks/manifest.json
 *               {"resourcePacks":[{"timestamp":…,"name":…,"folder":…,"domains":[…]}]}
 *
 * So the client does not keep the zip: it unpacks it on import and reads loose
 * files afterwards. Writing those same rows is indistinguishable from having
 * imported the zip by hand.
 *
 * Import also writes two files that are in no zip:
 *
 *   assets/<domain>/optifine/_property_files_index.json        {"propertyFiles":[]}
 *   assets/<domain>/mcpatcher/cit/potion/_potions_files_index.json  {"potionsFiles":[]}
 *
 * They are there because this filesystem cannot list a directory, so the
 * client indexes the OptiFine and MCPatcher files up front instead of
 * searching for them later. Orion writes them too, empty — which is the honest
 * answer for the packs it builds, none of which contain either.
 *
 * The game reads that manifest while it starts up, so a pack installed while
 * the game is already running appears the next time it launches. Orion says so
 * rather than pretending it is instant.
 *
 * Installing is only half the job, and for a while Orion only did that half:
 * a pack in the manifest shows up under *Available* in the game's Resource
 * Packs screen and does nothing at all until somebody moves it to *Selected*.
 * So discs, the printer block and the whole menu theme all appeared to be
 * ignored — they were installed and switched off.
 *
 * Which packs are on is recorded somewhere else entirely: the client keeps a
 * vanilla-style options.txt, gzipped, base64'd, in
 * localStorage["<localStorageNamespace>.g"], and the line that matters is
 *
 *     resourcePacks:["orion-theme"]
 *
 * exactly as Minecraft writes it. That was found by selecting a pack through
 * the game's own screen and diffing localStorage, not by reading tea leaves.
 * So install() now edits that line too, and "put it in my game" means the
 * thing is actually on the next time the game starts.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const P = {};
  O.Packs = P;

  const PREFIX = '_net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_8_8_';
  const MANIFEST = 'resourcepacks/manifest.json';

  /* Where the client keeps its settings. `.g` is the game options; there are
   * also `.p` (profile) and `.r`, which none of this touches. */
  const SETTINGS_SUFFIX = '.g';
  const PACKS_LINE = /^resourcePacks:.*$/m;

  /* 1.12.2 is a different client with its own filesystem prefix, and Orion has
   * not read its layout off a real install, so packsDB is null there: installing
   * is offered only where the storage layout is known. Downloading the pack and
   * adding it through the game's own Resource Packs screen always works. */
  P.dbNameFor = function (version) {
    const v = (O.Versions && O.Versions.get) ? O.Versions.get(version || '1.8') : null;
    if (!v || !v.packsDB) return null;
    return PREFIX + v.packsDB;
  };

  P.supported = function (version) {
    return !!(window.indexedDB && P.dbNameFor(version || '1.8'));
  };

  function open(name) {
    return new Promise(function (res, rej) {
      /* Version 1 with the same store the client creates, so whichever of us
       * gets there first, the other finds what it expects. */
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains('filesystem')) {
          db.createObjectStore('filesystem', { keyPath: ['path'] });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error || new Error('The game’s storage could not be opened.'));
      req.onblocked = () => rej(new Error('The game has that storage open. Close the game tab and try again.'));
    });
  }

  function done(tx) {
    return new Promise(function (res, rej) {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error || new Error('The write failed.'));
      tx.onabort = () => rej(tx.error || new Error('The write was rolled back.'));
    });
  }

  function get(store, path) {
    return new Promise(function (res) {
      const q = store.get([path]);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    });
  }

  function all(store) {
    return new Promise(function (res) {
      const q = store.getAll();
      q.onsuccess = () => res(q.result || []);
      q.onerror = () => res([]);
    });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  /* A folder name the client will accept: it becomes part of every row's path
   * and is shown in the pack list. */
  P.folderName = function (title) {
    const s = String(title || 'orion-pack').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (s || 'orion-pack').slice(0, 40);
  };

  /* Written per namespace, exactly as the client's own import does. */
  const INDEX_FILES = [
    { at: 'optifine/_property_files_index.json', body: '{"propertyFiles":[]}' },
    { at: 'mcpatcher/cit/potion/_potions_files_index.json', body: '{"potionsFiles":[]}' }
  ];

  /* Which asset namespaces a pack touches. The client records this so it can
   * skip packs that cannot affect what it is loading. */
  function domainsOf(names) {
    const out = [];
    for (const n of names) {
      const m = /^assets\/([^/]+)\//.exec(n);
      if (m && out.indexOf(m[1]) < 0) out.push(m[1]);
    }
    return out.length ? out : ['minecraft'];
  }

  /* ------------------------------------------------------- turning it on */

  function settingsKey(version) {
    const v = (O.Versions && O.Versions.get) ? O.Versions.get(version || '1.8') : null;
    if (!v || !v.packsDB) return null;
    return (v.storageNamespace || '_eaglercraftX') + SETTINGS_SUFFIX;
  }

  /* gzip both ways. The client writes gzip, so it reads gzip; CompressionStream
   * has been in every browser that can run the game for years, but if it is
   * missing we say so instead of writing something the client cannot read. */
  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function gzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  const b64decode = (s) => {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const b64encode = (bytes) => {
    let bin = '';
    /* In chunks: a 3 KB settings file is fine either way, but spreading a big
     * array over apply() has blown the argument limit before. */
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  };

  /* The list as the options file has it. */
  function readList(text) {
    const m = PACKS_LINE.exec(text);
    if (!m) return null;
    const raw = m[0].slice('resourcePacks:'.length).trim();
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  P.selected = async function (version) {
    const key = settingsKey(version);
    if (!key) return [];
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return []; }
    if (!raw) return [];
    try {
      const text = new TextDecoder().decode(await gunzip(b64decode(raw)));
      return readList(text) || [];
    } catch (e) {
      return [];
    }
  };

  /* Add a pack to the selected list, keeping whatever was already there.
   *
   * Before the client has ever run there is no settings file, and a first-time
   * player installing a pack and finding it off would be the same bug again —
   * so one is created with just the line that matters. That is safe because
   * the options file is read key by key and anything absent keeps the
   * client's own default, exactly as in Minecraft; the file grows to its full
   * shape the first time the client saves.
   *
   * What this deliberately does not touch is incompatibleResourcePacks, which
   * is the client's own record of packs whose pack_format it did not like. */
  P.enable = async function (folder, version) {
    const key = settingsKey(version);
    if (!key) return { ok: false, reason: 'unsupported-version' };
    if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') {
      return { ok: false, reason: 'no-gzip' };
    }

    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return { ok: false, reason: 'no-storage' }; }

    let text;
    let created = false;
    if (!raw) {
      text = 'resourcePacks:[]\n';
      created = true;
    } else {
      try {
        text = new TextDecoder().decode(await gunzip(b64decode(raw)));
      } catch (e) {
        return { ok: false, reason: 'unreadable-settings' };
      }
    }

    let list = readList(text);
    if (list === null) {
      /* A settings file that somehow has no such line: append one rather than
       * give up, since every other line is left exactly as it was. */
      text = text.replace(/\n?$/, '\n') + 'resourcePacks:[]\n';
      list = [];
    }
    if (list.indexOf(folder) >= 0) return { ok: true, already: true, created: created, list: list };

    /* Appended rather than prepended: the client applies the list in order, so
     * the last one in wins where two packs touch the same file, and a pack you
     * just asked for should beat one from last week. */
    const next = list.concat([folder]);
    const updated = text.replace(PACKS_LINE, 'resourcePacks:' + JSON.stringify(next));

    try {
      localStorage.setItem(key, b64encode(await gzip(new TextEncoder().encode(updated))));
    } catch (e) {
      return { ok: false, reason: 'write-failed' };
    }
    return { ok: true, created: created, list: next };
  };

  P.disable = async function (folder, version) {
    const key = settingsKey(version);
    if (!key) return { ok: false, reason: 'unsupported-version' };
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return { ok: false, reason: 'no-storage' }; }
    if (!raw) return { ok: false, reason: 'no-settings-yet' };
    let text;
    try {
      text = new TextDecoder().decode(await gunzip(b64decode(raw)));
    } catch (e) {
      return { ok: false, reason: 'unreadable-settings' };
    }
    const list = readList(text);
    if (list === null) return { ok: false, reason: 'no-packs-line' };
    const next = list.filter((x) => x !== folder);
    const updated = text.replace(PACKS_LINE, 'resourcePacks:' + JSON.stringify(next));
    try {
      localStorage.setItem(key, b64encode(await gzip(new TextEncoder().encode(updated))));
    } catch (e) {
      return { ok: false, reason: 'write-failed' };
    }
    return { ok: true, list: next };
  };

  /* files: [{ name, bytes }] — the same shape Zip.build takes, so a pack can be
   * installed and downloaded from one description of it. */
  P.install = async function (opts) {
    const version = opts.version || '1.8';
    const dbName = P.dbNameFor(version);
    if (!dbName) throw new Error('Orion can only install packs into the 1.8 client for now.');

    const folder = P.folderName(opts.folder || opts.title);
    const files = (opts.files || []).filter((f) => f && f.name);
    if (!files.length) throw new Error('There is nothing in this pack.');

    const db = await open(dbName);
    try {
      /* Replacing an install of the same name means clearing its old rows
       * first, or a pack that used to have twelve discs and now has two would
       * keep playing the ten that were removed. */
      const readTx = db.transaction('filesystem', 'readonly');
      const existing = await all(readTx.objectStore('filesystem'));
      const stale = existing
        .map((r) => r.path)
        .filter((p) => p.indexOf('resourcepacks/' + folder + '/') === 0);
      const manifestRow = await get(db.transaction('filesystem', 'readonly').objectStore('filesystem'), MANIFEST);

      let manifest = { resourcePacks: [] };
      if (manifestRow && manifestRow.data) {
        try {
          manifest = JSON.parse(dec.decode(new Uint8Array(manifestRow.data.buffer || manifestRow.data)));
        } catch (e) { /* a corrupt manifest is replaced rather than trusted */ }
      }
      if (!manifest || !Array.isArray(manifest.resourcePacks)) manifest = { resourcePacks: [] };

      const tx = db.transaction('filesystem', 'readwrite');
      const store = tx.objectStore('filesystem');
      for (const p of stale) store.delete([p]);

      for (const f of files) {
        const bytes = typeof f.bytes === 'string' ? enc.encode(f.bytes) : f.bytes;
        /* The client stores an ArrayBuffer, so hand it one of exactly the
         * right length rather than a view into a larger buffer. */
        const buf = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
          ? bytes.buffer
          : bytes.slice().buffer;
        store.put({ path: 'resourcepacks/' + folder + '/' + f.name, data: buf });
      }

      for (const domain of domainsOf(files.map((f) => f.name))) {
        for (const ix of INDEX_FILES) {
          /* Not overwritten if the pack shipped one of its own. */
          const at = 'assets/' + domain + '/' + ix.at;
          if (files.some((f) => f.name === at)) continue;
          store.put({ path: 'resourcepacks/' + folder + '/' + at, data: enc.encode(ix.body).buffer });
        }
      }

      manifest.resourcePacks = manifest.resourcePacks.filter((e) => e && e.folder !== folder);
      manifest.resourcePacks.push({
        timestamp: Date.now(),
        name: folder,
        folder: folder,
        domains: domainsOf(files.map((f) => f.name))
      });
      store.put({ path: MANIFEST, data: enc.encode(JSON.stringify(manifest)).buffer });

      await done(tx);

      /* Installed but not selected is the same as not installed at all, so
       * turning it on is part of installing it. The result says whether that
       * worked, because the caller has to tell the truth about it. */
      const on = opts.enable === false
        ? { ok: false, reason: 'not-requested' }
        : await P.enable(folder, version);

      return {
        folder: folder,
        files: files.length,
        packs: manifest.resourcePacks.length,
        enabled: on.ok,
        enableReason: on.ok ? null : on.reason
      };
    } finally {
      db.close();
    }
  };

  /* What is installed, so a page can say "already in your game" instead of
   * offering the same install twice. */
  P.list = async function (version) {
    const dbName = P.dbNameFor(version || '1.8');
    if (!dbName) return [];
    let db;
    try { db = await open(dbName); } catch (e) { return []; }
    try {
      const row = await get(db.transaction('filesystem', 'readonly').objectStore('filesystem'), MANIFEST);
      if (!row || !row.data) return [];
      const m = JSON.parse(dec.decode(new Uint8Array(row.data.buffer || row.data)));
      return Array.isArray(m.resourcePacks) ? m.resourcePacks : [];
    } catch (e) {
      return [];
    } finally {
      db.close();
    }
  };

  P.remove = async function (folder, version) {
    const dbName = P.dbNameFor(version || '1.8');
    if (!dbName) return false;
    const db = await open(dbName);
    try {
      const rows = await all(db.transaction('filesystem', 'readonly').objectStore('filesystem'));
      const row = await get(db.transaction('filesystem', 'readonly').objectStore('filesystem'), MANIFEST);
      let manifest = { resourcePacks: [] };
      if (row && row.data) {
        try { manifest = JSON.parse(dec.decode(new Uint8Array(row.data.buffer || row.data))); } catch (e) { /* replaced */ }
      }
      const tx = db.transaction('filesystem', 'readwrite');
      const store = tx.objectStore('filesystem');
      for (const r of rows) {
        if (r.path.indexOf('resourcepacks/' + folder + '/') === 0) store.delete([r.path]);
      }
      manifest.resourcePacks = (manifest.resourcePacks || []).filter((e) => e && e.folder !== folder);
      store.put({ path: MANIFEST, data: enc.encode(JSON.stringify(manifest)).buffer });
      await done(tx);
      /* Leaving a deleted pack in the selected list makes the client complain
       * about a missing pack on every start. */
      await P.disable(folder, version);
      return true;
    } finally {
      db.close();
    }
  };
})(window.ORION);
