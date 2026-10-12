import { aiPlay, aiTrench } from './ai.js';
import { clearBullets, updateCombat, vis } from './combat.js';
import { CONFIG } from './config.js';
import { camera, clampCamera, getBox, initInput } from './input.js';
import { C, R, T, isT, initMap, v } from './map.js';
import { cv, draw, initCardsUI, resizeCanvas, ui } from './render.js';
import { bfs, postTick, wpt } from './trenches.js';
import { U, addUnit, cl, resetSquadCounter, sep } from './units.js';

// Global Game State
let gamePlayers = [];
let humanPlayer = null;
let gameActive = false;
let isPaused = false;
let animationFrameId = null;
let lastTime = performance.now();
let pt = 0;

// Configuración por defecto de la pantalla Un Jugador
const spSettings = {
  mapPreset: 'default',
  aiCount: 1,
  mode: 'teams',
  playersConfig: [],
};

const COLOR_KEYS = Object.keys(CONFIG.COLORS);

function setupMenuUI() {
  const screenMain = document.getElementById('screen-main');
  const screenSp = document.getElementById('screen-sp');
  const screenGame = document.getElementById('screen-game');

  const btnSingleplayer = document.getElementById('btn-singleplayer');
  const btnSpBack = document.getElementById('btn-sp-back');
  const btnSpStart = document.getElementById('btn-sp-start');

  const spMapEl = document.getElementById('sp-map');
  const spAiCountEl = document.getElementById('sp-ai-count');
  const lblAiCountEl = document.getElementById('lbl-ai-count');
  const spModeEl = document.getElementById('sp-mode');
  const playersListEl = document.getElementById('players-list');

  const modalPause = document.getElementById('modal-pause');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnQuit = document.getElementById('btn-quit');

  const modalEnd = document.getElementById('modal-end');
  const btnEndReturn = document.getElementById('btn-end-return');
  const endTitleEl = document.getElementById('end-title');
  const endDescEl = document.getElementById('end-desc');

  function showScreen(screen) {
    [screenMain, screenSp, screenGame].forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }

  btnSingleplayer.onclick = () => {
    updatePlayersConfig();
    showScreen(screenSp);
  };

  btnSpBack.onclick = () => {
    showScreen(screenMain);
  };

  spAiCountEl.oninput = () => {
    spSettings.aiCount = parseInt(spAiCountEl.value, 10);
    lblAiCountEl.textContent = spSettings.aiCount;
    updatePlayersConfig();
  };

  spModeEl.onchange = () => {
    spSettings.mode = spModeEl.value;
    updatePlayersConfig();
  };

  spMapEl.onchange = () => {
    spSettings.mapPreset = spMapEl.value;
  };

  function updatePlayersConfig() {
    const totalPlayers = 1 + spSettings.aiCount;
    spSettings.playersConfig = [];

    // Jugador principal
    spSettings.playersConfig.push({
      id: 1,
      name: 'Tú',
      isHuman: true,
      team: 'A',
      colorKey: 'blue',
    });

    const defaultColors = ['red', 'green', 'yellow', 'purple', 'orange'];

    const half = Math.ceil(totalPlayers / 2);

    for (let i = 1; i < totalPlayers; i++) {
      let defaultTeam = 'B';
      if (spSettings.mode === 'ffa') {
        defaultTeam = String.fromCharCode(65 + i); // A, B, C, D, E...
      } else {
        // 'teams'
        defaultTeam = i < half ? 'A' : 'B';
      }

      spSettings.playersConfig.push({
        id: i + 1,
        name: `IA ${i}`,
        isHuman: false,
        team: defaultTeam,
        colorKey: defaultColors[(i - 1) % defaultColors.length],
      });
    }

    renderPlayersList();
  }

  function renderPlayersList() {
    playersListEl.innerHTML = '';
    spSettings.playersConfig.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'player-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = p.name + (p.isHuman ? ' (Tú)' : '');

      // Selector de Color
      const colorSelect = document.createElement('select');
      colorSelect.className = 'player-select';
      COLOR_KEYS.forEach((ck) => {
        const opt = document.createElement('option');
        opt.value = ck;
        opt.textContent = CONFIG.COLORS[ck].name;
        if (ck === p.colorKey) opt.selected = true;
        colorSelect.appendChild(opt);
      });
      colorSelect.onchange = () => {
        p.colorKey = colorSelect.value;
      };

      // Selector de Equipo
      const teamSelect = document.createElement('select');
      teamSelect.className = 'player-select';
      [
        { val: 'A', label: 'Eq A' },
        { val: 'B', label: 'Eq B' },
        { val: 'C', label: 'Eq C' },
        { val: 'D', label: 'Eq D' },
        { val: 'E', label: 'Eq E' },
        { val: 'F', label: 'Eq F' },
        { val: 'SPECTATOR', label: 'Espectador' },
      ].forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.val;
        opt.textContent = t.label;
        if (t.val === p.team) opt.selected = true;
        teamSelect.appendChild(opt);
      });
      teamSelect.onchange = () => {
        p.team = teamSelect.value;
        if (p.team === 'SPECTATOR') p.isSpectator = true;
        else p.isSpectator = false;
      };

      row.appendChild(nameSpan);
      row.appendChild(colorSelect);
      row.appendChild(teamSelect);
      playersListEl.appendChild(row);
    });
  }

  btnSpStart.onclick = () => {
    showScreen(screenGame);
    resizeCanvas();
    startGame();
  };

  btnPause.onclick = () => {
    isPaused = true;
    modalPause.classList.add('active');
  };

  btnResume.onclick = () => {
    isPaused = false;
    modalPause.classList.remove('active');
  };

  btnQuit.onclick = () => {
    gameActive = false;
    isPaused = false;
    modalPause.classList.remove('active');
    showScreen(screenSp);
  };

  btnEndReturn.onclick = () => {
    modalEnd.classList.remove('active');
    showScreen(screenSp);
  };

  // Inicializar inputs
  initInput(() => humanPlayer, () => gamePlayers);
}

function startGame() {
  gameActive = true;
  isPaused = false;
  U.length = 0;
  clearBullets();
  resetSquadCounter();

  humanPlayer = spSettings.playersConfig.find((p) => p.isHuman) || spSettings.playersConfig[0];
  const activeCombatants = spSettings.playersConfig.filter((p) => p.team !== 'SPECTATOR');

  // Calcular escala de mapa y posiciones de HQ según los combatientes activos
  const totalActiveArmies = activeCombatants.length;
  const mapScale = totalActiveArmies >= 5 ? 2.0 : totalActiveArmies >= 3 ? 1.5 : 1.0;
  const cols = Math.round(CONFIG.GRID.COLUMNS * mapScale);
  const rows = Math.round(CONFIG.GRID.ROWS * mapScale);
  const hqPositions = CONFIG.getHQPositions(cols, rows);

  let activeIdx = 0;
  gamePlayers = spSettings.playersConfig.map((p) => {
    const isSpectator = p.team === 'SPECTATOR';
    const pos = !isSpectator && hqPositions[activeIdx] ? hqPositions[activeIdx++] : null;
    return {
      ...p,
      res: CONFIG.GAME.INITIAL_RESOURCES,
      cds: [0, 0, 0, 0],
      sel: -1,
      aiTm: 2 + Math.random() * 2,
      aiGt: 3,
      hq: pos
        ? {
            x: pos.hq.x,
            y: pos.hq.y,
            spawnX: pos.spawn.x,
            spawnY: pos.spawn.y,
            hp: CONFIG.HQ_MAX_HP,
            maxHp: CONFIG.HQ_MAX_HP,
            alive: true,
          }
        : null,
    };
  });

  humanPlayer = gamePlayers.find((p) => p.isHuman) || gamePlayers[0];

  initMap(spSettings.mapPreset, gamePlayers);

  // Inicializar tropas solo para jugadores combatientes activos
  const roles = ['leader', 'machinegunner', 'grenadier', 'rifleman', 'rifleman'];
  gamePlayers.forEach((p) => {
    if (p.team === 'SPECTATOR' || !p.hq) return;
    for (let i = 0; i < 5; i++) {
      addUnit(
        p.id,
        p.hq.x + ((i % 2) - 0.5) * 1.2,
        p.hq.y + (Math.floor(i / 2) - 0.5) * 1.2,
        p.hq.x + ((i % 2) - 0.5) * 1.2,
        p.hq.y + (Math.floor(i / 2) - 0.5) * 1.2,
        false,
        p.id,
        roles[i]
      );
    }
  });

  initCardsUI(humanPlayer);

  // Centrar cámara en el HQ del jugador principal o en el centro si es espectador
  if (humanPlayer && humanPlayer.hq) {
    camera.x = humanPlayer.hq.x * CONFIG.GRID.CELL_SIZE - cv.width / (2 * camera.zoom);
    camera.y = humanPlayer.hq.y * CONFIG.GRID.CELL_SIZE - cv.height / (2 * camera.zoom);
    clampCamera();
  } else {
    camera.x = (cols * CONFIG.GRID.CELL_SIZE) / 2 - cv.width / (2 * camera.zoom);
    camera.y = (rows * CONFIG.GRID.CELL_SIZE) / 2 - cv.height / (2 * camera.zoom);
    clampCamera();
  }

  lastTime = performance.now();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(step);
}

function checkVictoryDefeat() {
  if (!gameActive || !humanPlayer) return;

  const totalCells = C * R;
  const teamTerritory = new Map();

  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const pId = Math.round(v[y * C + x]);
      if (pId > 0) {
        const p = gamePlayers.find((gp) => gp.id === pId);
        if (p) {
          teamTerritory.set(p.team, (teamTerritory.get(p.team) || 0) + 1);
        }
      }
    }
  }

  // Si se está en Modo Espectador
  if (humanPlayer.team === 'SPECTATOR' || humanPlayer.isSpectator) {
    for (const [team, count] of teamTerritory.entries()) {
      if (team !== 'SPECTATOR' && count / totalCells >= 0.65) {
        endGame(true, `El Equipo ${team} ha conquistado más del 65% del territorio.`);
        return;
      }
    }
    const combatantTeams = new Set(gamePlayers.filter((p) => p.team !== 'SPECTATOR' && p.hq && p.hq.alive).map((p) => p.team));
    if (combatantTeams.size === 1) {
      const winningTeam = Array.from(combatantTeams)[0];
      endGame(true, `El Equipo ${winningTeam} ha eliminado a todos sus rivales.`);
      return;
    }
    return;
  }

  const humanTeam = humanPlayer.team;
  const humanTeamPct = (teamTerritory.get(humanTeam) || 0) / totalCells;

  // Comprobar HQs enemigas vivas
  const enemyPlayers = gamePlayers.filter((p) => p.team !== humanTeam);
  const aliveEnemyHQs = enemyPlayers.filter((p) => p.hq && p.hq.alive);
  const aliveEnemyUnits = U.filter((u) => enemyPlayers.some((p) => p.id === (u.playerId || u.t)));

  // Victoria: control >= 65% territorio O destrucción de todas las HQs enemigas y tropas enemigas
  if (humanTeamPct >= 0.65 || (aliveEnemyHQs.length === 0 && aliveEnemyUnits.length === 0)) {
    endGame(true, humanTeamPct >= 0.65 ? '¡Tu equipo domina más del 65% del territorio!' : '¡Has destruido a todas las fuerzas enemigas!');
    return;
  }

  // Comprobar si otra facción domina >= 65%
  for (const [team, count] of teamTerritory.entries()) {
    if (team !== humanTeam && count / totalCells >= 0.65) {
      endGame(false, `El equipo ${team} ha conquistado más del 65% del territorio.`);
      return;
    }
  }

  // Derrota: HQ propio destruido y sin unidades vivas
  const humanUnits = U.filter((u) => u.playerId === humanPlayer.id || u.t === humanPlayer.id);
  if ((!humanPlayer.hq || !humanPlayer.hq.alive) && humanUnits.length === 0) {
    endGame(false, 'Tu base principal ha sido destruida y tus tropas han caído.');
  }
}

function endGame(victory, reason) {
  gameActive = false;
  const modalEnd = document.getElementById('modal-end');
  const endTitleEl = document.getElementById('end-title');
  const endDescEl = document.getElementById('end-desc');

  endTitleEl.textContent = victory ? '¡VICTORIA!' : '¡DERROTA!';
  endTitleEl.style.color = victory ? 'var(--bl)' : 'var(--rd)';
  endDescEl.textContent = reason;
  modalEnd.classList.add('active');
}

function step(now) {
  if (!gameActive) return;

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!isPaused) {
    // Recursos
    const totalCells = C * R;
    const playerTerritory = new Map();
    for (let y = 0; y < R; y++) {
      for (let x = 0; x < C; x++) {
        const pId = Math.round(v[y * C + x]);
        if (pId > 0) playerTerritory.set(pId, (playerTerritory.get(pId) || 0) + 1);
      }
    }

    gamePlayers.forEach((p) => {
      const terr = playerTerritory.get(p.id) || 0;
      const rate = CONFIG.GAME.RESOURCE_BASE_RATE + (CONFIG.GAME.RESOURCE_TERRITORY_RATE * terr) / totalCells;
      p.res = Math.min(CONFIG.GAME.MAX_RESOURCES, p.res + dt * rate);

      for (let i = 0; i < 4; i++) {
        p.cds[i] = Math.max(0, p.cds[i] - dt);
      }

      // IA Turnos
      if (!p.isHuman) {
        p.aiTm -= dt;
        if (p.aiTm <= 0) {
          p.aiTm = CONFIG.AI.PLAY_CHECK_INTERVAL_MIN + Math.random() * CONFIG.AI.PLAY_CHECK_INTERVAL_RANGE;
          aiPlay(p, gamePlayers);
        }

        p.aiGt -= dt;
        if (p.aiGt <= 0) {
          p.aiGt = CONFIG.AI.TRENCH_CHECK_INTERVAL;
          aiTrench(p, gamePlayers);
        }
      }
    });

    vis(dt, gamePlayers);
    sep();

    pt -= dt;
    if (pt <= 0) {
      pt = 0.5;
      postTick(U);
    }

    for (const u of U) {
      if (u.tr) {
        if (Math.hypot(u.tx - u.x, u.ty - u.y) < 0.5) {
          if (u.path.length) {
            const p = u.path.shift();
            u.tx = p[0];
            u.ty = p[1];
          } else if (u.exit) {
            u.tr = false;
            u.tx = u.exit[0];
            u.ty = u.exit[1];
            u.exit = null;
          }
        }
      } else if (u.enter && Math.hypot(u.tx - u.x, u.ty - u.y) < 0.5 && isT(Math.floor(u.x), Math.floor(u.y))) {
        u.tr = true;
        u.enter = false;
        u.path = u.gc ? bfs(Math.floor(u.x), Math.floor(u.y), (a, b) => a === u.gc[0] && b === u.gc[1]) || [] : [];
        u.gc = null;
      }

      const mt = u.tr || u.isDrone ? [u.tx, u.ty] : wpt(u);
      const dx = mt[0] - u.x;
      const dy = mt[1] - u.y;
      const d = Math.hypot(dx, dy);

      if (d > 0.08) {
        const speed = CONFIG.UNITS.SPEED_BLUE;
        const trenchMult = u.tr ? CONFIG.UNITS.TRENCH_SPEED_MULT : 1.0;
        const m = Math.min(d, speed * u.sp * trenchMult * (u.cb ? CONFIG.UNITS.COMBAT_SPEED_MULT : 1) * dt);
        const px = u.x + (dx / d) * m;
        const py = u.y + (dy / d) * m;
        const ok = (a, b) =>
          u.isDrone
            ? true
            : u.tr
            ? isT(Math.floor(a), Math.floor(b))
            : !isT(Math.floor(a), Math.floor(b)) ||
              isT(Math.floor(u.x), Math.floor(u.y)) ||
              (u.enter && Math.floor(a) === Math.floor(u.tx) && Math.floor(b) === Math.floor(u.ty));

        if (ok(px, py)) {
          u.x = px;
          u.y = py;
        } else if (ok(px, u.y)) {
          u.x = px;
        } else if (ok(u.x, py)) {
          u.y = py;
        }
      }

      // Los drones no capturan territorio
      if (!u.isDrone) {
        const uPid = u.playerId || u.t;
        const r = CONFIG.GAME.TERRITORY_PUSH_RADIUS;
        for (let j = Math.max(0, Math.floor(u.y - r)); j <= Math.min(R - 1, Math.floor(u.y + r)); j++) {
          for (let i = Math.max(0, Math.floor(u.x - r)); i <= Math.min(C - 1, Math.floor(u.x + r)); i++) {
            if (Math.hypot(i + 0.5 - u.x, j + 0.5 - u.y) <= r) {
              v[j * C + i] = uPid;
            }
          }
        }
      }
    }

    updateCombat(dt, gamePlayers);

    // Eliminar unidades sin vida
    for (let i = U.length - 1; i >= 0; i--) {
      if (U[i].hp <= 0) U.splice(i, 1);
    }

    checkVictoryDefeat();
  }

  ui(humanPlayer);
  draw(humanPlayer, gamePlayers, getBox());

  if (gameActive) {
    animationFrameId = requestAnimationFrame(step);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', setupMenuUI);
} else {
  setupMenuUI();
}
