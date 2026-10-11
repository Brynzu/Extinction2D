import { CONFIG } from './config.js';
import { C, R, S, T, isT, v } from './map.js';
import { cv, msg } from './render.js';
import { bfs, orderTrench } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';

let lastTap = 0;
let dg = null;
let box = null;

export function getBox() {
  return box;
}

export function initInput(P) {
  const tap = (e) => {
    const b = cv.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * C;
    const y = ((e.clientY - b.top) / b.height) * R;

    if (P.sel >= 0) {
      const c = CARDS[P.sel];
      if (!(v[Math.floor(y) * C + Math.floor(x)] > 0.3)) {
        msg('Solo puedes desplegar en tu territorio (celdas azules).');
      } else if (cnt(1) + c.k > CONFIG.GAME.MAX_UNITS_PER_SIDE) {
        msg('Límite de unidades alcanzado.');
      } else {
        P.res -= c.c;
        P.cds[P.sel] = c.cd;
        deploy(1, P.sel, x, y);
        P.sel = -1;
      }
      return;
    }

    const nowT = performance.now();
    const dbl = nowT - lastTap < 320;
    lastTap = nowT;

    const hit = U.filter((u) => u.t > 0 && Math.hypot(u.x - x, u.y - y) < 0.8).sort(
      (p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)
    )[0];

    if (hit) {
      if (dbl) {
        U.forEach((u) => {
          if (u.t > 0) u.s = true;
        });
      } else {
        hit.s = !hit.s;
      }
      return;
    }

    const cx = Math.floor(x);
    const cy = Math.floor(y);

    U.filter((u) => u.s).forEach((u, i) => {
      const ox = cl(x + ((i % 3) - 1) * 1.3, 0.5, C - 0.5);
      const oy = cl(y + (Math.floor(i / 3) - 1) * 1.3, 0.5, R - 0.5);
      if (isT(cx, cy)) {
        if (i === 0) orderTrench(U.filter((w) => w.s), cx, cy);
      } else if (u.tr) {
        if (dbl) {
          const p = bfs(Math.floor(u.x), Math.floor(u.y), (a, b) => T[b * C + a] === 3);
          if (p) {
            u.path = p;
            u.exit = [ox, oy];
            u.hold = null;
            u.post = null;
          }
        }
      } else {
        u.auto = false;
        u.enter = false;
        u.hold = null;
        u.post = null;
        const bad = isT(Math.floor(ox), Math.floor(oy));
        u.tx = bad ? x : ox;
        u.ty = bad ? y : oy;
      }
    });
  };

  const pc = (e) => {
    const b = cv.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * C, ((e.clientY - b.top) / b.height) * R];
  };

  cv.addEventListener('pointerdown', (e) => {
    dg = { cx: e.clientX, cy: e.clientY, on: false };
    cv.setPointerCapture(e.pointerId);
  });

  cv.addEventListener('pointermove', (e) => {
    if (!dg) return;
    if (!dg.on && Math.hypot(e.clientX - dg.cx, e.clientY - dg.cy) > 10) dg.on = true;
    if (dg.on) {
      const a = pc({ clientX: dg.cx, clientY: dg.cy });
      const z = pc(e);
      box = [a[0] * S, a[1] * S, z[0] * S, z[1] * S];
    }
  });

  cv.addEventListener('pointerup', (e) => {
    if (!dg) return;
    const d = dg;
    dg = null;
    box = null;
    if (!d.on) {
      tap(e);
      return;
    }
    if (P.sel >= 0) return;
    const a = pc({ clientX: d.cx, clientY: d.cy });
    const z = pc(e);
    const x0 = Math.min(a[0], z[0]);
    const x1 = Math.max(a[0], z[0]);
    const y0 = Math.min(a[1], z[1]);
    const y1 = Math.max(a[1], z[1]);
    const inn = U.filter((u) => u.t > 0 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
    U.forEach((u) => (u.s = inn.includes(u)));
  });

  cv.addEventListener('pointercancel', () => {
    dg = null;
    box = null;
  });
}
