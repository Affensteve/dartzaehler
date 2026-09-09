# DartZähler – Schnittstellenanforderungen aus Darterkenner

**Dokument:** Anforderungen an den DartZähler-Backend (Port 3000) für die Integration mit dem Darterkenner  
**Autor:** Steffen Kunz  
**Stand:** 2026-09-09 (aktualisiert)  
**Quelle:** Abgeleitet aus dem tatsächlichen Darterkenner-Code

---

## 1. Kommunikationsprinzip

Der Darterkenner ist ein **reiner HTTP-Client** – er wird am DartZähler nicht registriert und braucht keine Eingabemethoden-Konfiguration. Er sendet ausschließlich REST-Requests.

```
Darterkenner (Port 3001)  →  GET / POST / PUT  →  DartZähler (Port 3000)
```

**Wichtig – Kein Einzelwurf-Submit:**  
Der Darterkenner sendet **keine Einzelwürfe** an den DartZähler. Alle drei Würfe einer Runde werden erst nach optionaler Korrektur durch den Spieler **gemeinsam** via `POST /api/round-complete` übertragen. Der DartZähler muss keine Einzelwurf-Streaming-Logik implementieren.

**Polling-Intervalle (automatisch, kein Zutun nötig):**
- Health Check: alle 30 Sekunden
- Game Context (nur bei Status `active`): alle 10 Sekunden
- ML-Model-Update-Check: stündlich (optional, Phase 3)

---

## 2. Endpoints – vollständige Spezifikation

### 2.1 Health Check

```
GET /api/health
```

**Zweck:** Verbindungsprüfung. Timeout: 3 Sekunden. Body wird nicht ausgewertet.

**Response (200):**
```json
{ "status": "ok", "version": "1.0.0", "timestamp": "2026-09-09T14:00:00Z" }
```

---

### 2.2 Verfügbare Spiele auflisten ⭐ NEU

```
GET /api/games
```

**Zweck:** Der Darterkenner lädt beim Verbinden die Liste aller wählbaren Spiele und zeigt sie dem Benutzer zur Auswahl an. Nach Auswahl eines Spiels lädt er den vollständigen Game Context nach (`GET /api/game-context`).

Timeout: 5 Sekunden. Bei Fehler: leere Liste, kein Absturz.

**Erwartete Response (200) – Array:**
```json
[
  {
    "gameId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "mode": "501",
    "status": "waiting",
    "players": [
      { "id": "player-123", "name": "steffen", "score": 501 },
      { "id": "player-124", "name": "marcel",  "score": 501 }
    ],
    "createdAt": "2026-09-09T14:00:00Z"
  },
  {
    "gameId": "a1b2c3d4-...",
    "mode": "301",
    "status": "active",
    "players": [
      { "id": "player-200", "name": "thomas", "score": 123 }
    ],
    "createdAt": "2026-09-09T13:45:00Z"
  }
]
```

**`status`-Werte die angezeigt werden:** `"waiting"` und `"active"` (beide auswählbar).  
`"finished"` sollte **nicht** in der Liste erscheinen.

**Pflichtfelder pro Spiel:**

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `gameId` | UUID v4 | Ja | Eindeutige Spiel-ID |
| `mode` | string | Ja | z.B. `"501"`, `"301"`, `"Cricket"` |
| `status` | string | Ja | `"waiting"` \| `"active"` |
| `players` | Array | Ja | Mind. 1 Spieler mit `id`, `name`, `score` |
| `createdAt` | ISO 8601 | Nein | Für Sortierung in der UI |

---

### 2.3 Vollständigen Game Context laden

```
GET /api/game-context?gameId={uuid}
```

**Zweck:** Nach Spielauswahl und während des aktiven Spiels (alle 10s gepolt). Timeout: 5 Sekunden.

**Response (200):**
```json
{
  "gameId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "mode": "501",
  "status": "active",
  "players": [
    {
      "id": "player-123",
      "name": "steffen",
      "score": 156,
      "checkoutMode": "double",
      "isActive": true,
      "order": 0
    },
    {
      "id": "player-124",
      "name": "marcel",
      "score": 247,
      "checkoutMode": "double",
      "isActive": false,
      "order": 1
    }
  ],
  "activePlayerId": "player-123",
  "throwsThisRound": 0,
  "roundNumber": 5
}
```

Bei nicht gefundenem Spiel: HTTP 404 → Darterkenner zeigt Fehlermeldung.

---

### 2.4 Runde abschließen ⭐ HAUPT-SCORING-ENDPOINT

```
POST /api/round-complete
Content-Type: application/json
```

**Zweck:** Übermittelt alle drei Würfe einer Runde nach optionaler Korrektur durch den Spieler. **Dies ist der einzige Endpoint der den Score beeinflusst.** Timeout: 8 Sekunden. Retry: bis zu 5× mit Exponential Backoff (1s, 2s, 4s, 8s, 16s). Bei dauerhaftem Fehler: lokale Offline-Queue, Sync bei Wiederverbindung.

**Request Body:**
```json
{
  "gameId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "playerId": "player-123",
  "roundNumber": 5,
  "throws": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "segment": "20",
      "multiplier": "triple",
      "score": 60,
      "confidence": 0.94,
      "corrected": false
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "segment": "10",
      "multiplier": "double",
      "score": 20,
      "confidence": 0.89,
      "corrected": false
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "segment": "15",
      "multiplier": "double",
      "score": 30,
      "confidence": 1.0,
      "corrected": true
    }
  ],
  "roundTotal": 110,
  "correctionsMade": 1,
  "timestamp": "2026-09-09T14:36:00.000Z"
}
```

**Segment-Werte:**

| Wert | Bedeutung | Score |
|------|-----------|-------|
| `"1"`–`"20"` | Scoring-Segment | `segment × multiplier` |
| `"BULL"` | Bullseye | 50 (bullseye) oder 25 (single) |
| `"M1"`–`"M20"` | Miss neben Segment 1–20 (Außenring) | 0 |
| `"MISS"` | Komplett daneben | 0 |

**Multiplier-Werte:** `"single"` \| `"double"` \| `"triple"` \| `"bullseye"` \| `null`

**`corrected: true`** = Spieler hat diesen Wurf manuell über das Numpad korrigiert.

**Erwartete Response (200 – Erfolg):**

> Der Darterkenner wertet genau diese Felder aus:

```json
{
  "success": true,
  "gameState": {
    "nextPlayerId": "player-124",
    "remainingCheckout": "D18",
    "currentScore": 46
  },
  "nextPlayerInfo": {
    "id": "player-124",
    "name": "marcel"
  }
}
```

| Feld | Typ | Verwendet für |
|------|-----|---------------|
| `success` | boolean | Hauptentscheidung |
| `gameState.nextPlayerId` | string | Spielerwechsel im Darterkenner |
| `gameState.remainingCheckout` | string | Checkout-Vorschlag im Header (z.B. `"D18"`) |
| `gameState.currentScore` | number | Aktueller Score nach der Runde |
| `nextPlayerInfo.id` | string | Fallback für `nextPlayerId` |
| `nextPlayerInfo.name` | string | Anzeige „Marcel ist dran" |

**Erwartete Response (400 – Bust):**

```json
{
  "success": false,
  "error": "Bust!",
  "details": {
    "bust": true
  }
}
```

> **Kritisch:** `details.bust` muss **boolean `true`** sein. String `"true"` wird nicht erkannt.

---

### 2.5 Ausbullen (Bulls-Out)

```
POST /api/bulls-out
Content-Type: application/json
```

**Zweck:** Vor Spielstart – Bestimmt welcher Spieler beginnt. Timeout: 5 Sekunden. Retry: bis zu 3×. Bei Fehler: Offline-Queue, Spiel startet trotzdem lokal.

**Request Body:**
```json
{
  "gameId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "player1": {
    "id": "player-123",
    "name": "steffen",
    "bullDistance": 42
  },
  "player2": {
    "id": "player-124",
    "name": "marcel",
    "bullDistance": 67
  },
  "winner": "player-123",
  "timestamp": "2026-09-09T14:30:00.000Z"
}
```

**`bullDistance`:** Pixel-Abstand vom Bull-Mittelpunkt (gerundet). Niedrigster Wert = Gewinner.  
**`winner`:** Lokal berechneter Gewinner. DartZähler kann diesen Wert in der Response überschreiben.

**Response (200):**
```json
{
  "success": true,
  "winner": "player-123"
}
```

Falls `winner` in der Response fehlt, bleibt der lokal berechnete Gewinner gültig.

---

### 2.6 Wurf korrigieren (optional)

```
PUT /api/detected-throws/{throwId}
Content-Type: application/json
```

**Zweck:** Informiert den DartZähler über eine manuelle Korrektur (optional – Fehler werden ignoriert, lokale Korrektur wird immer angewendet). Timeout: 5 Sekunden. Retry: bis zu 3×.

**`throwId`:** RFC 4122 UUID v4

**Request Body:**
```json
{
  "segment": "15",
  "multiplier": "double",
  "score": 30,
  "confidence": 1.0,
  "correctedBy": "manual",
  "timestamp": "2026-09-09T14:35:00.000Z"
}
```

> **Hinweis:** Die finale korrigierte Version wird ohnehin über `POST /api/round-complete` übertragen. Dieser Endpoint ist für Echtzeit-Logging gedacht, nicht für Score-Berechnung.

---

### 2.7 Board-Kalibrierung sichern (optional)

```
PUT /api/board-calibration
Content-Type: application/json
```

Non-critical Backup. Fehler werden stillschweigend ignoriert. Response nicht ausgewertet.

**Request Body:** Homography-Matrix + Ringradien der Kalibrierung (s. Code `CalibrationScreen.tsx`).

---

### 2.8 ML-Modell-Update prüfen (Phase 3, optional)

```
GET /api/ml-models/latest
```

Stündlicher Check. Timeout: 3 Sekunden. Fehler ignoriert.

**Response (200):**
```json
{ "version": 2, "modelUrl": "http://localhost:3000/api/ml-models/model.json", "accuracy": 0.94 }
```

Wird nur geladen wenn `version > lokal` **und** `accuracy > 0.92`. Modell muss im TensorFlow.js SavedModel-Format vorliegen.

---

## 3. Allgemeine technische Anforderungen

### 3.1 CORS

Der DartZähler muss CORS erlauben da Darterkenner (Port 3001) und DartZähler (Port 3000) unterschiedliche Ports haben:

```js
// Express – Minimal-Setup:
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
```

### 3.2 IDs

- **gameId / throwId / playerId:** RFC 4122 UUID v4 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
- Spieler-IDs müssen konsistent zwischen `GET /api/games`, `GET /api/game-context` und `POST /api/round-complete` sein

### 3.3 Fehlerformat

Alle Fehler-Responses:
```json
{ "success": false, "error": "Beschreibender Text" }
```

### 3.4 Bust-Response

```json
{ "success": false, "error": "Bust!", "details": { "bust": true } }
```
`details.bust` **muss boolean** sein (nicht String).

---

## 4. Datenfluss-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│ SETUP                                                           │
│  GET /api/health          → Verbindung prüfen                   │
│  GET /api/games           → Spielliste anzeigen                 │
│  GET /api/game-context    → Gewähltes Spiel laden              │
│  POST /api/bulls-out      → Ausbullen (optional)               │
├─────────────────────────────────────────────────────────────────┤
│ RUNDE (3 Würfe werden lokal gesammelt, ggf. korrigiert)        │
│                                                                 │
│  [Kamera erkennt Pfeil 1] → lokal gespeichert (kein API-Call)  │
│  [Kamera erkennt Pfeil 2] → lokal gespeichert (kein API-Call)  │
│  [Kamera erkennt Pfeil 3] → lokal gespeichert (kein API-Call)  │
│                                                                 │
│  [Spieler prüft / korrigiert Würfe]                            │
│  [Spieler zieht Pfeile heraus + bestätigt]                     │
│                                                                 │
│  POST /api/round-complete → alle 3 Würfe final übertragen      │
│                          ← nextPlayer, checkoutSuggestion       │
├─────────────────────────────────────────────────────────────────┤
│ POLLING (automatisch)                                           │
│  GET /api/health          → alle 30s                           │
│  GET /api/game-context    → alle 10s (während Spiel aktiv)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. ML-Trainingsdaten

Würfe mit `corrected: false` und hoher `confidence` eignen sich als Trainingsdaten. Der DartZähler kann diese im `rounds`-Datensatz persistieren:

| Feld | Warum relevant |
|------|----------------|
| `segment` | Ground-Truth Klasse |
| `multiplier` | Ground-Truth Multiplikator |
| `confidence` | Filter für Datensatz-Qualität |
| `corrected` | `true` = manuelle Eingabe, für ML weniger wertvoll |
| `roundTotal` | Plausibilitätsprüfung |

---

## 6. Deployment

```
Raspberry Pi:
  DartZähler:   http://localhost:3000  (intern) / http://192.168.x.x:3000  (LAN)
  Darterkenner: http://localhost:3001  (intern) / http://192.168.x.x:3001  (LAN)

Smartphone im WLAN:
  Öffnet: http://192.168.x.x:3001
  → Darterkenner-App konfiguriert DartZähler-URL in Settings
  → Oder via Env-Var: VITE_DARTZAEHLER_URL=http://192.168.x.x:3000
```

---

## 7. Endpunkt-Übersicht

| Endpoint | Methode | Pflicht | Zweck |
|----------|---------|---------|-------|
| `/api/health` | GET | Ja | Verbindungsprüfung |
| `/api/games` | GET | **Ja** | Spielauswahl-Liste |
| `/api/game-context` | GET | Ja | Vollständiger Spielstand |
| `/api/round-complete` | POST | **Ja** | Score übertragen (alle 3 Würfe) |
| `/api/bulls-out` | POST | Ja | Ausbullen vor Spielstart |
| `/api/detected-throws/{id}` | PUT | Nein | Korrektur-Logging |
| `/api/board-calibration` | PUT | Nein | Kalibrierungs-Backup |
| `/api/ml-models/latest` | GET | Nein | Automatische Modell-Updates |

---

*Dieses Dokument wird aus dem Darterkenner-Sourcecode abgeleitet und ist bei API-Änderungen zu aktualisieren.*
