class_name MapManager
extends RefCounted

var C: int = Config.GRID.COLUMNS
var R: int = Config.GRID.ROWS
var S: int = Config.GRID.CELL_SIZE

var v: PackedFloat32Array
var T: PackedByteArray
var TC: PackedInt32Array
var TRL: Array = []

func _init(cols: int = Config.GRID.COLUMNS, rows: int = Config.GRID.ROWS):
	update_dimensions(cols, rows)

func update_dimensions(cols: int, rows: int):
	C = cols
	R = rows
	v.resize(C * R)
	v.fill(0.0)
	T.resize(C * R)
	T.fill(0)
	TC.resize(C * R)
	TC.fill(-1)

func tt(x: float, y: float) -> int:
	var cy = clamp(int(y), 0, R - 1)
	var cx = clamp(int(x), 0, C - 1)
	return T[cy * C + cx]

func deep(u: Dictionary) -> bool:
	return u.get("tr", false) and tt(u.x, u.y) == 4

func isT(a: int, b: int) -> bool:
	return a >= 0 and b >= 0 and a < C and b < R and T[b * C + a] >= 3

func ci(u: Dictionary) -> int:
	return int(u.y) * C + int(u.x)

func blob(cx: float, cy: float, r: float):
	for y in range(R):
		for x in range(C):
			if Vector2(x - cx, y - cy).length() < r and randf() < 0.75:
				T[y * C + x] = 1

func would_form_2x2(x: int, y: int) -> bool:
	var quads = [
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)],
		[Vector2i(-1, 0), Vector2i(0, 0), Vector2i(-1, 1), Vector2i(0, 1)],
		[Vector2i(0, -1), Vector2i(1, -1), Vector2i(0, 0), Vector2i(1, 0)],
		[Vector2i(-1, -1), Vector2i(0, -1), Vector2i(-1, 0), Vector2i(0, 0)]
	]
	for q in quads:
		var count = 0
		for offset in q:
			if offset == Vector2i.ZERO:
				continue
			if isT(x + offset.x, y + offset.y):
				count += 1
		if count == 3:
			return true
	return false

func generate_linear_trench_network(startX: int, startY: int):
	var cells = []
	var isHorizontal = randf() < 0.5
	var mainDir = Vector2i(1, 0) if isHorizontal else Vector2i(0, 1)
	if randf() < 0.5:
		mainDir = -mainDir

	var cx = startX
	var cy = startY
	var mainLength = 14 + randi() % 12

	for i in range(mainLength):
		if cx < 15 or cx >= C - 15 or cy < 8 or cy >= R - 8:
			break
		if not would_form_2x2(cx, cy):
			T[cy * C + cx] = 4
			cells.append([cx, cy, i])

		if i > 1 and i < mainLength - 2 and randf() < 0.45:
			var branchDirs = [Vector2i(0, 1), Vector2i(0, -1)] if isHorizontal else [Vector2i(1, 0), Vector2i(-1, 0)]
			var bDir = branchDirs[randi() % branchDirs.size()]
			var bx = cx + bDir.x
			var by = cy + bDir.y
			var branchLength = 4 + randi() % 6

			for j in range(branchLength):
				if bx < 15 or bx >= C - 15 or by < 8 or by >= R - 8:
					break
				if not would_form_2x2(bx, by):
					T[by * C + bx] = 4
					cells.append([bx, by, j])
				else:
					break

				if j == branchLength - 1 and randf() < 0.5:
					var subDirs = [Vector2i(1, 0), Vector2i(-1, 0)] if isHorizontal else [Vector2i(0, 1), Vector2i(0, -1)]
					var sDir = subDirs[randi() % subDirs.size()]
					var sx = bx + sDir.x
					var sy = by + sDir.y
					if sx >= 15 and sx < C - 15 and sy >= 8 and sy < R - 8 and not would_form_2x2(sx, sy):
						T[sy * C + sx] = 4
						cells.append([sx, sy, 0])

				bx += bDir.x
				by += bDir.y

		cx += mainDir.x
		cy += mainDir.y

	for cell in cells:
		var x = cell[0]
		var y = cell[1]
		var neighborCount = 0
		var dirs = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
		for d in dirs:
			if isT(x + d.x, y + d.y):
				neighborCount += 1
		if neighborCount <= 1:
			T[y * C + x] = 3
		else:
			T[y * C + x] = 4

func recompute_trench_structures():
	TRL.clear()
	for i in range(C * R):
		if T[i] >= 3:
			TRL.append(i)

	TC.fill(-1)
	var nc = 0
	for s0 in TRL:
		if TC[s0] < 0:
			var q = [s0]
			TC[s0] = nc
			var h = 0
			while h < q.size():
				var k = q[h]
				var cx = k % C
				var cy = (k - cx) / C
				var dirs = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
				for d in dirs:
					var a = cx + d.x
					var b = cy + d.y
					if isT(a, b) and TC[b * C + a] < 0:
						TC[b * C + a] = nc
						q.append(b * C + a)
				h += 1
			nc += 1

func init_map(preset: String = "default", players: Array = [], customGridT = null):
	var active_combatants = []
	for p in players:
		if p.get("team", "") != "SPECTATOR" and not p.get("isSpectator", false):
			active_combatants.append(p)

	var scale = 1.0
	if active_combatants.size() >= 5:
		scale = 2.0
	elif active_combatants.size() >= 3:
		scale = 1.5

	var newC = roundi(Config.GRID.COLUMNS * scale)
	var newR = roundi(Config.GRID.ROWS * scale)
	update_dimensions(newC, newR)

	T.fill(0)
	v.fill(0.0)

	if customGridT != null and customGridT.size() == T.size():
		for i in range(customGridT.size()):
			T[i] = customGridT[i]
	else:
		var numForests = roundi(35 * scale * scale)
		var numTrenches = roundi(3 * scale)

		if preset == "forest":
			numForests = roundi(75 * scale * scale)
			numTrenches = roundi(1 * scale)
		elif preset == "trench":
			numForests = roundi(10 * scale * scale)
			numTrenches = roundi(7 * scale)

		for i in range(numForests):
			blob(10 + randf() * (C - 20), 6 + randf() * (R - 12), 2 + randf() * 2)

		for i in range(numTrenches):
			var clusterX = int(25 + (i * (C - 50)) / max(1, numTrenches) + randf() * 6)
			var clusterY = int(15 + randf() * (R - 30))
			generate_linear_trench_network(clusterX, clusterY)

	for p in players:
		if not p.has("hq") or p.hq == null:
			continue
		var hx = int(p.hq.x)
		var hy = int(p.hq.y)
		var rad = 14
		for y in range(max(0, hy - rad), min(R - 1, hy + rad) + 1):
			for x in range(max(0, hx - rad), min(C - 1, hx + rad) + 1):
				if Vector2(x - hx, y - hy).length() <= rad:
					v[y * C + x] = float(p.id)

	recompute_trench_structures()
