# Frente — prototipo de juego de conquista de territorio

RTS 2D en vista cenital para móvil y navegador. Tema: guerra de trincheras moderna con drones (los drones aún no están implementados). Todo son círculos de colores. Azul = jugador, rojo = IA.

**Estado:** prototipo jugable en un solo archivo (`index.html`, HTML + CSS + JS sin dependencias). Se abre directamente en el navegador. Interfaz en español.

## Tareas sugeridas (en orden)

1. Refactorizar `index.html` en módulos (`map`, `units`, `combat`, `trenches`, `ai`, `input`, `render`) **sin cambiar el comportamiento**.
2. Pantalla de victoria/derrota (hoy no hay condición de fin).
3. Mapa más grande con cámara (arrastrar para mover, pellizcar para zoom). Cuidado: arrastrar ya se usa para el recuadro de selección.
4. Mejorar la IA (hoy es muy simple, ver abajo).
5. Drones (unidad aérea: ignora terreno, frágil).
6. Pruebas para `bfs`, `pathOut`, `orderTrench`, `postTick`.

## Mapa y terreno

- Cuadrícula 24×36 celdas (20 px por celda). Rojo arriba, azul abajo.
- `T[celda]`: 0 abierto, 1 bosque, 3 trinchera superficial, 4 trinchera baja.
- Territorio `v[celda]` en [-1, 1] (azul > 0, rojo < 0). Cada unidad empuja el valor de las celdas en radio 3 a 0.8/s hacia su bando. Al inicio rojo posee 9 filas arriba y azul 9 abajo.
- Bosques: 10 manchas aleatorias. Copa dibujada encima de unidades y balas; el tronco (radio 0.15 celdas) es lo único que frena balas.
- Trincheras: 3 líneas horizontales (filas 12, 18, 24), largo 10–13. Los 2 extremos son superficiales, el centro es bajo, más una rama vertical de 4 celdas que termina en superficial. Cada red conectada tiene id en `TC[]`.

## Unidades

- Vida 3, radio dibujado 0.3 celdas. Velocidad: azul 2.5 celdas/s, rojo 1.6. En combate ×0.35.
- No se amontonan: empuje suave (`sep`, distancia mínima 0.55). Dentro de trincheras se quedan en trinchera.
- Las trincheras son obstáculos para unidades fuera de ellas (rodean con `pathOut`, BFS 8 direcciones) y hay colisión dura.

## Combate

- Alcance 7 celdas (3 si el objetivo está en bosque). Cadencia 1 s. Reacción aleatoria 0–0.5 s al detectar un enemigo nuevo.
- Bala: 22 celdas/s, vida 0.5 s (sigue de largo si falla), daño 1. Radio de impacto 0.6.
- Precisión: error de ángulo ±(0.08 + 0.02·distancia) rad, ×1.5 si el tirador se mueve, ×0.45 si está en trinchera baja.
- Trinchera superficial: daño ×0.3 contra disparos de fuera de trincheras; sin protección contra disparos de otra trinchera.
- Trinchera baja: inmune a disparos exteriores y no dispara hacia fuera. Combate solo dentro de la misma red conectada y con línea recta por celdas de trinchera (con superficiales conectadas en ambos sentidos).
- Cobertura automática: si está en combate, quieto y sin cobertura, busca un árbol a ≤4 celdas y se coloca detrás respecto al enemigo más cercano. No lo hace dentro de trincheras.

## Visibilidad (niebla de unidades)

- Un enemigo solo se ve si está a ≤8 celdas de una unidad propia (≤3 en bosque).
- En trinchera baja solo lo ve un enemigo en la misma red a ≤5 celdas.
- Quien dispara queda visible 0.8 s.
- No se puede disparar a lo que no se ve. Las balas enemigas lejos de unidades azules no se dibujan.

## Cartas y recursos

- 4 cartas idénticas: escuadra de 3 soldados, costo 3, recarga 8 s por carta.
- Recurso máx. 10, inicia en 5, regenera 0.4 + 1.2 × (fracción de territorio propio) por segundo.
- Solo se despliega en territorio propio (`v > 0.3`). Máx. 25 unidades por bando.
- La IA usa las mismas cartas: cada 2–5 s, despliega en una celda propia lo más cercana al frente.

## Controles (táctil)

- Tocar unidad azul: seleccionar. Doble toque en unidad: seleccionar todas.
- Arrastrar recuadro: seleccionar las de dentro; si no hay ninguna, deselecciona.
- Tocar el mapa: mover seleccionadas. Elegir carta y tocar territorio azul: desplegar.
- Tocar celda de trinchera: las unidades entran. Entre varias entradas se elige la de menor costo real (camino por fuera + recorrido por dentro; entrar por celda baja suma 3). Varias unidades se reparten de 2 en 2 a lo largo de la trinchera.
- Dentro de trinchera: tocar otra celda de trinchera mueve por dentro (BFS). Doble toque en terreno: salen por la superficial más cercana.
- Una celda superficial admite 2 unidades asignadas; las demás esperan en celdas bajas cercanas y suben a ocupar un hueco cuando alguien muere o se va (`postTick`, cada 0.5 s).

## IA actual

- Despliega cartas (ver arriba).
- Unidades sueltas vagan al azar entre las filas 3 y 25 (se detienen al combatir y buscan cobertura).
- Guarnición: intenta mantener 35% de sus unidades en trincheras fuera de territorio azul, prefiere celdas superficiales y patrulla dentro de la misma red.
- No tiene estrategia de ataque, defensa de territorio ni uso de cartas por situación.

## Mapa del código (funciones principales en `index.html`)

- Datos: `v` (territorio), `T` (terreno), `TC` (red de trinchera), `U` (unidades), `B` (balas), `CARDS`, `P`/`E` (recursos y recargas del jugador y la IA).
- Bucle: `step(now)` → movimiento, captura, IA (`aiPlay`, `aiTrench`), visibilidad (`vis`), separación (`sep`), combate y cobertura, balas, `ui()`, `draw()`.
- Rutas: `bfs` (dentro de trincheras), `pathOut` + `wpt` (fuera), `dmap`, `odist`, `orderTrench`, `postTick`, `patrol`.
- Entrada: `tap`, y los eventos `pointerdown/move/up` (recuadro de selección y doble toque).

## Notas para balanceo

Todos los números están sueltos en el código (velocidades, alcance, dispersión, costos, recargas). Conviene moverlos a un objeto de configuración al refactorizar.
