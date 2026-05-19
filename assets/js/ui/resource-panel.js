// ======================================================================
// TransIT v4.4 – RESOURCE PANEL (Gépjárművezető / Vontató / Pótkocsi)
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

let openSoforContextMenu = null;
let openSoforPairModal = null;

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

function isFixedLinkedPairDriver(sofor) {
  return sofor?.kezes === "2" && typeof sofor?.linkedSoforId === "string" && sofor.linkedSoforId.length > 0;
}

function getSoforDisplayName(sofor) {
  return String(sofor?.nev || sofor?.name || sofor?.id || "Ismeretlen sofőr");
}

function resolveSoforById(soforId, list = SOFOROK) {
  return (list || []).find((item) => item.id === soforId) || null;
}

function closeSoforContextMenu() {
  if (!openSoforContextMenu) {
    return;
  }

  openSoforContextMenu.remove();
  openSoforContextMenu = null;
}

function closeSoforPairModal() {
  if (!openSoforPairModal) {
    return;
  }

  openSoforPairModal.remove();
  openSoforPairModal = null;
}

function unlinkSoforPair(sofor, list = SOFOROK) {
  if (!sofor) {
    return;
  }

  const linked = resolveSoforById(sofor.linkedSoforId, list);
  if (linked && linked.linkedSoforId === sofor.id) {
    delete linked.linkedSoforId;
  }

  delete sofor.linkedSoforId;
}

function applySoforPair(baseSofor, partnerSofor, list = SOFOROK) {
  if (!baseSofor) {
    return;
  }

  unlinkSoforPair(baseSofor, list);

  if (!partnerSofor) {
    return;
  }

  unlinkSoforPair(partnerSofor, list);
  baseSofor.linkedSoforId = partnerSofor.id;
  partnerSofor.linkedSoforId = baseSofor.id;
  baseSofor.kezes = "2";
  partnerSofor.kezes = "2";
}

function createSoforPairEntries(sortedList, sourceList) {
  const byId = new Map((sourceList || []).map((item) => [item.id, item]));
  const visited = new Set();
  const entries = [];

  sortedList.forEach((driver) => {
    if (!driver || visited.has(driver.id)) {
      return;
    }

    const partner = resolveSoforById(driver.linkedSoforId, sourceList);
    const hasStablePair = Boolean(
      partner
      && partner.id !== driver.id
      && partner.linkedSoforId === driver.id
      && isFixedLinkedPairDriver(driver)
      && isFixedLinkedPairDriver(partner)
    );

    if (hasStablePair) {
      visited.add(driver.id);
      visited.add(partner.id);
      entries.push({
        kind: "pair",
        key: getSoforPairKey(driver),
        primary: byId.get(driver.id) || driver,
        secondary: byId.get(partner.id) || partner
      });
      return;
    }

    visited.add(driver.id);
    entries.push({
      kind: "single",
      key: `single:${driver.id}`,
      primary: byId.get(driver.id) || driver,
      secondary: null
    });
  });

  return entries;
}

function openSoforContextMenuAt(event, actions = []) {
  closeSoforContextMenu();

  if (!actions.length) {
    return;
  }

  const menu = document.createElement("div");
  menu.className = "resource-context-menu";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "resource-context-menu-item";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      closeSoforContextMenu();
      action.action();
    });
    menu.appendChild(button);
  });

  document.body.appendChild(menu);
  openSoforContextMenu = menu;

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = Math.max(8, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.min(event.clientX, maxX)}px`;
    menu.style.top = `${Math.min(event.clientY, maxY)}px`;
  });
}

function openSoforPairManagerModal(baseSofor, sourceList, onSaved) {
  closeSoforPairModal();

  if (!baseSofor) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "resource-pair-modal-overlay";

  const host = document.createElement("div");
  host.className = "resource-pair-modal";

  const currentPartner = resolveSoforById(baseSofor.linkedSoforId, sourceList);
  let selectedPartnerId = currentPartner?.id || "";

  const allCandidates = (sourceList || [])
    .filter((item) => item.id !== baseSofor.id)
    .slice()
    .sort((left, right) => getSoforDisplayName(left).localeCompare(getSoforDisplayName(right), "hu-HU"));

  const renderCandidateList = (query = "") => {
    const normalized = normalizeSearchText(query);
    const rows = allCandidates
      .filter((candidate) => {
        const searchable = normalizeSearchText(`${getSoforDisplayName(candidate)} ${(candidate.jelenlegi_pozicio?.hely || "")}`);
        return !normalized || searchable.includes(normalized);
      })
      .map((candidate) => {
        const selectedClass = candidate.id === selectedPartnerId ? " selected" : "";
        const selectedBadge = candidate.id === selectedPartnerId ? "<span class=\"resource-pair-candidate-badge\">Kijelölve</span>" : "";
        return `
          <button type="button" class="resource-pair-candidate${selectedClass}" data-candidate-id="${candidate.id}">
            <span class="resource-pair-candidate-name">${getSoforDisplayName(candidate)}</span>
            <span class="resource-pair-candidate-meta">📍 ${candidate.jelenlegi_pozicio?.hely || "-"}</span>
            ${selectedBadge}
          </button>
        `;
      })
      .join("");

    const listHost = host.querySelector(".resource-pair-candidates");
    if (listHost) {
      listHost.innerHTML = rows || '<div class="resource-pair-empty">Nincs találat a keresésre.</div>';
    }
  };

  const baseName = getSoforDisplayName(baseSofor);
  const partnerName = currentPartner ? getSoforDisplayName(currentPartner) : "nincs beállítva";

  host.innerHTML = `
    <div class="resource-pair-modal-header">
      <h3>4 kezes páros beállítása</h3>
      <button type="button" class="resource-pair-modal-close" aria-label="Bezárás">×</button>
    </div>
    <div class="resource-pair-modal-subtitle">Alap sofőr: <strong>${baseName}</strong></div>
    <div class="resource-pair-current-row">
      <div>Jelenlegi pár: <strong class="resource-pair-current-name">${partnerName}</strong></div>
      <button type="button" class="resource-pair-clear-btn">Pár törlése</button>
    </div>
    <input type="search" class="resource-pair-search" placeholder="Sofőr keresése név alapján" aria-label="Sofőr keresése" />
    <div class="resource-pair-candidates"></div>
    <div class="resource-pair-modal-actions">
      <button type="button" class="btn resource-pair-cancel-btn">Mégse</button>
      <button type="button" class="btn resource-pair-save-btn">Mentés</button>
    </div>
  `;

  overlay.appendChild(host);
  document.body.appendChild(overlay);
  openSoforPairModal = overlay;

  const close = () => {
    closeSoforPairModal();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  host.querySelector(".resource-pair-modal-close")?.addEventListener("click", close);
  host.querySelector(".resource-pair-cancel-btn")?.addEventListener("click", close);

  host.querySelector(".resource-pair-clear-btn")?.addEventListener("click", () => {
    selectedPartnerId = "";
    const currentNameEl = host.querySelector(".resource-pair-current-name");
    if (currentNameEl) {
      currentNameEl.textContent = "nincs beállítva";
    }
    renderCandidateList(host.querySelector(".resource-pair-search")?.value || "");
  });

  host.querySelector(".resource-pair-search")?.addEventListener("input", (event) => {
    renderCandidateList(event.target.value || "");
  });

  host.querySelector(".resource-pair-candidates")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-candidate-id]");
    if (!row) {
      return;
    }

    selectedPartnerId = row.dataset.candidateId || "";
    const selectedPartner = resolveSoforById(selectedPartnerId, sourceList);
    const currentNameEl = host.querySelector(".resource-pair-current-name");
    if (currentNameEl) {
      currentNameEl.textContent = selectedPartner ? getSoforDisplayName(selectedPartner) : "nincs beállítva";
    }
    renderCandidateList(host.querySelector(".resource-pair-search")?.value || "");
  });

  host.querySelector(".resource-pair-save-btn")?.addEventListener("click", () => {
    const partner = selectedPartnerId ? resolveSoforById(selectedPartnerId, sourceList) : null;
    applySoforPair(baseSofor, partner, sourceList);
    close();
    if (typeof onSaved === "function") {
      onSaved({ baseSoforId: baseSofor.id, partnerSoforId: partner?.id || null });
    }
  });

  renderCandidateList("");
  host.querySelector(".resource-pair-search")?.focus();
}

function openSoforPairContextMenu(event, contextDriver, sourceList = SOFOROK) {
  if (!contextDriver) {
    return;
  }

  openSoforContextMenuAt(event, [
    {
      label: "4 kezes páros beállítása",
      action: () => {
        openSoforPairManagerModal(contextDriver, sourceList, (detail) => {
          window.dispatchEvent(new CustomEvent("sofor:pair-updated", { detail }));
        });
      }
    }
  ]);
}

function getSoforPairPriority(sofor) {
  return isFixedLinkedPairDriver(sofor) ? 0 : 1;
}

function getSoforPairKey(sofor) {
  if (!isFixedLinkedPairDriver(sofor)) {
    return `solo:${sofor?.id || ""}`;
  }

  return [sofor.id, sofor.linkedSoforId].sort().join("|");
}

function applySoforPairPrioritySort(list, compareWithinBucket) {
  return [...list].sort((left, right) => {
    const priorityDiff = getSoforPairPriority(left) - getSoforPairPriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const pairDiff = getSoforPairKey(left).localeCompare(getSoforPairKey(right), "hu-HU");
    if (pairDiff !== 0) {
      return pairDiff;
    }

    return compareWithinBucket(left, right);
  });
}

function applySoforSort(list) {
  const state = window._soforSortState;
  if (!state?.columnId) {
    return applySoforPairPrioritySort(sortResourcesByMatch(list), () => 0);
  }
  const dir = state.direction === "asc" ? 1 : -1;
  if (state.columnId === "abc") {
    return applySoforPairPrioritySort(list, (a, b) => {
      return getSoforSortName(a).localeCompare(getSoforSortName(b), "hu-HU") * dir;
    });
  }
  return applySoforPairPrioritySort(list, (a, b) => {
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
          <span class="resource-column-title">👤 Gépjárművezetők</span>
          <span class="resource-column-controls">
            <input
              class="resource-search-input"
              data-resource-type="sofor"
              type="search"
              placeholder="Keresés"
              aria-label="Gépjárművezető keresés"
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
  void selectedFuvarId;
  return Array.isArray(list) ? list : [];
}

function renderEmptyResourceState(target, message) {
  target.innerHTML = `<div class="res-no-fuvar">${message}</div>`;
}

function renderSpedicioPartnerPanel(container, FUVAROK, onSelectResource, partnerList) {
  container.innerHTML = `
    <div class="resource-columns">
      <details class="resource-column" data-resource-type="partner" open>
        <summary class="resource-column-summary">
          <span class="resource-column-title">🤝 Spedíciós partnerek</span>
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
    const sofor = SOFOROK.find((s) => s.id === id);
    return sofor ? getSoforDisplayName(sofor) : "";
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
    const linkedSofor = getResourceLabelByTypeAndId("sofor", resource.linkedSoforId);
    lines.push(`🚛 Vontató: ${linkedVontato || "-"}`);
    if (resource.kezes === "2") {
      lines.push(`👥 Fix pár: ${linkedSofor || "-"}`);
    }
  }

  if (resourceType === "vontato") {
    const linkedSofor = getResourceLabelByTypeAndId("sofor", resource.linkedSoforId);
    const linkedPotkocsi = getResourceLabelByTypeAndId("potkocsi", resource.linkedPotkocsiId);
    lines.push(`👤 Gépjárművezető: ${linkedSofor || "-"}`);
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
  closeSoforContextMenu();

  const filteredList = filterResourceListForSelectedFuvar(list, selectedFuvarId);
  const sortedList = applySoforSort(filteredList);

  if (sortedList.length === 0) {
    renderEmptyResourceState(el, "Nincs megfelelő gépjárművezető a kijelölt fuvarhoz.");
    return;
  }

  const entries = createSoforPairEntries(sortedList, list);

  entries.forEach((entry) => {
    const s = entry.primary;
    const pairSofor = entry.secondary;
    const div = document.createElement("div");
    const matchClass = getResourceCardMatchClass(s.matchGrade);
    div.className = ["resource-card", matchClass].filter(Boolean).join(" ");
    div.dataset.id = s.id;
    div.dataset.type = "sofor";
    if (pairSofor) {
      div.dataset.secondaryId = pairSofor.id;
      div.dataset.pairCard = "true";
    }
    const linkedVontato = getResourceLabelByTypeAndId("vontato", s.linkedVontatoId);
    const secondLinkedVontato = pairSofor ? getResourceLabelByTypeAndId("vontato", pairSofor.linkedVontatoId) : "";
    div.dataset.searchText = normalizeSearchText(`${getSoforDisplayName(s)} ${pairSofor ? getSoforDisplayName(pairSofor) : ""} ${s.jelenlegi_pozicio?.hely || ""} ${pairSofor?.jelenlegi_pozicio?.hely || ""} ${linkedVontato} ${secondLinkedVontato}`);

    const mergedTimeline = pairSofor
      ? [...(s.timeline || []), ...(pairSofor.timeline || [])]
      : s.timeline;

    const pairTopMetaHtml = pairSofor
      ? `
        <div class="resource-pair-title-row">
          <button type="button" class="resource-driver-name-chip" data-driver-id="${s.id}">${getSoforDisplayName(s)}</button>
          <span class="resource-pair-separator">+</span>
          <button type="button" class="resource-driver-name-chip" data-driver-id="${pairSofor.id}">${getSoforDisplayName(pairSofor)}</button>
        </div>
      `
      : renderSoforMetaBadges(s);

    const pairLinkedInfoHtml = pairSofor
      ? `
        <div class="res-links">
          <div class="res-link-item">🚛 Vontató (1): ${linkedVontato || "-"}</div>
          <div class="res-link-item">🚛 Vontató (2): ${secondLinkedVontato || "-"}</div>
          <div class="res-link-item">👥 4 kezes fix pár</div>
        </div>
      `
      : renderLinkedInfo("sofor", s);

    const title = pairSofor
      ? `${getSoforDisplayName(s)} + ${getSoforDisplayName(pairSofor)}`
      : getSoforDisplayName(s);

    const position = pairSofor
      ? `${s.jelenlegi_pozicio?.hely || "-"} | ${pairSofor.jelenlegi_pozicio?.hely || "-"}`
      : s.jelenlegi_pozicio?.hely;

    div.innerHTML = resourceCardHtml(
      pairSofor ? "👥" : "👤",
      title,
      position,
      mergedTimeline,
      pairLinkedInfoHtml,
      s.matchReasons || [],
      pairTopMetaHtml
    );
    div.title = pairSofor
      ? `${getSoforDisplayName(s)}\n${buildSoforMetaTooltip(s)}\n\n${getSoforDisplayName(pairSofor)}\n${buildSoforMetaTooltip(pairSofor)}`
      : buildSoforMetaTooltip(s);

    const selectDriver = (driver) => {
      const results = evaluateFuvarokForResource(driver, FUVAROK, "sofor");
      onSelectResource("sofor", driver, results);
    };

    div.addEventListener("click", (event) => {
      const chip = event.target.closest(".resource-driver-name-chip[data-driver-id]");
      if (chip) {
        const selectedDriver = resolveSoforById(chip.dataset.driverId, list);
        if (selectedDriver) {
          selectDriver(selectedDriver);
          return;
        }
      }

      selectDriver(s);
    });

    div.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const chip = event.target.closest(".resource-driver-name-chip[data-driver-id]");
      const contextDriver = chip
        ? resolveSoforById(chip.dataset.driverId, list) || s
        : s;

      openSoforPairContextMenu(event, contextDriver, list);
    });

    el.appendChild(div);
  });
}

document.addEventListener("click", () => {
  closeSoforContextMenu();
});

document.addEventListener("contextmenu", (event) => {
  const timelineName = event.target.closest('.timeline-resource-name[data-resource-type="sofor"][data-resource-id]');
  if (!timelineName) {
    return;
  }

  const soforId = timelineName.dataset.resourceId;
  const sofor = resolveSoforById(soforId, SOFOROK);
  if (!sofor) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openSoforPairContextMenu(event, sofor, SOFOROK);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSoforContextMenu();
    closeSoforPairModal();
  }
});

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
