extends Node

signal player_connected(id)
signal player_disconnected(id)
signal server_disconnected

const DEFAULT_PORT = 8910
const MAX_CLIENTS = 6

var peer: ENetMultiplayerPeer
var players = {}

func _ready():
	multiplayer.peer_connected.connect(_on_player_connected)
	multiplayer.peer_disconnected.connect(_on_player_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_ok)
	multiplayer.connection_failed.connect(_on_connected_fail)
	multiplayer.server_disconnected.connect(_on_server_disconnected)

func create_game(port: int = DEFAULT_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var error = peer.create_server(port, MAX_CLIENTS)
	if error != OK:
		return error
	multiplayer.multiplayer_peer = peer
	players[1] = { "id": 1, "name": "Host", "team": "A", "color": "blue" }
	return OK

func join_game(address: String, port: int = DEFAULT_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var error = peer.create_client(address, port)
	if error != OK:
		return error
	multiplayer.multiplayer_peer = peer
	return OK

func _on_player_connected(id):
	player_connected.emit(id)

func _on_player_disconnected(id):
	players.erase(id)
	player_disconnected.emit(id)

func _on_connected_ok():
	pass

func _on_connected_fail():
	multiplayer.multiplayer_peer = null

func _on_server_disconnected():
	players.clear()
	server_disconnected.emit()
