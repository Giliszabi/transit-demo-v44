# Menetirányítás felület specifikáció

## 1. Dokumentum célja
Ez a dokumentum a Menetirányítás nézet elsődleges működését írja le fejlesztői megvalósításhoz.
Az első verzió fókusza: Erőforrás idővonal panel.

## 2. Érintett felület és komponensek
- Belépési oldal: `menetiranyitas.html`
- Fő inicializáló: `assets/js/ui/menetiranyitas-panel.js`
- Idővonal renderelő és interakciók: `assets/js/ui/timeline.js`
- Drag and drop integráció: `assets/js/ui/dragdrop.js`
- Sofőr párosítás context menü (jobb klikk): `assets/js/ui/resource-panel.js`

## 3. Erőforrás idővonal panel

### 3.1. Feladata
Az Erőforrás idővonal célja, hogy egységes, időalapú nézetben mutassa:
- a sofőrök,
- a vontatók,
- a pótkocsik
aktuális és tervezett időszakait (fuvar, pihenő, státusz- és operatív események), és támogassa a diszpécseri operatív döntéseket.

### 3.2. Felépítése
A panel fő konténere a `#timeline-container`, amelyet a Menetirányítás oldal betöltésekor a rendszer renderel.

A `renderResourceTimelinePanel()` a következő csoportstruktúrát adja át az idővonal renderelőnek:
- Gépjárművezetők (sofor)
- Vontatók (vontato)
- Pótkocsik (potkocsi)

Minden csoport több erőforrás-sort tartalmaz:
- Bal oldalon erőforrás név és azonosító meta.
- Jobb oldalon vízszintes idősáv blokkos eseményekkel.

Az idősáv ablak alapértelmezetten 72 órás nézetet használ, lapozható:
- Előző 72 óra
- Következő 72 óra

### 3.3. Vizuális és adatszintű elemek
Az idővonalon megjelenő blokkok tipikusan:
- Fuvar blokkok
- Pihenő blokkok
- Manuális esemény blokkok (pl. szabadság, várakozás, szerviz)

Fuvar blokk esetén a megjelenítés tartalmazhat:
- útvonal (felrakó -> lerakó),
- kezdő és záró idő,
- sürgős jelölés,
- tranzit szerep jelölés,
- tooltip részletek.

Pihenő blokkoknál:
- időtartam zászló,
- húzással történő időbeni áthelyezés (snapelt lépésekben, érvényes időablakon belül).

### 3.4. Fő funkcionalitás

#### 3.4.1. Időablak kezelés
- 72 órás időablakban renderelés.
- Bal/jobb lapozás a navigációs gombokkal.
- Ablakváltáskor adatelőkészítés és újrarenderelés.

#### 3.4.2. Szűrők és nézetváltók
Elérhető timeline szintű kapcsolók:
- Lerakó autók szűrő
- Ma induló autók
- Ma üres autók

A szűrő állapotváltozások eseményként is publikálásra kerülnek (custom event), hogy más panelek reagálni tudjanak.

#### 3.4.3. Fuvar fókusz és kiválasztás
- Fuvar blokk kattintásra fókusz esemény küldése (`fuvar:focus`).
- Kijelölt fuvarhoz kapcsolódó kontextus (pl. import/export közelség) vizuális megjelenítése.

#### 3.4.4. Drag and drop
Az idővonal erőforrás nevei drop targetként működnek:
- Fuvar húzható erőforrásra.
- Alkalmazhatóság ellenőrzés történik (szabályok + ütközésvizsgálat).
- Sikeres drop esetén hozzárendelés draftolása/staging.
- Sikertelen esetben felhasználói hibaüzenet.

#### 3.4.5. Frissítés és szinkron
Az idővonal újrarenderelődik releváns eseményekre:
- erőforrás változás,
- assembly draft frissülés,
- session állapot alkalmazás.

## 4. Jobb egérrel elérhető funkciók (Context menu)

### 4.1. Erőforrás soron (idősávon) jobb klikk
A soron jobb klikkelt pozícióból a rendszer kiszámít egy időpontot (snapelt), és erre az időpontra épülő menüt nyit.

#### 4.1.1. Sofőr (sofor) menü
- Pihenő hozzáadása
- Státusz események
  - Szabadság
  - Betegszabadság
  - Műszak megjelölés
  - Elérhetőség megjelölés
- Operatív események
  - Rakodás
  - Várakozás
  - Vámkezelés
  - Tankolás
  - Műszaki hiba
- Egyéb esemény
  - Egyedi megnevezés kötelező

#### 4.1.2. Vontató (vontato) menü
- Rezsifutás hozzáadása
- Állás hozzáadása
- Szervíz hozzáadása

#### 4.1.3. Pótkocsi (potkocsi) menü
- Standby hozzáadása
- Állás hozzáadása
- Szervíz hozzáadása

### 4.2. Manuális blokk jobb klikk
Nem fuvar típusú, manuálisan rögzített blokkra jobb klikkelve:
- Esemény törlése
- Törlés előtt megerősítő kérdés

### 4.3. Sofőr context menü (párosítás)
Sofőr elemeken jobb klikkből elérhető:
- 4 kezes páros beállítása

Ez a funkció a sofőr erőforrás-kezelési logikához tartozik, de a timeline sorokon is elérhető, ha a jobb klikk célpontja sofőr névelem.

## 5. Eseményrögzítő modal (jobb klikk menüből)
A menüből indított eseményfelvétel egy modal űrlapon történik:
- Kezdés dátum/idő
- Befejezés dátum/idő
- Opcionális vagy kötelező eseménynév (eseménytípustól függ)

Pihenő eseménynél gyorsgombok:
- 9 órás
- 11 órás
- 24 órás
- 45 órás

Mentéskor validáció történik:
- időpont formátum,
- logikai sorrend,
- kötelező mezők.

## 6. Implementációs megjegyzések (v1)
- A specifikáció a jelenlegi kódalap viselkedését tükrözi.
- A későbbi körökben bővítendő:
  - jogosultsági szintek és audit,
  - UX edge case-ek (időzóna, többnapos átfedés, párhuzamos szerkesztés).

## 7. Üzleti szabályok eseménytípusonként

### 7.1. Általános esemény szabályok
- Minden manuális esemény rendelkezzen `start`, `end`, `type`, `label`, `manual` mezőkkel.
- Az `end` időpont kötelezően legyen nagyobb, mint a `start`.
- Az esemény kezdése és vége 15 perces lépésközre legyen snapelve.
- A mentés csak érvényes dátum/idő formátummal történhet.
- A timeline-on kívüli (aktuális 72 órás ablakon kívül eső) események adatszinten tárolhatók, de rendereléskor klippelés történik.

### 7.2. Sofőr események

#### 7.2.1. Pihenő (`piheno`)
- Létrehozható jobb klikk menüből.
- Gyorsgombok: 9h, 11h, 24h, 45h.
- Drag művelettel vízszintesen áthelyezhető, a hossz megőrzése mellett.
- Csak a megjelenített időablak határain belül mozgatható.

#### 7.2.2. Státusz események
Érintett típusok:
- `szabadsag`
- `beteg`
- `muszak`
- `elerhetoseg`

Szabályok:
- Manuális létrehozás kötelező kezdés/befejezés mezőkkel.
- Ugyanazon sofőrnél ütközés esetén figyelmeztetés vagy tiltás alkalmazandó (implementációs döntés szerint, lásd 7.5).

#### 7.2.3. Operatív események
Érintett típusok:
- `rakodas`
- `varakozas`
- `vamkezeles`
- `tankolas`
- `muszaki_hiba`

Szabályok:
- Manuális létrehozás időintervallummal.
- Az események célja az operatív okok miatti időlekötés jelölése.

#### 7.2.4. Egyéb esemény (`egyeb`)
- Egyedi megnevezés kötelező (`customLabel`).
- Üres névvel mentés tiltott.

### 7.3. Vontató események
Érintett típusok:
- `rezsifutas`
- `allas`
- `szerviz`

Szabályok:
- Manuális létrehozás időintervallummal.
- Ugyanazon vontatón időbeli átfedésre ütközéskezelés szükséges (lásd 7.5).

### 7.4. Pótkocsi események
Érintett típusok:
- `standby`
- `allas`
- `szerviz`

Szabályok:
- Manuális létrehozás időintervallummal.
- Ugyanazon pótkocsin időbeli átfedésre ütközéskezelés szükséges (lásd 7.5).

### 7.5. Ütközés és prioritás szabályok
- Fuvar blokk ütközésbe nem kerülhet ugyanazon erőforrás más fuvar blokkjával.
- Drag and drop fuvar hozzárendelésnél ütközés esetén a művelet tiltott.
- Manuális esemény és fuvar átfedés kezelése:
  - Alapértelmezett javaslat: figyelmeztetés + mentés tiltás kapcsolható legyen konfigurációval.
  - Alap működésként legalább figyelmeztetés jelenjen meg.
- Manuális esemény törlés csak megerősítés után történhet.

## 8. API és adatmodell szerződés (v1)

### 8.1. Erőforrás alapmodell
```json
{
  "id": "S001",
  "name": "Minta Erőforrás",
  "type": "sofor",
  "timeline": []
}
```

Megjegyzés:
- `type` megengedett értékei: `sofor`, `vontato`, `potkocsi`, opcionálisan `partner`.

### 8.2. Timeline blokk közös séma
```json
{
  "start": "2026-06-04T08:00:00.000Z",
  "end": "2026-06-04T17:00:00.000Z",
  "type": "piheno",
  "label": "Napi pihenő",
  "manual": true,
  "synthetic": false
}
```

Kötelező mezők:
- `start` (ISO datetime)
- `end` (ISO datetime)
- `type` (enum)
- `label` (string)

Opcionális mezők:
- `manual` (boolean)
- `synthetic` (boolean)
- `fuvarId` (string)
- `kategoria` (string)
- `adr` (boolean)
- `surgos` (boolean)
- `felrakasCim` (string)
- `lerakasCim` (string)
- `customLabel` (string)

### 8.3. Eseménytípus enum
```text
fuvar
piheno
szabadsag
beteg
muszak
elerhetoseg
rakodas
varakozas
vamkezeles
tankolas
muszaki_hiba
egyeb
rezsifutas
allas
szerviz
standby
```

### 8.4. UI -> Domain események (CustomEvent)
Kibocsátott események, amelyekre más panelek feliratkozhatnak:
- `fuvar:focus`
- `timeline:resource-selected`
- `timeline:dropoff-filter-change`
- `assembly:resources:changed`
- `assembly:draft:staged`
- `sofor:pair-updated`

### 8.5. Javasolt REST API végpontok

#### 8.5.1. Erőforrások lekérdezése
- `GET /api/dispatch/resources?date=YYYY-MM-DD`
- Válasz: erőforrás lista timeline blokkokkal.

#### 8.5.2. Manuális esemény létrehozása
- `POST /api/dispatch/resources/{resourceType}/{resourceId}/events`
- Request body minta:
```json
{
  "type": "piheno",
  "start": "2026-06-04T08:00:00.000Z",
  "end": "2026-06-04T17:00:00.000Z",
  "customLabel": null,
  "source": "timeline-context-menu"
}
```

#### 8.5.3. Manuális esemény módosítása
- `PATCH /api/dispatch/resources/{resourceType}/{resourceId}/events/{eventId}`
- Cél: időpont, címke vagy státusz módosítása.

#### 8.5.4. Manuális esemény törlése
- `DELETE /api/dispatch/resources/{resourceType}/{resourceId}/events/{eventId}`

#### 8.5.5. Fuvar hozzárendelés draftolása
- `POST /api/dispatch/assignments/draft`
- Request body minta:
```json
{
  "fuvarId": "F123",
  "assignment": {
    "soforId": "S001",
    "vontatoId": "V014",
    "potkocsiId": "P008"
  }
}
```

### 8.6. Validációs hibaformátum (javasolt)
```json
{
  "error": {
    "code": "TIMELINE_COLLISION",
    "message": "Az erőforrás foglalt a megadott időszakban.",
    "details": {
      "resourceId": "S001",
      "overlapWith": "event_789"
    }
  }
}
```

## 9. Elfogadási kritériumok (Given-When-Then)

### 9.1. Idővonal render és csoportosítás
1. Given a Menetirányítás oldal betöltődött, When az idővonal panel renderel, Then látható a három csoport: Gépjárművezetők, Vontatók, Pótkocsik.
2. Given erőforráshoz tartozó timeline adatok vannak, When a sor kirajzolódik, Then a blokkok időarányosan jelennek meg az idősávon.

### 9.2. Jobb klikk menük
1. Given sofőr soron jobb klikk történik, When a menü megnyílik, Then elérhető a Pihenő hozzáadása, a Státusz események, az Operatív események és az Egyéb esemény.
2. Given vontató soron jobb klikk történik, When a menü megnyílik, Then elérhető a Rezsifutás, Állás, Szervíz hozzáadása.
3. Given pótkocsi soron jobb klikk történik, When a menü megnyílik, Then elérhető a Standby, Állás, Szervíz hozzáadása.

### 9.3. Esemény létrehozás
1. Given a felhasználó jobb klikk menüből eseményt indít, When az űrlapon kötelező mező hiányzik, Then a mentés nem történik meg és hibaüzenet jelenik meg.
2. Given pihenő esemény 9 órás gyorsgombbal készül, When a felhasználó ment, Then az esemény időtartama 9 óra.
3. Given egyéb esemény létrehozása történik, When az eseménynév üres, Then a mentés tiltott.

### 9.4. Manuális esemény törlés
1. Given manuális blokkra jobb klikk történik, When a Törlés opciót választják és megerősítik, Then az esemény kikerül a timeline-ból.
2. Given manuális blokk törlése indul, When a felhasználó elutasítja a megerősítést, Then az esemény változatlan marad.

### 9.5. Drag and drop hozzárendelés
1. Given fuvar kártya húzása történik erőforrásra, When az alkalmassági ellenőrzés sikeres és nincs ütközés, Then draft hozzárendelés jön létre.
2. Given fuvar kártya húzása történik erőforrásra, When ütközés van az időszakban, Then a hozzárendelés nem jön létre és figyelmeztetés jelenik meg.

### 9.6. Időablak lapozás
1. Given a timeline 72 órás ablakban áll, When a felhasználó az Előző gombra kattint, Then a nézet 72 órával visszalép.
2. Given a timeline 72 órás ablakban áll, When a felhasználó a Következő gombra kattint, Then a nézet 72 órával előrelép.

### 9.7. Sofőr párosítás context menü
1. Given a felhasználó sofőr névelemen jobb klikket végez, When a menü megnyílik, Then elérhető a 4 kezes páros beállítása funkció.
2. Given párosítás mentése megtörténik, When a művelet sikeres, Then `sofor:pair-updated` esemény kerül kibocsátásra és a nézet frissül.

## 10. Sárga, kék, zöld boxok funkcionalitása

### 10.1. Áttekintés és panel megfeleltetés
A Menetirányítás nézetben a három üzleti panel egy feldolgozási életciklust követ.

Panel megfeleltetés:
- Sárga box: 1️⃣ Számított elérhetőség (`#kornye-prediction-list`, `.dispatch-ops-panel-computed`)
- Kék box: 2️⃣ Sofőr által igazolt elérhetőség (`#titbox-feedback-list`, `.dispatch-ops-panel-driver-confirmed`)
- Zöld box: 3️⃣ Fogható erőforrás / napi lista (`#dispatcher-availability-list` + `#export-table-container`, `.dispatch-ops-panel-capturable`)

Folyamatlogika:
- Sárga: rendszer által számolt állapot, diszpécseri indító műveletek.
- Kék: sofőrrel egyeztetett, visszaigazolt adatok kezelése.
- Zöld: diszpécser által véglegesen rögzített, fogható erőforrások listája és export tábla.

### 10.2. Sárga box (Számított elérhetőség)

#### 10.2.1. Cél
- Azon gépjárművezetők és párosok listázása, akiknél a rendszer számított ETA és kockázati állapot alapján operatív beavatkozás várható.

#### 10.2.2. Listázási feltétel
- A kiválasztott export napra import vagy export feladatot befejező profilok kerülnek be.
- Csak nem megerősített és nem rögzített entitások maradnak a sárga listában.

#### 10.2.3. Fő oszlopok
- Gépkocsivezető
- Kockázat
- Fuvarfeladat
- Indíthatósági idő
- Várható érkezési idő
- Helyszín
- Push státusz
- Műveletek

#### 10.2.4. Műveletek
- Push küldése (`send-push`)
- Sofőr rögzített (`mark-driver-confirmed`)
- Tömeges push: Összes push üzenet kiküldése (`send-push-all`)

Megkötések:
- Tömeges push csak olyan sorra fut, amely még nincs sofőrként megerősítve és diszpécserként rögzítve.

#### 10.2.5. Sorállapotok
Az állapot meghatározása timeline és üzenetküldési jelek alapján történik, például:
- `push-sent`
- `import-loaded-returning`
- `outbound-with-import-not-started`
- `outbound-no-import`
- `export-assigned-not-started`

### 10.3. Kék box (Sofőr által igazolt elérhetőség)

#### 10.3.1. Cél
- A sofőr által visszaigazolt adatok diszpécseri validálása és szükség szerinti visszakérdezése.

#### 10.3.2. Listázási feltétel
- Olyan entitások, ahol `confirmedAt` már megvan, de `recordedAt` még nincs.

#### 10.3.3. Fő oszlopok
- Gépkocsivezető
- Helyszín
- Köv. indulás
- Heti maradék
- Kétheti maradék
- Meddig dolgozik
- Kérés
- Műveletek

#### 10.3.4. Műveletek
- Visszakérdezés (`open-dispatch-question`): modalban kérdés küldése a sofőrnek.
- Rögzítés (`mark-dispatcher-confirmed`): diszpécseri jóváhagyás és átadás zöld állapotba.
- Mezőszintű visszakérdezés (`ask-field-confirmation`) a következő mezőkhöz:
  - Köv. indulás
  - Heti maradék
  - Kétheti maradék
  - Meddig dolgozik

#### 10.3.5. Mezőszintű státusz
Minden visszakérdezett mező külön státuszt kap:
- `question` (folyamatban)
- `accepted` (elfogadva)
- `rejected` (elutasítva, opcionális helyettesítő értékkel)

#### 10.3.6. Rögzítés előfeltétel
- Diszpécseri rögzítés előtt a sofőr megerősítése kötelező.
- Rögzítéskor az egyeztetett érkezési idő az aktuális sofőr ETA alapján mentődik.

### 10.4. Zöld box (Fogható erőforrás / napi lista)

#### 10.4.1. Cél
- Azon napi kiosztási sorok mutatása, amelyekhez tartozó sofőr(ök) diszpécseri oldalon már rögzítettek, és így ténylegesen foghatók.

#### 10.4.2. Fő részek
- Összesítő fejléc: rögzített fogható erőforrás darabszám.
- Export tábla szűrők (`#export-table-filters`).
- Export tábla (`#export-table-container`) csak a rögzített állapotú erőforrásokkal.

#### 10.4.3. Listázási szabály
- Csak azok a sorok jelennek meg, amelyek driver azonosítója szerepel a `dispatcherConfirmedDriverIds` halmazban.
- Ha nincs ilyen sor, üres állapot üzenet jelenik meg.

#### 10.4.4. Szerkesztési viselkedés
A zöld táblában dátum/idő mezők szerkesztésekor:
- Frissül az assignment mező (`startTime`, `availabilityFrom`, `availabilityTo`).
- A kapcsolódó kék box adatok szinkronizálódnak (`driverReportedEta`, `nextDepartureAt`, `canWorkUntil`).
- Ha a sor korábban diszpécser által rögzített volt, `recordedAt` nullázódik, vagyis újra megerősítési kör szükséges.

### 10.5. Állapotátmenet szabályok a három box között

#### 10.5.1. Sárga -> Kék
- Trigger: `mark-driver-confirmed`
- Eredmény: `confirmedAt` kitöltődik, entitás átkerül a kék listába.

#### 10.5.2. Kék -> Zöld
- Trigger: `mark-dispatcher-confirmed`
- Előfeltétel: `confirmedAt` létezik.
- Eredmény: `recordedAt` kitöltődik, driver bekerül a rögzített fogható listába.

#### 10.5.3. Zöld -> Kék (visszalépés)
- Trigger: zöld táblában releváns dátum/idő mező szerkesztése.
- Eredmény: `recordedAt` törlődik, entitás újra diszpécseri megerősítést igényel.

### 10.6. Eseménykezelés és billentyűzet támogatás
- A box műveletek központi click handleren futnak `data-titbox-action` attribútummal.
- Az action gombok Enter vagy Space billentyűvel is aktiválhatók.
- Sor/oszlop rendezés panelenként saját sort state-et használ (`dispatchTableSort`).

### 10.7. Üres állapotok
Mindhárom boxnak kötelező üres állapot üzenetet adni:
- nincs betöltött profil,
- nincs releváns export napi sor,
- nincs sofőr visszaigazolás,
- nincs diszpécser által rögzített fogható erőforrás.

## 11. Elfogadási kritériumok a sárga-kék-zöld boxokra (Given-When-Then)

### 11.1. Sárga box
1. Given van releváns napi entitás, When a panel renderel, Then a sárga táblában csak nem megerősített és nem rögzített sorok jelennek meg.
2. Given a felhasználó a Push küldése gombra kattint, When a művelet lefut, Then a sor push státusza elküldöttre vált.
3. Given a felhasználó az Összes push üzenet kiküldése gombra kattint, When vannak nyitott sorok, Then minden jogosult sor push státusza egyszerre frissül.

### 11.2. Kék box
1. Given egy sor sofőrként megerősített, When a panel renderel, Then a sor a kék táblában jelenik meg.
2. Given a felhasználó visszakérdezést indít, When a kérdés mentése megtörténik, Then a sorhoz follow-up kérdés kapcsolódik.
3. Given a felhasználó mezőszintű visszakérdezést indít, When a sofőr választ ad, Then a mező státusza accepted vagy rejected lesz.

### 11.3. Zöld box
1. Given egy sor diszpécser által rögzített, When a zöld panel renderel, Then a kapcsolódó driver sor megjelenik az export táblában.
2. Given nincs rögzített fogható erőforrás, When a zöld panel renderel, Then üres állapot üzenet látható.
3. Given a felhasználó dátum/idő mezőt módosít a zöld táblában, When a mentés/render lefut, Then a sor visszakerül diszpécseri megerősítésre (recordedAt törlődik).

### 11.4. Állapotátmenet
1. Given a sor a sárga panelen van, When Sofőr rögzített művelet történik, Then a sor a kék panelre kerül.
2. Given a sor a kék panelen van és már sofőr megerősített, When Rögzítés művelet történik, Then a sor zöld státuszba kerül.
3. Given a sor zöld státuszú, When operatív időadat módosul, Then a sor visszalép kék státuszba új megerősítésre.
