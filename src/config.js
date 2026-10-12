export const CONFIG = {
  // Configuración de la cuadrícula horizontal (120x80 celdas)
  GRID: {
    COLUMNS: 120,
    ROWS: 80,
    CELL_SIZE: 20,
  },

  // Configuración de los HQs y Puntos de Spawn (Horizontal: Azul Izquierda, Rojo Derecha)
  HQ: {
    BLUE_SPAWN: { x: 2, y: 78 },
    BLUE_HQ: { x: 12, y: 40 },
    RED_SPAWN: { x: 118, y: 2 },
    RED_HQ: { x: 108, y: 40 },
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
    RANGE_DEFAULT: 8.05, // +15% (7 * 1.15 = 8.05)
    RANGE_FOREST: 3.45,  // +15% (3 * 1.15 = 3.45)
    ATTACK_COOLDOWN: 1,
    REACTION_MAX: 0.5,
    BULLET_SPEED: 26.4, // +20% (22 * 1.20 = 26.4)
    BULLET_LIFETIME: 0.5,
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
