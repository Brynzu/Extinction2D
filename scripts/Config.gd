extends Node

const GRID = {
	"COLUMNS": 120,
	"ROWS": 80,
	"CELL_SIZE": 20
}

const HQ_MAX_HP = 100

const COLORS = {
	"blue": { "main": Color("3b7fd0"), "light": Color("9cc4f5"), "dark": Color("1c4f93"), "name": "Azul" },
	"red": { "main": Color("cf4a3a"), "light": Color("f2a198"), "dark": Color("8f2a1e"), "name": "Rojo" },
	"green": { "main": Color("2eac66"), "light": Color("86e3ad"), "dark": Color("196139"), "name": "Verde" },
	"yellow": { "main": Color("e6b800"), "light": Color("f7e17c"), "dark": Color("8a6e00"), "name": "Amarillo" },
	"purple": { "main": Color("9b59b6"), "light": Color("d2b4de"), "dark": Color("5b2c6f"), "name": "Morado" },
	"orange": { "main": Color("e67e22"), "light": Color("f8c471"), "dark": Color("935116"), "name": "Naranja" }
}

const TEAM_COLORS = {
	"A": { "main": Color("3b7fd0"), "light": Color("9cc4f5"), "dark": Color("1c4f93"), "name": "Equipo A" },
	"B": { "main": Color("cf4a3a"), "light": Color("f2a198"), "dark": Color("8f2a1e"), "name": "Equipo B" },
	"C": { "main": Color("2eac66"), "light": Color("86e3ad"), "dark": Color("196139"), "name": "Equipo C" },
	"D": { "main": Color("e6b800"), "light": Color("f7e17c"), "dark": Color("8a6e00"), "name": "Equipo D" },
	"E": { "main": Color("9b59b6"), "light": Color("d2b4de"), "dark": Color("5b2c6f"), "name": "Equipo E" },
	"F": { "main": Color("e67e22"), "light": Color("f8c471"), "dark": Color("935116"), "name": "Equipo F" }
}

const CAMERA = {
	"MIN_ZOOM": 0.35,
	"MAX_ZOOM": 2.0,
	"DEFAULT_ZOOM": 0.65
}

const GAME = {
	"MAX_UNITS_PER_SIDE": 45,
	"INITIAL_RESOURCES": 5.0,
	"MAX_RESOURCES": 10.0,
	"RESOURCE_BASE_RATE": 0.2,
	"RESOURCE_TERRITORY_RATE": 0.6,
	"TERRITORY_PUSH_RADIUS": 3,
	"TERRITORY_PUSH_SPEED": 0.8,
	"DEPLOY_TERRITORY_THRESHOLD": 0.3
}

const CARDS = [
	{ "n": "Escuadrón Asalto", "k": 5, "hp": 3, "sp": 1.0, "c": 3, "cd": 16.0, "isDrone": false },
	{ "n": "Escuadrón Asalto", "k": 5, "hp": 3, "sp": 1.0, "c": 3, "cd": 16.0, "isDrone": false },
	{ "n": "Dron Kamikaze", "k": 1, "hp": 1, "sp": 4.5, "c": 2, "cd": 6.0, "isDrone": true },
	{ "n": "Escuadrón Asalto", "k": 5, "hp": 3, "sp": 1.0, "c": 3, "cd": 16.0, "isDrone": false }
]

const UNITS = {
	"DEFAULT_HP": 3,
	"DRAW_RADIUS": 0.20,
	"SEPARATION_DIST": 0.55,
	"SPEED_BLUE": 2.5,
	"SPEED_RED": 1.6,
	"COMBAT_SPEED_MULT": 0.35,
	"TRENCH_SPEED_MULT": 0.60
}

const COMBAT = {
	"RANGE_DEFAULT": 9.1,
	"RANGE_FOREST": 3.9,
	"ATTACK_COOLDOWN": 1.0,
	"REACTION_MAX": 0.5,
	"BULLET_SPEED": 26.4,
	"BULLET_LIFETIME": 0.52,
	"BULLET_DAMAGE": 1,
	"BULLET_HIT_RADIUS": 0.6,
	"BULLET_WIDTH": 1.275,
	"DISPERSION_BASE": 0.056,
	"DISPERSION_DIST": 0.014,
	"DISPERSION_MOVING_MULT": 1.5,
	"DISPERSION_TRENCH_DEEP_MULT": 0.45,
	"DISPERSION_DRONE_MULT": 2.45,
	"TRENCH_SHALLOW_DAMAGE_MULT": 0.3,
	"SHOT_REVEAL_TIME": 0.8
}

const VISIBILITY = {
	"VISION_DEFAULT": 8.0,
	"VISION_DRONE": 10.4,
	"VISION_FOREST": 3.0,
	"VISION_TRENCH_DEEP": 5.0
}

const AI = {
	"PLAY_CHECK_INTERVAL_MIN": 1.0,
	"PLAY_CHECK_INTERVAL_RANGE": 1.5,
	"TRENCH_CHECK_INTERVAL": 2.0,
	"TRENCH_WANT_FRACTION": 0.35
}

static func get_hq_positions(cols: int, rows: int) -> Array:
	return [
		{ "spawn": Vector2i(2, roundi(rows * 0.12)), "hq": Vector2i(12, roundi(rows * 0.25)) },
		{ "spawn": Vector2i(cols - 2, roundi(rows * 0.88)), "hq": Vector2i(cols - 12, roundi(rows * 0.75)) },
		{ "spawn": Vector2i(2, roundi(rows * 0.88)), "hq": Vector2i(12, roundi(rows * 0.75)) },
		{ "spawn": Vector2i(cols - 2, roundi(rows * 0.12)), "hq": Vector2i(cols - 12, roundi(rows * 0.25)) },
		{ "spawn": Vector2i(2, roundi(rows * 0.50)), "hq": Vector2i(12, roundi(rows * 0.50)) },
		{ "spawn": Vector2i(cols - 2, roundi(rows * 0.50)), "hq": Vector2i(cols - 12, roundi(rows * 0.50)) }
	]
