# Fuvarszervezés-Menetirányítás Rendszer: Meeting Notes
**Dátum:** 2026. március 23.  
**Résztvevők:** Gasparics Tamás, Szabolcs Gilincsek  
**Időtartam:** 28:45 (Teams átirat)

---

## 📋 Meeting Összefoglalása

A meeting célja az volt, hogy Gasparics Tamás bemutassa a jelenlegi rendszerben szereplő nézeteket és adatmezőket, hogy ezeknek az alapján a Szabolcs által fejlesztett új система megfelelően tudjon működni.

### Főbb Témák:

#### 1. **Nézetrendszer Egységesítése** 🔄
- **Jelenlegi probléma:** Az export, import és belföld nézetek **külön lapfüleken vannak**, megkülönböztetett menüpontokkal
- **Megoldás:** Egy **közös nézet** kell majd, ahol a felhasználók **szűrőkkel** tudják kiválasztani, hogy mit akarnak látni
- Nem külön menüpontok, hanem **egy interface-en belül szűrés/rendezés**

#### 2. **Fuvarfeladatok Kártyái** 🎴
- Az export/import/belföld **státuszok** és **szűrők** definiálása kritikus
- Kártyákat **vízszintesen is görgethető** kell hogy legyen (sok adat jelenik meg)
- A kártyákat **kisebbre** kell állítani, hogy több látszódjon egymás alatt **függőleges görgetés nélkül**
- **Oszlopok kiválaszthatósága:** A felhasználok eldönthetik melyik adatokat jelenítik meg a kártyákon
- Ezek az oszlopok egy **menthető nézetbe** kerüljenek

#### 3. **Státuszok Rendszere** 📊
A rendszer a következő státuszokkal dolgozik:
- **ÖSSZES** - Default státusz, minden fuvar
- **ELMARADT** - A timeline dátumszűrőhöz képest múltbéli fuvarok (nem zöld státuszban lévő, a kiválasztott időponthoz képest már elmúlt fuvarok) — **NEM meghiúsult fuvarok!**
- **KÉSZ** - Teljes fuvar (van traktor, sofőr, időpont, erőforrás, export/import adat attól függően)
- **TERVEZÉS ALATT** (sárga jelzés) - Valamilyen adat be van töltve, de nincs komplett (hiány van)

#### 4. **Menetirányítási Egységek** 🚚
- Sophör + traktor + főbb paraméterek összehozása nélkülözhetetlenMenetirányítási oldalon kell ezeket kezelni
- Külön idővolnal kell majd az export, import, belföld szakaszoknak

#### 5. **Export Nézet** 📤
- Lerakó autók
- Megoldatlan (unassigned) fuvarok
- Nap szűrő
- Erőforrás rendelkezésre állás
- Fuvarok összerendelhetősége járatokba
- Kimeneti útvonal, költség kalkuláció

#### 6. **Import Nézet** 📥
- Hasonló az export nézethez, de nagyobb különbség van
- **Lerakó autók** + **Megoldatlan fuvarok** összerendelődéseMegoldatlan importokat fel kell tuntetni a listában
- Fuvarok összerendelhetősége járatokba (ugyanaz, mint exportnál)
- Funkcionalitás: Ha egy fuvarral belföld közben van, akkor tűrnie kell azokat a fuvarokat, amely ugyanabban a járatban lehetnek

#### 7. **Belföld Nézet** 🚛
- Előfutás (export felrakás szakasza) + autó futás + importok lerakási szakasza
- Erőforrás hozzárendelés
- Térképes nézet
- **Logika:** Terméket és pótkocsis csomagot össze kell rendelni, majd az erőforrást (traktor+sofőr) - ez nagyon fontos
- Raktározási pont (pl. Százhalomabatta) figyelembe vétele

---

## 🎯 Kritikus Adatazonosítók

### Fuvarok Adatai (közös):
- Tervezett indulás / Becsült legkésőbbi indulás
- Tervezett erőforrások
- Felrakók / Lerakók
- Lerakó régiók
- Státusz
- Tranzit idő
- Vezetési idő
- Partner referencia
- ADR (veszélyes anyag jelölés)
- Távolság (KM)

### Menetirányítás Adatai:
- Megfelelőség
- Cikluskezdés
- Vezetési idő a cikluson belül (terv)
- Hátralévő vezetési idő (terv)
- Összes költség
- Összes költség / KM
- Lerakó ország
- Akasztási magasság
- Menetirányítási egység
- Pót típus
- Nyomon követési adatok

---

## 💡 Egyéb Megjegyzések

- **Peti által készített konténer nézet** - ezt majd később integrálni kell az export/import/belföld nézetekbe
- **Terv/SPIRIT:** Egyelőre nem prioritás, külön témakezelés szükséges
- A rendszerben sok szűrési pont van - ezeket standardizálni kell hogy ne legyen összevisszá
- A felrakók és lerakók összerendelésének logikája nagyon fontos

---

## Megoldandó Problémák

1. ⚠️ **Nézetek szeparáltsága** - Export/Import/Belföld külön lapfülön
2. ⚠️ **Fuvar kártyák túl nagy magassága** - Kevés látható görgetés nélkül
3. ⚠️ **Oszlopok merevek** - Nincs kiválaszthatóság, menthető nézet
4. ⚠️ **Vízszintes görgetés hiánya** - Sok adat nem fér el függőlegesen
5. ⚠️ **Szűrők konzisztenciája** - Minden nézetben máshogy vannak

---

## Fájlok

- 📊 Excel: `TiT_megjelenítendő adatok.xlsx` (3 lapfül: export, import, belföld)
- 📝 Word átirat: `Fuvarszervezes-menetiranyitas atnezes.docx`
