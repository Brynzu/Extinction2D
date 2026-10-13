extends Node2D

@onready var game_title = $CanvasLayer/GameUI/Header/GameTitle
@onready var btn_pause = $CanvasLayer/GameUI/Header/BtnPause
@onready var lbl_blue = $CanvasLayer/GameUI/ScoreContainer/LblBlue
@onready var lbl_red = $CanvasLayer/GameUI/ScoreContainer/LblRed
@onready var resource_bar = $CanvasLayer/GameUI/ResourceContainer/ResourceBar
@onready var lbl_resource = $CanvasLayer/GameUI/ResourceContainer/LblResource
@onready var cards_container = $CanvasLayer/GameUI/CardsContainer

@onready var modal_pause = $CanvasLayer/ModalPause
@onready var btn_resume = $CanvasLayer/ModalPause/PauseCard/BtnResume
@onready var btn_quit = $CanvasLayer/ModalPause/PauseCard/BtnQuit

@onready var modal_end = $CanvasLayer/ModalEnd
@onready var end_title = $CanvasLayer/ModalEnd/EndCard/EndTitle
@onready var end_desc = $CanvasLayer/ModalEnd/EndCard/EndDesc
@onready var btn_end_return = $CanvasLayer/ModalEnd/EndCard/BtnEndReturn

var map_mgr: MapManager
var units_mgr: UnitsManager
var combat_mgr: CombatManager
var trenches_mgr: TrenchesManager
var ai_mgr: AIManager

var game_players: Array = []
var human_player: Dictionary = {}
var game_active: bool = false
var is_paused: bool = false

var pt: float = 0.0
var selected_card_index: int = -1

func _ready():
	map_mgr = MapManager.new()
	units_mgr = UnitsManager.new()
	combat_mgr = CombatManager.new()
	trenches_mgr = TrenchesManager.new()
	ai_mgr = AIManager.new()

	btn_pause.pressed.connect(func():
		is_paused = true
		modal_pause.visible = true
	)
	btn_resume.pressed.connect(func():
		is_paused = false
		modal_pause.visible = false
	)
	btn_quit.pressed.connect(_quit_to_main)
	btn_end_return.pressed.connect(_quit_to_main)

	start_game("default", [
		{ "id": 1, "name": "Tú", "isHuman": true, "team": "A", "colorKey": "blue" },
		{ "id": 2, "name": "IA 1", "isHuman": false, "team": "B", "colorKey": "red" }
	])

func _quit_to_main():
	game_active = false
	get_tree().change_scene_to_file("res://scenes/Main.tscn")

func start_game(preset: String, players_config: Array):
	game_active = true
	is_paused = false
	units_mgr.U.clear()
	combat_mgr.clear_bullets()
	units_mgr.reset_squad_counter()

	var active_combatants = []
	for p in players_config:
		if p.get("team", "") != "SPECTATOR" and not p.get("isSpectator", false):
			active_combatants.append(p)

	var scale = 2.0 if active_combatants.size() >= 5 else (1.5 if active_combatants.size() >= 3 else 1.0)
	var cols = roundi(Config.GRID.COLUMNS * scale)
	var rows = roundi(Config.GRID.ROWS * scale)
	var hq_positions = Config.get_hq_positions(cols, rows)

	var active_idx = 0
	game_players.clear()
	for p in players_config:
		var is_spectator = (p.get("team", "") == "SPECTATOR")
		var pos = hq_positions[active_idx] if (not is_spectator and active_idx < hq_positions.size()) else null
		if pos != null:
			active_idx += 1

		var player_dict = {
			"id": p.id,
			"name": p.name,
			"isHuman": p.isHuman,
			"team": p.team,
			"colorKey": p.colorKey,
			"res": Config.GAME.INITIAL_RESOURCES,
			"cds": [0.0, 0.0, 0.0, 0.0],
			"sel": -1,
			"aiTm": 2.0 + randf() * 2.0,
			"aiGt": 3.0,
			"hq": {
				"x": pos.hq.x if pos != null else 0,
				"y": pos.hq.y if pos != null else 0,
				"spawnX": pos.spawn.x if pos != null else 0,
				"spawnY": pos.spawn.y if pos != null else 0,
				"hp": Config.HQ_MAX_HP,
				"maxHp": Config.HQ_MAX_HP,
				"alive": true
			} if pos != null else null
		}
		game_players.append(player_dict)

	human_player = game_players[0]
	for p in game_players:
		if p.get("isHuman", false):
			human_player = p
			break

	map_mgr.init_map(preset, game_players)

	var roles = ["leader", "machinegunner", "grenadier", "rifleman", "rifleman"]
	for p in game_players:
		if p.get("team", "") == "SPECTATOR" or p.hq == null:
			continue
		for i in range(5):
			var role = roles[i]
			units_mgr.add_unit(
				p.id,
				p.hq.x + ((i % 2) - 0.5) * 1.2,
				p.hq.y + (floorf(float(i) / 2.0) - 0.5) * 1.2,
				p.hq.x + ((i % 2) - 0.5) * 1.2,
				p.hq.y + (floorf(float(i) / 2.0) - 0.5) * 1.2,
				false,
				p.id,
				role
			)

	_setup_cards_ui()

func _setup_cards_ui():
	for child in cards_container.get_children():
		child.queue_free()

	for i in range(Config.CARDS.size()):
		var card = Config.CARDS[i]
		var btn = Button.new()
		btn.text = "%s ($%d)" % [card.n, card.c]
		btn.custom_minimum_size = Vector2(100, 50)
		btn.pressed.connect(func():
			_on_card_clicked(i)
		)
		cards_container.add_child(btn)

func _on_card_clicked(index: int):
	if human_player.is_empty():
		return
	if selected_card_index == index:
		selected_card_index = -1
	else:
		selected_card_index = index
		if human_player.res >= Config.CARDS[index].c and human_player.cds[index] <= 0.0:
			human_player.res -= Config.CARDS[index].c
			human_player.cds[index] = Config.CARDS[index].cd
			units_mgr.deploy(human_player, index, map_mgr)
			selected_card_index = -1

func _process(delta: float):
	if not game_active or is_paused:
		queue_redraw()
		return

	var dt = minf(delta, 0.05)

	# Actualización de Recursos e IA
	var total_cells = map_mgr.C * map_mgr.R
	var player_territory = {}
	for y in range(map_mgr.R):
		for x in range(map_mgr.C):
			var p_id = roundi(map_mgr.v[y * map_mgr.C + x])
			if p_id > 0:
				player_territory[p_id] = player_territory.get(p_id, 0) + 1

	for p in game_players:
		var terr = player_territory.get(p.id, 0)
		var rate = Config.GAME.RESOURCE_BASE_RATE + (Config.GAME.RESOURCE_TERRITORY_RATE * float(terr)) / float(total_cells)
		p.res = minf(Config.GAME.MAX_RESOURCES, p.res + dt * rate)

		for i in range(4):
			p.cds[i] = maxf(0.0, p.cds[i] - dt)

		if not p.get("isHuman", false):
			p.aiTm -= dt
			if p.aiTm <= 0.0:
				p.aiTm = Config.AI.PLAY_CHECK_INTERVAL_MIN + randf() * Config.AI.PLAY_CHECK_INTERVAL_RANGE
				ai_mgr.ai_play(p, game_players, units_mgr, map_mgr, trenches_mgr)

			p.aiGt -= dt;
			if p.aiGt <= 0.0:
				p.aiGt = Config.AI.TRENCH_CHECK_INTERVAL
				ai_mgr.ai_trench(p, game_players, units_mgr.U, map_mgr, trenches_mgr)

	combat_mgr.vis(dt, units_mgr.U, map_mgr, game_players)
	units_mgr.sep(map_mgr)

	pt -= dt
	if pt <= 0.0:
		pt = 0.5
		trenches_mgr.post_tick(units_mgr.U, map_mgr)

	for u in units_mgr.U:
		if u.get("tr", false):
			if Vector2(u.tx - u.x, u.ty - u.y).length() < 0.5:
				if not u.get("path", []).is_empty():
					var next_p = u.path.pop_front()
					u.tx = next_p[0]
					u.ty = next_p[1]
				elif u.get("exit", null) != null:
					u.tr = false
					u.tx = u.exit[0]
					u.ty = u.exit[1]
					u.exit = null
		elif u.get("enter", false) and Vector2(u.tx - u.x, u.ty - u.y).length() < 0.5 and map_mgr.isT(int(u.x), int(u.y)):
			u.tr = true
			u.enter = false
			if u.get("gc", null) != null:
				var goal_cb = func(a: int, b: int) -> bool: return a == u.gc[0] and b == u.gc[1]
				u.path = trenches_mgr.bfs(int(u.x), int(u.y), goal_cb, map_mgr)
			u.gc = null

		var mt = [u.tx, u.ty] if (u.get("tr", false) or u.get("isDrone", false)) else trenches_mgr.wpt(u, map_mgr)
		var dx = mt[0] - u.x
		var dy = mt[1] - u.y
		var d = Vector2(dx, dy).length()

		if d > 0.08:
			var speed = Config.UNITS.SPEED_BLUE
			var trench_mult = Config.UNITS.TRENCH_SPEED_MULT if u.get("tr", false) else 1.0
			var combat_mult = Config.UNITS.COMBAT_SPEED_MULT if u.get("cb", false) else 1.0
			var m = minf(d, speed * u.sp * trench_mult * combat_mult * dt)
			var px = u.x + (dx / d) * m
			var py = u.y + (dy / d) * m

			var ok_func = func(a: float, b: float) -> bool:
				if u.get("isDrone", false):
					return true
				elif u.get("tr", false):
					return map_mgr.isT(int(a), int(b))
				else:
					return not map_mgr.isT(int(a), int(b)) or map_mgr.isT(int(u.x), int(u.y)) or (u.get("enter", false) and int(a) == int(u.tx) and int(b) == int(u.ty))

			if ok_func.call(px, py):
				u.x = px
				u.y = py
			elif ok_func.call(px, u.y):
				u.x = px
			elif ok_func.call(u.x, py):
				u.y = py

		if not u.get("isDrone", false):
			var u_pid = u.get("playerId", u.get("t", -1))
			var r = Config.GAME.TERRITORY_PUSH_RADIUS
			for j in range(maxi(0, int(u.y - r)), mini(map_mgr.R - 1, int(u.y + r)) + 1):
				for i in range(maxi(0, int(u.x - r)), mini(map_mgr.C - 1, int(u.x + r)) + 1):
					if Vector2(float(i) + 0.5 - u.x, float(j) + 0.5 - u.y).length() <= r:
						map_mgr.v[j * map_mgr.C + i] = float(u_pid)

	combat_mgr.update_combat(dt, units_mgr.U, map_mgr, game_players)

	# Remover unidades caídas
	var surviving_units = []
	for u in units_mgr.U:
		if u.get("hp", 0) > 0:
			surviving_units.append(u)
	units_mgr.U = surviving_units

	_update_ui()
	queue_redraw()

func _update_ui():
	if human_player.is_empty():
		return
	resource_bar.value = human_player.get("res", 0.0)
	lbl_resource.text = "%d" % int(human_player.get("res", 0.0))

func _unhandled_input(event):
	if not game_active or is_paused:
		return

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var click_pos = get_local_mouse_position()
		var grid_x = click_pos.x / Config.GRID.CELL_SIZE
		var grid_y = click_pos.y / Config.GRID.CELL_SIZE

		if grid_x >= 0 and grid_x < map_mgr.C and grid_y >= 0 and grid_y < map_mgr.R:
			for u in units_mgr.U:
				if u.get("playerId", -1) == human_player.get("id", -1):
					u.tx = grid_x
					u.ty = grid_y

func _draw():
	if map_mgr == null:
		return

	var cell_s = float(Config.GRID.CELL_SIZE)

	# Dibujar Mapa (Terreno)
	for y in range(map_mgr.R):
		for x in range(map_mgr.C):
			var tile = map_mgr.T[y * map_mgr.C + x]
			var rect = Rect2(x * cell_s, y * cell_s, cell_s, cell_s)

			var terr_pid = roundi(map_mgr.v[y * map_mgr.C + x])
			if terr_pid == 1:
				draw_rect(rect, Color(0.2, 0.4, 0.7, 0.3))
			elif terr_pid > 1:
				draw_rect(rect, Color(0.7, 0.2, 0.2, 0.3))

			if tile == 1: # Bosque
				draw_rect(rect, Color(0.1, 0.5, 0.1, 0.6))
			elif tile == 3: # Trinchera superficial
				draw_rect(rect, Color(0.6, 0.4, 0.2, 0.8))
			elif tile == 4: # Trinchera profunda
				draw_rect(rect, Color(0.4, 0.25, 0.1, 0.9))

	# Dibujar HQs
	for p in game_players:
		if p.has("hq") and p.hq != null and p.hq.get("alive", true):
			var color = Config.COLORS.get(p.get("colorKey", "blue"), {}).get("main", Color.BLUE)
			draw_circle(Vector2(p.hq.x * cell_s, p.hq.y * cell_s), cell_s * 1.2, color)

	# Dibujar Unidades
	for u in units_mgr.U:
		var color = Color.WHITE
		for p in game_players:
			if p.id == u.get("playerId", u.get("t", -1)):
				color = Config.COLORS.get(p.get("colorKey", "blue"), {}).get("main", Color.BLUE)
				break

		var pos = Vector2(u.x * cell_s, u.y * cell_s)
		var rad = cell_s * (0.4 if u.get("isDrone", false) else 0.3)
		draw_circle(pos, rad, color)

	# Dibujar Balas
	for b in combat_mgr.B:
		var pos = Vector2(b.x * cell_s, b.y * cell_s)
		draw_circle(pos, 3.0, Color.YELLOW)
