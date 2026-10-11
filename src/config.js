export const CONFIG = {
  // Configuración de la cuadrícula
  GRID: {
    COLUMNS: 24,
    ROWS: 36,
    CELL_SIZE: 20,
  },

  // Configuración de territorio y recursos
  GAME: {
    MAX_UNITS_PER_SIDE: 25,
    INITIAL_RESOURCES: 5,
    MAX_RESOURCES: 10,
    RESOURCE_BASE_RATE: 0.4,
    RESOURCE_TERRITORY_RATE: 1.2,
    TERRITORY_PUSH_RADIUS: 3,
    TERRITORY_PUSH_SPEED: 0.8,
    DEPLOY_TERRITORY_THRESHOLD: 0.3,
  },

  // Cartas de despliegue
  CARDS: [
    { n: 'Escuadra', k: 3, hp: 3, sp: 1, c: 3, cd: 8 },
    { n: 'Escuadra', k: 3, hp: 3, sp: 1, c: 3, cd: 8 },
    { n: 'Escuadra', k: 3, hp: 3, sp: 1, c: 3, cd: 8 },
    { n: 'Escuadra', k: 3, hp: 3, sp: 1, c: 3, cd: 8 },
  ],

  // Atributos y movimiento de unidades
  UNITS: {
    DEFAULT_HP: 3,
    DRAW_RADIUS: 0.3,
    SEPARATION_DIST: 0.55,
    SPEED_BLUE: 2.5,
    SPEED_RED: 1.6,
    COMBAT_SPEED_MULT: 0.35,
  },

  // Combate y proyectiles
  COMBAT: {
    RANGE_DEFAULT: 7,
    RANGE_FOREST: 3,
    ATTACK_COOLDOWN: 1,
    REACTION_MAX: 0.5,
    BULLET_SPEED: 22,
    BULLET_LIFETIME: 0.5,
    BULLET_DAMAGE: 1,
    BULLET_HIT_RADIUS: 0.6,
    DISPERSION_BASE: 0.08,
    DISPERSION_DIST: 0.02,
    DISPERSION_MOVING_MULT: 1.5,
    DISPERSION_TRENCH_DEEP_MULT: 0.45,
    TRENCH_SHALLOW_DAMAGE_MULT: 0.3,
    SHOT_REVEAL_TIME: 0.8,
  },

  // Visibilidad y niebla
  VISIBILITY: {
    VISION_DEFAULT: 8,
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
