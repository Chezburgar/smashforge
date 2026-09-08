/* ORION DISC PRINTER — assembling the pack
 *
 * The twelve vanilla music discs are the twelve slots a pack can fill. Each one
 * is three files: the sound the jukebox plays, the picture of the disc in your
 * hand, and a line of language file deciding what the tooltip says.
 *
 * Nothing here needs sounds.json. Vanilla already maps the sound event
 * "records.13" to the file records/13.ogg, and a resource pack that provides
 * that path replaces it — so the pack stays small and cannot break the sound
 * registry by getting the mapping wrong.
 */
window.ORION_DISCS = window.ORION_DISCS || {};
(function (NS) {
  'use strict';

  /* Slot order is the order they appear in the creative inventory, which is
   * the order people expect to see them listed. `artist` and `title` are what
   * vanilla shows, kept as a hint for anyone deciding which one to overwrite. */
  const SLOTS = [
    { id: '13',      artist: 'C418', title: '13' },
    { id: 'cat',     artist: 'C418', title: 'cat' },
    { id: 'blocks',  artist: 'C418', title: 'blocks' },
    { id: 'chirp',   artist: 'C418', title: 'chirp' },
    { id: 'far',     artist: 'C418', title: 'far' },
    { id: 'mall',    artist: 'C418', title: 'mall' },
    { id: 'mellohi', artist: 'C418', title: 'mellohi' },
    { id: 'stal',    artist: 'C418', title: 'stal' },
    { id: 'strad',   artist: 'C418', title: 'strad' },
    { id: 'ward',    artist: 'C418', title: 'ward' },
    { id: '11',      artist: 'C418', title: '11' },
    { id: 'wait',    artist: 'C418', title: 'wait' }
  ];
  NS.SLOTS = SLOTS;

  /* 1.8 and 1.12.2 want different pack_format numbers and different language
   * file names, and that is the whole difference for a pack like this. */
  const TARGETS = {
    '1.8': { pack_format: 1, lang: 'assets/minecraft/lang/en_US.lang' },
    '1.12.2': { pack_format: 3, lang: 'assets/minecraft/lang/en_us.lang' }
  };
  NS.TARGETS = TARGETS;

  const esc = (s) => String(s == null ? '' : s).replace(/[\r\n=]/g, ' ').trim();

  /* The jukebox, reskinned as the printer. A pack cannot add a block — blocks
   * are code and the client is signed — but the jukebox is already the machine
   * that plays records, so it is the honest thing to dress up. These are the
   * three files 1.8 draws it from, and the language key that names it. */
  const BLOCK = {
    side: 'assets/minecraft/textures/blocks/jukebox_side.png',
    top: 'assets/minecraft/textures/blocks/jukebox_top.png',
    langKey: 'tile.jukebox.name'
  };
  NS.BLOCK = BLOCK;

  /* discs: [{ slot, name, artist, audio: Uint8Array, art: Uint8Array }]
   * Only filled slots are written; anything left alone keeps its vanilla
   * sound, which is what you want when printing two discs rather than twelve. */
  NS.build = async function (opts) {
    const target = TARGETS[opts.version] || TARGETS['1.8'];
    const discs = (opts.discs || []).filter((d) => d && d.audio && d.audio.length);
    /* A pack of nothing but the printer block is a reasonable thing to want,
     * so only refuse when there is neither. */
    if (!discs.length && !opts.block) throw new Error('No discs to print yet.');

    const files = [];
    const lang = [];

    files.push({
      name: 'pack.mcmeta',
      bytes: JSON.stringify({
        pack: {
          pack_format: target.pack_format,
          description: esc(opts.description || ('Music discs printed by Orion — ' + discs.length +
            ' track' + (discs.length === 1 ? '' : 's')))
        }
      }, null, 2)
    });

    if (opts.icon) files.push({ name: 'pack.png', bytes: opts.icon });

    /* opts.block: { side, top, name } — the retextured jukebox. */
    if (opts.block) {
      files.push({ name: BLOCK.side, bytes: opts.block.side });
      files.push({ name: BLOCK.top, bytes: opts.block.top });
      lang.push(BLOCK.langKey + '=' + (esc(opts.block.name) || 'Orion Disc Printer'));
    }

    for (const d of discs) {
      files.push({ name: 'assets/minecraft/sounds/records/' + d.slot + '.ogg', bytes: d.audio });
      if (d.art) files.push({ name: 'assets/minecraft/textures/items/record_' + d.slot + '.png', bytes: d.art });
      /* The tooltip on a disc comes from item.record.<slot>.desc, which
       * vanilla fills with "C418 - 13" and so on. */
      const artist = esc(d.artist) || 'Orion';
      const title = esc(d.name) || d.slot;
      lang.push('item.record.' + d.slot + '.desc=' + artist + ' - ' + title);
    }

    /* A .lang file is plain key=value. Sorting keeps a rebuilt pack
     * byte-identical, which makes it obvious when a pack really changed. */
    lang.sort();
    files.push({ name: target.lang, bytes: lang.join('\n') + '\n' });

    /* Audio is the bulk of this and deflating it saves almost nothing when it
     * is already an mp3; the zip writer works that out per file. */
    const bytes = await window.ORION.Zip.build(files);
    return { bytes: bytes, files: files.map((f) => f.name), count: discs.length };
  };
})(window.ORION_DISCS);
