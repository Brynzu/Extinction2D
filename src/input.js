import { ACTION_TYPES, executeGameAction } from './actions.js';
import { areEnemies } from './combat.js';
import { CONFIG } from './config.js';
import { C, R, S, T, isT } from './map.js';
import { cv, msg } from './render.js';
import { sounds } from './sound.js';
import { bfs, orderTrench } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';

export const camera = {
  x: 0,
  y: (R * S) / 2 - 200,
  zoom: CONFIG.CAMERA.DEFAULT_ZOOM,
};

let lastTap = 0;
let box = null;
let activePointers = new Map();
let lastPinchDist = null;
let isPanning = false;

export function getBox() {
  return box;
}

export function clampCamera() {
  const viewW = cv.width / camera.zoom;
  const viewH = cv.height / camera.zoom;
  const mapW = C * S;
  const mapH = R * S;

  if (viewW >= mapW) {
    camera.x = (mapW - viewW) / 2;
  } else {
    camera.x = Math.max(0, Math.min(mapW - viewW, camera.x));
  }

  if (viewH >= mapH) {
    camera.y = (mapH - viewH) / 2;
  } else {
    camera.y = Math.max(0, Math.min(mapH - viewH, camera.y));
  }
}

export function screenToWorld(sx, sy) {
  const rect = cv.getBoundingClientRect();
  const canvasX = (sx - rect.left) * (cv.width / rect.width);
  const canvasY = (sy - rect.top) * (cv.height / rect.height);

  const worldPx = camera.x + canvasX / camera.zoom;
  const worldPy = camera.y + canvasY / camera.zoom;

  return [worldPx / S, worldPy / S, canvasX, canvasY];
}

export function initInput(humanPlayerGetter, playersGetter, netModeGetter) {
  clampCamera();

  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const oldZoom = camera.zoom;
      const newZoom = Math.max(CONFIG.CAMERA.MIN_ZOOM, Math.min(CONFIG.CAMERA.MAX_ZOOM, oldZoom * zoomFactor));

      const rect = cv.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (cv.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (cv.height / rect.height);

      camera.x += mouseX / oldZoom - mouseX / newZoom;
      camera.y += mouseY / oldZoom - mouseY / newZoom;
      camera.zoom = newZoom;
      clampCamera();
    },
    { passive: false }
  );

  const tap = (worldX, worldY) => {
    sounds.init();
    const humanPlayer = humanPlayerGetter();
    const players = playersGetter();
    const { isMultiplayer, isHost } = netModeGetter ? netModeGetter() : { isMultiplayer: false, isHost: false };
    if (!humanPlayer) return;

    if (humanPlayer.sel >= 0) {
      const c = CARDS[humanPlayer.sel];
      if (cnt(humanPlayer.id) + c.k > CONFIG.GAME.MAX_UNITS_PER_SIDE) {
        msg('Límite de unidades alcanzado.');
      } else if (humanPlayer.res >= c.c && humanPlayer.cds[humanPlayer.sel] <= 0) {
        // En multijugador cliente: pre-deducir recursos visualmente pero dejar que el Host autorice el despliegue
        if (isMultiplayer && !isHost) {
          humanPlayer.res -= c.c;
          humanPlayer.cds[humanPlayer.sel] = c.cd;
        }
        executeGameAction(
          {
            type: ACTION_TYPES.DEPLOY_CARD,
            playerId: humanPlayer.id,
            data: { cardIndex: humanPlayer.sel },
          },
          isHost,
          isMultiplayer
        );
        sounds.playDeploy();
        humanPlayer.sel = -1;
      }
      return;
    }

    const nowT = performance.now();
    const dbl = nowT - lastTap < 320;
    lastTap = nowT;

    const myId = humanPlayer.id;
    const selectedUnits = U.filter((u) => u.s && (u.playerId === myId || u.t === myId));

    // Si tocamos una unidad enemiga visible
    const enemyHit = U.filter((u) => areEnemies(u.playerId || u.t, myId, players) && u.seen && Math.hypot(u.x - worldX, u.y - worldY) < 1.2).sort(
      (p, q) => Math.hypot(p.x - worldX, p.y - worldY) - Math.hypot(q.x - worldX, q.y - worldY)
    )[0];

    if (enemyHit && selectedUnits.length > 0) {
      const unitIndices = selectedUnits.map((u) => U.indexOf(u)).filter((idx) => idx !== -1);
      const targetUnitIdx = U.indexOf(enemyHit);

      executeGameAction(
        {
          type: ACTION_TYPES.ATTACK_UNIT,
          playerId: humanPlayer.id,
          data: { unitIndices, targetUnitIdx },
        },
        isHost,
        isMultiplayer
      );
      sounds.playSelect();
      return;
    }

    // Tocar unidad propia
    const ownHit = U.filter((u) => (u.playerId === myId || u.t === myId) && Math.hypot(u.x - worldX, u.y - worldY) < 1.2).sort(
      (p, q) => Math.hypot(p.x - worldX, p.y - worldY) - Math.hypot(q.x - worldX, q.y - worldY)
    )[0];

    if (ownHit) {
      if (dbl) {
        U.forEach((u) => {
          if (u.playerId === myId || u.t === myId) u.s = true;
        });
      } else {
        U.forEach((u) => {
          if (u.playerId === myId || u.t === myId) {
            u.s = ownHit.squadId > 0 ? u.squadId === ownHit.squadId : u === ownHit;
          }
        });
      }
      sounds.playSelect();
      return;
    }

    // Si tocamos en el mapa, mover las unidades seleccionadas
    const cx = Math.floor(worldX);
    const cy = Math.floor(worldY);

    if (selectedUnits.length > 0) {
      const unitIndices = selectedUnits.map((u) => U.indexOf(u)).filter((idx) => idx !== -1);

      if (isT(cx, cy) && selectedUnits.some((w) => !w.isDrone)) {
        executeGameAction(
          {
            type: ACTION_TYPES.ENTER_TRENCH,
            playerId: humanPlayer.id,
            data: { unitIndices, cx, cy },
          },
          isHost,
          isMultiplayer
        );
      } else if (selectedUnits.some((u) => u.tr)) {
        const u = selectedUnits.find((w) => w.tr);
        if (u) {
          const p = bfs(Math.floor(u.x), Math.floor(u.y), (a, b) => T[b * C + a] === 3);
          if (p) {
            const ox = cl(worldX, 0.5, C - 0.5);
            const oy = cl(worldY, 0.5, R - 0.5);
            executeGameAction(
              {
                type: ACTION_TYPES.EXIT_TRENCH,
                playerId: humanPlayer.id,
                data: { unitIndices, ox, oy, path: p },
              },
              isHost,
              isMultiplayer
            );
          }
        }
      } else {
        executeGameAction(
          {
            type: ACTION_TYPES.MOVE_UNITS,
            playerId: humanPlayer.id,
            data: { unitIndices, targetX: worldX, targetY: worldY, mapCols: C, mapRows: R },
          },
          isHost,
          isMultiplayer
        );
      }
    }
  };

  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    });

    if (activePointers.size === 2) {
      box = null;
      isPanning = true;
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    } else if (activePointers.size === 1) {
      isPanning = false;
    }
  });

  cv.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;

    const prev = activePointers.get(e.pointerId);
    activePointers.set(e.pointerId, {
      ...prev,
      x: e.clientX,
      y: e.clientY,
    });

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const newDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

      if (lastPinchDist && newDist > 0) {
        const scale = newDist / lastPinchDist;
        const oldZoom = camera.zoom;
        const newZoom = Math.max(CONFIG.CAMERA.MIN_ZOOM, Math.min(CONFIG.CAMERA.MAX_ZOOM, oldZoom * scale));

        const centerClientX = (pts[0].x + pts[1].x) / 2;
        const centerClientY = (pts[0].y + pts[1].y) / 2;
        const rect = cv.getBoundingClientRect();
        const centerCanvasX = (centerClientX - rect.left) * (cv.width / rect.width);
        const centerCanvasY = (centerClientY - rect.top) * (cv.height / rect.height);

        camera.x += centerCanvasX / oldZoom - centerCanvasX / newZoom;
        camera.y += centerCanvasY / oldZoom - centerCanvasY / newZoom;
        camera.zoom = newZoom;
      }
      lastPinchDist = newDist;

      const rect = cv.getBoundingClientRect();
      const dx = ((e.clientX - prev.x) * (cv.width / rect.width)) / camera.zoom;
      const dy = ((e.clientY - prev.y) * (cv.height / rect.height)) / camera.zoom;
      camera.x -= dx / 2;
      camera.y -= dy / 2;
      clampCamera();
    } else if (activePointers.size === 1 && !isPanning) {
      const p = activePointers.get(e.pointerId);
      const dist = Math.hypot(p.x - p.startX, p.y - p.startY);
      if (dist > 8) {
        const [wx0, wy0] = screenToWorld(p.startX, p.startY);
        const [wx1, wy1] = screenToWorld(p.x, p.y);
        box = [wx0, wy0, wx1, wy1];
      }
    }
  });

  const handlePointerUp = (e) => {
    if (!activePointers.has(e.pointerId)) return;
    const p = activePointers.get(e.pointerId);
    activePointers.delete(e.pointerId);

    if (activePointers.size < 2) {
      lastPinchDist = null;
    }

    if (activePointers.size === 0) {
      const dist = Math.hypot(p.x - p.startX, p.y - p.startY);
      if (box) {
        const x0 = Math.min(box[0], box[2]);
        const x1 = Math.max(box[0], box[2]);
        const y0 = Math.min(box[1], box[3]);
        const y1 = Math.max(box[1], box[3]);
        const humanPlayer = humanPlayerGetter();
        const myId = humanPlayer ? humanPlayer.id : 1;
        const inn = U.filter((u) => (u.playerId === myId || u.t === myId) && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
        const touchedSquadIds = new Set(inn.filter((u) => u.squadId > 0).map((u) => u.squadId));
        U.forEach((u) => {
          if (u.playerId === myId || u.t === myId) {
            u.s = inn.includes(u) || (u.squadId > 0 && touchedSquadIds.has(u.squadId));
          }
        });
        sounds.playSelect();
        box = null;
      } else if (dist <= 8 && !isPanning) {
        const [wx, wy] = screenToWorld(p.x, p.y);
        tap(wx, wy);
      }
      box = null;
      isPanning = false;
    }
  };

  cv.addEventListener('pointerup', handlePointerUp);
  cv.addEventListener('pointercancel', handlePointerUp);
}
