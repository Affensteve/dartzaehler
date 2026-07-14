# Design-System

Angelehnt an dartzaehler.de: grüner Akzent, klare Anzeigetafel, fingerfreundliches Numpad.

## Farben (Akzente, in beiden Themes gleich)

| Zweck | Farbe |
|---|---|
| Primär / Aktiv / Erfolg (Grün) | `#52B788` |
| Double (gelb/orange) | `#F4A62A` |
| Triple (orange) | `#EF6C33` |
| Undo / Bust / Warnung (rot) | `#E63946` |
| Bot-Namen (orange) | `#E8873A` |

## Themes

**Dunkel (Default)**
- Hintergrund: `#0F1117`, Flächen: `#1A1F2B`
- Text: hell (`#E7ECF3`)

**Hell**
- Hintergrund: `#F5F5F5`, Flächen: `#FFFFFF`
- Text: dunkel (`#1A1F2B`)

Umschalter in der AppBar; Präferenz wird in `localStorage` (`dz-theme`) gespeichert.

## Typografie

- UI-Schrift: Roboto / Open Sans / System-Font
- Große Zahlen (Scores, Numpad, Statistik): Monospace (`JetBrains Mono` / `Roboto Mono`)

## Layout

- **Mobile (Handy):** Header → Spiel-Info-Zeile → scrollbare Spieler-Karten → fixiertes Numpad am unteren Rand.
- **Desktop (≥ md):** Bei mehr als zwei Spielern werden die Karten zweispaltig als Anzeigetafel dargestellt.
- **Aktiver Spieler:** grüner Balken links + Umrandung + Hervorhebung.
- **Spieler-Karte:** großer Restscore, Name (Bots orange), drei Wurf-Boxen (aktueller/letzter Visit), Turn-Summe, Sätze/Legs, Dartanzahl, Ø, sowie der Checkout-Vorschlag beim aktiven Spieler.

## Numpad-Logik

- 7-Spalten-Raster: `1–20` plus `25`, darunter `0 · DOUBLE · TRIPLE · ↶`.
- Multiplikator gilt für **genau einen** Dart, danach zurück auf Single.
- Sperren: bei **Double** ist `0` deaktiviert; bei **Triple** sind `0` und `25` deaktiviert (D0/T0/T25 existieren nicht).
- Farbcodierung: DOUBLE gelb, TRIPLE orange, UNDO rot; aktiver Multiplikator ist weiß umrandet.
