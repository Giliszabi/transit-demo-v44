import { formatDate } from "../utils.js";

/*
 A timeline 72 órás:
 - baseDate = ma 00:00
 - minden blokk a start → end alapján kerül pozicionálásra
*/

const HOUR_WIDTH = 40;       // 1 óra 40px
const TIMELINE_HOURS = 72;  // 3 nap
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;

function getBaseDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToPosition(dateStr) {
  const base = getBaseDate();
  const t = new Date(dateStr);
  const diffHours = (t - base) / (1000 * 60 * 60);
  return Math.max(0, diffHours * HOUR_WIDTH);
}

function blockWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diffHours = (e - s) / (1000 * 60 * 60);
  return Math.max(20, diffHours * HOUR_WIDTH);
}

/**
 * Egy erőforrás timeline-sor kirenderelése
 */
function renderResourceRow(parent, eroforras, type) {
  const row = document.createElement("div");
  row.className = "timeline-resource";

  // Név rész
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

  // Idősáv rész
  const bar = document.createElement("div");
  bar.className = "timeline-bar";
  bar.style.position = "relative";
  bar.style.width = TIMELINE_WIDTH + "px";

  // Blokkok renderelése
  if (eroforras.timeline && eroforras.timeline.length > 0) {
    eroforras.timeline.forEach((block) => {
      const div = document.createElement("div");
      div.className = "timeline-block";

      // típus szerint szín
      div.classList.add(block.type);

      // pozíció
      const left = dateToPosition(block.start);
      const width = blockWidth(block.start, block.end);
      div.style.left = left + "px";
      div.style.width = width + "px";

      // címke
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

/**
 * TELJES TIMELINE RENDERELÉSE
 */
export function renderTimeline(containerId, groupedResources) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  groupedResources.forEach((group) => {
    // Csoport fejléce
    const header = document.createElement("h3");
    header.style.margin = "20px 0 10px 0";
    header.textContent = `${group.icon} ${group.name}`;
    container.appendChild(header);

    // Lista renderelése
    group.list.forEach((eroforras) => {
      const type =
        group.name.includes("Sofőr") ? "sofor" :
        group.name.includes("Vontató") ? "vontato" :
        "potkocsi";

      renderResourceRow(container, eroforras, type);
    });
  });
}
