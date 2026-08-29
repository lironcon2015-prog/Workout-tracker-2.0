// musicxml.js — קורא MusicXML (‎.musicxml/.xml‎) וגם ‎.mxl‎ הדחוס, והופך לשיר.
import { normalizeSong } from './notation.js';

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export async function parseMusicXmlFile(file) {
  const name = file.name.replace(/\.(musicxml|xml|mxl)$/i, '');
  const text = /\.mxl$/i.test(file.name) ? await readMxl(await file.arrayBuffer()) : await file.text();
  return parseMusicXml(text, name);
}

export function parseMusicXml(text, fallbackName = 'MusicXML') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('קובץ XML לא תקין');
  const root = doc.querySelector('score-partwise');
  if (!root) throw new Error('נתמך רק MusicXML מסוג score-partwise');

  const title =
    doc.querySelector('work work-title')?.textContent?.trim() ||
    doc.querySelector('movement-title')?.textContent?.trim() || fallbackName;
  const composer =
    doc.querySelector('identification creator[type="composer"]')?.textContent?.trim() || '';

  const notes = [];
  const tempos = [];
  let beatsPerBar = 4, sawTsig = false;

  for (const part of root.querySelectorAll('part')) {
    let divisions = 1, pos = 0, lastStart = 0;
    const ties = new Map();               // "midi:hand" -> אינדקס תו פתוח (קשת המשך)
    for (const measure of part.querySelectorAll('measure')) {
      const mStart = pos;
      for (const el of measure.children) {
        switch (el.tagName) {
          case 'attributes': {
            const d = el.querySelector('divisions');
            if (d) divisions = parseInt(d.textContent, 10) || divisions;
            const ts = el.querySelector('time');
            if (ts && !sawTsig) {
              const num = +ts.querySelector('beats')?.textContent || 4;
              const den = +ts.querySelector('beat-type')?.textContent || 4;
              beatsPerBar = num * (4 / den);
              sawTsig = true;
            }
            break;
          }
          case 'direction': {
            const snd = el.querySelector('sound[tempo]');
            if (snd) tempos.push({ beat: pos / divisions, bpm: parseFloat(snd.getAttribute('tempo')) });
            break;
          }
          case 'sound':
            if (el.getAttribute('tempo')) tempos.push({ beat: pos / divisions, bpm: parseFloat(el.getAttribute('tempo')) });
            break;
          case 'backup':
            pos -= +el.querySelector('duration')?.textContent || 0;
            break;
          case 'forward':
            pos += +el.querySelector('duration')?.textContent || 0;
            break;
          case 'note': {
            if (el.querySelector('grace')) break;
            const dur = +el.querySelector('duration')?.textContent || 0;
            const isChord = !!el.querySelector('chord');
            const start = isChord ? lastStart : pos;
            lastStart = start;
            if (!isChord) pos = start + dur;
            if (el.querySelector('rest')) break;
            const p = el.querySelector('pitch');
            if (!p) break;
            const step = p.querySelector('step').textContent.trim().toUpperCase();
            const alter = +(p.querySelector('alter')?.textContent || 0);
            const oct = +p.querySelector('octave').textContent;
            const m = (oct + 1) * 12 + STEP[step] + alter;
            const staff = +(el.querySelector('staff')?.textContent || 0);
            const hand = staff === 2 ? 'L' : staff === 1 ? 'R' : m >= 60 ? 'R' : 'L';

            const tieStop = el.querySelector('tie[type="stop"], tied[type="stop"]');
            const tieStart = el.querySelector('tie[type="start"], tied[type="start"]');
            const key = m + ':' + hand;
            if (tieStop && ties.has(key)) {
              notes[ties.get(key)].d += dur / divisions;
              if (!tieStart) ties.delete(key);
            } else {
              notes.push({ t: start / divisions, d: Math.max(dur / divisions, 0.05), m, hand });
              if (tieStart) ties.set(key, notes.length - 1);
              else ties.delete(key);
            }
            break;
          }
        }
      }
      pos = Math.max(pos, mStart + measureDuration(measure, divisions, beatsPerBar));
    }
  }
  if (!notes.length) throw new Error('לא נמצאו תווים בקובץ');

  const t0 = Math.min(...notes.map((n) => n.t));
  notes.forEach((n) => (n.t -= t0));

  return normalizeSong({
    id: 'xml-' + Date.now().toString(36),
    title,
    composer: composer || 'יובא מ-MusicXML',
    bpm: tempos.length ? tempos[0].bpm : 100,
    beatsPerBar,
    tempoMap: tempos.length > 1 ? tempos.map((x) => ({ beat: Math.max(0, x.beat - t0), bpm: x.bpm })) : null,
    notes,
  });
}

function measureDuration(measure, divisions, beatsPerBar) {
  let best = 0, cur = 0;
  for (const el of measure.children) {
    if (el.tagName === 'note') {
      if (el.querySelector('grace') || el.querySelector('chord')) continue;
      cur += +el.querySelector('duration')?.textContent || 0;
    } else if (el.tagName === 'backup') {
      best = Math.max(best, cur);
      cur -= +el.querySelector('duration')?.textContent || 0;
    } else if (el.tagName === 'forward') {
      cur += +el.querySelector('duration')?.textContent || 0;
    }
  }
  return Math.max(best, cur, 0) || beatsPerBar * divisions;
}

/* ---------- פתיחת ‎.mxl‎ (ZIP) בעזרת DecompressionStream ---------- */
async function readMxl(buf) {
  if (typeof DecompressionStream === 'undefined')
    throw new Error('הדפדפן לא יודע לפתוח ‎.mxl‎ — ייצא מ-MuseScore כ-‎.musicxml‎ (לא דחוס)');
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('קובץ ‎.mxl‎ פגום');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nameLen));
    entries.push({ name, method, compSize, local });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  const pick = entries.find((e) => /\.(musicxml|xml)$/i.test(e.name) && !/^META-INF\//i.test(e.name))
    || entries.find((e) => /\.(musicxml|xml)$/i.test(e.name));
  if (!pick) throw new Error('לא נמצא MusicXML בתוך הארכיון');
  const lnLen = dv.getUint16(pick.local + 26, true);
  const lxLen = dv.getUint16(pick.local + 28, true);
  const data = new Uint8Array(buf, pick.local + 30 + lnLen + lxLen, pick.compSize);
  if (pick.method === 0) return new TextDecoder().decode(data);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}
