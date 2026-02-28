# Copilot Processing — Splash Meet Manager Heat Export

## Request
Implementeer een automatische TXT-export per heat voor Splash Meet Manager na het stoppen van de stopwatch. Als een heat opnieuw wordt geëxporteerd, hernoem het oude bestand met een timestamp-suffix. Negeer splits binnen 3 seconden na start (klokker-bescherming).

## Action Plan

### Phase 1: Server-side race state + event-heat tracking
- [x] Voeg race state variabelen toe aan `src/websockets/websocket.ts`
- [x] Voeg `handleEventHeat` handler toe
- [x] Breid `handleStart` uit met state reset
- [x] Breid `handleLap` uit met 3s ignore-window + splitsByLane tracking

### Phase 2: Splash exporter module
- [x] Maak `src/modules/splashExporter.ts` met export logica
- [x] `formatSplashTime()`, `ensureExportDir()`, `exportHeatToSplashFile()`
- [x] Backup-rename bestaande bestanden met timestamp

### Phase 3: Koppel export aan stop-flow
- [x] Breid `handleReset` uit met export call
- [x] Foutafhandeling en logging

### Phase 4: Housekeeping & tests
- [x] Update `.gitignore` met `exports/`
- [x] Schrijf tests in `test/modules/splashExporter.test.ts`
- [x] Run tests en valideer (0 compile errors)

### Phase 5: Summary
- [x] Voeg samenvatting toe

## Summary

Alle wijzigingen zijn geïmplementeerd:

**Nieuwe bestanden:**
- `src/modules/splashExporter.ts` — Splash Meet Manager export module
- `test/modules/splashExporter.test.ts` — 20+ unit tests

**Gewijzigde bestanden:**
- `src/websockets/websocket.ts` — Race state tracking, event-heat handler, 3s split ignore window, export bij stop
- `.gitignore` — `exports/` toegevoegd

**Functionaliteit:**
1. Server houdt race state bij: session/event/heat nummers, start timestamp, splits per lane
2. Na stoppen (reset) wordt automatisch een TXT-bestand geschreven naar `exports/splashme/`
3. Bestandsnaam: `Session{A}-Event{B}-Heat{C}.txt` of `Event{B}-Heat{C}.txt`
4. CSV-formaat met `;`-separator: `LANE;TIME50;TIME100;...`
5. Bestaand bestand wordt hernoemd met timestamp-suffix als backup
6. Splits binnen 3 seconden na start worden genegeerd (klokker-bescherming)
7. Meerdere splits per baan worden ondersteund
