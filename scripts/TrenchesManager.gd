class_name TrenchesManager
extends RefCounted

func bfs(sx: int, sy: int, goal_callable: Callable, map_mgr: MapManager) -> Array:
	var pr = PackedInt16Array()
	pr.resize(map_mgr.C * map_mgr.R)
	pr.fill(-1)
	var s = sy * map_mgr.C + sx
	var q = [s]
	pr[s] = s

	var h = 0
	while h < q.size():
		var k = q[h]
		var cx = k % map_mgr.C
		var cy = (k - cx) / map_mgr.C
		if goal_callable.call(cx, cy):
			var p = []
			var m = k
			while m != s:
				p.push_front([float(m % map_mgr.C) + 0.5, float(m / map_mgr.C) + 0.5])
				m = pr[m]
			return p

		var dirs = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
		for d in dirs:
			var nx = cx + d.x
			var ny = cy + d.y
			var n = ny * map_mgr.C + nx
			if map_mgr.isT(nx, ny) and pr[n] < 0:
				pr[n] = k
				q.append(n)
		h += 1
	return []

func path_out(x: float, y: float, gx: float, gy: float, map_mgr: MapManager) -> Array:
	var sx = int(x)
	var sy = int(y)
	var ex = int(gx)
	var ey = int(gy)

	var bl = func(a: int, b: int) -> bool:
		if a < 0 or b < 0 or a >= map_mgr.C or b >= map_mgr.R:
			return true
		return map_mgr.T[b * map_mgr.C + a] >= 3 and not (a == ex and b == ey) and not (a == sx and b == sy)

	var st = ceil(Vector2(gx - x, gy - y).length() / 0.2)
	var ok = true
	for i in range(1, int(st) + 1):
		var t = float(i) / float(st)
		if bl.call(int(x + (gx - x) * t), int(y + (gy - y) * t)):
			ok = false
			break
	if ok:
		return []

	var pr = PackedInt16Array()
	pr.resize(map_mgr.C * map_mgr.R)
	pr.fill(-1)
	var s = sy * map_mgr.C + sx
	var q = [s]
	pr[s] = s

	var h = 0
	while h < q.size():
		var k = q[h]
		var cx = k % map_mgr.C
		var cy = (k - cx) / map_mgr.C
		if cx == ex and cy == ey:
			var p = []
			var m = k
			while m != s:
				p.push_front([float(m % map_mgr.C) + 0.5, float(m / map_mgr.C) + 0.5])
				m = pr[m]
			return p

		var dirs = [
			Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
			Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)
		]
		for d in dirs:
			var nx = cx + d.x
			var ny = cy + d.y
			if bl.call(nx, ny):
				continue
			if d.x != 0 and d.y != 0 and (bl.call(cx + d.x, cy) or bl.call(cx, cy + d.y)):
				continue
			var n = ny * map_mgr.C + nx
			if pr[n] < 0:
				pr[n] = k
				q.append(n)
		h += 1
	return []

func wpt(u: Dictionary, map_mgr: MapManager) -> Array:
	if u.get("lx", -1.0) != u.tx or u.get("ly", -1.0) != u.ty:
		u.lx = u.tx
		u.ly = u.ty
		u.wp = path_out(u.x, u.y, u.tx, u.ty, map_mgr)

	while not u.get("wp", []).is_empty() and Vector2(u.wp[0][0] - u.x, u.wp[0][1] - u.y).length() < 0.35:
		u.wp.pop_front()

	if not u.get("wp", []).is_empty():
		return u.wp[0]
	return [u.tx, u.ty]

func dmap(gx: int, gy: int, map_mgr: MapManager) -> Dictionary:
	var d = PackedInt16Array()
	d.resize(map_mgr.C * map_mgr.R)
	d.fill(-1)
	var q = [gy * map_mgr.C + gx]
	d[q[0]] = 0

	var h = 0
	while h < q.size():
		var k = q[h]
		var cx = k % map_mgr.C
		var cy = (k - cx) / map_mgr.C
		var dirs = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
		for dir in dirs:
			var a = cx + dir.x
			var b = cy + dir.y
			if map_mgr.isT(a, b) and d[b * map_mgr.C + a] < 0:
				d[b * map_mgr.C + a] = d[k] + 1
				q.append(b * map_mgr.C + a)
		h += 1
	return { "d": d, "q": q }

func odist(u: Dictionary, map_mgr: MapManager) -> PackedInt16Array:
	var od = PackedInt16Array()
	od.resize(map_mgr.C * map_mgr.R)
	od.fill(-1)
	var sx = int(u.x)
	var sy = int(u.y)
	var q = [sy * map_mgr.C + sx]
	od[q[0]] = 0

	var bl = func(a: int, b: int) -> bool:
		if a < 0 or b < 0 or a >= map_mgr.C or b >= map_mgr.R:
			return true
		return map_mgr.T[b * map_mgr.C + a] >= 3 and not (a == sx and b == sy)

	var h = 0
	while h < q.size():
		var k = q[h]
		var cx = k % map_mgr.C
		var cy = (k - cx) / map_mgr.C
		var dirs = [
			Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
			Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)
		]
		for dir in dirs:
			var a = cx + dir.x
			var b = cy + dir.y
			if bl.call(a, b):
				continue
			if dir.x != 0 and dir.y != 0 and (bl.call(cx + dir.x, cy) or bl.call(cx, cy + dir.y)):
				continue
			var n = b * map_mgr.C + a
			if od[n] < 0:
				od[n] = od[k] + 1
				q.append(n)
		h += 1
	return od

func post_tick(units: Array, map_mgr: MapManager):
	var done = {}
	for w in units:
		if w.get("post", null) == null or not w.get("tr", false):
			continue
		var key = "%d:%d,%d" % [w.get("t", -1), w.post[0], w.post[1]]
		if done.has(key):
			continue
		done[key] = true
		var px = w.post[0]
		var py = w.post[1]

		var hold_count = 0
		for u in units:
			if u.get("t", -1) == w.get("t", -1) and u.get("hold", null) != null and u.hold[0] == px and u.hold[1] == py:
				hold_count += 1
		if hold_count >= 2:
			continue

		var cand_list = []
		for u in units:
			if u.get("t", -1) == w.get("t", -1) and u.get("tr", false) and u.get("post", null) != null and u.post[0] == px and u.post[1] == py:
				cand_list.append(u)

		if cand_list.is_empty():
			continue

		var cand = cand_list[0]
		var goal_cb = func(a: int, b: int) -> bool: return a == px and b == py
		var p = bfs(int(cand.x), int(cand.y), goal_cb, map_mgr)
		if not p.is_empty():
			cand.path = p
			cand.hold = [px, py]
			cand.post = null
			cand.exit = null

func order_trench(us: Array, cx: int, cy: int, map_mgr: MapManager):
	us.sort_custom(func(p, r):
		return Vector2(p.x - cx - 0.5, p.y - cy - 0.5).length() < Vector2(r.x - cx - 0.5, r.y - cy - 0.5).length()
	)

	var squad_id = us[0].get("squadId", 0) if not us.is_empty() else 0
	var has_leader = false
	if squad_id > 0:
		for w in us:
			if w.get("squadId", 0) == squad_id and w.get("role", "") == "leader" and w.get("hp", 0) > 0:
				has_leader = true
				break

	if has_leader:
		var role_priority = func(u) -> int:
			var r = u.get("role", "")
			if r == "rifleman": return 1
			if r == "grenadier": return 2
			if r == "machinegunner": return 3
			if r == "leader": return 4
			return 5
		us.sort_custom(func(a, b): return role_priority.call(a) < role_priority.call(b))

	var dres = dmap(cx, cy, map_mgr)
	var q = dres.q
	var is_s = (map_mgr.T[cy * map_mgr.C + cx] == 3)
	var qd = []
	for k in q:
		if map_mgr.T[k] == 4:
			qd.append(k)

	for i in range(us.size()):
		var u = us[i]
		var k = 0
		u.hold = null
		u.post = null

		if is_s and i < 2:
			k = cy * map_mgr.C + cx
			u.hold = [cx, cy]
		elif is_s and not qd.is_empty():
			k = qd[mini(int((i - 2) / 2), qd.size() - 1)]
			u.post = [cx, cy]
		else:
			k = q[mini(int(i / 2), q.size() - 1)]

		var gx = k % map_mgr.C
		var gy = int(k / map_mgr.C)

		if u.get("tr", false):
			var goal_cb = func(a: int, b: int) -> bool: return a == gx and b == gy
			var p = bfs(int(u.x), int(u.y), goal_cb, map_mgr)
			if not p.is_empty():
				u.path = p
				u.exit = null
			continue

		var dm = dmap(gx, gy, map_mgr).d
		var od = odist(u, map_mgr)
		var best = -1
		var bc = 1e9

		for j in map_mgr.TRL:
			if dm[j] < 0:
				continue
			var ex = j % map_mgr.C
			var ey = int(j / map_mgr.C)
			if (!map_mgr.isT(ex + 1, ey) and ex + 1 < map_mgr.C) or (!map_mgr.isT(ex - 1, ey) and ex > 0) or (!map_mgr.isT(ex, ey + 1) and ey + 1 < map_mgr.R) or (!map_mgr.isT(ex, ey - 1) and ey > 0):
				var oc = 1e9
				var dirs = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
				for dir in dirs:
					var nx = ex + dir.x
					var ny = ey + dir.y
					if nx >= 0 and ny >= 0 and nx < map_mgr.C and ny < map_mgr.R and not map_mgr.isT(nx, ny) and od[ny * map_mgr.C + nx] >= 0:
						oc = minf(oc, float(od[ny * map_mgr.C + nx]) + 1.0)
				var c = oc * 5.0 + float(dm[j]) + (3.0 if map_mgr.T[j] == 4 else 0.0)
				if c < bc:
					bc = c
					best = j

		if best < 0:
			continue

		u.auto = false
		u.tx = float(best % map_mgr.C) + 0.5
		u.ty = float(int(best / map_mgr.C)) + 0.5
		u.enter = true
		u.gc = [gx, gy]
		u.exit = null
		u.path = []
