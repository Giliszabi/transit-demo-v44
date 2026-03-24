# Excel Adatszerkezet Egységesítése

## 📊 Jelenlegi Helyzet

Az Excel 3 külön lapfülön tártolja az adatokat:
1. **export nézet adatok** - export fuvarokra vonatkozó adatok
2. **import nézet adatok** - import fuvarokra vonatkozó adatok  
3. **belföld nézet adatok** - belföld fuvarokra vonatkozó adatok

Minden lapfülön belül 2 oszlop-csoport:
- **Fuvarok adatai** (baloldal)
- **Menetirányítás adatai** (jobboldal)

Probléma: **Redundancia és szeparáció** - ugyanaz az adat máshogy van elnevezve a különböző nézetekben

## 🎯 Megoldás: Egységes Oszlop Rendszer

### I. STANDARD FUVARADATOK (közös minden nézetben)

```
Core Fields:
- Fuvar ID / Fuvar Szám
- Fuvar Típus (Export/Import/Belföld)
- Státusz (Összes, Elmaradt, Kész, Tervezés alatt)

Indulás / Érkezés:
- Tervezett Indulás
- Becsült Legkésőbbi Indulás
- Tervezett Érkezés
- Tranzit Idő
- Vezetési Idő

Helyszínek:
- Felrakó (Helyszín/Cím)
- Lerakó (Helyszín/Cím)
- Lerakó Régiók
- Tranzit Ország
- Lerakó Ország

Erőforrások:
- Tervezett Erőforrások (vonósz + pótkocsik)
- Sofőr
- Traktor/Vontató
- Pótkocsi Típus(ok)

Paraméterek:
- ADR (Veszélyes anyag)
- KM / Távolság
- Akasztási Magasság
- Partner Referencia Szám
- Tag / Tag2 / Tag3
- EF vége (Export vége)
- Ráosztott Pót típus

Költségek:
- Összes Költség
- Költség / KM
```

### II. MENETIRÁNYÍTÁS ADATAI (közös minden nézetben)

```
Menetirányítási Egység:
- Menetirányítási Egység ID
- Menetirányítási Egység Neve

Ciklus Adatok:
- Cikluskezdés
- Vezetési Idő a Cikluson Belül (terv)
- Hátralévő Vezetési Idő (terv)

Státusz és Megfelelőség:
- Megfelelőség
- Menetrendek

Szállítási Paraméterek:
- Lerakó Ország (menet szempontjából)
- Akasztási Magasság (logisztikai)
```

### III. NÉZETSPECIFIKUS ADATOK

#### EXPORT NÉZET EXTRA:
```
- Export Befejezés 1 (utolsó lezárás adatok)
- Utolsó Cím
- Erőforrások (export specifikus teherbírás)
- SZF (Szállító Forma)
```

#### IMPORT NÉZET EXTRA:
```
- Lerakó Autók (mely autók szállíthatják tovább)
- Megoldatlan Fuvarok (összerendezésre vár)
- Export Befejezés 1
- Utolsó Cím
```

#### BELFÖLD NÉZET EXTRA:
```
- Előfutás Szakasz (export felrakás)
- Autó Futás Szakasz (belföld szállítás)
- Lerakás Szakasz (import lerakás)
- Szállítási Út (térképi reprezentáció)
```

---

## 📈 Javasolt Adatbázis Struktúra

### Fuvarak Tábla
```javascript
{
  id: "FUVAR_001",
  type: "export|import|belföld",
  status: "összes|elmaradt|kész|tervezés_alatt",
  
  // Alapadatok
  plannedStart: "2026-03-25 08:00",
  estimatedLatest: "2026-03-25 09:00",
  plannedEnd: "2026-03-25 18:00",
  transitTime: 480, // perc
  drivingTime: 360,
  
  // Helyszínek
  pickupLocation: "Pickup Cim",
  pickupCoordinates: [47.5, 19.0],
  deliveryLocation: "Lerakó Cim",
  deliveryCoordinates: [48.2, 20.5],
  deliveryRegions: ["régió1", "régió2"],
  transitCountries: ["AT", "SK"],
  
  // Erőforrások
  assignedResources: {
    driver: { id: "SOF_001", name: "Sofőr Nevs" },
    tractor: { id: "VONT_001", type: "volvo_fh16" },
    trailers: [
      { id: "PÓTK_001", type: "nyakt" },
      { id: "PÓTK_002", type: "alu" }
    ]
  },
  rideDispatchingUnit: "MENE_001",
  
  // Paraméterek
  adr: true,
  kilometer: 850,
  hookHeight: 1350,
  partnerReference: "PARTNER_REF_123",
  tags: ["tag1", "tag2", "tag3"],
  
  // Költségek
  totalCost: 125000,
  costPerKm: 147,
  
  // Menetirányítás
  compliance: "compliant|warning|error",
  dispatchingStarted: "2026-03-24 14:30",
  estimatedRemainingDrive: 240, // perc
  costPerKmDispatch: 150
}
```

---

## 🔄 Migráció Azure-ből JSON-be

Az Excel adatokból JSON struktúrára való átkonvertálás szükséges:
- Python script: `assets/data/convert-excel-to-json.py`
- Output: Integráció a `assets/js/data/` mappában
- API Endpoint: `/api/fuvarok` összes adat
- Filter Endpoint: `/api/fuvarok?status=kesz&type=export`

---

## 📝 Az UI-ban Megjelenítendő Adatok (Kiválasztható)

```javascript
// Oszlop-konfigurációs profil
{
  profileName: "Export Alapszint",
  visible: [
    "plannedStart",
    "deliveryLocation", 
    "assignedResources.driver.name",
    "assignedResources.tractor.type",
    "kilometer",
    "totalCost",
    "status"
  ],
  hidden: [
    "hookHeight",
    "tags",
    "partnterReference",
    // ... stb
  ]
}
```

---

## 📊 Javasolt Új Excel Struktúra (unified)

Egy közös XML schema helyett:

### Lap 1: Fuvar Mesteradat
- Összes fuvar egy helyen
- Oszlopok: ID, Típus, Státusz, Indulás, Felrakó, Lerakó...
- Szűrés: Típus szerint (Export/Import/Belföld)

### Lap 2: Erőforrások
- Sofőrök, Vontatók, Pótkocsi, Menetirányítási Egységek
- Kapcsolat a fuvarokkal

### Lap 3: Nézet Profilok
- Felhasználói preferenciák
- Mely oszlopok legyenek láthatók?
- Mely szűrők aktívak?

---

## 🚀 Implementáció lépesekKépes

1. Új Excel letöltése az egységes struktúrával
2. Python skript: `convert-excel-to-json.py`
3. JSON adatok betöltése: `assets/js/data/fuvarok-unified.js`
4. HTML UI-n szűrő interfész implementálása
5. Oszlop-kiválasztás UI komponens
6. Mentések localStorage-ba

---

## 📋 Egységesített Oszlop-Lista

Ezt az oszlop-listát minden nézetben **ugyanúgy** kell megjeleníteni, csak szűrés másképp:

| Adat | Export | Import | Belföld | Típus |
|------|--------|--------|---------|-------|
| Fuvar ID | ✓ | ✓ | ✓ | Text |
| Fuvar Típus | ✓ | ✓ | ✓ | Select |
| Státusz | ✓ | ✓ | ✓ | Select |
| Tervezett Indulás | ✓ | ✓ | ✓ | DateTime |
| Tervezett Érkezés | ✓ | ✓ | ✓ | DateTime |
| Felrakó | ✓ | ✓ | ✓ | Text |
| Lerakó | ✓ | ✓ | ✓ | Text |
| Lerakó Régiók | ✓ | ✓ | ✓ | Text |
| Sofőr | ✓ | ✓ | ✓ | Select |
| Traktor | ✓ | ✓ | ✓ | Select |
| Pótkocsi | ✓ | ✓ | ✓ | Select |
| ADR | ✓ | ✓ | ✓ | Bool |
| KM | ✓ | ✓ | ✓ | Number |
| Összes Költség | ✓ | ✓ | ✓ | Number |
| Költség/KM | ✓ | ✓ | ✓ | Number |
| Menetirányítási Egység | ✓ | ✓ | ✓ | Select |
| Megfelelőség | ✓ | ✓ | ✓ | Select |
| Cikluskezdés | ✓ | ✓ | ✓ | DateTime |
| ... stb más adatok | ... | ... | ... | ... |
