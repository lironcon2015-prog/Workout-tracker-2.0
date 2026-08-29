// midi.js — קורא קבצי MIDI סטנדרטיים (SMF פורמט 0/1) והופך אותם לשיר.
import { normalizeSong } from './notation.js';

class Reader {
  constructor(buf) { this.v = new DataView(buf); this.p = 0; }
  u8() { return this.v.getUint8(this.p++); }
  u16() { const x = this.v.getUint16(this.p); this.p += 2; return x; }
  u32() { const x = this.v.getUint32(this.p); this.p += 4; return x; }
  str(n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8()); return s; }
  vlq() { let x = 0, b; do { b = this.u8(); x = (x << 7) | (b & 0x7f); } while (b & 0x80); return x; }
}

export function parseMidi(arrayBuffer, fallbackName = 'קובץ MIDI') {
  const r = new Reader(arrayBuffer);
  if (r.str(4) !== 'MThd') throw new Error('זה לא קובץ MIDI תקין');
  r.u32();
  r.u16();                       // format
  const nTracks = r.u16();
  const division = r.u16();
  if (division & 0x8000) throw new Error('MIDI מבוסס SMPTE אינו נתמך');
  const ppq = division;

  const events = [];             // {tick, type, ...}
  let title = '';

  for (let ti = 0; ti < nTracks; ti++) {
    if (r.p >= r.v.byteLength) break;
    const id = r.str(4);
    const len = r.u32();
    const end = r.p + len;
    if (id !== 'MTrk') { r.p = end; continue; }
    let tick = 0, running = 0;
    while (r.p < end) {
      tick += r.vlq();
      let status = r.u8();
      if (status < 0x80) { r.p--; status = running; } else if (status < 0xf0) running = status;

      if (status === 0xff) {
        const type = r.u8(), len2 = r.vlq(), at = r.p;
        if (type === 0x51) {
          const us = (r.v.getUint8(at) << 16) | (r.v.getUint8(at + 1) << 8) | r.v.getUint8(at + 2);
          events.push({ tick, type: 'tempo', bpm: 60000000 / us });
        } else if (type === 0x58) {
          events.push({ tick, type: 'tsig', num: r.v.getUint8(at), den: Math.pow(2, r.v.getUint8(at + 1)) });
        } else if ((type === 0x03 || type === 0x01) && !title && ti <= 1) {
          let s = ''; for (let i = 0; i < len2; i++) s += String.fromCharCode(r.v.getUint8(at + i));
          title = s.trim();
        }
        r.p = at + len2;
      } else if (status === 0xf0 || status === 0xf7) {
        r.p += r.vlq();
      } else {
        const cmd = status & 0xf0, ch = status & 0x0f;
        const d1 = r.u8();
        const d2 = cmd === 0xc0 || cmd === 0xd0 ? 0 : r.u8();
        if (cmd === 0x90 && d2 > 0) events.push({ tick, type: 'on', m: d1, vel: d2, ch, track: ti });
        else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) events.push({ tick, type: 'off', m: d1, ch, track: ti });
      }
    }
    r.p = end;
  }

  events.sort((a, b) => a.tick - b.tick);

  // הרכבת תווים
  const open = new Map();
  const raw = [];
  for (const e of events) {
    if (e.type === 'on') {
      const k = e.ch + ':' + e.m;
      if (open.has(k)) closeNote(k, e.tick);
      open.set(k, e);
    } else if (e.type === 'off') {
      closeNote(e.ch + ':' + e.m, e.tick);
    }
  }
  function closeNote(k, tick) {
    const s = open.get(k);
    if (!s) return;
    open.delete(k);
    const d = Math.max(tick - s.tick, ppq / 16);
    raw.push({ t: s.tick / ppq, d: d / ppq, m: s.m, track: s.track, ch: s.ch, vel: s.vel });
  }
  for (const [k, s] of open) closeNote(k, s.tick + ppq);
  if (!raw.length) throw new Error('לא נמצאו תווים בקובץ');

  // התאמת ידיים: אם יש שני ערוצים/רצועות מובהקים — לפי הגובה הממוצע שלהם. אחרת פיצול לפי גובה.
  const groups = new Map();
  for (const n of raw) {
    const k = n.track + '/' + n.ch;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  const big = [...groups.entries()].filter(([, v]) => v.length >= raw.length * 0.12);
  if (big.length === 2) {
    const avg = (v) => v.reduce((s, n) => s + n.m, 0) / v.length;
    const [a, b] = big.sort((x, y) => avg(y[1]) - avg(x[1]));
    a[1].forEach((n) => (n.hand = 'R'));
    b[1].forEach((n) => (n.hand = 'L'));
    for (const [k, v] of groups) if (k !== a[0] && k !== b[0]) v.forEach((n) => (n.hand = n.m >= 60 ? 'R' : 'L'));
  } else {
    raw.forEach((n) => (n.hand = n.m >= 60 ? 'R' : 'L'));
  }

  // הזזה לתחילת הקטע
  const t0 = Math.min(...raw.map((n) => n.t));
  raw.forEach((n) => (n.t -= t0));

  const tempos = events.filter((e) => e.type === 'tempo').map((e) => ({ beat: Math.max(0, e.tick / ppq - t0), bpm: e.bpm }));
  const tsig = events.find((e) => e.type === 'tsig');

  return normalizeSong({
    id: 'midi-' + Date.now().toString(36),
    title: title || fallbackName,
    composer: 'יובא מ-MIDI',
    bpm: tempos.length ? tempos[0].bpm : 120,
    beatsPerBar: tsig ? tsig.num * (4 / tsig.den) : 4,
    tempoMap: tempos.length > 1 ? tempos : null,
    notes: raw.map(({ t, d, m, hand, vel }) => ({ t, d, m, hand, vel })),
  });
}
