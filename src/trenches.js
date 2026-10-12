import { C, R, T, TRL, isT } from './map.js';

export function bfs(sx, sy, goal) {
  const pr = new Int16Array(C * R).fill(-1);
  const s = sy * C + sx;
  const q = [s];
  pr[s] = s;

  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const cx = k % C;
    const cy = (k - cx) / C;
    if (goal(cx, cy)) {
      const p = [];
      for (let m = k; m !== s; m = pr[m]) {
        p.unshift([m % C + 0.5, Math.floor(m / C) + 0.5]);
      }
      return p;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const n = ny * C + nx;
      if (isT(nx, ny) && pr[n] < 0) {
        pr[n] = k;
        q.push(n);
      }
    }
  }
  return null;
}

export function pathOut(x, y, gx, gy) {
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  const ex = Math.floor(gx);
  const ey = Math.floor(gy);

  const bl = (a, b) =>
    a < 0 || b < 0 || a >= C || b >= R || (T[b * C + a] >= 3 && !(a === ex && b === ey) && !(a === sx && b === sy));

  const st = Math.ceil(Math.hypot(gx - x, gy - y) / 0.2);
  let ok = true;
  for (let i = 1; i <= st && ok; i++) {
    const t = i / st;
    if (bl(Math.floor(x + (gx - x) * t), Math.floor(y + (gy - y) * t))) ok = false;
  }
  if (ok) return [];

  const pr = new Int16Array(C * R).fill(-1);
  const s = sy * C + sx;
  const q = [s];
  pr[s] = s;

  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const cx = k % C;
    const cy = (k - cx) / C;
    if (cx === ex && cy === ey) {
      const p = [];
      for (let m = k; m !== s; m = pr[m]) {
        p.unshift([m % C + 0.5, Math.floor(m / C) + 0.5]);
      }
      return p;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (bl(nx, ny)) continue;
      if (dx && dy && (bl(cx + dx, cy) || bl(cx, cy + dy))) continue;
      const n = ny * C + nx;
      if (pr[n] < 0) {
        pr[n] = k;
        q.push(n);
      }
    }
  }
  return [];
}

export function wpt(u) {
  if (u.lx !== u.tx || u.ly !== u.ty) {
    u.lx = u.tx;
    u.ly = u.ty;
    u.wp = pathOut(u.x, u.y, u.tx, u.ty);
  }
  while (u.wp.length && Math.hypot(u.wp[0][0] - u.x, u.wp[0][1] - u.y) < 0.35) {
    u.wp.shift();
  }
  return u.wp.length ? u.wp[0] : [u.tx, u.ty];
}

export function dmap(gx, gy) {
  const d = new Int16Array(C * R).fill(-1);
  const q = [gy * C + gx];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const cx = k % C;
    const cy = (k - cx) / C;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = cx + dx;
      const b = cy + dy;
      if (isT(a, b) && d[b * C + a] < 0) {
        d[b * C + a] = d[k] + 1;
        q.push(b * C + a);
      }
    }
  }
  return { d, q };
}

export function odist(u) {
  const od = new Int16Array(C * R).fill(-1);
  const sx = Math.floor(u.x);
  const sy = Math.floor(u.y);
  const q = [sy * C + sx];
  od[q[0]] = 0;

  const bl = (a, b) => a < 0 || b < 0 || a >= C || b >= R || (T[b * C + a] >= 3 && !(a === sx && b === sy));

  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    const cx = k % C;
    const cy = (k - cx) / C;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = cx + dx;
      const b = cy + dy;
      if (bl(a, b)) continue;
      if (dx && dy && (bl(cx + dx, cy) || bl(cx, cy + dy))) continue;
      const n = b * C + a;
      if (od[n] < 0) {
        od[n] = od[k] + 1;
        q.push(n);
      }
    }
  }
  return od;
}

export function patrol(u, v) {
  const sx = Math.floor(u.x);
  const sy = Math.floor(u.y);
  const all = [];
  bfs(sx, sy, (a, b) => {
    if (v[b * C + a] < 0.2) all.push([a, b]);
    return false;
  });
  const sup = all.filter((c) => T[c[1] * C + c[0]] === 3);
  const pl = sup.length && Math.random() < 0.6 ? sup : all;
  if (!pl.length) return;
  const [gx, gy] = pl[Math.floor(Math.random() * pl.length)];
  const p = bfs(sx, sy, (a, b) => a === gx && b === gy);
  if (p) u.path = p;
}

export function postTick(U) {
  const done = new Set();
  for (const w of U) {
    if (!w.post || !w.tr) continue;
    const key = w.t + ':' + w.post[0] + ',' + w.post[1];
    if (done.has(key)) continue;
    done.add(key);
    const px = w.post[0];
    const py = w.post[1];
    if (U.filter((u) => u.t === w.t && u.hold && u.hold[0] === px && u.hold[1] === py).length >= 2) continue;
    const cand = U.filter((u) => u.t === w.t && u.tr && u.post && u.post[0] === px && u.post[1] === py)
      .sort((a, b) => {
        const aIsLeader = a.squadId > 0 && a.role === 'leader';
        const bIsLeader = b.squadId > 0 && b.role === 'leader';
        if (aIsLeader !== bIsLeader) return aIsLeader ? 1 : -1;
        return Math.hypot(a.x - px - 0.5, a.y - py - 0.5) - Math.hypot(b.x - px - 0.5, b.y - py - 0.5);
      })[0];
    if (!cand) continue;
    const p = bfs(Math.floor(cand.x), Math.floor(cand.y), (a, b) => a === px && b === py);
    if (p) {
      cand.path = p;
      cand.hold = [px, py];
      cand.post = null;
      cand.exit = null;
    }
  }
}

export function orderTrench(us, cx, cy) {
  us = us.slice().sort((p, r) => Math.hypot(p.x - cx - 0.5, p.y - cy - 0.5) - Math.hypot(r.x - cx - 0.5, r.y - cy - 0.5));

  // Táctica de escuadrón si el Líder de equipo está vivo
  const squadId = us.length ? us[0].squadId : 0;
  const hasLeader = squadId > 0 && us.some((w) => w.squadId === squadId && w.role === 'leader' && w.hp > 0);

  if (hasLeader) {
    const rolePriority = (u) => {
      if (u.role === 'rifleman') return 1;
      if (u.role === 'grenadier') return 2;
      if (u.role === 'machinegunner') return 3;
      if (u.role === 'leader') return 4;
      return 5;
    };
    us.sort((a, b) => rolePriority(a) - rolePriority(b));
  }

  const q = dmap(cx, cy).q;
  const isS = T[cy * C + cx] === 3;
  const qd = q.filter((k) => T[k] === 4);

  us.forEach((u, i) => {
    let k;
    u.hold = null;
    u.post = null;
    if (isS && i < 2) {
      k = cy * C + cx;
      u.hold = [cx, cy];
    } else if (isS && qd.length) {
      k = qd[Math.min(Math.floor((i - 2) / 2), qd.length - 1)];
      u.post = [cx, cy];
    } else {
      k = q[Math.min(Math.floor(i / 2), q.length - 1)];
    }
    const gx = k % C;
    const gy = Math.floor(k / C);
    if (u.tr) {
      const p = bfs(Math.floor(u.x), Math.floor(u.y), (a, b) => a === gx && b === gy);
      if (p) {
        u.path = p;
        u.exit = null;
      }
      return;
    }
    const dm = dmap(gx, gy).d;
    const od = odist(u);
    let best = -1;
    let bc = 1e9;
    for (const j of TRL) {
      if (dm[j] < 0) continue;
      const ex = j % C;
      const ey = Math.floor(j / C);
      if (
        (!isT(ex + 1, ey) && ex + 1 < C) ||
        (!isT(ex - 1, ey) && ex > 0) ||
        (!isT(ex, ey + 1) && ey + 1 < R) ||
        (!isT(ex, ey - 1) && ey > 0)
      ) {
        let oc = 1e9;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = ex + a;
          const ny = ey + b;
          if (nx >= 0 && ny >= 0 && nx < C && ny < R && !isT(nx, ny) && od[ny * C + nx] >= 0) {
            oc = Math.min(oc, od[ny * C + nx] + 1);
          }
        }
        const c = oc * 5 + dm[j] + (T[j] === 4 ? 3 : 0);
        if (c < bc) {
          bc = c;
          best = j;
        }
      }
    }
    if (best < 0) return;
    u.auto = false;
    u.tx = (best % C) + 0.5;
    u.ty = Math.floor(best / C) + 0.5;
    u.enter = true;
    u.gc = [gx, gy];
    u.exit = null;
    u.path = [];
  });
}
