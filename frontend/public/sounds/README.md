# Eigene Sound-/Voice-Dateien (optional)

Nur relevant, wenn im Ton-Menü die Tonquelle **„Audio-Clips"** gewählt ist.
Fehlt eine Datei, fällt die App automatisch auf den erzeugten Ton bzw. die
Browser-Sprachausgabe zurück – die App funktioniert also auch ohne diese Dateien.

Format: **MP3**.

## Sound-Effekte – `sfx/`
| Datei | Auslöser |
|---|---|
| `sfx/leg.mp3`     | Leg gewonnen (Game shot) |
| `sfx/match.mp3`   | Spiel gewonnen (Match) |
| `sfx/bust.mp3`    | Überworfen (Bust) |
| `sfx/bulloff.mp3` | Ausbullen-Aufforderung |
| `sfx/s180.mp3`    | 180 geworfen |

## Voice-Caller – je Sprache eigener Ordner
Der Voice-Caller ist zwischen Deutsch und Englisch umschaltbar; die Clips liegen
entsprechend unter `voice/de/` bzw. `voice/en/`.

| Datei (pro Sprachordner) | Ansage |
|---|---|
| `voice/<lang>/game-on.mp3`         | Spielstart |
| `voice/<lang>/game-shot.mp3`       | Leg gewonnen |
| `voice/<lang>/game-shot-match.mp3` | Spiel gewonnen |
| `voice/<lang>/no-score.mp3`        | Bust |
| `voice/<lang>/one-eighty.mp3`      | 180 |
| `voice/<lang>/score-<n>.mp3`       | Aufnahme-Summe, z. B. `score-140.mp3` (optional; sonst Sprachausgabe) |

Beispiel: `voice/en/one-eighty.mp3` für das englische „One hundred and eighty!",
`voice/de/one-eighty.mp3` für „Einhundertachtzig!".
