# ES Modules Frontend Refactor Plan

## Doel

De frontend migreren van globals (`window.socket`, `window.formatLapTime`,
`window.TimeSync`) en losse `<script src>`-tags naar native ES modules
(`import`/`export`). Geen build step, geen framework, geen nieuwe dependencies.
Werkt in alle moderne browsers (Chrome, Firefox, Safari, Edge — alle browsers
die Node 22+ users draaien).

## Huidige situatie

### Script loading per pagina

| Pagina | Scripts | WebSocket |
|--------|---------|-----------|
| `competition/remote.html` | `main.js` → `timeSync.js` → `remote.js` | `window.socket` (uit main.js) |
| `competition/screen.html` | `main.js` → `timeSync.js` → `screen.js` | `window.socket` (uit main.js) |
| `competition/screen-old.html` | `main.js` → `timeSync.js` → `screen.js` | `window.socket` (uit main.js) |
| `devices.html` | `devices.js` (IIFE) | eigen `ws` (lokaal) |
| `settings.html` | `settings.js` | geen |
| `tunnel.html` | inline `<script>` | geen |
| `competition/log.html` | inline `<script>` | geen |
| `competition/upload.html` | inline `<script>` | geen |
| `training/training-remote.html` | `training.js` | eigen `socket` (lokaal) |
| `training/training-screen.html` | `training.js` + inline | eigen `socket` (lokaal) |
| `index.html` | geen scripts | geen |

### Globals in gebruik

| Global | Gedefinieerd in | Gebruikt door | Reden om weg |
|--------|----------------|---------------|--------------|
| `window.socket` | `main.js` | `remote.js`, `screen.js` | Impliciete afhankelijkheid, load-order gevoelig |
| `window.formatLapTime` | `main.js` | `remote.js`, `screen.js` | Zelfde |
| `window.TimeSync` | `timeSync.js` | `remote.js`, `screen.js` | Zelfde |
| `window.startTime` | `remote.js` | nergens anders | Dood code |
| `window.editDevice` | `devices.js` | `devices.js` (onclick in innerHTML) | XSS-gevoelig, event listener is beter |
| `window.startInterval` | `training.js` | `training.js` (onclick in innerHTML) | Zelfde |
| `window.deleteInterval` | `training.js` | `training.js` (onclick in innerHTML) | Zelfde |

### Problemen

1. **Load-order afhankelijkheid**: `main.js` moet laden voordat `remote.js`
   `window.socket` kan gebruiken. Bij trage netwerken kan dit breken.
2. **Impliciete contracten**: geen IDE-ondersteuning, geen type checks, geen
   tree-shaking. Je moet de bron lezen om te weten welke globals beschikbaar
   zijn.
3. **Dubbele WebSocket-verbindingen**: `devices.js` en `training.js` maken
   hun eigen verbinding in plaats van `window.socket` te delen.
4. **`onclick` in `innerHTML`**: `devices.js` en `training.js` genereren
   HTML met `onclick="window.editDevice('...')"` — dit is XSS-gevoelig als
   een MAC-adres of UID speciale tekens bevat, en het dwingt functies op
   `window` te plaatsen.
5. **Inline scripts**: `tunnel.html`, `log.html`, `upload.html` hebben
   ~100-230 regels inline JavaScript. Niet herbruikbaar, niet testbaar.
6. **`screen-old.html`**: ongebruikte kopie van `screen.html` die ook
   `screen.js` laadt. Kan verwijderd worden.

## Doelstructuur

```
public/
├── js/
│   ├── modules/
│   │   ├── socket.js          # WebSocket connectie + reconnect (shared)
│   │   ├── timeSync.js        # TimeSync class (ESM export)
│   │   ├── format.js          # formatLapTime + pad helpers
│   │   ├── wakeLock.js        # Screen wake lock helper
│   │   ├── connectionIndicator.js  # Groen/rood indicator DOM helper
│   │   └── adminLayout.js     # Shared admin header/footer injectie
│   ├── settings.js            # → importert niets shared
│   ├── devices.js             # → importert socket.js
│   ├── training.js            # → importert socket.js
│   ├── tunnel.js              # → nieuw (uit inline script)
│   ├── logViewer.js           # → nieuw (uit inline script)
│   └── upload.js              # → nieuw (uit inline script)
├── competition/
│   ├── remote.js              # → importert socket, timeSync, format
│   ├── screen.js              # → importert socket, timeSync, format
│   ├── remote/
│   │   ├── laneButtons.js     # Lane button logic + cooldown timers
│   │   ├── eventHeat.js       # Event/heat selectie + info bar
│   │   └── sessionSelector.js # Session dialog
│   └── screen/
│       ├── laneDisplay.js     # Lane info + split times + ranking
│       └── stopwatch.js       # Stopwatch display logic
└── ...
```

### Module verantwoordelijkheden

#### `js/modules/socket.js`

Vervangt `main.js`'s WebSocket-logica. Exporteert een enkele gedeelde
verbinding met auto-reconnect.

```js
// js/modules/socket.js
let socket = null;
let reconnectTimer = null;
const listeners = new Set();

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.addEventListener('open', () => {
    listeners.forEach(fn => fn('open', socket));
    clearTimeout(reconnectTimer);
  });

  socket.addEventListener('close', () => {
    listeners.forEach(fn => fn('close', socket));
    reconnectTimer = setTimeout(connect, 1000);
  });

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    listeners.forEach(fn => fn('message', socket, data));
  });
}

export function getSocket() {
  if (!socket) connect();
  return socket;
}

export function send(msg) {
  const s = getSocket();
  if (s.readyState === WebSocket.OPEN) {
    s.send(JSON.stringify(msg));
  }
}

export function onSocketEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

connect(); // connect on module load
```

#### `js/modules/timeSync.js`

Zelfde `TimeSync` class, maar als ESM export in plaats van `window.TimeSync`.

```js
export class TimeSync { ... }
```

#### `js/modules/format.js`

```js
export function formatLapTime(ts, base = 0) { ... }
export function pad(n) { ... }
```

#### `js/modules/wakeLock.js`

```js
export async function requestWakeLock() { ... }
```

#### `js/modules/connectionIndicator.js`

```js
export function setupConnectionIndicator(socket) { ... }
```

#### `js/modules/adminLayout.js`

Optioneel: injecteer gedeelde header/footer in admin-pagina's om
HTML-duplicatie te verminderen.

```js
export function injectAdminHeader({ title, description, iconSvg }) { ... }
```

## Migration stappen

### Fase 1: Gedeelde modules aanmaken (non-breaking)

**Doel**: Nieuwe module-bestanden maken naast de bestaande scripts. Niets
breekt omdat nog geen pagina ze gebruikt.

1. **`js/modules/socket.js`** — WebSocket connectie + reconnect + `send()` +
   `onSocketEvent()`.
2. **`js/modules/timeSync.js`** — `TimeSync` class als ESM export.
3. **`js/modules/format.js`** — `formatLapTime()` + `pad()`.
4. **`js/modules/wakeLock.js`** — wake lock helper.
5. **`js/modules/connectionIndicator.js`** — indicator DOM helper.

**Tests**: handmatig importeren in browser console:
```js
import('./js/modules/socket.js').then(m => console.log(m.getSocket()));
```

### Fase 2: Competition Remote migreren (hoogste risico, hoogste opbrengst)

**Doel**: `remote.html` + `remote.js` omzetten naar ES modules en opsplitsen.

6. **`competition/remote/laneButtons.js`** — lane button click handlers,
   cooldown highlight timers, `updateLaneInfo()`, `resetSplitTimes()`,
   `clearLaneInformation()`.
7. **`competition/remote/eventHeat.js`** — `fillSelectOptions()`,
   `incrementEvent()`, `incrementHeat()`, `sendEventAndHeat()`,
   `updateEventHeatInfoBar()`.
8. **`competition/remote/sessionSelector.js`** — `loadSessions()`,
   `selectSession()`, `updateSessionIndicator()`, session dialog.
9. **`competition/remote.js`** — dunne entry point die de bovenstaande
   modules importeert en init logica runt. Importeert `socket`, `timeSync`,
   `format`.
10. **`competition/remote.html`** — vervang 3 `<script src>` tags door:
    ```html
    <script type="module" src="/competition/remote.js"></script>
    ```

**Breaking**: `window.socket`, `window.formatLapTime`, `window.TimeSync`
worden niet meer gezet door deze pagina. Alleen breaking als andere
pagina's `remote.html`'s scripts laden — niet het geval.

**Tests**: browser smoke test — start/reset/splits/event-heat/session,
cooldown highlight, keyboard shortcuts.

### Fase 3: Competition Screen migreren

11. **`competition/screen/laneDisplay.js`** — `fetchCompetitionData()`,
    `updateLaneInformation()`, `updateLaneDisplay()`, `clearLaneInformation()`,
    `clearSplitTimes()`, `clearArrivalOrders()`, `renderRanking()`,
    `renderSplitTime()`, `formatSwimStyle()`.
12. **`competition/screen/stopwatch.js`** — `updateStopwatch()`, `pad()`.
13. **`competition/screen.js`** — dunne entry point. Importeert `socket`,
    `timeSync`, `format`, `laneDisplay`, `stopwatch`.
14. **`competition/screen.html`** — vervang 3 `<script src>` tags door:
    ```html
    <script type="module" src="/competition/screen.js"></script>
    ```

**Tests**: browser smoke test — stopwatch loopt, splits verschijnen met
distance labels, ranking werkt, finish marker, clear/reset.

### Fase 4: Admin pagina's migreren (inline scripts extraheren)

15. **`js/tunnel.js`** — extract inline script uit `tunnel.html`. Geen
    shared imports nodig (alleen fetch). `tunnel.html`:
    ```html
    <script type="module" src="/js/tunnel.js"></script>
    ```

16. **`js/logViewer.js`** — extract inline script uit `log.html`.
    `log.html`:
    ```html
    <script type="module" src="/js/logViewer.js"></script>
    ```

17. **`js/upload.js`** — extract inline script uit `upload.html`.
    `upload.html`:
    ```html
    <script type="module" src="/js/upload.js"></script>
    ```

**Tests**: browser smoke test per pagina — tunnel start/stop/config,
log refresh/download, upload summary fetch.

### Fase 5: Devices migreren (IIFE → ESM, eigen WebSocket → shared)

18. **`js/devices.js`** — herschrijf IIFE naar ESM. Importeert `socket.js`
    in plaats van eigen WebSocket. Vervang `window.editDevice` + `onclick`
    in innerHTML door event listeners (geplaatst na render).
19. **`devices.html`** — vervang `<script src>` door:
    ```html
    <script type="module" src="/js/devices.js"></script>
    ```

**Breaking**: `window.editDevice` verdwijnt. Alleen intern gebruikt — geen
extern risico.

**Tests**: browser smoke test — device list, edit modal, role/lane update,
reconnect.

### Fase 6: Settings migreren

20. **`js/settings.js`** — herschrijf naar ESM. Geen shared imports
    nodig (alleen fetch). `settings.html`:
    ```html
    <script type="module" src="/js/settings.js"></script>
    ```

**Tests**: browser smoke test — load settings, save, validation errors.

### Fase 7: Training migreren (eigen WebSocket → shared, onclick → listeners)

21. **`js/training.js`** — herschrijf naar ESM. Importeert `socket.js`.
    Vervang `window.startInterval`/`window.deleteInterval` + `onclick` in
    innerHTML door event listeners.
22. **`training/training-remote.html`** en **`training/training-screen.html`**
    — vervang `<script src="/public/js/training.js">` (let op: pad bug —
    staat nu `/public/js/...` maar moet `/js/...` zijn) door:
    ```html
    <script type="module" src="/js/training.js"></script>
    ```

**Breaking**: `window.startInterval`/`window.deleteInterval` verdwijnen.
Pad-fix: `/public/js/training.js` → `/js/training.js` (huidige pad is
fout, werkt alleen omdat Express `/public/` niet stript).

**Tests**: browser smoke test — add interval, start, delete, screen sync.

### Fase 8: Opruimen

23. **Verwijder `js/main.js`** — alle functionaliteit is verhuisd naar
    `js/modules/socket.js`, `js/modules/format.js`, `js/modules/wakeLock.js`,
    `js/modules/connectionIndicator.js`.
24. **Verwijder `js/timeSync.js`** (oude versie) — vervangen door
    `js/modules/timeSync.js`.
25. **Verwijder `competition/screen-old.html`** — ongebruikte kopie.
26. **Verwijder `window.startTime`** uit remote.js (dood code, nergens
    anders gelezen).

### Fase 9: Documentatie + tests

27. **Update `docs/frontend.md`** — nieuwe module structuur, import graph,
   hoe `type="module"` werkt.
28. **Update `AGENTS.md`** — verwijder referenties naar
   `window.socket`/`window.formatLapTime`/`window.TimeSync`, vervang door
   ESM import voorbeelden.
29. **Update `README.md`** — als er frontend structuur vermeld staat.
30. **Browser smoke test alle pagina's** — alle 10 actieve pagina's
    openen in de browser en verifiëren dat alles werkt.

## Import graph (doel)

```mermaid
graph BT
    subgraph Modules
        Socket[js/modules/socket.js]
        TimeSync[js/modules/timeSync.js]
        Format[js/modules/format.js]
        WakeLock[js/modules/wakeLock.js]
        Indicator[js/modules/connectionIndicator.js]
    end

    subgraph Competition
        Remote[competition/remote.js]
        Screen[competition/screen.js]
        LaneButtons[competition/remote/laneButtons.js]
        EventHeat[competition/remote/eventHeat.js]
        SessionSel[competition/remote/sessionSelector.js]
        LaneDisplay[competition/screen/laneDisplay.js]
        Stopwatch[competition/screen/stopwatch.js]
    end

    subgraph Admin
        Devices[js/devices.js]
        Settings[js/settings.js]
        Tunnel[js/tunnel.js]
        LogViewer[js/logViewer.js]
        Upload[js/upload.js]
    end

    subgraph Training
        Training[js/training.js]
    end

    Remote --> Socket
    Remote --> TimeSync
    Remote --> Format
    Remote --> LaneButtons
    Remote --> EventHeat
    Remote --> SessionSel

    Screen --> Socket
    Screen --> TimeSync
    Screen --> Format
    Screen --> LaneDisplay
    Screen --> Stopwatch
    Screen --> WakeLock

    Devices --> Socket
    Training --> Socket
```

## Risico's en mitigaties

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| `type="module"` laadt scripts deferred | Laag — alle huidige code gebruikt `DOMContentLoaded` | Verifieer dat init-logica in `DOMContentLoaded` of top-level van module staat |
| Module scripts zijn CORS-strenger | Laag — zelfde origin | Geen actie nodig voor zelfde origin |
| `screen-old.html` verwijderen | Laag — ongebruikt | Verifieer dat nergens naar gelinkt wordt |
| Training pad-fix `/public/js/` → `/js/` | Laag — huidige pad werkt per ongeluk | Test na migratie |
| `onclick` → event listeners in devices/training | Medium — rendering timing | Plaats listeners direct na `innerHTML` set, of gebruik event delegation |
| Geen build step → geen transpilation | Laag — target is moderne browsers | Gebruik geen syntax die niet in Node 22 / Chrome 120+ wordt ondersteund |
| Cloudflare tunnel serves `type="module"` | Laag — modules werken over HTTPS | Verifieer screen.html via tunnel |

## Wat niet verandert

- **Backend**: geen enkele server-side wijziging.
- **WebSocket protocol**: berichten blijven identiek.
- **HTML structuur**: alleen `<script>` tags veranderen.
- **CSS**: geen wijzigingen.
- **Tailwind build**: geen wijzigingen.
- **Docker**: geen wijzigingen.
- **Tunnel restrictions**: geen wijzigingen (module scripts zijn statische
  bestanden, zelfde paden).

## Volgorde van uitvoering

1. Fase 1: Gedeelde modules aanmaken (non-breaking, kan op main branch)
2. Fase 2: Remote migreren (hoogste risico — eerst testen)
3. Fase 3: Screen migreren
4. Fase 4: Admin inline scripts extraheren (laag risico, hoog hergebruik)
5. Fase 5: Devices migreren
6. Fase 6: Settings migreren
7. Fase 7: Training migreren
8. Fase 8: Opruimen (pas nadat alle pagina's gemigreerd zijn)
9. Fase 9: Docs + tests

Elke fase is een aparte commit. Na elke fase: browser smoke test van de
gemigreerde pagina(s). Pas doorvoeren naar main na volledige migratie +
tests.

## Buiten scope

- Vue, React, Svelte, of welk framework dan ook.
- Build tools (Vite, Webpack, esbuild, Rollup).
- TypeScript voor de frontend (backend blijft TypeScript).
- CSS wijzigingen.
- Backend wijzigingen.
- Nieuwe features.
