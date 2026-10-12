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
  if (weakLane === 'top') targetY = 15;
  else if (weakLane === 'bottom') targetY = R - 15;
  else targetY = R / 2;

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
  const analysis = analyzeSectors();

  // Despliegue de unidades si hay recursos y espacio disponible
  if (cnt(-1) < CONFIG.GAME.MAX_UNITS_PER_SIDE) {
    const availableIndices = [];
    for (let i = 0; i < 4; i++) {
      if (E.cds[i] <= 0 && E.res >= CARDS[i].c && cnt(-1) + CARDS[i].k <= CONFIG.GAME.MAX_UNITS_PER_SIDE) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length > 0) {
      const droneCardIndex = availableIndices.find((idx) => CARDS[idx].isDrone);
      const targetCluster = analysis.coverClusters[0];
      const blueUnitsNearRedHQ = U.filter((u) => u.t > 0 && Math.hypot(u.x - CONFIG.HQ.RED_HQ.x, u.y - CONFIG.HQ.RED_HQ.y) < 35);

      if (droneCardIndex !== undefined && ((targetCluster && targetCluster.count >= 2) || blueUnitsNearRedHQ.length > 0)) {
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
      } else {
        const squadIndices = availableIndices.filter((idx) => !CARDS[idx].isDrone);
        if (squadIndices.length > 0) {
          const chosenIndex = squadIndices[Math.floor(Math.random() * squadIndices.length)];
          E.res -= CARDS[chosenIndex].c;
          E.cds[chosenIndex] = CARDS[chosenIndex].cd;
          deploy(-1, chosenIndex);
        }
      }
    }
  }

  // Refresco táctico constante para las escuadras en campo
  aiTrench();
}

export function aiTrench() {
  const redUnits = U.filter((u) => u.t < 0 && !u.isDrone);
  if (!redUnits.length) return;

  const analysis = analyzeSectors();

  // Agrupar unidades por escuadrón
  const squadsMap = new Map();
  for (const u of redUnits) {
    const sId = u.squadId > 0 ? u.squadId : 0;
    if (!squadsMap.has(sId)) squadsMap.set(sId, []);
    squadsMap.get(sId).push(u);
  }

  let squadIndex = 0;
  for (const [sId, squadMembers] of squadsMap.entries()) {
    // No interrumpir escuadras en combate o con órdenes de movimiento activas
    const isEngagedInCombat = squadMembers.some((u) => u.cb);
    const isMovingToTarget = squadMembers.some((u) => Math.hypot(u.tx - u.x, u.ty - u.y) > 1.2 || (u.path && u.path.length > 0));

    if (isEngagedInCombat || isMovingToTarget) continue;

    // Asignar carril de avance/flanqueo coordinado para este escuadrón
    let laneY;
    if (squadIndex % 3 === 0) laneY = 15; // Flanco Norte
    else if (squadIndex % 3 === 1) laneY = R - 15; // Flanco Sur
    else laneY = analysis.targetY; // Flanco Débil / Centro

    squadIndex++;

    // Calcular posición promedio del escuadrón
    const avgX = squadMembers.reduce((sum, u) => sum + u.x, 0) / squadMembers.length;
    const avgY = squadMembers.reduce((sum, u) => sum + u.y, 0) / squadMembers.length;

    // Si la escuadra no está avanzando, asignar siguiente objetivo hacia el HQ Azul
    const nextX = Math.max(CONFIG.HQ.BLUE_HQ.x, avgX - 14);
    const targetY = cl(laneY, 8, R - 8);

    // Buscar si hay una trinchera en el camino para avanzar por la red de trincheras
    const nearbyTrenchIdx = TRL.find((i) => {
      const tx = (i % C) + 0.5;
      const ty = Math.floor(i / C) + 0.5;
      return Math.hypot(tx - avgX, ty - avgY) < 14 && tx < avgX && Math.abs(ty - targetY) < 15;
    });

    if (nearbyTrenchIdx !== undefined && Math.random() < 0.6) {
      const tX = (nearbyTrenchIdx % C) + 0.5;
      const tY = Math.floor(nearbyTrenchIdx / C) + 0.5;
      orderTrench(squadMembers, Math.floor(tX), Math.floor(tY));
    } else {
      // Mover todo el escuadrón unido en formación coordinada
      squadMembers.forEach((member, k) => {
        if (!member.tr) {
          member.auto = false;
          member.enter = false;
          const ox = cl(nextX + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
          const oy = cl(targetY + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
          member.tx = ox;
          member.ty = oy;
        }
      });
    }
  }
}
