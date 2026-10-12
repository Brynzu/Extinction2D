import { CONFIG } from './config.js';
import { C, R, T, TC, TRL, isT, tt, v } from './map.js';
import { orderTrench, patrol } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';

function getEnemiesOf(p, players) {
  return players.filter((other) => other.id !== p.id && other.team !== p.team);
}

function getEnemyHQsOf(p, players) {
  return getEnemiesOf(p, players)
    .filter((e) => e.hq && e.hq.alive)
    .map((e) => e.hq);
}

import { areEnemies } from './combat.js';

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

function checkBorderCongestion() {
  let borderCount = 0;
  for (const u of U) {
    if (u.y < R * 0.20 || u.y > R * 0.80) {
      borderCount++;
    }
  }
  return borderCount >= Math.min(10, Math.max(6, U.length * 0.40));
}

export function updateAIDrones(p, players) {
  const aiDrones = U.filter((u) => (u.playerId === p.id || u.t === p.id) && u.isDrone);
  if (!aiDrones.length || !p.hq) return;

  const enemies = getEnemiesOf(p, players);
  const enemyUnits = U.filter((u) => enemies.some((e) => e.id === u.playerId || e.id === u.t));

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

  // Despliegue
  if (myUnits.length < CONFIG.GAME.MAX_UNITS_PER_SIDE) {
    const availableIndices = [];
    for (let i = 0; i < 4; i++) {
      if (p.cds[i] <= 0 && p.res >= CARDS[i].c && myUnits.length + CARDS[i].k <= CONFIG.GAME.MAX_UNITS_PER_SIDE) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length > 0) {
      const droneCardIndex = availableIndices.find((idx) => CARDS[idx].isDrone);
      const squadIndices = availableIndices.filter((idx) => !CARDS[idx].isDrone);

      let deployDrone = false;
      if (droneCardIndex !== undefined && myGroundUnits.length >= 8 && myDrones.length < p.droneSwarmGoal) {
        deployDrone = Math.random() < 0.65;
      }

      if (deployDrone && droneCardIndex !== undefined) {
        p.res -= CARDS[droneCardIndex].c;
        p.cds[droneCardIndex] = 2.5;
        deploy(p, droneCardIndex);
      } else if (squadIndices.length > 0) {
        const chosenIndex = squadIndices[Math.floor(Math.random() * squadIndices.length)];
        p.res -= CARDS[chosenIndex].c;
        p.cds[chosenIndex] = CARDS[chosenIndex].cd;
        deploy(p, chosenIndex);
      }
    }
  }

  updateAIDrones(p, players);
  aiTrench(p, players);
}

export function aiTrench(p, players) {
  if (!p || !p.hq) return;
  const myGroundUnits = U.filter((u) => (u.playerId === p.id || u.t === p.id) && !u.isDrone);
  if (!myGroundUnits.length) return;

  const strugglingAlly = findStrugglingAlly(p, players);
  const targetHQ = strugglingAlly ? strugglingAlly.hq : getClosestEnemyHQ(p, players, p.hq.x, p.hq.y);
  if (!targetHQ) return;

  // Agrupar unidades por escuadrón
  const squadsMap = new Map();
  for (const u of myGroundUnits) {
    const sId = u.squadId > 0 ? u.squadId : 0;
    if (!squadsMap.has(sId)) squadsMap.set(sId, []);
    squadsMap.get(sId).push(u);
  }

  const assignedTrenchCells = new Set();

  for (const [sId, squadMembers] of squadsMap.entries()) {
    if (squadMembers.some((u) => u.cb)) continue;

    const avgX = squadMembers.reduce((sum, u) => sum + u.x, 0) / squadMembers.length;
    const avgY = squadMembers.reduce((sum, u) => sum + u.y, 0) / squadMembers.length;

    let dx = targetHQ.x - avgX;
    let dy = targetHQ.y - avgY;

    // Si hay acumulación de unidades en los bordes superiores e inferiores, la IA decide atacar por el medio
    const isBorderCongested = checkBorderCongestion();
    if (isBorderCongested) {
      const centerY = R / 2 + ((sId % 3) - 1) * 6;
      dy = centerY - avgY;
    }

    const dist = Math.hypot(dx, dy) || 1;

    const stepDist = Math.min(dist, 12);
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

    const nearbyTrenchIdx = TRL.find((i) => {
      if (assignedTrenchCells.has(i)) return false;
      const tx = (i % C) + 0.5;
      const ty = Math.floor(i / C) + 0.5;
      return Math.hypot(tx - avgX, ty - avgY) < 14;
    });

    if (nearbyTrenchIdx !== undefined && Math.random() < 0.45) {
      assignedTrenchCells.add(nearbyTrenchIdx);
      const tX = (nearbyTrenchIdx % C) + 0.5;
      const tY = Math.floor(nearbyTrenchIdx / C) + 0.5;
      orderTrench(squadMembers, Math.floor(tX), Math.floor(tY));
    } else {
      squadMembers.forEach((member, k) => {
        member.auto = false;
        member.enter = false;
        member.tx = cl(nextX + ((k % 2) - 0.5) * 1.5, 0.5, C - 0.5);
        member.ty = cl(nextY + (Math.floor(k / 2) - 0.5) * 1.5, 0.5, R - 0.5);
      });
    }
  }
}
