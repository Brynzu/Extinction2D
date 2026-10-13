class_name AIManager
extends RefCounted

func get_enemies_of(p: Dictionary, players: Array) -> Array:
	var enemies = []
	for other in players:
		if other.id != p.id and other.team != p.team:
			enemies.append(other)
	return enemies

func get_enemy_hqs_of(p: Dictionary, players: Array) -> Array:
	var hqs = []
	for e in get_enemies_of(p, players):
		if e.has("hq") and e.hq != null and e.hq.get("alive", true):
			hqs.append(e.hq)
	return hqs

func get_closest_enemy_hq(p: Dictionary, players: Array, x: float, y: float):
	var hqs = get_enemy_hqs_of(p, players)
	if hqs.is_empty():
		return null
	var closest = hqs[0]
	var min_d = Vector2(closest.x - x, closest.y - y).length()
	for i in range(1, hqs.size()):
		var d = Vector2(hqs[i].x - x, hqs[i].y - y).length()
		if d < min_d:
			min_d = d
			closest = hqs[i]
	return closest

func find_struggling_ally(p: Dictionary, players: Array, units: Array):
	var allies = []
	for other in players:
		if other.id != p.id and other.team == p.team and other.has("hq") and other.hq != null and other.hq.get("alive", true):
			allies.append(other)
	if allies.is_empty():
		return null

	for ally in allies:
		if ally.hq.hp < ally.hq.maxHp * 0.7:
			return ally
		var enemies_near = 0
		for u in units:
			var u_pid = u.get("playerId", u.get("t", -1))
			if u_pid != p.id and u_pid != ally.id:
				if Vector2(u.x - ally.hq.x, u.y - ally.hq.y).length() < 25.0:
					enemies_near += 1
		if enemies_near >= 2:
			return ally
	return null

func update_ai_drones(p: Dictionary, players: Array, units: Array, map_mgr: MapManager):
	var ai_drones = []
	for u in units:
		if (u.get("playerId", -1) == p.id or u.get("t", -1) == p.id) and u.get("isDrone", false):
			ai_drones.append(u)

	if ai_drones.is_empty() or not p.has("hq") or p.hq == null:
		return

	var enemy_units = []
	var enemies = get_enemies_of(p, players)
	for u in units:
		var u_pid = u.get("playerId", u.get("t", -1))
		for e in enemies:
			if e.id == u_pid:
				enemy_units.append(u)
				break

	var struggling_ally = find_struggling_ally(p, players, units)
	var enemy_hq = get_closest_enemy_hq(p, players, p.hq.x, p.hq.y)

	var waiting_drones = []
	for d in ai_drones:
		var at = d.get("attackTarget", null)
		if at == null or (at.get("hp", 0) <= 0 and (not at.get("isHq", false) or not at.get("alive", false))):
			waiting_drones.append(d)

	var swarm_threshold = clampi(p.get("droneSwarmGoal", 4), 3, 7)

	if waiting_drones.size() >= swarm_threshold or (enemy_hq != null and Vector2(enemy_hq.x - p.hq.x, enemy_hq.y - p.hq.y).length() < 20.0):
		var swarm_target = null
		if struggling_ally != null:
			var enemies_near_ally = []
			for u in enemy_units:
				if Vector2(u.x - struggling_ally.hq.x, u.y - struggling_ally.hq.y).length() < 30.0:
					enemies_near_ally.append(u)
			if not enemies_near_ally.is_empty():
				swarm_target = enemies_near_ally[0]

		if swarm_target == null:
			if not enemy_units.is_empty():
				swarm_target = enemy_units[0]
			elif enemy_hq != null:
				swarm_target = { "x": enemy_hq.x, "y": enemy_hq.y, "isHq": true, "alive": true }

		if swarm_target != null:
			for d in waiting_drones:
				d.attackTarget = swarm_target
			p.droneSwarmGoal = 3 + randi() % 5
	else:
		for k in range(waiting_drones.size()):
			var d = waiting_drones[k]
			d.attackTarget = null
			d.tx = clampf(p.hq.x + float((k % 3) - 1) * 2.8, 2.0, map_mgr.C - 2.0)
			d.ty = clampf(p.hq.y + float(int(k / 3) - 1) * 2.8, 2.0, map_mgr.R - 2.0)

func ai_play(p: Dictionary, players: Array, units_mgr: UnitsManager, map_mgr: MapManager, trenches_mgr: TrenchesManager):
	if not p.has("hq") or p.hq == null or not p.hq.get("alive", true):
		return

	if not p.has("droneSwarmGoal"):
		p.droneSwarmGoal = 3 + randi() % 5

	var active_units = []
	for u in units_mgr.U:
		if u.get("playerId", -1) == p.id or u.get("t", -1) == p.id:
			active_units.append(u)

	var ground_count = 0
	var drone_count = 0
	for u in active_units:
		if u.get("isDrone", false):
			drone_count += 1
		else:
			ground_count += 1

	var cards = Config.CARDS
	while active_units.size() < Config.GAME.MAX_UNITS_PER_SIDE:
		var available_indices = []
		for i in range(4):
			if p.cds[i] <= 0.0 and p.res >= cards[i].c and active_units.size() + cards[i].k <= Config.GAME.MAX_UNITS_PER_SIDE:
				available_indices.append(i)

		if available_indices.is_empty():
			break

		var drone_card_index = -1
		var squad_indices = []
		for idx in available_indices:
			if cards[idx].get("isDrone", false):
				drone_card_index = idx
			else:
				squad_indices.append(idx)

		var max_allowed_drones = maxi(2, int(ground_count / 5))
		var deploy_drone = false
		if drone_card_index != -1 and ground_count >= 12 and drone_count < max_allowed_drones:
			deploy_drone = (randf() < 0.50)

		if deploy_drone and drone_card_index != -1:
			p.res -= cards[drone_card_index].c
			p.cds[drone_card_index] = 2.5
			units_mgr.deploy(p, drone_card_index, map_mgr)
			drone_count += 1
		elif not squad_indices.is_empty():
			var chosen_index = squad_indices[randi() % squad_indices.size()]
			p.res -= cards[chosen_index].c
			p.cds[chosen_index] = cards[chosen_index].cd
			units_mgr.deploy(p, chosen_index, map_mgr)
			ground_count += cards[chosen_index].k
		else:
			break

		active_units.clear()
		for u in units_mgr.U:
			if u.get("playerId", -1) == p.id or u.get("t", -1) == p.id:
				active_units.append(u)

	update_ai_drones(p, players, units_mgr.U, map_mgr)
	ai_trench(p, players, units_mgr.U, map_mgr, trenches_mgr)

func ai_trench(p: Dictionary, players: Array, units: Array, map_mgr: MapManager, trenches_mgr: TrenchesManager):
	if not p.has("hq") or p.hq == null or not p.hq.get("alive", true):
		return

	var my_ground_units = []
	for u in units:
		if (u.get("playerId", -1) == p.id or u.get("t", -1) == p.id) and not u.get("isDrone", false):
			my_ground_units.append(u)

	if my_ground_units.is_empty():
		return

	var struggling_ally = find_struggling_ally(p, players, units)
	var target_hq = struggling_ally.hq if struggling_ally != null else get_closest_enemy_hq(p, players, p.hq.x, p.hq.y)
	if target_hq == null:
		return

	var squads_map = {}
	for u in my_ground_units:
		var s_id = u.get("squadId", 0)
		if not squads_map.has(s_id):
			squads_map[s_id] = []
		squads_map[s_id].append(u)

	var squads = squads_map.values()
	for squad_members in squads:
		if squad_members.is_empty():
			continue

		var avg_x = 0.0
		var avg_y = 0.0
		for u in squad_members:
			avg_x += u.x
			avg_y += u.y
		avg_x /= squad_members.size()
		avg_y /= squad_members.size()

		var dx = target_hq.x - avg_x
		var dy = target_hq.y - avg_y
		var dist = Vector2(dx, dy).length()
		if dist == 0.0: dist = 1.0

		var step_dist = minf(dist, 14.0)
		var next_x = clampf(avg_x + (dx / dist) * step_dist, 2.0, map_mgr.C - 2.0)
		var next_y = clampf(avg_y + (dy / dist) * step_dist, 2.0, map_mgr.R - 2.0)

		var t_x = int(next_x)
		var t_y = int(next_y)

		if map_mgr.isT(t_x, t_y):
			trenches_mgr.order_trench(squad_members, t_x, t_y, map_mgr)
		else:
			for k in range(squad_members.size()):
				var member = squad_members[k]
				member.auto = false
				member.enter = false
				member.tx = clampf(next_x + ((k % 2) - 0.5) * 1.5, 0.5, map_mgr.C - 0.5)
				member.ty = clampf(next_y + (floorf(float(k) / 2.0) - 0.5) * 1.5, 0.5, map_mgr.R - 0.5)
