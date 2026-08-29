import { Synth } from './audio.js';
import { Player } from './player.js';
import { Renderer, keyAt } from './render.js';
import { LIBRARY } from './songs.js';
import { parseMidi } from './midi.js';
import { parseMusicXmlFile } from './musicxml.js';
import { buildSong } from './notation.js';
import { normalizeSong, fullName, solfegeName, octaveOf, isBlack } from './notation.js';
import { MidiInput, MicInput } from './input.js';
import * as store from './store.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#stage');
const synth = new Synth();
const player = new Player(synth);
const renderer = new Renderer(canvas);

const DEFAULTS = {
  speed: 100, bpm: null, hands: 'both', mode: 'follow', labels: 'c',
  aheadSec: 3, vol: 60, metro: false, countIn: true, sound: true,
  inputSrc: 'touch', octForgive: false, songId: 'moonlight', range: null, follow: 'auto',
};
const cfg = Object.assign({}, DEFAULTS, store.loadSettings());
const save = () => store.saveSettings(cfg);

let imported = store.loadSongs().map(normalizeSong);
let seenHint = false;
let song = null;
let range = { lo: 48, hi: 83 };
let winSemis = 36;              // גודל החלון ליצירה הנוכחית
let shift = null;               // אנימציית הזזה {octaves, t0}
let lastShiftAt = 0;
const userKeys = new Map();          // midi -> timestamp
let midiIn = null, micIn = null;

/* ---------- ספריית יצירות ---------- */
function allSongs() { return [...LIBRARY, ...imported]; }

function renderList() {
  const el = $('#songList');
  el.innerHTML = '';
  for (const s of allSongs()) {
    const isImported = imported.includes(s);
    const d = document.createElement('div');
    d.className = 'song' + (song && s.id === song.id ? ' cur' : '');
    d.innerHTML = `<div class="nm"><div class="t"></div><div class="c"></div></div>
      ${s.level ? `<span class="lvl">${s.level}</span>` : ''}
      ${isImported ? '<span class="del">🗑</span>' : ''}`;
    d.querySelector('.t').textContent = s.title;
    d.querySelector('.c').textContent = [s.composer, s.note].filter(Boolean).join(' · ');
    d.onclick = (e) => {
      if (e.target.classList.contains('del')) {
        imported = imported.filter((x) => x.id !== s.id);
        store.saveSongs(imported);
        renderList();
        return;
      }
      loadSong(s);
      closePanel();
    };
    el.appendChild(d);
  }
}

/* ---------- חלון הקלידים המוצג ----------
   הרעיון: גודל החלון נקבע פעם אחת ליצירה ולא משתנה — רוחב הקליד יציב.
   מה שזז זה המיקום, ותמיד ב**אוקטבות שלמות**: תמונת המקלדת נשארת זהה
   (אותן קבוצות של 2 ו-3 שחורים), רק תוויות ה-C מתחלפות. זו הזזה שהעין
   כמעט לא מרגישה, בניגוד להזזה בכמות שרירותית של קלידים. */
const MIN_SEMIS = 24, MAX_SEMIS = 60;      // 2 עד 5 אוקטבות
const alignUp = (n) => Math.ceil(n / 12) * 12;
const clampSemis = (n) => Math.max(MIN_SEMIS, Math.min(MAX_SEMIS, n));

// חלון הפתיחה. אם כל היצירה נכנסת — חלון צמוד שלעולם לא זז (יציבות > צפיפות).
// רק כשהיא רחבה מדי נכנס חלון בגודל קבוע שיזוז באוקטבות שלמות.
function initialWindow(s) {
  let lo = s.range[0], hi = s.range[1];
  if (cfg.follow === 'all' || hi - lo <= MAX_SEMIS) {
    if (isBlack(lo)) lo--;
    if (isBlack(hi)) hi++;
    while (hi - lo < MIN_SEMIS) { if (hi < 108) hi++; else if (lo > 21) lo--; else break; }
    return { lo: Math.max(21, lo), hi: Math.min(108, hi) };
  }
  const p = s.notes.map((n) => n.m).sort((a, b) => a - b);
  const pl = p[Math.floor(p.length * 0.02)];
  const ph = p[Math.ceil(p.length * 0.98) - 1];
  const semis = clampSemis(alignUp(ph - pl + 2));
  const start = Math.max(21, Math.min(pl - 1, 108 - semis));
  return { lo: start, hi: start + semis };
}

// לאן החלון צריך לזוז כדי לכסות את מה שמגיע.
// בוחרים את ההיסט (באוקטבות שלמות — כך תמונת המקלדת נשארת זהה) שמכסה הכי
// הרבה תווים, ונשארים במקום כשההפרש זניח, כדי שלא ירדוף אחרי תו חריג בודד.
function targetWindow(fromBeat, toBeat, curLo, semis) {
  const ms = [];
  for (const n of song.notes) {
    if (n.t > toBeat) break;
    if (n.t + n.d < fromBeat) continue;
    if (cfg.hands !== 'both' && n.hand !== cfg.hands) continue;
    ms.push(n.m);
  }
  if (!ms.length) return curLo;

  const covers = (lo) => ms.reduce((c, m) => c + (m >= lo && m <= lo + semis ? 1 : 0), 0);
  const here = covers(curLo);
  if (here === ms.length) return curLo;

  let best = curLo, bestScore = here;
  for (let k = -4; k <= 4; k++) {
    if (!k) continue;
    const lo = Math.max(21, Math.min(curLo + k * 12, 108 - semis));
    if (lo === curLo) continue;
    const sc = covers(lo);
    if (sc > bestScore + 1 || (sc === bestScore && Math.abs(k) < Math.abs((best - curLo) / 12))) {
      best = lo; bestScore = sc;
    }
  }
  return best;
}

function loadSong(s) {
  song = s;
  cfg.songId = s.id; save();
  player.load(s);
  applyCfg();
  range = cfg.range && cfg.range.songId === s.id
    ? { lo: cfg.range.lo, hi: cfg.range.hi }
    : initialWindow(s);
  winSemis = range.hi - range.lo;
  shift = null; lastShiftAt = 0;
  setFollowHint();
  $('#titleMain').textContent = s.title;
  $('#titleSub').textContent = [s.composer, s.note].filter(Boolean).join(' · ');
  $('#rngBpm').value = Math.round(s.bpm);
  $('#outBpm').textContent = Math.round(s.bpm);
  setLoopUI();
  renderList();
  toast('נטען: ' + s.title);
}

/* ---------- הגדרות ---------- */
function applyCfg() {
  player.speed = cfg.speed / 100;
  player.hands = cfg.hands;
  player.mode = cfg.mode;
  player.metronome = cfg.metro;
  player.countIn = cfg.countIn;
  player.sound = cfg.sound;
  player.forgiveOctave = cfg.octForgive || cfg.inputSrc === 'mic';
  synth.setVolume(cfg.vol / 100);
  chip('#btnHands', { both: '2 ידיים', R: 'יד ימין', L: 'יד שמאל' }[cfg.hands], cfg.hands !== 'both');
  chip('#btnMode', cfg.mode === 'wait' ? 'המתן לי' : 'עוקב', cfg.mode === 'wait');
  chip('#btnSpeed', cfg.speed + '%', cfg.speed !== 100);
  $('#chkSound').checked = cfg.sound;
  $('#rngSpeed').value = cfg.speed; $('#outSpeed').textContent = cfg.speed + '%';
  $('#rngAhead').value = cfg.aheadSec; $('#outAhead').textContent = cfg.aheadSec.toFixed(1) + ' שניות';
  $('#rngVol').value = cfg.vol; $('#outVol').textContent = cfg.vol + '%';
  $('#chkMetro').checked = cfg.metro;
  $('#chkCount').checked = cfg.countIn;
  $('#chkOct').checked = cfg.octForgive;
  segSet('#segLabels', cfg.labels);
  segSet('#segInput', cfg.inputSrc);
  segSet('#segFollow', cfg.follow);
}
function chip(sel, text, active) {
  const el = $(sel);
  el.firstChild.nodeValue = text;          // משאיר את חץ ה-▾ במקומו
  el.classList.toggle('act', active);
}
const segSet = (sel, v) => document.querySelectorAll(sel + ' button')
  .forEach((b) => b.classList.toggle('on', b.dataset.v === v));

/* ---------- לולאה ראשית ---------- */
function frame() {
  player.tick();
  const now = performance.now();
  for (const [m, t] of userKeys) if (now - t > 280) userKeys.delete(m);

  const active = new Map();
  if (song) for (const n of player.activeNotes()) active.set(n.m, n.hand);
  for (const m of userKeys.keys()) active.set(m, 'U');   // ירוק = הטלפון קלט אותך

  // המרחק קדימה נמדד בשניות כדי שמהירות הגלילה תהיה זהה בכל טמפו
  let aheadBeats = 4;
  if (song) {
    const b = Math.max(0, player.beat);
    aheadBeats = Math.max(0.5, player.secToBeat(player.beatToSec(b) + cfg.aheadSec) - b);
  }
  const bpb = song ? song.beatsPerBar || 4 : 4;

  // מעקב: החלון זז לפני שהתווים מגיעים, ותמיד באוקטבות שלמות
  if (song && cfg.follow !== 'fixed' && !shift && now - lastShiftAt > 900) {
    const tgt = targetWindow(player.beat - 0.25, player.beat + aheadBeats + 0.75, range.lo, winSemis);
    if (tgt !== range.lo) {
      shift = { octaves: (tgt - range.lo) / 12, t0: now };
      range = { lo: tgt, hi: tgt + winSemis };
      lastShiftAt = now;
    }
  }
  let shiftPx = 0;
  if (shift) {
    const t = Math.min(1, (now - shift.t0) / 260);
    const wW = renderer.layout ? renderer.layout.whiteW : 0;
    shiftPx = shift.octaves * 7 * wW * Math.pow(1 - t, 3);
    if (t >= 1) shift = null;
  }
  const needsMap = song && song.range[1] - song.range[0] > winSemis;

  renderer.draw({
    lo: range.lo, hi: range.hi,
    beat: player.beat,
    notes: song ? song.notes : [],
    lookaheadBeats: aheadBeats,
    barText: song ? `תיבה ${Math.max(1, Math.floor(player.beat / bpb) + 1)} / ${Math.ceil(song.lengthBeats / bpb)}` : '',
    beatsPerBar: song ? song.beatsPerBar : 4,
    shiftPx,
    map: needsMap ? { lo: song.range[0], hi: song.range[1] } : null,
    hands: cfg.hands,
    labels: cfg.labels,
    activeKeys: active,
    waiting: player.waiting,
    waitSet: player.waiting ? player.waitSet : null,
  });

  updateHud();
  updateMicMeter(now);
  syncChrome();
  requestAnimationFrame(frame);
}

function updateHud() {
  const hud = $('#hud');
  if (!song) { hud.textContent = 'פתח את התפריט ☰ ובחר יצירה'; return; }
  hud.className = '';
  if (player.waiting) {
    const names = [...player.waitSet].sort((a, b) => a - b)
      .map((m) => (cfg.labels === 'solfege' ? solfegeName(m) + octaveOf(m) : fullName(m))).join(' + ');
    hud.innerHTML = `<b>נגן: ${names}</b>`;
  } else if (player.playing && player.beat < 0) {
    hud.textContent = 'ספירה… ' + (Math.floor(player.beat + (song.beatsPerBar || 4)) + 1);
  } else if (!player.playing) {
    hud.className = 'legend';
    hud.innerHTML = '<span style="color:#ffb340">■</span> ימין &nbsp; <span style="color:#3fb9ff">■</span> שמאל'
      + (seenHint ? '' : ' &nbsp;·&nbsp; נגיעה במסך = נגן/עצור');
  } else hud.textContent = '';

  const p = Math.max(0, Math.min(1, player.beat / (song.lengthBeats || 1)));
  $('#seekfill').style.width = (p * 100) + '%';
  $('#btnPlay').textContent = player.playing ? '⏸' : '▶';
}

let lastMic = 0;
function updateMicMeter(now) {
  if (now - lastMic < 90) return;
  lastMic = now;
  const box = $('#micMeter');
  if (!micIn || !micIn.running) { if (!box.hidden) box.hidden = true; return; }
  box.hidden = false;
  $('#micLevel').style.width = Math.min(100, micIn.level * 900) + '%';
  $('#micNote').textContent = micIn.detected == null ? '—' : fullName(micIn.detected);
}

let lastKbH = -1;
function syncChrome() {
  document.body.classList.toggle('playing', player.playing);
  const kbH = renderer.kbH || 0;
  if (kbH !== lastKbH) {
    lastKbH = kbH;
    $('#seekbar').style.bottom = (kbH + 3) + 'px';
    $('#hud').style.bottom = (kbH + 30) + 'px';
    $('#toast').style.bottom = (kbH + 44) + 'px';
  }
}

/* ---------- קלט מגע על הקלידים ---------- */
function pointToKey(ev) {
  const r = canvas.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  if (!renderer.layout || y < renderer.kbTop) return null;
  return keyAt(renderer.layout, x, y, renderer.kbTop, renderer.kbH);
}
canvas.addEventListener('pointerdown', (e) => {
  synth.init(); synth.resume();
  const m = pointToKey(e);
  if (m == null) {
    // נגיעה במסלול התווים = נגן/עצור (נוח כשהטלפון עומד על מעמד התווים)
    const y = e.clientY - canvas.getBoundingClientRect().top;
    if (song && y > 52) {
      seenHint = true;
      player.toggle();
      if (player.playing) requestWakeLock();
    }
    return;
  }
  e.preventDefault();
  hitNote(m, true);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function hitNote(m, audible) {
  userKeys.set(m, performance.now());
  if (audible) synth.play(m, 0, 0.5, 0.8);
  player.userNote(m);
}

/* ---------- קלט חיצוני ---------- */
async function setInputSource(v) {
  if (midiIn) { midiIn.stop(); midiIn = null; }
  if (micIn) { micIn.stop(); micIn = null; }
  cfg.inputSrc = v; save(); applyCfg(); segSet('#segInput', v);
  const hint = $('#inputHint');
  try {
    if (v === 'midi') {
      midiIn = new MidiInput((m) => hitNote(m, false));
      const names = await midiIn.start();
      hint.textContent = names.length ? 'מחובר: ' + names.join(', ') : 'לא נמצא כלי MIDI מחובר.';
    } else if (v === 'mic') {
      micIn = new MicInput((m) => hitNote(m, false));
      await micIn.start();
      hint.textContent = 'המיקרופון פעיל. מזהה תו בודד בכל פעם — מומלץ לכבות את הצליל של האפליקציה (🔇) כדי שלא ישמע את עצמו.';
      if (cfg.sound) { cfg.sound = false; player.sound = false; save(); applyCfg(); }
    } else {
      hint.textContent = 'מגע: לוחצים על הקליד הדולק במסך.';
    }
  } catch (err) {
    hint.textContent = 'לא הצלחתי להפעיל: ' + err.message;
    cfg.inputSrc = 'touch'; save(); applyCfg(); segSet('#segInput', 'touch');
  }
}

/* ---------- ממשק ---------- */
const openPanel = () => { $('#panel').classList.add('open'); $('#scrim').classList.add('on'); };
const closePanel = () => { $('#panel').classList.remove('open'); $('#scrim').classList.remove('on'); };
$('#btnMenu').onclick = openPanel;
$('#btnClose').onclick = closePanel;
$('#scrim').onclick = closePanel;

$('#btnPlay').onclick = async () => { synth.init(); synth.resume(); player.toggle(); if (player.playing) requestWakeLock(); };
$('#btnRestart').onclick = () => player.seek(0);
$('#btnHands').onclick = () => {
  cfg.hands = { both: 'R', R: 'L', L: 'both' }[cfg.hands];
  player.setHands(cfg.hands); save(); applyCfg();
};
$('#btnMode').onclick = () => {
  cfg.mode = cfg.mode === 'wait' ? 'follow' : 'wait';
  player.setMode(cfg.mode); save(); applyCfg();
  if (cfg.mode === 'wait') toast('מצב "המתן לי" — הנגינה תעצור עד שתנגן כל תו');
};
$('#btnSpeed').onclick = () => {
  const steps = [50, 65, 80, 100];
  cfg.speed = steps[(steps.indexOf(cfg.speed) + 1) % steps.length] || 50;
  save(); applyCfg();
};
$('#chkSound').onchange = (e) => { cfg.sound = e.target.checked; save(); applyCfg(); };
$('#btnFull').onclick = async () => {
  if (!document.documentElement.requestFullscreen) {
    toast(IS_IOS
      ? 'באייפון אין מסך מלא בדפדפן — שיתוף ← "הוספה למסך הבית" ואז לפתוח משם'
      : 'הדפדפן לא תומך במסך מלא');
    return;
  }
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  } catch {}
};

$('#rngSpeed').oninput = (e) => { cfg.speed = +e.target.value; save(); applyCfg(); };
$('#rngAhead').oninput = (e) => { cfg.aheadSec = +e.target.value; save(); applyCfg(); };
$('#rngVol').oninput = (e) => { cfg.vol = +e.target.value; save(); applyCfg(); };
$('#rngBpm').oninput = (e) => {
  if (!song) return;
  cfg.bpm = +e.target.value; $('#outBpm').textContent = cfg.bpm;
  song.bpm = cfg.bpm; song.tempoMap = null;
  const b = player.beat, lp = player.loop;
  player.load(song); player.loop = lp; player.seek(b);
};
$('#chkMetro').onchange = (e) => { cfg.metro = e.target.checked; save(); applyCfg(); };
$('#chkCount').onchange = (e) => { cfg.countIn = e.target.checked; save(); applyCfg(); };
$('#chkOct').onchange = (e) => { cfg.octForgive = e.target.checked; save(); applyCfg(); };

document.querySelectorAll('#segLabels button').forEach((b) => b.onclick = () => {
  cfg.labels = b.dataset.v; save(); applyCfg();
});
document.querySelectorAll('#segInput button').forEach((b) => b.onclick = () => setInputSource(b.dataset.v));
function resetWindow() {
  if (!song) return;
  cfg.range = null;
  range = initialWindow(song);
  winSemis = range.hi - range.lo;
  shift = null;
  save();
  setFollowHint();
}
function setFollowHint() {
  const el = $('#followHint');
  if (!song) { el.textContent = ''; return; }
  const oct = (winSemis / 12).toFixed(0);
  const fits = song.range[1] - song.range[0] <= winSemis;
  el.innerHTML = {
    auto: `מוצגות ${oct} אוקטבות. ` + (fits
      ? 'כל היצירה נכנסת בחלון הזה — הוא לא יזוז.'
      : 'כשהיצירה עוברת לאזור אחר החלון יזוז <b>באוקטבה שלמה</b> — תמונת המקלדת נשארת זהה, רק תוויות ה-C מתחלפות. המפה הקטנה מעל הקלידים מראה איפה אתה.'),
    fixed: `חלון קבוע של ${oct} אוקטבות. תווים מחוץ לחלון ייצמדו לקצה עם חץ — הזז ידנית עם ◀ ▶.`,
    all: 'כל טווח היצירה על המסך בבת אחת. שום דבר לא זז, אבל הקלידים צרים.',
  }[cfg.follow];
}

document.querySelectorAll('#segFollow button').forEach((b) => b.onclick = () => {
  cfg.follow = b.dataset.v;
  segSet('#segFollow', cfg.follow);
  resetWindow();
});
document.querySelectorAll('#segRange button').forEach((b) => b.onclick = () => {
  if (!song) return;
  const v = b.dataset.v;
  if (v === 'out' && range.hi - range.lo < 72) range = { lo: Math.max(21, range.lo - 12), hi: Math.min(108, range.hi + 12) };
  else if (v === 'in' && range.hi - range.lo > 24) range = { lo: range.lo + 12, hi: range.hi - 12 };
  else if (v === 'left' && range.lo > 21) range = { lo: range.lo - 12, hi: range.hi - 12 };
  else if (v === 'right' && range.hi < 108) range = { lo: range.lo + 12, hi: range.hi + 12 };
  else return;
  winSemis = range.hi - range.lo;
  cfg.follow = 'fixed';
  cfg.range = { songId: song.id, ...range };
  segSet('#segFollow', 'fixed');
  setFollowHint();
  save();
});
document.querySelectorAll('#segLoop button').forEach((b) => b.onclick = () => {
  if (!song) return;
  const v = b.dataset.v;
  if (v === 'clear') player.loop = null;
  else if (v === 'a') player.loop = { a: Math.max(0, player.beat), b: player.loop ? Math.max(player.loop.b, player.beat + 2) : song.lengthBeats };
  else if (v === 'b') player.loop = { a: player.loop ? player.loop.a : 0, b: Math.max(player.beat, (player.loop ? player.loop.a : 0) + 1) };
  setLoopUI();
});
function setLoopUI() {
  const el = $('#seekloop'), L = player.loop;
  if (!L || !song) { el.style.display = 'none'; $('#loopHint').textContent = 'אין לולאה.'; return; }
  const len = song.lengthBeats || 1;
  el.style.display = 'block';
  el.style.left = (L.a / len * 100) + '%';
  el.style.width = ((L.b - L.a) / len * 100) + '%';
  const bar = (b) => (b / (song.beatsPerBar || 4) + 1).toFixed(1);
  $('#loopHint').textContent = `לולאה מתיבה ${bar(L.a)} עד ${bar(L.b)}.`;
}

/* פס התקדמות — גרירה */
let seeking = false;
const seekTo = (e) => {
  if (!song) return;
  const r = $('#seekbar').getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  player.seek(p * song.lengthBeats);
};
$('#seekbar').addEventListener('pointerdown', (e) => { seeking = true; seekTo(e); });
addEventListener('pointermove', (e) => seeking && seekTo(e));
addEventListener('pointerup', () => (seeking = false));

/* ייבוא קובץ */
$('#fileMidi').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const s = /\.(musicxml|xml|mxl)$/i.test(f.name)
      ? await parseMusicXmlFile(f)
      : parseMidi(await f.arrayBuffer(), f.name.replace(/\.midi?$/i, ''));
    imported.push(s);
    if (!store.saveSongs(imported)) toast('נטען, אבל לא נשמר לפעם הבאה (אין מקום באחסון)');
    renderList();
    loadSong(s);
    closePanel();
  } catch (err) {
    toast('שגיאה בייבוא: ' + err.message);
  }
  e.target.value = '';
};

/* הוספת יצירה מטקסט */
$('#btnAddText').onclick = () => {
  const r = $('#txtR').value.trim(), l = $('#txtL').value.trim();
  if (!r && !l) return toast('צריך להזין לפחות יד אחת');
  try {
    const s = buildSong({
      title: $('#txtTitle').value.trim() || 'יצירה שלי',
      composer: 'הוזן ידנית',
      bpm: +$('#txtBpm').value || 90,
      beatsPerBar: +$('#txtSig').value || 4,
    }, r, l);
    imported.push(s);
    if (!store.saveSongs(imported)) toast('נטען, אבל לא נשמר לפעם הבאה');
    renderList();
    loadSong(s);
    closePanel();
  } catch (err) {
    toast('שגיאה בתווים: ' + err.message);
  }
};

/* מקלדת מחשב (לבדיקות) */
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  if (e.code === 'Home') player.seek(0);
});

/* ---------- התאמות iOS ובדיקת תאימות ---------- */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.platform) ||
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document) ||
  /iPhone|iPad|iPod/.test(navigator.userAgent);
const STANDALONE = window.navigator.standalone === true ||
  matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;

// בבורר הקבצים של iOS סינון לפי סיומת מאפיר קבצי MIDI — עדיף בלי סינון
if (IS_IOS) $('#fileMidi').removeAttribute('accept');

// ספארי מתעלם מ-user-scalable=no; חוסמים צביטה כדי שהמקלדת לא תזוז מתחת לאצבע
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) =>
  document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));

function renderDiagnostics() {
  const rows = [
    ['קלט מפסנתר MIDI', !!navigator.requestMIDIAccess,
      'ספארי/iOS לא תומך ב-Web MIDI. השתמש במיקרופון או במגע.'],
    ['מיקרופון (זיהוי צליל)', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      'דורש חיבור מאובטח (https) ולחיצה על כפתור.'],
    ['מסך דלוק בזמן נגינה', 'wakeLock' in navigator,
      'אין תמיכה — כבה נעילה אוטומטית בהגדרות המכשיר.'],
    ['מסך מלא', !!document.documentElement.requestFullscreen,
      IS_IOS ? 'באייפון אין מסך מלא בדפדפן — "הוסף למסך הבית" נותן את אותו דבר.' : ''],
    ['נעילת כיוון לרוחב', !!(screen.orientation && screen.orientation.lock),
      'סובב ידנית וּודא שנעילת הסיבוב במכשיר כבויה.'],
    ['פתיחת קובץ <span dir="ltr">.mxl</span> דחוס', typeof DecompressionStream !== 'undefined',
      'ייצא מ-MuseScore כקובץ <span dir="ltr">.musicxml</span> לא דחוס.'],
    ['עבודה אופליין', 'serviceWorker' in navigator, ''],
    ['שמירת יצירות', (() => { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch { return false; } })(),
      'גלישה פרטית חוסמת שמירה.'],
  ];
  $('#diag').innerHTML = rows.map(([name, ok, why]) =>
    `<div><span>${name}</span><span class="${ok ? 'ok' : 'no'}">${ok ? '✓ נתמך' : '✕ לא נתמך'}</span></div>` +
    (!ok && why ? `<div style="background:none;padding:0 8px;color:var(--dim);font-size:11px">${why}</div>` : '')
  ).join('');
  $('#diagHint').innerHTML = IS_IOS && !STANDALONE
    ? 'זיהיתי אייפון/אייפד. מומלץ: שיתוף ← <b>הוספה למסך הבית</b> — זה מסתיר את סרגלי ספארי, שומר את היצירות לאורך זמן ונותן מסך מלא לרוחב.'
    : STANDALONE ? 'רץ כאפליקציה מותקנת ✓' : '';
}

/* גיבוי הספרייה */
$('#btnExport').onclick = () => {
  if (!imported.length) return toast('אין יצירות מיובאות לייצא');
  const blob = new Blob([JSON.stringify(imported)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'piano-library.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
$('#fileLib').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const list = JSON.parse(await f.text());
    if (!Array.isArray(list)) throw new Error('מבנה לא מוכר');
    const have = new Set(imported.map((x) => x.id));
    let added = 0;
    for (const raw of list) {
      const s2 = normalizeSong(raw);
      if (have.has(s2.id)) continue;
      imported.push(s2); added++;
    }
    store.saveSongs(imported);
    renderList();
    toast(`נוספו ${added} יצירות`);
  } catch (err) { toast('ייבוא נכשל: ' + err.message); }
  e.target.value = '';
};

/* עזר */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  document.body.classList.add('toasting');
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    t.classList.remove('show');
    document.body.classList.remove('toasting');
  }, 2200);
}
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && player.playing) { wakeLock = null; requestWakeLock(); }
});

function checkOrientation() {
  document.body.classList.toggle('portrait', innerHeight > innerWidth);
}
$('#btnIgnoreRotate').onclick = () => document.body.classList.add('ignore-rotate');
addEventListener('resize', () => { renderer.resize(); checkOrientation(); });
// שינוי גודל של הקנבס עצמו (סרגל הכתובת של ספארי, מעבר למסך מלא) לא מייצר resize של החלון
if (window.ResizeObserver) new ResizeObserver(() => renderer.resize()).observe(canvas);
addEventListener('orientationchange', () => setTimeout(() => { renderer.resize(); checkOrientation(); }, 250));

/* אתחול */
renderList();
applyCfg();
renderDiagnostics();
checkOrientation();
loadSong(allSongs().find((s) => s.id === cfg.songId) || LIBRARY[0]);
requestAnimationFrame(frame);

/* ---------- עדכוני גרסה ---------- */
let swReg = null, reloading = false;
function setVersionLabel(v) { $('#verNow').textContent = v || 'לא מותקן (רץ ישירות מהרשת)'; }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'version') setVersionLabel(e.data.version);
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    swReg = reg;
    askVersion();
    // בדיקת עדכון בכל פתיחה וכל חזרה לאפליקציה
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => setVersionLabel(null));
} else {
  setVersionLabel(null);
}
function askVersion() {
  const c = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (c) c.postMessage('version');
  else setVersionLabel(null);
}
navigator.serviceWorker && navigator.serviceWorker.ready.then(askVersion).catch(() => {});

$('#btnUpdate').onclick = async () => {
  if (!swReg) { location.reload(); return; }
  toast('בודק עדכון…');
  try {
    await swReg.update();
    const w = swReg.waiting || swReg.installing;
    if (w) {
      toast('נמצאה גרסה חדשה — מתקין');
      w.postMessage('skipWaiting');       // controllerchange יגרום לרענון
      setTimeout(() => { if (!reloading) location.reload(); }, 1500);
    } else {
      toast('אתה על הגרסה האחרונה');
    }
  } catch {
    toast('אין חיבור לרשת — נשארים על הגרסה המותקנת');
  }
};

// נקודת גישה לניפוי שגיאות מהקונסולה
window.__piano = { player, renderer, synth, cfg, get song() { return song; }, get range() { return range; } };
