class_name UnitsManager
extends RefCounted

var U: Array = []
var next_squad_id: int = 1

func reset_squad_counter():
	next_squad_id = 1

func cnt(player_id: int) -> int:
	var count = 0
	for u in U:
		if u.get("playerId", -1) == player_id or u.get("t", -1) == player_id:
			count += 1
	return count

func add_unit(player_id: int, x: float, y: float, target_x: float = -1.0, target_y: float = -1.0, is_drone: bool = false, squad_id: int = 0, role: String = "rifleman") -> Dictionary:
	if target_x < 0.0:
		target_x = x
	if target_y < 0.0:
		target_y = y

	var unit = {
		"playerId": player_id,
		"t": player_id,
		"x": x,
		"y": y,
		"tx": target_x,
		"ty": target_y,
		"s": false,
		"tm": 0.0,
		"hp": Config.UNITS.DEFAULT_HP,
		"mh": Config.UNITS.DEFAULT_HP,
		"sp": 4.5 if is_drone else 1.0,
		"isDrone": is_drone,
		"evasion": 75 if is_drone else 0,
		"squadId": squad_id,
		"role": role,
		"grenadeCd": 0.0,
		"burstShots": 0,
		"tr": false,
		"path": [],
		"exit": null,
		"enter": false,
		"gar": false,
		"seen": false,
		"rev": 0.0,
		"wp": [],
		"lx": -1.0,
		"ly": -1.0,
		"rd": 0.0,
		"gc": null,
		"hold": null,
		"post": null,
		"cd": randf(),
		"ct": 0.0,
		"auto": false,
		"attackTarget": null,
		"savedMoveTarget": null
	}
	U.append(unit)
	return unit

func deploy(player: Dictionary, card_index: int, map_mgr: MapManager):
	if card_index < 0 or card_index >= Config.CARDS.size():
		return
	var c = Config.CARDS[card_index]
	if not player.has("hq") or player.hq == null or not player.hq.get("alive", true):
		return

	var spawn_x = player.hq.spawnX
	var spawn_y = player.hq.spawnY
	var hq_x = player.hq.x
	var hq_y = player.hq.y

	var is_drone = c.get("isDrone", false)
	var squad_id = 0 if is_drone else next_squad_id
	if not is_drone:
		next_squad_id += 1

	var roles = ["drone"] if is_drone else ["leader", "machinegunner", "grenadier", "rifleman", "rifleman"]

	for k in range(c.k):
		var start_x = clampf(spawn_x + ((k % 2) - 0.5) * 1.2, 0.5, map_mgr.C - 0.5)
		var start_y = clampf(spawn_y + (floorf(float(k) / 2.0) - 0.5) * 1.2, 0.5, map_mgr.R - 0.5)
		var target_x = clampf(hq_x + ((k % 2) - 0.5) * 1.2, 0.5, map_mgr.C - 0.5)
		var target_y = clampf(hq_y + (floorf(float(k) / 2.0) - 0.5) * 1.2, 0.5, map_mgr.R - 0.5)

		var role = roles[k % roles.size()]
		var u = add_unit(player.id, start_x, start_y, target_x, target_y, is_drone, squad_id, role)
		u.hp = c.hp
		u.mh = c.hp
		u.sp = c.sp

func nudge(u: Dictionary, mx: float, my: float, map_mgr: MapManager):
	var nx = clampf(u.x + mx, 0.3, map_mgr.C - 0.3)
	var ny = clampf(u.y + my, 0.3, map_mgr.R - 0.3)

	if u.get("isDrone", false):
		u.x = nx
		u.y = ny
		return

	var check_func = func(a: float, b: float) -> bool:
		if u.get("tr", false):
			return map_mgr.isT(int(a), int(b))
		else:
			return not map_mgr.isT(int(a), int(b)) or map_mgr.isT(int(u.x), int(u.y))

	if check_func.call(nx, ny):
		u.x = nx
		u.y = ny
	elif check_func.call(nx, u.y):
		u.x = nx
	elif check_func.call(u.x, ny):
		u.y = ny

func sep(map_mgr: MapManager):
	for i in range(U.size()):
		for j in range(i + 1, U.size()):
			var a = U[i]
			var b = U[j]

			var a_drone = a.get("isDrone", false)
			var b_drone = b.get("isDrone", false)

			if a_drone and b_drone:
				var dx = b.x - a.x
				var dy = b.y - a.y
				var d = Vector2(dx, dy).length()
				var drone_sep_dist = 0.85
				if d >= drone_sep_dist:
					continue
				if d < 0.001:
					dx = (randf() - 0.5) * 0.1
					dy = (randf() - 0.5) * 0.1
					d = Vector2(dx, dy).length()
					if d < 0.001:
						d = 0.1
				var p = ((drone_sep_dist - d) * 0.3) / d
				a.x = clampf(a.x - dx * p, 0.5, map_mgr.C - 0.5)
				a.y = clampf(a.y - dy * p, 0.5, map_mgr.R - 0.5)
				b.x = clampf(b.x + dx * p, 0.5, map_mgr.C - 0.5)
				b.y = clampf(b.y + dy * p, 0.5, map_mgr.R - 0.5)
				continue

			if a_drone or b_drone:
				continue

			var dx = b.x - a.x
			var dy = b.y - a.y
			var d = Vector2(dx, dy).length()
			var sep_dist = Config.UNITS.SEPARATION_DIST
			if d >= sep_dist:
				continue
			if d < 0.001:
				dx = randf() - 0.5
				dy = randf() - 0.5
				d = Vector2(dx, dy).length()
				if d < 0.001:
					d = 1.0
			var p = ((sep_dist - d) * 0.25) / d
			nudge(a, -dx * p, -dy * p, map_mgr)
			nudge(b, dx * p, dy * p, map_mgr)
