# Open reviewbevinding: reconnect verliest event/heat-selectie

## Status en afbakening

- Status: **open; niet opgelost**.
- Vastgesteld op `feature/es-modules-frontend`, commit `71aaa02`, op 25 september 2026.
- Dit is bevinding 1 uit de onafhankelijke branchreview.
- De fixes voor vastzittende baankleuren en oplopende pingtimers staan hier los van. Die wijzigen de event/heat-selectie niet.
- Dit document beschrijft een mogelijke oplossing; het is geen bewijs dat reconnects de volledige wedstrijdstatus herstellen.

## Probleem en impact

De remote vult bij ieder WebSocket-`open`-event de event- en heat-dropdowns opnieuw. Dit gebeurt niet alleen bij het openen van de pagina, maar ook na iedere automatische reconnect. Het vervangen van de opties selecteert opnieuw de eerste optie en verliest de eerder gekozen wedstrijd/serie.

Tijdens de review is in een browser met een geïsoleerde mockserver bevestigd:

| Moment | Event | Heat |
|---|---|---|
| Vóór verbreken van de verbinding | 3 | 4 |
| Na automatische reconnect | 1 | 1 |

De precieze terugval voor event is het eerste event in de opgehaalde lijst; dat hoeft niet altijd 1 te zijn. De heatlijst wordt opgebouwd vanaf 1.

Dit heeft drie gevolgen:

1. **Remote en scherm lopen uiteen.** Het opnieuw vullen verstuurt geen `event-heat`-bericht en triggert geen gebruikers-`change`-event. Het scherm houdt daardoor de eerder ontvangen selectie, terwijl de remote een andere selectie toont.
2. **Een volgende start kan onder de verkeerde wedstrijd/serie terechtkomen.** `startStopwatch()` leest de actuele dropdownwaarden voor het `start`-bericht. De server gebruikt deze waarden voor startlogging en het eventueel wijzigen van de heat in de splittracker.
3. **De infobalk kan intern inconsistent worden.** De eventlijst wordt asynchroon geladen, maar de `open`-handler wacht daar niet op voordat hij de infobalk bijwerkt. De balk kan dus oude eventinformatie combineren met de inmiddels geresette heat.

Een korte wifi-onderbreking kan zo een inhoudelijke wijziging veroorzaken zonder dat een operator daarvoor kiest. Een geslaagde WebSocket-reconnect is niet hetzelfde als gesynchroniseerde wedstrijdstatus.

## Reproduceren

Gebruik een ontwikkelomgeving met testdata, niet een lopende wedstrijd.

1. Open `/competition/remote.html` en optioneel `/competition/screen.html`.
2. Kies een bestaand event en een heat die niet de eerste opties zijn, bijvoorbeeld event 3 / heat 4.
3. Wacht tot de selectie op het scherm is verwerkt.
4. Verbreek alleen de socket van de remote. Dit kan via de browserconsole:

   ```js
   const { getSocket } = await import('/js/modules/socket.js');
   getSocket().close();
   ```

5. Wacht op de automatische reconnect en op het ophalen van de eventlijst.
6. Controleer de dropdowns, infobalk en het afzonderlijke scherm.
7. Inspecteer in de ontwikkelomgeving het volgende `start`-bericht: daarin staan de dropdownwaarden na de terugval.

Verwacht: een transportonderbreking verandert de gekozen sessie/event/heat niet zelfstandig.

Werkelijk: de dropdowns vallen terug naar de eerste opties, zonder bijbehorend selectiebericht naar de andere clients.

## Technische oorzaak

### Betrokken code

- `public/js/modules/socket.js`: `onSocketEvent()` bewaart subscribers onafhankelijk van de onderliggende WebSocket. Iedere nieuwe socket publiceert opnieuw `open`.
- `public/competition/remote.js`: de `open`-handler roept bij iedere verbinding `fillSelectOptions()` aan voor beide dropdowns en vervolgens direct `updateEventHeatInfoBar()`.
- `public/competition/remote/eventHeat.js`: `fillSelectOptions()` maakt de bestaande opties leeg en bouwt ze opnieuw op, zonder de geselecteerde waarde te bewaren.
- `public/competition/remote/sessionSelector.js`: de huidige sessie wordt apart bijgehouden; de initiële sessielading verloopt asynchroon.
- `src/websockets/websocket.ts`: `handleStart()` logt event/heat en kan de splittracker naar de meegegeven heat omschakelen.

Het herstellen van subscriptions in de modulemigratie is op zichzelf juist. Het probleem is dat eenmalige pagina-initialisatie en herhaald verbindingsherstel in dezelfde `open`-handler zitten. Daardoor is eerder alleen bij de eerste socket gebruikte initialisatielogica nu herhaalbaar geworden, zonder dat zij bestaande toestand behoudt.

Daarnaast representeert de DOM nu impliciet de selectie: dropdowns wissen betekent selectietoestand wissen. Er is geen expliciete controle dat het herbouwen van opties dezelfde selectie oplevert.

## Voorgestelde oplossing

### 1. Scheid initialisatie van verbindingsherstel

De kleinste passende fix is om de dropdowns één keer te initialiseren en bij een gewone reconnect ongemoeid te laten. Laat verbindingsherstel uitsluitend de verbindingsgebonden taken uitvoeren, zoals tijdsynchronisatie.

Voorgestelde verdeling:

- `remote.js` beheert de socket-lifecycle en initieert de paginalading.
- `remote/eventHeat.js` blijft eigenaar van het laden en toepassen van de event/heat-keuze.
- `remote/sessionSelector.js` levert de gekozen sessie voordat de bijbehorende events worden geladen.
- `socket.js` blijft algemeen: voeg daar geen wedstrijdselectie, dropdownlogica of sessiestatus aan toe.

Maak initialisatie een afwachtbare operatie. Een tweede verbindingsopening mag niet een tweede initialisatie starten terwijl de eerste nog loopt. Bij een mislukte eerste lading moet een expliciete retry mogelijk blijven; een boolean die al vóór succes op `true` wordt gezet, kan herstel onbedoeld blokkeren.

Voor een gewone reconnect tijdens dezelfde paginasessie is opnieuw ophalen niet nodig om deze regressie te verhelpen. Als verversing van wedstrijddata bij reconnect wél gewenst is, behandel dat als een expliciete actie met behoud en validatie van de selectie, niet als een onbedoeld neveneffect van `open`.

### 2. Behoud de selectie bij een expliciete verversing

Als de dropdowns opnieuw moeten worden geladen:

1. Bewaar sessie, event en heat als één samenhangende selectie.
2. Haal opties op zonder de huidige bruikbare DOM direct te wissen.
3. Wacht op het resultaat; gebruik geen vaste wachttijd zoals `setTimeout(..., 100)`.
4. Controleer of het resultaat nog bij de actuele sessie/selectie hoort voordat het wordt toegepast. Gebruik hiervoor bijvoorbeeld een requestversie of annuleer achterhaalde requests.
5. Herstel de selectie als deze nog geldig is. DOM-selectwaarden zijn strings; vergelijk API-nummers consequent met `String(...)`.
6. Werk pas daarna de infobalk bij vanuit dezelfde selectie. Ook een oude infobalkresponse mag een nieuwere keuze niet overschrijven.

Vernieuwen en bewust selecteren moeten verschillende operaties blijven. Bij een door de operator gekozen nieuwe sessie kan het eerste event / heat 1 de bedoelde keuze zijn. Die keuze mag niet automatisch worden hergebruikt voor een reconnect.

### 3. Maak ontbrekende of ongeldige selectie expliciet

Als een competitie is vervangen of het oude event niet meer bestaat, is stil terugvallen naar 1 onveilig. Toon een duidelijke melding en vraag de operator om een geldige keuze. Voorkom starten zolang geen geldige selectie beschikbaar is; controleer dit ook in het startpad voor de Enter-sneltoets, niet alleen via een disabled knop.

Bij een tijdelijke fetchfout mag bestaande selectiestaat niet ongemerkt door een generieke 1..25-lijst worden vervangen. Houd rekening met het bestaande gebruik zonder geladen competitie: handmatige nummerselectie kan daar bewust ondersteund blijven. Maak onderscheid tussen die situatie en het verliezen van een eerder geldige wedstrijdselectie door een netwerkfout.

### 4. Stuur niet automatisch de oude keuze terug naar de server

Los de mismatch niet op door bij iedere reconnect blind `sendEventAndHeat()` aan te roepen. Een andere remote kan ondertussen een nieuwe selectie hebben gemaakt. Bovendien kan een `event-heat`-bericht de splittracker opnieuw instellen en lopende timingstatus beïnvloeden.

Behoud van de lokale selectie lost de hier gereproduceerde dropdownregressie op, maar herstelt geen gemiste `start`, `reset`, `split` of `event-heat`-berichten. Volledig herstel na gemiste berichten of een serverrestart vereist een afzonderlijk ontwerp: bijvoorbeeld een servergestuurde status-snapshot met sessie/event/heat, startstatus en splits. Dat is een protocolwijziging en hoort niet verstopt te worden in deze frontendfix.

## Acceptatie- en regressietests voor de toekomstige fix

| Scenario | Verwacht resultaat |
|---|---|
| Event 3 / heat 4, disconnect en reconnect | Selectie en infobalk blijven 3 / 4; geen spontaan selectie- of startbericht |
| Meerdere opeenvolgende reconnects | Geen terugval naar de eerste opties en geen dubbele initialisatie |
| Reconnect tijdens lopende stopwatch | Geen wijziging van selectie, geen extra `start`, `reset` of `event-heat` |
| Trage eerste eventfetch met tussentijdse reconnect | Eén geldige initialisatie; geen latere response die een nieuwere selectie overschrijft |
| Sessies waarvan het eerste event niet 1 is | Eerste initialisatie gebruikt de juiste sessie en een bestaand event |
| Expliciete verversing met ongewijzigde data | Bestaande sessie/event/heat worden behouden |
| Nieuwe sessie kiezen met een trage response | Nieuwe keuze pas toepassen na de juiste response, niet na een vaste 100 ms |
| Twee snel opeenvolgende sessiekeuzes | Alleen de laatste keuze bepaalt dropdowns en infobalk |
| Huidig event verdwijnt uit de competitie | Zichtbare ongeldige selectie; geen stille start onder event 1 |
| Tijdelijke fetchfout bij bestaande selectie | Geen stille terugval naar de generieke optielijst |
| Volgende start na gewone reconnect | `start` bevat exact de eerder gekozen event- en heatwaarden |
| Andere remote wijzigde de selectie tijdens disconnect | Reconnect zendt de oude keuze niet blind terug; snapshot-herstel blijft afzonderlijk werk |

Voer naast gerichte tests een browsercheck uit met remote en scherm naast elkaar en kunstmatige vertraging op de event-API. De bestaande backendtests bewijzen niet dat de browser zijn selectiestaat bewaart. De tests voor highlightreset en pingtimers in `test/modules/remoteFrontend.test.ts` mocken de selectiemodule en dekken deze open bevinding daarom nadrukkelijk niet.

## Tijdelijke werkwijze

Controleer na een verbindingsonderbreking expliciet sessie, event en heat op de remote én op het scherm voordat een volgende race begint. Herstel een onjuiste selectie alleen bewust, buiten een lopende race. Dit is een operationele voorzorg, geen vervanging voor de codefix.
