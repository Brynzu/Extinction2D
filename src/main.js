import { ACTION_TYPES, executeGameAction, processActionLocally } from './actions.js';
import { aiPlay, aiTrench } from './ai.js';
import { clearBullets, updateCombat, vis } from './combat.js';
import { CONFIG } from './config.js';
import { camera, clampCamera, getBox, initInput } from './input.js';
import { C, R, T, isT, initMap, v } from './map.js';
import { createHost, disconnectNet, generateRoomCode, getIsHost, joinRoom, sendNetMessage } from './net.js';
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

// Multiplayer State
let isMultiplayer = false;
let isHost = false;
let currentRoomCode = '';
let mpLobbyPlayers = [];
let netSyncTimer = 0;
let myPlayerIdInGame = 1;

// Singleplayer settings
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
  const screenMpSelect = document.getElementById('screen-mp-select');
  const screenMpLobby = document.getElementById('screen-mp-lobby');
  const screenGame = document.getElementById('screen-game');

  const btnSingleplayer = document.getElementById('btn-singleplayer');
  const btnMultiplayer = document.getElementById('btn-multiplayer');

  // SP UI Elements
  const btnSpBack = document.getElementById('btn-sp-back');
  const btnSpStart = document.getElementById('btn-sp-start');
  const spMapEl = document.getElementById('sp-map');
  const spAiCountEl = document.getElementById('sp-ai-count');
  const lblAiCountEl = document.getElementById('lbl-ai-count');
  const spModeEl = document.getElementById('sp-mode');
  const playersListEl = document.getElementById('players-list');

  // MP Selection Elements
  const btnMpCreateRoom = document.getElementById('btn-mp-create-room');
  const btnMpJoinRoom = document.getElementById('btn-mp-join-room');
  const btnMpSelectBack = document.getElementById('btn-mp-select-back');
  const mpRoomCodeInput = document.getElementById('mp-room-code-input');
  const mpStatusMsg = document.getElementById('mp-status-msg');

  // MP Lobby Elements
  const mpLobbyCode = document.getElementById('mp-lobby-code');
  const mpHostSettings = document.getElementById('mp-host-settings');
  const mpMapEl = document.getElementById('mp-map');
  const mpPlayersListEl = document.getElementById('mp-players-list');
  const btnMpLobbyBack = document.getElementById('btn-mp-lobby-back');
  const btnMpStart = document.getElementById('btn-mp-start');

  // In-Game UI Elements
  const modalPause = document.getElementById('modal-pause');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnQuit = document.getElementById('btn-quit');

  const modalEnd = document.getElementById('modal-end');
  const btnEndReturn = document.getElementById('btn-end-return');
  const endTitleEl = document.getElementById('end-title');
  const endDescEl = document.getElementById('end-desc');

  function showScreen(screen) {
    [screenMain, screenSp, screenMpSelect, screenMpLobby, screenGame].forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }

  btnSingleplayer.onclick = () => {
    isMultiplayer = false;
    updatePlayersConfig();
    showScreen(screenSp);
  };

  btnMultiplayer.onclick = () => {
    isMultiplayer = true;
    mpStatusMsg.textContent = '';
    mpRoomCodeInput.value = '';
    showScreen(screenMpSelect);
  };

  btnMpSelectBack.onclick = () => {
    disconnectNet();
    showScreen(screenMain);
  };

  // --- MP HOST ROOM CREATION ---
  btnMpCreateRoom.onclick = async () => {
    isHost = true;
    currentRoomCode = generateRoomCode();
    mpStatusMsg.textContent = 'Creando sala...';

    try {
      await createHost(currentRoomCode, {
        onClientConnect: (conn) => {
          const newPlayerId = mpLobbyPlayers.length + 1;
          const defaultColors = ['red', 'green', 'yellow', 'purple', 'orange'];
          mpLobbyPlayers.push({
            id: newPlayerId,
            name: `Jugador ${newPlayerId}`,
            isHuman: true,
            team: newPlayerId % 2 === 1 ? 'A' : 'B',
            colorKey: defaultColors[(newPlayerId - 2) % defaultColors.length],
            peerConn: conn,
          });

          broadcastLobbyState();
          renderMpPlayersList();
        },
        onClientDisconnect: (conn) => {
          mpLobbyPlayers = mpLobbyPlayers.filter((p) => p.peerConn !== conn);
          broadcastLobbyState();
          renderMpPlayersList();
        },
        onData: (data) => {
          handleIncomingNetData(data);
        },
      });

      mpLobbyCode.textContent = currentRoomCode;
      mpHostSettings.style.display = 'block';
      btnMpStart.style.display = 'block';

      mpLobbyPlayers = [
        {
          id: 1,
          name: 'Tú (Host)',
          isHuman: true,
          team: 'A',
          colorKey: 'blue',
        },
      ];

      renderMpPlayersList();
      showScreen(screenMpLobby);
    } catch (err) {
      mpStatusMsg.textContent = 'Error al crear la sala. Reintenta.';
      console.error(err);
    }
  };

  // --- MP CLIENT JOIN ROOM ---
  btnMpJoinRoom.onclick = async () => {
    const code = mpRoomCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      mpStatusMsg.textContent = 'Ingresa un código válido de 4 caracteres.';
      return;
    }

    isHost = false;
    currentRoomCode = code;
    mpStatusMsg.textContent = 'Conectando con el Host...';

    try {
      await joinRoom(code, {
        onConnect: () => {
          mpStatusMsg.textContent = '¡Conectado!';
          mpLobbyCode.textContent = currentRoomCode;
          mpHostSettings.style.display = 'none';
          btnMpStart.style.display = 'none';
          showScreen(screenMpLobby);
        },
        onDisconnect: () => {
          alert('Se perdió la conexión con la sala.');
          disconnectNet();
          showScreen(screenMpSelect);
        },
        onData: (data) => {
          handleIncomingNetData(data);
        },
      });
    } catch (err) {
      mpStatusMsg.textContent = 'No se pudo conectar a la sala.';
      console.error(err);
    }
  };

  btnMpLobbyBack.onclick = () => {
    disconnectNet();
    showScreen(screenMpSelect);
  };

  btnMpStart.onclick = () => {
    if (!isHost) return;
    const playersConfig = mpLobbyPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: true,
      team: p.team,
      colorKey: p.colorKey,
    }));

    // Pre-inicializar mapa en Host para extraer T
    initMap(mpMapEl.value, playersConfig);

    const startAction = {
      type: ACTION_TYPES.START_GAME,
      data: {
        mapPreset: mpMapEl.value,
        playersConfig,
        gridT: Array.from(T),
      },
    };
    sendNetMessage(startAction);
    handleStartGameAction(startAction.data);
  };

  function broadcastLobbyState() {
    sendNetMessage({
      type: ACTION_TYPES.LOBBY_UPDATE,
      data: {
        players: mpLobbyPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          colorKey: p.colorKey,
        })),
        mapPreset: mpMapEl.value,
      },
    });
  }

  function renderMpPlayersList() {
    mpPlayersListEl.innerHTML = '';
    mpLobbyPlayers.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'player-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = p.name;

      if (isHost) {
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
          broadcastLobbyState();
        };

        // Selector de Equipo
        const teamSelect = document.createElement('select');
        teamSelect.className = 'player-select';
        [
          { val: 'A', label: 'Eq A' },
          { val: 'B', label: 'Eq B' },
          { val: 'C', label: 'Eq C' },
          { val: 'D', label: 'Eq D' },
        ].forEach((t) => {
          const opt = document.createElement('option');
          opt.value = t.val;
          opt.textContent = t.label;
          if (t.val === p.team) opt.selected = true;
          teamSelect.appendChild(opt);
        });
        teamSelect.onchange = () => {
          p.team = teamSelect.value;
          broadcastLobbyState();
        };

        row.appendChild(nameSpan);
        row.appendChild(colorSelect);
        row.appendChild(teamSelect);
      } else {
        const infoSpan = document.createElement('span');
        infoSpan.style.fontSize = '12px';
        infoSpan.style.color = 'var(--mut)';
        infoSpan.textContent = `Equipo ${p.team} (${CONFIG.COLORS[p.colorKey]?.name || p.colorKey})`;
        row.appendChild(nameSpan);
        row.appendChild(infoSpan);
      }

      mpPlayersListEl.appendChild(row);
    });
  }

  // --- SP UI EVENTS ---
  btnSpBack.onclick = () => {
    showScreen(screenMain);
  };

  spAiCountEl.oninput = () => {
    let val = parseInt(spAiCountEl.value, 10);
    const humanP = spSettings.playersConfig.find((p) => p.isHuman);
    const isSpectator = humanP && humanP.team === 'SPECTATOR';

    if (!isSpectator && val > 5) {
      val = 5;
      spAiCountEl.value = '5';
    }

    spSettings.aiCount = val;
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
      let defaultTeam = spSettings.mode === 'ffa' ? String.fromCharCode(65 + i) : i < half ? 'A' : 'B';

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
    spSettings.playersConfig.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'player-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = p.name + (p.isHuman ? ' (Tú)' : '');

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
        p.isSpectator = p.team === 'SPECTATOR';

        if (p.isHuman && !p.isSpectator && spSettings.aiCount > 5) {
          spSettings.aiCount = 5;
          spAiCountEl.value = '5';
          lblAiCountEl.textContent = '5';
          updatePlayersConfig();
        }
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
    startGame(spSettings.mapPreset, spSettings.playersConfig);
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
    if (isMultiplayer) disconnectNet();
    showScreen(screenMain);
  };

  btnEndReturn.onclick = () => {
    modalEnd.classList.remove('active');
    if (isMultiplayer) disconnectNet();
    showScreen(screenMain);
  };

  initInput(
    () => humanPlayer,
    () => gamePlayers,
    () => ({ isMultiplayer, isHost })
  );
}

function handleIncomingNetData(data) {
  if (!data || !data.type) return;

  switch (data.type) {
    case ACTION_TYPES.LOBBY_UPDATE: {
      if (!isHost) {
        mpLobbyPlayers = data.data.players;
        const mpPlayersListEl = document.getElementById('mp-players-list');
        if (mpPlayersListEl) {
          mpPlayersListEl.innerHTML = '';
          mpLobbyPlayers.forEach((p) => {
            const row = document.createElement('div');
            row.className = 'player-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = p.name;

            const infoSpan = document.createElement('span');
            infoSpan.style.fontSize = '12px';
            infoSpan.style.color = 'var(--mut)';
            infoSpan.textContent = `Equipo ${p.team} (${CONFIG.COLORS[p.colorKey]?.name || p.colorKey})`;

            row.appendChild(nameSpan);
            row.appendChild(infoSpan);
            mpPlayersListEl.appendChild(row);
          });
        }
      }
      break;
    }

    case ACTION_TYPES.START_GAME: {
      if (!isHost) {
        handleStartGameAction(data.data);
      }
      break;
    }

    case ACTION_TYPES.SYNC_FULL_STATE: {
      if (!isHost) {
        applyFullStateSync(data.data);
      }
      break;
    }

    default: {
      if (isHost) {
        processActionLocally(data, gamePlayers);
        sendNetMessage(data);
      } else {
        processActionLocally(data, gamePlayers);
      }
      break;
    }
  }
}

function handleStartGameAction({ mapPreset, playersConfig, gridT }) {
  const screenGame = document.getElementById('screen-game');
  [
    document.getElementById('screen-main'),
    document.getElementById('screen-sp'),
    document.getElementById('screen-mp-select'),
    document.getElementById('screen-mp-lobby'),
  ].forEach((s) => s.classList.remove('active'));
  screenGame.classList.add('active');
  resizeCanvas();

  let myPConfig = null;
  if (isMultiplayer) {
    if (isHost) {
      myPConfig = playersConfig[0];
    } else {
      myPConfig = playersConfig.find((p) => p.id === mpLobbyPlayers[mpLobbyPlayers.length - 1]?.id) || playersConfig[1];
    }
  }

  startGame(mapPreset, playersConfig, myPConfig, gridT);
}

function startGame(mapPreset, playersConfig, localHumanOverride = null, gridT = null) {
  gameActive = true;
  isPaused = false;
  U.length = 0;
  clearBullets();
  resetSquadCounter();

  const activeCombatants = playersConfig.filter((p) => p.team !== 'SPECTATOR' && !p.isSpectator);
  const totalActiveArmies = activeCombatants.length;
  const mapScale = totalActiveArmies >= 5 ? 2.0 : totalActiveArmies >= 3 ? 1.5 : 1.0;
  const cols = Math.round(CONFIG.GRID.COLUMNS * mapScale);
  const rows = Math.round(CONFIG.GRID.ROWS * mapScale);
  const hqPositions = CONFIG.getHQPositions(cols, rows);

  let activeIdx = 0;
  gamePlayers = playersConfig.map((p) => {
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

  humanPlayer = localHumanOverride
    ? gamePlayers.find((p) => p.id === localHumanOverride.id)
    : gamePlayers.find((p) => p.isHuman) || gamePlayers[0];

  myPlayerIdInGame = humanPlayer.id;

  initMap(mapPreset, gamePlayers, gridT);

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

function applyFullStateSync(data) {
  if (!data) return;

  if (data.v && data.v.length === v.length) {
    for (let i = 0; i < v.length; i++) {
      v[i] = data.v[i];
    }
  }

  if (data.players) {
    data.players.forEach((sp) => {
      const p = gamePlayers.find((gp) => gp.id === sp.id);
      if (p) {
        p.res = sp.res;
        p.cds = sp.cds;
        if (p.hq && sp.hq) {
          p.hq.hp = sp.hq.hp;
          p.hq.alive = sp.hq.alive;
        }
      }
    });
  }

  // Preservar la selección local 'u.s' de las unidades al actualizar sus atributos desde el Host
  if (data.units) {
    const prevSelections = new Map();
    U.forEach((u, idx) => {
      if (u.s) prevSelections.set(idx, true);
    });

    if (data.units.length === U.length) {
      // Actualización directa in-place para no perder referencias
      data.units.forEach((su, i) => {
        const u = U[i];
        u.x = su.x;
        u.y = su.y;
        u.tx = su.tx;
        u.ty = su.ty;
        u.hp = su.hp;
        u.mh = su.mh;
        u.tr = su.tr;
        u.path = su.path || [];
        u.seen = su.seen;
      });
    } else {
      // Reconstrucción solo cuando cambia el conteo de unidades (al morir o aparecer)
      U.length = 0;
      data.units.forEach((su, i) => {
        U.push({
          ...su,
          s: prevSelections.has(i) && (su.playerId === myPlayerIdInGame || su.t === myPlayerIdInGame),
          path: su.path || [],
        });
      });
    }
  }
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

  const enemyPlayers = gamePlayers.filter((p) => p.team !== humanTeam);
  const aliveEnemyHQs = enemyPlayers.filter((p) => p.hq && p.hq.alive);
  const aliveEnemyUnits = U.filter((u) => enemyPlayers.some((p) => p.id === (u.playerId || u.t)));

  if (humanTeamPct >= 0.65 || (aliveEnemyHQs.length === 0 && aliveEnemyUnits.length === 0)) {
    endGame(true, humanTeamPct >= 0.65 ? '¡Tu equipo domina más del 65% del territorio!' : '¡Has destruido a todas las fuerzas enemigas!');
    return;
  }

  for (const [team, count] of teamTerritory.entries()) {
    if (team !== humanTeam && count / totalCells >= 0.65) {
      endGame(false, `El equipo ${team} ha conquistado más del 65% del territorio.`);
      return;
    }
  }

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

      if (!p.isHuman && (!isMultiplayer || isHost)) {
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

    updateCombat(dt, gamePlayers, isMultiplayer && !isHost);

    for (let i = U.length - 1; i >= 0; i--) {
      if (U[i].hp <= 0) U.splice(i, 1);
    }

    if (isMultiplayer && isHost) {
      netSyncTimer += dt;
      if (netSyncTimer >= 0.2) {
        netSyncTimer = 0;
        sendNetMessage({
          type: ACTION_TYPES.SYNC_FULL_STATE,
          data: {
            v: Array.from(v),
            players: gamePlayers.map((p) => ({
              id: p.id,
              res: p.res,
              cds: p.cds,
              hq: p.hq ? { hp: p.hq.hp, alive: p.hq.alive } : null,
            })),
            units: U.map((u) => ({
              playerId: u.playerId,
              t: u.t,
              x: u.x,
              y: u.y,
              tx: u.tx,
              ty: u.ty,
              hp: u.hp,
              mh: u.mh,
              sp: u.sp,
              isDrone: u.isDrone,
              squadId: u.squadId,
              role: u.role,
              tr: u.tr,
              path: u.path,
              seen: u.seen,
            })),
          },
        });
      }
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
