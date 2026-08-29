// audio.js — סינתיסייזר פסנתר פשוט מבוסס Web Audio
export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = new Map();
    this.volume = 0.6;
  }
  init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(this.ctx.destination);
    return this.ctx;
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // הפעלת תו. at = זמן AudioContext, dur בשניות
  play(m, at = 0, dur = 0.6, vel = 0.8) {
    const ctx = this.init();
    const t = Math.max(at || ctx.currentTime, ctx.currentTime);
    const f = this.freq(m);
    const g = ctx.createGain();
    const bright = Math.max(0.15, 1 - (m - 21) / 100);
    const peak = 0.22 * vel * bright;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(peak * 0.28, t + 0.35);
    const end = t + Math.max(dur, 0.18) + 0.5;
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(this.master);

    const partials = [[1, 1], [2, 0.32], [3, 0.14], [4, 0.06]];
    for (const [mult, amp] of partials) {
      if (f * mult > 15000) continue;
      const o = ctx.createOscillator();
      o.type = mult === 1 ? 'triangle' : 'sine';
      o.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(end + 0.05);
    }
    return end;
  }
  click(at, accent) {
    const ctx = this.init();
    const t = Math.max(at || ctx.currentTime, ctx.currentTime);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.08, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.08);
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
}
