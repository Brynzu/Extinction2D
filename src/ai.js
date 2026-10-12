import { CONFIG } from './config.js';
import { C, R, T, TC, TRL, isT, tt, v } from './map.js';
import { orderTrench, patrol } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';

export function analyzeSectors() {
  const blueUnits = U.filter((u) => u.t > 0);
  let topCount = 0;
  let centerCount = 0;
  let bottomCount = 0;

  for (const u of blueUnits) {
    if (u.y < R / 3) topCount++;
    else if (u.y < (2 * R) / 3) centerCount++;
    else bottomCount++;
  }

  let weakLane = 'center';
  let minCount = centerCount;
  if (topCount < minCount) {
    minCount = topCount;
    weakLane = 'top';
  }
  if (bottomCount < minCount) {
    minCount = bottomCount;
    weakLane = 'bottom';
  }

  let targetY = R / 2;
  if (weakLane === 'top') targetY = 12 + Math.random() * 10;
  else if (weakLane === 'bottom') targetY = R - 22 + Math.random() * 10;
  else targetY = R / 2 + (Math.random() - 0.5) * 15;

  // Agrupaciones de unidades del jugador en cobertura (trincheras o bosques)
  const coverClusters = [];
  const inCoverUnits = blueUnits.filter(
    (u) => u.tr || u.gar || tt(u.x, u.y) === 1 || isT(Math.floor(u.x), Math.floor(u.y))
  );

  for (const u of inCoverUnits) {
    let cluster = coverClusters.find((c) => Math.hypot(c.x - u.x, c.y - u.y) < 6.0);
    if (cluster) {
      cluster.count++;
      cluster.units.push(u);
    } else {
      coverClusters.push({ x: u.x, y: u.y, count: 1, units: [u] });
    }
  }

  coverClusters.sort((a, b) => b.count - a.count);

  return { weakLane, targetY, coverClusters };
}

export function aiPlay(E) {
  if (cnt(-1) >= CONFIG.GAME.MAX_UNITS_PER_SIDE) return;

  const analysis = analyzeSectors();
  const availableIndices = [];
  for (let i = 0; i < 4; i++) {
    if (E.cds[i] <= 0 && E.res >= CARDS[i].c && cnt(-1) + CARDS[i].k <= CONFIG.GAME.MAX_UNITS_PER_SIDE) {
      availableIndices.push(i);
    }
  }
  if (!availableIndices.length) return;

  const droneCardIndex = availableIndices.find((idx) => CARDS[idx].isDrone);

  // Lógica de Enjambre de Drones (2 a 5 Drones)
  const targetCluster = analysis.coverClusters[0];
  const blueUnitsNearRedHQ = U.filter((u) => u.t > 0 && Math.hypot(u.x - CONFIG.HQ.RED_HQ.x, u.y - CONFIG.HQ.RED_HQ.y) < 35);

  if (droneCardIndex !== undefined) {
    const shouldSwarm = (targetCluster && targetCluster.count >= 2) || blueUnitsNearRedHQ.length > 0;
    if (shouldSwarm) {
      // Cooldown reducido a 1.0s para permitir enjambres consecutivos cuando se acumulan recursos
      E.res -= CARDS[droneCardIndex].c;
      E.cds[droneCardIndex] = 1.0;
      deploy(-1, droneCardIndex);

      const deployedDrone = U[U.length - 1];
      if (deployedDrone && deployedDrone.isDrone) {
        if (blueUnitsNearRedHQ.length > 0) {
          deployedDrone.attackTarget = blueUnitsNearRedHQ[0];
        } else if (targetCluster && targetCluster.units.length > 0) {
          deployedDrone.attackTarget = targetCluster.units[0];
        }
      }
      return;
    }
  }

  // Despliegue táctico de escuadrón de asalto
  const squadIndices = availableIndices.filter((idx) => !CARDS[idx].isDrone);
  if (!squadIndices.length) return;

  const chosenIndex = squadIndices[Math.floor(Math.random() * squadIndices.length)];
  E.res -= CARDS[chosenIndex].c;
  E.cds[chosenIndex] = CARDS[chosenIndex].cd;
  deploy(-1, chosenIndex);

  // Ordenar inmediatamente al nuevo escuadrón avanzar coordinado por el flanco débil detectado
  const newlyDeployed = U.filter((u) => u.t < 0 && Math.hypot(u.x - CONFIG.HQ.RED_SPAWN.x, u.y - CONFIG.HQ.RED_SPAWN.y) < 5);
  newlyDeployed.forEach((u, k) => {
    const ox = cl(CONFIG.HQ.RED_SPAWN.x - 10 + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
    const oy = cl(analysis.targetY + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
    u.tx = ox;
    u.ty = oy;
  });
}

export function aiTrench() {
  const redUnits = U.filter((u) => u.t < 0 && !u.isDrone);
  const openTrenchCells = TRL.filter((i) => v[i] < 0.2);
  if (!openTrenchCells.length || !redUnits.length) return;

  const analysis = analyzeSectors();
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

  // Hacer que los escuadrones rojos avancen de forma coordinada hacia el flanco débil y el HQ Azul
  const handledSquads = new Set();
  for (const u of redUnits) {
    if (u.gar && u.tr && !u.path.length && !u.exit && Math.hypot(u.tx - u.x, u.ty - u.y) < 0.7) {
      patrol(u, v);
    } else if (!u.gar && !u.tr && !u.cb && Math.hypot(u.tx - u.x, u.ty - u.y) < 1.0) {
      if (u.squadId > 0 && handledSquads.has(u.squadId)) continue;
      if (u.squadId > 0) handledSquads.add(u.squadId);

      const squadMembers = u.squadId > 0 ? redUnits.filter((w) => w.squadId === u.squadId) : [u];

      // Buscar si hay una trinchera en el camino hacia la meta para infiltrar el escuadrón de forma táctica
      const targetX = Math.max(10, u.x - (8 + Math.random() * 15));
      const targetY = cl(analysis.targetY + (Math.random() - 0.5) * 8, 10, R - 10);

      const nearbyTrenchIdx = TRL.find((i) => {
        const tx = (i % C) + 0.5;
        const ty = Math.floor(i / C) + 0.5;
        return Math.hypot(tx - u.x, ty - u.y) < 12 && tx < u.x && Math.abs(ty - targetY) < 15;
      });

      if (nearbyTrenchIdx !== undefined && Math.random() < 0.6) {
        const tX = (nearbyTrenchIdx % C) + 0.5;
        const tY = Math.floor(nearbyTrenchIdx / C) + 0.5;
        orderTrench(squadMembers, Math.floor(tX), Math.floor(tY));
      } else {
        squadMembers.forEach((member, k) => {
          const ox = cl(targetX + ((k % 2) - 0.5) * 1.3, 0.5, C - 0.5);
          const oy = cl(targetY + (Math.floor(k / 2) - 0.5) * 1.3, 0.5, R - 0.5);
          member.tx = ox;
          member.ty = oy;
        });
      }
    }
  }
}
