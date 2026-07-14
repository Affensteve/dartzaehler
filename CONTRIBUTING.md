# Beitragen zu DartZähler

Danke, dass du zu DartZähler beitragen möchtest! Beiträge sind willkommen – egal
ob Bugfix, neues Feature, Doku-Verbesserung oder eine Idee.

## Grundregel

Der `main`-Branch ist geschützt: **direkte Pushes sind nicht möglich**, alle
Änderungen laufen über Pull Requests. Bitte forke das Repository und arbeite in
einem eigenen Branch.

## Ablauf

1. **Fork** dieses Repositories erstellen.
2. **Branch** anlegen, z. B. `git checkout -b feature/meine-idee` oder
   `fix/kurze-beschreibung`.
3. Änderungen umsetzen (siehe *Entwicklung* unten) und mit aussagekräftigen
   Commit-Nachrichten committen.
4. Vor dem Push lokal prüfen, dass Build und Tests laufen (siehe unten).
5. **Pull Request** gegen `main` öffnen und kurz beschreiben, *was* und *warum*
   du geändert hast. Für Bugs bitte Reproduktionsschritte angeben.

## Entwicklung

Voraussetzungen: Node.js **>= 18**.

```bash
npm run setup        # Backend + Frontend installieren und Frontend bauen
npm run dev:backend  # Backend im Watch-Modus
npm run dev:frontend # Frontend-Dev-Server (Vite)
```

Vor dem Öffnen eines PRs bitte sicherstellen, dass beides fehlerfrei durchläuft:

```bash
npm test                       # Backend-Tests (node --test)
npm --prefix frontend run build  # Frontend-Build
```

## Stil & Konventionen

- Bestehenden Code-Stil beibehalten (Formatierung, Benennung, Ordnerstruktur).
- Neue Nutzertexte immer in **beiden Sprachen** pflegen (DE/EN, siehe
  `frontend/src/i18n.js`).
- Änderungen klein und fokussiert halten – ein PR pro Thema.
- Keine generierten Artefakte committen (`node_modules/`, `frontend/dist/`,
  Datenbank-Dateien) – die `.gitignore` deckt das ab.

## Fragen & Ideen

Für größere Änderungen oder offene Fragen gern zuerst ein
[Issue](../../issues) eröffnen, damit wir die Richtung kurz abstimmen können,
bevor viel Arbeit hineinfließt.

Viel Spaß – und danke für deinen Beitrag! 🎯
