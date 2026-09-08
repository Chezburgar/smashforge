/* ORION DISC PRINTER — samples to a sound file the client will play
 *
 * Music discs in a resource pack live at assets/minecraft/sounds/records/<name>.ogg,
 * and the name has to end in .ogg because that is the path the game asks for.
 * What is *inside* the file is decided by whoever decodes it, and EaglercraftX
 * hands pack audio to the browser's decodeAudioData (its own JOrbis decoder is
 * off unless eaglercraftXOpts.useJOrbisAudioDecoder is set, which Orion never
 * sets). decodeAudioData reads the container, not the file name, so a WAV in a
 * file called .ogg plays exactly as an Ogg would.
 *
 * That matters because there is no way to make a real Ogg Vorbis file here:
 * encoding Vorbis needs a library, this site ships no dependencies, and the
 * bundle is signed so it cannot be taught anything new. Writing a WAV, on the
 * other hand, is fifty lines and completely lossless.
 *
 * The cost is size. 16-bit mono at 22.05 kHz is 44 KB a second, so a
 * ninety-second disc is about 3.9 MB. That is why the printer renders at that
 * rate and caps the length, and why a track you bring yourself is passed
 * through untouched instead: an mp3 you already have is a tenth of the size
 * and decodeAudioData reads it just as happily.
 */
window.ORION_DISCS = window.ORION_DISCS || {};
(function (NS) {
  'use strict';

  /* Float samples in -1..1 to a 16-bit PCM WAV. */
  NS.toWav = function (samples, sampleRate) {
    const n = samples.length;
    const bytes = new Uint8Array(44 + n * 2);
    const v = new DataView(bytes.buffer);
    const ascii = (at, s) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };

    ascii(0, 'RIFF');
    v.setUint32(4, 36 + n * 2, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    v.setUint32(16, 16, true);          // fmt chunk size
    v.setUint16(20, 1, true);           // PCM
    v.setUint16(22, 1, true);           // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true);  // byte rate
    v.setUint16(32, 2, true);           // block align
    v.setUint16(34, 16, true);          // bits per sample
    ascii(36, 'data');
    v.setUint32(40, n * 2, true);

    let at = 44;
    for (let i = 0; i < n; i++) {
      /* Clamp before scaling: a stray sample over 1 would wrap round to full
       * negative and click. */
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      at += 2;
    }
    return bytes;
  };

  /* What the browser will accept as a track someone brings themselves. The
   * check is a real decode, not a look at the extension, because that is
   * exactly what the game will do with it. */
  NS.decodeAudio = async function (arrayBuffer) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('This browser has no Web Audio, so nothing can be checked.');
    const ctx = new AC();
    try {
      /* decodeAudioData detaches the buffer it is given, and the caller still
       * needs the original bytes to put in the pack. */
      const buf = await ctx.decodeAudioData(arrayBuffer.slice(0));
      return { seconds: buf.duration, channels: buf.numberOfChannels, sampleRate: buf.sampleRate, buffer: buf };
    } finally {
      if (ctx.close) ctx.close();
    }
  };

  /* Mix an AudioBuffer down to one channel of floats, resampling as it goes.
   * Used when a brought-in track has to be re-encoded (because it was trimmed,
   * or because it arrived as a wav far bigger than it needs to be). */
  NS.downmix = function (buffer, rate) {
    const ratio = buffer.sampleRate / rate;
    const out = new Float32Array(Math.floor(buffer.length / ratio));
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    for (let i = 0; i < out.length; i++) {
      const at = i * ratio;
      const a = Math.floor(at);
      const b = Math.min(buffer.length - 1, a + 1);
      const f = at - a;
      let sum = 0;
      for (const ch of chans) sum += ch[a] * (1 - f) + ch[b] * f;
      out[i] = sum / chans.length;
    }
    return out;
  };
})(window.ORION_DISCS);
