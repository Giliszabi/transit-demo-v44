# ⚡ QUICK REFERENCE - Fuvarszervezés Fejlesztés

## 🆕 Demo Update (2026-03-27) - Azonnali fókusz

### Top 5 kritikus fejlesztés
1. **Üres futás automatikus beszúrás**
2. **Szerelvény csoportos master timeline**
3. **Erőforrás pozíció megjelenítés időpont szerint**
4. **Scoring alapú javaslatok (szűrés helyett rangsorolás)**
5. **Járat KPI-k élő számolása tervezés közben**

### Modul felelőségek (rövid)
- `timeline-generator.js`: üres futás beszúrás + folytonosság validáció
- `szerelveny-timeline.js`: master csoportos megjelenítés
- `matching.js`: scoring és ajánlati sorrend
- `fuvar-panel.js`: fuvarra ugrás + KPI panel
- `menetiranyitas-panel.js`: handoff adatok (vezetési idők, szabadulás)

## 🎯 3 Legfontosabb Feladat

### 1️⃣ **Fuvar Kártyák Megújítása**
- ▼ Magasság: 200px → **80px**
- ➡️ Vízszintes görgetés: CSS `overflow-x: auto`
- 🎛️ Oszlop-kiválasztás: Menthető nézet

### 2️⃣ **Excel Egységesítése**
- 🔄 3 lapfül (export/import/belföld) → 1 közös adatstruktúra
- 📋 Standard oszlop lista - egyeteme nézetben
- 🔌 Szűrés nem szeparálva, hanem egy interface-en

### 3️⃣ **Státusz és Szűrő Logika**
- ✅ KÉSZ - teljes fuvar (traktor + sofőr)
- 🔨 TERVEZÉS - sárga (részben kitöltött)
- ❌ ELMARADT - a timeline dátumszűrőhöz képest múltbéli fuvarok
- 📋 ÖSSZES - default

---

## 📋 Főbb Adatok (Excel → UI)

### Fuvarok Adatai:
```
ID | Típus | Státusz | Indulás | Felrakó | Lerakó | Sofőr | Traktor | KM | Költség
```

### Menetirányítás Adatai:
```
Megfelelőség | Cikluskezdés | Vezetési Idő | Hátralévő Idő | Össz Költség | Lerakó Ország
```

---

## 📂 Fájlok Módosítása

| Fájl | Mit módosítni | Sorszám |
|------|--------------|---------|
| `assets/css/layout.css` | `.fuvar-kártya height: 80px` | 1 |
| `assets/js/ui/fuvar-panel.js` | Kártyák komponens | 1 |
| `assets/js/ui/column-selector.js` | ÚJ: Oszlop-kiválasztó | 2 |
| `assets/data/fuvarok-unified.json` | ÚJ: Egységes adatok | 2 |
| `assets/js/ui/filter-controller.js` | ÚJ: Szűrés logika | 3 |

---

## 💻 Kód-SablonokValasztók

### CSS - Vízszintes Görgetés:
```css
.fuvar-kártya-scrollable {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
}

.fuvar-kártya-scrollable::-webkit-scrollbar {
  height: 4px;
}

.fuvar-kártya-scrollable::-webkit-scrollbar-thumb {
  background: #bbb;
}

.fuvar-column {
  min-width: 120px;
  flex-shrink: 0;
}
```

### JS - localStorage mentés:
```javascript
// Mentés
localStorage.setItem('fuvar_columns', JSON.stringify(visibleColumns));

// Betöltés
const saved = JSON.parse(localStorage.getItem('fuvar_columns'));
```

---

## ✅ Tesztelési Checklist

- [ ] Fuvar kártyák 80px magasságúak
- [ ] Vízszintes görgetés működik (szkinny kártya)
- [ ] Oszlop-kiválasztó nyitható
- [ ] Mentett oszlop-konfiguráció helyesen tölt be
- [ ] Export/Import/Belföld szűrők működnek
- [ ] Státuszok szín-kódolva (kész/tervezés/elmaradt)
- [ ] JSON adatok helyesen betöltenek

---

## 📝 Státusz Szín-Kódolás

```css
.fuvar-kártya.status-ready {
  border-left: 4px solid #28a745; /* Zöld */
}

.fuvar-kártya.status-planning {
  border-left: 4px solid #ffc107; /* Sárga */
}

.fuvar-kártya.status-missed {
  border-left: 4px solid #dc3545; /* Piros */
}

.fuvar-kártya.status-all {
  border-left: 4px solid #6c757d; /* Szürke */
}
```

---

## 📊 Szűrő Logika

```javascript
// Alap szűrés
fuvarok.filter(f => {
  if (typeFilter === 'export') return f.type === 'export';
  if (typeFilter === 'import') return f.type === 'import';
  if (typeFilter === 'belföld') return f.type === 'belföld';
  return true; // összes
});

// Státusz szűrés
.filter(f => {
  if (!statusFilter) return true;
  return f.status === statusFilter;
});
```

---

## 🚀 Fejlesztés Sorrend

1. **Csökkent kártyámagasság** (15 perc)
2. **Vízszintes görgetés CSS-ben** (30 perc)
3. **Oszlop-kiválasztó modal** (1-2 óra)
4. **Excel → JSON konverzió** (1-2 óra)
5. **Szűrés logika** (1-2 óra)
6. **Teljes integráció + tesztelés** (2-3 óra)

**Teljes idő:** ~6-8 óra egy fejlesztővel

---

## 📞 Dokumentációk

- **MEETING_NOTES.md** - Meeting összefoglalása
- **TODO_LIST.md** - Prioritásra sorolt feladatok  
- **EXCEL_UNIFICATION.md** - Adatstruktúra terv
- **UI_SPECIFICATIONS.md** - UI technikai terv
- **IMPLEMENTATION_GUIDE.md** - Részletes útमutató

---

**Utolsó frissítés:** 2026.03.23 🕐

