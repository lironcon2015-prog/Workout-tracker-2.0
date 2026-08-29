// input.js — קלט מהנגן: פסנתר חשמלי (Web MIDI) או מיקרופון (זיהוי גובה צליל, מונופוני)

export class MidiInput {
  constructor(onNote) { this.onNote = onNote; this.access = null; this.names = []; }
  supported() { return !!navigator.requestMIDIAccess; }
  async start() {
    if (!this.supported()) throw new Error('הדפדפן לא תומך ב-Web MIDI (בספארי/אייפון אין תמיכה)');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    const bind = () => {
      this.names = [];
      for (const inp of this.access.inputs.values()) {
        this.names.push(inp.name);
        inp.onmidimessage = (e) => {
          const [st, d1, d2] = e.data;
          if ((st & 0xf0) === 0x90 && d2 > 0) this.onNote(d1, d2 / 127);
        };
      }
    };
    bind();
    this.access.onstatechange = bind;
    return this.names;
  }
  stop() {
    if (!this.access) return;
    for (const inp of this.access.inputs.values()) inp.onmidimessage = null;
    this.access = null;
  }
}

// זיהוי גובה צליל מהמיקרופון (אוטוקורלציה) — לפסנתר אקוסטי. מזהה תו בודד בכל רגע.
export class MicInput {
  constructor(onNote) {
    this.onNote = onNote;
    this.running = false;
    this.last = { m: -1, at: 0 };
    this.level = 0;
    this.detected = null;
  }
  async start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = this.ctx.createMediaStreamSource(this.stream);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 55;
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 4096;
    src.connect(hp).connect(this.an);
    this.buf = new Float32Array(this.an.fftSize);
    this.running = true;
    this.loop();
  }
  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close();
    this.ctx = null; this.detected = null;
  }
  loop() {
    if (!this.running) return;
    const now = performance.now();
    if (now - (this._last || 0) < 45) return requestAnimationFrame(() => this.loop());
    this._last = now;
    this.an.getFloatTimeDomainData(this.buf);
    const rms = Math.sqrt(this.buf.reduce((s, v) => s + v * v, 0) / this.buf.length);
    this.level = rms;
    if (rms > 0.012) {
      const f = autocorrelate(this.buf, this.ctx.sampleRate);
      if (f > 0) {
        const m = Math.round(69 + 12 * Math.log2(f / 440));
        const now = performance.now();
        this.detected = m;
        if (m >= 21 && m <= 108 && (m !== this.last.m || now - this.last.at > 260)) {
          this.last = { m, at: now };
          this.onNote(m, Math.min(1, rms * 8));
        }
      }
    } else if (this.level < 0.006) {
      this.detected = null;
      this.last = { m: -1, at: 0 };
    }
    requestAnimationFrame(() => this.loop());
  }
}

export function autocorrelate(buf, sr) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return -1;

  const minLag = Math.max(2, Math.floor(sr / 2200));            // עד ~C7
  const maxLag = Math.min(Math.floor(sr / 50), n - 8);          // ~G1 ומטה
  const W = Math.min(1024, n - maxLag);                         // חלון קבוע — עלות חישוב יציבה
  if (W < 256 || maxLag <= minLag) return -1;

  // אוטוקורלציה מנורמלת. הנרמול הוא מה שמונע הטיה לכיוון לג קצר,
  // שגרמה לתווים נמוכים להיקרא כהרמוניה גבוהה.
  const r = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < W; i += 2) {
      const a = buf[i], b = buf[i + lag];
      sum += a * b; e1 += a * a; e2 += b * b;
    }
    r[lag] = sum / (Math.sqrt(e1 * e2) + 1e-12);
  }

  // אוספים את כל השיאים המקומיים, ובוחרים את **הראשון** שקרוב לשיא הגבוה ביותר.
  // זה הכלל של McLeod: השיא הגבוה ביותר עלול לשבת על כפולה של המחזור (אוקטבה
  // נמוכה מדי), והשיא הכי גבוה בלג קצר עלול להיות הרמוניה (אוקטבה גבוהה מדי).
  // הראשון שמגיע קרוב למקסימום הוא המחזור היסודי.
  const peaks = [];
  let maxVal = 0;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1]) {
      peaks.push(lag);
      if (r[lag] > maxVal) maxVal = r[lag];
    }
  }
  if (!peaks.length || maxVal < 0.45) return -1;
  let bestLag = peaks[peaks.length - 1];
  for (const lag of peaks) {
    if (r[lag] >= maxVal * 0.9) { bestLag = lag; break; }
  }

  // אינטרפולציה פרבולית סביב השיא — דיוק תת-דגימה
  const y1 = r[bestLag - 1], y2 = r[bestLag], y3 = r[bestLag + 1];
  const d = 2 * (2 * y2 - y1 - y3);
  const shift = d ? (y3 - y1) / d : 0;
  return sr / (bestLag + Math.max(-1, Math.min(1, shift)));
}
