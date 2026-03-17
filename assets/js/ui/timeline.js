// ============================================
// TransIT v4.4 – ADVANCED TIMELINE ENGINE
// (C‑típusú időskálázással + collision detection)
// ============================================

import { formatDate } from "../utils.js";

const HOUR_WIDTH = 40;            
const TIMELINE_HOURS = 72;        
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;

// -------------------------------------
// Alap dátum (ma 00:00)
// -------------------------------------
function getBaseDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// -------------------------------------
// Dátum → pixel pozíció
// -------------------------------------
function dateToPosition(dateStr) {
  const base = getBaseDate();
  const t = new Date(dateStr);
  const diffHours = (t - base) / (1000 * 60 * 60);
  return diffHours * HOUR_WIDTH;
}

// -------------------------------------
// Blokk szélesség
// -------------------------------------
function blockWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = (e - s) / (1000 * 60 * 60);
  return Math.max(20, diff * HOUR_WIDTH);
}

// -------------------------------------
// ÜTKÖZÉSVIZSGÁLAT
// -------------------------------------
function hasCollision(timeline, start, end) {
  const s = new Date(start);
  const e = new Date(end);

  return timeline.some(b => {
    const bs = new Date(b.start);
    const be = new Date(b.end);
    return (s < be && e > bs); 
  });
}

// -------------------------------------
// Időskála rajzolás (C‑típusú TMS nézet)
// -------------------------------------
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

    // 4 óránként címke
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

// -------------------------------------
// Egy erőforrás sor
// -------------------------------------
function renderResourceRow(parent, r, type) {

  const row = document.createElement("div");
  row.className = "timeline-resource";

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

  const bar = document.createElement("div");
  bar.className = "timeline-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.height = "60px";
  bar.style.position = "relative";

  // blokkok
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

// -------------------------------------
// TELJES TIMELINE RENDERELÉS
// -------------------------------------
export function renderTimeline(containerId, grouped) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  // időskála
  renderTimeScale(container);

  grouped.forEach(g => {
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

// -------------------------------------
// FUVAR BLOKK HOZZÁADÁSA (B‑modell)
// -------------------------------------
export function addFuvarBlockToTimeline(resource, fuvar) {

  if (!resource.timeline) resource.timeline = [];

  // ütközésvizsgálat
  if (hasCollision(resource.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    alert("⚠️ Ez az erőforrás foglalt ebben az időszakban!");
    return false;
  }

  const block = {
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    type: "fuvar",
    label: fuvar.megnevezes
  };

  resource.timeline.push(block);
  return true;
}
