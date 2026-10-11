import { B, canSee } from './combat.js';
import { CONFIG } from './config.js';
import { camera } from './input.js';
import { C, R, S, T, deep, v } from './map.js';
import { CARDS, U, deploy } from './units.js';

export const cv = document.getElementById('c');
export const g = cv.getContext('2d');

// Ajustar tamaño del Canvas según el contenedor o ventana
cv.width = 480;
cv.height = 720;

export const hint = document.getElementById('hint');
export const HINT = hint.textContent;
export const cardsEl = document.getElementById('cards');
export const rf = document.getElementById('rf');
export const rn = document.getElementById('rn');
export const pbEl = document.getElementById('pb');
export const prEl = document.getElementById('pr');
export const bb = document.getElementById('bb');
export const br = document.getElementById('br');

let msgTimeout = null;

export function msg(t) {
  hint.textContent = t;
  clearTimeout(msgTimeout);
  msgTimeout = setTimeout(() => (hint.textContent = HINT), 2200);
}

export function initCardsUI(P) {
  cardsEl.innerHTML = '';
  CARDS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    b.innerHTML = '<b>' + c.n + '</b>×' + c.k + ' · costo ' + c.c + '<div class="cd"></div>';
    b.onclick = () => {
      if (P.cds[i] > 0) return msg('Esa carta se está recargando.');
      if (P.res < c.c) return msg('Recurso insuficiente.');
      P.res -= c.c;
      P.cds[i] = c.cd;
      deploy(1, i);
      msg('Refuerzos desplegados desde la esquina.');
    };
    cardsEl.appendChild(b);
  });
}

export function ui(P) {
  rf.style.width = P.res * 10 + '%';
  rn.textContent = Math.floor(P.res);
  [...cardsEl.children].forEach((b, i) => {
    const c = CARDS[i];
    b.classList.toggle('off', P.cds[i] > 0 || P.res < c.c);
    b.classList.toggle('sel', P.sel === i);
    b.lastChild.style.height = (P.cds[i] / c.cd) * 100 + '%';
  });
}

export function draw(P, box, setCounts) {
  g.clearRect(0, 0, cv.width, cv.height);

  g.save();
  // Aplicar transformación de la cámara (zoom y traslación)
  g.scale(camera.zoom, camera.zoom);
  g.translate(-camera.x, -camera.y);

  // Fondo del mapa
  g.fillStyle = '#4a5340';
  g.fillRect(0, 0, C * S, R * S);

  let b = 0;
  let r = 0;

  // Renderizar territorio
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const a = v[y * C + x];
      if (a > 0.3) b++;
      else if (a < -0.3) r++;
      if (a === 0) continue;
      g.fillStyle = a > 0 ? `rgba(59,127,208,${0.15 + 0.5 * a})` : `rgba(207,74,58,${0.15 - 0.5 * a})`;
      g.fillRect(x * S, y * S, S, S);
    }
  }

  // Renderizar trincheras
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      const k = T[y * C + x];
      if (k >= 3) {
        g.fillStyle = k === 3 ? '#5a4631' : '#17120d';
        g.fillRect(x * S, y * S, S, S);
      }
    }
  }

  // Renderizar HQs (Cuarteles Generales)
  const drawHQ = (hqPos, color, label) => {
    const hqX = hqPos.x * S;
    const hqY = hqPos.y * S;
    g.fillStyle = color;
    g.fillRect(hqX - 25, hqY - 25, 50, 50);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.strokeRect(hqX - 25, hqY - 25, 50, 50);
    g.fillStyle = '#ffffff';
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'center';
    g.fillText(label, hqX, hqY + 4);
  };

  drawHQ(CONFIG.HQ.BLUE_HQ, '#3b7fd0', 'HQ AZUL');
  drawHQ(CONFIG.HQ.RED_HQ, '#cf4a3a', 'HQ ROJO');

  // Renderizar Unidades
  for (const u of U) {
    if (u.t < 0 && !u.seen) continue;
    if (u.s) {
      g.strokeStyle = '#fff';
      g.setLineDash([3, 3]);
      g.beginPath();
      g.arc(u.tx * S, u.ty * S, 5, 0, 7);
      g.stroke();
      g.setLineDash([]);
    }
    g.fillStyle = u.t > 0 ? '#9cc4f5' : '#f2a198';
    g.strokeStyle = u.s ? '#fff' : u.t > 0 ? '#1c4f93' : '#8f2a1e';
    g.lineWidth = u.s ? 3 : 2;
    g.globalAlpha = deep(u) ? 0.6 : 1;
    g.beginPath();
    g.arc(u.x * S, u.y * S, S * 0.3, 0, 7);
    g.fill();
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(u.x * S - 6, u.y * S + 8, 12, 3);
    g.fillStyle = u.t > 0 ? '#6fb0ff' : '#ff7a6a';
    g.fillRect(u.x * S - 6, u.y * S + 8, (12 * u.hp) / u.mh, 3);
  }

  // Renderizar Balas
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  for (const bullet of B) {
    if (bullet.t < 0 && !canSee(bullet.x, bullet.y)) continue;
    g.strokeStyle = bullet.t > 0 ? '#e3f0ff' : '#ffe0db';
    g.beginPath();
    g.moveTo((bullet.x - bullet.vx * 0.04) * S, (bullet.y - bullet.vy * 0.04) * S);
    g.lineTo(bullet.x * S, bullet.y * S);
    g.stroke();
  }

  // Renderizar Árboles / Bosques
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < C; x++) {
      if (T[y * C + x] === 1) {
        g.fillStyle = '#5a4631';
        g.beginPath();
        g.arc((x + 0.5) * S, (y + 0.5) * S, S * 0.12, 0, 7);
        g.fill();
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

  // Renderizar Recuadro de Selección (box)
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

  g.restore(); // Restaurar contexto sin transformaciones de cámara

  // Renderizar Minimapa en la esquina superior derecha
  drawMinimap();

  if (setCounts) setCounts(b, r);
  const n = C * R;
  const pb = Math.round((b / n) * 100);
  const pr = Math.round((r / n) * 100);
  pbEl.textContent = 'Tú ' + pb + '%';
  prEl.textContent = 'Enemigo ' + pr + '%';
  bb.style.width = pb + '%';
  br.style.width = pr + '%';
}

function drawMinimap() {
  const mw = 100;
  const mh = 150;
  const mx = cv.width - mw - 10;
  const my = 10;

  // Fondo minimapa
  g.fillStyle = 'rgba(21, 24, 26, 0.85)';
  g.fillRect(mx, my, mw, mh);
  g.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  g.lineWidth = 1;
  g.strokeRect(mx, my, mw, mh);

  const scaleX = mw / (C * S);
  const scaleY = mh / (R * S);

  // Unidades en minimapa
  for (const u of U) {
    if (u.t < 0 && !u.seen) continue;
    g.fillStyle = u.t > 0 ? '#3b7fd0' : '#cf4a3a';
    g.fillRect(mx + u.x * S * scaleX - 1, my + u.y * S * scaleY - 1, 3, 3);
  }

  // Cuadro de vista de la cámara
  const viewW = (cv.width / camera.zoom) * scaleX;
  const viewH = (cv.height / camera.zoom) * scaleY;
  const viewX = mx + camera.x * scaleX;
  const viewY = my + camera.y * scaleY;

  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.strokeRect(viewX, viewY, viewW, viewH);
}
