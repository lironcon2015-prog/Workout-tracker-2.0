// render.js — גיאומטריית קלידים + ציור הקנבס (מסלול תווים נופלים + פסנתר)
import { isBlack, noteName, solfegeName, octaveOf } from './notation.js';

const BLACK_OFF = { 1: -0.10, 3: 0.10, 6: -0.15, 8: 0, 10: 0.15 };
const COLORS = {
  R: { fill: '#ffb340', edge: '#ffd79a', glow: 'rgba(255,179,64,.45)' },
  L: { fill: '#3fb9ff', edge: '#9fe0ff', glow: 'rgba(63,185,255,.45)' },
};

export function buildLayout(lo, hi, width) {
  const keys = new Map();
  const whites = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const whiteW = width / Math.max(1, whites.length);
  whites.forEach((m, i) => keys.set(m, { m, x: i * whiteW, w: whiteW, black: false, i }));
  const whiteIndex = new Map(whites.map((m, i) => [m, i]));
  const bw = whiteW * 0.57;
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) continue;
    let boundary;
    if (whiteIndex.has(m - 1)) boundary = whiteIndex.get(m - 1) + 1;
    else if (whiteIndex.has(m + 1)) boundary = whiteIndex.get(m + 1);
    else continue;
    const center = (boundary + BLACK_OFF[((m % 12) + 12) % 12]) * whiteW;
    keys.set(m, { m, x: center - bw / 2, w: bw, black: true, center });
  }
  return { keys, whiteW, blackW: bw, lo, hi, width };
}

export function keyAt(layout, x, y, kbTop, kbH) {
  if (y < kbTop) return null;
  const blackH = kbH * 0.62;
  for (const k of layout.keys.values()) {
    if (k.black && y <= kbTop + blackH && x >= k.x && x <= k.x + k.w) return k.m;
  }
  for (const k of layout.keys.values()) {
    if (!k.black && x >= k.x && x <= k.x + k.w) return k.m;
  }
  return null;
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.layout = null;
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layout = null;
  }

  draw(st) {
    const c = this.ctx, W = this.w, H = this.h;
    const kbH = Math.round(Math.min(Math.max(H * 0.34, 90), 190));
    const kbTop = H - kbH;
    if (!this.layout || this.layout.lo !== st.lo || this.layout.hi !== st.hi || this.layout.width !== W) {
      this.layout = buildLayout(st.lo, st.hi, W);
    }
    const L = this.layout;

    // רקע
    const bg = c.createLinearGradient(0, 0, 0, kbTop);
    bg.addColorStop(0, '#080a10');
    bg.addColorStop(1, '#131826');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, kbTop);

    // מסלולי אוקטבות
    c.save();
    for (const k of L.keys.values()) {
      if (k.black) continue;
      const pc = ((k.m % 12) + 12) % 12;
      if (pc === 0) {
        c.fillStyle = 'rgba(255,255,255,.045)';
        c.fillRect(k.x, 0, 1, kbTop);
      } else if (pc === 5) {
        c.fillStyle = 'rgba(255,255,255,.02)';
        c.fillRect(k.x, 0, 1, kbTop);
      }
    }
    c.restore();

    const pxPerBeat = kbTop / st.lookaheadBeats;
    const yOf = (beat) => kbTop - (beat - st.beat) * pxPerBeat;

    // קווי תיבה
    const bpb = st.beatsPerBar || 4;
    c.strokeStyle = 'rgba(255,255,255,.10)';
    c.fillStyle = 'rgba(255,255,255,.28)';
    c.font = '10px system-ui, sans-serif';
    c.textAlign = 'left';
    const firstBar = Math.floor(st.beat / bpb) * bpb;
    for (let b = firstBar; b <= st.beat + st.lookaheadBeats; b += bpb) {
      const y = yOf(b);
      if (y < -20 || y > kbTop) continue;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      c.fillText(String(Math.round(b / bpb) + 1), 4, y - 4);
    }

    // תווים נופלים
    const minB = st.beat - 0.6, maxB = st.beat + st.lookaheadBeats;
    for (const n of st.notes) {
      if (n.t > maxB) break;
      if (n.t + n.d < minB) continue;
      if (st.hands !== 'both' && n.hand !== st.hands) continue;
      const k = L.keys.get(n.m);
      if (!k) continue;
      const y1 = yOf(n.t + n.d), y2 = yOf(n.t);
      const h = Math.max(6, y2 - y1);
      const col = COLORS[n.hand] || COLORS.R;
      const pad = k.black ? 1 : 2;
      const x = k.x + pad, w = k.w - pad * 2;
      const active = st.beat >= n.t && st.beat <= n.t + n.d;
      const imminent = n.t - st.beat < 0.25 && n.t + n.d > st.beat - 0.1;

      c.save();
      if (active || imminent) { c.shadowColor = col.glow; c.shadowBlur = 16; }
      const g = c.createLinearGradient(x, y1, x, y1 + h);
      g.addColorStop(0, col.edge);
      g.addColorStop(0.18, col.fill);
      g.addColorStop(1, k.black ? shade(col.fill, -0.28) : shade(col.fill, -0.12));
      c.fillStyle = g;
      roundRect(c, x, y1, w, h, Math.min(6, w / 2));
      c.fill();
      c.restore();

      if (h > 22 && w > 16 && st.labels !== 'none') {
        c.fillStyle = 'rgba(0,0,0,.72)';
        c.font = `600 ${Math.min(12, w * 0.55)}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillText(st.labels === 'solfege' ? solfegeName(n.m) : noteName(n.m), x + w / 2, y1 + h - 6);
      }
      if (n.finger && h > 34 && w > 14) {
        c.fillStyle = 'rgba(0,0,0,.85)';
        c.font = '700 11px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillText(String(n.finger), x + w / 2, y1 + 13);
      }
    }

    // קו הפגיעה
    const hl = c.createLinearGradient(0, kbTop - 14, 0, kbTop);
    hl.addColorStop(0, 'rgba(255,255,255,0)');
    hl.addColorStop(1, 'rgba(255,255,255,.16)');
    c.fillStyle = hl;
    c.fillRect(0, kbTop - 14, W, 14);
    c.fillStyle = st.waiting ? '#ff5f7a' : 'rgba(255,255,255,.55)';
    c.fillRect(0, kbTop - 2, W, 2);

    this.drawKeyboard(c, L, kbTop, kbH, st);
    this.kbTop = kbTop; this.kbH = kbH;
  }

  drawKeyboard(c, L, top, h, st) {
    const blackH = h * 0.62;
    c.fillStyle = '#05070c';
    c.fillRect(0, top, this.w, h);

    for (const k of L.keys.values()) {
      if (k.black) continue;
      const st2 = keyState(k.m, st);
      const g = c.createLinearGradient(0, top, 0, top + h);
      if (st2.active) {
        const col = COLORS[st2.hand] || COLORS.R;
        g.addColorStop(0, col.edge); g.addColorStop(1, col.fill);
      } else if (st2.wait) {
        g.addColorStop(0, '#ff9db0'); g.addColorStop(1, '#ff5f7a');
      } else {
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9d6cd');
      }
      c.fillStyle = g;
      roundRect(c, k.x + 0.5, top + 1, k.w - 1, h - 2, 4);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,.45)';
      c.lineWidth = 1;
      c.stroke();

      const pc = ((k.m % 12) + 12) % 12;
      if (st.labels !== 'none' || pc === 0) {
        const showAll = st.labels !== 'none';
        if (pc === 0 || showAll) {
          c.fillStyle = pc === 0 ? '#8a3b00' : 'rgba(0,0,0,.5)';
          c.font = `${pc === 0 ? '700 ' : ''}${Math.min(11, k.w * 0.46)}px system-ui, sans-serif`;
          c.textAlign = 'center';
          const label = pc === 0
            ? (st.labels === 'solfege' ? 'דו' + octaveOf(k.m) : 'C' + octaveOf(k.m))
            : (st.labels === 'solfege' ? solfegeName(k.m) : noteName(k.m));
          c.fillText(label, k.x + k.w / 2, top + h - 7);
        }
      }
    }

    for (const k of L.keys.values()) {
      if (!k.black) continue;
      const st2 = keyState(k.m, st);
      const g = c.createLinearGradient(0, top, 0, top + blackH);
      if (st2.active) {
        const col = COLORS[st2.hand] || COLORS.R;
        g.addColorStop(0, col.fill); g.addColorStop(1, shade(col.fill, -0.35));
      } else if (st2.wait) {
        g.addColorStop(0, '#ff5f7a'); g.addColorStop(1, '#a11330');
      } else {
        g.addColorStop(0, '#2a2f3a'); g.addColorStop(1, '#0a0c11');
      }
      c.fillStyle = g;
      roundRect(c, k.x, top, k.w, blackH, 3);
      c.fill();
    }
  }
}

function keyState(m, st) {
  if (st.waitSet && st.waitSet.has(m)) return { wait: true };
  const a = st.activeKeys.get(m);
  return a ? { active: true, hand: a } : {};
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
