# UI Módosítások Specifikációja

## 🎯 1. Fuvar Kártyák - Méretezés és Görgetés

### 1.1 Jelenlegi Probléma
- Kártyák túl magasak (nem fér el sok fuvar függőleges görgetés nélkül)
- Nincs vízszintes görgetés (sok adat nem látható)

### 1.2 Megoldás

#### A. Kártyák Magassága Csökkentése

**Jelenlegi CSS (fuvar-panel.js):**
```css
.fuvar-kártya {
  height: 200px; /* JELENLEGI */
  overflow: hidden;
}
```

**Új CSS:**
```css
.fuvar-kártya {
  height: 80px;  /* CSÖKKENT */
  display: grid;
  grid-template-columns: 1fr;
  overflow: hidden; /* függőlegesen rejtett */
}

.fuvar-kártya-container {
  height: 100%;
  display: flex;
  gap: 12px;
  overflow-x: auto; /* VÍZSZINTES GÖRGETÉS */
  overflow-y: hidden;
  padding: 8px;
  background: linear-gradient(to right, #fff 0%, #fff 90%, #f0f0f0 95%);
  scroll-behavior: smooth;
}

.fuvar-kártya-container::-webkit-scrollbar {
  height: 4px;
}

.fuvar-kártya-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}
```

#### B. Vízszintes Görgetés - Oszlop Szerkezet

```html
<div class="fuvar-kártya">
  <!-- Apró oszlopok fixen (bal) -->
  <div class="fuvar-kártya-column fixed">
    <div class="fuvar-id">F-001</div>
    <div class="fuvar-status green">kész</div>
  </div>
  
  <!-- Görgethető rész (jobb) -->
  <div class="fuvar-kártya-scrollable">
    <div class="fuvar-column">
      <label>Indulás</label>
      <span>2026-03-25 08:00</span>
    </div>
    
    <div class="fuvar-column">
      <label>Felrakó</label>
      <span>Budapest</span>
    </div>
    
    <div class="fuvar-column">
      <label>Sofőr</label>
      <span>Kiss Antal</span>
    </div>
    
    <!-- ... több oszlop ... -->
  </div>
</div>
```

#### Megvalósítás:

Fájl: [assets/js/ui/fuvar-panel.js](assets/js/ui/fuvar-panel.js#L1)

```javascript
// FuvarCard komponens
class FuvarCard {
  constructor(fuvarData, visibleColumns) {
    this.fuvarData = fuvarData;
    this.visibleColumns = visibleColumns; // Kiválasztott oszlopok
    this.card = this.createCard();
  }
  
  createCard() {
    const card = document.createElement('div');
    card.className = 'fuvar-kártya';
    
    // Fix oszlopok
    const fixedSection = document.createElement('div');
    fixedSection.className = 'fuvar-kártya-column fixed';
    fixedSection.innerHTML = `
      <div class="fuvar-id">${this.fuvarData.id}</div>
      <div class="fuvar-status ${this.getStatusClass()}">
        ${this.fuvarData.status}
      </div>
    `;
    
    // Görgethető rész
    const scrollableSection = document.createElement('div');
    scrollableSection.className = 'fuvar-kártya-scrollable';
    
    this.visibleColumns.forEach(col => {
      const columnDiv = document.createElement('div');
      columnDiv.className = 'fuvar-column';
      columnDiv.innerHTML = `
        <label>${col.label}</label>
        <span>${this.formatValue(col.key, this.fuvarData[col.key])}</span>
      `;
      scrollableSection.appendChild(columnDiv);
    });
    
    card.appendChild(fixedSection);
    card.appendChild(scrollableSection);
    
    return card;
  }
  
  getStatusClass() {
    const statusMap = {
      'kész': 'status-ready',
      'tervezés_alatt': 'status-planning',
      'elmaradt': 'status-missed',
      'összes': 'status-all'
    };
    return statusMap[this.fuvarData.status] || 'status-unknown';
  }
  
  formatValue(key, value) {
    if (!value) return '-';
    if (key.includes('Date') || key.includes('idő'))
      return new Date(value).toLocaleString('hu-HU');
    if (key.includes('Költség') || key.includes('Cost'))
      return value.toLocaleString('hu-HU') + ' Ft';
    return String(value).substring(0, 20);
  }
}
```

---

## 2. Oszlop-Kiválasztás UI

### 2.1 Oszlop Válsztó Dialog

```html
<div class="oszlop-valaszto-modal" id="columnSelectorModal">
  <div class="modal-content">
    <h3>Kiválasztható Oszlopok</h3>
    
    <div class="column-selector-tabs">
      <button class="tab-btn active" data-category="fuvar">Fuvar Adatok</button>
      <button class="tab-btn" data-category="menet">Menetirányítás</button>
      <button class="tab-btn" data-category="erőforrás">Erőforrás</button>
    </div>
    
    <div class="column-list">
      <!-- Dinamikusan generált checkboxok -->
      <label class="column-checkbox">
        <input type="checkbox" name="plannedStart" checked>
        <span>Tervezett Indulás</span>
      </label>
      
      <label class="column-checkbox">
        <input type="checkbox" name="pickupLocation" checked>
        <span>Felrakó</span>
      </label>
      
      <!-- ... további oszlopok ... -->
    </div>
    
    <div class="modal-actions">
      <button class="btn-save">Mentés</button>
      <button class="btn-cancel">Mégse</button>
      <button class="btn-reset">Alapértelmezésre Állítás</button>
    </div>
  </div>
</div>
```

### 2.2 JavaScript - Oszlop-Kiválasztás Controller

```javascript
class ColumnSelector {
  constructor() {
    this.modalElement = document.getElementById('columnSelectorModal');
    this.storageKey = 'fuvar_card_columns_config';
    this.defaultColumns = [
      { key: 'plannedStart', label: 'Tervezett Indulás', category: 'fuvar', visible: true },
      { key: 'pickupLocation', label: 'Felrakó', category: 'fuvar', visible: true },
      { key: 'deliveryLocation', label: 'Lerakó', category: 'fuvar', visible: true },
      { key: 'assignedResources.driver.name', label: 'Sofőr', category: 'erőforrás', visible: true },
      { key: 'assignedResources.tractor.type', label: 'Traktor', category: 'erőforrás', visible: true },
      { key: 'kilometer', label: 'KM', category: 'fuvar', visible: true },
      { key: 'totalCost', label: 'Költség', category: 'fuvar', visible: true },
      { key: 'adr', label: 'ADR', category: 'fuvar', visible: false },
      { key: 'compliance', label: 'Megfelelőség', category: 'menet', visible: false },
      // ... további oszlopok ...
    ];
    
    this.init();
  }
  
  init() {
    this.loadSavedConfig();
    this.setupEventListeners();
  }
  
  loadSavedConfig() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      const config = JSON.parse(saved);
      this.defaultColumns = config;
    }
  }
  
  saveConfig() {
    const visible = this.defaultColumns
      .filter(col => document.querySelector(`input[name="${col.key}"]`)?.checked)
      .map(col => col.key);
    
    const config = this.defaultColumns.map(col => ({
      ...col,
      visible: visible.includes(col.key)
    }));
    
    localStorage.setItem(this.storageKey, JSON.stringify(config));
    console.log('✓ Oszlop-konfiguráció mentve');
  }
  
  getVisibleColumns() {
    return this.defaultColumns.filter(col => col.visible);
  }
  
  setupEventListeners() {
    // Mentés gomb
    this.modalElement.querySelector('.btn-save').addEventListener('click', () => {
      this.saveConfig();
      this.closeModal();
      // Oldal frissítése
      location.reload();
    });
    
    // Mégse gomb
    this.modalElement.querySelector('.btn-cancel').addEventListener('click', () => {
      this.closeModal();
    });
    
    // Alapértelmezésre állítás
    this.modalElement.querySelector('.btn-reset').addEventListener('click', () => {
      localStorage.removeItem(this.storageKey);
      this.loadSavedConfig();
      this.renderCheckboxes();
    });
  }
  
  openModal() {
    this.renderCheckboxes();
    this.modalElement.style.display = 'flex';
  }
  
  closeModal() {
    this.modalElement.style.display = 'none';
  }
  
  renderCheckboxes() {
    const columnList = this.modalElement.querySelector('.column-list');
    columnList.innerHTML = '';
    
    this.defaultColumns.forEach(col => {
      const label = document.createElement('label');
      label.className = 'column-checkbox';
      label.innerHTML = `
        <input type="checkbox" name="${col.key}" ${col.visible ? 'checked' : ''}>
        <span>${col.label}</span>
      `;
      columnList.appendChild(label);
    });
  }
  
  toggleTab(category) {
    // Tab szűrés az oszlopok között
  }
}

// Inicializálás
const columnSelector = new ColumnSelector();
```

### 2.3 HTML Gomb az Oszlop-Kiválasztáshoz

```html
<div class="panel-toolbar">
  <button class="btn btn-icon" id="openColumnSelector" title="Oszlopok kiválasztása">
    <svg><!-- Grid icon --></svg>
    Oszlopok
  </button>
</div>

<script>
document.getElementById('openColumnSelector').addEventListener('click', () => {
  columnSelector.openModal();
});
</script>
```

---

## 3. Nézet Szűrők (Export/Import/Belföld)

### 3.1 Egységes Szűrő Interfész

```html
<div class="filter-bar">
  <button class="filter-tab" data-type="all">
    Összes ✓
  </button>
  
  <button class="filter-tab" data-type="export">
    Export
  </button>
  
  <button class="filter-tab" data-type="import">
    Import
  </button>
  
  <button class="filter-tab" data-type="belföld">
    Belföld
  </button>
  
  <button class="filter-tab" data-type="missed">
    Elmaradt ⚠️
  </button>
  
  <button class="filter-tab" data-type="ready">
    Kész ✓
  </button>
  
  <button class="filter-tab" data-type="planning">
    Tervezés 🔨
  </button>
</div>
```

### 3.2 CSS Stílus

```css
.fuvar-panel {
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.filter-bar {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  overflow-x: auto;
}

.filter-tab {
  padding: 6px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.filter-tab.active {
  background: #007bff;
  color: white;
  border-color: #0062cc;
}

.fuvar-kártya-container {
  flex: 1;
  overflow-y: auto;
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #fafafa;
}

.fuvar-kártya {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: all 0.2s;
}

.fuvar-kártya:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  border-color: #007bff;
}
```

---

## 4. Implementáció Rátérv

1. **CSS módosítás** - fuvar kártyák magassága, vízszintes görgetés
2. **JavaScript komponens** - `FuvarCard` osztály
3. **Oszlop-kiválasztó UI** - modal + localStorage
4. **Szűrés logika** - export/import/belföld szűrők
5. **Teljes integrálás** - összes adat betöltése, megjelenítése

---

## 5. Fájlok Módosítása

- [assets/js/ui/fuvar-panel.js](assets/js/ui/fuvar-panel.js) - Kártyák komponens
- [assets/css/layout.css](assets/css/layout.css) - Grid & scroll stílusok
- **Új fájl:** [assets/js/ui/column-selector.js](assets/js/ui/column-selector.js) - Oszlop kezelő
- [fuvarszervezes_v4.4.html](fuvarszervezes_v4.4.html) - HTML struktúra
