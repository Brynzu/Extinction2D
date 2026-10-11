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

// Genera una red de trincheras orgánicas estilo "raíz" con bifurcaciones, ramificaciones y celdas superficiales/bajas
function generateRootTrenchCluster(startX, startY) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY, depth: 0, dir: Math.floor(Math.random() * 4) }];

  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];

  const maxCells = 35 + Math.floor(Math.random() * 25);
  let count = 0;

  while (queue.length > 0 && count < maxCells) {
    const idx = Math.floor(Math.random() * queue.length);
    const curr = queue.splice(idx, 1)[0];
    const key = `${curr.x},${curr.y}`;

    if (curr.x < 15 || curr.x >= C - 15 || curr.y < 8 || curr.y >= R - 8 || visited.has(key)) {
      continue;
    }

    visited.add(key);
    count++;

    // Las celdas terminales o con pocos vecinos son superficiales (T=3), el interior es baja (T=4)
    T[curr.y * C + curr.x] = 4;

    // Agregar vecinos para formar ramas estilo raíz
    for (let d = 0; d < 4; d++) {
      const nx = curr.x + dirs[d][0];
      const ny = curr.y + dirs[d][1];
      const nKey = `${nx},${ny}`;

      if (nx >= 15 && nx < C - 15 && ny >= 8 && ny < R - 8 && !visited.has(nKey)) {
        // Mayor probabilidad de continuar en la misma dirección que bifurcar
        const prob = d === curr.dir ? 0.7 : 0.35;
        if (Math.random() < prob) {
          queue.push({ x: nx, y: ny, depth: curr.depth + 1, dir: d });
        }
      }
    }
  }

  // Marcar los extremos o bordes de las ramas como trincheras superficiales (T=3)
  for (const key of visited) {
    const [x, y] = key.split(',').map(Number);
    let neighbors = 0;
    for (const [dx, dy] of dirs) {
      if (isT(x + dx, y + dy)) neighbors++;
    }
    if (neighbors <= 2 || Math.random() < 0.3) {
      T[y * C + x] = 3; // Superficial / Entrada
    }
  }
}

export function initMap() {
  T.fill(0);

  // Generar bosques distribuidos
  for (let i = 0; i < 35; i++) {
    blob(10 + Math.random() * (C - 20), 6 + Math.random() * (R - 12), 2 + Math.random() * 2);
  }

  // Generar varias redes orgánicas de trincheras tipo "raíz" a lo largo del frente central
  const numClusters = 7;
  for (let i = 0; i < numClusters; i++) {
    const clusterX = Math.floor(25 + (i * (C - 50)) / numClusters + Math.random() * 6);
    const clusterY = Math.floor(15 + Math.random() * (R - 30));
    generateRootTrenchCluster(clusterX, clusterY);
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
