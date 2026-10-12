// Game Actions handler for Singleplayer and Multiplayer (P2P Host / Client)
import { sendNetMessage } from './net.js';
import { orderTrench } from './trenches.js';
import { CARDS, U, cl, cnt, deploy } from './units.js';

export const ACTION_TYPES = {
  DEPLOY_CARD: 'DEPLOY_CARD',
  MOVE_UNITS: 'MOVE_UNITS',
  ATTACK_UNIT: 'ATTACK_UNIT',
  ENTER_TRENCH: 'ENTER_TRENCH',
  EXIT_TRENCH: 'EXIT_TRENCH',
  START_GAME: 'START_GAME',
  SYNC_FULL_STATE: 'SYNC_FULL_STATE',
  LOBBY_UPDATE: 'LOBBY_UPDATE',
};

// Dispara o transmite una acción
export function executeGameAction(action, isHost, isMultiplayer) {
  if (isMultiplayer) {
    if (isHost) {
      processActionLocally(action);
      sendNetMessage(action);
    } else {
      sendNetMessage(action);
    }
  } else {
    processActionLocally(action);
  }
}

export function processActionLocally(action, gamePlayers = []) {
  const { type, playerId, data } = action;

  switch (type) {
    case ACTION_TYPES.DEPLOY_CARD: {
      const { cardIndex } = data;
      const targetPlayer = gamePlayers.find((p) => p.id === playerId) || data.playerObj;
      if (targetPlayer && targetPlayer.res >= CARDS[cardIndex].c) {
        targetPlayer.res -= CARDS[cardIndex].c;
        targetPlayer.cds[cardIndex] = CARDS[cardIndex].cd;
        deploy(targetPlayer, cardIndex);
      }
      break;
    }

    case ACTION_TYPES.MOVE_UNITS: {
      const { unitIndices, targetX, targetY, mapCols, mapRows } = data;
      unitIndices.forEach((uIdx, i) => {
        const u = U[uIdx];
        if (!u) return;
        u.attackTarget = null;
        u.savedMoveTarget = null;

        const ox = cl(targetX + ((i % 3) - 1) * 1.3, 0.5, mapCols - 0.5);
        const oy = cl(targetY + (Math.floor(i / 3) - 1) * 1.3, 0.5, mapRows - 0.5);

        u.auto = false;
        u.enter = false;
        u.hold = null;
        u.post = null;

        const finalX = u.isDrone ? targetX : ox;
        const finalY = u.isDrone ? targetY : oy;

        if (u.cb) {
          u.savedMoveTarget = {
            tx: finalX,
            ty: finalY,
            auto: false,
            enter: false,
            gc: null,
            path: [],
            exit: null,
            hold: null,
            post: null,
          };
        } else {
          u.tx = finalX;
          u.ty = finalY;
        }
      });
      break;
    }

    case ACTION_TYPES.ATTACK_UNIT: {
      const { unitIndices, targetUnitIdx } = data;
      const targetUnit = U[targetUnitIdx];
      if (!targetUnit) return;
      unitIndices.forEach((uIdx) => {
        const u = U[uIdx];
        if (!u) return;
        u.attackTarget = targetUnit;
        u.savedMoveTarget = null;
        u.auto = false;
        u.enter = false;
        u.hold = null;
        u.post = null;
        u.tx = targetUnit.x;
        u.ty = targetUnit.y;
      });
      break;
    }

    case ACTION_TYPES.ENTER_TRENCH: {
      const { unitIndices, cx, cy } = data;
      const units = unitIndices.map((idx) => U[idx]).filter((u) => u && !u.isDrone);
      if (units.length > 0) {
        orderTrench(units, cx, cy);
      }
      break;
    }

    case ACTION_TYPES.EXIT_TRENCH: {
      const { unitIndices, ox, oy, path } = data;
      unitIndices.forEach((uIdx) => {
        const u = U[uIdx];
        if (!u) return;
        if (u.cb) {
          u.savedMoveTarget = {
            tx: u.tx,
            ty: u.ty,
            auto: u.auto,
            enter: u.enter,
            gc: u.gc,
            path: [...path],
            exit: [ox, oy],
            hold: null,
            post: null,
          };
        } else {
          u.path = [...path];
          u.exit = [ox, oy];
          u.hold = null;
          u.post = null;
        }
      });
      break;
    }
  }
}
