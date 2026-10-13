extends Node

const GRID_COLS = 24
const GRID_ROWS = 36
const CELL_SIZE = 20

const INITIAL_RESOURCES = 5.0
const MAX_RESOURCES = 10.0
const RESOURCE_BASE_RATE = 0.4
const RESOURCE_TERRITORY_RATE = 1.2

const COLORS = {
	"blue": Color("3b7fd0"),
	"red": Color("cf4a3a"),
	"green": Color("4a8a44"),
	"yellow": Color("d0a83b"),
	"purple": Color("8f3bd0"),
	"orange": Color("d0783b")
}

const TEAM_COLORS = {
	"A": Color("3b7fd0"),
	"B": Color("cf4a3a"),
	"C": Color("4a8a44"),
	"D": Color("d0a83b")
}
