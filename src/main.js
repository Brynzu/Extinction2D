import { aiPlay, aiTrench } from './ai.js';
import { updateCombat, vis } from './combat.js';
import { CONFIG } from './config.js';
import { getBox, initInput } from './input.js';
import { C, R, T, isT, initMap, v } from './map.js';
import { draw, initCardsUI, ui } from './render.js';
import { bfs, postTick, wpt } from './trenches.js';
import { U, addUnit, cl, sep } from './units.js';

export const P = { res: CONFIG.GAME.INITIAL_RESOURCES, cds: [0, 0, 0, 0], sel: -1 };
export const E = { res: CONFIG.GAME.INITIAL_RESOURCES, cds: [0, 0, 0, 0], tm: 3, gt: 5 };

let nb = 0;
let nr = 0;
let pt = 0;
let last = performance.now();

const rate = (t) => CONFIG.GAME.RESOURCE_BASE_RATE + CONFIG.GAME.RESOURCE_TERRITORY_RATE * (t > 0 ? nb : nr) / (C * R);

export function initGame() {
  initMap();

  // Inicializar unidades iniciales (5 azules abajo, 5 rojas arriba)
  for (let i = 0; i < 5; i++) {
    addUnit(1, CONFIG.HQ.BLUE_HQ.x + (i - 2) * 2, CONFIG.HQ.BLUE_HQ.y - 2);
    addUnit(-1, CONFIG.HQ.RED_HQ.x + (i - 2) * 2, CONFIG.HQ.RED_HQ.y + 2);
  }

  initCardsUI(P);
  initInput(P);

  requestAnimationFrame(step);
}

function step(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  P.res = Math.min(CONFIG.GAME.MAX_RESOURCES, P.res + dt * rate(1));
  E.res = Math.min(CONFIG.GAME.MAX_RESOURCES, E.res + dt * rate(-1));

  for (const q of [P, E]) {
    for (let i = 0; i < 4; i++) {
      q.cds[i] = Math.max(0, q.cds[i] - dt);
    }
  }

  E.tm -= dt;
  if (E.tm <= 0) {
    E.tm = CONFIG.AI.PLAY_CHECK_INTERVAL_MIN + Math.random() * CONFIG.AI.PLAY_CHECK_INTERVAL_RANGE;
    aiPlay(E);
  }

  E.gt -= dt;
  if (E.gt <= 0) {
    E.gt = CONFIG.AI.TRENCH_CHECK_INTERVAL;
    aiTrench();
  }

  vis(dt);
  sep();

  pt -= dt;
  if (pt <= 0) {
    pt = 0.5;
    postTick(U);
  }

  for (const u of U) {
    if (u.t < 0) {
      u.tm -= dt;
      if (u.tm <= 0 && !u.cb && !u.gar) {
        u.auto = false;
        u.tx = 1 + Math.random() * (C - 2);
        u.ty = 10 + Math.random() * (R - 20);
        if (isT(Math.floor(u.tx), Math.floor(u.ty))) u.tx = cl(u.tx + 2, 0.5, C - 0.5);
        u.tm = 3 + Math.random() * 4;
      }
    }

    if (u.tr) {
      if (Math.hypot(u.tx - u.x, u.ty - u.y) < 0.5) {
        if (u.path.length) {
          const p = u.path.shift();
          u.tx = p[0];
          u.ty = p[1];
        } else if (u.exit) {
          u.tr = false;
          u.tx = u.exit[0];
          u.ty = u.exit[1];
          u.exit = null;
        }
      }
    } else if (u.enter && Math.hypot(u.tx - u.x, u.ty - u.y) < 0.5 && isT(Math.floor(u.x), Math.floor(u.y))) {
      u.tr = true;
      u.enter = false;
      u.path = u.gc ? (bfs(Math.floor(u.x), Math.floor(u.y), (a, b) => a === u.gc[0] && b === u.gc[1]) || []) : [];
      u.gc = null;
    }

    const mt = u.tr ? [u.tx, u.ty] : wpt(u);
    const dx = mt[0] - u.x;
    const dy = mt[1] - u.y;
    const d = Math.hypot(dx, dy);

    if (d > 0.08) {
      const speed = u.t > 0 ? CONFIG.UNITS.SPEED_BLUE : CONFIG.UNITS.SPEED_RED;
      const m = Math.min(d, speed * u.sp * (u.cb ? CONFIG.UNITS.COMBAT_SPEED_MULT : 1) * dt);
      const px = u.x + (dx / d) * m;
      const py = u.y + (dy / d) * m;
      const ok = (a, b) =>
        u.tr
          ? isT(Math.floor(a), Math.floor(b))
          : !isT(Math.floor(a), Math.floor(b)) ||
            isT(Math.floor(u.x), Math.floor(u.y)) ||
            (u.enter && Math.floor(a) === Math.floor(u.tx) && Math.floor(b) === Math.floor(u.ty));

      if (ok(px, py)) {
        u.x = px;
        u.y = py;
      } else if (ok(px, u.y)) {
        u.x = px;
      } else if (ok(u.x, py)) {
        u.y = py;
      }
    }

    const r = CONFIG.GAME.TERRITORY_PUSH_RADIUS;
    for (let j = Math.max(0, Math.floor(u.y - r)); j <= Math.min(R - 1, Math.floor(u.y + r)); j++) {
      for (let i = Math.max(0, Math.floor(u.x - r)); i <= Math.min(C - 1, Math.floor(u.x + r)); i++) {
        if (Math.hypot(i + 0.5 - u.x, j + 0.5 - u.y) <= r) {
          const k = j * C + i;
          v[k] = cl(v[k] + u.t * dt * CONFIG.GAME.TERRITORY_PUSH_SPEED, -1, 1);
        }
      }
    }
  }

  updateCombat(dt);

  // Eliminar unidades sin vida
  for (let i = U.length - 1; i >= 0; i--) {
    if (U[i].hp <= 0) U.splice(i, 1);
  }

  ui(P);
  draw(P, getBox(), (b, r) => {
    nb = b;
    nr = r;
  });

  requestAnimationFrame(step);
}

window.addEventListener('DOMContentLoaded', initGame);
