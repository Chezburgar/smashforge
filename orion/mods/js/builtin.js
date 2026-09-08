/* ORION MODS — the ones that ship with the launcher
 *
 * The store's other listings are resource packs somebody uploaded. These four
 * are built into Orion, and they are here because this is where you go looking
 * for things to add to the game — a separate row of links in the launcher's
 * navigation was the wrong place for them.
 *
 * They are not all the same shape, and pretending otherwise would be a lie in
 * the interface:
 *
 *   `builder`  opens a page that generates a pack you then install. The disc
 *              printer and the menu theme work this way, because what they make
 *              depends on choices only you can make — which track, which
 *              palette.
 *   `setup`    nothing to install: a feature already in the client that needs
 *              checking and turning on. Proximity voice is this.
 *   `tool`     makes a file for you to use elsewhere. The skin designer.
 *
 * Each card says which it is, so "install" never means something different
 * from one card to the next.
 */
window.ORION_MODS = window.ORION_MODS || {};
(function (NS) {
  'use strict';

  NS.BUILTIN = [
    {
      id: 'disc-printer',
      kind: 'builder',
      title: 'Disc Printer',
      summary: 'Your music on the game’s music discs, and a printer block to play them in.',
      body: 'Put a track on any of the twelve music discs and every jukebox in every world plays ' +
            'yours instead. Comes with the printer itself: the jukebox, reskinned and renamed as ' +
            'the Orion Disc Printer. Bring an audio file you have, or have one generated.',
      versions: ['1.8', '1.12.2'],
      href: '../discs/',
      action: 'Open printer',
      art: 'disc'
    },
    {
      id: 'proximity-voice',
      kind: 'setup',
      title: 'Proximity Voice',
      summary: 'Hear the people near you and lose them as they walk off. Already in the client — this makes it work.',
      body: 'Both builds have had a voice client with a radius all along. The reason it almost never ' +
            'connects is that the client ships no connection servers of its own and uses whatever the ' +
            'server sends, which is usually a list that stopped answering years ago. Orion supplies its ' +
            'own, so there is nothing to install — just a microphone to allow and a network to check.',
      versions: ['1.8', '1.12.2'],
      href: '../#together',
      action: 'Set it up',
      art: 'voice'
    },
    {
      id: 'menu-theme',
      kind: 'builder',
      title: 'Menu Theme',
      summary: 'The main menu, the buttons and the loading screen, in the launcher’s colours.',
      body: 'Pick a palette and it draws the set — a wordmark instead of the Minecraft logo, flat ' +
            'buttons, a sky, and a loading screen that matches the launcher. Installs straight into ' +
            'the client with one button.',
      versions: ['1.8', '1.12.2'],
      href: '../theme/',
      action: 'Open builder',
      art: 'theme'
    },
    {
      id: 'skin-designer',
      kind: 'tool',
      title: 'Skin Designer',
      summary: 'Draw a skin on a real 64×64 sheet, with a 3D preview that turns.',
      body: 'Every one of the 72 face rectangles in the right place, a live preview from four sides, ' +
            'and a PNG the client’s Add Skin accepts without conversion.',
      versions: ['1.8', '1.12.2'],
      href: '../skin/',
      action: 'Open designer',
      art: 'skin'
    }
  ];

  const KINDS = {
    builder: { label: 'builder', note: 'Makes a pack from your choices, then installs it.' },
    setup: { label: 'setup', note: 'Nothing to install — a client feature to check and switch on.' },
    tool: { label: 'tool', note: 'Makes a file you use elsewhere.' }
  };
  NS.KINDS = KINDS;

  /* Card artwork, drawn rather than shipped so the store needs no images. */
  NS.builtinArt = function (which, size) {
    const n = size || 96;
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const g = c.getContext('2d');
    const mid = n / 2;

    const ring = (r, w, colour) => {
      g.strokeStyle = colour; g.lineWidth = w;
      g.beginPath(); g.arc(mid, mid, r, 0, Math.PI * 2); g.stroke();
    };

    if (which === 'disc') {
      g.fillStyle = '#12101f'; g.beginPath(); g.arc(mid, mid, n * 0.44, 0, Math.PI * 2); g.fill();
      ring(n * 0.34, n * 0.03, 'rgba(214,201,247,0.2)');
      ring(n * 0.26, n * 0.02, 'rgba(214,201,247,0.14)');
      g.fillStyle = '#9c86dc'; g.beginPath(); g.arc(mid, mid, n * 0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#07060f'; g.beginPath(); g.arc(mid, mid, n * 0.04, 0, Math.PI * 2); g.fill();
    } else if (which === 'voice') {
      /* concentric arcs, the proximity idea */
      for (let i = 3; i >= 1; i--) {
        g.strokeStyle = 'rgba(156,134,220,' + (0.14 * i) + ')';
        g.lineWidth = n * 0.03;
        g.beginPath();
        g.arc(mid, mid + n * 0.1, n * 0.12 * i, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
      g.fillStyle = '#d6c9f7';
      g.beginPath();
      g.roundRect ? g.roundRect(mid - n * 0.07, mid - n * 0.26, n * 0.14, n * 0.3, n * 0.07)
                  : g.rect(mid - n * 0.07, mid - n * 0.26, n * 0.14, n * 0.3);
      g.fill();
      g.fillRect(mid - n * 0.01, mid + n * 0.04, n * 0.02, n * 0.12);
      g.fillRect(mid - n * 0.1, mid + n * 0.16, n * 0.2, n * 0.025);
    } else if (which === 'theme') {
      g.fillStyle = '#1b1540';
      g.fillRect(n * 0.14, n * 0.2, n * 0.72, n * 0.6);
      g.fillStyle = '#9c86dc';
      g.fillRect(n * 0.22, n * 0.3, n * 0.56, n * 0.07);
      g.fillStyle = 'rgba(214,201,247,0.5)';
      g.fillRect(n * 0.26, n * 0.46, n * 0.48, n * 0.08);
      g.fillRect(n * 0.26, n * 0.6, n * 0.48, n * 0.08);
    } else {
      /* skin: a little body */
      g.fillStyle = '#d6c9f7';
      g.fillRect(n * 0.38, n * 0.18, n * 0.24, n * 0.22);
      g.fillStyle = '#9c86dc';
      g.fillRect(n * 0.36, n * 0.42, n * 0.28, n * 0.26);
      g.fillRect(n * 0.28, n * 0.42, n * 0.06, n * 0.24);
      g.fillRect(n * 0.66, n * 0.42, n * 0.06, n * 0.24);
      g.fillStyle = '#6f7fdd';
      g.fillRect(n * 0.38, n * 0.7, n * 0.1, n * 0.14);
      g.fillRect(n * 0.52, n * 0.7, n * 0.1, n * 0.14);
    }
    return c;
  };
})(window.ORION_MODS);
