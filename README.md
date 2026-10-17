# Solitario Klondike

El solitario clásico de toda la vida, hecho para el navegador con TypeScript, Vite y Tailwind CSS. Se juega con ratón, teclado o pantalla táctil.

**[Jugar ahora →](https://sergiobytes.github.io/klondike-devcrafters/)**

## Características

- **Arrastrar y soltar** cartas o escaleras completas, con ratón o con el dedo. Al arrastrar se ilumina el destino válido y, si sueltas en un sitio que no vale, las cartas vuelven a su lugar.
- **Deshacer** jugadas sin límite práctico (hasta 300 seguidas).
- **3 pistas por partida**: la carta sugerida y su destino parpadean en dorado durante unos segundos.
- **Detección de fin de partida**: si ya no queda ninguna jugada útil, el juego te avisa y te ofrece deshacer o empezar otra.
- **Autocompletar**: cuando todas las cartas del tablero están boca arriba, un botón termina la partida por ti.
- **Cronómetro**, **movimientos** y **puntuación** en todo momento. El reloj arranca con la primera jugada y se pausa si cambias de pestaña.
- **Récord** guardado en el navegador (`localStorage`), con el tiempo y los movimientos de esa partida.
- **Animaciones** al repartir, mover, voltear y reiniciar el mazo, que se desactivan si el sistema tiene activado "reducir movimiento".
- **Diseño adaptable**: las siete columnas siempre caben en pantalla, del móvil al escritorio.

## Cómo se juega

El objetivo es llevar las 52 cartas a las cuatro **fundaciones** (arriba a la derecha), una por palo, del As al Rey.

- En el **tablero**, las cartas se apilan en orden descendente y alternando colores (un 7 rojo sobre un 8 negro). Una escalera ordenada se puede mover entera.
- Solo un **Rey** (o una escalera que empiece por Rey) puede ocupar una columna vacía.
- Al hacer clic en el **mazo** se roba una carta al descarte. Cuando se acaba, el mazo muestra un icono de reinicio: haz clic para volver a pasar el descarte al mazo, tantas veces como quieras.
- Al dejar al descubierto una carta boca abajo del tablero, se voltea sola.

### Controles

| Acción | Cómo |
| --- | --- |
| Mover cartas | Arrástralas, o haz clic en la carta y luego en el destino |
| Enviar una carta a la fundación | Haz clic dos veces en ella |
| Robar del mazo | Clic en el mazo |
| Deshacer | Botón **Deshacer** o `Ctrl+Z` / `⌘Z` |
| Pedir una pista | Botón **Pista** o tecla `H` |
| Cancelar la selección o cerrar un aviso | `Esc` |

### Puntuación

| Jugada | Puntos |
| --- | --- |
| Carta a una fundación | +10 |
| Carta del descarte al tablero | +5 |
| Voltear una carta del tablero | +5 |
| Bajar una carta de la fundación al tablero | −15 |
| Volver a pasar el descarte al mazo | −20 |
| Cada 10 segundos de partida | −2 |
| Bono al ganar (partidas de 30 s o más) | 700 000 ÷ segundos |

La puntuación nunca baja de 0. Deshacer devuelve los puntos de la jugada, pero cuenta como un movimiento más. Pedir una pista no resta puntos.

## Desarrollo

Requisitos: **Node.js 20.19+ o 22.12+** (lo que pide Vite 8).

```bash
npm install      # instala las dependencias
npm run dev      # servidor de desarrollo con recarga en caliente
npm run build    # comprueba los tipos y genera la versión de producción en dist/
npm run preview  # sirve dist/ en local para probar el build
```

### Tecnologías

- [TypeScript](https://www.typescriptlang.org/), sin frameworks: el DOM se maneja directamente.
- [Vite](https://vite.dev/) para el servidor de desarrollo y el build.
- [Tailwind CSS v4](https://tailwindcss.com/) para los estilos.
- [Lucide](https://lucide.dev/) para los iconos. Solo se incluyen en el bundle los que se usan.

### Estructura

```
src/
├── main.ts      # Arranque y eventos: clics, teclado, pistas y diálogos
├── game.ts      # Estado de la partida, movimientos, deshacer, autocompletar y pistas
├── rules.ts     # Reglas de Klondike: qué carta puede ir dónde
├── deck.ts      # Creación y barajado de la baraja (Fisher-Yates)
├── scoring.ts   # Puntuación y récord en localStorage
├── timer.ts     # Cronómetro
├── render.ts    # Dibujo de la mesa, animaciones y marcador
├── drag.ts      # Arrastrar y soltar con Pointer Events (ratón, táctil y lápiz)
├── icons.ts     # Iconos de Lucide
├── types.ts     # Tipos compartidos
└── style.css    # Tema de Tailwind, tamaño de las cartas y animaciones
```

La lógica del juego (`game.ts`, `rules.ts`, `deck.ts`, `scoring.ts`) no depende del DOM; todo lo visual vive en `render.ts` y `drag.ts`.

## Despliegue

Cada push a `main` publica el juego en GitHub Pages mediante el workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): instala las dependencias, genera el build y sube `dist/` a Pages. También se puede lanzar a mano desde la pestaña **Actions**.

La opción `base` de [`vite.config.ts`](vite.config.ts) (`/klondike-devcrafters/`) tiene que coincidir con el nombre del repositorio. Si haces un fork con otro nombre, cámbiala o los recursos darán 404.
