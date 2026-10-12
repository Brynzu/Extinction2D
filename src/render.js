import { B, canSee, explosions } from './combat.js';
import { CONFIG } from './config.js';
import { camera } from './input.js';
import { C, R, S, T, deep, v } from './map.js';
import { sounds } from './sound.js';
import { CARDS, U, deploy } from './units.js';

export const cv = document.getElementById('c');
export const g = cv.getContext('2d');

export function resizeCanvas() {
  const main = document.querySelector('main');
  if (main) {
    cv.width = Math.min(window.innerWidth - 20, 800);
    cv.height = Math.min(window.innerHeight - 180, 500);
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

export const hint = document.getElementById('hint');
export const HINT = hint.textContent;
export const cardsEl = document.getElementById('cards');
export const rf = document.getElementById('rf');
export const rn = document.getElementById('rn');
export const pbEl = document.getElementById('pb');
export const prEl = document.getElementById('pr');
export const territoryBarEl = document.getElementById('territory-bar');

let msgTimeout = null;

export function msg(t) {
  hint.textContent = t;
  clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => (hint.textContent = HINT), 2200);
}

export function initCardsUI(humanPlayer) {
  cardsEl.innerHTML = '';
  CARDS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = '<b>' + c.n + '</b>×' + c.k + ' · costo ' + c.c + '<div class="cd"></div>';
    b.onclick = () => {
      sounds.init();
      if (!humanPlayer || !humanPlayer.hq || !humanPlayer.hq.alive) {
        return msg('Tu HQ ha sido destruido. No puedes desplegar más refuerzos.');
      }
      if (humanPlayer.cds[i] > 0) return msg('Esa carta se está recargando.');
      if (humanPlayer.res < c.c) return msg('Recurso insuficiente.');
      humanPlayer.res -= c.c;
      humanPlayer.cds[i] = c.cd;
      deploy(humanPlayer, i);
      sounds.playDeploy();
      msg('Refuerzos desplegados.');
    };
    cardsEl.appendChild(b);
  });
}

export function ui(humanPlayer) {
  if (!humanPlayer) return;
  rf.style.width = humanPlayer.res * 10 + '%';
  rn.textContent = Math.floor(humanPlayer.res);
  [...cardsEl.children].forEach((b, i) => {
    const c = CARDS[i];
    b.classList.toggle('off', humanPlayer.cds[i] > 0 || humanPlayer.res < c.c);
    b.classList.toggle('sel', humanPlayer.sel === i);
    b.lastChild.style.height = (humanPlayer.cds[i] / c.cd) * 100 + '%';
  });
}

export function draw(humanPlayer, players = [], box = null) {
  g.clearRect(0, 0, cv.width, cv.height);

  g.save();
  g.scale(camera.zoom, camera.zoom);
  g.translate(-camera.x, -camera.y);

  // Fondo
  g.fillStyle = '#4a5340';
  g.fillRect(0, 0, C * S, R * S);

  // Mapeo de jugadores
  const playerMap = new Map();
  players.forEach((p) => playerMap.set(p.id, p));

  // Recuento de territorio por jugador y equipo
  const territoryCounts = new Map();
  const teamTerritoryCounts = new Map();
  players.forEach((p) => {
    territoryCounts.set(p.id, 0);
    teamTerritoryCounts.set(p.team, 0);
  });

  const isSpectator = humanPlayer && (humanPlayer.team === 'SPECTATOR' || humanPlayer.isSpectator);

  // 1. Renderizar Territorio Conquistado
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const pId = Math.round(v[y * C + x]);
      if (pId > 0 && playerMap.has(pId)) {
        const p = playerMap.get(pId);
        territoryCounts.set(pId, (territoryCounts.get(pId) || 0) + 1);
        teamTerritoryCounts.set(p.team, (teamTerritoryCounts.get(p.team) || 0) + 1);

        // El color de conquista del terreno SOLO se pinta en Modo Espectador o dentro de la línea de visión
        const inVision = canSee(x + 0.5, y + 0.5, humanPlayer, players);
        if (isSpectator || inVision) {
          const teamCol = CONFIG.TEAM_COLORS[p.team] || CONFIG.COLORS.blue;
          g.fillStyle = teamCol.main + '40'; // 25% opacidad
          g.fillRect(x * S, y * S, S, S);
        }
      }
    }
  }

  // 2. Trincheras
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const k = T[y * C + x];
      if (k >= 3) {
        g.fillStyle = k === 3 ? '#96724E' : '#4A3525';
        g.fillRect(x * S, y * S, S, S);
      }
    }
  }

  // 3. Renderizar Troncos de Árboles (por debajo de las unidades)
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (T[y * C + x] === 1) {
        g.fillStyle = '#5a4631';
        g.beginPath();
        g.arc((x + 0.5) * S, (y + 0.5) * S, S * 0.12, 0, 7);
        g.fill();
      }
    }
  }

  // 4. Renderizar HQs
  players.forEach((p) => {
    if (!p.hq) return;
    const isEnemyHQ = humanPlayer && p.team !== humanPlayer.team;
    if (isEnemyHQ && !isSpectator && !canSee(p.hq.x, p.hq.y, humanPlayer, players)) {
      return;
    }

    const hqX = p.hq.x * S;
    const hqY = p.hq.y * S;
    const col = CONFIG.COLORS[p.colorKey] || CONFIG.COLORS.blue;

    if (p.hq.alive) {
      g.fillStyle = col.main;
      g.fillRect(hqX - 25, hqY - 25, 50, 50);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.strokeRect(hqX - 25, hqY - 25, 50, 50);

      // Barra de vida del HQ
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(hqX - 25, hqY - 35, 50, 6);
      g.fillStyle = col.light;
      g.fillRect(hqX - 25, hqY - 35, (50 * p.hq.hp) / p.hq.maxHp, 6);

      g.fillStyle = '#ffffff';
      g.font = 'bold 10px sans-serif';
      g.textAlign = 'center';
      g.fillText(p.name, hqX, hqY + 4);
    } else {
      // HQ destruido
      g.fillStyle = '#2a2a2a';
      g.fillRect(hqX - 25, hqY - 25, 50, 50);
      g.strokeStyle = '#666';
      g.lineWidth = 2;
      g.strokeRect(hqX - 25, hqY - 25, 50, 50);
      g.fillStyle = '#888';
      g.font = 'bold 10px sans-serif';
      g.textAlign = 'center';
      g.fillText(p.name + ' (DESTRUIDO)', hqX, hqY + 4);
    }
  });

  // 5. Renderizar Tropas Terrestres (Infantería) - debajo de las copas de los árboles
  for (const u of U) {
    if (u.isDrone) continue;
    const uPid = u.playerId || u.t;
    const p = playerMap.get(uPid) || { colorKey: 'blue', team: 'A' };
    const col = CONFIG.COLORS[p.colorKey] || CONFIG.COLORS.blue;
    const isEnemy = humanPlayer && p.team !== humanPlayer.team;

    if (isEnemy && !isSpectator && !canSee(u.x, u.y, humanPlayer, players)) {
      continue;
    }

    if (u.s) {
      g.strokeStyle = '#fff';
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(u.tx * S, u.ty * S, 5, 0, 7);
      g.stroke();
      g.setLineDash([]);
    }

    const drawRadius = S * CONFIG.UNITS.DRAW_RADIUS;
    g.fillStyle = col.light;
    g.strokeStyle = u.s ? '#fff' : col.dark;
    g.lineWidth = u.s ? 3 : 2;
    g.globalAlpha = deep(u) ? 0.6 : 1;
    g.beginPath();
    g.arc(u.x * S, u.y * S, drawRadius, 0, 7);
    g.fill();
    g.stroke();
    g.globalAlpha = 1;

    // Barra de vida
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(u.x * S - 6, u.y * S + 7, 12, 3);
    g.fillStyle = col.main;
    g.fillRect(u.x * S - 6, u.y * S + 7, (12 * u.hp) / u.mh, 3);
  }

  // Renderizar Explosiones
  for (const ex of explosions) {
    const alpha = ex.l / ex.maxL;
    const radius = S * 1.8 * (1 - alpha * 0.5);
    g.fillStyle = `rgba(255, 120, 30, ${alpha})`;
    g.beginPath();
    g.arc(ex.x * S, ex.y * S, radius, 0, 7);
    g.fill();
  }

  // Renderizar Balas
  g.lineWidth = CONFIG.COMBAT.BULLET_WIDTH;
  g.lineCap = 'round';
  for (const bullet of B) {
    const bPid = bullet.playerId || bullet.t;
    if (humanPlayer && bPid !== humanPlayer.id && !canSee(bullet.x, bullet.y, humanPlayer, players)) continue;
    const p = playerMap.get(bPid) || { colorKey: 'blue' };
    const col = CONFIG.COLORS[p.colorKey] || CONFIG.COLORS.blue;
    const offY = bullet.offsetY || 0;
    g.strokeStyle = col.light;
    g.beginPath();
    g.moveTo((bullet.x - bullet.vx * 0.03) * S, (bullet.y + offY - bullet.vy * 0.03) * S);
    g.lineTo(bullet.x * S, (bullet.y + offY) * S);
    g.stroke();
  }

  // 6. Renderizar Copas de Árboles (por encima de tropas terrestres y balas, pero debajo de drones)
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (T[y * C + x] === 1) {
        g.globalAlpha = 0.88;
        g.fillStyle = '#2f5a2c';
        g.beginPath();
        g.arc((x + 0.5) * S, (y + 0.5) * S, S * 0.42, 0, 7);
        g.fill();
        g.fillStyle = '#4a8a44';
        g.beginPath();
        g.arc((x + 0.4) * S, (y + 0.4) * S, S * 0.2, 0, 7);
        g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  // 7. Renderizar Unidades Aéreas (Drones) - por encima de las copas de los árboles
  for (const u of U) {
    if (!u.isDrone) continue;
    const uPid = u.playerId || u.t;
    const p = playerMap.get(uPid) || { colorKey: 'blue', team: 'A' };
    const col = CONFIG.COLORS[p.colorKey] || CONFIG.COLORS.blue;
    const isEnemy = humanPlayer && p.team !== humanPlayer.team;

    if (isEnemy && !isSpectator && !canSee(u.x, u.y, humanPlayer, players)) {
      continue;
    }

    if (u.s) {
      g.strokeStyle = '#fff';
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(u.tx * S, u.ty * S, 5, 0, 7);
      g.stroke();
      g.setLineDash([]);
    }

    g.save();
    g.translate(u.x * S, u.y * S);
    g.fillStyle = col.light;
    g.strokeStyle = u.s ? '#fff' : col.dark;
    g.lineWidth = u.s ? 2.5 : 1.5;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(7, 7);
    g.lineTo(-7, 7);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // Recuadro de Selección
  if (box) {
    const bx = Math.min(box[0], box[2]) * S;
    const by = Math.min(box[1], box[3]) * S;
    const bw = Math.abs(box[2] - box[0]) * S;
    const bh = Math.abs(box[3] - box[1]) * S;
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.setLineDash([4, 3]);
    g.strokeRect(bx, by, bw, bh);
    g.setLineDash([]);
  }

  g.restore();

  // Renderizar Minimapa
  drawMinimap(playerMap, humanPlayer, players);

  // Actualizar UI del territorio superior por EQUIPO
  const totalCells = C * R;
  let myTeamPct = 0;
  let enemyPct = 0;

  let barHtml = '';
  const renderedTeams = new Set();

  players.forEach((p) => {
    if (p.team === 'SPECTATOR') return;
    if (renderedTeams.has(p.team)) return;
    renderedTeams.add(p.team);

    const teamCount = teamTerritoryCounts.get(p.team) || 0;
    const pct = Math.round((teamCount / totalCells) * 100);
    const teamCol = CONFIG.TEAM_COLORS[p.team] || CONFIG.COLORS.blue;

    barHtml += `<i style="background:${teamCol.main};width:${pct}%" title="Equipo ${p.team}: ${pct}%"></i>`;

    if (humanPlayer && p.team === humanPlayer.team && !isSpectator) {
      myTeamPct = pct;
    } else {
      enemyPct += pct;
    }
  });

  territoryBarEl.innerHTML = barHtml;
  if (isSpectator) {
    const teamsList = Array.from(renderedTeams);
    const teamA = teamsList[0] || 'A';
    const teamBPct = teamTerritoryCounts.get(teamsList[1]) || 0;
    const teamAPct = Math.round(((teamTerritoryCounts.get(teamA) || 0) / totalCells) * 100);
    const otherPct = Math.round((teamBPct / totalCells) * 100);

    pbEl.textContent = `Eq ${teamA} ${teamAPct}%`;
    prEl.textContent = `Otros ${100 - teamAPct}%`;
  } else {
    pbEl.textContent = `Tú (Eq ${humanPlayer ? humanPlayer.team : 'A'}) ${myTeamPct}%`;
    prEl.textContent = `Enemigos ${enemyPct}%`;
  }
}

function drawMinimap(playerMap, humanPlayer, players) {
  const mw = 140;
  const mh = 90;
  const mx = cv.width - mw - 10;
  const my = 10;

  g.fillStyle = 'rgba(21, 24, 26, 0.85)';
  g.fillRect(mx, my, mw, mh);
  g.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  g.lineWidth = 1;
  g.strokeRect(mx, my, mw, mh);

  const scaleX = mw / (C * S);
  const scaleY = mh / (R * S);
  const isSpectator = humanPlayer && (humanPlayer.team === 'SPECTATOR' || humanPlayer.isSpectator);

  for (const u of U) {
    const uPid = u.playerId || u.t;
    const p = playerMap.get(uPid) || { colorKey: 'blue', team: 'A' };
    const isEnemy = humanPlayer && p.team !== humanPlayer.team;

    if (isEnemy && !isSpectator && !canSee(u.x, u.y, humanPlayer, players)) {
      continue;
    }

    const col = CONFIG.COLORS[p.colorKey] || CONFIG.COLORS.blue;
    g.fillStyle = col.main;
    g.fillRect(mx + u.x * S * scaleX - 1, my + u.y * S * scaleY - 1, 3, 3);
  }

  const viewW = (cv.width / camera.zoom) * scaleX;
  const viewH = (cv.height / camera.zoom) * scaleY;
  const viewX = mx + camera.x * scaleX;
  const viewY = my + camera.y * scaleY;

  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.strokeRect(viewX, viewY, viewW, viewH);
}
