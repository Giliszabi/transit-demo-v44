// ======================================================================
// TransIT v4.4 – RESOURCE PANEL (Sofőr / Vontató / Pótkocsi)
// 3 külön scrollos oszlop, mindegyik kattintható és matchinget indít
// ======================================================================

import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { buildSoforMetaTooltip, renderSoforMetaBadges } from "./sofor-display-meta.js";
import { getDomesticTransitRoleInfo } from "./transit-relations.js";

// Matching integráció
import { evaluateFuvarokForResource, getResourceMatchSortValue, sortResourcesByMatchQuality } from "./matching.js";

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

function buildResourceMatchingContextHtml(fuvarList, selectedFuvarId) {
  if (!selectedFuvarId) {
    return "";
  }

  const selectedFuvar = fuvarList.find((item) => item.id === selectedFuvarId);
  const transitRoleInfo = getDomesticTransitRoleInfo(selectedFuvar, fuvarList);
  if (!transitRoleInfo) {
    return "";
  }

  const roleLabel = transitRoleInfo.role === "elofutas" ? "Előfutás" : "Utófutás";
  return `
    <div class="resource-matching-context resource-matching-context-${transitRoleInfo.role}">
      <div class="resource-matching-context-title">Aktív matching szerep: ${roleLabel}</div>
      <div class="resource-matching-context-body">[${selectedFuvar.id}] ${selectedFuvar.megnevezes} • kapcsolt fuvar: [${transitRoleInfo.linkedFuvar.id}] ${transitRoleInfo.linkedFuvar.megnevezes}</div>
    </div>
  `;
}

// ======================================================================
// SOFŐR RENDEZÉSI SEGÉDFÜGGVÉNYEK
// ======================================================================

function getSoforSortValue(sofor, columnId) {
  const driving = sofor.driving || {};
  if (columnId === "daily") {
    return Math.max(0, (driving.dailyLimitHours || 0) - (driving.dailyDrivenHours || 0));
  }
  if (columnId === "weekly") {
    return Math.max(0, (driving.weeklyLimitHours || 0) - (driving.weeklyDrivenHours || 0));
  }
  if (columnId === "match") {
    return -getResourceMatchSortValue(sofor);
  }
  return 0;
}

function getSoforSortName(sofor) {
  return String(sofor?.nev || "").toLocaleLowerCase("hu-HU");
}

function applySoforSort(list) {
  const state = window._soforSortState;
  if (!state?.columnId) {
    return sortResourcesByMatch(list);
  }
  const dir = state.direction === "asc" ? 1 : -1;
  if (state.columnId === "abc") {
    return [...list].sort((a, b) => getSoforSortName(a).localeCompare(getSoforSortName(b), "hu-HU") * dir);
  }
  return [...list].sort((a, b) => {
    return (getSoforSortValue(a, state.columnId) - getSoforSortValue(b, state.columnId)) * dir;
  });
}

function buildSoforSortBarHtml() {
  const state = window._soforSortState || {};
  const COLS = [
    { col: "abc", label: "ABC" },
    { col: "daily", label: "Napi idő" },
    { col: "weekly", label: "Heti idő" },
    { col: "match", label: "Matching" }
  ];
  const btns = COLS.map(({ col, label }) => {
    const isActive = state.columnId === col;
    const arrow = isActive ? (state.direction === "asc" ? " ↑" : " ↓") : "";
    return `<button type="button" class="resource-sort-btn${isActive ? " active" : ""}" data-sort-column="${col}" title="Rendezés: ${label}">${label}${arrow}</button>`;
  }).join("");
  const hasActiveSort = Boolean(state.columnId);
  const resetBtn = `<button type="button" class="resource-sort-btn resource-sort-btn-reset" data-sort-reset="true" title="Rendezés visszaállítása" aria-label="Rendezés visszaállítása" ${hasActiveSort ? "" : "disabled"}>X</button>`;
  return `<div class="resource-sort-bar" data-sort-for="sofor">${btns}${resetBtn}</div>`;
}

function bindSoforSortButtons(container) {
  const bar = container.querySelector('[data-sort-for="sofor"]');
  if (!bar) return;

  bar.querySelectorAll(".resource-sort-btn").forEach((btn) => {
    ["mousedown", "keydown"].forEach((ev) => btn.addEventListener(ev, (e) => e.stopPropagation()));

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.sortReset === "true") {
        window._soforSortState = { columnId: null, direction: "desc" };
        window.dispatchEvent(new CustomEvent("sofor:sort-changed"));
        return;
      }
      const col = btn.dataset.sortColumn;
      const cur = window._soforSortState || { columnId: null, direction: "desc" };
      window._soforSortState = {
        columnId: col,
        direction: cur.columnId === col && cur.direction === "desc" ? "asc" : "desc"
      };
      window.dispatchEvent(new CustomEvent("sofor:sort-changed"));
    });
  });
}

function sortResourcesByMatch(list) {
  return sortResourcesByMatchQuality(list);
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
export function renderResourcePanel(containerId, FUVAROK, onSelectResource, options = {}) {
  const container = document.getElementById(containerId);
  const spedicioMode = options.mode === "spedicio-partners";

  if (spedicioMode) {
    const partnerList = Array.isArray(options.spedicioPartners) ? options.spedicioPartners : [];
    renderSpedicioPartnerPanel(container, FUVAROK, onSelectResource, partnerList);
    return;
  }

  const soforList = Array.isArray(options.soforok) ? options.soforok : SOFOROK;
  const vontatoList = Array.isArray(options.vontatok) ? options.vontatok : VONTATOK;
  const potkocsiList = Array.isArray(options.potkocsik) ? options.potkocsik : POTKOCSIK;
  const selectedFuvarId = options.selectedFuvarId || null;

  const openState = {
    sofor: true,
    vontato: true,
    potkocsi: true
  };
  const matchingContextHtml = buildResourceMatchingContextHtml(FUVAROK, options.selectedFuvarId);

  container.querySelectorAll(".resource-column[data-resource-type]").forEach((column) => {
    const type = column.dataset.resourceType;
    if (type) {
      openState[type] = column.open;
    }
  });

  container.innerHTML = `
    ${matchingContextHtml}
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
        ${buildSoforSortBarHtml()}
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

  renderSoforList("list-sofor", soforList, FUVAROK, onSelectResource, selectedFuvarId);
  renderVontatoList("list-vontato", vontatoList, FUVAROK, onSelectResource, selectedFuvarId);
  renderPotkocsiList("list-potkocsi", potkocsiList, FUVAROK, onSelectResource, selectedFuvarId);
  bindSoforSortButtons(container);
  bindResourceSearchInputs(container);
}

function filterResourceListForSelectedFuvar(list, selectedFuvarId) {
  if (!selectedFuvarId) {
    return Array.isArray(list) ? list : [];
  }

  return (Array.isArray(list) ? list : []).filter((resource) => resource?.matchSuitable !== false);
}

function renderEmptyResourceState(target, message) {
  target.innerHTML = `<div class="res-no-fuvar">${message}</div>`;
}

function renderSpedicioPartnerPanel(container, FUVAROK, onSelectResource, partnerList) {
  container.innerHTML = `
    <div class="resource-columns">
      <details class="resource-column" data-resource-type="partner" open>
        <summary class="resource-column-summary">
          <span class="resource-column-title">🤝 Spediciós partnerek</span>
          <span class="resource-column-controls">
            <input
              class="resource-search-input"
              data-resource-type="partner"
              type="search"
              placeholder="Keresés"
              aria-label="Partner keresés"
            />
            <span class="resource-toggle-icon" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="resource-list" id="list-partner"></div>
      </details>
    </div>
  `;

  const list = container.querySelector("#list-partner");
  if (!list) {
    return;
  }

  partnerList.forEach((partner) => {
    const div = document.createElement("div");
    div.className = "resource-card";
    div.dataset.id = partner.id;
    div.dataset.type = "partner";
    const latestPrice = partner?.spedicioMeta?.latestPrice || "-";
    const typeMatches = Number(partner?.spedicioMeta?.actualTypeCount || 0);
    div.dataset.searchText = normalizeSearchText(`${partner.nev || partner.id} ${latestPrice}`);

    div.innerHTML = resourceCardHtml(
      "🤝",
      partner.nev || partner.id,
      `Egyező fuvar típus: ${typeMatches}`,
      partner.timeline,
      `
        <div class="res-links">
          <div class="res-link-item">Előző ár (azonos típus): ${latestPrice}</div>
          <div class="res-link-item">Összes kiosztott fuvar: ${partner?.spedicioMeta?.assignedCount || 0}</div>
        </div>
      `
    );

    // Adatlap gomb minden kiosztott fuvarhoz + opcionális AJÁNLATKÉRÉS badge
    (partner.timeline || []).forEach((block) => {
      if (!block.fuvarId) return;
      const itemEl = div.querySelector(`[data-fuvar-id="${CSS.escape(block.fuvarId)}"]`);
      if (!itemEl) return;

      const actions = document.createElement("div");
      actions.className = "partner-fuvar-actions";

      if (block.spedicioOperationType === "offer-request") {
        const badge = document.createElement("span");
        badge.className = "partner-ajanlatkeres-badge";
        badge.textContent = "AJÁNLATKÉRÉS";
        actions.appendChild(badge);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fuvar-spediccio-form-btn fuvar-spediccio-form-btn-inline partner-adatlap-btn";
      btn.dataset.action = "partner-adatlap";
      btn.dataset.fuvarId = block.fuvarId;
      btn.textContent = "Adatlap";

      actions.appendChild(btn);
      itemEl.appendChild(actions);
    });

    div.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="partner-adatlap"]')) {
        return; // kezeli a list-szintű delegált listener
      }
      if (typeof onSelectResource === "function") {
        onSelectResource("partner", partner, { soforok: [], vontatok: [], potkocsik: [], partnerek: [] }, FUVAROK);
      }
    });

    list.appendChild(div);
  });

  // Delegált Adatlap gomb klikk
  list.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-action="partner-adatlap"]');
    if (!btn) return;
    event.stopPropagation();
    const fuvarId = btn.dataset.fuvarId;
    if (fuvarId) {
      window.dispatchEvent(new CustomEvent("spediccio:open-form", { detail: { fuvarId } }));
    }
  });

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
// SEGÉDFÜGGVÉNY – egy erőforrás kártya HTML-je (fuvar + kapcsolati adatok + reasons)
// ======================================================================
function resourceCardHtml(icon, title, position, timeline = [], linkedInfoHtml = "", reasons = [], topMetaHtml = "") {
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
    ? fuvarBlocks.map((block) => {
      const details = block.partnerSummary
        ? `<div class="res-fuvar-item-meta">${block.partnerSummary}</div>`
        : "";
      return `
        <div class="res-fuvar-item" data-fuvar-id="${block.fuvarId || ''}">
          <div>📦 ${block.label}</div>
          ${details}
        </div>
      `;
    }).join("")
    : "<div class=\"res-no-fuvar\">–</div>";

  // Reasons megjelenítése - piros hibakokkal
  const reasonsHtml = reasons && reasons.length > 0
    ? `
      <div class="res-reasons">
        <div class="res-reasons-label">⚠️ Eltérések:</div>
        <div class="res-reasons-list">
          ${reasons.map((reason) => `<div class="res-reason-item">• ${reason}</div>`).join("")}
        </div>
      </div>
    `
    : "";

  return `
    <div class="res-card">
      <div class="res-title">${icon} ${title}</div>
      ${topMetaHtml}
      <div class="res-pos">📍 ${position || "-"}</div>
      ${linkedInfoHtml}
      ${reasonsHtml}
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
function renderSoforList(targetId, list, FUVAROK, onSelectResource, selectedFuvarId = null) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  const filteredList = filterResourceListForSelectedFuvar(list, selectedFuvarId);
  const sortedList = applySoforSort(filteredList);

  if (sortedList.length === 0) {
    renderEmptyResourceState(el, "Nincs megfelelő sofőr a kijelölt fuvarhoz.");
    return;
  }

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
      renderLinkedInfo("sofor", s),
      s.matchReasons || [],
      renderSoforMetaBadges(s)
    );
    div.title = buildSoforMetaTooltip(s);

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
function renderVontatoList(targetId, list, FUVAROK, onSelectResource, selectedFuvarId = null) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  const filteredList = filterResourceListForSelectedFuvar(list, selectedFuvarId);
  const sortedList = sortResourcesByMatch(filteredList);

  if (sortedList.length === 0) {
    renderEmptyResourceState(el, "Nincs megfelelő vontató a kijelölt fuvarhoz.");
    return;
  }

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
      renderLinkedInfo("vontato", v),
      v.matchReasons || []
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
function renderPotkocsiList(targetId, list, FUVAROK, onSelectResource, selectedFuvarId = null) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  const filteredList = filterResourceListForSelectedFuvar(list, selectedFuvarId);
  const sortedList = sortResourcesByMatch(filteredList);

  if (sortedList.length === 0) {
    renderEmptyResourceState(el, "Nincs megfelelő pótkocsi a kijelölt fuvarhoz.");
    return;
  }

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
      renderLinkedInfo("potkocsi", p),
      p.matchReasons || []
    );

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(p, FUVAROK, "potkocsi");
      onSelectResource("potkocsi", p, results);
    });

    el.appendChild(div);
  });
}
