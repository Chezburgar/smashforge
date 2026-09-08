# The disc printer

Music discs are the only sound in Minecraft that a player chooses to play, and
a resource pack can replace them. So this makes packs: pick a track, put it on
one of the twelve discs the game already has, and every jukebox in every world
plays yours instead.

```
orion/discs/index.html   the three steps: make a track, fill a slot, print
orion/discs/js/music.js  generates a track and renders it offline
orion/discs/js/wav.js    samples to a file the client will decode
orion/discs/js/art.js    draws the 16x16 disc and the pack icon
orion/discs/js/pack.js   lays the files out as a resource pack
```

It leans on `orion/js/zip.js` to build the zip and `orion/js/packs.js` to write
the pack straight into the client's own storage.

## Where the music comes from

Two places, and the difference matters for what ends up in the pack.

**A file you already have** — the primary route, and the first tab. Decoded
with `decodeAudioData` to prove it works, then copied into the pack byte for
byte, so an mp3 stays mp3-sized.

**A generated one.** SMASHFORGE's soundtrack is synthesised rather than
recorded — an eight-bar loop of oscillators whose filter opens as a fight heats
up (`js/audio.js`). `music.js` borrows that vocabulary and rearranges it for
something you would put on a record: an intro, a middle that moves, and an
ending, in one of five moods. It renders through an `OfflineAudioContext`,
which runs as fast as the machine allows rather than in real time, so a
three-minute track takes a few seconds. A track is decided entirely by its mood
and its seed, so writing a seed down is enough to get the same disc back.

> This synthesiser is **not** "Orion Music". Orion Music is a different
> thing — the YouTube-backed music app in the
> [Orion desktop](https://github.com/Chezburgar/orion) — and an earlier version
> of this page borrowed its name for the generator, which was confusing. They
> are unrelated.

## A YouTube track cannot become a disc

Worth stating plainly, because it is the obvious thing to want. Orion Music
plays through YouTube's own IFrame player, which never hands the audio to the
page, and the YouTube Data API returns metadata only — there is no endpoint that
gives you a sound file. So nothing here can take a link and produce a record
from it. If you have the track as a file, the printer takes the file.

## The printer, as a block

The pack also reskins the **jukebox** into an Orion Disc Printer — new
textures, new name — so there is a machine in the world that plays what you
printed.

It is a reskin, and the page says so. A resource pack can change what a block
looks like and what it is called, and nothing else: a genuinely new block is
code — a registry entry, a model, a state, an item form, network ids both sides
agree on — and this client is compiled and signed, so there is nowhere to put
code. The jukebox is already the machine that plays records, so it is the one
dressed up. It behaves exactly like a jukebox, because it is one.

Three files, whose names were confirmed by installing a pack and looking at the
result rather than from memory:

| File | What it changes |
|---|---|
| `textures/blocks/jukebox_side.png` | the four sides |
| `textures/blocks/jukebox_top.png` | the face with the platter |
| `tile.jukebox.name` in the language file | what it is called in hand and in the world |

## Why a .ogg file that is not an Ogg

A pack's disc audio has to live at
`assets/minecraft/sounds/records/<name>.ogg`, because that is the path the game
asks for. What is *inside* the file is up to whoever decodes it, and
EaglercraftX hands pack audio to the browser's `decodeAudioData` — its own
JOrbis decoder is off unless `eaglercraftXOpts.useJOrbisAudioDecoder` is set,
which Orion never sets. `decodeAudioData` reads the container, not the
filename, so a WAV in a file called `.ogg` plays exactly as an Ogg would.

That matters because there is no way to make a real Ogg Vorbis file here.
Encoding Vorbis needs a library, this site ships no dependencies, and the
client is signed so it cannot be taught anything new. Writing a WAV is fifty
lines and lossless.

The cost is size: 16-bit mono at 22.05 kHz is 44 KB a second, so a ninety-second
generated disc is about 3.9 MB. Hence the sample rate, hence the length cap, and
hence why a track you bring is passed through untouched instead — an mp3 you
already have is a tenth of the size and decodes just as happily.

Verified by rendering a track, writing it, and decoding it back in the same
browser the game runs in: the header says 22050 Hz mono 16-bit, the decode
succeeds, the duration survives and the audio is not silence.

## What a printed pack contains

For each disc you filled:

| File | What it does |
|---|---|
| `assets/minecraft/sounds/records/<slot>.ogg` | what the jukebox plays |
| `assets/minecraft/textures/items/record_<slot>.png` | the disc in your hand |
| a line in the language file | the tooltip, via `item.record.<slot>.desc` |

Nothing writes `sounds.json`. Vanilla already maps the sound event
`records.13` to `records/13.ogg`, and a pack providing that path replaces it —
so the pack stays small and cannot break the sound registry by getting the
mapping wrong.

Slots you leave alone are not in the pack at all, so printing two discs does
not silence the other ten.

## The disc art

A vanilla music disc is a black ring with a coloured centre, and the twelve are
told apart only by that colour — so a pack that replaces the sound and leaves
the picture alone gives you twelve identical-looking discs playing different
things. `art.js` draws each one instead: a label colour from the mood, grooves
placed from the seed, and one of four marks stamped in the middle. 16x16 with no
anti-aliasing anywhere, because at that size every pixel has to be deliberate.
