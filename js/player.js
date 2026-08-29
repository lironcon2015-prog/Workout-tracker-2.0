// player.js — טרנספורט: מיקום בזמן, השמעה, מצב "המתן לי", לולאה ומטרונום
export class Player {
  constructor(synth) {
    this.synth = synth;
    this.song = null;
    this.playing = false;
    this.speed = 1;
    this.hands = 'both';
    this.mode = 'follow';        // follow | wait
    this.sound = true;
    this.metronome = false;
    this.forgiveOctave = false;
    this.countIn = true;
    this.loop = null;            // {a,b} בביטים
    this.beat = 0;
    this.posSec = 0;
    this.waiting = false;
    this.waitSet = new Set();
    this.onEnd = null;
    this._lastWall = 0;
    this._nextIdx = 0;
    this._lastClick = -1;
    this._waitPassed = -Infinity;   // הביט של האקורד האחרון שהנגן כבר ניגן
  }

  load(song) {
    this.song = song;
    this.segs = buildTempo(song);
    this.groups = null;
    this.loop = null;
    this.stop();
  }

  beatToSec(b) {
    const s = this.segs;
    let i = 0;
    while (i + 1 < s.length && s[i + 1].beat <= b) i++;
    return s[i].sec + (b - s[i].beat) * s[i].spb;
  }
  secToBeat(sec) {
    const s = this.segs;
    let i = 0;
    while (i + 1 < s.length && s[i + 1].sec <= sec) i++;
    return s[i].beat + (sec - s[i].sec) / s[i].spb;
  }

  activeNotes() {
    if (!this.song) return [];
    const n = this.song.notes, out = [];
    let hi = n.length - 1, lo = 0, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (n[mid].t <= this.beat) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    for (let i = idx; i >= 0 && i > idx - 400; i--) {
      const x = n[i];
      if (x.t + x.d > this.beat && (this.hands === 'both' || x.hand === this.hands)) out.push(x);
    }
    return out;
  }

  filtered() {
    return this.song.notes.filter((n) => this.hands === 'both' || n.hand === this.hands);
  }

  buildGroups() {
    const out = [];
    for (const n of this.filtered()) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.t - n.t) < 0.04) last.notes.push(n);
      else out.push({ t: n.t, notes: [n] });
    }
    this.groups = out;
  }

  play() {
    if (!this.song) return;
    this.synth.init(); this.synth.resume();
    if (this.beat >= this.song.lengthBeats) this.seek(0);
    if (this.countIn && this.beat <= 0) this.beat = -(this.song.beatsPerBar || 4);
    this.posSec = this.beatToSec(this.beat);
    this._lastWall = performance.now() / 1000;
    this._syncIndex();
    this.playing = true;
  }
  pause() { this.playing = false; this.waiting = false; this.waitSet.clear(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  stop() { this.playing = false; this.seek(0); }
  seek(beat) {
    this.beat = Math.max(-(this.song?.beatsPerBar || 4), Math.min(beat, this.song ? this.song.lengthBeats : 0));
    this.posSec = this.beatToSec(this.beat);
    this._syncIndex();
    this.waiting = false; this.waitSet.clear();
    this._waitPassed = -Infinity;
    this._lastClick = Math.floor(this.beat) - 1;
  }
  _syncIndex() {
    const n = this.song.notes;
    let i = 0;
    while (i < n.length && n[i].t < this.beat - 1e-6) i++;
    this._nextIdx = i;
    this.groups = null;
  }

  setHands(h) { this.hands = h; this.groups = null; }
  setSpeed(s) { this.speed = s; }
  setMode(m) { this.mode = m; this.waiting = false; this.waitSet.clear(); this.groups = null; this._waitPassed = -Infinity; }

  // נקרא כל פריים
  tick() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - this._lastWall, 0.25);
    this._lastWall = now;
    if (!this.playing || !this.song) return;

    if (this.mode === 'wait' && !this.waiting) {
      if (!this.groups) this.buildGroups();
      const cut = Math.max(this.beat - 1e-6, this._waitPassed);
      const g = this.groups.find((x) => x.t > cut);
      const nextBeat = this.secToBeat(this.posSec + dt * this.speed);
      if (g && nextBeat >= g.t) {
        // עוצרים בדיוק על האקורד הבא ומחכים לנגן
        this.beat = g.t;
        this.posSec = this.beatToSec(this.beat);
        this.waiting = true;
        this.waitSet = new Set(g.notes.map((n) => n.m));
        this._fireUpTo(this.beat - 1e-6);
        return;
      }
    }
    if (this.waiting) return;

    this.posSec += dt * this.speed;
    const b = this.secToBeat(this.posSec);
    this._fireUpTo(b);
    this.beat = b;

    if (this.metronome) {
      const k = Math.floor(this.beat);
      if (k !== this._lastClick && this.beat >= -(this.song.beatsPerBar || 4)) {
        this._lastClick = k;
        const bpb = this.song.beatsPerBar || 4;
        this.synth.click(0, ((k % bpb) + bpb) % bpb === 0);
      }
    }

    if (this.loop && this.beat >= this.loop.b) { this.seek(this.loop.a); return; }
    if (this.beat >= this.song.lengthBeats + 1) {
      if (this.loop) this.seek(this.loop.a);
      else { this.playing = false; this.beat = this.song.lengthBeats; this.onEnd && this.onEnd(); }
    }
  }

  _fireUpTo(b) {
    const n = this.song.notes;
    while (this._nextIdx < n.length && n[this._nextIdx].t <= b) {
      const x = n[this._nextIdx++];
      if (x.t < this.beat - 0.5) continue;
      if (this.hands !== 'both' && x.hand !== this.hands) continue;
      if (this.sound) {
        const dur = (this.beatToSec(x.t + x.d) - this.beatToSec(x.t)) / this.speed;
        this.synth.play(x.m, 0, dur, x.vel ? x.vel / 127 : 0.8);
      }
    }
  }

  // קלט מהנגן (MIDI / מגע / מיקרופון)
  userNote(m) {
    if (!this.waiting) return false;
    let hit = false;
    for (const w of [...this.waitSet]) {
      if (w === m || (this.forgiveOctave && Math.abs(w - m) % 12 === 0)) { this.waitSet.delete(w); hit = true; break; }
    }
    if (this.waitSet.size === 0) {
      this.waiting = false;
      this._waitPassed = this.beat;
      this._lastWall = performance.now() / 1000;
      this._fireUpTo(this.beat + 1e-6);
    }
    return hit;
  }
}

function buildTempo(song) {
  let map = (song.tempoMap && song.tempoMap.length ? song.tempoMap.slice() : [{ beat: 0, bpm: song.bpm }])
    .sort((a, b) => a.beat - b.beat);
  if (map[0].beat > 0) map.unshift({ beat: 0, bpm: song.bpm });
  const segs = [];
  let sec = 0;
  for (let i = 0; i < map.length; i++) {
    const spb = 60 / Math.max(10, map[i].bpm);
    segs.push({ beat: map[i].beat, sec, spb });
    if (i + 1 < map.length) sec += (map[i + 1].beat - map[i].beat) * spb;
  }
  return segs;
}
