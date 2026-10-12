import { CONFIG } from './config.js';
import { C, R, isT } from './map.js';

export const U = [];
export const CARDS = CONFIG.CARDS;

export const cl = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
export const cnt = (t) => U.filter((u) => u.t === t).length;

let nextSquadId = 1;

export function addUnit(t, x, y, targetX = x, targetY = y, isDrone = false, squadId = 0, role = 'rifleman') {
  U.push({
    t,
    x,
    y,
    tx: targetX,
    ty: targetY,
    s: false,
    tm: 0,
    hp: CONFIG.UNITS.DEFAULT_HP,
    mh: CONFIG.UNITS.DEFAULT_HP,
    sp: isDrone ? 4.5 : 1,
    isDrone,
    squadId,
    role, // 'leader' | 'machinegunner' | 'grenadier' | 'rifleman'
    grenadeCd: 0,
    burstShots: 0, // Contador de ráfaga para ametrallador
    tr: false,
    path: [],
    exit: null,
    enter: false,
    gar: false,
    seen: false,
    rev: 0,
    wp: [],
    lx: -1,
    ly: -1,
    rd: 0,
    gc: null,
    hold: null,
    post: null,
    cd: Math.random(),
    ct: 0,
    auto: false,
    attackTarget: null,
    savedMoveTarget: null, // Guardará { tx, ty, auto, enter, gc, path, exit, hold, post } al entrar en combate
  });
}

export function deploy(t, cardIndex) {
  const c = CARDS[cardIndex];
  const spawnPos = t > 0 ? CONFIG.HQ.BLUE_SPAWN : CONFIG.HQ.RED_SPAWN;
  const hqPos = t > 0 ? CONFIG.HQ.BLUE_HQ : CONFIG.HQ.RED_HQ;

  const squadId = c.isDrone ? 0 : nextSquadId++;
  // Roles para escuadrón de asalto de 5 miembros: 1 líder, 1 machinegunner, 1 grenadier, 2 riflemen
  const roles = c.isDrone ? ['drone'] : ['leader', 'machinegunner', 'grenadier', 'rifleman', 'rifleman'];

  for (let k = 0; k < c.k; k++) {
    const startX = cl(spawnPos.x + ((k % 2) - 0.5) * 1.2, 0.5, C - 0.5);
    const startY = cl(spawnPos.y + (Math.floor(k / 2) - 0.5) * 1.2, 0.5, R - 0.5);
    const targetX = cl(hqPos.x + ((k % 2) - 0.5) * 1.2, 0.5, C - 0.5);
    const targetY = cl(hqPos.y + (Math.floor(k / 2) - 0.5) * 1.2, 0.5, R - 0.5);

    const role = roles[k % roles.length];
    addUnit(t, startX, startY, targetX, targetY, c.isDrone, squadId, role);
    const u = U[U.length - 1];
    u.hp = u.mh = c.hp;
    u.sp = c.sp;
  }
}

export function nudge(u, mx, my) {
  const nx = cl(u.x + mx, 0.3, C - 0.3);
  const ny = cl(u.y + my, 0.3, R - 0.3);

  if (u.isDrone) {
    u.x = nx;
    u.y = ny;
    return;
  }

  const f = (a, b) =>
    u.tr
      ? isT(Math.floor(a), Math.floor(b))
      : !isT(Math.floor(a), Math.floor(b)) || isT(Math.floor(u.x), Math.floor(u.y));

  if (f(nx, ny)) {
    u.x = nx;
    u.y = ny;
  } else if (f(nx, u.y)) {
    u.x = nx;
  } else if (f(u.x, ny)) {
    u.y = ny;
  }
}

export function sep() {
  for (let i = 0; i < U.length; i++) {
    for (let j = i + 1; j < U.length; j++) {
      const a = U[i];
      const b = U[j];
      if (a.isDrone || b.isDrone) continue; // Drones no se empujan con tropas terrestres
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= CONFIG.UNITS.SEPARATION_DIST) continue;
      if (d < 0.001) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        d = Math.hypot(dx, dy) || 1;
      }
      const p = ((CONFIG.UNITS.SEPARATION_DIST - d) * 0.25) / d;
      nudge(a, -dx * p, -dy * p);
      nudge(b, dx * p, dy * p);
    }
  }
}
