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

function wouldForm2x2(x, y) {
  const quads = [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[-1, 0], [0, 0], [-1, 1], [0, 1]],
    [[0, -1], [1, -1], [0, 0], [1, 0]],
    [[-1, -1], [0, -1], [-1, 0], [0, 0]]
  ];
  for (const q of quads) {
    let count = 0;
    for (const [dx, dy] of q) {
      if (dx === 0 && dy === 0) continue;
      if (isT(x + dx, y + dy)) count++;
    }
    if (count === 3) return true;
  }
  return false;
}

// Genera una red de trincheras lineales con ramificaciones estrechas (1 casilla de ancho)
function generateLinearTrenchNetwork(startX, startY) {
  const cells = [];
  const isHorizontal = Math.random() < 0.5;
  const mainDir = isHorizontal ? (Math.random() < 0.5 ? [1, 0] : [-1, 0]) : (Math.random() < 0.5 ? [0, 1] : [0, -1]);

  let cx = startX;
  let cy = startY;
  const mainLength = 14 + Math.floor(Math.random() * 12);

  for (let i = 0; i < mainLength; i++) {
    if (cx < 15 || cx >= C - 15 || cy < 8 || cy >= R - 8) break;
    if (!wouldForm2x2(cx, cy)) {
      T[cy * C + cx] = 4;
      cells.push([cx, cy, i]);
    }

    // Ramificaciones ortogonales
    if (i > 1 && i < mainLength - 2 && Math.random() < 0.45) {
      const branchDirs = isHorizontal ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
      const bDir = branchDirs[Math.floor(Math.random() * branchDirs.length)];
      let bx = cx + bDir[0];
      let by = cy + bDir[1];
      const branchLength = 4 + Math.floor(Math.random() * 6);

      for (let j = 0; j < branchLength; j++) {
        if (bx < 15 || bx >= C - 15 || by < 8 || by >= R - 8) break;
        if (!wouldForm2x2(bx, by)) {
          T[by * C + bx] = 4;
          cells.push([bx, by, j]);
        } else {
          break;
        }

        // Sub-ramificación ocasional
        if (j === branchLength - 1 && Math.random() < 0.5) {
          const subDirs = isHorizontal ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
          const sDir = subDirs[Math.floor(Math.random() * subDirs.length)];
          const sx = bx + sDir[0];
          const sy = by + sDir[1];
          if (sx >= 15 && sx < C - 15 && sy >= 8 && sy < R - 8 && !wouldForm2x2(sx, sy)) {
            T[sy * C + sx] = 4;
            cells.push([sx, sy, 0]);
          }
        }
        bx += bDir[0];
        by += bDir[1];
      }
    }

    cx += mainDir[0];
    cy += mainDir[1];
  }

  // Asignar celdas superficiales (1 / T=3) en extremos y periódicamente
  for (const [x, y, idx] of cells) {
    let neighborCount = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      if (isT(x + dx, y + dy)) neighborCount++;
    }
    // Extremos (1 vecino) o posiciones periódicas (entradas/posiciones de tiro)
    if (neighborCount <= 1 || idx % 3 === 0) {
      T[y * C + x] = 3;
    }
  }
}

export function initMap() {
  T.fill(0);

  // Generar bosques distribuidos
  for (let i = 0; i < 35; i++) {
    blob(10 + Math.random() * (C - 20), 6 + Math.random() * (R - 12), 2 + Math.random() * 2);
  }

  // Generar varias redes lineales de trincheras a lo largo del frente central
  const numClusters = 7;
  for (let i = 0; i < numClusters; i++) {
    const clusterX = Math.floor(25 + (i * (C - 50)) / numClusters + Math.random() * 6);
    const clusterY = Math.floor(15 + Math.random() * (R - 30));
    generateLinearTrenchNetwork(clusterX, clusterY);
  }

  // Inicializar territorio en formato horizontal
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      v[y * C + x] = x < 35 ? 1 : x >= 85 ? -1 : 0;
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
