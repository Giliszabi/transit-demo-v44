# Implementálási Útmutató - Fuvarszervezés Rendszer Fejlesztése

## 📋 Feldolgozás Eredménye

A meeting átiratából és az Excel adatokból az alábbi dokumentumok készültek:

### 1. **MEETING_NOTES.md** 📝
- Gasparics Tamás és Szabolcs közötti meeting összefoglalása
- Az összes elhangzott kritikus pont dokumentálva
- Adatazonosítók és paraméterek felsorolása

### 2. **TODO_LIST.md** ✅
- 8 prioritási szint szerinti Todo lista
- Az összes szükséges fejlesztés feladatokra lebontva
- A meeting elhangzottainak teljes összefoglalása

### 3. **EXCEL_UNIFICATION.md** 📊
- Az Excel 3 lapfülének egységesítésre
- Javasolt JSON-alapú adatstruktúra
- Oszlop-lista standardizálása

### 4. **UI_SPECIFICATIONS.md** 🎨
- Fuvar kártyák méretezésének specifikációja
- Vízszintes görgetés implementálása
- Oszlop-kiválasztó UI komponens terve
- CSS és JavaScript kódpéldák

---

## 🚀 Megvalósítási Lépések (Javasolt Sorrend)

### FÁZIS 1: UI Alapok (1-2 nap)

#### 1.1 Fuvar Kártyák Magasságának Csökkentése
- **Fájl:** [assets/css/layout.css](assets/css/layout.css)
- **Módosítás:** `.fuvar-kártya { height: 80px; }` (jelenleg: 200px)
- **Telepítés után:** Függőleges görgetés nélkül több fuvar látható

#### 1.2 Vízszintes Görgetés Implementálása
- **Fájl:** [assets/js/ui/fuvar-panel.js](assets/js/ui/fuvar-panel.js)
- **Módosítás:** CSS `overflow-x: auto` + `overflow-y: hidden`
- **Előny:** Sok adat megjeleníthető vízszintes görgetéssel

#### 1.3 Oszlop-Kiválasztó UI
- **Új fájl:** [assets/js/ui/column-selector.js](assets/js/ui/column-selector.js)
- **HTML:** Modal dialog az olyan oszlopokkal
- **localStorage:** Mentés oldalak közötti megőrzéshez

---

### FÁZIS 2: Adatok Egységesítése (2-3 nap)

#### 2.1 Excel → JSON Konverzió
- **Létrehozás:** `assets/data/excel-converter.py`
- **Input:** `TiT_megjelenítendő adatok.xlsx`
- **Output:** `assets/js/data/fuvarok-unified.json`
- **Logika:** Összes fuvar egy helyre, szűrés später

#### 2.2 Új Adatstruktúra Betöltése
- **Fájl:** [assets/js/ui/fuvar-panel.js](assets/js/ui/fuvar-panel.js)
- **Módosítás:** Adatok betöltése egységes JSON-ből
- **Szűrés:** Export/Import/Belföld szűrő majd később kerül alkalmazásra

#### 2.3 Szűrő Logika Implementálása
- **Fájl:** `assets/js/ui/filter-controller.js` (új)
- **Szűrők:** status (összes, elmaradt, kész, tervezés)
- **Tab-ok:** export, import, belföld

---

### FÁZIS 3: Menetirányítás Integrálása (2-3 nap)

#### 3.1 Menetirányítási Egységek Kezelése
- **Fájl:** [assets/js/ui/menetiranyitas-panel.js](assets/js/ui/menetiranyitas-panel.js)
- **Adatok:** Sofőr + Traktor + Paraméterek összerendelése
- **Megjelenítés:** Külön idővonal view

#### 3.2 Státuszok és Szűrők
- **Kész:** Teljes fuvar (traktor + sofőr + időpont)
- **Tervezés:** Sárga jelölés (részben kitöltött)
- **Elmaradt:** Meghiúsult fuvarok jelölése

---

### FÁZIS 4: Teljes Integráció (3-4 nap)

#### 4.1 Export Nézet
- Lerakó autók listája
- Megoldatlan fuvarok > összerendelés
- Költség kalkuláció

#### 4.2 Import Nézet
- Import fuvarok összerendelése
- Lerakó autók + fuvarok párosítása
- Belföld közötti fuvar tűrhetőség

#### 4.3 Belföld Nézet
- Előfutás + autó futás + lerakás szakasz
- Termékadat + pótkocsi összerendelés
- Térképes megjelenítés

---

## 📂 File Struktúra (módosítandó/létrehozandó)

### Módosításra Szoruló Fájlok:
```
assets/
  css/
    layout.css          ← Fuvar kártyák CSS
    components.css      ← Modal és szűrő stílusok
  
  js/
    ui/
      fuvar-panel.js           ← Kártyák komponens
      column-selector.js       ← ÚJ: Oszlop-kiválasztó
      filter-controller.js     ← ÚJ: Szűrés logika
      menetiranyitas-panel.js  ← Menetirányítás nézet
```

### Új Fájlok (Létrehozandó):
```
assets/
  data/
    fuvarok-unified.json          ← ÚJ: Egységes fuvar adatok
    excel-converter.py            ← ÚJ: Excel → JSON konverzió
  
  js/
    ui/
      column-selector.js          ← ÚJ: Oszlop-kezelő
      filter-controller.js        ← ÚJ: Szűrő logika
      status-controller.js        ← ÚJ: Státusz kezelő

docs/
  MEETING_NOTES.md                ← ÚJ: Meeting dokumentáció
  TODO_LIST.md                    ← ÚJ: Feladatlista
  EXCEL_UNIFICATION.md            ← ÚJ: Excel egységesítés
  UI_SPECIFICATIONS.md            ← ÚJ: UI terv
  IMPLEMENTATION_GUIDE.md         ← ÚJ: Ez az útmutató
```

---

## 💻 Код Sablonok

### I. Fuvar Kártyák (JavaScript)

```javascript
// assets/js/ui/FuvarCard.js
class FuvarCard {
  constructor(data, visibleColumns) {
    this.data = data;
    this.visibleColumns = visibleColumns;
  }
  
  render() {
    const card = document.createElement('div');
    card.className = `fuvar-kártya status-${this.data.status}`;
    
    card.innerHTML = `
      <div class="fuvar-kártya-fixed">
        <div class="fuvar-id">${this.data.id}</div>
        <div class="fuvar-status">${this.data.status}</div>
      </div>
      <div class="fuvar-kártya-scrollable">
        ${this.visibleColumns.map(col => this.renderColumn(col)).join('')}
      </div>
    `;
    
    return card;
  }
  
  renderColumn(col) {
    const value = this.getNestedValue(this.data, col.key);
    return `
      <div class="fuvar-column">
        <label>${col.label}</label>
        <span>${this.format(value, col.key)}</span>
      </div>
    `;
  }
  
  getNestedValue(obj, key) {
    return key.split('.').reduce((o, k) => o?.[k], obj);
  }
  
  format(value, key) {
    if (!value) return '-';
    if (key.includes('Date') || key.includes('Time'))
      return new Date(value).toLocaleString('hu-HU').substring(0, 16);
    if (key.includes('Cost'))
      return value.toLocaleString('hu-HU') + ' Ft';
    return String(value).substring(0, 20);
  }
}
```

### II. Oszlop-Kiválasztó (JavaScript)

```javascript
// assets/js/ui/ColumnSelector.js
class ColumnSelector {
  constructor() {
    this.storageKey = 'fuvar_columns_config';
    this.columns = [
      { key: 'plannedStart', label: 'Indulás', category: 'fuvar', visible: true },
      { key: 'deliveryLocation', label: 'Lerakó', category: 'fuvar', visible: true },
      { key: 'assignedResources.driver.name', label: 'Sofőr', category: 'erőforrás', visible: true },
      { key: 'totalCost', label: 'Költség', category: 'fuvar', visible: true },
      // ... több oszlop ...
    ];
    this.loadConfig();
  }
  
  saveConfig() {
    const visible = {};
    document.querySelectorAll('.column-checkbox input').forEach(el => {
      visible[el.name] = el.checked;
    });
    localStorage.setItem(this.storageKey, JSON.stringify(visible));
  }
  
  loadConfig() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      const visible = JSON.parse(saved);
      this.columns.forEach(col => {
        col.visible = visible[col.key] ?? col.visible;
      });
    }
  }
  
  getVisibleColumns() {
    return this.columns.filter(col => col.visible);
  }
}
```

### III. CSS Stílusok

```css
/* assets/css/layout.css */

.fuvar-kártya {
  height: 80px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.fuvar-kártya-fixed {
  min-width: 60px;
  padding: 8px;
  background: #f9f9f9;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.fuvar-kártya-scrollable {
  flex: 1;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 8px;
  scroll-behavior: smooth;
}

.fuvar-kártya-scrollable::-webkit-scrollbar {
  height: 4px;
}

.fuvar-kártya-scrollable::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 2px;
}

.fuvar-column {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  padding-right: 12px;
  border-right: 1px solid #f0f0f0;
}

.fuvar-column label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.fuvar-column span {
  font-size: 0.9rem;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

## 🧪 Tesztelési Terv

### 1. UI Tesztelés
- [ ] Kártyák magassága 80px
- [ ] Vízszintes görgetés működik
- [ ] Oszlop-kiválasztó mentés működik

### 2. Adatok Tesztelése
- [ ] Excel konverzió helyesen működik
- [ ] JSON adatok betöltődnek
- [ ] Szűrők (export/import/belföld) működnek

### 3. Integráció Tesztelése
- [ ] Összes adat megjelenik
- [ ] Mentett oszlop-konfiguráció helyesen betöltődik
- [ ] Szűrések és rendezések helyesen működnek

---

## ⚠️ Kritikus Megjegyzések

1. **Performance:** A vízszintes görgetés CSS `overflow` alapú kell hogy legyen, nem JavaScript
2. **localStorage:** Oszlop-konfiguráció mentéshez használandó
3. **Adatszerkezet:** Az Excel JSON-be konverzió helyesen kell hogy historja a hierarchikus adatokat
4. **Statuszok:** Szín-kódolás szükséges (zöld/sárga/szürke)

---

## 📞 Kontakt és Kérdések

Ha kérdések vagy tisztázásra szorultak a részletek, a meeting notes-ból minden szükséges információ vonatkozik:

- **MEETING_NOTES.md** - Teljes context
- **UI_SPECIFICATIONS.md** - Technikai részletek
- **EXCEL_UNIFICATION.md** - Adatstruktúra

---

**Státusz:** ✅ Elemzés befejezett, fejlesztésre kész

**Utolsó frissítés:** 2026. március 23.
