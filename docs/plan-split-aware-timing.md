# Plan: Split-aware timing (issue #70)

Referentie: https://github.com/spelbreker/ws-swim-stopwatch/issues/70

## Doel

Systeem bewust maken van badlengte en aantal te klokken banen. Per baan tussentijden
labelen (50m, 100m, 150m...). Plaatsing op scherm gebaseerd op aantal voltooide splits,
dan op laatste split-tijd. Ongewenste dubbele/per ongeluk splits negeren via per-baan
cooldown (default 12s, instelbaar). Genegeerde tijden loggen.

Enkele repo: `ws-swim-stopwatch`. Hardware-protocol backward-compatible (server verrijkt
de `split`-broadcast, hardware hoeft niets te veranderen).

## Beslissingen (vastgelegd)

| # | Keuze | Detail |
|---|-------|--------|
| 1 | Split-interval | Official klokt aan één kant van het bad → elke **2 baanlengtes**. `splitDistance = 2 * poolLength` (50m in 25m-bad, 100m in 50m-bad). |
| 2 | Totale afstand | `totalDistance = swimstyle.distance * swimstyle.relaycount` (relay: 4x50 = 200m). |
| 3 | Expected splits | `expectedSplits = Math.ceil(totalDistance / splitDistance)`; `0` als geen competition.json. |
| 4 | Distance-label | `distance = min(splitNumber * splitDistance, totalDistance)` indien `totalDistance > 0`, anders `splitNumber * splitDistance`. Dekt oneven aantal lengtes (25m-race in 25m-bad → 1 split, label `25m`). |
| 5 | Arrival-order | Server-side ranking op `(splitCount desc, lastSplitTimestamp asc)`. **Volledige ranking** wordt bij elke geaccepteerde split meegestuurd; screen tekent alle plaats-cellen opnieuw. Geen 20s client-timer meer. |
| 6 | Cooldown-klok | Op `msg.timestamp` (gesynchroniseerde race-klok), niet server `Date.now()`. Deterministisch en testbaar zonder fake timers. |
| 7 | Na finish | Extra splits op een baan met `isFinish` worden genegeerd + gelogd (reden `after-finish`). |
| 8 | Logica-plaatsing | Alle state + regels in **`src/modules/splitTracker.ts`** (pure module). `websocket.ts` blijft dunne adapter. |
| 9 | Heat-state | Eén `currentHeat` object, geen `Map<'event:heat', number>`. |
| 10 | Config-cache | `loadConfig()` cachet in-memory; `saveConfig()` invalideert. Geen `fs.readFileSync` per split. |
| 11 | Ignored-log | Genegeerde splits gaan in `logs/competition.log` met prefix `SPLIT IGNORED` (heat/start-context blijft bij elkaar). Geen aparte logfile. |
| 12 | Remote | Optimistische lokale update bij klik verwijderen; remote toont alleen wat de server broadcast. Genegeerde split → niet zichtbaar op remote én screen (consistent). |
| 13 | Routes | `GET/POST /settings` (naam consistent met `settings.html`). Tunnel-allowlist blokkeert automatisch. |

## Architectuur-bevindingen uit codebase-verkenning

- `Competition.getEvent(meetIndex, sessionNumber, eventNumber)` retourneert `CompetitionEvent`
  met `swimstyle.distance` en `swimstyle.relaycount`
  (`src/types/competition-types.ts` lines 60-76). `event`/`heat`/`session` komen als
  string (remote) of number (hardware) → altijd `Number()`.
- `tunnelRestriction.ts` gebruikt een **allowlist** — `/settings` en `settings.html` zijn
  daardoor automatisch geblokkeerd via CF. Alleen een test toevoegen die dit bevestigt
  (`src/middleware/tunnelRestriction.ts` lines 8-22).
- `tunnel.ts` heeft eigen `loadConfig`/`saveConfig` voor `tunnel.json` — nieuwe
  `settings.ts` module gebruikt aparte file `config/app.json`
  (`src/modules/tunnel.ts` lines 40-66).
- `handleStart` in `websocket.ts` ontvangt al `event` + `heat` in het bericht, maar
  `event-heat` komt normaal vóór `start`. We zetten de heat op `event-heat` én
  (defensief) op `start` indien nog niet gezet
  (`src/websockets/websocket.ts` lines 33-48, 191-198).
- `websocket.ts` heeft **geen tests** en exporteert geen handlers → reden voor beslissing 8.
- `screen.js` heeft de client-side `arrivalOrder`-teller + 20s `arrivalClearTimer` die
  volledig weg moeten (`public/competition/screen.js` lines 8-9, 119-140, 210-244).
- `remote.js` doet bij klik een optimistische `updateLaneInfo` (line 303) én verwerkt de
  broadcast (line 386-397) → beslissing 12.
- `logger.ts` `logSplit(lane, timestamp, elapsedMs?)` moet uitbreiden met optionele
  `distance` + `splitNumber` (`src/websockets/logger.ts` lines 33-59).
- `lane` komt als string (remote `data-lane`) of number (hardware) → `Number(msg.lane)`.

## Message-contract (uitbreiding `split`)

```ts
| {
    type: 'split';
    lane: number;
    timestamp: number;
    elapsed_ms?: number;
    // server-verrijking (optioneel, oude clients negeren)
    distance?: number;        // bv. 50, 100, 150
    splitNumber?: number;     // 1-based
    isFinish?: boolean;
    ranking?: { lane: number; place: number; splitNumber: number }[]; // volledige ranking
  }
```

Genegeerde splits worden **niet** gebroadcast.

## Implementatie-volgorde (9 fases)

### Fase 1 — Settings module + tests

- **Nieuw** `src/modules/settings.ts`:
  - `interface AppSettings { poolLength: 25 | 50; splitCooldownSec: number }`
  - `loadSettings(): AppSettings` — leest `./config/app.json` (in-memory cache), fallback
    `{ poolLength: 25, splitCooldownSec: 12 }`
  - `saveSettings(cfg): boolean` — schrijft `./config/app.json` (mkdir recursive),
    invalideert cache
  - `resetSettingsCache()` — voor tests
- **Nieuw** `test/modules/settings.test.ts`: defaults bij ontbreken file, save+reload,
  cache-invalidatie, corrupte file → defaults, aparte file van `tunnel.json`

### Fase 2 — Settings controller + routes + tunnel-restriction test

- **Nieuw** `src/controllers/settingsController.ts`:
  - `getSettings` → `res.json(loadSettings())`
  - `postSettings` → valideer `poolLength ∈ {25,50}`, `splitCooldownSec` integer
    `∈ [1,60]`; bij invalid `400` met expliciete melding; anders save,
    `res.json({ success: true })`; save-fout → `500`
- **Edit** `src/routes/routes.ts`: `app.get('/settings', getSettings)`,
  `app.post('/settings', json(), postSettings)`
- **Nieuw** `test/controllers/settingsController.test.ts`: GET defaults, POST valid,
  POST weigert poolLength≠25/50, POST weigert cooldownSec <1, >60 of niet-integer
- **Edit** `test/middleware/tunnelRestriction.test.ts`: `/settings` (GET+POST) en
  `/settings.html` geblokkeerd via CF

### Fase 3 — Logger uitbreiden

- **Edit** `src/websockets/logger.ts`:
  - `logSplit(lane, timestamp, elapsedMs?, distance?, splitNumber?)` — backward-compat;
    voegt `Distance: 50m, Split: 1` toe indien aanwezig
  - **Nieuw** `logIgnoredSplit(lane, timestamp, reason: 'cooldown' | 'after-finish', msSinceLast?)`
    → regel `SPLIT IGNORED - Lane: 3, Reason: cooldown, Since last: 812ms, Timestamp: ...`
    in `logs/competition.log`
- **Edit** `test/modules/logger.test.ts`: nieuwe params + `logIgnoredSplit`

### Fase 4 — SplitTracker module (kern) + tests

- **Nieuw** `src/modules/splitTracker.ts` — pure logica, geen ws/fs:

  ```ts
  interface LaneState { splitCount: number; lastTimestamp: number; finished: boolean }
  interface HeatInfo { event: number; heat: number; totalDistance: number; expectedSplits: number }
  type SplitResult =
    | { accepted: true; distance: number; splitNumber: number; isFinish: boolean;
        ranking: { lane: number; place: number; splitNumber: number }[] }
    | { accepted: false; reason: 'cooldown' | 'after-finish'; msSinceLast?: number };

  export class SplitTracker {
    constructor(opts: { getSettings: () => AppSettings })
    setHeat(info: HeatInfo | null): void      // clear lanes
    onStart(): void                            // clear lanes
    onReset(): void                            // clear lanes + heat
    onSplit(lane: number, timestamp: number): SplitResult
    getRanking(): { lane; place; splitNumber }[]
  }
  ```

  - `onSplit` regels, in volgorde:
    1. `state.finished` → `{ accepted: false, reason: 'after-finish' }`
    2. `timestamp - state.lastTimestamp < cooldownSec * 1000` →
       `{ accepted: false, reason: 'cooldown', msSinceLast }`
    3. `splitNumber = count + 1`; `splitDistance = 2 * poolLength`;
       `distance = totalDistance > 0 ? min(splitNumber * splitDistance, totalDistance) : splitNumber * splitDistance`;
       `isFinish = expectedSplits > 0 && splitNumber >= expectedSplits`
    4. update state, bereken ranking over alle lanes met `splitCount > 0`,
       sort `(splitCount desc, lastTimestamp asc)`, plaats 1..N
  - **Nieuw** helper `computeHeatInfo(event, heat, session?, poolLength)`: via
    `Competition.getEvent(0, session, event)` → `totalDistance`, `expectedSplits`;
    try/catch → bij geen competition.json `{ totalDistance: 0, expectedSplits: 0 }`

- **Nieuw** `test/modules/splitTracker.test.ts`:
  - Eerste split geaccepteerd, tweede binnen cooldown genegeerd (reason `cooldown`),
    derde na cooldown geaccepteerd — puur via timestamps, geen fake timers
  - Per-lane onafhankelijk (baan 3 cooldown blokkeert niet baan 4)
  - Labels: 25m-bad → 50, 100, 150; 50m-bad → 100, 200
  - Oneven lengtes: 25m-race in 25m-bad → expected 1, label `25m`, isFinish op split 1;
    50m-race in 50m-bad → expected 1, label `50m`
  - Relay 4x50 op 25m → totalDistance 200, expected 4, isFinish bij split 4
  - Na finish → `after-finish` genegeerd
  - Ranking: baan met meer splits = plaats 1; bij gelijk count wint vroegste timestamp;
    ranking bevat alle lanes en verandert voor **andere** lanes (lane 3 zakt van 1 naar 2)
  - `setHeat`/`onStart` clear lanes; `onReset` clear lanes + heat
  - Geen competition.json → expected 0 → isFinish altijd false, labels werken
  - Cooldown-waarde uit `getSettings()` wordt live gelezen (wijziging geldt direct)

### Fase 5 — WebSocket adapter + message types

- **Edit** `src/websockets/messageTypes.ts`: `split` uitbreiden (zie contract hierboven)
- **Edit** `src/websockets/websocket.ts`:
  - Module-level `const tracker = new SplitTracker({ getSettings: loadSettings })`
  - `handleEventHeat` (nieuw, vervangt inline case): `Number()` op event/heat/session,
    `tracker.setHeat(computeHeatInfo(...))`, broadcast
  - `handleStart`: `tracker.onStart()`; indien geen heat gezet en msg bevat event/heat →
    `setHeat` defensief
  - `handleReset`: `tracker.onReset()`
  - `handleSplit`: valideer lane/timestamp; `result = tracker.onSplit(Number(lane), timestamp)`;
    niet geaccepteerd → `logIgnoredSplit(...)`, geen broadcast; geaccepteerd →
    `logSplit(..., distance, splitNumber)` + broadcast `{ ...msg, lane: Number(lane), distance, splitNumber, isFinish, ranking }`
  - Exporteer `resetTrackerForTests()` (of injecteer tracker) voor een kleine
    adapter-test
- **Nieuw** `test/websockets/websocket.test.ts` (klein): één integratietest met echte
  `WebSocketServer` op random poort: split geaccepteerd → alle clients krijgen verrijkt
  bericht; tweede split direct erna → geen bericht

### Fase 6 — Screen.js: label + server ranking

- **Edit** `public/competition/screen.js`:
  - Verwijder `arrivalOrder`, `arrivalClearTimer`, `clearArrivalOrders()` timer-logica,
    `resetArrivalOrderTracking()`
  - Split-handler:
    - `splitCell.textContent = message.distance ? \`${message.distance}m ${formattedTime}\` : formattedTime`
    - `renderRanking(message.ranking)`: leeg alle `.arrival-order` cellen, vul per
      entry `lane → place`
    - `message.isFinish` → class `finished` op lane-element (blijvend)
  - `start`/`reset`/`event-heat`/`clear`: leeg alle `.arrival-order` cellen en verwijder
    `finished` overal
- **Edit** `public/competition/screen.html`: CSS voor `.lane.finished` (groene highlight)
  en `.split-time` label-prefix

### Fase 7 — Remote.js

- **Edit** `public/competition/remote.js`:
  - Lane-button click: alleen `socket.send(...)` + `highlightLaneButton`; optimistische
    `updateLaneInfo` verwijderen (broadcast-handler line 386 doet de update)
  - Broadcast-handler: toon `distance`-label op dezelfde manier als screen
- Cooldown-indicatie op de knop is **out of scope** (geen extra bericht nodig; een
  genegeerde split is zichtbaar doordat de tijd niet verandert)

### Fase 8 — Settings-pagina

- **Nieuw** `public/settings.html`: form met badlengte (25/50 radio), cooldown-sec
  (number 1..60), save-knop, status-feedback; waarschuwing "wijzig niet tijdens een race"
- **Nieuw** `public/js/settings.js`: `GET /settings` → vul form; `POST /settings` op
  submit; toon succes/error
- **Edit** `public/index.html`: kaart/link naar `settings.html`

### Fase 9 — Docs

- **Edit** `docs/websocket-api.md`: `split` payload (`distance`, `splitNumber`,
  `isFinish`, `ranking`); sectie "Split cooldown & ignored splits" (regels 1-4 uit Fase 4,
  logformaat); state-diagram: per-lane substate `finished`
- **Edit** `README.md`: settings-pagina + `config/app.json` vermelding

## Edge cases (gedekt in plan)

- Official vergeet split(s) → laatste ontvangen split telt; label toont werkelijke
  gelokte afstand (`splitNumber * splitDistance`), geen `isFinish` als expected niet
  gehaald. Ranking op basis van wat binnenkwam.
- Alleen eindtijd gedrukt → 1 split, label `50m` (25m-bad) tenzij `totalDistance`
  kleiner is; plaats bepaald door timestamp t.o.v. andere lanes met 1 split.
- Dubbele druk binnen cooldown → genegeerd, `SPLIT IGNORED` in competition.log; geen
  broadcast; remote en screen ongewijzigd.
- Druk na finish → genegeerd (`after-finish`), gelogd.
- Geen competition.json → expected 0, isFinish altijd false, labels werken.
- Event-heat change mid-race → lanes clear; heat-info nieuw.
- Pool-length wijziging tijdens heat → `splitDistance` geldt direct voor volgende splits
  (settings live gelezen). Niet aanbevolen; UI waarschuwt. Heat-info (`expectedSplits`)
  wordt pas bij volgende `event-heat`/`start` herberekend.
- Hardware stuurt `lane` als number, remote als string → genormaliseerd naar number in
  broadcast.

## Verificatie per fase

- Fase 1-3: `npm test` + `npm run build`
- Fase 4: `npm test` (splitTracker tests) — kritiek, alle logica zit hier
- Fase 5: `npm test` (adapter-test) + `npm run build`
- Fase 6-7: handmatige smoke test via browser-preview: remote + screen naast elkaar,
  start → splits op 2 lanes (incl. dubbele klik en inhaal-scenario) → ranking klopt op
  beide → reset
- Fase 8: handmatige smoke test settings-pagina; check `config/app.json`
- Fase 9: docs review
- Einde: `npm run lint` + `npm audit --audit-level=moderate` + `npm run build` +
  `npm test` (volledige CI-set)

## Risico's

- **Medium**: arrival-order semantiek verandert (client→server, volledige ranking).
  Smoke test op scherm-plaatsing nodig, incl. scenario waarbij een lane van plaats wisselt.
- **Laag**: 12s cooldown bij 50m-interval: snelste 50m ~21s, ruim veilig. Bij een
  25m-race (1 split) is er geen tweede split, dus geen risico.
- **Laag**: `splitDistance = 2 * poolLength` is een aanname over waar de official staat.
  Als dit later moet variëren → extra setting `lengthsPerSplit`; de tracker is hierop
  voorbereid (één constante).
- **Laag**: `docs/refactor-plan-vue.md` — indien de Vue-migratie snel volgt, blijven de
  `screen.js`/`remote.js` wijzigingen bewust minimaal (label + `renderRanking`).

## Config schema

`config/app.json`:

```json
{
  "poolLength": 25,
  "splitCooldownSec": 12
}
```

Defaults bij ontbreken file: `poolLength=25`, `splitCooldownSec=12`.
