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

function autocorrelate(buf, sr) {
  const n = buf.length;
  let best = -1, bestCorr = 0;
  const minLag = Math.floor(sr / 1300);   // ~1300Hz
  const maxLag = Math.floor(sr / 55);     // ~55Hz
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return -1;

  let lastCorr = 1;
  for (let lag = minLag; lag < maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i += 2) corr += buf[i] * buf[i + lag];
    corr = corr / ((n - lag) / 2);
    if (corr > bestCorr) { bestCorr = corr; best = lag; }
    if (corr < lastCorr * 0.5 && bestCorr > 0 && lag > best * 1.6) break;
    lastCorr = corr;
  }
  if (best < 0 || bestCorr < rms * rms * 0.35) return -1;
  return sr / best;
}
