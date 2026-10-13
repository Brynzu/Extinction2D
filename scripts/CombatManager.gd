class_name CombatManager
extends RefCounted

var B: Array = []
var explosions: Array = []
var next_bullet_id: int = 1
var next_explosion_id: int = 1

func clear_bullets():
	B.clear()
	explosions.clear()
	next_bullet_id = 1
	next_explosion_id = 1

func filter_bullets() -> Array:
	var valid = []
	for b in B:
		if b.get("l", 0.0) > 0.0 and not b.get("dead", false):
			valid.append(b)
	B = valid
	return B

func filter_explosions() -> Array:
	var valid = []
	for ex in explosions:
		if ex.get("l", 0.0) > 0.0:
			valid.append(ex)
	explosions = valid
	return explosions

func losT(s: Dictionary, e: Dictionary, map_mgr: MapManager) -> bool:
	var dist = Vector2(e.x - s.x, e.y - s.y).length()
	var n = max(1, ceil(dist / 0.3))
	for i in range(n + 1):
		var t = float(i) / float(n)
		var px = int(s.x + (e.x - s.x) * t)
		var py = int(s.y + (e.y - s.y) * t)
		if not map_mgr.isT(px, py):
			return false
	return true

func can_hit(s: Dictionary, e: Dictionary, map_mgr: MapManager) -> bool:
	if s.get("isDrone", false) or e.get("isDrone", false):
		return true
	if not map_mgr.deep(s) and not map_mgr.deep(e):
		return true
	return s.get("tr", false) and e.get("tr", false) and map_mgr.TC[map_mgr.ci(s)] == map_mgr.TC[map_mgr.ci(e)] and losT(s, e, map_mgr)

func hit_ok(b: Dictionary, e: Dictionary, map_mgr: MapManager) -> bool:
	if e.get("isDrone", false):
		return true
	var same = e.get("tr", false) and b.get("tn", -1) >= 0 and map_mgr.TC[map_mgr.ci(e)] == b.get("tn", -1)
	return same if (map_mgr.deep(e) or b.get("dp", 0) != 0) else true

func vr(e: Dictionary, o: Dictionary, map_mgr: MapManager) -> float:
	if e.get("isDrone", false):
		return Config.VISIBILITY.VISION_DEFAULT
	var k = map_mgr.tt(e.x, e.y)
	if k == 4 and e.get("tr", false):
		return 5.0 if (o.get("tr", false) and map_mgr.TC[map_mgr.ci(o)] == map_mgr.TC[map_mgr.ci(e)]) else 0.0
	elif k == 1:
		return 3.0
	else:
		return 8.0

func are_enemies(id1: int, id2: int, players: Array = []) -> bool:
	if id1 == id2:
		return false
	if players.is_empty():
		return id1 != id2
	var p1 = null
	var p2 = null
	for p in players:
		if p.id == id1:
			p1 = p
		if p.id == id2:
			p2 = p
	if p1 == null or p2 == null:
		return id1 != id2
	return p1.team != p2.team

func vis(dt: float, units: Array, map_mgr: MapManager, players: Array = []):
	for e in units:
		e.rev = maxf(0.0, e.rev - dt)
		e.seen = e.rev > 0.0
		if not e.seen:
			for o in units:
				var o_pid = o.get("playerId", o.get("t", -1))
				var e_pid = e.get("playerId", e.get("t", -1))
				if are_enemies(o_pid, e_pid, players):
					var vision = Config.VISIBILITY.VISION_DRONE if o.get("isDrone", false) else vr(e, o, map_mgr)
					if Vector2(o.x - e.x, o.y - e.y).length() <= vision:
						e.seen = true
						break

func trigger_explosion(x: float, y: float, radius_mult: float, units: Array, players: Array = []):
	var ex_id = "ex_%d" % next_explosion_id
	next_explosion_id += 1
	explosions.append({ "id": ex_id, "x": x, "y": y, "l": 0.4, "maxL": 0.4 })

	var direct_radius = 0.6 * radius_mult
	var splash_radius = 1.1 * radius_mult

	for victim in units:
		var dist = Vector2(victim.x - x, victim.y - y).length()
		if dist <= direct_radius:
			victim.hp = 0
		elif dist <= splash_radius:
			victim.hp -= 1.5

	for p in players:
		if p.has("hq") and p.hq != null and p.hq.get("alive", true):
			var dist = Vector2(p.hq.x - x, p.hq.y - y).length()
			if dist <= direct_radius:
				p.hq.hp -= 30
			elif dist <= splash_radius:
				p.hq.hp -= 15
			if p.hq.hp <= 0:
				p.hq.hp = 0
				p.hq.alive = false

func update_combat(dt: float, units: Array, map_mgr: MapManager, players: Array = [], is_client_only: bool = false):
	if is_client_only:
		filter_explosions()
		for ex in explosions:
			ex.l -= dt
		for b in B:
			b.l -= dt
			b.x += b.vx * dt
			b.y += b.vy * dt
		filter_bullets()
		return

	filter_explosions()
	for ex in explosions:
		ex.l -= dt

	for u in units:
		var u_pid = u.get("playerId", u.get("t", -1))
		u.cd -= dt

		if u.get("isDrone", false):
			var target = null
			if u.get("attackTarget", null) != null:
				var at = u.attackTarget
				if at.get("hp", 0) > 0 or (at.get("isHq", false) and at.get("alive", false)):
					target = at

			if target == null:
				var bd = 15.0
				for e in units:
					var e_pid = e.get("playerId", e.get("t", -1))
					if are_enemies(u_pid, e_pid, players) and e.get("seen", false):
						var d = Vector2(e.x - u.x, e.y - u.y).length()
						if d < bd:
							bd = d
							target = e
				if target == null:
					for p in players:
						if are_enemies(u_pid, p.id, players) and p.has("hq") and p.hq != null and p.hq.get("alive", true):
							var d = Vector2(p.hq.x - u.x, p.hq.y - u.y).length()
							if d < bd:
								bd = d
								target = { "x": p.hq.x, "y": p.hq.y, "isHq": true, "hqObj": p.hq, "alive": true }

			if target != null:
				u.tx = target.x
				u.ty = target.y
				if Vector2(target.x - u.x, target.y - u.y).length() <= 0.8:
					u.hp = 0
					trigger_explosion(u.x, u.y, 1.2, units, players)
					continue
			continue

		var tg = null
		if u.get("attackTarget", null) != null:
			var at = u.attackTarget
			if at.get("hp", 0) > 0 or (at.get("isHq", false) and at.get("alive", false)):
				tg = at

		var bd = Config.COMBAT.RANGE_DEFAULT

		if tg == null:
			for e in units:
				var e_pid = e.get("playerId", e.get("t", -1))
				if are_enemies(u_pid, e_pid, players):
					var d = Vector2(e.x - u.x, e.y - u.y).length()
					var max_r = Config.COMBAT.RANGE_FOREST if map_mgr.tt(e.x, e.y) == 1 else Config.COMBAT.RANGE_DEFAULT
					if d < bd and d <= max_r and can_hit(u, e, map_mgr) and e.get("seen", false):
						bd = d
						tg = e
			if tg == null:
				for p in players:
					if are_enemies(u_pid, p.id, players) and p.has("hq") and p.hq != null and p.hq.get("alive", true):
						var d = Vector2(p.hq.x - u.x, p.hq.y - u.y).length()
						if d < bd and d <= Config.COMBAT.RANGE_DEFAULT:
							bd = d
							tg = { "x": p.hq.x, "y": p.hq.y, "isHq": true, "hqObj": p.hq, "alive": true, "hp": p.hq.hp }
		else:
			bd = Vector2(tg.x - u.x, tg.y - u.y).length()

		var had = u.get("cb", false)
		u.cb = (tg != null)

		if tg != null and not had:
			u.rd = randf() * Config.COMBAT.REACTION_MAX
			if not u.get("tr", false) and u.get("savedMoveTarget", null) == null and Vector2(u.tx - u.x, u.ty - u.y).length() >= 0.3:
				u.savedMoveTarget = {
					"tx": u.tx,
					"ty": u.ty,
					"auto": u.get("auto", false),
					"enter": u.get("enter", false),
					"gc": u.get("gc", null),
					"path": u.get("path", []).duplicate(),
					"exit": u.get("exit", null),
					"hold": u.get("hold", null),
					"post": u.get("post", null)
				}

		if tg == null and had:
			if u.get("savedMoveTarget", null) != null:
				var smt = u.savedMoveTarget
				u.tx = smt.tx
				u.ty = smt.ty
				u.auto = smt.auto
				u.enter = smt.enter
				u.gc = smt.gc
				u.path = smt.path
				u.exit = smt.exit
				u.hold = smt.hold
				u.post = smt.post
				u.savedMoveTarget = null

		if u.get("rd", 0.0) > 0.0:
			u.rd -= dt

		if tg != null and bd > 0.0 and not u.get("tr", false) and not u.get("enter", false):
			u.ct = u.get("ct", 0.0) - dt
			if u.ct <= 0.0:
				u.ct = 0.5
				var nx = (tg.x - u.x) / bd
				var ny = (tg.y - u.y) / bd
				if map_mgr.tt(u.x + nx * 0.9, u.y + ny * 0.9) != 1:
					var best = null
					var bs = 16.0
					for j in range(-4, 5):
						for i in range(-4, 5):
							var cx = int(u.x) + i
							var cy = int(u.y) + j
							if cx < 0 or cy < 0 or cx >= map_mgr.C or cy >= map_mgr.R or map_mgr.T[cy * map_mgr.C + cx] != 1:
								continue
							var px = cx + 0.5
							var py = cy + 0.5
							var ex = tg.x - px
							var ey = tg.y - py
							var el = Vector2(ex, ey).length()
							if el == 0.0: el = 1.0
							var hx = clampf(px - (ex / el) * 1.1, 0.5, map_mgr.C - 0.5)
							var hy = clampf(py - (ey / el) * 1.1, 0.5, map_mgr.R - 0.5)
							var d2 = (hx - u.x) * (hx - u.x) + (hy - u.y) * (hy - u.y)
							if d2 < bs and not map_mgr.isT(int(hx), int(hy)):
								bs = d2
								best = Vector2(hx, hy)
					if best != null:
						u.tx = best.x
						u.ty = best.y
						u.auto = true

		if u.get("grenadeCd", 0.0) > 0.0:
			u.grenadeCd -= dt

		if u.get("role", "") == "grenadier" and tg != null and bd <= 7.0 and u.grenadeCd <= 0.0 and u.rd <= 0.0:
			u.grenadeCd = 15.0
			trigger_explosion(tg.x, tg.y, 1.0, units, players)
			u.rev = Config.COMBAT.SHOT_REVEAL_TIME

		if tg != null and bd > 0.0 and u.cd <= 0.0 and u.rd <= 0.0:
			var is_lmg = (u.get("role", "") == "machinegunner")
			var attack_cooldown = Config.COMBAT.ATTACK_COOLDOWN

			if is_lmg:
				u.burstShots = u.get("burstShots", 0) + 1
				if u.burstShots < 5:
					attack_cooldown = 0.07
				else:
					u.burstShots = 0
					attack_cooldown = 1.5

			var dispersion_mult = 1.35 if is_lmg else 1.0
			var is_moving = Vector2(u.tx - u.x, u.ty - u.y).length() > 0.1

			var an = atan2(tg.y - u.y, tg.x - u.x) + (randf() - 0.5) * 2.0 * (Config.COMBAT.DISPERSION_BASE + Config.COMBAT.DISPERSION_DIST * bd) * dispersion_mult * (Config.COMBAT.DISPERSION_MOVING_MULT if is_moving else 1.0) * (Config.COMBAT.DISPERSION_TRENCH_DEEP_MULT if map_mgr.deep(u) else 1.0) * (Config.COMBAT.DISPERSION_DRONE_MULT if tg.get("isDrone", false) else 1.0)

			var bullet_id = "b_%d_%d" % [next_bullet_id, u_pid]
			next_bullet_id += 1

			B.append({
				"id": bullet_id,
				"x": u.x,
				"y": u.y,
				"sx": u.x,
				"sy": u.y,
				"tn": map_mgr.TC[map_mgr.ci(u)] if u.get("tr", false) else -1,
				"dp": 1 if (map_mgr.deep(u) or map_mgr.deep(tg)) else 0,
				"vx": cos(an) * Config.COMBAT.BULLET_SPEED,
				"vy": sin(an) * Config.COMBAT.BULLET_SPEED,
				"t": u_pid,
				"playerId": u_pid,
				"l": Config.COMBAT.BULLET_LIFETIME,
				"dead": false
			})
			u.cd = attack_cooldown
			u.rev = Config.COMBAT.SHOT_REVEAL_TIME

	for b in B:
		b.l -= dt
		var ns = ceil((Config.COMBAT.BULLET_SPEED * dt) / 0.15)
		var h = dt / float(ns)
		var bullet_pid = b.get("playerId", b.get("t", -1))

		for s in range(int(ns)):
			if b.get("dead", false):
				break
			b.x += b.vx * h
			b.y += b.vy * h

			for e in units:
				var e_pid = e.get("playerId", e.get("t", -1))
				if are_enemies(bullet_pid, e_pid, players) and Vector2(e.x - b.x, e.y - b.y).length() < Config.COMBAT.BULLET_HIT_RADIUS and hit_ok(b, e, map_mgr):
					var dmg_mult = Config.COMBAT.TRENCH_SHALLOW_DAMAGE_MULT if (map_mgr.tt(e.x, e.y) == 3 and b.tn < 0) else 1.0
					e.hp -= Config.COMBAT.BULLET_DAMAGE * dmg_mult
					b.dead = true
					break

			if not b.get("dead", false):
				for p in players:
					if are_enemies(bullet_pid, p.id, players) and p.has("hq") and p.hq != null and p.hq.get("alive", true):
						if Vector2(p.hq.x - b.x, p.hq.y - b.y).length() < 1.5:
							p.hq.hp -= Config.COMBAT.BULLET_DAMAGE
							if p.hq.hp <= 0:
								p.hq.hp = 0
								p.hq.alive = false
							b.dead = true
							break

			if not b.get("dead", false) and map_mgr.tt(b.x, b.y) == 1 and Vector2(b.x - floorf(b.x) - 0.5, b.y - floorf(b.y) - 0.5).length() < 0.15 and Vector2(b.x - b.sx, b.y - b.sy).length() > 1.6:
				b.dead = true

			if b.get("dp", 0) != 0 and not map_mgr.isT(int(b.x), int(b.y)):
				b.dead = true

	filter_bullets()
