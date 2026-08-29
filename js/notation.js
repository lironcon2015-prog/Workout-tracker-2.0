// notation.js — קידוד קומפקטי של תווים -> אובייקטי תו
// טוקן: "C4", "C#4", "Bb3", אקורד "C4+E4+G4", הפסקה "r"
// משך:  ":2" (ביטים, ברירת מחדל 1)  |  אצבע: "C4@1"
// קבוצות חזרה: "( C4 E4 )*4"   |  "|" מתעלמים ממנו (סימון תיבה)

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name) {
  const m = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error('תו לא תקין: ' + name);
  let acc = 0;
  for (const c of m[2]) acc += c === '#' ? 1 : -1;
  return (parseInt(m[3], 10) + 1) * 12 + STEP[m[1].toUpperCase()] + acc;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE = ['דו', 'דו#', 'רה', 'רה#', 'מי', 'פה', 'פה#', 'סול', 'סול#', 'לה', 'לה#', 'סי'];

export const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
export const noteName = (m) => SHARP_NAMES[((m % 12) + 12) % 12];
export const solfegeName = (m) => SOLFEGE[((m % 12) + 12) % 12];
export const octaveOf = (m) => Math.floor(m / 12) - 1;
export const fullName = (m) => noteName(m) + octaveOf(m);

function tokenize(src) {
  return src.replace(/\|/g, ' ').replace(/([()])/g, ' $1 ').trim().split(/\s+/).filter(Boolean);
}

// מפרק רצף אחד ליד אחת. מחזיר מערך תווים {t,d,m,hand,finger} ביחידות ביטים.
export function parseSeq(src, { hand = 'R', defaultDur = 1, start = 0 } = {}) {
  const toks = tokenize(src);
  const out = [];
  let t = start;

  function block(i, endAt) {
    while (i < toks.length) {
      const tok = toks[i];
      if (tok === ')') return i;
      if (tok === '(') {
        const startT = t, mark = out.length;
        const close = block(i + 1, true);
        const rep = /^\*(\d+)$/.exec(toks[close + 1] || '');
        i = close + 1;
        if (rep) {
          const times = parseInt(rep[1], 10);
          const span = t - startT;
          const chunk = out.slice(mark);
          for (let k = 1; k < times; k++) {
            for (const n of chunk) out.push({ ...n, t: n.t + span * k });
          }
          t = startT + span * times;
          i++;
        }
        continue;
      }
      // טוקן רגיל
      let body = tok, dur = defaultDur;
      const colon = tok.lastIndexOf(':');
      if (colon > 0) { body = tok.slice(0, colon); dur = parseFloat(tok.slice(colon + 1)); }
      if (body === 'r' || body === 'R') { t += dur; i++; continue; }
      for (const part of body.split('+')) {
        const [pitch, fing] = part.split('@');
        out.push({ t, d: dur, m: noteToMidi(pitch), hand, finger: fing ? +fing : undefined });
      }
      t += dur;
      i++;
    }
    return i;
  }
  block(0, false);
  out.sort((a, b) => a.t - b.t || a.m - b.m);
  return out;
}

// בונה שיר משתי ידיים
export function buildSong(meta, rightSrc, leftSrc) {
  const notes = [
    ...(rightSrc ? parseSeq(rightSrc, { hand: 'R' }) : []),
    ...(leftSrc ? parseSeq(leftSrc, { hand: 'L' }) : []),
  ].sort((a, b) => a.t - b.t || a.m - b.m);
  return normalizeSong({ ...meta, notes });
}

export function normalizeSong(song) {
  const notes = song.notes.slice().sort((a, b) => a.t - b.t || a.m - b.m);
  const lengthBeats = notes.reduce((mx, n) => Math.max(mx, n.t + n.d), 0);
  const lo = notes.reduce((mn, n) => Math.min(mn, n.m), 127);
  const hi = notes.reduce((mx, n) => Math.max(mx, n.m), 0);
  return {
    id: song.id || 'song-' + Math.random().toString(36).slice(2, 9),
    title: song.title || 'ללא שם',
    composer: song.composer || '',
    level: song.level || '',
    bpm: song.bpm || 100,
    beatsPerBar: song.beatsPerBar || 4,
    tempoMap: song.tempoMap || null, // [{beat, bpm}] — לקבצי MIDI עם שינויי טמפו
    note: song.note || '',
    notes,
    lengthBeats,
    range: [lo, hi],
  };
}
