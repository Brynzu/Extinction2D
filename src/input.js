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

export function initInput(P) {
  clampCamera();

  cv.addEventListener('wheel', (e) => {
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
  }, { passive: false });

  const tap = (worldX, worldY) => {
    sounds.init();

    if (P.sel >= 0) {
      const c = CARDS[P.sel];
      if (cnt(1) + c.k > CONFIG.GAME.MAX_UNITS_PER_SIDE) {
        msg('Límite de unidades alcanzado.');
      } else {
        P.res -= c.c;
        P.cds[P.sel] = c.cd;
        deploy(1, P.sel);
        sounds.playDeploy();
        P.sel = -1;
      }
      return;
    }

    const nowT = performance.now();
    const dbl = nowT - lastTap < 320;
    lastTap = nowT;

    const selectedUnits = U.filter((u) => u.s && u.t > 0);

    // Si tocamos una unidad enemiga visible, dar orden de ataque directo (RTS clásico)
    const enemyHit = U.filter((u) => u.t < 0 && u.seen && Math.hypot(u.x - worldX, u.y - worldY) < 1.2).sort(
      (p, q) => Math.hypot(p.x - worldX, p.y - worldY) - Math.hypot(q.x - worldX, q.y - worldY)
    )[0];

    if (enemyHit && selectedUnits.length > 0) {
      selectedUnits.forEach((u) => {
        u.attackTarget = enemyHit;
        u.savedMoveTarget = null;
        u.auto = false;
        u.enter = false;
        u.hold = null;
        u.post = null;
        u.tx = enemyHit.x;
        u.ty = enemyHit.y;
      });
      sounds.playSelect();
      return;
    }

    // Si NO hay unidades seleccionadas aún, tocar una unidad propia la selecciona a ella o a toda su escuadra
    if (selectedUnits.length === 0) {
      const ownHit = U.filter((u) => u.t > 0 && Math.hypot(u.x - worldX, u.y - worldY) < 1.2).sort(
        (p, q) => Math.hypot(p.x - worldX, p.y - worldY) - Math.hypot(q.x - worldX, q.y - worldY)
      )[0];

      if (ownHit) {
        if (dbl) {
          U.forEach((u) => {
            if (u.t > 0) u.s = true;
          });
        } else {
          ownHit.s = true;
        }
        sounds.playSelect();
        return;
      }
    }

    // Si ya hay unidades seleccionadas y tocamos en el mapa (o en otra unidad), priorizar el movimiento
    const cx = Math.floor(worldX);
    const cy = Math.floor(worldY);

    selectedUnits.forEach((u, i) => {
      u.attackTarget = null;
      u.savedMoveTarget = null;
      const ox = cl(worldX + ((i % 3) - 1) * 1.3, 0.5, C - 0.5);
      const oy = cl(worldY + (Math.floor(i / 3) - 1) * 1.3, 0.5, R - 0.5);
      if (isT(cx, cy) && !u.isDrone) {
        if (i === 0) orderTrench(selectedUnits.filter((w) => !w.isDrone), cx, cy);
      } else if (u.tr) {
        if (dbl) {
          const p = bfs(Math.floor(u.x), Math.floor(u.y), (a, b) => T[b * C + a] === 3);
          if (p) {
            if (u.cb) {
              u.savedMoveTarget = {
                tx: u.tx,
                ty: u.ty,
                auto: u.auto,
                enter: u.enter,
                gc: u.gc,
                path: p,
                exit: [ox, oy],
                hold: null,
                post: null,
              };
            } else {
              u.path = p;
              u.exit = [ox, oy];
              u.hold = null;
              u.post = null;
            }
          }
        }
      } else {
        u.auto = false;
        u.enter = false;
        u.hold = null;
        u.post = null;
        const bad = isT(Math.floor(ox), Math.floor(oy));
        const targetX = u.isDrone ? worldX : bad ? worldX : ox;
        const targetY = u.isDrone ? worldY : bad ? worldY : oy;

        if (u.cb) {
          u.savedMoveTarget = {
            tx: targetX,
            ty: targetY,
            auto: false,
            enter: false,
            gc: null,
            path: [],
            exit: null,
            hold: null,
            post: null,
          };
        } else {
          u.tx = targetX;
          u.ty = targetY;
        }
      }
    });
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
        const inn = U.filter((u) => u.t > 0 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
        U.forEach((u) => (u.s = inn.includes(u)));
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
