// ============================================================
// TransIT v4.4 – ADVANCED TIMELINE ENGINE
// - C‑típusú TMS időskála (4 órás blokkok)
// - Fuvar blokkok pozícionálása
// - Ütközésvizsgálat
// - Matching Engine szerinti highlight (ok/bad/warn)
// ============================================================

import { formatDate } from "../utils.js";

const HOUR_WIDTH = 40;               // 1 óra = 40px
const TIMELINE_HOURS = 72;           // 3 nap
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;

// ============================================================
// Alap dátum – ma 00:00
// ============================================================
function getBaseDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================
// Dátum → Pixel pozíció
// ============================================================
function dateToPosition(dateStr) {
  const base = getBaseDate();
  const t = new Date(dateStr);
  const diffHours = (t - base) / (1000 * 60 * 60);
  return diffHours * HOUR_WIDTH;
}

// ============================================================
// Blokk szélesség
// ============================================================
function blockWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = (e - s) / (1000 * 60 * 60);
  return Math.max(20, diff * HOUR_WIDTH);
}

// ============================================================
// Ütközésvizsgálat (collision detection)
// ============================================================
export function hasCollision(timeline, start, end) {
  const s = new Date(start);
  const e = new Date(end);

  return timeline.some(b => {
    const bs = new Date(b.start);
    const be = new Date(b.end);
    return (s < be && e > bs); 
  });
}

// ============================================================
// Időskála (header) kirajzolása (4 órás bontás)
// ============================================================
function renderTimeScale(container) {

  const header = document.createElement("div");
  header.style.position = "relative";
  header.style.height = "40px";
  header.style.width = TIMELINE_WIDTH + "px";
  header.style.borderBottom = "1px solid #555";

  const base = getBaseDate();

  for (let h = 0; h <= TIMELINE_HOURS; h++) {

    const line = document.createElement("div");
    line.style.position = "absolute";
    line.style.left = (h * HOUR_WIDTH) + "px";
    line.style.top = "0px";
    line.style.width = "1px";
    line.style.height = "40px";
    line.style.background = (h % 4 === 0) ? "#777" : "#444";
    header.appendChild(line);

    // 4 óránként label
    if (h % 4 === 0) {
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.left = (h * HOUR_WIDTH + 4) + "px";
      label.style.top = "2px";
      label.style.fontSize = "11px";
      label.style.color = "#bbb";

      const d = new Date(base.getTime() + h * 3600 * 1000);
      label.textContent = d.toLocaleString("hu-HU", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit"
      });

      header.appendChild(label);
    }
  }

  container.appendChild(header);
}

// ============================================================
// Egyetlen erőforrás timeline sor (sofor / vontato / potkocsi)
// ============================================================
function renderResourceRow(parent, r, type) {

  const row = document.createElement("div");
  row.className = "timeline-resource";

  // MATCHING HIGHLIGHT (ok/bad/warn)
  if (r.matchGrade === "ok") {
    row.style.border = "1px solid #4cd964";       // Zöld
  } else if (r.matchGrade === "bad") {
    row.style.border = "1px solid #ff3b30";       // Piros
  } else if (r.matchGrade === "warn") {
    row.style.border = "1px solid #ffcc00";       // Sárga
  } else {
    row.style.border = "1px solid #333";          // Default
  }

  // Erőforrás név része
  const name = document.createElement("div");
  name.className = "timeline-resource-name";

  name.dataset.resourceType = type;
  name.dataset.resourceId = r.id;

  name.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      ${type === "sofor" ? "👤" : type === "vontato" ? "🚛" : "🚚"}
      <strong>${r.rendszam || r.nev}</strong>
    </div>
    <div style="font-size:11px;opacity:0.6;">
      📍 ${r.jelenlegi_pozicio?.hely || "-"}
    </div>
  `;

  // Timeline sáv
  const bar = document.createElement("div");
  bar.className = "timeline-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.height = "60px";
  bar.style.position = "relative";

  // Timeline blokkok kirajzolása
  if (r.timeline) {
    r.timeline.forEach(block => {
      const div = document.createElement("div");
      div.className = "timeline-block";
      div.classList.add(block.type);

      const left = dateToPosition(block.start);
      const width = blockWidth(block.start, block.end);

      div.style.left = left + "px";
      div.style.width = width + "px";

      div.innerHTML = `
        <div><strong>${block.label}</strong></div>
        <div style="font-size:11px;opacity:0.8;">
          ${formatDate(block.start)} → ${formatDate(block.end)}
        </div>
      `;

      bar.appendChild(div);
    });
  }

  row.appendChild(name);
  row.appendChild(bar);
  parent.appendChild(row);
}

// ============================================================
// TELJES TIMELINE RENDER
// ============================================================
export function renderTimeline(containerId, groups) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  // TimeScale felül
  renderTimeScale(container);

  // Csoportok (sofőr / vontató / pótkocsi)
  groups.forEach(g => {
    const h = document.createElement("h3");
    h.style.margin = "20px 0 10px 0";
    h.textContent = `${g.icon} ${g.name}`;
    container.appendChild(h);

    g.list.forEach(r => {
      const type =
        g.name.includes("Sofőr") ? "sofor" :
        g.name.includes("Vontató") ? "vontato" : "potkocsi";

      renderResourceRow(container, r, type);
    });
  });
}

// ============================================================
// Fuvar blokk hozzáadása (B-modell – csak hozzárendeléskor)
// ============================================================
export function addFuvarBlockToTimeline(resource, fuvar) {

  if (!resource.timeline) resource.timeline = [];

  // Ütközés ellenőrzése
  if (hasCollision(resource.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    alert("⚠️ Ez az erőforrás foglalt ebben az időszakban!");
    return false;
  }

  resource.timeline.push({
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    type: "fuvar",
    label: fuvar.megnevezes
  });

  return true;
}
