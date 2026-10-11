import { CONFIG } from './config.js';
import { C, R, T, TRL, v } from './map.js';
import { patrol } from './trenches.js';
import { U, CARDS, cnt, deploy } from './units.js';

export function aiPlay(E) {
  if (cnt(-1) >= CONFIG.GAME.MAX_UNITS_PER_SIDE) return;
  const o = [];
  for (let i = 0; i < 4; i++) {
    if (E.cds[i] <= 0 && E.res >= CARDS[i].c && cnt(-1) + CARDS[i].k <= CONFIG.GAME.MAX_UNITS_PER_SIDE) {
      o.push(i);
    }
  }
  if (!o.length) return;
  const i = o[Math.floor(Math.random() * o.length)];
  E.res -= CARDS[i].c;
  E.cds[i] = CARDS[i].cd;
  deploy(-1, i);
}

export function aiTrench() {
  const rs = U.filter((u) => u.t < 0);
  const cells = TRL.filter((i) => v[i] < 0.2);
  if (!cells.length) return;

  const want = Math.floor(rs.length * CONFIG.AI.TRENCH_WANT_FRACTION);
  const have = rs.filter((u) => u.gar).length;

  if (have < want) {
    const sup = cells.filter((j) => T[j] === 3);
    const pl = sup.length && Math.random() < 0.7 ? sup : cells;
    const i = pl[Math.floor(Math.random() * pl.length)];
    const cx = (i % C) + 0.5;
    const cy = Math.floor(i / C) + 0.5;
    let best = null;
    let bd = 1e9;
    for (const u of rs) {
      if (!u.gar && !u.cb) {
        const d = Math.hypot(u.x - cx, u.y - cy);
        if (d < bd) {
          bd = d;
          best = u;
        }
      }
    }
    if (best) {
      best.gar = true;
      best.auto = false;
      best.enter = true;
      best.tx = cx;
      best.ty = cy;
    }
  }

  for (const u of rs) {
    if (u.gar && u.tr && !u.path.length && !u.exit && Math.hypot(u.tx - u.x, u.ty - u.y) < 0.7) {
      patrol(u, v);
    }
  }
}
