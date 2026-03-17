// ===============================
// TransIT v4.4 – TIMELINE ENGINE
// ===============================
//
// - 72 órás idősáv
// - dátum + óra formátumok
// - blokkok: fuvar, pihenő, szerviz stb.
// - B MODELL: Fuvar blokk csak hozzárendelés után kerül fel
// - Sofőr / Vontató / Pótkocsi timeline-ok támogatása
//

import { formatDate } from "../utils.js";

//
// KONSTANSOK
//
const HOUR_WIDTH = 40;         // 1 óra = 40px
const TIMELINE_HOURS = 72;     // 72 órás nézet
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;

//
// ALAP DÁTUM (mai nap 00:00)
//
function getBaseDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

//
// DÁTUM → PIXEL POZÍCIÓ
//
function dateToPosition(dateStr) {
  const base = getBaseDate();
  const t = new Date(dateStr);
  const diffHours = (t - base) / (1000 * 60 * 60);
  const px = diffHours * HOUR_WIDTH;
  return Math.max(0, px);
}

//
// BLOKK SZÉLESSÉG
//
function blockWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diffHours = (e - s) / (1000 * 60 * 60);
  return Math.max(20, diffHours * HOUR_WIDTH);
}

//
// EGYES ERŐFORRÁS SOR GENERÁLÁSA
//
function renderResourceRow(parent, eroforras, type) {
  const row = document.createElement("div");
  row.className = "timeline-resource";

  // Fejléc rész (Név + Hely)
  const nameDiv = document.createElement("div");
  nameDiv.className = "timeline-resource-name";

  nameDiv.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      ${type === "sofor" ? "👤" : type === "vontato" ? "🚛" : "🚚"} 
      <strong>${eroforras.rendszam || eroforras.nev}</strong>
    </div>
    <div style="font-size:11px;opacity:0.7;">
      📍 ${eroforras.jelenlegi_pozicio?.hely || "-"}
    </div>
  `;

  // Timeline sáv
  const bar = document.createElement("div");
  bar.className = "timeline-bar";
  bar.style.position = "relative";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.height = "60px";

  //
  // BLOKKOK (pihenő, fuvar, szerviz stb.)
  //
  if (eroforras.timeline && eroforras.timeline.length > 0) {
    eroforras.timeline.forEach((block) => {
      const div = document.createElement("div");
      div.className = "timeline-block";

      div.classList.add(block.type); // szín hozzárendelése

      const left = dateToPosition(block.start);
      const width = blockWidth(block.start, block.end);

      div.style.left = left + "px";
      div.style.width = width + "px";

      const startLabel = formatDate(block.start);
      const endLabel = formatDate(block.end);

      div.innerHTML = `
        <div><strong>${block.label || block.type.toUpperCase()}</strong></div>
        <div style="font-size:11px;opacity:0.8;">
          ${startLabel} → ${endLabel}
        </div>
      `;

      bar.appendChild(div);
    });
  }

  row.appendChild(nameDiv);
  row.appendChild(bar);
  parent.appendChild(row);
}

//
// TELJES TIMELINE GENERÁLÁSA (SOFŐR/VONTATÓ/PÓTKOCSI CSOPORTOK)
//
export function renderTimeline(containerId, groupedResources) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  groupedResources.forEach((group) => {

    const header = document.createElement("h3");
    header.style.margin = "20px 0 10px 0";
    header.textContent = `${group.icon} ${group.name}`;
    container.appendChild(header);

    group.list.forEach((eroforras) => {
      const type =
        group.name.includes("Sofőr") ? "sofor" :
        group.name.includes("Vontató") ? "vontato" :
        "potkocsi";

      renderResourceRow(container, eroforras, type);
    });
  });
}

//
// ====== B MODELL: FUVAR HOZZÁRENDELÉS → TIMELINE BLOKK ======
//
export function addFuvarBlockToTimeline(resource, fuvar) {
  const block = {
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    type: "fuvar",
    label: fuvar.megnevezes
  };

  if (!resource.timeline) resource.timeline = [];
  resource.timeline.push(block);
}
