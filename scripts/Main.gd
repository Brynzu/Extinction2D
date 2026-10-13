extends Node2D

@onready var screen_main = $CanvasLayer/UI/ScreenMain
@onready var screen_sp = $CanvasLayer/UI/ScreenSP
@onready var screen_mp_select = $CanvasLayer/UI/ScreenMPSelect
@onready var screen_mp_lobby = $CanvasLayer/UI/ScreenMPLobby

# Screen Main
@onready var btn_singleplayer = $CanvasLayer/UI/ScreenMain/BtnSingleplayer
@onready var btn_multiplayer = $CanvasLayer/UI/ScreenMain/BtnMultiplayer

# Screen SP
@onready var btn_sp_back = $CanvasLayer/UI/ScreenSP/SPButtons/BtnSPBack
@onready var btn_sp_start = $CanvasLayer/UI/ScreenSP/SPButtons/BtnSPStart
@onready var sp_map_option = $CanvasLayer/UI/ScreenSP/MapOption
@onready var sp_ai_count_label = $CanvasLayer/UI/ScreenSP/LblAICount
@onready var sp_ai_slider = $CanvasLayer/UI/ScreenSP/AISlider
@onready var sp_mode_option = $CanvasLayer/UI/ScreenSP/ModeOption
@onready var sp_players_list = $CanvasLayer/UI/ScreenSP/PlayersScroll/PlayersList

# Screen MP Select
@onready var btn_mp_create_room = $CanvasLayer/UI/ScreenMPSelect/BtnMPCreateRoom
@onready var btn_mp_join = $CanvasLayer/UI/ScreenMPSelect/JoinContainer/BtnMPJoin
@onready var room_code_input = $CanvasLayer/UI/ScreenMPSelect/JoinContainer/RoomCodeInput
@onready var btn_mp_select_back = $CanvasLayer/UI/ScreenMPSelect/BtnMPSelectBack
@onready var mp_status_msg = $CanvasLayer/UI/ScreenMPSelect/MPStatusMsg

# Screen MP Lobby
@onready var lobby_code_label = $CanvasLayer/UI/ScreenMPLobby/LobbyCode
@onready var host_map_container = $CanvasLayer/UI/ScreenMPLobby/HostMapContainer
@onready var mp_map_option = $CanvasLayer/UI/ScreenMPLobby/HostMapContainer/MPMapOption
@onready var mp_players_list = $CanvasLayer/UI/ScreenMPLobby/MPPlayersScroll/MPPlayersList
@onready var btn_mp_lobby_back = $CanvasLayer/UI/ScreenMPLobby/MPLobbyButtons/BtnMPLobbyBack
@onready var btn_mp_start = $CanvasLayer/UI/ScreenMPLobby/MPLobbyButtons/BtnMPStart

var sp_settings = {
	"mapPreset": "default",
	"aiCount": 1,
	"mode": "teams",
	"playersConfig": []
}

var is_multiplayer = false
var is_host = false

func _ready():
	_setup_options()
	_connect_signals()
	_show_screen(screen_main)

func _setup_options():
	sp_map_option.clear()
	sp_map_option.add_item("Predeterminado (Equilibrado)", 0)
	sp_map_option.add_item("Bosque (Mucha vegetación)", 1)
	sp_map_option.add_item("Red de Trincheras", 2)

	sp_mode_option.clear()
	sp_mode_option.add_item("Por Equipos", 0)
	sp_mode_option.add_item("Todos Contra Todos (FFA)", 1)

	mp_map_option.clear()
	mp_map_option.add_item("Predeterminado (Equilibrado)", 0)
	mp_map_option.add_item("Bosque (Mucha vegetación)", 1)
	mp_map_option.add_item("Red de Trincheras", 2)

func _connect_signals():
	btn_singleplayer.pressed.connect(_on_singleplayer_pressed)
	btn_multiplayer.pressed.connect(_on_multiplayer_pressed)

	btn_sp_back.pressed.connect(func(): _show_screen(screen_main))
	btn_sp_start.pressed.connect(_on_sp_start_pressed)
	sp_ai_slider.value_changed.connect(_on_ai_slider_changed)
	sp_mode_option.item_selected.connect(_on_sp_mode_selected)

	btn_mp_create_room.pressed.connect(_on_mp_create_room_pressed)
	btn_mp_join.pressed.connect(_on_mp_join_pressed)
	btn_mp_select_back.pressed.connect(func(): _show_screen(screen_main))

	btn_mp_lobby_back.pressed.connect(func(): _show_screen(screen_mp_select))
	btn_mp_start.pressed.connect(_on_mp_start_pressed)

func _show_screen(target):
	screen_main.visible = false
	screen_sp.visible = false
	screen_mp_select.visible = false
	screen_mp_lobby.visible = false
	target.visible = true

func _on_singleplayer_pressed():
	is_multiplayer = false
	_update_sp_players_config()
	_show_screen(screen_sp)

func _on_multiplayer_pressed():
	is_multiplayer = true
	mp_status_msg.text = ""
	_show_screen(screen_mp_select)

func _on_ai_slider_changed(value):
	sp_settings.aiCount = int(value)
	sp_ai_count_label.text = "Ejércitos IA: %d" % sp_settings.aiCount
	_update_sp_players_config()

func _on_sp_mode_selected(index):
	sp_settings.mode = "ffa" if index == 1 else "teams"
	_update_sp_players_config()

func _update_sp_players_config():
	var total_players = 1 + sp_settings.aiCount
	sp_settings.playersConfig.clear()

	sp_settings.playersConfig.append({
		"id": 1,
		"name": "Tú",
		"isHuman": true,
		"team": "A",
		"colorKey": "blue"
	})

	var default_colors = ["red", "green", "yellow", "purple", "orange"]
	var half = ceil(float(total_players) / 2.0)

	for i in range(1, total_players):
		var default_team = "A"
		if sp_settings.mode == "ffa":
			default_team = String.chr(65 + i)
		else:
			default_team = "A" if i < half else "B"

		sp_settings.playersConfig.append({
			"id": i + 1,
			"name": "IA %d" % i,
			"isHuman": false,
			"team": default_team,
			"colorKey": default_colors[(i - 1) % default_colors.size()]
		})

	_render_sp_players_list()

func _render_sp_players_list():
	for child in sp_players_list.get_children():
		child.queue_free()

	for p in sp_settings.playersConfig:
		var row = HBoxContainer.new()
		var lbl = Label.new()
		lbl.text = p.name + (" (Tú)" if p.isHuman else "")
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(lbl)

		var color_opt = OptionButton.new()
		var color_keys = Config.COLORS.keys()
		for ck in color_keys:
			color_opt.add_item(Config.COLORS[ck].name)
			if ck == p.colorKey:
				color_opt.selected = color_opt.item_count - 1

		row.add_child(color_opt)
		sp_players_list.add_child(row)

func _on_sp_start_pressed():
	# Iniciar escena del juego
	var map_map = ["default", "forest", "trench"]
	sp_settings.mapPreset = map_map[sp_map_option.selected]
	get_tree().change_scene_to_file("res://scenes/Game.tscn")

func _on_mp_create_room_pressed():
	is_host = true
	var err = NetworkManager.create_game()
	if err == OK:
		lobby_code_label.text = "CÓDIGO DE SALA: PORT 8910 (HOST)"
		host_map_container.visible = true
		btn_mp_start.visible = true
		_show_screen(screen_mp_lobby)
	else:
		mp_status_msg.text = "Error al crear la sala: %d" % err

func _on_mp_join_pressed():
	is_host = false
	var ip = room_code_input.text.strip_edges()
	if ip == "":
		ip = "127.0.0.1"
	var err = NetworkManager.join_game(ip)
	if err == OK:
		lobby_code_label.text = "CONECTANDO A %s..." % ip
		host_map_container.visible = false
		btn_mp_start.visible = false
		_show_screen(screen_mp_lobby)
	else:
		mp_status_msg.text = "Error al unirse: %d" % err

func _on_mp_start_pressed():
	get_tree().change_scene_to_file("res://scenes/Game.tscn")
