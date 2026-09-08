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
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const P = {};
  O.Packs = P;

  const PREFIX = '_net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_8_8_';
  const MANIFEST = 'resourcepacks/manifest.json';

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
      return { folder: folder, files: files.length, packs: manifest.resourcePacks.length };
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
      return true;
    } finally {
      db.close();
    }
  };
})(window.ORION);
