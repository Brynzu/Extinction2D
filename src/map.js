import { CONFIG } from './config.js';

export const C = CONFIG.GRID.COLUMNS;
export const R = CONFIG.GRID.ROWS;
export const S = CONFIG.GRID.CELL_SIZE;

export const v = new Float32Array(C * R);
export const T = new Uint8Array(C * R);
export const TC = new Int16Array(C * R).fill(-1);
export const TRL = [];

export const tt = (x, y) => T[Math.max(0, Math.min(R - 1, Math.floor(y))) * C + Math.max(0, Math.min(C - 1, Math.floor(x)))];
export const deep = (e) => e.tr && tt(e.x, e.y) === 4;
export const isT = (a, b) => a >= 0 && b >= 0 && a < C && b < R && T[b * C + a] >= 3;
export const ci = (u) => Math.floor(u.y) * C + Math.floor(u.x);

function blob(cx, cy, r) {
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (Math.hypot(x - cx, y - cy) < r && Math.random() < 0.75) {
        T[y * C + x] = 1;
      }
    }
  }
}

export function initMap() {
  T.fill(0);

  // Generar bosques distribuidos en el mapa ampliado
  for (let i = 0; i < 30; i++) {
    blob(4 + Math.random() * (C - 8), 10 + Math.random() * (R - 20), 2 + Math.random() * 2);
  }

  // Generar varias líneas y redes de trincheras a lo largo del mapa
  const numLines = 8;
  for (let i = 0; i < numLines; i++) {
    const y = Math.floor(15 + i * 12 + Math.random() * 4);
    if (y >= R - 10) continue;
    const x0 = Math.floor(Math.random() * (C - 20));
    const n = 12 + Math.floor(Math.random() * 8);
    for (let x = x0; x < x0 + n && x < C; x++) {
      T[y * C + x] = (x < x0 + 2 || x >= x0 + n - 2) ? 3 : 4;
    }
    const bx = x0 + 3 + Math.floor(Math.random() * (n - 6));
    const dy = i % 2 ? 1 : -1;
    for (let k = 1; k <= 5; k++) {
      const yy = y + dy * k;
      if (yy >= 0 && yy < R) {
        T[yy * C + bx] = k === 5 ? 3 : 4;
      }
    }
  }

  // Inicializar territorio: rojo arriba (primeras 30 filas), azul abajo (últimas 30 filas)
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      v[y * C + x] = y < 30 ? -1 : y >= 90 ? 1 : 0;
    }
  }

  // Celdas de trinchera
  TRL.length = 0;
  for (let i = 0; i < C * R; i++) {
    if (T[i] >= 3) TRL.push(i);
  }

  // Componentes conexos TC
  TC.fill(-1);
  let nc = 0;
  for (const s0 of TRL) {
    if (TC[s0] < 0) {
      const q = [s0];
      TC[s0] = nc;
      for (let h = 0; h < q.length; h++) {
        const k = q[h];
        const cx = k % C;
        const cy = (k - cx) / C;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = cx + dx;
          const b = cy + dy;
          if (isT(a, b) && TC[b * C + a] < 0) {
            TC[b * C + a] = nc;
            q.push(b * C + a);
          }
        }
      }
      nc++;
    }
  }
}
