import { CONFIG } from './config.js';
import { C, R, isT } from './map.js';

export const U = [];
export const CARDS = CONFIG.CARDS;

export const cl = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
export const cnt = (playerId) => U.filter((u) => u.playerId === playerId || u.t === playerId).length;

let nextSquadId = 1;

export function resetSquadCounter() {
  nextSquadId = 1;
}

export function addUnit(playerId, x, y, targetX = x, targetY = y, isDrone = false, squadId = 0, role = 'rifleman') {
  U.push({
    playerId,
    t: playerId,
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

export function deploy(player, cardIndex) {
  const c = CARDS[cardIndex];
  if (!player || !player.hq || !player.hq.alive) return;
  const spawnPos = { x: player.hq.spawnX, y: player.hq.spawnY };
  const hqPos = { x: player.hq.x, y: player.hq.y };

  const squadId = c.isDrone ? 0 : nextSquadId++;
  const roles = c.isDrone ? ['drone'] : ['leader', 'machinegunner', 'grenadier', 'rifleman', 'rifleman'];

  for (let k = 0; k < c.k; k++) {
    const startX = cl(spawnPos.x + ((k % 2) - 0.5) * 1.2, 0.5, C - 0.5);
    const startY = cl(spawnPos.y + (Math.floor(k / 2) - 0.5) * 1.2, 0.5, R - 0.5);
    const targetX = cl(hqPos.x + ((k % 2) - 0.5) * 1.2, 0.5, C - 0.5);
    const targetY = cl(hqPos.y + (Math.floor(k / 2) - 0.5) * 1.2, 0.5, R - 0.5);

    const role = roles[k % roles.length];
    addUnit(player.id, startX, startY, targetX, targetY, c.isDrone, squadId, role);
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

      // Separación de Drones entre sí para evitar que se amontonen en la misma casilla
      if (a.isDrone && b.isDrone) {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const droneSepDist = 0.85;
        if (d >= droneSepDist) continue;
        if (d < 0.001) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          d = Math.hypot(dx, dy) || 0.1;
        }
        const p = ((droneSepDist - d) * 0.3) / d;
        a.x = cl(a.x - dx * p, 0.5, C - 0.5);
        a.y = cl(a.y - dy * p, 0.5, R - 0.5);
        b.x = cl(b.x + dx * p, 0.5, C - 0.5);
        b.y = cl(b.y + dy * p, 0.5, R - 0.5);
        continue;
      }

      // Los drones no interactúan físicamente con tropas terrestres
      if (a.isDrone || b.isDrone) continue;

      // Separación de tropas terrestres
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
