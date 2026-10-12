export const CONFIG = {
  // Configuración de la cuadrícula horizontal (120x80 celdas)
  GRID: {
    COLUMNS: 120,
    ROWS: 80,
    CELL_SIZE: 20,
  },

  // Configuración de los HQs y Puntos de Spawn adaptables según dimensiones de mapa
  getHQPositions: (cols, rows) => [
    { spawn: { x: 2, y: Math.round(rows * 0.12) }, hq: { x: 12, y: Math.round(rows * 0.25) } },                         // Pos 0: Izquierda Arriba
    { spawn: { x: cols - 2, y: Math.round(rows * 0.88) }, hq: { x: cols - 12, y: Math.round(rows * 0.75) } },             // Pos 1: Derecha Abajo
    { spawn: { x: 2, y: Math.round(rows * 0.88) }, hq: { x: 12, y: Math.round(rows * 0.75) } },                         // Pos 2: Izquierda Abajo
    { spawn: { x: cols - 2, y: Math.round(rows * 0.12) }, hq: { x: cols - 12, y: Math.round(rows * 0.25) } },             // Pos 3: Derecha Arriba
    { spawn: { x: 2, y: Math.round(rows * 0.50) }, hq: { x: 12, y: Math.round(rows * 0.50) } },                         // Pos 4: Izquierda Centro
    { spawn: { x: cols - 2, y: Math.round(rows * 0.50) }, hq: { x: cols - 12, y: Math.round(rows * 0.50) } },             // Pos 5: Derecha Centro
  ],

  HQ_MAX_HP: 100,

  COLORS: {
    blue: { main: '#3b7fd0', light: '#9cc4f5', dark: '#1c4f93', name: 'Azul' },
    red: { main: '#cf4a3a', light: '#f2a198', dark: '#8f2a1e', name: 'Rojo' },
    green: { main: '#2eac66', light: '#86e3ad', dark: '#196139', name: 'Verde' },
    yellow: { main: '#e6b800', light: '#f7e17c', dark: '#8a6e00', name: 'Amarillo' },
    purple: { main: '#9b59b6', light: '#d2b4de', dark: '#5b2c6f', name: 'Morado' },
    orange: { main: '#e67e22', light: '#f8c471', dark: '#935116', name: 'Naranja' },
  },

  TEAM_COLORS: {
    A: { main: '#3b7fd0', light: '#9cc4f5', dark: '#1c4f93', name: 'Equipo A' },
    B: { main: '#cf4a3a', light: '#f2a198', dark: '#8f2a1e', name: 'Equipo B' },
    C: { main: '#2eac66', light: '#86e3ad', dark: '#196139', name: 'Equipo C' },
    D: { main: '#e6b800', light: '#f7e17c', dark: '#8a6e00', name: 'Equipo D' },
    E: { main: '#9b59b6', light: '#d2b4de', dark: '#5b2c6f', name: 'Equipo E' },
    F: { main: '#e67e22', light: '#f8c471', dark: '#935116', name: 'Equipo F' },
  },

  // Configuración de cámara
  CAMERA: {
    MIN_ZOOM: 0.35,
    MAX_ZOOM: 2.0,
    DEFAULT_ZOOM: 0.65,
  },

  // Configuración de territorio y recursos
  GAME: {
    MAX_UNITS_PER_SIDE: 45,
    INITIAL_RESOURCES: 5,
    MAX_RESOURCES: 10,
    RESOURCE_BASE_RATE: 0.2, // Reducido al 50% (ingresos demoran el doble)
    RESOURCE_TERRITORY_RATE: 0.6, // Reducido al 50%
    TERRITORY_PUSH_RADIUS: 3,
    TERRITORY_PUSH_SPEED: 0.8,
    DEPLOY_TERRITORY_THRESHOLD: 0.3,
  },

  // Cartas de despliegue
  CARDS: [
    { n: 'Escuadrón Asalto', k: 5, hp: 3, sp: 1, c: 3, cd: 16, isDrone: false },
    { n: 'Escuadrón Asalto', k: 5, hp: 3, sp: 1, c: 3, cd: 16, isDrone: false },
    { n: 'Dron Kamikaze', k: 1, hp: 1, sp: 4.5, c: 2, cd: 6, isDrone: true },
    { n: 'Escuadrón Asalto', k: 5, hp: 3, sp: 1, c: 3, cd: 16, isDrone: false },
  ],

  // Atributos y movimiento de unidades
  UNITS: {
    DEFAULT_HP: 3,
    DRAW_RADIUS: 0.20, // Reducido para movimientos tácticos en trinchera
    SEPARATION_DIST: 0.55,
    SPEED_BLUE: 2.5,
    SPEED_RED: 1.6,
    COMBAT_SPEED_MULT: 0.35,
    TRENCH_SPEED_MULT: 0.60, // 40% más lento dentro de trinchera
  },

  // Combate y proyectiles
  COMBAT: {
    RANGE_DEFAULT: 9.1,  // +30% (7 * 1.30 = 9.1)
    RANGE_FOREST: 3.9,   // +30% (3 * 1.30 = 3.9)
    ATTACK_COOLDOWN: 1,
    REACTION_MAX: 0.5,
    BULLET_SPEED: 26.4, // +20% (22 * 1.20 = 26.4)
    BULLET_LIFETIME: 0.65, // +30% (0.5 * 1.30 = 0.65)
    BULLET_DAMAGE: 1,
    BULLET_HIT_RADIUS: 0.6,
    BULLET_WIDTH: 1.275, // -15% grosor
    DISPERSION_BASE: 0.056,
    DISPERSION_DIST: 0.014,
    DISPERSION_MOVING_MULT: 1.5,
    DISPERSION_TRENCH_DEEP_MULT: 0.45,
    DISPERSION_DRONE_MULT: 2.45, // Mucha menor precisión al disparar a drones (reducida dispersión un 30% -> +30% precisión)
    TRENCH_SHALLOW_DAMAGE_MULT: 0.3,
    SHOT_REVEAL_TIME: 0.8,
  },

  // Visibilidad y niebla
  VISIBILITY: {
    VISION_DEFAULT: 8,
    VISION_DRONE: 10.4, // +30% línea de visión para drones (8 * 1.3 = 10.4)
    VISION_FOREST: 3,
    VISION_TRENCH_DEEP: 5,
  },

  // Configuración de la IA
  AI: {
    PLAY_CHECK_INTERVAL_MIN: 2,
    PLAY_CHECK_INTERVAL_RANGE: 3,
    TRENCH_CHECK_INTERVAL: 3,
    TRENCH_WANT_FRACTION: 0.35,
  },
};
