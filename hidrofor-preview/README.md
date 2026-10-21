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
