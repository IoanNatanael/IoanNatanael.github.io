# Hidrofor V13-R21 → ACTIVE — integrarea I1

**Stare:** candidat de integrare exclusiv GET / NUMAI CITIRE, fără flash și fără înlocuirea interfeței de pe ESP32.

## Baza verificată

- UI: `hidrofor-preview/app.html` din `main` (V13-R21, DEMO), cu `r18-schedules.css` și `r18-schedules.js`.
- ACTIVE: sursele de lucru din folderele principale Drive, conform documentului `00_00_START_AICI`. Sursa ESP32 conține `CENTRAL_FW_VERSION = 2026.10.08-ina219-dual-12v1`; ESP-01S conține `HIDROFOR_FW_VERSION = 2026.10.08-local-timeout-stop-priority1`.
- Nu confundăm folderele CANDIDATE/COPII cu ACTIVE și nu afirmăm că sursa Drive este deja flashuită pe dispozitive.

## Ce s-a implementat acum

- `app-active-readonly.html` pornește de la interfața completă R21, fără simulare (`forceMock() === false`).
- Blocaj explicit înaintea transportului HTTP, inclusiv înaintea CSRF: **toate metodele diferite de GET sunt respinse**.
- Sunt admise strict următoarele rute GET identificate în ACTIVE:
  `/api/live`, `/api/commands-feed`, `/api/events-feed`, `/api/hourly-chart`, `/api/storage`.
- START, STOP, PANIC, AUTO, ștergeri și configurări sunt dezactivate la nivel de transport în candidat.
- La răspunsuri lipsă și date expirate, nu confirmăm fictiv că motorul este oprit.
- Teste: `node --test hidrofor-preview/tests/active-readonly.test.cjs`.

## Incompatibilități identificate — nu se ghicesc și nu se ocolesc

| Domeniu | Firmware ACTIVE verificat | UI V13-R21 | Acțiune ulterioară |
|---|---|---|---|
| Citiri live | `GET /api/live` prezent | `GET /api/live` | Primul pas de conectare în citire |
| Jurnal și istoric | `GET /api/commands-feed`, `/api/events-feed`, `/api/hourly-chart` | Prezent | Testare răspunsuri și rate limit |
| EEPROM | `/api/storage` răspunde ca text | UI așteaptă anumite date de diagnostic | Adapter explicit, fără presupuneri |
| Siguranță apă | `hidroforNode` LIVE nu include `water.fresh/ready/state` | START și Service le cer | Nu se pornește pompa; soluție firmware separată |
| Pornire/Oprire | `/porneste`, `/opreste`, `/auto`, `/api/panic-stop` sunt înregistrate fără metoda POST obligatorie | Frontend trimite POST, CSRF | Contract nou + teste; fără bypass |
| Temporizat | Fără `GET /api/timed` și `POST /api/timed/start` în rutele ACTIVE | Funcționalitate din UI | Implementare în firmware doar într-o etapă dedicată |
| Programări | Fără `/api/schedules` ori operațiile R20 | UI cu programări | API și protecții noi necesare înainte de activare |

## Condiții de lucru

1. **Nu publicăm sursa ACTIVE cu secrete într-un repository public.** Firmware-ul de lucru rămâne în Drive, împreună cu headerele și `partitions.csv`.
2. `app-active-readonly.html` este pentru servire de pe **aceeași origine HTTP a ESP32**. Pe GitHub Pages nu poate citi în mod sigur AP-ul local și nu trebuie tratat ca o conexiune reală.
3. Fără flash până la compilare, verificarea ocupării flash/partițiilor și testare pe hardware; actualizarea OTA nu modifică tabla de partiții.
4. Nicio interfață web nu trebuie să promită STOP garantat în absența comunicației; releul și protecțiile rămân responsabilitatea firmware-ului.

## Următoarea modificare (I2, separată)

Conectăm efectiv citirea `/api/live` în versiunea candidat servită de ESP32, cu adaptarea stărilor lipsă, marcaj de prospețime și teste offline. **Nu implementăm comenzile în aceeași etapă.**
