import { CONFIG } from './config.js';
import { C, R, T, TRL, v } from './map.js';
import { patrol } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';

export function aiPlay(E) {
  if (cnt(-1) >= CONFIG.GAME.MAX_UNITS_PER_SIDE) return;

  // Evaluar cartas disponibles
  const availableIndices = [];
  for (let i = 0; i < 4; i++) {
    if (E.cds[i] <= 0 && E.res >= CARDS[i].c && cnt(-1) + CARDS[i].k <= CONFIG.GAME.MAX_UNITS_PER_SIDE) {
      availableIndices.push(i);
    }
  }
  if (!availableIndices.length) return;

  // Priorizar Dron Kamikaze si hay unidades azules cerca del HQ Rojo
  const blueUnitsNearRedHQ = U.filter((u) => u.t > 0 && Math.hypot(u.x - CONFIG.HQ.RED_HQ.x, u.y - CONFIG.HQ.RED_HQ.y) < 35);
  const droneCardIndex = availableIndices.find((idx) => CARDS[idx].isDrone);

  let chosenIndex;
  if (blueUnitsNearRedHQ.length > 0 && droneCardIndex !== undefined && Math.random() < 0.7) {
    chosenIndex = droneCardIndex;
  } else {
    chosenIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  }

  E.res -= CARDS[chosenIndex].c;
  E.cds[chosenIndex] = CARDS[chosenIndex].cd;
  deploy(-1, chosenIndex);
}

export function aiTrench() {
  const redUnits = U.filter((u) => u.t < 0 && !u.isDrone);
  const openTrenchCells = TRL.filter((i) => v[i] < 0.2);
  if (!openTrenchCells.length || !redUnits.length) return;

  const wantInTrench = Math.floor(redUnits.length * CONFIG.AI.TRENCH_WANT_FRACTION);
  const currentInTrench = redUnits.filter((u) => u.gar).length;

  if (currentInTrench < wantInTrench) {
    const superficialCells = openTrenchCells.filter((j) => T[j] === 3);
    const candidateList = superficialCells.length && Math.random() < 0.75 ? superficialCells : openTrenchCells;
    const targetCellIdx = candidateList[Math.floor(Math.random() * candidateList.length)];
    const cx = (targetCellIdx % C) + 0.5;
    const cy = Math.floor(targetCellIdx / C) + 0.5;

    let bestUnit = null;
    let minDistance = 1e9;
    for (const u of redUnits) {
      if (!u.gar && !u.cb) {
        const d = Math.hypot(u.x - cx, u.y - cy);
        if (d < minDistance) {
          minDistance = d;
          bestUnit = u;
        }
      }
    }
    if (bestUnit) {
      bestUnit.gar = true;
      bestUnit.auto = false;
      bestUnit.enter = true;
      bestUnit.tx = cx;
      bestUnit.ty = cy;
    }
  }

  // Hacer que las unidades rojas sueltas (o por escuadres) avancen tácticamente hacia el frente y HQ Azul
  const handledSquads = new Set();
  for (const u of redUnits) {
    if (u.gar && u.tr && !u.path.length && !u.exit && Math.hypot(u.tx - u.x, u.ty - u.y) < 0.7) {
      patrol(u, v);
    } else if (!u.gar && !u.tr && !u.cb && Math.hypot(u.tx - u.x, u.ty - u.y) < 1.0) {
      if (u.squadId > 0 && handledSquads.has(u.squadId)) continue;
      if (u.squadId > 0) handledSquads.add(u.squadId);

      const targetX = Math.max(10, u.x - (8 + Math.random() * 15));
      const targetY = cl(u.y + (Math.random() - 0.5) * 20, 10, R - 10);

      const squadMembers = u.squadId > 0 ? redUnits.filter((w) => w.squadId === u.squadId) : [u];
      squadMembers.forEach((member, k) => {
        const ox = cl(targetX + ((k % 2) - 0.5) * 1.3, 0.5, C - 0.5);
        const oy = cl(targetY + (Math.floor(k / 2) - 0.5) * 1.3, 0.5, R - 0.5);
        member.tx = ox;
        member.ty = oy;
      });
    }
  }
}
