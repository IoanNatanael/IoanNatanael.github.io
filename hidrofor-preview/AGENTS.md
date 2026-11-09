# AGENTS.md — Instrucțiuni specifice Hidrofor Preview

Acest fișier completează `../AGENTS.md` și se aplică doar directorului `hidrofor-preview/`.

## Ce este această aplicație

- `app.html`: interfața Hidrofor V13-R21 și funcționalitățile sale de demonstrație.
- `e10-lab.html`: laboratorul de configurare și simulare a programelor de udare.
- `index.html`: când există, pagină de prezentare / încadrare în telefon; nu confunda rama telefonului cu aplicația propriu-zisă.
- `r18-schedules.js` și `r18-schedules.css` și celelalte module existente: respectă contractele, rolurile și testele documentate în README.
- Ramura `feature/service-center` este folosită pentru dezvoltarea interfeței. `main` și publicația aferentă nu trebuie suprascrise accidental.
- Există un preview de dezvoltare GitHub Pages la `/hidrofor-lucru/`. Verifică workflow-ul și sursele reale înainte să modifici publicarea.
- Interfața este **WEB ONLY / DEMO**. Nu reprezintă automat firmware-ul ACTIVE de pe ESP32/ESP-01S; nu presupune că API-ul preview corespunde API-ului real.

## Standard vizual și de interacțiune — obligatoriu implicit

Aplică stilul **Seamless Modern UI — Premium Minimalist**, pornind de la secțiunea „Evoluția timpului” din Centrala Hidrofor.

- O suprafață fluidă, nu o colecție de carduri. Desparte secțiunile prin conținut, tipografie și linii subtile.
- Evită nesting de carduri, contururi ostentative, margini groase, culori de fundal care fragmentează inutil și spațiu pierdut.
- Folosește selector de tip segmented control pentru puține opțiuni exclusive. Nu introduce dropdown-uri native generice dacă o alegere vizuală ar fi mai clară.
- Păstrează informația esențială la suprafață: metoda activă, configurarea relevantă, progresul și eventualele blocaje.
- Detaliile de diagnostic, datele sintetice și opțiunile rar folosite apar contextual sau în secțiuni extensibile.
- Design responsive, în primul rând pentru telefoane; verifică și desktop. Controalele trebuie să aibă etichete, focus vizibil, contrast și dimensiuni de atingere adecvate.
- Nu „repara” un design prin adăugarea altor carduri. Mai întâi simplifică fluxul și elimină redundanțele.
- Nu elimina funcționalități validate doar ca să fie pagina mai scurtă; reorganizează-le.

## Laboratorul E10 — model conceptual al interfeței

- Metode principale de selecție: **Fix, Smart, Cu pași, Adaptiv**. `Cu pași` este mod de sine stătător, nu opțiune ascunsă sub „Temporizat”.
- Flux: **aleg metoda → aleg/denumesc programul → configurez doar metoda activă → urmăresc evoluția simulării**.
- FIX: durată aleasă explicit.
- SMART: temperatură sau umiditate; condiții **sub prag**, **între praguri** sau **peste prag**. Pentru intervale, convenția existentă este `[limita inferioară, limita superioară)`; pentru „peste”, compară cu implementarea existentă înainte de a modifica semantica. Utilizatorul alege ambele sere sau cel puțin una. Date lipsă, invalide, expirate sau din surse nevalidate → refuz, inclusiv la „cel puțin una”, până există o politică explicită diferită.
- CU PAȘI: secvență ON/OFF configurabilă, cu o cronologie lizibilă și protecții simulate. Păstrează exemplul 10 min ON → 20 min OFF → 30 min ON și testează durata rezultată.
- ADAPTIV: intervale de temperatură configurabile și **durate exacte introduse de utilizator**, nu redistribuire procentuală implicită. Exemplu: sub 20°C → 5 min, de la 20°C până sub 30°C → 8 min, cel puțin 30°C → 10 min. Clarifică/afișează ce seră sau ce medie este folosită ca referință.
- Afișează **un singur progres** pentru metoda activă: starea simulată a pompei, ON/OFF, pauze de protecție, timp rămas, cronologie, play/pause/restart și defecte opționale.
- Păstrează schițele salvate local; la schimbarea formatului, protejează datele vechi și avertizează când nu există migrare semantică sigură.
- Nu confunda temperatura/umiditatea aerului cu umiditatea solului. Nu afirma că o regulă climatică este optimă agronomic fără validare.

## Limite ferme pentru sistemul fizic

- Laboratorul E10 este **SIMULARE**. Nu trimite START/STOP, nu armează programări fizice, nu scrie EEPROM/NVS, nu schimbă RTC și nu activează releul.
- Nu transforma API-uri de previzualizare, date mock sau jurnale simulate în comenzi reale. Nu adăuga apeluri de rețea de mutație în laborator.
- **Nu modifica firmware ACTIVE**, sursele ESP32/ESP-01S din Drive, cheile ESP-NOW, protecțiile pompei sau cablajul printr-o simplă modificare UI.
- Timeout-urile și opririle de siguranță sunt responsabilitatea nivelului local; orice integrare viitoare cu pompa necesită analiză separată, compilare și testbench fără sarcină înainte de probe fizice.
- Nu prezenta un test JavaScript/HTML ca validare pentru execuție fizică. Un candidat compilat nu este automat gata de flash.
- Nu include parole AP, MAC-uri private, tokenuri, credențiale sau configurații hardware sensibile în commit-uri.

## Verificare minimă înainte de a spune „gata”

1. Confirmă ramura curentă și fișierele afectate. Nu rescrie componentele nelegate de cerință.
2. Rulează testele relevante din `hidrofor-preview/tests/`, inclusiv verificările E10 și Service acolo unde există. Consultă `README.md` pentru comenzile reale; nu inventa scripturi.
3. Pentru schimbările UI, testează în browser **mobil (360–390 px, ideal și 430 px) și desktop**, inclusiv navigarea, butoanele, formularele, dialogurile, datele salvate și cazul de eroare.
4. Testează cel puțin: FIX, cele trei reguli SMART și date invalide/lipsă, cele trei benzi ADAPTIV, secvențe ON/OFF, pauze de protecție, progres și scenarii de defect.
5. Confirmă că laboratorul nu face cereri reale către ESP32 și că nu există căi neintenționate către START / mutații.
6. Raportează separat: fișiere schimbate, rezultate efectiv obținute, ce nu ai putut testa, adresa preview-ului și dacă s-a făcut sau nu merge/deploy.
