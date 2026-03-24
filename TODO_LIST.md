# TODO LISTA - Fuvarszervezés-Menetirányítás Rendszer

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
