# Menetirányítás Excel kiváltás - validációs riport

## Állapot

- Forrásfájl: `assets/js/data/menetiranyitas&tervezes_2025 (1).xlsx`
- Planning date: `2026-04-16`
- Import státusz: sikeres futás
- Generated planning JSON: elkészült
- Eligibility engine MVP: elkészült
- UI loader/integráció: elkészült a meglévő erőforrásmodellekre

## Import eredmény

- `drivers`: 112
- `driverSchedules`: 112
- `vehicles`: 99
- `jobs`: 0
- `exportAssignments`: 4
- `leaveExceptions`: 4
- `rosterAssignments`: 16

## Miért 0 a jobs?

Az éles workbook `EXPORT` lapja nem fuvar-lista, hanem napi kiosztási mátrix. Emiatt az Excel-import a következőket adja ki:

- sofőr törzs
- munkarendek
- járművek
- export kiosztási sorok
- Munkabeosztás alapú roster-hozzárendelések
- szabadság / kivétel állapotok

A kompatibilis fuvarok számítása a meglévő UI fuvaradatokra épül (`FUVAROK`), nem az Excel `EXPORT` lapból generált job-listára.

## Nyitott validációs eltérések

- Hard error: 0 sor
- Soft warning: 41 sor

### Soft warning fő oka

Az `EXPORT` lap éves, ismétlődő napi szekciókból áll, de az import már csak a megadott planning date szekcióját olvassa. A maradó warningok döntően:

- páros sofőrös sorok információs jelzései
- üres vagy szabad szöveges munkarend-megjelölések kihagyott sorai

## Fallback és roster

- Kért planning date: `2026-04-16`
- Effektív EXPORT dátum: `2026-04-14`
- EXPORT fallback: aktív
- Ok: a 2026-04-16 napi EXPORT blokk 0 soros volt, a legközelebbi nem üres nap 2026-04-14 lett
- Munkabeosztás import: 16 roster-assignment sor került be a generated JSON-ba

## Automatizált ellenőrzések

Sikeresen lefutott:

- `python tools/excel/import_menetiranyitas.py --input "assets/js/data/menetiranyitas&tervezes_2025 (1).xlsx" --planning-date 2026-04-16`
- `node --test tests/eligibility-engine.test.mjs`

## MVP korlátok

- A munkarend `cycleAnchorDate` jelenleg feltételezett érték, ha az Excel nem tartalmaz explicit cikluskezdőt.
- A `Munkabeosztás` lap csak 2026-04-02-ig tartalmaz dátumoszlopokat, ezért a UI roster fallback legközelebbi elérhető napra támaszkodik.
- A dedikált jármű / sofőr kapcsolás első körben rendszám alapú, pótkocsi-import nélkül.