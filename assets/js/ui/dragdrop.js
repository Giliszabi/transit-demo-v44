// =====================================================
// TransIT v4.4 – ADVANCED DRAG & DROP ENGINE
// (C‑típusú timeline + B-modell + relevancia highlight)
// =====================================================

import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";

import { addFuvarBlockToTimeline, renderTimeline } from "./timeline.js";

// Globális state: melyik fuvar van éppen húzva
let draggedFuvarId = null;

// ======================================
// FUVAR KÁRTYÁK DRAGGABLE AKTIVÁLÁSA
// ======================================
export function enableFuvarDrag() {
  const cards = document.querySelectorAll(".menu-card");

  cards.forEach(card => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", () => {
      draggedFuvarId = card.dataset.id;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      draggedFuvarId = null;
      card.classList.remove("dragging");
      clearResourceHighlights();
    });
  });
}

// ======================================
// TIMELINE DROPPABLE AKTIVÁLÁSA
// ======================================
export function enableTimelineDrop() {
  const rows = document.querySelectorAll(".timeline-resource-name");

  rows.forEach(row => {

    row.addEventListener("dragover", e => {
      e.preventDefault();

      if (!draggedFuvarId) return;

      const fuvar = FUVAROK.find(f => f.id === draggedFuvarId);

      const type = row.dataset.resourceType;
      const resourceId = row.dataset.resourceId;

      const r = getResource(type, resourceId);

      // Relevancia vizsgálat (még kezdeti)
      if (isResourceSuitable(r, fuvar)) {
        row.classList.add("drop-ok");
        row.classList.remove("drop-bad");
      } else {
        row.classList.add("drop-bad");
        row.classList.remove("drop-ok");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-ok", "drop-bad");
    });

    row.addEventListener("drop", e => {
      e.preventDefault();

      const type = row.dataset.resourceType;
      const resourceId = row.dataset.resourceId;

      row.classList.remove("drop-ok", "drop-bad");

      if (!draggedFuvarId) return;

      const fuvar = FUVAROK.find(f => f.id === draggedFuvarId);
      const resource = getResource(type, resourceId);

      // recheck suitability
      if (!isResourceSuitable(resource, fuvar)) {
        alert("❌ Ez az erőforrás nem alkalmas ehhez a fuvarhoz!");
        return;
      }

      // Hozzárendelés a timeline-hoz
      const ok = addFuvarBlockToTimeline(resource, fuvar);

      if (!ok) return; // ütközés esetén false-t kapunk

      // Új timeline render
      renderTimeline("timeline-container", [
        { icon: "👤", name: "Sofőrök", list: SOFOROK },
        { icon: "🚛", name: "Vontatók", list: VONTATOK },
        { icon: "🚚", name: "Pótkocsik", list: POTKOCSIK }
      ]);

      // Újranyitás után ismét engedélyezni kell a dropot
      enableTimelineDrop();
    });
  });
}

// ======================================
// RESOURCE KÉRÉSE TIPUS + ID ALAPJÁN
// ======================================
function getResource(type, id) {
  if (type === "sofor") return SOFOROK.find(s => s.id === id);
  if (type === "vontato") return VONTATOK.find(v => v.id === id);
  if (type === "potkocsi") return POTKOCSIK.find(p => p.id === id);
  return null;
}

// ======================================
// EGYSZERŰ RELEVANCIA LOGIKA (bővíthető)
// ======================================
function isResourceSuitable(resource, fuvar) {

  // később ide jöhet:
  // - ADR ellenőrzés
  // - járműtípus ellenőrzés
  // - földrajzi távolság ellenőrzés
  // - szabad időszak ellenőrzés
  // - vezetési idő ellenőrzés
  // - stb.

  return true; // jelenleg minden erőforrást alkalmasnak jelölünk
}

// ======================================
// DROP HIGHLIGHT TÖRLÉSE
// ======================================
function clearResourceHighlights() {
  document.querySelectorAll(".timeline-resource-name").forEach(r => {
    r.classList.remove("drop-ok", "drop-bad");
  });
}
