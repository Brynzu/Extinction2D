import { CONFIG } from './config.js';
import { C, R, T, TC, TRL, ci, isT, tt, v } from './map.js';
import { orderTrench, patrol } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';
import { areEnemies } from './combat.js';

function getEnemiesOf(p, players) {
  return players.filter((other) => other.id !== p.id && other.team !== p.team);
}

function getEnemyHQsOf(p, players) {
  return getEnemiesOf(p, players)
    .filter((e) => e.hq && e.hq.alive)
    .map((e) => e.hq);
}

function getClosestEnemyHQ(p, players, x, y) {
  const hqs = getEnemyHQsOf(p, players);
  if (!hqs.length) return null;
  let closest = hqs[0];
  let minD = Math.hypot(closest.x - x, closest.y - y);
  for (let i = 1; i < hqs.length; i++) {
    const d = Math.hypot(hqs[i].x - x, hqs[i].y - y);
    if (d < minD) {
      minD = d;
      closest = hqs[i];
    }
  }
  return closest;
}

function findStrugglingAlly(p, players) {
  const allies = players.filter((other) => other.id !== p.id && other.team === p.team && other.hq && other.hq.alive);
  if (!allies.length) return null;

  for (const ally of allies) {
    if (ally.hq.hp < ally.hq.maxHp * 0.7) {
      return ally;
    }
    const enemiesNearAllyHQ = U.filter(
      (u) => areEnemies(p.id, u.playerId || u.t, players) && Math.hypot(u.x - ally.hq.x, u.y - ally.hq.y) < 25
    );
    if (enemiesNearAllyHQ.length >= 2) {
      return ally;
    }
  }

  return null;
}

let cachedEnemyUnitsMap = null;
let cachedEnemyUnitsFrame = -1;

function getEnemyUnitsCached(players) {
  const currentFrame = Math.floor(performance.now() / 100);
  if (cachedEnemyUnitsMap && cachedEnemyUnitsFrame === currentFrame) {
    return cachedEnemyUnitsMap;
  }
  cachedEnemyUnitsMap = new Map();
  for (const p of players) {
    const enemies = getEnemiesOf(p, players);
    const enemyUnits = U.filter((u) => enemies.some((e) => e.id === u.playerId || e.id === u.t));
    cachedEnemyUnitsMap.set(p.id, enemyUnits);
  }
  cachedEnemyUnitsFrame = currentFrame;
  return cachedEnemyUnitsMap;
}

export function updateAIDrones(p, players) {
  const aiDrones = U.filter((u) => (u.playerId === p.id || u.t === p.id) && u.isDrone);
  if (!aiDrones.length || !p.hq) return;

  const enemyUnitsMap = getEnemyUnitsCached(players);
  const enemyUnits = enemyUnitsMap.get(p.id) || [];

  const strugglingAlly = findStrugglingAlly(p, players);
  const enemyHQ = getClosestEnemyHQ(p, players, p.hq.x, p.hq.y);

  const waitingDrones = aiDrones.filter((d) => !d.attackTarget || (d.attackTarget.hp <= 0 && (!d.attackTarget.isHq || !d.attackTarget.alive)));
  const swarmThreshold = Math.min(7, Math.max(3, p.droneSwarmGoal || 4));

  if (waitingDrones.length >= swarmThreshold || (enemyHQ && Math.hypot(enemyHQ.x - p.hq.x, enemyHQ.y - p.hq.y) < 20)) {
    let swarmTarget = null;

    if (strugglingAlly) {
      const enemiesNearAlly = enemyUnits.filter((u) => Math.hypot(u.x - strugglingAlly.hq.x, u.y - strugglingAlly.hq.y) < 30);
      if (enemiesNearAlly.length) swarmTarget = enemiesNearAlly[0];
    }

    if (!swarmTarget) {
      swarmTarget = enemyUnits.length ? enemyUnits[0] : enemyHQ ? { x: enemyHQ.x, y: enemyHQ.y, isHq: true, alive: true } : null;
    }

    if (swarmTarget) {
      waitingDrones.forEach((d) => {
        d.attackTarget = swarmTarget;
      });
      p.droneSwarmGoal = Math.floor(3 + Math.random() * 5);
    }
  } else {
    waitingDrones.forEach((d, k) => {
      d.attackTarget = null;
      d.tx = cl(p.hq.x + ((k % 3) - 1) * 2.8, 2, C - 2);
      d.ty = cl(p.hq.y + (Math.floor(k / 3) - 1) * 2.8, 2, R - 2);
    });
  }
}

export function aiPlay(p, players) {
  if (!p || !p.hq || !p.hq.alive) return;

  const myUnits = U.filter((u) => u.playerId === p.id || u.t === p.id);
  const myGroundUnits = myUnits.filter((u) => !u.isDrone);
  const myDrones = myUnits.filter((u) => u.isDrone);

  if (!p.droneSwarmGoal) {
    p.droneSwarmGoal = Math.floor(3 + Math.random() * 5);
  }

  // Despliegue de cartas (prioridad a infantería para mantener presencia terrestre, limitando drones)
  let activeUnits = U.filter((u) => u.playerId === p.id || u.t === p.id);
  let groundCount = activeUnits.filter((u) => !u.isDrone).length;
  let droneCount = activeUnits.filter((u) => u.isDrone).length;

  while (activeUnits.length < CONFIG.GAME.MAX_UNITS_PER_SIDE) {
    const availableIndices = [];
    for (let i = 0; i < 4; i++) {
      if (p.cds[i] <= 0 && p.res >= CARDS[i].c && activeUnits.length + CARDS[i].k <= CONFIG.GAME.MAX_UNITS_PER_SIDE) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length === 0) break;

    const droneCardIndex = availableIndices.find((idx) => CARDS[idx].isDrone);
    const squadIndices = availableIndices.filter((idx) => !CARDS[idx].isDrone);

    // Solo desplegar dron si la fuerza terrestre es sólida (al menos 12 soldados) y los drones son menos del 20% de la fuerza terrestre
    const maxAllowedDrones = Math.max(2, Math.floor(groundCount / 5));
    let deployDrone = false;
    if (droneCardIndex !== undefined && groundCount >= 12 && droneCount < maxAllowedDrones) {
      deployDrone = Math.random() < 0.50;
    }

    if (deployDrone && droneCardIndex !== undefined) {
      p.res -= CARDS[droneCardIndex].c;
      p.cds[droneCardIndex] = 2.5;
      deploy(p, droneCardIndex);
      droneCount++;
    } else if (squadIndices.length > 0) {
      const chosenIndex = squadIndices[Math.floor(Math.random() * squadIndices.length)];
      p.res -= CARDS[chosenIndex].c;
      p.cds[chosenIndex] = CARDS[chosenIndex].cd;
      deploy(p, chosenIndex);
      groundCount += CARDS[chosenIndex].k;
    } else {
      break;
    }

    activeUnits = U.filter((u) => u.playerId === p.id || u.t === p.id);
  }

  updateAIDrones(p, players);
  aiTrench(p, players);
}

// Búsqueda de la celda no controlada (neutral o enemiga) más cercana para expansión constante
function findNearestUncontrolledCell(p, fromX, fromY, players = []) {
  let bestCandidate = null;
  let minSquareDist = Infinity;

  const step = 2; // escaneo por cuadrícula para rendimiento
  for (let cy = 2; cy < R - 2; cy += step) {
    for (let cx = 2; cx < C - 2; cx += step) {
      const cellOwnerId = Math.round(v[cy * C + cx]);
      const isMyTerritory = cellOwnerId === p.id;

      if (!isMyTerritory) {
        const d2 = (cx + 0.5 - fromX) ** 2 + (cy + 0.5 - fromY) ** 2;
        if (d2 < minSquareDist) {
          minSquareDist = d2;
          bestCandidate = { x: cx + 0.5, y: cy + 0.5 };
        }
      }
    }
  }
  return bestCandidate;
}

// Obtener o calcular información de ocupación de trincheras y bosques en todo el mapa
function getCoverOccupation(players) {
  const trenchOccupation = new Map(); // tcId -> { squads: Set, unitsCount: number, ownerId: number }
  const forestOccupation = new Map(); // fId -> { squads: Set, unitsCount: number, ownerId: number }

  for (const u of U) {
    if (u.isDrone || u.hp <= 0) continue;
    const uPid = u.playerId || u.t;

    // Trinchera
    if (u.tr) {
      const tcId = TC[ci(u)];
      if (tcId >= 0) {
        if (!trenchOccupation.has(tcId)) {
          trenchOccupation.set(tcId, { squads: new Set(), unitsCount: 0, ownerId: uPid });
        }
        const data = trenchOccupation.get(tcId);
        data.squads.add(u.squadId);
        data.unitsCount++;
      }
    } else {
      // Bosque
      const tile = tt(u.x, u.y);
      if (tile === 1) {
        const fId = Math.floor(u.y) * C + Math.floor(u.x);
        if (!forestOccupation.has(fId)) {
          forestOccupation.set(fId, { squads: new Set(), unitsCount: 0, ownerId: uPid });
        }
        const data = forestOccupation.get(fId);
        data.squads.add(u.squadId);
        data.unitsCount++;
      }
    }
  }

  return { trenchOccupation, forestOccupation };
}

function findAvailableTrenchOrForestCover(p, x, y, coverOccupation, searchRadius = 24, allowAttacking = false) {
  let bestCandidate = null;
  let bestDist = Infinity;

  const minX = Math.max(2, Math.floor(x - searchRadius));
  const maxX = Math.min(C - 3, Math.ceil(x + searchRadius));
  const minY = Math.max(2, Math.floor(y - searchRadius));
  const maxY = Math.min(R - 3, Math.ceil(y + searchRadius));

  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      const tileType = T[cy * C + cx];
      if (tileType === 1 || tileType >= 3) {
        const isTrenchTile = tileType >= 3;
        const coverId = isTrenchTile ? TC[cy * C + cx] : cy * C + cx;

        const occupation = isTrenchTile ? coverOccupation.trenchOccupation.get(coverId) : coverOccupation.forestOccupation.get(coverId);

        // Límite de capacidad defensiva: máx 2 escuadrones por red de trinchera o bosque a menos que sea un asalto masivo
        const squadLimit = allowAttacking ? 4 : 2;
        const currentSquads = occupation ? occupation.squads.size : 0;

        if (currentSquads < squadLimit) {
          const dist = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
          if (dist < bestDist) {
            bestDist = dist;
            bestCandidate = { x: cx + 0.5, y: cy + 0.5, isTrench: isTrenchTile, coverId };
          }
        }
      }
    }
  }

  return bestCandidate;
}

export function aiTrench(p, players) {
  if (!p || !p.hq || !p.hq.alive) return;
  const myGroundUnits = U.filter((u) => (u.playerId === p.id || u.t === p.id) && !u.isDrone);
  if (!myGroundUnits.length) return;

  const strugglingAlly = findStrugglingAlly(p, players);
  const targetHQ = strugglingAlly ? strugglingAlly.hq : getClosestEnemyHQ(p, players, p.hq.x, p.hq.y);
  if (!targetHQ) return;

  const coverOccupation = getCoverOccupation(players);

  // Agrupar unidades por escuadrón
  const squadsMap = new Map();
  for (const u of myGroundUnits) {
    const sId = u.squadId > 0 ? u.squadId : 0;
    if (!squadsMap.has(sId)) squadsMap.set(sId, []);
    squadsMap.get(sId).push(u);
  }

  const squads = Array.from(squadsMap.values());
  const totalSquads = squads.length;

  // Definir meta de escuadrones para un asalto masivo (2 a 4 escuadrones)
  if (!p.assaultGoal) {
    p.assaultGoal = Math.floor(2 + Math.random() * 3); // 2 a 4
  }

  const isAssaultReady = totalSquads >= p.assaultGoal;

  for (let sIndex = 0; sIndex < squads.length; sIndex++) {
    const squadMembers = squads[sIndex];

    // Si el escuadrón está activamente disparando/combatiendo, no interrumpir su cobertura de combate
    if (squadMembers.some((u) => u.cb)) continue;

    const avgX = squadMembers.reduce((sum, u) => sum + u.x, 0) / squadMembers.length;
    const avgY = squadMembers.reduce((sum, u) => sum + u.y, 0) / squadMembers.length;

    // 1. EXPANSIÓN CONSTANTE DE TERRITORIO (Prioridad para evitar huecos neutrales)
    const uncontrolledCell = findNearestUncontrolledCell(p, avgX, avgY, players);

    // 2. FASE DE PREPARACIÓN Y ACUMULACIÓN DE ASALTO (2-4 ESCUADRONES)
    if (!isAssaultReady) {
      // Si hay territorio sin tomar cercano, expandir el frente primero
      if (uncontrolledCell && Math.hypot(uncontrolledCell.x - avgX, uncontrolledCell.y - avgY) > 4) {
        const targetX = uncontrolledCell.x;
        const targetY = uncontrolledCell.y;

        const cover = findAvailableTrenchOrForestCover(p, targetX, targetY, coverOccupation, 10, false);

        if (cover && cover.isTrench) {
          orderTrench(squadMembers, Math.floor(cover.x), Math.floor(cover.y));
        } else {
          squadMembers.forEach((member, k) => {
            member.auto = false;
            member.enter = false;
            member.tx = cl((cover ? cover.x : targetX) + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
            member.ty = cl((cover ? cover.y : targetY) + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
          });
        }
      } else {
        // Acumular en punto de reunión/cobertura cerca del HQ
        const rallyX = cl(p.hq.x + ((sIndex % 3) - 1) * 5, 3, C - 3);
        const rallyY = cl(p.hq.y + (Math.floor(sIndex / 3) - 1) * 5, 3, R - 3);

        const cover = findAvailableTrenchOrForestCover(p, rallyX, rallyY, coverOccupation, 14, false);
        const targetRallyX = cover ? cover.x : rallyX;
        const targetRallyY = cover ? cover.y : rallyY;

        if (cover && cover.isTrench) {
          orderTrench(squadMembers, Math.floor(cover.x), Math.floor(cover.y));
        } else {
          squadMembers.forEach((member, k) => {
            member.auto = false;
            member.enter = false;
            member.tx = cl(targetRallyX + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
            member.ty = cl(targetRallyY + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
          });
        }
      }
      continue;
    }

    // 3. FASE DE ASALTO MÁSIVO COORDINADO HACIA OBJETIVOS ENEMIGOS / HQ
    let dx = targetHQ.x - avgX;
    let dy = targetHQ.y - avgY;

    const dist = Math.hypot(dx, dy) || 1;
    const stepDist = Math.min(dist, 14);
    const nextX = cl(avgX + (dx / dist) * stepDist, 2, C - 2);
    const nextY = cl(avgY + (dy / dist) * stepDist, 2, R - 2);

    const inTrenchCount = squadMembers.filter((u) => u.tr).length;
    if (inTrenchCount > 0) {
      const isStuckOrAtEnd = squadMembers.every((u) => !u.path || !u.path.length);
      if (isStuckOrAtEnd) {
        squadMembers.forEach((member, k) => {
          member.exit = [cl(nextX, 0.5, C - 0.5), cl(nextY + (k - 2) * 1.2, 0.5, R - 0.5)];
          member.path = [];
        });
      }
      continue;
    }

    const isMovingOnGround = squadMembers.some((u) => !u.tr && Math.hypot(u.tx - u.x, u.ty - u.y) > 2.0);
    if (isMovingOnGround) continue;

    // En fase de asalto, se permite ocupar trincheras/bosques con mayor fuerza de asalto (hasta 4 escuadrones)
    const nearbyCover = findAvailableTrenchOrForestCover(p, nextX, nextY, coverOccupation, 14, true);

    if (nearbyCover && nearbyCover.isTrench) {
      const tX = Math.floor(nearbyCover.x);
      const tY = Math.floor(nearbyCover.y);
      orderTrench(squadMembers, tX, tY);
    } else if (nearbyCover) {
      squadMembers.forEach((member, k) => {
        member.auto = false;
        member.enter = false;
        member.tx = cl(nearbyCover.x + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
        member.ty = cl(nearbyCover.y + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
      });
    } else {
      squadMembers.forEach((member, k) => {
        member.auto = false;
        member.enter = false;
        member.tx = cl(nextX + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
        member.ty = cl(nextY + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
      });
    }

    // Reiniciar meta de asalto al completar
    if (sIndex === squads.length - 1) {
      p.assaultGoal = Math.floor(2 + Math.random() * 3);
    }
  }
}
