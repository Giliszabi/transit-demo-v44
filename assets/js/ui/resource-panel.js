// ======================================================================
// TransIT v4.4 – RESOURCE PANEL (Sofőr / Vontató / Pótkocsi)
// 3 külön scrollos oszlop, mindegyik kattintható és matchinget indít
// ======================================================================

import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";

// Matching integráció
import { evaluateFuvarokForResource } from "./matching.js";

const resourceSearchTerms = {
  sofor: "",
  vontato: "",
  potkocsi: ""
};

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMatchGradePriority(matchGrade) {
  if (matchGrade === "ok") return 0;
  if (matchGrade === "bad") return 1;
  if (matchGrade === "warn") return 2;
  return 3;
}

function sortResourcesByMatch(list) {
  return list
    .map((resource, index) => ({ resource, index }))
    .sort((a, b) => {
      const priorityDiff =
        getMatchGradePriority(a.resource.matchGrade) -
        getMatchGradePriority(b.resource.matchGrade);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.index - b.index;
    })
    .map(({ resource }) => resource);
}

function getResourceCardMatchClass(matchGrade) {
  if (matchGrade === "ok") return "match-ok";
  if (matchGrade === "bad") return "match-bad";
  if (matchGrade === "warn") return "match-warn";
  return "";
}

function applySearchToResourceList(container, resourceType) {
  const list = container.querySelector(`#list-${resourceType}`);
  if (!list) {
    return;
  }

  const term = normalizeSearchText(resourceSearchTerms[resourceType] || "");

  list.querySelectorAll(".resource-card").forEach((card) => {
    const haystack = card.dataset.searchText || "";
    card.hidden = term.length > 0 && !haystack.includes(term);
  });
}

function bindResourceSearchInputs(container) {
  container.querySelectorAll(".resource-search-input").forEach((input) => {
    const resourceType = input.dataset.resourceType;
    if (!resourceType) {
      return;
    }

    input.value = resourceSearchTerms[resourceType] || "";

    ["mousedown", "keydown", "focus"].forEach((eventName) => {
      input.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });

    input.addEventListener("click", (event) => {
      event.stopPropagation();

      const column = input.closest(".resource-column");
      if (column) {
        requestAnimationFrame(() => {
          column.open = true;
        });
      }
    });

    input.addEventListener("input", () => {
      resourceSearchTerms[resourceType] = input.value;
      applySearchToResourceList(container, resourceType);
    });

    applySearchToResourceList(container, resourceType);
  });
}

// =======================================================
// PANEL GENERÁTOR – LÉTREHOZZA A 3 OSZLOPOT
// =======================================================
export function renderResourcePanel(containerId, FUVAROK, onSelectResource) {
  const container = document.getElementById(containerId);

  const openState = {
    sofor: true,
    vontato: true,
    potkocsi: true
  };

  container.querySelectorAll(".resource-column[data-resource-type]").forEach((column) => {
    const type = column.dataset.resourceType;
    if (type) {
      openState[type] = column.open;
    }
  });

  container.innerHTML = `
    <div class="resource-columns">

      <details class="resource-column" data-resource-type="sofor" ${openState.sofor ? "open" : ""}>
        <summary class="resource-column-summary">
          <span class="resource-column-title">👤 Sofőrök</span>
          <span class="resource-column-controls">
            <input
              class="resource-search-input"
              data-resource-type="sofor"
              type="search"
              placeholder="Keresés"
              aria-label="Sofőr keresés"
            />
            <span class="resource-toggle-icon" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="resource-list" id="list-sofor"></div>
      </details>

      <details class="resource-column" data-resource-type="vontato" ${openState.vontato ? "open" : ""}>
        <summary class="resource-column-summary">
          <span class="resource-column-title">🚛 Vontatók</span>
          <span class="resource-column-controls">
            <input
              class="resource-search-input"
              data-resource-type="vontato"
              type="search"
              placeholder="Keresés"
              aria-label="Vontató keresés"
            />
            <span class="resource-toggle-icon" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="resource-list" id="list-vontato"></div>
      </details>

      <details class="resource-column" data-resource-type="potkocsi" ${openState.potkocsi ? "open" : ""}>
        <summary class="resource-column-summary">
          <span class="resource-column-title">🚚 Pótkocsik</span>
          <span class="resource-column-controls">
            <input
              class="resource-search-input"
              data-resource-type="potkocsi"
              type="search"
              placeholder="Keresés"
              aria-label="Pótkocsi keresés"
            />
            <span class="resource-toggle-icon" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="resource-list" id="list-potkocsi"></div>
      </details>

    </div>
  `;

  renderSoforList("list-sofor", SOFOROK, FUVAROK, onSelectResource);
  renderVontatoList("list-vontato", VONTATOK, FUVAROK, onSelectResource);
  renderPotkocsiList("list-potkocsi", POTKOCSIK, FUVAROK, onSelectResource);
  bindResourceSearchInputs(container);
}

function getResourceLabelByTypeAndId(type, id) {
  if (!id) return "";

  if (type === "sofor") {
    return SOFOROK.find((s) => s.id === id)?.nev || "";
  }

  if (type === "vontato") {
    return VONTATOK.find((v) => v.id === id)?.rendszam || "";
  }

  return POTKOCSIK.find((p) => p.id === id)?.rendszam || "";
}

function renderLinkedInfo(resourceType, resource) {
  const lines = [];

  if (resourceType === "sofor") {
    const linkedVontato = getResourceLabelByTypeAndId("vontato", resource.linkedVontatoId);
    lines.push(`🚛 Vontató: ${linkedVontato || "-"}`);
  }

  if (resourceType === "vontato") {
    const linkedSofor = getResourceLabelByTypeAndId("sofor", resource.linkedSoforId);
    const linkedPotkocsi = getResourceLabelByTypeAndId("potkocsi", resource.linkedPotkocsiId);
    lines.push(`👤 Sofőr: ${linkedSofor || "-"}`);
    lines.push(`🚚 Pótkocsi: ${linkedPotkocsi || "-"}`);
  }

  if (resourceType === "potkocsi") {
    const linkedVontato = getResourceLabelByTypeAndId("vontato", resource.linkedVontatoId);
    lines.push(`🚛 Vontató: ${linkedVontato || "-"}`);
  }

  return `
    <div class="res-links">
      ${lines.map((line) => `<div class="res-link-item">${line}</div>`).join("")}
    </div>
  `;
}

// ======================================================================
// SEGÉDFÜGGVÉNY – egy erőforrás kártya HTML-je (fuvar + kapcsolati adatok)
// ======================================================================
function resourceCardHtml(icon, title, position, timeline = [], linkedInfoHtml = "") {
  const seenFuvarKeys = new Set();

  const fuvarBlocks = (timeline || [])
    .filter((block) => block.type === "fuvar" && !block.synthetic)
    .filter((block) => {
      const key = block.fuvarId || `${block.label}|${block.start}|${block.end}`;
      if (seenFuvarKeys.has(key)) {
        return false;
      }
      seenFuvarKeys.add(key);
      return true;
    });

  const fuvarListHtml = fuvarBlocks.length > 0
    ? fuvarBlocks.map((block) => `<div class="res-fuvar-item">📦 ${block.label}</div>`).join("")
    : "<div class=\"res-no-fuvar\">–</div>";

  return `
    <div class="res-card">
      <div class="res-title">${icon} ${title}</div>
      <div class="res-pos">📍 ${position || "-"}</div>
      ${linkedInfoHtml}
      <div class="res-fuvars">
        <div class="res-fuvars-label">Fuvarok:</div>
        <div class="res-fuvars-list">
          ${fuvarListHtml}
        </div>
      </div>
    </div>
  `;
}

// ======================================================================
// SOFŐR LISTA
// ======================================================================
function renderSoforList(targetId, list, FUVAROK, onSelectResource) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  const sortedList = sortResourcesByMatch(list);

  sortedList.forEach((s) => {
    const div = document.createElement("div");
    const matchClass = getResourceCardMatchClass(s.matchGrade);
    div.className = ["resource-card", matchClass].filter(Boolean).join(" ");
    div.dataset.id = s.id;
    div.dataset.type = "sofor";
    const linkedVontato = getResourceLabelByTypeAndId("vontato", s.linkedVontatoId);
    div.dataset.searchText = normalizeSearchText(`${s.nev} ${s.jelenlegi_pozicio?.hely || ""} ${linkedVontato}`);

    div.innerHTML = resourceCardHtml(
      "👤",
      s.nev,
      s.jelenlegi_pozicio?.hely,
      s.timeline,
      renderLinkedInfo("sofor", s)
    );

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(s, FUVAROK, "sofor");
      onSelectResource("sofor", s, results);
    });

    el.appendChild(div);
  });
}

// ======================================================================
// VONTATÓ LISTA
// ======================================================================
function renderVontatoList(targetId, list, FUVAROK, onSelectResource) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  const sortedList = sortResourcesByMatch(list);

  sortedList.forEach((v) => {
    const div = document.createElement("div");
    const matchClass = getResourceCardMatchClass(v.matchGrade);
    div.className = ["resource-card", matchClass].filter(Boolean).join(" ");
    div.dataset.id = v.id;
    div.dataset.type = "vontato";
    const linkedSofor = getResourceLabelByTypeAndId("sofor", v.linkedSoforId);
    const linkedPotkocsi = getResourceLabelByTypeAndId("potkocsi", v.linkedPotkocsiId);
    div.dataset.searchText = normalizeSearchText(`${v.rendszam} ${v.jelenlegi_pozicio?.hely || ""} ${linkedSofor} ${linkedPotkocsi}`);

    div.innerHTML = resourceCardHtml(
      "🚛",
      v.rendszam,
      v.jelenlegi_pozicio?.hely,
      v.timeline,
      renderLinkedInfo("vontato", v)
    );

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(v, FUVAROK, "vontato");
      onSelectResource("vontato", v, results);
    });

    el.appendChild(div);
  });
}

// ======================================================================
// PÓTKOCSI LISTA
// ======================================================================
function renderPotkocsiList(targetId, list, FUVAROK, onSelectResource) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  const sortedList = sortResourcesByMatch(list);

  sortedList.forEach((p) => {
    const div = document.createElement("div");
    const matchClass = getResourceCardMatchClass(p.matchGrade);
    div.className = ["resource-card", matchClass].filter(Boolean).join(" ");
    div.dataset.id = p.id;
    div.dataset.type = "potkocsi";
    const linkedVontato = getResourceLabelByTypeAndId("vontato", p.linkedVontatoId);
    div.dataset.searchText = normalizeSearchText(`${p.rendszam} ${p.jelenlegi_pozicio?.hely || ""} ${linkedVontato}`);

    div.innerHTML = resourceCardHtml(
      "🚚",
      p.rendszam,
      p.jelenlegi_pozicio?.hely,
      p.timeline,
      renderLinkedInfo("potkocsi", p)
    );

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(p, FUVAROK, "potkocsi");
      onSelectResource("potkocsi", p, results);
    });

    el.appendChild(div);
  });
}
