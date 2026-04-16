# Menetirányítás Excel Kiváltás - Mapping és Technikai Specifikáció

## 1. Cél

A jelenlegi `menetiranyitas&tervezes_2025 (1).xlsx` folyamat kiváltása úgy, hogy:

- az **Export** lap napi tervezési adatait rendszeresen be tudjuk tölteni,
- a **Segédtábla** sofőr- és erőforrás szabályait normalizáltan kezeljük,
- a rendszer sofőrönként kiszámolja:
  - mikor indulhat,
  - milyen feladatra alkalmas,
  - ha nem indulhat, mi az oka.

## 2. Scope

### 2.1 Benne van

- Excel -> normalizált JSON adatimport
- mezőszintű mapping (Export lap + Segédtábla)
- validációs szabályok
- indulhatósági (eligibility) motor
- dedikált vontató/rendszám ellenőrzés
- napi tervező kimeneti modell

### 2.2 Nincs benne (MVP-n túl)

- automatikus útvonaloptimalizálás több fuvarra (VRP)
- teljes bér- és költségelszámolás
- külső TMS/WMS kétirányú API integráció

## 3. Lapfülök és források

Feltételezett forrás lapfülök:

1. `Export` (napi tervezendő feladatok)
2. `Segédtábla` (sofőr törzs + munkarend + dedikált rendszám)

Ha az éles Excelben ettől eltérő név van, a loaderben alias listát kell fenntartani.

## 4. Normalizált célmodell

## 4.1 Entitások

- `drivers` (sofőr törzs)
- `driverSchedules` (munkarend szabályok)
- `vehicles` (vontatók)
- `jobs` (napi fuvarfeladatok)
- `planningContext` (tervezési dátum, referenciaidők)

## 4.2 Kötelező kulcsok

- `driverId`
- `jobId`
- `workPatternCode`
- `planningDate`

## 4.3 Javasolt JSON példa

```json
{
  "planningContext": {
    "planningDate": "2026-04-15",
    "sourceFile": "menetiranyitas&tervezes_2025 (1).xlsx",
    "generatedAt": "2026-04-15T08:30:00Z"
  },
  "drivers": [
    {
      "driverId": "DRV-001",
      "name": "Minta Sofor",
      "adrQualified": true,
      "preferredCountries": ["DE", "AT"],
      "blockedCountries": ["NO"],
      "homeBase": "Kornye",
      "dedicatedVehiclePlate": "ABC-123"
    }
  ],
  "driverSchedules": [
    {
      "driverId": "DRV-001",
      "workPatternCode": "5_2",
      "cycleLengthDays": 7,
      "workDays": 5,
      "restDays": 2,
      "cycleAnchorDate": "2026-01-06",
      "exceptions": [
        {
          "date": "2026-04-15",
          "override": "REST"
        }
      ]
    }
  ],
  "vehicles": [
    {
      "plateNumber": "ABC-123",
      "vehicleType": "nemzetkozi",
      "adrCapable": true,
      "active": true
    }
  ],
  "jobs": [
    {
      "jobId": "EX-2026-0415-001",
      "direction": "export",
      "pickupAt": "2026-04-15T06:00:00+02:00",
      "dropoffAt": "2026-04-15T16:00:00+02:00",
      "pickupAddress": "Magyarorszag, Kornye",
      "dropoffAddress": "Munchen",
      "distanceKm": 540,
      "adrRequired": false,
      "requiredHands": 1,
      "status": "planning"
    }
  ]
}
```

## 5. Mezőszintű mapping - Export lap

| Excel oszlop | Cél mező | Típus | Kötelező | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| Fuvar ID / Fuvar Szám | jobs[].jobId | string | igen | egyedi, nem üres | trim, whitespace normalizálás |
| Fuvar Típus | jobs[].direction | enum | igen | export/import/belfold | alias: exp -> export |
| Státusz | jobs[].status | enum | igen | planning/assigned/done/cancelled | mapping táblával |
| Tervezett Indulás | jobs[].pickupAt | datetime | igen | ISO parse-olható | timezone Europe/Budapest |
| Tervezett Érkezés | jobs[].dropoffAt | datetime | igen | dropoffAt > pickupAt | hibás sor blokkolása |
| Felrakó cím | jobs[].pickupAddress | string | igen | min 3 char | |
| Lerakó cím | jobs[].dropoffAddress | string | igen | min 3 char | |
| KM | jobs[].distanceKm | number | igen | > 0 | egészre kerekítés |
| ADR | jobs[].adrRequired | bool | igen | I/N, igen/nem, 1/0 | bool parser |
| Kézszám / Négykezes | jobs[].requiredHands | int | nem | 1 vagy 2 | default: 1 |
| Menetirányítási egység | jobs[].dispatchUnit | string | nem | max 64 | |
| Partner referencia | jobs[].partnerReference | string | nem | max 128 | |
| Akasztási magasság | jobs[].hookHeightMm | number | nem | > 0 | mm egység |
| Tranzit idő (terv) | jobs[].plannedTransitMinutes | int | nem | >= 0 | perc |
| Vezetési idő (terv) | jobs[].plannedDrivingMinutes | int | nem | >= 0 | perc |
| Megjegyzés | jobs[].note | string | nem | max 500 | |

## 6. Mezőszintű mapping - Segédtábla

| Excel oszlop | Cél mező | Típus | Kötelező | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| Sofőr ID | drivers[].driverId | string | igen | egyedi, nem üres | primer kulcs |
| Sofőr neve | drivers[].name | string | igen | min 3 char | |
| ADR jogosultság | drivers[].adrQualified | bool | igen | bool parser | |
| Munkarend | driverSchedules[].workPatternCode | enum | igen | 5_2, 11_3, 6_1, custom | normalizált kód |
| Ciklus kezdőnap | driverSchedules[].cycleAnchorDate | date | igen | parse-olható dátum | ciklusszámításhoz |
| Dedikált rendszám | drivers[].dedicatedVehiclePlate | string | nem | plate regex | vehicle hivatkozás |
| Preferált országok | drivers[].preferredCountries | string[] | nem | ISO országkód | `;` szeparált |
| Nem preferált országok | drivers[].blockedCountries | string[] | nem | ISO országkód | `;` szeparált |
| Rövid munka vállalás | drivers[].shortShiftAllowed | bool | nem | bool parser | default false |
| Hétvégi vállalás max | drivers[].maxWeekendCommitments | int | nem | >= 0 | |
| Aktív | drivers[].active | bool | nem | bool parser | default true |

## 7. Munkarend-szabály motor

## 7.1 Alapszabály

A `workPatternCode` alapján számoljuk, hogy a `planningDate` munkanap vagy pihenőnap.

- `5_2`: 5 nap munka + 2 nap pihenő
- `11_3`: 11 nap munka + 3 nap pihenő
- `6_1`: 6 nap munka + 1 nap pihenő
- `custom`: `workDays` + `restDays` oszlopból

Képlet:

- `elapsedDays = planningDate - cycleAnchorDate`
- `cyclePos = elapsedDays mod cycleLengthDays`
- ha `cyclePos < workDays` => `WORK`, különben `REST`

## 7.2 Kivételek

A `exceptions` felülírja az alapszabályt (pl. szabadság, beteg, túlóra).

Prioritás:

1. jogszabályi tiltás
2. exception override
3. alap ciklusszabály

## 7.3 Indulhatóság (Eligibility)

Sofőr indulhat, ha minden feltétel igaz:

- munkanap (`WORK`)
- nincs szabadság/beteg tiltás
- marad napi és heti vezetési idő
- ADR követelmény esetén ADR képesítés megvan
- ha dedikált vontató kötelező, akkor a rendszám elérhető és kompatibilis
- nincs időütközés meglévő foglalással

## 8. Kimeneti modell a napi tervezéshez

## 8.1 Driver Eligibility Result

```json
{
  "driverId": "DRV-001",
  "planningDate": "2026-04-15",
  "canStart": false,
  "firstPossibleStartAt": "2026-04-16T05:00:00+02:00",
  "reasons": [
    {
      "code": "REST_DAY",
      "message": "A mai nap a 5/2 ciklus szerint pihenonap"
    }
  ],
  "compatibleJobIds": ["EX-2026-0415-003", "IM-2026-0415-002"],
  "warnings": []
}
```

## 8.2 Reason kódkészlet (minimum)

- `REST_DAY`
- `ON_LEAVE`
- `SICK_LEAVE`
- `NO_DAILY_DRIVE_TIME`
- `NO_WEEKLY_DRIVE_TIME`
- `REQUIRED_REST_PENDING`
- `ADR_MISSING`
- `DEDICATED_VEHICLE_UNAVAILABLE`
- `TIMELINE_COLLISION`
- `JOB_TIME_WINDOW_MISS`

## 9. Validációs szabályok

## 9.1 Hard error (sor elutasítás)

- kötelező mező hiányzik
- dátum parse hiba
- lerakás idő <= felrakás idő
- ismeretlen munkarend kód
- duplikált `jobId` vagy `driverId`

## 9.2 Soft warning (sor megtartható)

- hiányzó optional mező
- valószínűtlen távolság (pl. > 2500 km belföld)
- dedikált rendszám nincs a járműtörzsben

## 10. Implementációs terv

## 10.1 Fájlok (javasolt)

- `tools/excel/import_menetiranyitas.py`
- `tools/excel/mapping_config.json`
- `assets/js/data/generated/planning-context.json`
- `assets/js/data/generated/drivers.json`
- `assets/js/data/generated/driver-schedules.json`
- `assets/js/data/generated/vehicles.json`
- `assets/js/data/generated/jobs.json`
- `assets/js/core/eligibility-engine.js`

## 10.2 Lépések

1. Excel beolvasás (`pandas`, `openpyxl`)
2. oszlopnév normalizálás (kisbetű, accent fold, trim)
3. mapping táblázat szerinti transzformáció
4. validáció (hard/soft)
5. normalizált JSON export
6. eligibility számítás
7. UI-ben napi tervezési lista render

## 10.3 Kimeneti report

Minden import futás végén:

- feldolgozott sorok száma
- hard error lista (sorszám + ok)
- soft warning lista
- exportált rekordszám entitásonként

## 11. Elfogadási kritériumok

- egy mintanapra az Excel manuális eredményének legalább 95%-a egyezik a rendszer döntésével
- minden nem indulható sofőrnél gépileg olvasható indokkód és emberi üzenet van
- `planningDate` változtatásra a kimenet reprodukálható
- import hiba esetén részletes diagnosztika készül

## 12. Nyitott kérdések (go-live előtt tisztázandó)

- a dedikált rendszám kötelező vagy csak preferencia?
- mi a kezelése a rendkívüli munkanapnak (manual override meddig él)?
- a 2-kezes feladat kötelezően fix párral megy vagy dinamikus párosítás is lehet?
- melyik oszlop az elsődleges igazságforrás, ha Export és Segédtábla konfliktusban van?

## 13. Javasolt pilot

- 2 hét párhuzamos üzem (Excel + rendszer)
- napi eltéréslista és okkategória elemzés
- szabályok finomhangolása után éles átállás
