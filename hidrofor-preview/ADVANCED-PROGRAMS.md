# Programe avansate — configurare locală

În **WEB DEMO**, SMART, CU PAȘI și ADAPTIV se configurează și se salvează în
browser. Execuția, armarea și comenzile către releu necesită integrarea
ulterioară cu ESP32.

Interfața publicată în acest repository setează `HIDROFOR_PREVIEW_ONLY` și
folosește date și răspunsuri simulate. Datele afișate ca DEMO nu sunt citiri
hardware. Simularea și scenariile de defect sunt disponibile în laboratorul
E10 pentru teste locale.

## Programe locale și programări existente

Schițele avansate sunt păstrate în spațiul local al browserului și al originii
paginii. Ele nu sunt un backup al centralei, nu se sincronizează automat între
dispozitive și pot dispărea dacă datele site-ului sunt șterse. O schiță salvată
nu înseamnă un program activat sau o comandă confirmată.

Programările automate existente sunt o funcție separată, cu propriul contract de
interfață pentru ESP32: `/api/schedules` și rutele sale de administrare. În
DEMO, și acele răspunsuri sunt simulate. Nu se trimite o schiță avansată prin
aceste rute și nu se transformă o configurare locală într-o programare fizică.
Funcționarea existentă Automat, autorizarea și protecțiile sale rămân
responsabilitatea implementării respective.

## SMART

SMART compară o temperatură sau umiditatea relativă **a aerului** cu pragurile
introduse de utilizator. Condițiile folosesc convenția E10 existentă:

- Sub X: valoarea este strict mai mică decât X.
- Între X și Y: valoarea este cel puțin X și strict mai mică decât Y.
- Peste X: valoarea este cel puțin X.

Se poate alege sera relevantă sau o regulă pentru cele două sere. Ora și
durata sunt parametri ai schiței locale. La evaluarea în laboratorul E10,
lipsa ori invaliditatea datelor necesare blochează simularea, inclusiv când
condiția ar putea fi îndeplinită de o singură seră.

Temperatura și umiditatea aerului nu măsoară umiditatea solului și nu stabilesc
singure necesarul de apă al plantelor. Pragurile din exemple sunt pentru
înțelegerea interfeței, nu recomandări agronomice.

## CU PAȘI

Un program cu pași conține segmente de udare ON și pauză OFF. Modelul E10
validează 1–16 pași alternanți, cu cel puțin un ON și durate întregi de 1–120
minute pe pas. Cronologia din laboratorul E10 distinge minutele de udare
cerute, pauzele programate și pauzele de protecție introduse de model.

Pentru vizualizare, modelul împarte fiecare pas ON în segmente de maximum
4 minute și inserează câte 30 de secunde de pauză între segmentele aceluiași
pas. Limita modelului pentru durata totală simulată este 4 ore. Aceste valori
reprezintă **regulile simulării**, nu confirmarea unei execuții reale sau a
versiunii de firmware aflate pe dispozitiv.

De exemplu, la 07:00, secvența ON 10 min → OFF 20 min → ON 30 min are:

- 40 min de udare solicitată;
- 20 min de pauză programată;
- 4 min 30 s de pauze de protecție simulate;
- 64 min 30 s durată totală simulată.

Pauza OFF începe la 07:11, iar al doilea pas ON începe la 07:31. Timpii sunt
calculați de simulator și nu reprezintă confirmări ale releului.

## ADAPTIV

ADAPTIV alege o durată exactă din trei intervale de temperatură. Operatorul
configurează cele două praguri, cele trei durate și sursa temperaturii; nu se
folosește modelul procentual vechi. De exemplu:

- sub 20°C → 5 min;
- de la 20°C până sub 30°C → 8 min;
- de la 30°C în sus → 10 min.

În laboratorul E10, temperatura utilizată și intervalul rezultat sunt date
pentru simulare. Temperatura este evaluată la pornirea unei rulări și
durata aleasă rămâne fixă până la finalul acelei simulări; actualizarea
ulterioară a unei citiri nu modifică retroactiv o simulare deja pornită.
Politica de reevaluare și de oprire pentru o udare fizică nu este stabilită
prin această interfață.

## Date climatice și limite de încredere

`/api/live` din preview furnizează un snapshot simulat. O implementare care
folosește un snapshot afișează sursa și refuză valorile necesare când lipsesc,
sunt invalide, expirate, au moment imposibil sau nodul necesar este offline.
Nu completează automat datele lipsă cu zero sau cu o măsurătoare inventată.

În contractele inspectate, `lastSeen` indică o informație de recepție, nu o
dovadă a momentului real al măsurării senzorului. Prospețimea răspunsului
centralei nu garantează prospețimea fiecărei sere. Nu există aici dovadă că
proveniența fiecărui eșantion climatic este validată sau autentificată;
același tip de stare poate proveni din fluxuri diferite. Prin urmare, un
rezultat SMART sau ADAPTIV este doar o previzualizare, nu o autorizare pentru
pompa fizică. Politica exactă pentru sursele și vârsta datelor reale necesită
un adaptor și validare firmware separate.

## Ce este necesar pentru execuție fizică ulterioară

Integrarea pe dispozitive nu face parte din această schimbare. Înainte de o
eventuală implementare firmware sunt necesare, cel puțin:

1. Un contract versionat între UI și ESP32 pentru fiecare tip de program,
   validare pe dispozitiv și stocare/migrare cu integritate verificată. Nu se
   presupune că programările temporizate existente înțeleg reguli avansate.
2. O politică verificată de identitate, proveniență și prospețime a datelor
   pentru fiecare seră, inclusiv lipsă de date, recepții întârziate, reporniri,
   schimbarea ceasului și protecția comunicației radio. Vârsta de la recepție
   nu dovedește singură că măsurarea nu a fost repetată.
3. Implementarea pe ESP32 a regulilor SMART selectate, a secvențelor și a
   intervalelor ADAPTIV cu durate exacte. Modulele C++ izolate existente și
   modelul procentual vechi nu dovedesc că aceste reguli sunt integrate sau
   compatibile cu noua interfață.
4. Integrarea cu programatorul, RTC, NVS, armarea explicită și motorul de
   automatizare; definirea comportamentului la repornire, conflict, expirarea
   datelor, STOP/PANIC și pierderea comunicației. Pentru ADAPTIV trebuie
   stabilit explicit când se fixează durata și ce se întâmplă la schimbarea
   condițiilor în timpul udării.
5. Păstrarea interblocajelor pentru apă, baterie și releu, a priorității STOP,
   a protecțiilor locale și a confirmărilor reale. Eligibilitatea calculată,
   solicitarea START, confirmarea și timpul efectiv trebuie tratate separat.
6. Compilarea și testarea versiunilor exacte de firmware ESP32 și ESP-01S,
   verificări automate și testbench pe dispozitive fără pompă conectată, apoi
   probe fizice controlate după o analiză separată. Testele JavaScript și
   rezultatele unui candidat anterior nu validează firmware-ul modificat.

Nicio regulă de mai sus nu pornește hardware-ul și nu constituie aprobare de
flash sau de operare a instalației.
