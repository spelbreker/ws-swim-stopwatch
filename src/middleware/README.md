# Tunnel Restriction Middleware

## Overzicht

Deze middleware beschermt de applicatie door alleen specifieke routes toe te staan wanneer toegang via Cloudflare Tunnel plaatsvindt. Lokale toegang (localhost, private IP's) is altijd onbeperkt.

## Hoe het werkt

1. **Detectie van Cloudflare requests**: De middleware controleert of het verzoek van Cloudflare komt door te kijken naar de `cf-connecting-ip` header.

2. **Route validatie**: Als het verzoek via Cloudflare komt, wordt gecontroleerd of het pad op de whitelist staat.

3. **Actie**:
   - **Toegestaan**: Verzoek wordt doorgestuurd naar de applicatie
   - **Geblokkeerd**: HTTP 403 Forbidden wordt teruggegeven

## Toegestane routes via Cloudflare Tunnel

Deze routes zijn toegankelijk voor externe/publieke gebruikers:

- `/competition/screen.html` - Competition screen weergave
- `/competition/screen.js` - Screen JavaScript
- `/css/*` - Alle stylesheets
- `/image/*` - Alle afbeeldingen
- `/js/main.js` - Hoofd JavaScript bestand
- `/js/timeSync.js` - Tijd synchronisatie
- `/competition/event/*` - Event data API endpoints
- `/competition/summary` - Competitie samenvatting API
- `/devices` - Apparaten lijst API

## Geblokkeerde routes via Cloudflare Tunnel

Deze routes zijn ALLEEN lokaal toegankelijk:

- `/competition/remote.html` - Remote control interface (administratief)
- `/competition/upload.html` - Bestand upload interface (administratief)
- `/competition/log.html` - Log viewer (administratief)
- `/index.html` - Dashboard (administratief)
- `/training/*` - Training modus (administratief)
- `/tunnel.html` - Tunnel configuratie (administratief)
- `/devices.html` - Apparaten management (administratief)
- Alle andere niet-gewhiteliste routes

## Implementatie

De middleware wordt toegepast in [server.ts](../server.ts):

```typescript
import { tunnelRestrictionMiddleware } from './middleware/tunnelRestriction';

// Pas middleware toe VOOR het serveren van static files
app.use(tunnelRestrictionMiddleware);
app.use(express.static('public'));
```

## Testen

### Test lokale toegang (moet alles toestaan)

```bash
# Vanuit de host/container
curl http://localhost:8080/competition/remote.html  # Should work
curl http://localhost:8080/index.html               # Should work
```

### Test Cloudflare toegang (moet beperkt zijn)

```bash
# Simuleer Cloudflare header
curl -H "cf-connecting-ip: 1.2.3.4" http://localhost:8080/competition/screen.html  # Should work
curl -H "cf-connecting-ip: 1.2.3.4" http://localhost:8080/competition/remote.html  # Should return 403
curl -H "cf-connecting-ip: 1.2.3.4" http://localhost:8080/index.html               # Should return 403
```

## Uitbreiden van toegestane routes

### Optie 1: Via configuratiebestand (aanbevolen)

Bewerk [../../config/tunnel-routes.json](../../config/tunnel-routes.json):

```json
{
  "allowedRoutes": [
    "/competition/screen.html",
    "/competition/screen.js",
    "/css/",
    "/image/",
    "/jouw-nieuwe-route",
    "/api/publiek-endpoint/"
  ],
  "description": "Routes ending with '/' match all paths starting with that prefix."
}
```

Herstart de server om de wijzigingen te laden.

### Optie 2: Hardcoded in middleware

Als het configuratiebestand niet bestaat, worden de standaard routes gebruikt die gedefinieerd zijn in [tunnelRestriction.ts](./tunnelRestriction.ts):

```typescript
const DEFAULT_ALLOWED_ROUTES = [
  '/competition/screen.html',
  '/competition/screen.js',
  '/jouw-nieuwe-route',  // Voeg hier toe
  // ...
];
```

## Veiligheidsoverwegingen

1. **Whitelist benadering**: Alleen expliciet toegestane routes zijn toegankelijk via tunnel (veiliger dan blacklist)

2. **Cloudflare detectie**: Vertrouwt op `cf-connecting-ip` header, wat alleen door Cloudflare kan worden ingesteld

3. **Lokale toegang**: Geen beperkingen voor lokale gebruikers, wat administratie eenvoudig houdt

4. **Logging**: Geblokkeerde verzoeken worden gelogd voor monitoring

## Beperkingen

- De middleware vertrouwt op de `cf-connecting-ip` header. Als je de tunnel omzeilt en deze header falsifieert, werkt de beveiliging niet.
- Voor productieomgevingen met gevoelige data, overweeg aanvullende authenticatie via Cloudflare Access.

## Gerelateerde documentatie

- [Cloudflare Tunnel Setup Guide](../../docs/cloudflare-tunnel.md)
- [WebSocket API Documentation](../../docs/websocket-api.md)
