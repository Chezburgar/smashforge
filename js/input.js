/* SMASHFORGE — keyboard + gamepad input, per-player command structs */
(function (SB) {
  'use strict';

  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'light', 'sig', 'special', 'dodge', 'shield', 'taunt'];

  const DEFAULT_BINDS = {
    p1: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', jump: 'Space', light: 'KeyJ', sig: 'KeyK', special: 'KeyI', dodge: 'KeyL', shield: 'ShiftLeft', taunt: 'KeyT' },
    p2: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'Numpad0', light: 'Numpad1', sig: 'Numpad2', special: 'Numpad4', dodge: 'Numpad3', shield: 'NumpadDecimal', taunt: 'Numpad5' }
  };

  /* Buttons whose default browser behaviour we swallow while playing. */
  const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
    'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'NumpadDecimal']);

  const Input = {
    keys: Object.create(null),
    pressedRaw: Object.create(null),
    binds: JSON.parse(JSON.stringify(DEFAULT_BINDS)),
    capturing: false,
    active: false, /* true while a match is running — enables preventDefault */
    lastKey: null,

    init() {
      window.addEventListener('keydown', (e) => {
        Input.lastKey = e.code;
        if (!Input.keys[e.code]) Input.pressedRaw[e.code] = true;
        Input.keys[e.code] = true;
        if (Input.active && SWALLOW.has(e.code) && !Input.capturing) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
      window.addEventListener('blur', () => { Input.keys = Object.create(null); });
    },

    down(code) { return !!Input.keys[code]; },
    hit(code) { return !!Input.pressedRaw[code]; },
    endFrame() { Input.pressedRaw = Object.create(null); },

    padFor(idx) {
      if (!navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      let n = 0;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { if (n === idx) return pads[i]; n++; }
      }
      return null;
    },

    padCount() {
      if (!navigator.getGamepads) return 0;
      const pads = navigator.getGamepads();
      let n = 0;
      for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) n++;
      return n;
    }
  };
  SB.Input = Input;
  SB.ACTIONS = ACTIONS;
  SB.DEFAULT_BINDS = DEFAULT_BINDS;

  /* ---------------------------------------------------------------
     Cmd — one per fighter. Holds edge-triggered + held state so the
     fighter state machine and the AI can share the exact same API.
  ----------------------------------------------------------------*/
  function Cmd() {
    this.held = Object.create(null);
    this.prev = Object.create(null);
    this.buffer = Object.create(null); /* frames remaining on a buffered press */
    for (const a of ACTIONS) { this.held[a] = false; this.prev[a] = false; this.buffer[a] = 0; }
    this.stickX = 0;
    this.stickY = 0;
  }
  Cmd.prototype.commit = function (next) {
    for (const a of ACTIONS) {
      this.prev[a] = this.held[a];
      this.held[a] = !!next[a];
      if (this.held[a] && !this.prev[a]) this.buffer[a] = 7; /* ~7 frame input buffer */
      else if (this.buffer[a] > 0) this.buffer[a]--;
    }
    this.stickX = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    this.stickY = (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0);
  };
  Cmd.prototype.pressed = function (a) { return this.held[a] && !this.prev[a]; };
  Cmd.prototype.buffered = function (a) { return this.buffer[a] > 0; };
  Cmd.prototype.consume = function (a) { this.buffer[a] = 0; };
  Cmd.prototype.clear = function () {
    for (const a of ACTIONS) { this.prev[a] = this.held[a]; this.held[a] = false; this.buffer[a] = 0; }
    this.stickX = 0; this.stickY = 0;
  };
  SB.Cmd = Cmd;

  /* Reads a human player (keyboard slot + optional gamepad) into a Cmd. */
  SB.readHuman = function (cmd, slot, padIndex) {
    const b = Input.binds[slot] || DEFAULT_BINDS.p1;
    const s = Object.create(null);
    for (const a of ACTIONS) s[a] = Input.down(b[a]);

    const pad = padIndex === undefined || padIndex === null ? null : Input.padFor(padIndex);
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const DZ = 0.4;
      if (ax < -DZ || btn(14)) s.left = true;
      if (ax > DZ || btn(15)) s.right = true;
      if (ay < -DZ || btn(12)) s.up = true;
      if (ay > DZ || btn(13)) s.down = true;
      if (btn(0)) s.jump = true;          /* A */
      if (btn(2)) s.light = true;         /* X */
      if (btn(3)) s.sig = true;           /* Y */
      if (btn(1)) s.special = true;       /* B */
      if (btn(5) || btn(7)) s.dodge = true; /* RB / RT */
      if (btn(4) || btn(6)) s.shield = true; /* LB / LT */
      if (btn(9)) s.taunt = true;
    }
    cmd.commit(s);
  };
})(window.SB);
