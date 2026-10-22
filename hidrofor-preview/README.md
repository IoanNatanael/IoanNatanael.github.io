# Hidrofor V13 – previzualizare web

Interfața de test (WEB ONLY), cu date simulate. Nu se conectează la hidroforul real.

## V13-S5 — statistici de utilizare hardware

În **Service → Date și diagnostic → Statistici de utilizare hardware**, secțiunea
reutilizează exclusiv snapshot-urile deja încărcate. Deschiderea ei nu face cereri.
Nu adaugă polling, comenzi, scrieri EEPROM, acumulare locală sau resetare hardware.

Contractele inspectate în `app.html` (acest repository nu conține firmware):

| Sursă existentă | Date utilizate | Limite de interpretare |
| --- | --- | --- |
| `/api/live` | `hidroforNode.commandCounter`, `ack`, `relay`, `online`, `pending`, `stopIntent`; `timpHidrofor` | Contor software fără persistență garantată; ACK instantaneu; în simulator durata este doar a pornirii curente, în `HH:mm:ss`. |
| `/api/commands-feed?last=40` | `time`, `title`, `resultKey` / `result` | Număr de înregistrări de solicitare, separat pe rezultat explicit. Rezultatul lipsă/necunoscut nu devine OK. |
| `/api/events-feed?source=all&last=150` | `time`, `source`, `severityKey` / `severity`, `title`, `hidroforKey`, `hidrofor` | Evenimente software; nu măsurări de acționări fizice. Feed newest-first conform simulatorului existent. |

Estimarea istorică însumează doar perechi **consecutive** de evenimente explicite
„Hidrofor pornit” → „Hidrofor oprit”, cu sursa Hidrofor, nivel Info și stare
concordantă. Orice eveniment intermediar întrerupe perechea. Nu se folosesc
comenzile, snapshot-urile generice, începutul lotului ori ora browserului pentru
a completa intervale. Timestamp-urile includ secunde și se verifică strict pe
calendarul RTC local, independent de timezone-ul calculatorului. Datele invalide
și inversările ordinii suspendă estimarea lotului; timestamp-urile comune și
zilele schimbării orei Europe/Bucharest exclud perechile afectate.

Fără perechi eligibile, durata este **indisponibilă**, nu zero. Suma este doar o
estimare parțială a intervalelor eligibile, fără garanția continuității jurnalului.
Golurile, suprascrierile și ajustările RTC nedetectabile pot afecta rezultatul.
Fiecare feed are propriul interval disponibil, fără corelare presupusă prin ID.
Reîncărcarea înlocuiește lotul analizat; nu cumulează aceleași înregistrări.

Nu există în aceste contracte un contor persistent real de ore motor/cicluri releu,
o măsurare a uzurii sau date pentru „viață rămasă”. Ștergerea jurnalului nu
resetează uzura fizică. Toate valorile preview sunt marcate DEMO.

Verificări JS și cazuri de calcul/lipsuri/cronologie (Node.js, fără dependențe):

```sh
node --test hidrofor-preview/tests/service-usage.test.cjs
```

## V13-S6 — calibrare asistată prin comparație cu un etalon

În **Service → Date și diagnostic → Calibrare asistată**, se poate alege nodul
(ESP32 central, Sera 1 sau Sera 2) și mărimea (temperatură, umiditate,
tensiune baterie). Instrumentul capturează citirea exactă din ultimul
`/api/live` cu ora dispozitivului, apoi compară o valoare de referință.
Referința acceptă punct și virgulă ca separator zecimal.

- Abatere = **citire capturată − referință**.
- Compensație teoretică = **referință − citire**, fără aplicare firmware.

Captura necesită telemetrie ESP32 recentă (`i3Fresh`), nod de seră online
și fără raportare întârziată, număr și unitate valide. Pentru tensiunea
centrală, câmpurile `baterieOk` și `batteryInaOk` trebuie să fie true.
Capturile rămân fixe între poll-uri, nu suprascriu citirile altor pagini
și se șterg la schimbarea nodului, mărimii, închiderea panoului ori refresh.

„Parametri de diagnostic” afișează numai constantele UI: interval sere
8 min, întârzieri 16/32 min și limitele jurnalelor 40/150 înregistrări.
Acestea **nu sunt praguri sau interblocaje ale hardware-ului**.

S6 nu adaugă rute POST, polling, persistare sau scrieri în EEPROM.
Nu există în API-ul inspectat suport confirmat pentru calibrare fizică;
o calibrare efectivă ar necesita implementare și validare firmware.
În preview, datele sunt simulate.

Teste independente:

```sh
node --test hidrofor-preview/tests/service-calibration.test.cjs
```

## V13-R21 — aplicație unificată (web DEMO)

Aceasta este versiunea comună pentru dezvoltarea viitoare: interfața V13-R20
(programări R18–R20) și pagina Service reorganizată în:
- **Instrumente:** test pompă, RTC, OTA, administrare jurnale, simulator;
- **Consolă de date:** o sursă și o categorie selectată la un moment dat;
  Hidrofor, Centrală, Seră 1, Seră 2, EEPROM și Jurnal.

Fișierele `r18-schedules.css` și `r18-schedules.js` au fost preluate
identic din ultima versiune `main` V13-R20. Regulile de publicare Pages
rămân protejate pentru branch-ul `main`.

**Important:** WEB ONLY / DEMO. Această publicație nu este aplicația
firmware ACTIVE de pe ESP32. Valorile și acțiunile sunt simulate;
integrarea în proiectul ACTIVE din Drive se face ulterior, separat.

Teste logice (nu înlocuiesc testarea reală în browser):

```sh
node --test hidrofor-preview/tests/service-*.test.cjs
```

## Service compact — navigare simplificată

În interfața V13-R21, `Service → Consolă de date` afișează numai
categorii relevante pentru sursa selectată. Opțiunile **Utilizare**
(statistici derivate dintr-un jurnal parțial) și **Comparație**
(abatere față de un aparat de referință, fără calibrare firmware)
nu mai sunt afișate în navigarea obișnuită. Codul lor de diagnostic
rămâne în versiunea de dezvoltare, dar nu intervine în controlul sistemului.

**EEPROM → Export:** două opțiuni, setul de date și formatul CSV/JSON.
Se descarcă automat întregul lot disponibil (max. 40 comenzi,
150 evenimente sau 168 citiri orare per nod, când sunt disponibile).
Nu există calendar sau selectarea manuală a ferestrei și nu este un
backup complet al EEPROM. În DEMO, descărcarea este simulată,
fișierul include `DEMO` în nume, iar JSON marchează `simulated=true`.
În ACTIVE, verificarea că pompa este oprită rămâne obligatorie.

**Jurnal → Evenimente:** o singură listă de evenimente, cu un rezumat
scurt al alertelor și opțiuni de căutare/filtrare. Comenzile hidroforului
se consultă separat în **Hidrofor → Activitate** sau **Jurnal → Pompa**.

Teste de regresie: `node --test hidrofor-preview/tests/service-simplified.test.cjs`.
