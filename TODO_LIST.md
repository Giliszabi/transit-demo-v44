# TODO LISTA - Fuvarszervezés-Menetirányítás Rendszer

## 🚨 2026-03-27 Demo utáni kritikus backlog (ÚJ)

### 🔥 TOP 5 KRITIKUS PONT

#### 1) Rezsi futás automatikus beszúrás (nem teleportálhat az erőforrás)
- [x] Ha erőforrás aktuális helye ≠ fuvar felrakási helye, automatikusan generáljunk rezsi futás blokkot
- [ ] A rezsi futás látható legyen timeline-on külön jelöléssel (pl. "Rezsi kiállás")
- [ ] Rezsi futás számolja az időt + km-t + költséget a járat alapadatokhoz
- [ ] Drag and drop hozzárendelésnél kötelező validáció: folytonos útvonal
- [ ] Hibakezelés: ha nincs adat a távolsághoz/időhöz, figyelmeztetés és manuális jóváhagyás

Elfogadási kritérium:
- [ ] Nem lehet olyan hozzárendelést menteni, ahol az erőforrás "teleportál"

#### 2) Szerelvény csoportos timeline (master sáv)
- [x] Új felső "master" szerelvény timeline nézet (egy csoportban: vontató + sofőr + pótkocsi)
- [ ] Azonos járathoz tartozó erőforrások vizuálisan együtt jelenjenek meg
- [ ] Csoport nyitható/csukható legyen részletekre
- [ ] Egyetlen vízszintes görgetéssel kezelhető legyen a teljes szerelvény
- [x] Szerelvényre vagy kapcsolt fuvarra kattintva erőforrás fókusz: csak a kapcsolódó sofőr/vontató/pótkocsi látszik

Elfogadási kritérium:
- [ ] Ugyanazon szerelvény elemei nem külön, szétesett sorokban látszanak alapnézetben

#### 3) Erőforrás pozíció megjelenítése időpont szerint
- [ ] Sofőr/vontató/pótkocsi aktuális helyének számítása egy adott időpontra
- [ ] Pozíció megjelenítése timeline elemeken (tooltip + címke)
- [ ] "Hol van most" logika támogatása kiválasztott idővonal pozícióra
- [ ] Pozícióváltozás események naplózása járat során

Elfogadási kritérium:
- [ ] Bármely időpontra lekérdezhető, hogy az adott erőforrás hol tartózkodik

#### 4) Scoring alapú ajánlás (szűrés helyett rangsorolás)
- [ ] Ajánlási pontszám bevezetése (távolság, időablak, kompatibilitás, üres km)
- [ ] Lerakó autónál automatikus import prioritás a találati listában
- [ ] A rendszer a legjobb 3-5 opciót javasolja alapból
- [ ] Szűrők maradnak, de másodlagos szerepben (finomhangolás)

Elfogadási kritérium:
- [ ] Lerakó állapotban lévő erőforrásnál import fuvar-javaslatok kerülnek az első helyekre

#### 5) Járat alapadatok élő megjelenítése tervezés közben
- [x] Tervezés közben valós idejű mutatók: üres km, bevétel, kiadás, eredményesség
- [ ] Minden drag/drop és módosítás után azonnali újraszámítás
- [ ] Vizualizáció: pozitív/negatív eredmény jól látható

Elfogadási kritérium:
- [ ] A tervező azonnal látja, hogy az aktuális járatterv rentábilis-e

---

### 🎯 További fontos fejlesztések (Demo 2026-03-27)

#### 6) Sofőr elérhetőség időpont alapú szervezés
- [ ] Bal oldali sofőrlista elérhetőségi kezdőidővel
- [ ] Jobb oldali fuvarlista indulási idővel
- [ ] Match-elés elsődlegesen indulási idő kompatibilitás alapján

#### 7) "Ugrás a fuvarhoz" funkció
- [ ] Új UI akciógomb: kiválasztott fuvarra timeline fókusz/scroll
- [ ] Erőforrásra ugrás mellé fuvarra ugrás is legyen

#### 8) Előfutás és utófutás szabályrendszer pontosítása
- [x] Előfutás definíció implementálása: "amíg a felrakásért megyünk"
- [x] Utófutás definíció implementálása import utáni belföldi lerakásra
- [ ] Standby pontok (pl. Környe, Bristol) kezelése külön szabályokkal
- [x] Demo járat életciklus fuvarok létrehozása (export + import + utófutás + belföldi továbbfuvar)
- [ ] Telephelyről megrakott indulás esetén előfutás = 0 kezelése

#### 9) Járatképzés szabályainak motor oldali rögzítése
- [ ] Járat kezdete: rezsi kiállás indulási pontja
- [ ] Járat vége: import utófutás vége vagy telephelyre visszaérkezés
- [ ] Folytonosság ellenőrzés minden szakasz között

#### 10) Menetirányításba átadás (operatív handoff)
- [ ] Fuvarszervezésből átadott járatnál számolt szabadulási idő
- [ ] Menetirányítás panelen vezetési idők mutatása: folyamatos / napi / heti
- [ ] Következő szabad időpont megjelenítése és elfogadás/visszajelzés workflow

#### 11) Belföld nézet és célzott résznézetek
- [ ] Belföldes nézet: napi belföldi munkák listázása
- [ ] Előfutás fókusz nézet (bal), utófutás fókusz nézet (jobb)
- [ ] Belföldi feladatok gyors szűrői (régió, idő, státusz)

#### 12) Lerakó autóknál automatikus import fókusz
- [ ] Lerakó autó kiválasztáskor automatikus import szűrés aktiválása
- [ ] Import relevancia szerinti rendezés alapértelmezésben

#### 13) Szerelvény műveleti napló (audit trail)
- [ ] Ki-mit-mikor naplózás erőforrás hozzárendelésekről
- [ ] Törés, le- és felkapcsolás, módosítás események tárolása
- [ ] Szerelvényre kattintva időrendi eseménylista megjelenítése

---

### 🧩 Technikai bontás (ajánlott modulok)
- [ ] `assets/js/ui/szerelveny-timeline.js`: master csoport nézet + aggregált render
- [ ] `assets/js/ui/matching.js`: scoring függvények és ajánlási rangsor
- [ ] `assets/js/ui/timeline-generator.js`: rezsi futás auto-blokk beszúrás
- [ ] `assets/js/ui/fuvar-panel.js`: ugrás a fuvarhoz + élő járat KPI panel
- [ ] `assets/js/ui/menetiranyitas-panel.js`: handoff és vezetési idő megjelenítés
- [ ] `assets/js/ui/resource-panel.js`: időpont alapú sofőr elérhetőség

### 🧪 Kötelező tesztforgatókönyvek
- [ ] Budapest erőforrás + Szeged felrakás esetén kötelező rezsi futás beszúrás
- [ ] Szerelvény nézetben egy csoportban látszik a 3 erőforrás
- [ ] Lerakó autóra kattintva import ajánlások jönnek felülre
- [ ] Járat profitabilitás változik valós időben a szerkesztés során
- [ ] Fuvarra ugrás gomb a megfelelő időpontra teker
- [x] Szerelvény- vagy kapcsolt fuvar kattintás után csak kapcsolódó erőforrások látszanak
- [x] Minden idővonal blokkra működik a mouse-over részletinformáció (km + költség; fuvarnál bevétel + eredményesség)
- [x] Kész járat vizuális megjelölése és járat összegző KPI megjelenítés az erőforrás sorban

## 🎯 PRIORITÁS 1: Nézet Egységesítés (KRITIKUS)

### Fuvarfeladatok UI Módosítások
- [x] **Fuvar kártyák magassága csökkentése** - jelenleg túl magasak
- [x] **Vízszintes görgetés implementálása** - fuvar kártyákat jobbra-balra lehessen görgeti
- [x] **Oszlopok kiválaszthatósága** - felhasználók dönthetnek mely adatok legyenek láthatók
- [x] **Menthető nézet profil** - az oszlop-kiválasztás mentve legyen (pl. localStorage)
- [x] **Egységes szűrő interfész** - nem külön lapfüleken (export/import/belföld), hanem közös szűrőkkel

### Excel Adatok Egységesítése
- [x] **Közös oszlop lista létrehozása** - az összes mez adat egy helyen (nem szeparálva export/import/belföld)
- [x] **Fuvarok adatai** - standard lista
- [x] **Menetirányítás adatai** - standard lista
- [x] **Ezek a listák betöltése a fuvarkártyákba**

---

## 🎯 PRIORITÁS 2: Státusz és Szűrő Rendszer

### Státuszok Definiálása
- [x] **ÖSSZES** státusz - alapértelmezett (összes fuvar)
- [x] **ELMARADT** státusz - a timeline dátumszűrőhöz képest múltbéli fuvarok (nem meghiúsult, hanem múltba kerülő fuvarok)
- [x] **KÉSZ** státusz - teljes fuvarok (traktor + sofőr + időpont + erőforrás)
- [x] **TERVEZÉS ALATT** státusz (sárga) - részben kitöltött fuvarok
- [x] Piros vonal megjelenítése az aktuális időpont mellett (±24h sáv)

### Szűrések és Rendezések
- [ ] **Nap szűrő** - szűrés dátum alapján vagy +/- nap eltolás
- [ ] **Erőforrás szűrő** - traktor/sofőr rendelkezésre állása alapján
- [ ] **Régió szűrő** - lerakó régiók szerinti szűrés
- [ ] **ADR szűrő** - veszélyes anyag tarifák szerinti szűrés
- [ ] Ezek a szűrők konzekvensek lesznek az export/import/belföld nézetekben

---

## 🎯 PRIORITÁS 3: Export Nézet Logika

- [ ] **Lerakó autók listája** - kimenet autók nyomon követése
- [ ] **Megoldatlan (unassigned) fuvarok** - kimenetet váró fuvarok megjelenítése
- [ ] **Fuvar ↔ Járat összerendelés** - fuvarok járatokba sorolása
- [ ] **Költség kalkuláció** - összköltség és költség/KM
- [ ] **Útvonalon követés** - exportok útvonalának megjelenítése
- [ ] **Traktor + Sofőr rendelezésre állás** - erőforrás kezelés

---

## 🎯 PRIORITÁS 4: Import Nézet Logika

- [ ] **Lerakó autók** + **Megoldatlan fuvarok** összerendelődése
- [ ] **Kocsik összerendelhetősége** - amely autók összerendelhatók ugyanabba a járatba
- [ ] **Fuvar összerendelhetőség** - mely fuvarok lehetnek ugyanabban az összerendelt járatban
- [ ] **Terhelhetőség kalkuláció** - költség, időpont, távolság figyelembe vétele
- [ ] **Belföld rész követése** - amely fuvarok már belföldön vannak, azok tűrnie kell az importot

---

## 🎯 PRIORITÁS 5: Belföld Nézet Logika

- [ ] **Előfutás szakasz** - exportok felrakási része
- [ ] **Autó futás szakasz** - teljes útvonal a belföldön
- [ ] **Importok lerakási szakasz** - import fuvarok lerakása
- [ ] **Termékadat + Pótkocsi összerendelés** - LogiHub oldaláról a termékadat és a pótkocsi kell összerendelni
- [ ] **Erőforrás hozzárendelés** - traktor + sofőr kombinálása
- [ ] **Raktározási pont megjelenítése** - pl. Százhalomábatta
- [ ] **Térképes nézet integrációja**

---

## 🎯 PRIORITÁS 6: Menetirányítási Egységek

- [ ] **Sofőr + Traktor + Paraméterek összerendelés**
- [ ] **Menetirányítási egység külön idővolnal** (export/import/belföld szakaszokkal)
- [ ] **Erőforrás nélküli fuvarok jelölése** - figyelmeztetés
- [ ] **Kihasználtság kalkuláció** - terhelhetőség vs tényleges terhelés

---

## 🎯 PRIORITÁS 7: Adatvizualizáció

- [ ] **Oszlopok szűrése az UI-ban** - mely pozíciók jelenjenek meg a kártyákon
- [x] **Fenélet és menetrend** - piros vonal az aktuális időpont mellett
- [ ] **Szín kódolás** - státuszok szerinti jelölések (kész=zöld?, tervezés=sárga stb)
- [ ] **Ikonok és miniszimbólumok** - traktor/sofőr/költség stb rövid jelölése

---

## 🎯 PRIORITÁS 8: Egyéb

- [ ] **Terv/SPIRIT integrációja** - később
- [ ] **Peti konténer nézete** - integrálni az export/import/belföld nézetekbe
- [ ] **Szűrök standardizációja** - egy lista minden nézetben

---

## 📊 Fájlok Referenciái

- `TiT_megjelenítendő adatok.xlsx` - Export/Import/Belföld adatok strukúrája
- `MEETING_NOTES.md` - Részletes meeting documentation
- HTML főoldal: `fuvarszervezes_v4.4.html` módosítása szükséges
- JS fájlok módosítása:
  - `assets/js/ui/fuvar-panel.js` (fuvar kártyák)
  - `assets/js/ui/menetiranyitas-panel.js` (menetirányítás)
  - `assets/js/ui/timeline.js` (nézet szűrök)
  - Létrehozni: `assets/js/data/oszlop-konfiguracio.js` (oszlop-kiválasztás)
