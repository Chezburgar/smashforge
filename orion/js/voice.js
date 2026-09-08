/* ORION CLIENT — proximity voice
 *
 * Proximity voice chat is already in both builds Orion ships. It is not a mod
 * and it cannot be one: the client is compiled and signed, so nothing can be
 * added to it. What it does have is a voice client with a radius — you hear
 * people who are near you in the world and lose them as they walk away — sat
 * behind three things that have to be true at once:
 *
 *   1. The client allows it.  eaglercraftXOpts.allowVoiceClient, which is on by
 *      default and which launch.js now sets openly rather than relying on that.
 *   2. The browser gives up a microphone. navigator.mediaDevices.getUserMedia,
 *      which needs a secure page (Orion is served over HTTPS) and a yes from
 *      the person sitting there. There is no way to ask on their behalf.
 *   3. Something carries the signalling. A server running EaglerXServer with
 *      its voice service on, or — with no server at all — a shared world,
 *      because the client has an integrated voice service for exactly that.
 *
 * And then, in practice, a fourth: ICE has to work. The client ships **no**
 * STUN or TURN servers of its own — the only such address anywhere in the
 * bundle is a dummy used to check whether the browser has WebRTC at all — so
 * it uses whatever list the server hands it. Those lists are usually the ones
 * Eaglercraft shipped with years ago, and they stopped answering. That is why
 * voice "just does not work" for so many people, and why Orion wrapping
 * RTCPeerConnection with live TURN credentials (js/turn.js) is the thing that
 * fixes it rather than a nice extra.
 *
 * This module is the part Orion can honestly own: check the microphone, check
 * that a relayed connection is actually obtainable through this network, and
 * say plainly which of the four is in the way.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const V = {};
  O.Voice = V;

  V.secure = () => window.isSecureContext !== false;
  V.hasWebRTC = () => typeof window.RTCPeerConnection === 'function';
  V.hasMic = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  /* ------------------------------------------------------------ microphone */

  let stream = null;
  let meter = null;

  /* Asks for the microphone and keeps it open so a level meter can run. The
   * same permission the game will ask for: granting it here means the game
   * does not ask again. */
  V.openMic = async function () {
    if (!V.hasMic()) {
      throw new Error(V.secure()
        ? 'This browser has no microphone API, so voice cannot work here.'
        : 'This page is not on HTTPS, and a browser will not hand over a microphone to an insecure page.');
    }
    if (stream) return stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
    } catch (e) {
      const name = e && e.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new Error('The microphone was refused. Click the padlock in the address bar, ' +
          'allow the microphone for this site, and try again.');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new Error('No microphone was found. Plug one in, or check it is not disabled in your system settings.');
      }
      if (name === 'NotReadableError') {
        throw new Error('Something else is holding the microphone. Close the other tab or app using it.');
      }
      throw new Error('The microphone could not be opened: ' + (e && e.message ? e.message : String(e)));
    }
    return stream;
  };

  V.closeMic = function () {
    if (meter) { meter.stop(); meter = null; }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };

  V.micOpen = () => !!stream;

  V.deviceLabel = function () {
    if (!stream) return null;
    const t = stream.getAudioTracks()[0];
    return t ? (t.label || 'Microphone') : null;
  };

  /* onLevel is called with 0..1 roughly every animation frame. */
  V.startMeter = async function (onLevel) {
    const s = await V.openMic();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('This browser has no Web Audio, so the level cannot be shown.');
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(s);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let live = true;

    (function tick() {
      if (!live) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      /* RMS, then a little headroom so normal speech fills most of the bar. */
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
      requestAnimationFrame(tick);
    })();

    meter = {
      stop: function () {
        live = false;
        try { src.disconnect(); } catch (e) { /* already gone */ }
        if (ctx.close) ctx.close();
      }
    };
    return meter;
  };

  /* ------------------------------------------------------------------- ICE */

  /* Gathers candidates with whatever ICE servers Orion would give the game and
   * reports what came back. A `relay` candidate is the one that matters: it
   * means a call can be carried even when the two players cannot reach each
   * other directly, which is the case on most school and office networks.
   */
  V.checkIce = async function (timeoutMs) {
    if (!V.hasWebRTC()) return { ok: false, reason: 'This browser has no WebRTC at all, so voice cannot work.' };

    let servers = [];
    let source = 'none';
    if (O.Turn && O.Turn.list) {
      try {
        const list = await O.Turn.list();
        if (list && list.length) { servers = list; source = 'orion'; }
      } catch (e) { /* reported as "none" below */ }
    }

    /* Deliberately built with the unwrapped constructor, so this measures the
     * credentials rather than our own patching of them. */
    const Native = (O.Turn && O.Turn.nativePeerConnection && O.Turn.nativePeerConnection()) || window.RTCPeerConnection;
    const pc = new Native({ iceServers: servers });
    const kinds = Object.create(null);
    let error = null;

    try {
      pc.createDataChannel('orion-voice-check');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise(function (res) {
        const done = setTimeout(res, timeoutMs || 6000);
        pc.onicegatheringstatechange = function () {
          if (pc.iceGatheringState === 'complete') { clearTimeout(done); res(); }
        };
        pc.onicecandidateerror = function (ev) {
          /* 701 is "the STUN/TURN server could not be reached", which is the
           * exact failure worth reporting. */
          if (!error && ev && (ev.errorCode || ev.errorText)) {
            error = (ev.errorCode ? ev.errorCode + ': ' : '') + (ev.errorText || 'a server did not answer');
          }
        };
        pc.onicecandidate = function (ev) {
          if (!ev.candidate) return;
          const m = /(^| )typ ([a-z]+)/.exec(ev.candidate.candidate || '');
          if (m) kinds[m[2]] = (kinds[m[2]] || 0) + 1;
        };
      });
    } finally {
      try { pc.close(); } catch (e) { /* already closed */ }
    }

    return {
      ok: !!kinds.relay,
      source: source,
      servers: servers.length,
      kinds: kinds,
      error: error,
      direct: !!(kinds.srflx || kinds.host)
    };
  };
})(window.ORION);
