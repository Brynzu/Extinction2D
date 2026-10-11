import { CONFIG } from './config.js';
import { C, R, T, TC, ci, deep, isT, tt } from './map.js';
import { sounds } from './sound.js';
import { U, cl } from './units.js';

export let B = [];
export let explosions = [];

export function clearBullets() {
  B.length = 0;
  explosions.length = 0;
}

export function filterBullets() {
  B = B.filter((b) => b.l > 0 && !b.dead);
  return B;
}

export function filterExplosions() {
  explosions = explosions.filter((ex) => ex.l > 0);
  return explosions;
}

const losT = (s, e) => {
  const n = Math.max(1, Math.ceil(Math.hypot(e.x - s.x, e.y - s.y) / 0.3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!isT(Math.floor(s.x + (e.x - s.x) * t), Math.floor(s.y + (e.y - s.y) * t))) return false;
  }
  return true;
};

export const canHit = (s, e) => {
  if (s.isDrone || e.isDrone) return true;
  if (!deep(s) && !deep(e)) return true;
  return s.tr && e.tr && TC[ci(s)] === TC[ci(e)] && losT(s, e);
};

export const hitOk = (b, e) => {
  if (e.isDrone) return true;
  const same = e.tr && b.tn >= 0 && TC[ci(e)] === b.tn;
  return deep(e) || b.dp ? same : true;
};

export const vr = (e, o) => {
  if (e.isDrone) return CONFIG.VISIBILITY.VISION_DEFAULT; // Drones no se ocultan en bosques/trincheras
  const k = tt(e.x, e.y);
  return k === 4 && e.tr ? (o.tr && TC[ci(o)] === TC[ci(e)] ? 5 : 0) : k === 1 ? 3 : 8;
};

export const canSee = (x, y) =>
  U.some((u) => {
    if (u.t <= 0) return false;
    const vision = u.isDrone ? CONFIG.VISIBILITY.VISION_DRONE : CONFIG.VISIBILITY.VISION_DEFAULT;
    return Math.hypot(u.x - x, u.y - y) <= vision;
  });

export function vis(dt) {
  for (const e of U) {
    e.rev = Math.max(0, e.rev - dt);
    e.seen = e.rev > 0;
    if (!e.seen) {
      for (const o of U) {
        if (o.t !== e.t) {
          const vision = o.isDrone ? CONFIG.VISIBILITY.VISION_DRONE : vr(e, o);
          if (Math.hypot(o.x - e.x, o.y - e.y) <= vision) {
            e.seen = true;
            break;
          }
        }
      }
    }
  }
}

export function triggerExplosion(x, y) {
  sounds.playExplosion();
  explosions.push({ x, y, l: 0.4, maxL: 0.4 });

  // Daño directo a unidad en casilla e impacto a 1 casilla alrededor
  for (const victim of U) {
    const dist = Math.hypot(victim.x - x, victim.y - y);
    if (dist <= 0.8) {
      victim.hp = 0; // Matar unidad directa
    } else if (dist <= 1.8) {
      victim.hp -= 2.5; // Dañar gravemente adyacentes
    }
  }
}

export function updateCombat(dt) {
  filterExplosions();
  for (const ex of explosions) {
    ex.l -= dt;
  }

  for (const u of U) {
    u.cd -= dt;

    // Lógica especial para Dron Kamikaze
    if (u.isDrone) {
      let target = u.attackTarget && u.attackTarget.hp > 0 ? u.attackTarget : null;

      if (!target) {
        let bd = 15;
        for (const e of U) {
          if (e.t !== u.t && e.seen) {
            const d = Math.hypot(e.x - u.x, e.y - u.y);
            if (d < bd) {
              bd = d;
              target = e;
            }
          }
        }
      }

      if (target) {
        u.tx = target.x;
        u.ty = target.y;

        // Estrellarse contra el objetivo al estar a distancia de impacto
        if (Math.hypot(target.x - u.x, target.y - u.y) <= 0.6) {
          u.hp = 0;
          triggerExplosion(u.x, u.y);
          continue;
        }
      }
      continue;
    }

    // Lógica para unidades normales
    let tg = u.attackTarget && u.attackTarget.hp > 0 ? u.attackTarget : null;
    let bd = CONFIG.COMBAT.RANGE_DEFAULT;

    if (!tg) {
      for (const e of U) {
        if (e.t !== u.t) {
          const d = Math.hypot(e.x - u.x, e.y - u.y);
          if (d < bd && d <= (tt(e.x, e.y) === 1 ? CONFIG.COMBAT.RANGE_FOREST : CONFIG.COMBAT.RANGE_DEFAULT) && canHit(u, e) && e.seen) {
            bd = d;
            tg = e;
          }
        }
      }
    } else {
      bd = Math.hypot(tg.x - u.x, tg.y - u.y);
    }

    const had = u.cb;
    u.cb = !!tg;

    // Cuando la infantería entra en combate por primera vez, si tenía una orden de movimiento activa,
    // guardamos esa orden para retomarla cuando termine la batalla.
    if (tg && !had) {
      u.rd = Math.random() * CONFIG.COMBAT.REACTION_MAX;
      if (!u.tr && !u.savedMoveTarget && Math.hypot(u.tx - u.x, u.ty - u.y) >= 0.3) {
        u.savedMoveTarget = {
          tx: u.tx,
          ty: u.ty,
          auto: u.auto,
          enter: u.enter,
          gc: u.gc,
          path: u.path ? [...u.path] : [],
          exit: u.exit ? [...u.exit] : null,
          hold: u.hold,
          post: u.post,
        };
      }
    }

    // Cuando termina el combate y la unidad vuelve a estar en paz:
    if (!tg && had) {
      if (u.savedMoveTarget) {
        u.tx = u.savedMoveTarget.tx;
        u.ty = u.savedMoveTarget.ty;
        u.auto = u.savedMoveTarget.auto;
        u.enter = u.savedMoveTarget.enter;
        u.gc = u.savedMoveTarget.gc;
        u.path = u.savedMoveTarget.path;
        u.exit = u.savedMoveTarget.exit;
        u.hold = u.savedMoveTarget.hold;
        u.post = u.savedMoveTarget.post;
        u.savedMoveTarget = null;
      }
    }

    if (u.rd > 0) u.rd -= dt;

    if (tg && bd > 0 && !u.tr && !u.enter && (u.ct -= dt) <= 0) {
      u.ct = 0.5;
      const nx = (tg.x - u.x) / bd;
      const ny = (tg.y - u.y) / bd;
      // Si la unidad no está en cobertura de árbol, buscar árbol cercano e ir hacia él ignorando la orden de marcha mientras combate
      if (tt(u.x + nx * 0.9, u.y + ny * 0.9) !== 1) {
        let best = null;
        let bs = 16;
        for (let j = -4; j <= 4; j++) {
          for (let i = -4; i <= 4; i++) {
            const cx = Math.floor(u.x) + i;
            const cy = Math.floor(u.y) + j;
            if (cx < 0 || cy < 0 || cx >= C || cy >= R || T[cy * C + cx] !== 1) continue;
            const px = cx + 0.5;
            const py = cy + 0.5;
            const ex = tg.x - px;
            const ey = tg.y - py;
            const el = Math.hypot(ex, ey) || 1;
            const hx = cl(px - (ex / el) * 1.1, 0.5, C - 0.5);
            const hy = cl(py - (ey / el) * 1.1, 0.5, R - 0.5);
            const d2 = (hx - u.x) ** 2 + (hy - u.y) ** 2;
            if (d2 < bs && !isT(Math.floor(hx), Math.floor(hy))) {
              bs = d2;
              best = [hx, hy];
            }
          }
        }
        if (best) {
          u.tx = best[0];
          u.ty = best[1];
          u.auto = true;
        }
      }
    }

    if (tg && bd > 0 && u.cd <= 0 && u.rd <= 0) {
      const an =
        Math.atan2(tg.y - u.y, tg.x - u.x) +
        (Math.random() - 0.5) *
          2 *
          (CONFIG.COMBAT.DISPERSION_BASE + CONFIG.COMBAT.DISPERSION_DIST * bd) *
          (Math.hypot(u.tx - u.x, u.ty - u.y) > 0.1 ? CONFIG.COMBAT.DISPERSION_MOVING_MULT : 1) *
          (deep(u) ? CONFIG.COMBAT.DISPERSION_TRENCH_DEEP_MULT : 1) *
          (tg.isDrone ? CONFIG.COMBAT.DISPERSION_DRONE_MULT : 1);

      B.push({
        x: u.x,
        y: u.y,
        sx: u.x,
        sy: u.y,
        tn: u.tr ? TC[ci(u)] : -1,
        dp: deep(u) || deep(tg) ? 1 : 0,
        vx: Math.cos(an) * CONFIG.COMBAT.BULLET_SPEED,
        vy: Math.sin(an) * CONFIG.COMBAT.BULLET_SPEED,
        t: u.t,
        l: CONFIG.COMBAT.BULLET_LIFETIME,
      });
      sounds.playShot();
      u.cd = CONFIG.COMBAT.ATTACK_COOLDOWN;
      u.rev = CONFIG.COMBAT.SHOT_REVEAL_TIME;
    }
  }

  for (const b of B) {
    b.l -= dt;
    const ns = Math.ceil((CONFIG.COMBAT.BULLET_SPEED * dt) / 0.15);
    const h = dt / ns;
    for (let s = 0; s < ns && !b.dead; s++) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      for (const e of U) {
        if (e.t !== b.t && Math.hypot(e.x - b.x, e.y - b.y) < CONFIG.COMBAT.BULLET_HIT_RADIUS && hitOk(b, e)) {
          e.hp -= tt(e.x, e.y) === 3 && b.tn < 0 ? CONFIG.COMBAT.TRENCH_SHALLOW_DAMAGE_MULT : CONFIG.COMBAT.BULLET_DAMAGE;
          b.dead = 1;
          break;
        }
      }
      if (
        !b.dead &&
        tt(b.x, b.y) === 1 &&
        Math.hypot(b.x - Math.floor(b.x) - 0.5, b.y - Math.floor(b.y) - 0.5) < 0.15 &&
        Math.hypot(b.x - b.sx, b.y - b.sy) > 1.6
      ) {
        b.dead = 1;
      }
      if (b.dp && !isT(Math.floor(b.x), Math.floor(b.y))) b.dead = 1;
    }
  }

  filterBullets();
}
