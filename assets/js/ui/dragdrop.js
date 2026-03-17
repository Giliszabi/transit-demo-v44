// ===================================================================
// DRAG & DROP ENGINE + MATCHING ENGINE
// ===================================================================

import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";

import { evaluateSoforForFuvar, evaluateVontatoForFuvar, evaluatePotkocsiForFuvar } from "./matching.js";
import { addFuvarBlockToTimeline, renderTimeline } from "./timeline.js";

let draggedFuvarId = null;

// DRAG START
export function enableFuvarDrag() {
  document.querySelectorAll(".menu-card").forEach(card => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", () => {
      draggedFuvarId = card.dataset.id;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      draggedFuvarId = null;
      card.classList.remove("dragging");
      clearHighlights();
    });
  });
}

function clearHighlights() {
  document.querySelectorAll(".timeline-resource-name")
    .forEach(el => el.classList.remove("drop-ok", "drop-bad"));
}

// DROP TARGET
export function enableTimelineDrop() {
  document.querySelectorAll(".timeline-resource-name").forEach(row => {
    row.addEventListener("dragover", (e) => {
      e.preventDefault();

      const fuvar = FUVAROK.find(f => f.id === draggedFuvarId);
      const type = row.dataset.resourceType;
      const id = row.dataset.resourceId;

      let resource = null;
      let result = null;

      if (type === "sofor") {
        resource = SOFOROK.find(s => s.id === id);
        result = evaluateSoforForFuvar(resource, fuvar);
      } else if (type === "vontato") {
        resource = VONTATOK.find(v => v.id === id);
        result = evaluateVontatoForFuvar(resource, fuvar);
      } else if (type === "potkocsi") {
        resource = POTKOCSIK.find(p => p.id === id);
        result = evaluatePotkocsiForFuvar(resource, fuvar);
      }

      if (result.suitable) {
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

    row.addEventListener("drop", (e) => {
      e.preventDefault();

      const type = row.dataset.resourceType;
      const id = row.dataset.resourceId;
      const fuvar = FUVAROK.find(f => f.id === draggedFuvarId);

      let resource = null;
      let result = null;

      if (type === "sofor") {
        resource = SOFOROK.find(s => s.id === id);
        result = evaluateSoforForFuvar(resource, fuvar);
      } else if (type === "vontato") {
        resource = VONTATOK.find(v => v.id === id);
        result = evaluateVontatoForFuvar(resource, fuvar);
      } else if (type === "potkocsi") {
        resource = POTKOCSIK.find(p => p.id === id);
        result = evaluatePotkocsiForFuvar(resource, fuvar);
      }

      if (!result.suitable) {
        alert("Ez az erőforrás NEM alkalmas ehhez a fuvarhoz:\n- " + result.reasons.join("\n- "));
        return;
      }

      addFuvarBlockToTimeline(resource, fuvar);

      renderTimeline("timeline-container", [
        { icon: "👤", name: "Sofőrök", list: SOFOROK },
        { icon: "🚛", name: "Vontatók", list: VONTATOK },
        { icon: "🚚", name: "Pótkocsik", list: POTKOCSIK }
      ]);

      enableTimelineDrop();
    });
  });
}
