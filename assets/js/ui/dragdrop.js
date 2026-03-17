// ==========================================
// TransIT v4.4 – DRAG & DROP ENGINE
// ==========================================
//
// Ez a modul felelős:
//  ✔ Fuvar kártyák draggable állapotáért
//  ✔ Timeline sorok droppable állapotáért
//  ✔ Hozzárendelési esemény hívásáért
//  ✔ Timeline újrarendereléséért (B Modell)
//
// Használja:
//  - addFuvarBlockToTimeline()
//  - renderTimeline()
//  - assignFuvarToResource()
// ==========================================

import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";

import { addFuvarBlockToTimeline, renderTimeline } from "./timeline.js";

// ==========================================
// Drag state
// ==========================================
let draggedFuvarId = null;

// ==========================================
// Fuvar kártyák draggable aktiválása
// ==========================================
export function enableFuvarDrag() {
  const cards = document.querySelectorAll(".menu-card");

  cards.forEach((card) => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      draggedFuvarId = card.dataset.id;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      draggedFuvarId = null;
      card.classList.remove("dragging");

      // Minden drop highlight törlése
      document.querySelectorAll(".timeline-resource-name").forEach((el) => {
        el.classList.remove("drop-target");
      });
    });
  });
}

// ==========================================
// Erőforrás timeline sorok droppable aktiválása
// ==========================================
export function enableTimelineDrop() {
  const rows = document.querySelectorAll(".timeline-resource-name");

  rows.forEach((row) => {
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drop-target");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-target");
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drop-target");

      const resourceType = row.dataset.resourceType;
      const resourceId = row.dataset.resourceId;

      if (!draggedFuvarId) return;

      assignFuvarToResource(draggedFuvarId, resourceType, resourceId);
    });
  });
}

// ==========================================
// Hozzárendelés logika
// ==========================================
export function assignFuvarToResource(fuvarId, resourceType, resourceId) {
  const fuvar = FUVAROK.find(f => f.id === fuvarId);
  if (!fuvar) {
    console.error("Fuvar nem található:", fuvarId);
    return;
  }

  let resource = null;

  if (resourceType === "sofor") {
    resource = SOFOROK.find(s => s.id === resourceId);
  }
  if (resourceType === "vontato") {
    resource = VONTATOK.find(v => v.id === resourceId);
  }
  if (resourceType === "potkocsi") {
    resource = POTKOCSIK.find(p => p.id === resourceId);
  }

  if (!resource) {
    console.error("Erőforrás nem található:", resourceType, resourceId);
    return;
  }

  // B MODELL → timeline blokk HOZZÁADÁSA
  addFuvarBlockToTimeline(resource, fuvar);

  // Timeline újrarenderelése
  renderTimeline("timeline-container", [
    { icon: "👤", name: "Sofőrök", list: SOFOROK },
    { icon: "🚛", name: "Vontatók", list: VONTATOK },
    { icon: "🚚", name: "Pótkocsik", list: POTKOCSIK }
  ]);

  console.log(`Fuvar (${fuvar.megnevezes}) hozzárendelve: ${resourceType} → ${resourceId}`);
}
