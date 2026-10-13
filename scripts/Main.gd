extends Node2D

@onready var btn_singleplayer = $CanvasLayer/UI/MainMenu/BtnSingleplayer
@onready var btn_host = $CanvasLayer/UI/MainMenu/BtnHost
@onready var btn_join = $CanvasLayer/UI/MainMenu/BtnJoin
@onready var ip_input = $CanvasLayer/UI/MainMenu/IPInput

func _ready():
	btn_singleplayer.pressed.connect(_on_sp_pressed)
	btn_host.pressed.connect(_on_host_pressed)
	btn_join.pressed.connect(_on_join_pressed)

func _on_sp_pressed():
	print("Starting Singleplayer mode.")

func _on_host_pressed():
	var err = NetworkManager.create_game()
	if err == OK:
		print("Server host created on port 8910")
	else:
		print("Failed to create server:", err)

func _on_join_pressed():
	var ip = ip_input.text.strip_edges()
	if ip == "":
		ip = "127.0.0.1"
	var err = NetworkManager.join_game(ip)
	if err == OK:
		print("Connecting to server:", ip)
	else:
		print("Failed to join server:", err)
