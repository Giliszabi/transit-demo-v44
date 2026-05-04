// ============================================================
// TransIT v4.4 – SZERELVENY TIMELINE
// - Vontato alapu szerelveny sorok
// - Soronkent: Fuvar + Sofor + Vontato + Potkocsi
// ============================================================

import { distanceKm, formatDate } from "../utils.js";
import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { addFuvarBlockToTimeline, hasCollision, refreshAutoDriverStatesForLinkedConvoys, refreshAutoTransitBlocksForResource } from "./timeline.js";
import { getCategoryPalette } from "./colors.js";

const HOUR_WIDTH = 40;
const TIMELINE_HOURS = 72;
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;
const ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS = 260;
const ADDRESS_AUTOCOMPLETE_MIN_CHARS = 3;

let assemblyTimelineOffsetHours = 0;
const assemblyRenderStates = new Map();
let openAssemblyContextMenu = null;
let openAssemblyOperationModal = null;
let openJaratInfoModal = null;
let transientHandlersBound = false;
let focusedFuvarId = null;
let focusedAssemblyId = null;
let assemblyDropoffVehiclesFilterActive = false;
let assemblyViewMode = "timeline";
let jaratTimelineStatusFilter = "all";
const expandedAssemblyIds = new Set();
const assemblyDraftAssignments = new Map();
const ASSEMBLY_VIEW_MODES = ["timeline", "list"];
const ASSEMBLY_VIEW_MODE_LABELS = {
  timeline: "Idővonal",
  list: "Lista"
};
const JARAT_TIMELINE_STATUS_FILTERS = ["all", "pending", "done"];
const JARAT_TIMELINE_STATUS_LABELS = {
  all: "Mind",
  pending: "Függő",
  done: "Kész"
};
let activeAssemblyHoverTooltip = null;
const IMPORT_LINK_WINDOW_HOURS = 4;
const IMPORT_LINK_WINDOW_MS = IMPORT_LINK_WINDOW_HOURS * 3600 * 1000;
const ADDRESS_COORDS = {
  milano: { lat: 45.4642, lng: 9.19 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  lubeck: { lat: 53.8655, lng: 10.6866 },
  munchen: { lat: 48.1351, lng: 11.582 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  wien: { lat: 48.2082, lng: 16.3738 },
  brno: { lat: 49.1951, lng: 16.6068 },
  linz: { lat: 48.3069, lng: 14.2858 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  gyor: { lat: 47.6875, lng: 17.6504 },
  debrecen: { lat: 47.5316, lng: 21.6273 },
  szeged: { lat: 46.253, lng: 20.1414 },
  miskolc: { lat: 48.1035, lng: 20.7784 },
  pecs: { lat: 46.0727, lng: 18.2323 },
  tatabanya: { lat: 47.5692, lng: 18.4048 },
  kecskemet: { lat: 46.8964, lng: 19.6897 },
  esztergom: { lat: 47.7853, lng: 18.7423 },
  szekesfehervar: { lat: 47.186, lng: 18.4221 },
  kornye: { lat: 47.5449, lng: 18.3188 }
};

function ensureAssemblyHoverTooltip() {
  if (activeAssemblyHoverTooltip && activeAssemblyHoverTooltip.isConnected) {
    return activeAssemblyHoverTooltip;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "timeline-hover-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  activeAssemblyHoverTooltip = tooltip;
  return tooltip;
}

function showAssemblyHoverTooltip(content, clientX, clientY) {
  const tooltip = ensureAssemblyHoverTooltip();
  tooltip.textContent = content;
  tooltip.hidden = false;

  const margin = 14;
  const rect = tooltip.getBoundingClientRect();
  let left = clientX + margin;
  let top = clientY + margin;

  if (left + rect.width > window.innerWidth - 8) {
    left = clientX - rect.width - margin;
  }

  if (top + rect.height > window.innerHeight - 8) {
    top = clientY - rect.height - margin;
  }

  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideAssemblyHoverTooltip() {
  if (!activeAssemblyHoverTooltip) {
    return;
  }

  activeAssemblyHoverTooltip.hidden = true;
}

function syncPinnedAssemblyResourceNames(container) {
  const updatePinned = () => {
    const scrollLeft = container.scrollLeft;

    container.querySelectorAll(".assembly-resource-name").forEach((el) => {
      el.style.transform = `translate3d(${scrollLeft}px, 0, 0)`;
    });
  };

  container.onscroll = updatePinned;
  updatePinned();
}

function cloneAssignment(assignment = {}) {
  return {
    soforId: assignment.soforId || null,
    vontatoId: assignment.vontatoId || null,
    potkocsiId: assignment.potkocsiId || null
  };
}

function mergeAssignmentValues(baseAssignment = {}, patchAssignment = {}) {
  const merged = cloneAssignment(baseAssignment);

  if (patchAssignment.soforId) {
    merged.soforId = patchAssignment.soforId;
  }

  if (patchAssignment.vontatoId) {
    merged.vontatoId = patchAssignment.vontatoId;
  }

  if (patchAssignment.potkocsiId) {
    merged.potkocsiId = patchAssignment.potkocsiId;
  }

  return merged;
}

function hasAnyAssignmentValue(assignment = {}) {
  return Boolean(assignment.soforId || assignment.vontatoId || assignment.potkocsiId);
}

function hasCompleteAssignmentValue(assignment = {}) {
  return Boolean(assignment.soforId && assignment.vontatoId && assignment.potkocsiId);
}

function getSavedAssignmentForFuvar(fuvar) {
  return {
    soforId: fuvar?.assignedSoforId || null,
    vontatoId: fuvar?.assignedVontatoId || null,
    potkocsiId: fuvar?.assignedPotkocsiId || null
  };
}

function getDraftEntries() {
  return Array.from(assemblyDraftAssignments.values()).sort((left, right) => {
    const leftPickup = new Date(left?.fuvar?.felrakas?.ido || 0).getTime();
    const rightPickup = new Date(right?.fuvar?.felrakas?.ido || 0).getTime();
    if (leftPickup !== rightPickup) {
      return leftPickup - rightPickup;
    }

    return String(left?.fuvar?.id || "").localeCompare(String(right?.fuvar?.id || ""), "hu-HU");
  });
}

function buildDraftFuvarBlock(fuvar) {
  if (!fuvar?.felrakas?.ido || !fuvar?.lerakas?.ido) {
    return null;
  }

  return {
    type: "fuvar",
    fuvarId: fuvar.id,
    label: fuvar.megnevezes || fuvar.id,
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    kategoria: fuvar.kategoria || fuvar.viszonylat || "belfold",
    surgos: Boolean(fuvar.surgos),
    felrakasCim: fuvar?.felrakas?.cim || "",
    lerakasCim: fuvar?.lerakas?.cim || ""
  };
}

function getAssemblyDisplayTitle(assembly) {
  if (assembly?.isDraft) {
    const fuvarId = assembly?.fuvar?.id || "ismeretlen fuvar";
    const vontatoLabel = assembly?.vontato?.rendszam || "nincs vontató";
    return `📝 ${fuvarId} • ${vontatoLabel}`;
  }

  return `🚛 ${assembly?.vontato?.rendszam || "ismeretlen vontató"}`;
}

function getAssemblyResourceSummary(assembly) {
  return [
    `👤 ${assembly?.sofor?.nev || "nincs gépjárművezető"}`,
    `🚚 ${assembly?.potkocsi?.rendszam || "nincs pótkocsi"}`
  ].join(" • ");
}

function updateDraftAssignmentField(fuvarId, field, value) {
  const entry = assemblyDraftAssignments.get(fuvarId);
  if (!entry) {
    return;
  }

  entry.assignment[field] = value || null;
  if (!hasAnyAssignmentValue(entry.assignment)) {
    assemblyDraftAssignments.delete(fuvarId);
  }
}

function buildDraftAssemblies(soforok, vontatok, potkocsik) {
  return getDraftEntries().map((entry) => {
    const fuvar = entry.fuvar;
    const block = buildDraftFuvarBlock(fuvar);
    return {
      id: `draft:${fuvar.id}`,
      isDraft: true,
      draftMode: entry.editingSavedAssignment ? "edit" : "new",
      fuvar,
      sofor: soforok.find((item) => item.id === entry.assignment.soforId) || null,
      vontato: vontatok.find((item) => item.id === entry.assignment.vontatoId) || null,
      potkocsi: potkocsik.find((item) => item.id === entry.assignment.potkocsiId) || null,
      fuvarBlocks: block ? [block] : []
    };
  }).filter((assembly) => assembly.fuvarBlocks.length > 0 || assembly.sofor || assembly.vontato || assembly.potkocsi);
}

export function stageFuvarAssemblyDraft(fuvarId, assignment) {
  const fuvar = findFuvarById(fuvarId);
  if (!fuvar) {
    return false;
  }

  const incoming = cloneAssignment(assignment);
  if (!hasAnyAssignmentValue(incoming)) {
    assemblyDraftAssignments.delete(fuvar.id);
    rerenderCurrentAssemblyTimeline();
    return false;
  }

  const existing = assemblyDraftAssignments.get(fuvar.id);
  const savedAssignment = getSavedAssignmentForFuvar(fuvar);
  const normalized = mergeAssignmentValues(existing?.assignment || savedAssignment, incoming);
  assemblyDraftAssignments.set(fuvar.id, {
    fuvar,
    assignment: normalized,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    editingSavedAssignment: existing?.editingSavedAssignment || hasAnyAssignmentValue(savedAssignment)
  });

  rerenderCurrentAssemblyTimeline();
  return true;
}

export function discardFuvarAssemblyDraft(fuvarId) {
  assemblyDraftAssignments.delete(fuvarId);
  rerenderCurrentAssemblyTimeline();
}

export function applyAssemblyAssignmentSync(fuvarId, assignment, options = {}) {
  const fuvar = findFuvarById(fuvarId);
  if (!fuvar) {
    return false;
  }

  const normalized = cloneAssignment(assignment || {});
  applyFuvarAssignment(fuvar, normalized, SOFOROK, VONTATOK, POTKOCSIK);

  const sofor = normalized.soforId
    ? SOFOROK.find((item) => item.id === normalized.soforId) || null
    : null;
  const vontato = normalized.vontatoId
    ? VONTATOK.find((item) => item.id === normalized.vontatoId) || null
    : null;
  const potkocsi = normalized.potkocsiId
    ? POTKOCSIK.find((item) => item.id === normalized.potkocsiId) || null
    : null;

  if (sofor && vontato) {
    linkSoforToVontato(sofor, vontato, SOFOROK, VONTATOK);
  }

  if (potkocsi && vontato) {
    linkPotkocsiToVontato(potkocsi, vontato, POTKOCSIK, VONTATOK);
  }

  if (options?.emit !== false) {
    emitAssemblyResourceChanged({
      operation: "assembly-sync-apply",
      fuvarId,
      assignment: normalized
    });
  }

  rerenderCurrentAssemblyTimeline();
  return true;
}

function saveDraftAssembly(fuvarId, soforok, vontatok, potkocsik) {
  const entry = assemblyDraftAssignments.get(fuvarId);
  if (!entry) {
    return { ok: false, message: "A kiválasztott szerelvényterv nem található." };
  }

  if (!hasCompleteAssignmentValue(entry.assignment)) {
    return { ok: false, message: "A szerelvény csak akkor menthető, ha gépjárművezető, vontató és pótkocsi is ki van választva." };
  }

  const fuvar = entry.fuvar;
  const sofor = soforok.find((item) => item.id === entry.assignment.soforId) || null;
  const vontato = vontatok.find((item) => item.id === entry.assignment.vontatoId) || null;
  const potkocsi = potkocsik.find((item) => item.id === entry.assignment.potkocsiId) || null;

  if (!sofor || !vontato || !potkocsi) {
    return { ok: false, message: "A kiválasztott erőforrások közül legalább egy már nem elérhető." };
  }

  if (!canAssignFuvarToResource(sofor, fuvar)) {
    return { ok: false, message: "A kiválasztott gépjárművezető időütközés miatt nem menthető." };
  }

  if (!canAssignFuvarToResource(vontato, fuvar)) {
    return { ok: false, message: "A kiválasztott vontató időütközés miatt nem menthető." };
  }

  if (!canAssignFuvarToResource(potkocsi, fuvar)) {
    return { ok: false, message: "A kiválasztott pótkocsi időütközés miatt nem menthető." };
  }

  applyFuvarAssignment(fuvar, entry.assignment, soforok, vontatok, potkocsik);
  linkSoforToVontato(sofor, vontato, soforok, vontatok);
  linkPotkocsiToVontato(potkocsi, vontato, potkocsik, vontatok);
  assemblyDraftAssignments.delete(fuvarId);

  emitAssemblyResourceChanged({
    operation: "assembly-save",
    fuvarId,
    assignment: cloneAssignment(entry.assignment)
  });

  rerenderCurrentAssemblyTimeline();
  return { ok: true };
}

function renderDraftAssemblyBoard(container, soforok, vontatok, potkocsik) {
  const host = document.createElement("section");
  host.className = "assembly-draft-board";

  const entries = getDraftEntries();
  if (entries.length === 0) {
    host.innerHTML = `
      <div class="assembly-draft-board-header">
        <div>
          <div class="assembly-draft-board-title">Szerelvénytervek</div>
          <div class="assembly-draft-board-subtitle">A fuvar erőforrásra húzása először ideiglenes tervezetet készít.</div>
        </div>
      </div>
      <div class="assembly-draft-empty">Nincs megkezdett szerelvény. Húzz egy fuvarfeladatot a gépjárművezetőre, vontatóra vagy pótkocsira az idővonalon.</div>
    `;
    container.appendChild(host);
    return;
  }

  host.innerHTML = `
    <div class="assembly-draft-board-header">
      <div>
        <div class="assembly-draft-board-title">Szerelvénytervek</div>
        <div class="assembly-draft-board-subtitle">A nem mentett és szerkesztés alatt álló szerelvények innen véglegesíthetők.</div>
      </div>
      <div class="assembly-draft-board-count">${entries.length} db</div>
    </div>
    <div class="assembly-draft-list"></div>
  `;

  const list = host.querySelector(".assembly-draft-list");
  list.innerHTML = entries.map((entry) => {
    const complete = hasCompleteAssignmentValue(entry.assignment);
    const soforLabel = soforok.find((item) => item.id === entry.assignment.soforId)?.nev || "nincs kiválasztva";
    const vontatoLabel = vontatok.find((item) => item.id === entry.assignment.vontatoId)?.rendszam || "nincs kiválasztva";
    const potkocsiLabel = potkocsik.find((item) => item.id === entry.assignment.potkocsiId)?.rendszam || "nincs kiválasztva";
    const statusLabel = entry.editingSavedAssignment ? "Mentett szerelvény szerkesztése" : "Új szerelvény tervezése";

    return `
      <article class="assembly-draft-card ${complete ? "ready" : "pending"}" data-fuvar-id="${escapeHtml(entry.fuvar.id)}">
        <div class="assembly-draft-card-head">
          <div>
            <div class="assembly-draft-card-title">${escapeHtml(entry.fuvar.id)} • ${escapeHtml(entry.fuvar.megnevezes || "Fuvar")}</div>
            <div class="assembly-draft-card-meta">${escapeHtml(statusLabel)}</div>
          </div>
          <span class="assembly-draft-status ${complete ? "ready" : "pending"}">${complete ? "Menthető" : "Hiányos"}</span>
        </div>
        <div class="assembly-draft-resource-grid">
          <div class="assembly-draft-resource-row">
            <span class="assembly-draft-resource-label">👤 Gépjárművezető</span>
            <span class="assembly-draft-resource-value">${escapeHtml(soforLabel)}</span>
            <button type="button" class="assembly-draft-remove-btn" data-action="clear-resource" data-field="soforId">Törlés</button>
          </div>
          <div class="assembly-draft-resource-row">
            <span class="assembly-draft-resource-label">🚛 Vontató</span>
            <span class="assembly-draft-resource-value">${escapeHtml(vontatoLabel)}</span>
            <button type="button" class="assembly-draft-remove-btn" data-action="clear-resource" data-field="vontatoId">Törlés</button>
          </div>
          <div class="assembly-draft-resource-row">
            <span class="assembly-draft-resource-label">🚚 Pótkocsi</span>
            <span class="assembly-draft-resource-value">${escapeHtml(potkocsiLabel)}</span>
            <button type="button" class="assembly-draft-remove-btn" data-action="clear-resource" data-field="potkocsiId">Törlés</button>
          </div>
        </div>
        <div class="assembly-draft-actions">
          <button type="button" class="assembly-draft-secondary-btn" data-action="focus-fuvar">Fuvar fókusz</button>
          <button type="button" class="assembly-draft-secondary-btn" data-action="discard-draft">Tervezet törlése</button>
          <button type="button" class="assembly-draft-save-btn" data-action="save-draft" ${complete ? "" : "disabled"}>Szerelvény mentése</button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-action='clear-resource']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".assembly-draft-card");
      const fuvarId = card?.dataset.fuvarId;
      const field = button.dataset.field;
      if (!fuvarId || !field) {
        return;
      }

      updateDraftAssignmentField(fuvarId, field, null);
      rerenderCurrentAssemblyTimeline();
    });
  });

  list.querySelectorAll("[data-action='discard-draft']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".assembly-draft-card");
      const fuvarId = card?.dataset.fuvarId;
      if (!fuvarId) {
        return;
      }

      discardFuvarAssemblyDraft(fuvarId);
    });
  });

  list.querySelectorAll("[data-action='focus-fuvar']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".assembly-draft-card");
      const fuvarId = card?.dataset.fuvarId;
      if (!fuvarId) {
        return;
      }

      window.dispatchEvent(new CustomEvent("fuvar:focus", {
        detail: { fuvarId }
      }));
    });
  });

  list.querySelectorAll("[data-action='save-draft']").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".assembly-draft-card");
      const fuvarId = card?.dataset.fuvarId;
      if (!fuvarId) {
        return;
      }

      const result = saveDraftAssembly(fuvarId, soforok, vontatok, potkocsik);
      if (!result.ok && result.message) {
        alert(result.message);
      }
    });
  });

  container.appendChild(host);
}

function bindAssemblyBlockHoverTooltip(target, content) {
  if (!target || !content) {
    return;
  }

  target.addEventListener("mouseenter", (event) => {
    showAssemblyHoverTooltip(content, event.clientX, event.clientY);
  });

  target.addEventListener("mousemove", (event) => {
    showAssemblyHoverTooltip(content, event.clientX, event.clientY);
  });

  target.addEventListener("mouseleave", () => {
    hideAssemblyHoverTooltip();
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getAddressCoords(address) {
  const normalized = normalizeSearchText(address);
  if (!normalized) {
    return null;
  }

  const cityKey = Object.keys(ADDRESS_COORDS).find((key) => normalized.includes(key));
  return cityKey ? ADDRESS_COORDS[cityKey] : null;
}

function estimateAddressDistanceKm(addressA, addressB) {
  const coordsA = getAddressCoords(addressA);
  const coordsB = getAddressCoords(addressB);

  if (!coordsA || !coordsB) {
    return Number.POSITIVE_INFINITY;
  }

  return distanceKm(coordsA, coordsB);
}

function getImportPlanningCandidates() {
  const importFuvarok = FUVAROK.filter((fuvar) => {
    const category = fuvar?.kategoria || fuvar?.viszonylat;
    return category === "import" && Boolean(fuvar?.felrakas?.cim);
  });

  const actionable = importFuvarok.filter((fuvar) => {
    return !(fuvar?.assignedSoforId && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId);
  });

  return actionable.length > 0 ? actionable : importFuvarok;
}

function hasImportBlockWithinWindow(fuvarBlocks, exportEndMs) {
  return fuvarBlocks.some((block) => {
    if (block?.type !== "fuvar" || block?.synthetic || block?.kategoria !== "import") {
      return false;
    }

    const startMs = new Date(block.start).getTime();
    if (!Number.isFinite(startMs)) {
      return false;
    }

    return startMs >= exportEndMs && startMs <= exportEndMs + IMPORT_LINK_WINDOW_MS;
  });
}

function getAssemblyDropoffInsight(assembly, importCandidates) {
  const exportBlocks = (assembly?.fuvarBlocks || []).filter((block) => {
    return block?.type === "fuvar" && !block?.synthetic && block?.kategoria === "export";
  });

  if (exportBlocks.length === 0) {
    return null;
  }

  const unmatchedExports = exportBlocks.filter((block) => {
    const exportEndMs = new Date(block.end).getTime();
    if (!Number.isFinite(exportEndMs)) {
      return false;
    }

    return !hasImportBlockWithinWindow(assembly.fuvarBlocks || [], exportEndMs);
  });

  if (unmatchedExports.length === 0) {
    return null;
  }

  let bestDistanceKm = Number.POSITIVE_INFINITY;

  unmatchedExports.forEach((exportBlock) => {
    importCandidates.forEach((importFuvar) => {
      const distance = estimateAddressDistanceKm(exportBlock.lerakasCim, importFuvar?.felrakas?.cim);
      if (distance < bestDistanceKm) {
        bestDistanceKm = distance;
      }
    });
  });

  return {
    unmatchedExportCount: unmatchedExports.length,
    bestDistanceKm
  };
}

function buildAssemblyDropoffView(assemblies) {
  const importCandidates = getImportPlanningCandidates();
  const insightByAssemblyId = new Map();

  assemblies.forEach((assembly) => {
    const insight = getAssemblyDropoffInsight(assembly, importCandidates);
    if (!insight) {
      return;
    }

    insightByAssemblyId.set(assembly.id, insight);
  });

  return {
    insightByAssemblyId,
    totalMatched: insightByAssemblyId.size
  };
}

export function setAssemblyTimelineWindowDayOffset(dayOffset = 0) {
  const normalizedOffset = Number.isInteger(dayOffset) ? dayOffset : 0;
  assemblyTimelineOffsetHours = normalizedOffset * 24;
}

function getFuvarPickupDate(fuvarId) {
  if (!fuvarId) {
    return null;
  }

  const fuvar = FUVAROK.find((item) => item.id === fuvarId);
  const pickupIso = fuvar?.felrakas?.ido;
  if (!pickupIso) {
    return null;
  }

  const pickupDate = new Date(pickupIso);
  return Number.isFinite(pickupDate.getTime()) ? pickupDate : null;
}

function getAssemblyWindowDayOffsetForDate(targetDate) {
  const diffHours = (targetDate.getTime() - getBaseDate().getTime()) / (1000 * 60 * 60);
  return Math.floor(diffHours / 24);
}

function getAssemblyScrollTargetPx(targetDate, container) {
  const diffHours = (targetDate.getTime() - getWindowStartDate().getTime()) / (1000 * 60 * 60);
  const targetX = diffHours * HOUR_WIDTH;
  const desiredLeft = targetX - (container.clientWidth * 0.35);
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  return Math.max(0, Math.min(desiredLeft, maxScroll));
}

function focusAssemblyTimelinesToFuvarPickup(fuvarId) {
  const pickupDate = getFuvarPickupDate(fuvarId);
  if (!pickupDate) {
    rerenderCurrentAssemblyTimeline();
    return;
  }

  const windowStart = getWindowStartDate();
  const windowEnd = getWindowEndDate();
  if (pickupDate < windowStart || pickupDate >= windowEnd) {
    assemblyTimelineOffsetHours = getAssemblyWindowDayOffsetForDate(pickupDate) * 24;
  }

  rerenderCurrentAssemblyTimeline();

  requestAnimationFrame(() => {
    assemblyRenderStates.forEach((renderState) => {
      const mode = renderState?.options?.mode || assemblyViewMode;
      if (mode === "list") {
        return;
      }

      const container = document.getElementById(renderState.containerId);
      if (!container) {
        return;
      }

      container.scrollLeft = getAssemblyScrollTargetPx(pickupDate, container);
    });
  });
}

window.addEventListener("fuvar:focus", (event) => {
  focusedFuvarId = event?.detail?.fuvarId || null;
  focusAssemblyTimelinesToFuvarPickup(focusedFuvarId);
});

window.addEventListener("assembly:focus", (event) => {
  focusedAssemblyId = event?.detail?.assemblyId || null;
  rerenderCurrentAssemblyTimeline();
});

function getFocusedImportFuvar() {
  if (!focusedFuvarId) {
    return null;
  }

  const focused = FUVAROK.find((item) => item.id === focusedFuvarId) || null;
  if (!focused) {
    return null;
  }

  const category = focused?.kategoria || focused?.viszonylat;
  return category === "import" ? focused : null;
}

function formatSignedHours(hours) {
  if (!Number.isFinite(hours)) {
    return "n/a";
  }

  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours);
  const rounded = Math.round(abs * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(".", ",");
  return `${sign}${text} óra`;
}

function formatDistanceKm(km) {
  if (!Number.isFinite(km)) {
    return "n/a";
  }

  if (km < 10) {
    return `${String(Math.round(km * 10) / 10).replace(".", ",")} km`;
  }

  return `${Math.round(km)} km`;
}

function formatCompactAssemblyTime(dateStr) {
  const date = new Date(dateStr);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCompactAssemblyLocation(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "-";
  }

  const first = normalizeSearchText(parts[0]);
  if ((first.includes("magyarorszag") || first.includes("hungary")) && parts[1]) {
    return parts[1];
  }

  return parts[0];
}

function getAssemblyRouteForBlock(block) {
  const linkedFuvar = findFuvarByBlock(block);
  const pickupAddress = block?.felrakasCim || linkedFuvar?.felrakas?.cim || "";
  const dropoffAddress = block?.lerakasCim || linkedFuvar?.lerakas?.cim || "";

  return {
    pickup: getCompactAssemblyLocation(pickupAddress),
    dropoff: getCompactAssemblyLocation(dropoffAddress)
  };
}

function getExportImportProximityHint(block, focusedImportFuvar) {
  if (!focusedImportFuvar || block?.type !== "fuvar" || block?.kategoria !== "export") {
    return null;
  }

  const blockFuvar = findFuvarByBlock(block);
  const exportDropoffAddress = block?.lerakasCim || blockFuvar?.lerakas?.cim || "";
  const importPickupAddress = focusedImportFuvar?.felrakas?.cim || "";
  const distance = estimateAddressDistanceKm(exportDropoffAddress, importPickupAddress);

  const exportEndMs = new Date(block.end).getTime();
  const importPickupMs = new Date(focusedImportFuvar?.felrakas?.ido || "").getTime();
  const deltaHours = Number.isFinite(exportEndMs) && Number.isFinite(importPickupMs)
    ? (importPickupMs - exportEndMs) / (1000 * 60 * 60)
    : Number.NaN;

  return {
    distance,
    deltaHours
  };
}

const ASSEMBLY_FUVAR_REVENUE_PER_KM = 420;
const ASSEMBLY_FUVAR_COST_PER_KM = 255;

function getAssemblyBlockDistanceKm(block) {
  if (Number.isFinite(block?.tavolsagKm)) {
    return Number(block.tavolsagKm);
  }

  const fuvar = findFuvarByBlock(block);
  if (Number.isFinite(fuvar?.tavolsag_km)) {
    return Number(fuvar.tavolsag_km);
  }

  const distance = estimateAddressDistanceKm(block?.felrakasCim || "", block?.lerakasCim || "");
  return Number.isFinite(distance) ? Math.round(distance) : Number.NaN;
}

function formatMoneyHuf(value) {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `${safe.toLocaleString("hu-HU")} Ft`;
}

function isAssemblyKornyeAddress(address) {
  return normalizeSearchText(address).includes("kornye");
}

function getAssemblyBlockPickupAddress(block) {
  const linkedFuvar = findFuvarByBlock(block);
  return block?.felrakasCim || linkedFuvar?.felrakas?.cim || "";
}

function getAssemblyBlockDropoffAddress(block) {
  const linkedFuvar = findFuvarByBlock(block);
  return block?.lerakasCim || linkedFuvar?.lerakas?.cim || "";
}

function isAssemblyFuvarBlock(block) {
  return block?.type === "fuvar";
}

function getAssemblyEmptyReturnArrivalEvents(assembly) {
  if (!assembly?.sofor || !assembly?.vontato || assembly?.potkocsi) {
    return [];
  }

  return (assembly.vontato?.timeline || [])
    .filter((block) => {
      if (!block || block.type !== "rezsifutas") {
        return false;
      }

      if (!block.autoReturnToHub) {
        return false;
      }

      const returnAddress = block?.toAddress || block?.lerakasCim || "";
      if (!isAssemblyKornyeAddress(returnAddress)) {
        return false;
      }

      // Üres visszaérkezésnek tekintjük, ha nincs hozzárendelt következő fuvar.
      return !block?.targetFuvarId;
    })
    .map((block) => {
      return {
        ...block,
        __eventTime: new Date(block.end).getTime()
      };
    })
    .filter((block) => Number.isFinite(block.__eventTime))
    .sort((left, right) => left.__eventTime - right.__eventTime);
}

function buildAssemblyJaratSegments(fuvarBlocks, assembly = null) {
  const ordered = (fuvarBlocks || [])
    .filter((block) => isAssemblyFuvarBlock(block))
    .slice()
    .sort((left, right) => new Date(left.start) - new Date(right.start));
  const emptyReturnEvents = getAssemblyEmptyReturnArrivalEvents(assembly);

  const timelineEvents = [
    ...ordered.map((block) => {
      return {
        kind: "fuvar",
        time: new Date(block.start).getTime(),
        block
      };
    }),
    ...emptyReturnEvents.map((block) => {
      return {
        kind: "emptyReturn",
        time: block.__eventTime,
        block
      };
    })
  ]
    .filter((eventItem) => Number.isFinite(eventItem.time))
    .sort((left, right) => {
      if (left.time !== right.time) {
        return left.time - right.time;
      }

      if (left.kind === right.kind) {
        return 0;
      }

      // Azonos időpontnál először zárjon az üres visszaérkezés, majd induljon új fuvar.
      return left.kind === "emptyReturn" ? -1 : 1;
    });

  const segments = [];
  let activeSegment = null;
  let jaratCounter = 0;

  timelineEvents.forEach((eventItem) => {
    if (eventItem.kind === "emptyReturn") {
      if (!activeSegment) {
        return;
      }

      activeSegment.status = "lezart";
      activeSegment.end = eventItem.block.end;
      activeSegment.closedBy = "ures-visszaerkezes";
      activeSegment.closingEvent = eventItem.block;
      segments.push(activeSegment);
      activeSegment = null;
      return;
    }

    const block = eventItem.block;
    const pickupAddress = getAssemblyBlockPickupAddress(block);
    const dropoffAddress = getAssemblyBlockDropoffAddress(block);

    if (!activeSegment) {
      if (!isAssemblyKornyeAddress(pickupAddress)) {
        return;
      }

      jaratCounter += 1;
      activeSegment = {
        jaratId: `JR-${jaratCounter}`,
        status: "nyitott",
        start: block.start,
        end: block.end,
        blocks: [block]
      };

      if (isAssemblyKornyeAddress(dropoffAddress)) {
        activeSegment.status = "lezart";
        activeSegment.closedBy = "kornye-lerakas";
        segments.push(activeSegment);
        activeSegment = null;
      }

      return;
    }

    activeSegment.blocks.push(block);
    activeSegment.end = block.end;

    if (isAssemblyKornyeAddress(dropoffAddress)) {
      activeSegment.status = "lezart";
      activeSegment.closedBy = "kornye-lerakas";
      segments.push(activeSegment);
      activeSegment = null;
    }
  });

  if (activeSegment) {
    segments.push(activeSegment);
  }

  return segments;
}

function buildAssemblyCompletedJaratInfo(fuvarBlocks, assembly = null) {
  const byBlock = new Map();
  const summaries = [];
  const segments = buildAssemblyJaratSegments(fuvarBlocks, assembly);

  segments.forEach((segment) => {
    if (segment.status !== "lezart") {
      return;
    }

    segment.blocks.forEach((segmentBlock) => {
      byBlock.set(segmentBlock, { jaratId: segment.jaratId });
    });

    summaries.push({
      jaratId: segment.jaratId,
      blockCount: segment.blocks.length,
      end: segment.end,
      start: segment.start,
      status: segment.status,
      closedBy: segment.closedBy || "kornye-lerakas"
    });
  });

  return {
    byBlock,
    summaries,
    segments
  };
}

function buildAssemblyBlockTooltip(block, jaratMeta = null) {
  const distanceKm = getAssemblyBlockDistanceKm(block);
  const revenue = Number.isFinite(distanceKm) ? distanceKm * ASSEMBLY_FUVAR_REVENUE_PER_KM : 0;
  const cost = Number.isFinite(distanceKm) ? distanceKm * ASSEMBLY_FUVAR_COST_PER_KM : 0;
  const profit = revenue - cost;
  const distanceLabel = Number.isFinite(distanceKm) ? `${Math.round(distanceKm)} km` : "n/a";

  const route = getAssemblyRouteForBlock(block);
  const linkedFuvar = findFuvarByBlock(block);
  const transitRoleInfo = getDomesticTransitRoleInfo(linkedFuvar);

  const lines = [
    `${route.pickup} → ${route.dropoff}`,
    `${formatDate(block.start)} → ${formatDate(block.end)}`,
    `Táv: ${distanceLabel}`,
    `Bevétel: ${formatMoneyHuf(revenue)}`,
    `Költség: ${formatMoneyHuf(cost)}`,
    `Eredményesség: ${formatMoneyHuf(profit)}`
  ];

  if (transitRoleInfo?.label) {
    lines.splice(1, 0, `Kapcsolt szakasz: ${transitRoleInfo.label}`);
  }

  if (jaratMeta?.jaratId) {
    lines.push(`Kész járat: ${jaratMeta.jaratId}`);
  }

  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

function getBaseDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWindowStartDate() {
  return addHours(getBaseDate(), assemblyTimelineOffsetHours);
}

function getWindowEndDate() {
  return addHours(getWindowStartDate(), TIMELINE_HOURS);
}

function formatWindowLabel(start, end) {
  const f = (d) => d.toLocaleString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${f(start)} - ${f(end)}`;
}

function getDefaultSearchAddress(block) {
  return block?.lerakasCim || block?.felrakasCim || "";
}

function openGoogleAddressSearch(query) {
  const trimmed = String(query || "").trim();
  const url = trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : "https://www.google.com/maps";

  window.open(url, "_blank", "noopener,noreferrer");
}

async function fetchAddressSuggestions(query, signal) {
  const q = String(query || "").trim();
  if (q.length < ADDRESS_AUTOCOMPLETE_MIN_CHARS) {
    return [];
  }

  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=hu,it,de,at,cz&q=${encodeURIComponent(q)}`;

  const response = await fetch(endpoint, {
    signal,
    headers: {
      Accept: "application/json",
      "Accept-Language": "hu"
    }
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item) => ({
    label: item.display_name || "",
    lat: Number(item.lat),
    lon: Number(item.lon)
  })).filter((item) => item.label);
}

function attachAddressAutocomplete(input) {
  if (!input || !input.parentElement) {
    return;
  }

  const host = document.createElement("div");
  host.className = "assembly-address-autocomplete";
  input.insertAdjacentElement("afterend", host);

  let debounceTimer = null;
  let fetchToken = 0;
  let suggestions = [];
  let highlightedIndex = -1;

  const hide = () => {
    host.classList.remove("open");
    host.innerHTML = "";
    highlightedIndex = -1;
  };

  const applySelection = (item) => {
    if (!item?.label) {
      return;
    }

    input.value = item.label;
    hide();
  };

  const renderSuggestions = () => {
    if (!suggestions.length) {
      hide();
      return;
    }

    host.innerHTML = suggestions.map((item, index) => {
      const activeClass = highlightedIndex === index ? "active" : "";
      return `<button type="button" class="assembly-address-suggestion ${activeClass}" data-index="${index}">${escapeHtml(item.label)}</button>`;
    }).join("");

    host.classList.add("open");

    host.querySelectorAll(".assembly-address-suggestion").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        const selected = Number.isFinite(index) ? suggestions[index] : null;
        applySelection(selected);
      });
    });
  };

  const runSearch = async () => {
    const query = String(input.value || "").trim();
    if (query.length < ADDRESS_AUTOCOMPLETE_MIN_CHARS) {
      suggestions = [];
      hide();
      return;
    }

    fetchToken += 1;
    const currentToken = fetchToken;

    try {
      suggestions = await fetchAddressSuggestions(query);
      if (currentToken !== fetchToken) {
        return;
      }

      highlightedIndex = suggestions.length > 0 ? 0 : -1;
      renderSuggestions();
    } catch (_error) {
      if (currentToken !== fetchToken) {
        return;
      }

      suggestions = [];
      hide();
    }
  };

  input.addEventListener("input", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      runSearch();
    }, ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (event) => {
    if (!suggestions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % suggestions.length;
      renderSuggestions();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      highlightedIndex = highlightedIndex <= 0 ? suggestions.length - 1 : highlightedIndex - 1;
      renderSuggestions();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      applySelection(suggestions[highlightedIndex] || suggestions[0]);
      return;
    }

    if (event.key === "Escape") {
      hide();
    }
  });

  input.addEventListener("focus", () => {
    if (suggestions.length) {
      host.classList.add("open");
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      hide();
    }, 120);
  });
}

function dateToPosition(dateStr) {
  const base = getWindowStartDate();
  const t = new Date(dateStr);
  const diffHours = (t - base) / (1000 * 60 * 60);
  return diffHours * HOUR_WIDTH;
}

function blockWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = (e - s) / (1000 * 60 * 60);
  return Math.max(24, diff * HOUR_WIDTH);
}

function clipBlockToWindow(block) {
  const windowStart = getWindowStartDate();
  const windowEnd = getWindowEndDate();
  const start = new Date(block.start);
  const end = new Date(block.end);

  if (end <= windowStart || start >= windowEnd) {
    return null;
  }

  return {
    ...block,
    renderStart: start < windowStart ? windowStart.toISOString() : block.start,
    renderEnd: end > windowEnd ? windowEnd.toISOString() : block.end
  };
}

function renderTimeScale(container) {
  const header = document.createElement("div");
  header.className = "timeline-timescale assembly-timescale";
  header.style.position = "relative";
  header.style.height = "40px";
  header.style.width = TIMELINE_WIDTH + "px";
  header.style.borderBottom = "1px solid #555";

  const base = getWindowStartDate();

  for (let h = 0; h <= TIMELINE_HOURS; h += 1) {
    const line = document.createElement("div");
    line.style.position = "absolute";
    line.style.left = (h * HOUR_WIDTH) + "px";
    line.style.top = "0px";
    line.style.width = "1px";
    line.style.height = "40px";
    line.style.background = (h % 4 === 0) ? "#777" : "#444";
    header.appendChild(line);

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

function getFuvarBlocks(resource) {
  return (resource?.timeline || [])
    .filter((block) => block.type === "fuvar" && !block.synthetic);
}

function collectAssemblyFuvarBlocks(vontato, sofor, potkocsi) {
  const keyed = new Map();

  [vontato, sofor, potkocsi].forEach((resource) => {
    getFuvarBlocks(resource).forEach((block) => {
      const key = block.fuvarId || `${block.label}|${block.start}|${block.end}`;

      if (!keyed.has(key)) {
        keyed.set(key, block);
      }
    });
  });

  return Array.from(keyed.values()).sort((a, b) => {
    return new Date(a.start) - new Date(b.start);
  });
}

function resolveLinkedSofor(vontato, soforok) {
  return soforok.find((s) => {
    return s.id === vontato.linkedSoforId || s.linkedVontatoId === vontato.id;
  }) || null;
}

function resolveLinkedPotkocsi(vontato, potkocsik) {
  return potkocsik.find((p) => {
    return p.id === vontato.linkedPotkocsiId || p.linkedVontatoId === vontato.id;
  }) || null;
}

function findFuvarByBlock(block) {
  if (!block) {
    return null;
  }

  if (block.fuvarId) {
    return FUVAROK.find((item) => item.id === block.fuvarId) || null;
  }

  return FUVAROK.find((item) => {
    return item.megnevezes === block.label
      && item.felrakas?.ido === block.start
      && item.lerakas?.ido === block.end;
  }) || null;
}

function getFuvarCategoryFromFuvar(fuvar) {
  return fuvar?.kategoria || fuvar?.viszonylat || "";
}

function findFuvarById(fuvarId) {
  if (!fuvarId) {
    return null;
  }

  return FUVAROK.find((item) => item.id === fuvarId) || null;
}

function getLinkedImportFuvarForDomestic(domesticFuvar) {
  if (!domesticFuvar || getFuvarCategoryFromFuvar(domesticFuvar) !== "belfold") {
    return null;
  }

  const directLinkedImportId = domesticFuvar.utofutasImportFuvarId || domesticFuvar.kapcsoltImportFuvarId || null;
  const directLinkedImport = findFuvarById(directLinkedImportId);
  if (directLinkedImport && getFuvarCategoryFromFuvar(directLinkedImport) === "import") {
    return directLinkedImport;
  }

  return FUVAROK.find((candidate) => {
    return getFuvarCategoryFromFuvar(candidate) === "import"
      && candidate?.utofutasBelfoldFuvarId === domesticFuvar.id;
  }) || null;
}

function getLinkedExportFuvarForDomestic(domesticFuvar) {
  if (!domesticFuvar || getFuvarCategoryFromFuvar(domesticFuvar) !== "belfold") {
    return null;
  }

  const directLinkedExportId = domesticFuvar.elofutasExportFuvarId || domesticFuvar.kapcsoltExportFuvarId || null;
  const directLinkedExport = findFuvarById(directLinkedExportId);
  if (directLinkedExport && getFuvarCategoryFromFuvar(directLinkedExport) === "export") {
    return directLinkedExport;
  }

  return FUVAROK.find((candidate) => {
    return getFuvarCategoryFromFuvar(candidate) === "export"
      && candidate?.elofutasBelfoldFuvarId === domesticFuvar.id;
  }) || null;
}

function getDomesticTransitRoleInfo(fuvar) {
  if (!fuvar || getFuvarCategoryFromFuvar(fuvar) !== "belfold") {
    return null;
  }

  const linkedExportFuvar = getLinkedExportFuvarForDomestic(fuvar);
  if (linkedExportFuvar) {
    return {
      role: "elofutas",
      label: `Előfutás • ${linkedExportFuvar.id}`
    };
  }

  const linkedImportFuvar = getLinkedImportFuvarForDomestic(fuvar);
  if (linkedImportFuvar) {
    return {
      role: "utofutas",
      label: `Utófutás • ${linkedImportFuvar.id}`
    };
  }

  return null;
}

function getLifecycleNeighbors(fuvar) {
  if (!fuvar) {
    return [];
  }

  const category = getFuvarCategoryFromFuvar(fuvar);
  if (category === "belfold") {
    const linkedExport = getLinkedExportFuvarForDomestic(fuvar);
    const linkedImport = getLinkedImportFuvarForDomestic(fuvar);
    return [linkedExport, linkedImport].filter(Boolean);
  }

  if (category === "export") {
    const linkedDomesticId = fuvar.elofutasBelfoldFuvarId || "";
    const linkedDomestic = findFuvarById(linkedDomesticId);
    return linkedDomestic ? [linkedDomestic] : [];
  }

  if (category === "import") {
    const linkedDomesticId = fuvar.utofutasBelfoldFuvarId || "";
    const linkedDomestic = findFuvarById(linkedDomesticId);
    return linkedDomestic ? [linkedDomestic] : [];
  }

  return [];
}

function buildFocusedLifecycleFuvarIdSet() {
  const focusedFuvar = findFuvarById(focusedFuvarId);
  if (!focusedFuvar) {
    return new Set();
  }

  const visited = new Set();
  const queue = [focusedFuvar];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) {
      continue;
    }

    visited.add(current.id);
    getLifecycleNeighbors(current).forEach((neighbor) => {
      if (neighbor && !visited.has(neighbor.id)) {
        queue.push(neighbor);
      }
    });
  }

  return visited;
}

function assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds) {
  if (!assembly || !lifecycleFuvarIds || lifecycleFuvarIds.size === 0) {
    return false;
  }

  return (assembly.fuvarBlocks || []).some((block) => {
    return block?.fuvarId && lifecycleFuvarIds.has(block.fuvarId);
  });
}

function isFinishedFuvarBlock(block) {
  if (!block?.end) {
    return false;
  }

  return new Date(block.end) <= new Date();
}

function removeFuvarBlocksForResource(resource, fuvarId) {
  if (!resource?.timeline) {
    return;
  }

  resource.timeline = resource.timeline.filter((timelineBlock) => {
    return !(timelineBlock.type === "fuvar" && !timelineBlock.synthetic && timelineBlock.fuvarId === fuvarId);
  });
}

function removeFuvarBlocksFromAllResources(fuvarId, soforok, vontatok, potkocsik) {
  soforok.forEach((resource) => removeFuvarBlocksForResource(resource, fuvarId));
  vontatok.forEach((resource) => removeFuvarBlocksForResource(resource, fuvarId));
  potkocsik.forEach((resource) => removeFuvarBlocksForResource(resource, fuvarId));
}

function saveFuvarAssignment(fuvar, assignment) {
  if (assignment.soforId) fuvar.assignedSoforId = assignment.soforId;
  else delete fuvar.assignedSoforId;

  if (assignment.vontatoId) fuvar.assignedVontatoId = assignment.vontatoId;
  else delete fuvar.assignedVontatoId;

  if (assignment.potkocsiId) fuvar.assignedPotkocsiId = assignment.potkocsiId;
  else delete fuvar.assignedPotkocsiId;
}

function canAssignFuvarToResource(resource, fuvar) {
  if (!resource || !fuvar) {
    return false;
  }

  const timelineWithoutCurrentFuvar = (resource.timeline || []).filter((timelineBlock) => {
    return !(timelineBlock.type === "fuvar" && timelineBlock.fuvarId === fuvar.id);
  });

  return !hasCollision(timelineWithoutCurrentFuvar, fuvar.felrakas.ido, fuvar.lerakas.ido);
}

function isAssemblyAvailableForFuvar(assembly, fuvar) {
  if (!assembly || !fuvar) {
    return false;
  }

  // Elérhető szerelvénynek csak a teljes (gépjárművezető + vontató + pótkocsi) kombinációt tekintjük.
  if (!assembly.sofor || !assembly.vontato || !assembly.potkocsi) {
    return false;
  }

  return canAssignFuvarToResource(assembly.sofor, fuvar)
    && canAssignFuvarToResource(assembly.vontato, fuvar)
    && canAssignFuvarToResource(assembly.potkocsi, fuvar);
}

function applyFuvarAssignment(fuvar, assignment, soforok, vontatok, potkocsik) {
  removeFuvarBlocksFromAllResources(fuvar.id, soforok, vontatok, potkocsik);
  saveFuvarAssignment(fuvar, assignment);

  if (assignment.soforId) {
    const sofor = soforok.find((item) => item.id === assignment.soforId);
    if (sofor) {
      addFuvarBlockToTimeline(sofor, fuvar);
    }
  }

  if (assignment.vontatoId) {
    const vontato = vontatok.find((item) => item.id === assignment.vontatoId);
    if (vontato) {
      addFuvarBlockToTimeline(vontato, fuvar);
    }
  }

  if (assignment.potkocsiId) {
    const potkocsi = potkocsik.find((item) => item.id === assignment.potkocsiId);
    if (potkocsi) {
      addFuvarBlockToTimeline(potkocsi, fuvar);
    }
  }

  soforok.forEach((sofor) => {
    refreshAutoTransitBlocksForResource(sofor, FUVAROK);
  });

  vontatok.forEach((vontato) => {
    refreshAutoTransitBlocksForResource(vontato, FUVAROK);
  });

  potkocsik.forEach((potkocsi) => {
    refreshAutoTransitBlocksForResource(potkocsi, FUVAROK);
  });

  refreshAutoDriverStatesForLinkedConvoys(soforok, vontatok, potkocsik);
}

function unlinkPotkocsi(potkocsi, vontatok) {
  if (!potkocsi?.linkedVontatoId) {
    return;
  }

  const currentVontato = vontatok.find((item) => item.id === potkocsi.linkedVontatoId);
  if (currentVontato && currentVontato.linkedPotkocsiId === potkocsi.id) {
    delete currentVontato.linkedPotkocsiId;
  }

  delete potkocsi.linkedVontatoId;
}

function unlinkVontatoPotkocsi(vontato, potkocsik) {
  if (!vontato?.linkedPotkocsiId) {
    return;
  }

  const currentPotkocsi = potkocsik.find((item) => item.id === vontato.linkedPotkocsiId);
  if (currentPotkocsi && currentPotkocsi.linkedVontatoId === vontato.id) {
    delete currentPotkocsi.linkedVontatoId;
  }

  delete vontato.linkedPotkocsiId;
}

function linkPotkocsiToVontato(potkocsi, vontato, potkocsik, vontatok) {
  unlinkPotkocsi(potkocsi, vontatok);
  unlinkVontatoPotkocsi(vontato, potkocsik);

  potkocsi.linkedVontatoId = vontato.id;
  vontato.linkedPotkocsiId = potkocsi.id;
}

function unlinkSofor(sofor, vontatok) {
  if (!sofor?.linkedVontatoId) {
    return;
  }

  const currentVontato = vontatok.find((item) => item.id === sofor.linkedVontatoId);
  if (currentVontato && currentVontato.linkedSoforId === sofor.id) {
    delete currentVontato.linkedSoforId;
  }

  delete sofor.linkedVontatoId;
}

function unlinkVontatoSofor(vontato, soforok) {
  if (!vontato?.linkedSoforId) {
    return;
  }

  const currentSofor = soforok.find((item) => item.id === vontato.linkedSoforId);
  if (currentSofor && currentSofor.linkedVontatoId === vontato.id) {
    delete currentSofor.linkedVontatoId;
  }

  delete vontato.linkedSoforId;
}

function linkSoforToVontato(sofor, vontato, soforok, vontatok) {
  unlinkSofor(sofor, vontatok);
  unlinkVontatoSofor(vontato, soforok);

  sofor.linkedVontatoId = vontato.id;
  vontato.linkedSoforId = sofor.id;
}

function closeAssemblyContextMenu() {
  if (!openAssemblyContextMenu) {
    return;
  }

  openAssemblyContextMenu.remove();
  openAssemblyContextMenu = null;
}

function closeAssemblyOperationModal() {
  if (!openAssemblyOperationModal) {
    return;
  }

  openAssemblyOperationModal.remove();
  openAssemblyOperationModal = null;
}

function closeJaratInfoModal() {
  if (!openJaratInfoModal) {
    return;
  }

  openJaratInfoModal.remove();
  openJaratInfoModal = null;
}

function buildJaratSummaryData(segment, assembly) {
  const fuvarKm = segment.blocks.reduce((sum, block) => {
    const km = getAssemblyBlockDistanceKm(block);
    return Number.isFinite(km) ? sum + km : sum;
  }, 0);

  const segmentStartMs = new Date(segment.start).getTime();
  const segmentEndMs = new Date(segment.end).getTime();

  const rezsiKm = (assembly?.vontato?.timeline || [])
    .filter((block) => {
      if (!block || block.type !== "rezsifutas") {
        return false;
      }
      const blockStartMs = new Date(block.start).getTime();
      const blockEndMs = new Date(block.end).getTime();
      return blockStartMs >= segmentStartMs && blockEndMs <= segmentEndMs;
    })
    .reduce((sum, block) => {
      const km = getAssemblyBlockDistanceKm(block);
      return Number.isFinite(km) ? sum + km : sum;
    }, 0);

  const revenue = Math.round(fuvarKm * ASSEMBLY_FUVAR_REVENUE_PER_KM);
  const cost = Math.round((fuvarKm + rezsiKm) * ASSEMBLY_FUVAR_COST_PER_KM);
  const profit = revenue - cost;

  return { fuvarKm, rezsiKm, revenue, cost, profit };
}

function openJaratInfoModalForSegment(segment, assembly) {
  closeJaratInfoModal();

  const host = document.createElement("div");
  host.className = "timeline-event-form-overlay assembly-op-overlay jarat-info-overlay";

  const soforName = assembly?.sofor?.nev || "nincs";
  const vontatoRendszam = assembly?.vontato?.rendszam || "nincs";
  const potkocsiRendszam = assembly?.potkocsi?.rendszam || "nincs";

  const summary = buildJaratSummaryData(segment, assembly);
  const statusMeta = getJaratStatusMeta(segment.status);

  const fuvarBlockRows = segment.blocks.map((block) => {
    const route = getAssemblyRouteForBlock(block);
    const km = getAssemblyBlockDistanceKm(block);
    const kmLabel = Number.isFinite(km) ? `${Math.round(km)} km` : "n/a";
    return `<tr>
      <td>${escapeHtml(route.pickup)} → ${escapeHtml(route.dropoff)}</td>
      <td>${escapeHtml(formatDate(block.start))} – ${escapeHtml(formatDate(block.end))}</td>
      <td>${kmLabel}</td>
    </tr>`;
  }).join("");

  const profitClass = summary.profit >= 0 ? "jarat-info-profit-pos" : "jarat-info-profit-neg";

  host.innerHTML = `
    <div class="timeline-event-form assembly-op-form jarat-info-modal" role="dialog" aria-modal="true" aria-label="Járat részletek">
      <div class="timeline-event-form-title">🧭 ${escapeHtml(segment.jaratId)} – Járat részletek <span class="jarat-status-chip ${segment.status === "lezart" ? "done" : "pending"}">${escapeHtml(statusMeta.label)}</span></div>

      <div class="jarat-info-section">
        <div class="jarat-info-row"><span class="jarat-info-label">🚛 Vontató:</span> <span>${escapeHtml(vontatoRendszam)}</span></div>
        <div class="jarat-info-row"><span class="jarat-info-label">🚚 Pótkocsi:</span> <span>${escapeHtml(potkocsiRendszam)}</span></div>
        <div class="jarat-info-row"><span class="jarat-info-label">👤 Gépjárművezető:</span> <span>${escapeHtml(soforName)}</span></div>
        <div class="jarat-info-row"><span class="jarat-info-label">📅 Időszak:</span> <span>${escapeHtml(formatDate(segment.start))} → ${escapeHtml(formatDate(segment.end))}</span></div>
      </div>

      <div class="jarat-info-section">
        <div class="jarat-info-section-title">Fuvarlábak (${segment.blocks.length} db)</div>
        <table class="jarat-info-table">
          <thead><tr><th>Útvonal</th><th>Időszak</th><th>Táv</th></tr></thead>
          <tbody>${fuvarBlockRows}</tbody>
        </table>
      </div>

      <div class="jarat-info-section jarat-info-metrics">
        <div class="jarat-info-metric"><span class="jarat-info-label">📦 Fuvarral megtett km:</span> <strong>${Math.round(summary.fuvarKm)} km</strong></div>
        <div class="jarat-info-metric"><span class="jarat-info-label">↩️ Rezsifutás km:</span> <strong>${Math.round(summary.rezsiKm)} km</strong></div>
        <div class="jarat-info-metric"><span class="jarat-info-label">💰 Bevétel:</span> <strong>${formatMoneyHuf(summary.revenue)}</strong></div>
        <div class="jarat-info-metric"><span class="jarat-info-label">💸 Költség:</span> <strong>${formatMoneyHuf(summary.cost)}</strong></div>
        <div class="jarat-info-metric ${profitClass}"><span class="jarat-info-label">📊 Haszon:</span> <strong>${formatMoneyHuf(summary.profit)}</strong></div>
      </div>

      <div class="timeline-event-form-actions">
        <button type="button" class="timeline-event-form-cancel" data-action="close">Bezárás</button>
      </div>
    </div>
  `;

  document.body.appendChild(host);
  openJaratInfoModal = host;

  host.querySelector('[data-action="close"]').addEventListener("click", closeJaratInfoModal);
  host.addEventListener("click", (event) => {
    if (event.target === host) {
      closeJaratInfoModal();
    }
  });

  const closeOnEsc = (event) => {
    if (event.key === "Escape") {
      closeJaratInfoModal();
      document.removeEventListener("keydown", closeOnEsc);
    }
  };
  document.addEventListener("keydown", closeOnEsc);
}

function closeAssemblyTransientUi() {
  closeAssemblyContextMenu();
  closeAssemblyOperationModal();
  closeJaratInfoModal();
}

function bindAssemblyTransientHandlers() {
  if (transientHandlersBound) {
    return;
  }

  document.addEventListener("click", () => {
    closeAssemblyContextMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAssemblyTransientUi();
    }
  });

  transientHandlersBound = true;
}

function emitAssemblyResourceChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent("assembly:resources:changed", {
    detail
  }));
}

function rerenderCurrentAssemblyTimeline() {
  if (assemblyRenderStates.size === 0) {
    return;
  }

  Array.from(assemblyRenderStates.values()).forEach((renderState) => {
    renderSzerelvenyTimeline(
      renderState.containerId,
      renderState.soforok,
      renderState.vontatok,
      renderState.potkocsik,
      renderState.options
    );
  });
}

function addOperationHistory(fuvar, operationType, payload) {
  if (!fuvar) {
    return;
  }

  if (!Array.isArray(fuvar.resourceOperations)) {
    fuvar.resourceOperations = [];
  }

  fuvar.resourceOperations.push({
    id: `OP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: operationType,
    at: new Date().toISOString(),
    ...payload
  });
}

function formatOperationTypeLabel(type) {
  if (type === "elakasztas") {
    return "Elakasztás";
  }

  if (type === "eroforras-tores") {
    return "Erőforrás törés";
  }

  return type || "Művelet";
}

export function getAssemblyOperationLogEntries(limit = 80) {
  const entries = [];

  FUVAROK.forEach((fuvar) => {
    const operations = Array.isArray(fuvar.resourceOperations) ? fuvar.resourceOperations : [];
    operations.forEach((operation) => {
      entries.push({
        ...operation,
        typeLabel: formatOperationTypeLabel(operation.type),
        fuvarId: fuvar.id,
        fuvarMegnevezes: fuvar.megnevezes
      });
    });
  });

  return entries
    .sort((left, right) => {
      return new Date(right.at) - new Date(left.at);
    })
    .slice(0, Math.max(1, Number(limit) || 80));
}

function buildAssemblyLabel(assembly) {
  const soforName = assembly.sofor?.nev || "nincs gépjárművezető";
  return `${assembly.vontato.rendszam} • ${soforName}`;
}

function showAssemblyContextMenu(event, actions) {
  closeAssemblyContextMenu();

  const menu = document.createElement("div");
  menu.className = "timeline-context-menu assembly-context-menu";

  actions.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-context-menu-item";
    btn.textContent = item.label;

    if (item.disabled) {
      btn.disabled = true;
      btn.classList.add("disabled");
    } else {
      btn.addEventListener("click", () => {
        closeAssemblyContextMenu();
        item.action();
      });
    }

    menu.appendChild(btn);
  });

  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;

  document.body.appendChild(menu);
  openAssemblyContextMenu = menu;
}

function openElakasztasModal(currentAssembly, block, soforok, vontatok, potkocsik) {
  closeAssemblyOperationModal();

  const fuvar = findFuvarByBlock(block);
  if (!fuvar) {
    alert("A kiválasztott fuvar nem található.");
    return;
  }

  const allAssemblies = buildAssemblies(soforok, vontatok, potkocsik)
    .filter((assembly) => assembly.id !== currentAssembly.id)
    .filter((assembly) => Boolean(assembly.sofor && assembly.potkocsi));

  if (allAssemblies.length === 0) {
    alert("Nincs másik teljes (gépjárművezető + vontató + pótkocsi) szerelvény az elakasztáshoz.");
    return;
  }

  const host = document.createElement("div");
  host.className = "timeline-event-form-overlay assembly-op-overlay";

  host.innerHTML = `
    <div class="timeline-event-form assembly-op-form" role="dialog" aria-modal="true" aria-label="Elakasztás művelet">
      <div class="timeline-event-form-title">Elakasztás • ${escapeHtml(block.label || fuvar.megnevezes || fuvar.id)}</div>
      <div class="assembly-op-meta">Aktuális szerelvény: ${escapeHtml(buildAssemblyLabel(currentAssembly))}</div>

      <label class="timeline-event-form-label">
        Melyik szerelvénnyel történjen a csere?
        <input class="timeline-event-form-input" name="assemblySearch" type="search" placeholder="Keresés rendszám vagy gépjárművezető alapján..." />
      </label>

      <div class="assembly-op-list" data-role="assembly-list"></div>

      <label class="timeline-event-form-label">
        Elakasztás helye (cím)
        <input class="timeline-event-form-input" name="location" type="text" value="${escapeHtml(getDefaultSearchAddress(block))}" placeholder="Pl. 1117 Budapest, Fehérvári út 84/A" />
      </label>

      <div class="assembly-op-address-tools">
        <button type="button" class="timeline-event-form-cancel" data-action="google-search">Google címkereső megnyitása</button>
      </div>

      <div class="timeline-event-form-actions">
        <button type="button" class="timeline-event-form-cancel" data-action="cancel">Mégse</button>
        <button type="button" class="timeline-event-form-save" data-action="save">Elakasztás mentése</button>
      </div>
    </div>
  `;

  document.body.appendChild(host);
  openAssemblyOperationModal = host;

  const form = host.querySelector(".assembly-op-form");
  const list = host.querySelector('[data-role="assembly-list"]');
  const searchInput = host.querySelector('input[name="assemblySearch"]');
  const locationInput = host.querySelector('input[name="location"]');
  const googleBtn = host.querySelector('[data-action="google-search"]');
  const cancelBtn = host.querySelector('[data-action="cancel"]');
  const saveBtn = host.querySelector('[data-action="save"]');

  let selectedVontatoId = null;
  attachAddressAutocomplete(locationInput);

  const renderAssemblyList = (term = "") => {
    const normalizedTerm = String(term || "").trim().toLowerCase();
    const filtered = allAssemblies.filter((assembly) => {
      const searchable = `${assembly.vontato.rendszam} ${assembly.sofor?.nev || ""}`.toLowerCase();
      return searchable.includes(normalizedTerm);
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div class="assembly-op-empty">Nincs találat.</div>';
      return;
    }

    list.innerHTML = filtered.map((assembly) => {
      const selectedClass = selectedVontatoId === assembly.id ? "selected" : "";
      return `
        <button type="button" class="assembly-op-list-item ${selectedClass}" data-vontato-id="${escapeHtml(assembly.id)}">
          <strong>🚛 ${escapeHtml(assembly.vontato.rendszam)}</strong>
          <span>👤 ${escapeHtml(assembly.sofor?.nev || "nincs")}</span>
          <span>🚚 ${escapeHtml(assembly.potkocsi?.rendszam || "nincs")}</span>
        </button>
      `;
    }).join("");

    list.querySelectorAll(".assembly-op-list-item").forEach((button) => {
      button.addEventListener("click", () => {
        selectedVontatoId = button.dataset.vontatoId;
        renderAssemblyList(searchInput.value);
      });
    });
  };

  host.addEventListener("click", (event) => {
    if (event.target === host) {
      closeAssemblyOperationModal();
    }
  });

  form.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  searchInput.addEventListener("input", () => {
    renderAssemblyList(searchInput.value);
  });

  googleBtn.addEventListener("click", () => {
    openGoogleAddressSearch(locationInput.value);
  });

  cancelBtn.addEventListener("click", () => {
    closeAssemblyOperationModal();
  });

  saveBtn.addEventListener("click", () => {
    if (!selectedVontatoId) {
      alert("Válassz másik szerelvényt az elakasztáshoz.");
      return;
    }

    const targetAssembly = allAssemblies.find((assembly) => assembly.id === selectedVontatoId);
    if (!targetAssembly) {
      alert("A kiválasztott szerelvény nem található.");
      return;
    }

    const currentPotkocsi = resolveLinkedPotkocsi(currentAssembly.vontato, potkocsik);
    const targetPotkocsi = resolveLinkedPotkocsi(targetAssembly.vontato, potkocsik);

    if (!currentPotkocsi || !targetPotkocsi) {
      alert("Elakasztáshoz mindkét szerelvényhez szükséges pótkocsi.");
      return;
    }

    linkPotkocsiToVontato(targetPotkocsi, currentAssembly.vontato, potkocsik, vontatok);
    linkPotkocsiToVontato(currentPotkocsi, targetAssembly.vontato, potkocsik, vontatok);

    addOperationHistory(fuvar, "elakasztas", {
      location: String(locationInput.value || "").trim() || null,
      sourceAssemblyId: currentAssembly.id,
      targetAssemblyId: targetAssembly.id,
      sourcePotkocsiId: currentPotkocsi.id,
      targetPotkocsiId: targetPotkocsi.id
    });

    closeAssemblyOperationModal();
    rerenderCurrentAssemblyTimeline();
    emitAssemblyResourceChanged({
      operation: "elakasztas",
      fuvarId: fuvar.id,
      sourceAssemblyId: currentAssembly.id,
      targetAssemblyId: targetAssembly.id
    });
  });

  renderAssemblyList("");
  searchInput.focus();
}

function openEroforrasToresModal(currentAssembly, block, soforok, vontatok, potkocsik) {
  closeAssemblyOperationModal();

  const fuvar = findFuvarByBlock(block);
  if (!fuvar) {
    alert("A kiválasztott fuvar nem található.");
    return;
  }

  const currentSoforId = fuvar.assignedSoforId || currentAssembly.sofor?.id || "";
  const currentVontatoId = fuvar.assignedVontatoId || currentAssembly.vontato?.id || "";
  const currentPotkocsiId = fuvar.assignedPotkocsiId || currentAssembly.potkocsi?.id || "";

  const host = document.createElement("div");
  host.className = "timeline-event-form-overlay assembly-op-overlay";

  const soforOptions = soforok.map((sofor) => {
    const selected = sofor.id === currentSoforId ? "selected" : "";
    return `<option value="${escapeHtml(sofor.id)}" ${selected}>${escapeHtml(sofor.nev)} (${escapeHtml(sofor.id)})</option>`;
  }).join("");

  const vontatoOptions = vontatok.map((vontato) => {
    const selected = vontato.id === currentVontatoId ? "selected" : "";
    return `<option value="${escapeHtml(vontato.id)}" ${selected}>${escapeHtml(vontato.rendszam)} (${escapeHtml(vontato.id)})</option>`;
  }).join("");

  const potkocsiOptions = potkocsik.map((potkocsi) => {
    const selected = potkocsi.id === currentPotkocsiId ? "selected" : "";
    return `<option value="${escapeHtml(potkocsi.id)}" ${selected}>${escapeHtml(potkocsi.rendszam)} (${escapeHtml(potkocsi.id)})</option>`;
  }).join("");

  host.innerHTML = `
    <div class="timeline-event-form assembly-op-form" role="dialog" aria-modal="true" aria-label="Erőforrás törés">
      <div class="timeline-event-form-title">Erőforrás törés • ${escapeHtml(block.label || fuvar.megnevezes || fuvar.id)}</div>
      <div class="assembly-op-meta">A fuvar új erőforrás-hozzárendelése</div>

      <label class="timeline-event-form-label">
        Gépjárművezető
        <select class="timeline-event-form-input assembly-op-select" name="sofor">
          <option value="">Nincs hozzárendelve</option>
          ${soforOptions}
        </select>
      </label>

      <label class="timeline-event-form-label">
        Vontató
        <select class="timeline-event-form-input assembly-op-select" name="vontato">
          <option value="">Válassz vontatót...</option>
          ${vontatoOptions}
        </select>
      </label>

      <label class="timeline-event-form-label">
        Pótkocsi
        <select class="timeline-event-form-input assembly-op-select" name="potkocsi">
          <option value="">Pótkocsi levétele (nincs)</option>
          ${potkocsiOptions}
        </select>
      </label>

      <label class="timeline-event-form-label">
        Erőforrás törés helye (cím)
        <input class="timeline-event-form-input" name="location" type="text" value="${escapeHtml(getDefaultSearchAddress(block))}" placeholder="Pl. 9027 Győr, Külső Veszprémi út 2." />
      </label>

      <div class="assembly-op-address-tools">
        <button type="button" class="timeline-event-form-cancel" data-action="google-search">Google címkereső megnyitása</button>
      </div>

      <div class="timeline-event-form-actions">
        <button type="button" class="timeline-event-form-cancel" data-action="cancel">Mégse</button>
        <button type="button" class="timeline-event-form-save" data-action="save">Erőforrás törés mentése</button>
      </div>
    </div>
  `;

  document.body.appendChild(host);
  openAssemblyOperationModal = host;

  const form = host.querySelector(".assembly-op-form");
  const soforSelect = host.querySelector('select[name="sofor"]');
  const vontatoSelect = host.querySelector('select[name="vontato"]');
  const potkocsiSelect = host.querySelector('select[name="potkocsi"]');
  const locationInput = host.querySelector('input[name="location"]');
  const googleBtn = host.querySelector('[data-action="google-search"]');
  const cancelBtn = host.querySelector('[data-action="cancel"]');
  const saveBtn = host.querySelector('[data-action="save"]');
  attachAddressAutocomplete(locationInput);

  host.addEventListener("click", (event) => {
    if (event.target === host) {
      closeAssemblyOperationModal();
    }
  });

  form.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  googleBtn.addEventListener("click", () => {
    openGoogleAddressSearch(locationInput.value);
  });

  cancelBtn.addEventListener("click", () => {
    closeAssemblyOperationModal();
  });

  saveBtn.addEventListener("click", () => {
    const assignment = {
      soforId: soforSelect.value || null,
      vontatoId: vontatoSelect.value || null,
      potkocsiId: potkocsiSelect.value || null
    };

    if (!assignment.vontatoId) {
      alert("Erőforrás törésnél kötelező vontatót választani.");
      return;
    }

    const selectedSofor = assignment.soforId
      ? soforok.find((item) => item.id === assignment.soforId)
      : null;
    const selectedVontato = vontatok.find((item) => item.id === assignment.vontatoId) || null;
    const selectedPotkocsi = assignment.potkocsiId
      ? potkocsik.find((item) => item.id === assignment.potkocsiId)
      : null;

    if (!selectedVontato) {
      alert("A kiválasztott vontató nem található.");
      return;
    }

    if (assignment.soforId && !selectedSofor) {
      alert("A kiválasztott gépjárművezető nem található.");
      return;
    }

    if (assignment.potkocsiId && !selectedPotkocsi) {
      alert("A kiválasztott pótkocsi nem található.");
      return;
    }

    if (selectedSofor && !canAssignFuvarToResource(selectedSofor, fuvar)) {
      alert("A kiválasztott gépjárművezető foglalt a fuvar időszakában.");
      return;
    }

    if (!canAssignFuvarToResource(selectedVontato, fuvar)) {
      alert("A kiválasztott vontató foglalt a fuvar időszakában.");
      return;
    }

    if (selectedPotkocsi && !canAssignFuvarToResource(selectedPotkocsi, fuvar)) {
      alert("A kiválasztott pótkocsi foglalt a fuvar időszakában.");
      return;
    }

    applyFuvarAssignment(fuvar, assignment, soforok, vontatok, potkocsik);

    if (selectedSofor) {
      linkSoforToVontato(selectedSofor, selectedVontato, soforok, vontatok);
    }

    if (selectedPotkocsi) {
      linkPotkocsiToVontato(selectedPotkocsi, selectedVontato, potkocsik, vontatok);
    }

    addOperationHistory(fuvar, "eroforras-tores", {
      location: String(locationInput.value || "").trim() || null,
      assignment: { ...assignment }
    });

    closeAssemblyOperationModal();
    rerenderCurrentAssemblyTimeline();
    emitAssemblyResourceChanged({
      operation: "eroforras-tores",
      fuvarId: fuvar.id,
      assignment
    });
  });
}

function buildAssemblyBlockContextActions(assembly, block, soforok, vontatok, potkocsik) {
  const fuvar = findFuvarByBlock(block);

  if (!fuvar) {
    return [
      {
        label: "A fuvar nem található",
        disabled: true
      }
    ];
  }

  return [
    {
      label: "Elakasztás",
      action: () => openElakasztasModal(assembly, block, soforok, vontatok, potkocsik)
    },
    {
      label: "Erőforrás törés",
      action: () => openEroforrasToresModal(assembly, block, soforok, vontatok, potkocsik)
    }
  ];
}

function buildAssemblies(soforok, vontatok, potkocsik) {
  const persistedAssemblies = vontatok
    .map((vontato) => {
      const sofor = resolveLinkedSofor(vontato, soforok);
      const potkocsi = resolveLinkedPotkocsi(vontato, potkocsik);
      const fuvarBlocks = collectAssemblyFuvarBlocks(vontato, sofor, potkocsi);

      return {
        id: vontato.id,
        vontato,
        sofor,
        potkocsi,
        fuvarBlocks
      };
    })
    .filter((assembly) => {
      return Boolean(assembly.sofor || assembly.potkocsi || assembly.fuvarBlocks.length > 0);
    });

  return persistedAssemblies;
}

function renderAssemblyRow(parent, assembly, soforok, vontatok, potkocsik, lifecycleFuvarIds = new Set()) {
  const row = document.createElement("div");
  row.className = "timeline-resource assembly-row";
  if (assembly.isDraft) {
    row.classList.add("assembly-row-draft");
  }
  if (focusedAssemblyId && focusedAssemblyId === assembly.id) {
    row.classList.add("active");
  }
  if (assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds)) {
    row.classList.add("lifecycle-focus");
  }
  row.dataset.assemblyId = assembly.id;
  row.setAttribute("role", "button");
  row.setAttribute("tabindex", "0");

  const name = document.createElement("div");
  name.className = "timeline-resource-name assembly-resource-name";

  name.innerHTML = `
    <div class="assembly-main">${escapeHtml(getAssemblyDisplayTitle(assembly))}</div>
    <div class="assembly-resource-summary">${escapeHtml(getAssemblyResourceSummary(assembly))}</div>
  `;

  const bar = document.createElement("div");
  bar.className = "timeline-bar assembly-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.position = "relative";

  let visibleBlocks = 0;
  const completedJaratInfo = buildAssemblyCompletedJaratInfo(assembly.fuvarBlocks || [], assembly);
  const segmentByJaratId = new Map(
    (completedJaratInfo.segments || []).map((segment) => [segment.jaratId, segment])
  );

  const latestClosedSummary = [...(completedJaratInfo.summaries || [])]
    .filter((summary) => summary.status === "lezart")
    .sort((left, right) => new Date(right.end) - new Date(left.end))[0] || null;
  if (latestClosedSummary?.jaratId) {
    const latestSegment = segmentByJaratId.get(latestClosedSummary.jaratId) || null;
    if (latestSegment) {
      const nameInfoBtn = document.createElement("button");
      nameInfoBtn.type = "button";
      nameInfoBtn.className = "jarat-row-info-btn";
      nameInfoBtn.textContent = "i";
      nameInfoBtn.title = `Járat részletek (${latestClosedSummary.jaratId})`;
      nameInfoBtn.setAttribute("aria-label", nameInfoBtn.title);
      nameInfoBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openJaratInfoModalForSegment(latestSegment, assembly);
      });
      name.querySelector(".assembly-main")?.appendChild(nameInfoBtn);
    }
  }

  assembly.fuvarBlocks.forEach((block) => {
    const visibleBlock = clipBlockToWindow(block);
    if (!visibleBlock) {
      return;
    }

    visibleBlocks += 1;

    const div = document.createElement("div");
    div.className = "timeline-block fuvar assembly-block";
    const blockFuvarId = visibleBlock?.fuvarId || "";
    if (blockFuvarId && lifecycleFuvarIds.has(blockFuvarId)) {
      div.classList.add("lifecycle-match");
    }
    if (blockFuvarId && focusedFuvarId && blockFuvarId === focusedFuvarId) {
      div.classList.add("lifecycle-primary");
    }

    const left = dateToPosition(visibleBlock.renderStart);
    const width = blockWidth(visibleBlock.renderStart, visibleBlock.renderEnd);

    div.style.left = left + "px";
    div.style.width = width + "px";

    if (visibleBlock.kategoria) {
      const palette = getCategoryPalette(visibleBlock.kategoria);
      div.style.setProperty("--timeline-block-bg", palette.border);
      div.style.setProperty("--timeline-block-border", palette.borderStrong);
      div.style.setProperty("--timeline-block-glow", palette.glow);
      div.style.setProperty("--timeline-block-accent", palette.accent);
    }

    const route = getAssemblyRouteForBlock(visibleBlock);
    const urgentHtml = visibleBlock.surgos
      ? '<span class="timeline-inline-urgent">SÜRGŐS</span>'
      : "";
    const linkedFuvar = findFuvarByBlock(visibleBlock);
    const transitRoleInfo = getDomesticTransitRoleInfo(linkedFuvar);
    const transitRoleHtml = transitRoleInfo
      ? `<span class="timeline-inline-transit-role ${transitRoleInfo.role}">${transitRoleInfo.label}</span>`
      : "";
    const startText = formatCompactAssemblyTime(visibleBlock.start);
    const endText = formatCompactAssemblyTime(visibleBlock.end);

    div.innerHTML = `
      <div class="assembly-block-line-primary">${urgentHtml}${transitRoleHtml}<strong>${route.pickup} → ${route.dropoff}</strong><span class="timeline-compact-separator">•</span><span>${startText} → ${endText}</span></div>
    `;

    const jaratMeta = completedJaratInfo.byBlock.get(block) || null;
    if (jaratMeta?.jaratId) {
      div.classList.add("jarat-complete");
    }

    const blockTooltip = buildAssemblyBlockTooltip(visibleBlock, jaratMeta);
    div.title = blockTooltip;
    bindAssemblyBlockHoverTooltip(div, blockTooltip);

    if (!assembly.isDraft) {
      div.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();

        showAssemblyContextMenu(
          event,
          buildAssemblyBlockContextActions(assembly, block, soforok, vontatok, potkocsik)
        );
      });
    }

    bar.appendChild(div);
  });

  if (visibleBlocks === 0) {
    const empty = document.createElement("div");
    empty.className = "assembly-empty";
    empty.textContent = "Nincs fuvar ebben az időszeletben.";
    bar.appendChild(empty);
  }

  row.appendChild(name);
  row.appendChild(bar);

  const emitFocus = () => {
    window.dispatchEvent(new CustomEvent("assembly:focus", {
      detail: { assemblyId: assembly.id }
    }));
  };

  row.addEventListener("click", emitFocus);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      emitFocus();
    }
  });

  parent.appendChild(row);
}

function renderAssemblyPager(container, containerId, soforok, vontatok, potkocsik, dropoffView) {
  const renderState = assemblyRenderStates.get(containerId) || {};
  const pagerMode = renderState.options?.mode === "jarat"
    ? "jarat"
    : assemblyViewMode;
  const showViewModeToggle = renderState.options?.showViewModeToggle !== false;
  const showDropoffToggle = renderState.options?.showDropoffToggle !== false;
  const showJaratStatusFilter = renderState.options?.showJaratStatusFilter === true;

  const nav = document.createElement("div");
  nav.className = "timeline-nav assembly-nav";

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn timeline-nav-btn timeline-nav-arrow-btn";
  prevBtn.type = "button";
  prevBtn.innerHTML = "&larr;";
  prevBtn.setAttribute("aria-label", "Előző 72 óra");
  prevBtn.title = "Előző 72 óra";

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn timeline-nav-btn timeline-nav-arrow-btn";
  nextBtn.type = "button";
  nextBtn.innerHTML = "&rarr;";
  nextBtn.setAttribute("aria-label", "Következő 72 óra");
  nextBtn.title = "Következő 72 óra";

  const label = document.createElement("div");
  label.className = "timeline-nav-label";
  label.textContent = formatWindowLabel(getWindowStartDate(), getWindowEndDate());

  let dropoffBtn = null;
  if (showDropoffToggle) {
    dropoffBtn = document.createElement("button");
    dropoffBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
    dropoffBtn.type = "button";
    dropoffBtn.setAttribute("aria-pressed", String(assemblyDropoffVehiclesFilterActive));
    dropoffBtn.textContent = `Lerakó autók (${dropoffView.totalMatched})`;
    dropoffBtn.classList.toggle("active", assemblyDropoffVehiclesFilterActive);
  }

  let jaratStatusBtn = null;
  if (showJaratStatusFilter) {
    jaratStatusBtn = document.createElement("button");
    jaratStatusBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
    jaratStatusBtn.type = "button";
    jaratStatusBtn.setAttribute("aria-pressed", String(jaratTimelineStatusFilter !== "all"));
    jaratStatusBtn.textContent = `Státusz: ${JARAT_TIMELINE_STATUS_LABELS[jaratTimelineStatusFilter] || "Mind"}`;
    jaratStatusBtn.classList.toggle("active", jaratTimelineStatusFilter !== "all");
  }

  let viewModeBtn = null;
  if (showViewModeToggle) {
    viewModeBtn = document.createElement("button");
    viewModeBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
    viewModeBtn.type = "button";
    viewModeBtn.setAttribute("aria-pressed", String(assemblyViewMode !== "timeline"));
    viewModeBtn.textContent = `Nézet: ${ASSEMBLY_VIEW_MODE_LABELS[assemblyViewMode] || "Idővonal"}`;
    viewModeBtn.classList.toggle("active", assemblyViewMode !== "timeline");
  }

  prevBtn.addEventListener("click", () => {
    assemblyTimelineOffsetHours -= TIMELINE_HOURS;
    rerenderCurrentAssemblyTimeline();
  });

  nextBtn.addEventListener("click", () => {
    assemblyTimelineOffsetHours += TIMELINE_HOURS;
    rerenderCurrentAssemblyTimeline();
  });

  dropoffBtn?.addEventListener("click", () => {
    assemblyDropoffVehiclesFilterActive = !assemblyDropoffVehiclesFilterActive;
    rerenderCurrentAssemblyTimeline();
  });

  jaratStatusBtn?.addEventListener("click", () => {
    const currentIndex = JARAT_TIMELINE_STATUS_FILTERS.indexOf(jaratTimelineStatusFilter);
    const nextIndex = (currentIndex + 1) % JARAT_TIMELINE_STATUS_FILTERS.length;
    jaratTimelineStatusFilter = JARAT_TIMELINE_STATUS_FILTERS[nextIndex];
    rerenderCurrentAssemblyTimeline();
  });

  viewModeBtn?.addEventListener("click", () => {
    const modeIndex = ASSEMBLY_VIEW_MODES.indexOf(assemblyViewMode);
    const nextMode = ASSEMBLY_VIEW_MODES[(modeIndex + 1) % ASSEMBLY_VIEW_MODES.length];
    assemblyViewMode = nextMode;
    rerenderCurrentAssemblyTimeline();
  });

  const activeFilters = [];
  if (showDropoffToggle && assemblyDropoffVehiclesFilterActive) {
    activeFilters.push(`Lerakó autók (${dropoffView.totalMatched})`);
  }
  if (showViewModeToggle && pagerMode !== "timeline") {
    activeFilters.push(`Nézet: ${ASSEMBLY_VIEW_MODE_LABELS[pagerMode] || pagerMode}`);
  }
  if (showJaratStatusFilter && jaratTimelineStatusFilter !== "all") {
    activeFilters.push(`Státusz: ${JARAT_TIMELINE_STATUS_LABELS[jaratTimelineStatusFilter]}`);
  }
  const focusedFuvar = findFuvarById(focusedFuvarId);
  if (focusedFuvar?.id) {
    activeFilters.push(`Fuvar fókusz: ${focusedFuvar.id} (elérhető)`);
  }

  const activeBadge = document.createElement("div");
  activeBadge.className = "assembly-filter-active-badge";
  if (activeFilters.length === 0) {
    activeBadge.textContent = "Aktív szűrő: nincs";
  } else {
    activeBadge.textContent = `Aktív szűrő: ${activeFilters.join(" • ")}`;
  }

  nav.appendChild(prevBtn);
  nav.appendChild(label);
  nav.appendChild(nextBtn);
  if (dropoffBtn) {
    nav.appendChild(dropoffBtn);
  }
  if (viewModeBtn) {
    nav.appendChild(viewModeBtn);
  }
  if (jaratStatusBtn) {
    nav.appendChild(jaratStatusBtn);
  }
  nav.appendChild(activeBadge);
  container.appendChild(nav);
}

function getJaratStatusMeta(status) {
  if (status === "lezart") {
    return {
      label: "Kész",
      description: "Környétől Környéig"
    };
  }

  return {
    label: "Függő",
    description: ""
  };
}

function getAssemblyJaratSnapshot(assembly) {
  const completedJaratInfo = buildAssemblyCompletedJaratInfo(assembly?.fuvarBlocks || [], assembly);
  const closedSummaries = completedJaratInfo.summaries.filter((summary) => summary.status === "lezart");
  const jaratIds = closedSummaries.map((summary) => summary.jaratId);

  return {
    completedJaratInfo,
    jaratIds,
    hasCompletedJarat: jaratIds.length > 0
  };
}

function assemblyHasCompletedJarat(assembly) {
  return getAssemblyJaratSnapshot(assembly).hasCompletedJarat;
}

function buildAssemblyListMetrics(assembly) {
  const fuvarBlocks = (assembly?.fuvarBlocks || []).filter((block) => block?.type === "fuvar");
  const ordered = fuvarBlocks
    .slice()
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  const totalKm = ordered.reduce((sum, block) => {
    const value = getAssemblyBlockDistanceKm(block);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const first = ordered[0] || null;
  const last = ordered[ordered.length - 1] || null;

  return {
    fuvarCount: ordered.length,
    totalKm,
    first,
    last,
    ordered
  };
}

function buildAssemblyTaskGroups(orderedBlocks, jaratSnapshot) {
  const completedGroupsById = new Map();
  const pendingItems = [];
  const byBlock = jaratSnapshot?.completedJaratInfo?.byBlock || new Map();

  orderedBlocks.forEach((block) => {
    const jaratMeta = byBlock.get(block) || null;
    if (!jaratMeta?.jaratId) {
      pendingItems.push(block);
      return;
    }

    if (!completedGroupsById.has(jaratMeta.jaratId)) {
      completedGroupsById.set(jaratMeta.jaratId, []);
    }

    completedGroupsById.get(jaratMeta.jaratId).push(block);
  });

  const completedGroups = Array.from(completedGroupsById.entries()).map(([jaratId, items]) => {
    return {
      key: jaratId,
      title: `${jaratId} járat`,
      state: "done",
      items
    };
  });

  if (pendingItems.length > 0) {
    completedGroups.push({
      key: "pending",
      title: "Szerelvény feladatok (még nem lezárt járat)",
      state: "pending",
      items: pendingItems
    });
  }

  return completedGroups;
}

function renderAssemblyListRow(parent, assembly, lifecycleFuvarIds = new Set()) {
  const row = document.createElement("article");
  row.className = "assembly-list-row";
  row.dataset.assemblyId = assembly.id;
  row.setAttribute("role", "button");
  row.setAttribute("tabindex", "0");

  if (focusedAssemblyId && focusedAssemblyId === assembly.id) {
    row.classList.add("active");
  }
  if (assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds)) {
    row.classList.add("lifecycle-focus");
  }

  const soforName = assembly.sofor?.nev || "nincs";
  const potkocsiRendszam = assembly.potkocsi?.rendszam || "nincs";
  const metrics = buildAssemblyListMetrics(assembly);
  const jaratSnapshot = getAssemblyJaratSnapshot(assembly);
  const taskGroups = buildAssemblyTaskGroups(metrics.ordered, jaratSnapshot);
  const isExpanded = expandedAssemblyIds.has(assembly.id);
  row.classList.toggle("expanded", isExpanded);

  row.classList.toggle("is-jarat", jaratSnapshot.hasCompletedJarat);
  row.classList.toggle("is-not-jarat", !jaratSnapshot.hasCompletedJarat);

  const fromAddress = metrics.first?.felrakasCim || "-";
  const toAddress = metrics.last?.lerakasCim || "-";
  const fromText = metrics.first ? formatDate(metrics.first.start) : "-";
  const toText = metrics.last ? formatDate(metrics.last.end) : "-";
  const totalKmLabel = metrics.totalKm > 0
    ? `${Math.round(metrics.totalKm)} km`
    : "n/a";

  const jaratBadgeHtml = jaratSnapshot.hasCompletedJarat
    ? `<span class="assembly-list-jarat-state done">Járatként értelmezve (${jaratSnapshot.jaratIds.length})</span>`
    : '<span class="assembly-list-jarat-state pending">Még nincs lezárt járat</span>';

  const jaratIdBadgesHtml = jaratSnapshot.hasCompletedJarat
    ? `<div class="assembly-list-jarat-badges">${jaratSnapshot.jaratIds.map((jaratId) => `<span class="timeline-jarat-badge">${escapeHtml(jaratId)}</span>`).join("")}</div>`
    : "";

  const taskGroupsHtml = taskGroups.length > 0
    ? taskGroups.map((group) => {
      const itemsHtml = group.items.map((block) => {
        const linkedFuvar = findFuvarByBlock(block);
        const route = getAssemblyRouteForBlock(block);
        const timeRange = `${formatDate(block.start)} → ${formatDate(block.end)}`;
        const category = linkedFuvar?.kategoria || linkedFuvar?.viszonylat || block?.kategoria || "-";
        const distanceKm = getAssemblyBlockDistanceKm(block);
        const distanceLabel = Number.isFinite(distanceKm) ? `${Math.round(distanceKm)} km` : "n/a";
        const title = linkedFuvar?.id || block?.fuvarId || block?.label || "Fuvar";

        return `
          <li class="assembly-task-item">
            <strong class="assembly-task-id">${escapeHtml(title)}</strong>
            <span class="assembly-task-chip">${escapeHtml(category)}</span>
            <span class="assembly-task-route-inline">${escapeHtml(route.pickup)} → ${escapeHtml(route.dropoff)}</span>
            <span class="assembly-task-dot">•</span>
            <span class="assembly-task-time">${escapeHtml(timeRange)}</span>
            <span class="assembly-task-dot">•</span>
            <span class="assembly-task-distance">${distanceLabel}</span>
          </li>
        `;
      }).join("");

      return `
        <section class="assembly-task-group ${group.state}">
          <div class="assembly-task-group-title">${escapeHtml(group.title)} (${group.items.length})</div>
          <ul class="assembly-task-list">${itemsHtml}</ul>
        </section>
      `;
    }).join("")
    : '<div class="assembly-task-empty">Nincs fuvarfeladat ehhez a szerelvényhez az aktuális nézetben.</div>';

  row.innerHTML = `
    <header class="assembly-list-head">
      <div class="assembly-list-main-wrap">
        <button type="button" class="assembly-list-toggle" aria-expanded="${String(isExpanded)}" aria-label="Fuvarfeladatok lenyitása">
          <span class="assembly-list-toggle-icon ${isExpanded ? "open" : ""}">▼</span>
        </button>
        <div class="assembly-list-main">🚛 ${escapeHtml(assembly.vontato.rendszam)}</div>
      </div>
      ${jaratBadgeHtml}
    </header>
    <div class="assembly-list-info-grid">
      <div class="assembly-list-info-box assembly-list-meta">👤 Gépjárművezető: ${escapeHtml(soforName)}<span>•</span>🚚 Pótkocsi: ${escapeHtml(potkocsiRendszam)}</div>
      <div class="assembly-list-info-box assembly-list-route"><strong>${escapeHtml(fromAddress)}</strong><span>→</span><strong>${escapeHtml(toAddress)}</strong></div>
      <div class="assembly-list-info-box assembly-list-stats">
        <span>Fuvarok: ${metrics.fuvarCount}</span>
        <span>Össztáv: ${totalKmLabel}</span>
        <span>Időablak: ${escapeHtml(fromText)} → ${escapeHtml(toText)}</span>
      </div>
    </div>
    ${jaratIdBadgesHtml}
    <div class="assembly-task-details ${isExpanded ? "open" : ""}">${taskGroupsHtml}</div>
  `;

  const toggleBtn = row.querySelector(".assembly-list-toggle");
  toggleBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (expandedAssemblyIds.has(assembly.id)) {
      expandedAssemblyIds.delete(assembly.id);
    } else {
      expandedAssemblyIds.add(assembly.id);
    }
    rerenderCurrentAssemblyTimeline();
  });

  const emitFocus = () => {
    window.dispatchEvent(new CustomEvent("assembly:focus", {
      detail: { assemblyId: assembly.id }
    }));
  };

  row.addEventListener("click", emitFocus);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      emitFocus();
    }
  });

  parent.appendChild(row);
}

function renderAssemblyListView(parent, assemblies, lifecycleFuvarIds) {
  const listHost = document.createElement("section");
  listHost.className = "assembly-list-view";

  const completed = [];
  const pending = [];

  assemblies.forEach((assembly) => {
    const snapshot = getAssemblyJaratSnapshot(assembly);
    if (snapshot.hasCompletedJarat) {
      completed.push(assembly);
      return;
    }

    pending.push(assembly);
  });

  const renderSection = (title, items, stateClass) => {
    if (items.length === 0) {
      return;
    }

    const section = document.createElement("section");
    section.className = `assembly-list-section ${stateClass}`;

    const heading = document.createElement("h3");
    heading.className = "assembly-list-section-title";
    heading.textContent = `${title} (${items.length})`;
    section.appendChild(heading);

    items.forEach((assembly) => {
      renderAssemblyListRow(section, assembly, lifecycleFuvarIds);
    });

    listHost.appendChild(section);
  };

  renderSection("Járatként értelmezett szerelvények", completed, "done");
  renderSection("Még nem lezárt szerelvények", pending, "pending");

  if (!listHost.hasChildNodes()) {
    const empty = document.createElement("div");
    empty.className = "assembly-empty-state";
    empty.textContent = "Nincs megjeleníthető szerelvény listanézetben.";
    parent.appendChild(empty);
    return;
  }

  parent.appendChild(listHost);
}

function getAssemblyTimelineResourceEvents(assembly, startMs, endMs) {
  const resources = [
    { kind: "sofor", label: "Gépjárművezető", resource: assembly.sofor },
    { kind: "vontato", label: "Vontató", resource: assembly.vontato },
    { kind: "potkocsi", label: "Pótkocsi", resource: assembly.potkocsi }
  ];

  const events = [];

  resources.forEach(({ kind, label, resource }) => {
    (resource?.timeline || []).forEach((block) => {
      if (!block || block.type === "fuvar") {
        return;
      }

      if (block.synthetic && !block.autoDriverState) {
        return;
      }

      const eventStartMs = new Date(block.start).getTime();
      const eventEndMs = new Date(block.end).getTime();
      if (!Number.isFinite(eventStartMs) || !Number.isFinite(eventEndMs)) {
        return;
      }

      if (eventEndMs < startMs || eventStartMs > endMs) {
        return;
      }

      events.push({
        ...block,
        eventSourceKind: kind,
        eventSourceLabel: label,
        eventSourceId: resource?.id || ""
      });
    });
  });

  const deduped = new Map();
  events.forEach((eventBlock) => {
    const key = [
      eventBlock.type,
      eventBlock.start,
      eventBlock.end,
      eventBlock.eventSourceKind,
      eventBlock.eventSourceId,
      eventBlock.label || ""
    ].join("|");

    if (!deduped.has(key)) {
      deduped.set(key, eventBlock);
    }
  });

  return Array.from(deduped.values()).sort((left, right) => {
    return new Date(left.start) - new Date(right.start);
  });
}

function getAssemblyJaratOperationEvents(segment) {
  if (!segment || !Array.isArray(segment.blocks) || segment.blocks.length === 0) {
    return [];
  }

  const fuvarIds = new Set(
    segment.blocks
      .map((block) => block?.fuvarId)
      .filter(Boolean)
  );

  if (fuvarIds.size === 0) {
    return [];
  }

  const startMs = new Date(segment.start).getTime();
  const endMs = new Date(segment.end).getTime();
  const events = [];

  FUVAROK.forEach((fuvar) => {
    if (!fuvarIds.has(fuvar.id)) {
      return;
    }

    const operations = Array.isArray(fuvar.resourceOperations) ? fuvar.resourceOperations : [];
    operations.forEach((operation) => {
      const opMs = new Date(operation?.at || "").getTime();
      if (Number.isFinite(opMs) && (opMs < startMs || opMs > endMs)) {
        return;
      }

      events.push({
        id: operation?.id || `${fuvar.id}-${operation?.type || "op"}`,
        at: Number.isFinite(opMs) ? operation.at : segment.start,
        type: operation?.type || "muvelet",
        typeLabel: formatOperationTypeLabel(operation?.type || ""),
        fuvarId: fuvar.id,
        location: operation?.location || ""
      });
    });
  });

  const deduped = new Map();
  events.forEach((eventItem) => {
    const key = `${eventItem.id}|${eventItem.at}|${eventItem.type}`;
    if (!deduped.has(key)) {
      deduped.set(key, eventItem);
    }
  });

  return Array.from(deduped.values()).sort((left, right) => new Date(left.at) - new Date(right.at));
}

function buildJaratEventTooltip(block) {
  const lines = [
    `${block?.eventSourceLabel || "Erőforrás"}: ${block?.label || block?.type || "esemény"}`,
    `${formatDate(block.start)} → ${formatDate(block.end)}`
  ];

  if (block?.eventSourceId) {
    lines.push(`Erőforrás: ${block.eventSourceId}`);
  }

  return lines.join("\n");
}

function segmentMatchesJaratStatusFilter(segment) {
  if (jaratTimelineStatusFilter === "all") {
    return true;
  }

  const normalizedStatus = segment?.status === "lezart" ? "done" : "pending";
  return normalizedStatus === jaratTimelineStatusFilter;
}

function renderAssemblyJaratTimelineRow(parent, assembly, segment, lifecycleFuvarIds = new Set()) {
  const row = document.createElement("div");
  row.className = "timeline-resource assembly-row jarat-row";
  row.dataset.assemblyId = assembly.id;
  row.dataset.jaratId = segment.jaratId;
  if (segment.status !== "lezart") {
    row.classList.add("jarat-row-open");
  }

  const soforName = assembly.sofor?.nev || "nincs";
  const potkocsiRendszam = assembly.potkocsi?.rendszam || "nincs";
  const statusMeta = getJaratStatusMeta(segment.status);

  const name = document.createElement("div");
  name.className = "timeline-resource-name assembly-resource-name";
  name.innerHTML = `
    <div class="assembly-main jarat-row-main">🧭 ${segment.jaratId} • 🚛 ${assembly.vontato.rendszam}</div>
    <div class="assembly-meta"><span class="jarat-status-chip ${segment.status === "lezart" ? "done" : "pending"}">${statusMeta.label}</span>${statusMeta.description ? ` ${statusMeta.description} •` : ""} ${formatDate(segment.start)} → ${formatDate(segment.end)}</div>
    <div class="assembly-meta">👤 Gépjárművezető: ${soforName} • 🚚 Pótkocsi: ${potkocsiRendszam}</div>
  `;

  const nameInfoBtn = document.createElement("button");
  nameInfoBtn.type = "button";
  nameInfoBtn.className = "jarat-row-info-btn";
  nameInfoBtn.textContent = "i";
  nameInfoBtn.title = `Járat részletek (${segment.jaratId})`;
  nameInfoBtn.setAttribute("aria-label", nameInfoBtn.title);
  nameInfoBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openJaratInfoModalForSegment(segment, assembly);
  });
  name.querySelector(".jarat-row-main")?.appendChild(nameInfoBtn);

  const bar = document.createElement("div");
  bar.className = "timeline-bar assembly-bar jarat-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.position = "relative";

  const segmentStartMs = new Date(segment.start).getTime();
  const segmentEndMs = new Date(segment.end).getTime();

  segment.blocks.forEach((block) => {
    const visibleBlock = clipBlockToWindow(block);
    if (!visibleBlock) {
      return;
    }

    const div = document.createElement("div");
    div.className = "timeline-block fuvar assembly-block jarat-main-block";
    if (visibleBlock?.fuvarId && lifecycleFuvarIds.has(visibleBlock.fuvarId)) {
      div.classList.add("lifecycle-match");
    }

    const left = dateToPosition(visibleBlock.renderStart);
    const width = blockWidth(visibleBlock.renderStart, visibleBlock.renderEnd);
    div.style.left = left + "px";
    div.style.width = width + "px";

    if (visibleBlock.kategoria) {
      const palette = getCategoryPalette(visibleBlock.kategoria);
      div.style.setProperty("--timeline-block-bg", palette.border);
      div.style.setProperty("--timeline-block-border", palette.borderStrong);
      div.style.setProperty("--timeline-block-glow", palette.glow);
      div.style.setProperty("--timeline-block-accent", palette.accent);
    }

    const route = getAssemblyRouteForBlock(visibleBlock);
    div.innerHTML = `<div class="assembly-block-line-primary"><strong>${route.pickup} → ${route.dropoff}</strong><span class="timeline-compact-separator">•</span><span>${formatCompactAssemblyTime(visibleBlock.start)} → ${formatCompactAssemblyTime(visibleBlock.end)}</span></div>`;

    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "jarat-info-trigger";
    infoBtn.textContent = "i";
    infoBtn.title = `Járat részletek (${segment.jaratId})`;
    infoBtn.setAttribute("aria-label", infoBtn.title);
    infoBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openJaratInfoModalForSegment(segment, assembly);
    });
    div.appendChild(infoBtn);

    div.title = buildAssemblyBlockTooltip(visibleBlock, { jaratId: segment.jaratId });
    bindAssemblyBlockHoverTooltip(div, div.title);
    bar.appendChild(div);
  });

  const resourceEvents = getAssemblyTimelineResourceEvents(assembly, segmentStartMs, segmentEndMs);
  resourceEvents.forEach((eventBlock) => {
    const visibleEvent = clipBlockToWindow(eventBlock);
    if (!visibleEvent) {
      return;
    }

    const eventDiv = document.createElement("div");
    eventDiv.className = `timeline-block ${visibleEvent.type || "allas"} jarat-event-block`;

    const left = dateToPosition(visibleEvent.renderStart);
    const width = blockWidth(visibleEvent.renderStart, visibleEvent.renderEnd);
    eventDiv.style.left = left + "px";
    eventDiv.style.width = width + "px";
    eventDiv.textContent = `${visibleEvent.eventSourceLabel}: ${visibleEvent.label || visibleEvent.type || "esemény"}`;

    const tooltip = buildJaratEventTooltip(visibleEvent);
    eventDiv.title = tooltip;
    bindAssemblyBlockHoverTooltip(eventDiv, tooltip);
    bar.appendChild(eventDiv);
  });

  const operationEvents = getAssemblyJaratOperationEvents(segment);
  operationEvents.forEach((operation) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "jarat-op-marker";

    const left = dateToPosition(operation.at);
    marker.style.left = left + "px";
    marker.title = `${operation.typeLabel} • ${operation.fuvarId}${operation.location ? ` • ${operation.location}` : ""}`;
    marker.setAttribute("aria-label", marker.title);
    marker.textContent = "⚡";
    bindAssemblyBlockHoverTooltip(marker, marker.title);
    bar.appendChild(marker);
  });

  row.appendChild(name);
  row.appendChild(bar);
  parent.appendChild(row);
}

function renderAssemblyJaratTimelineView(parent, assemblies, lifecycleFuvarIds) {
  const allRows = [];

  assemblies.forEach((assembly) => {
    const segments = buildAssemblyJaratSegments(assembly.fuvarBlocks || [], assembly);
    segments.forEach((segment) => {
      if (!segmentMatchesJaratStatusFilter(segment)) {
        return;
      }

      allRows.push({ assembly, segment });
    });
  });

  allRows.sort((left, right) => {
    return new Date(left.segment.start) - new Date(right.segment.start);
  });

  if (allRows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "assembly-empty-state";
    empty.textContent = "Nincs megjeleníthető járat az aktuális szűrők és időablak mellett.";
    parent.appendChild(empty);
    return;
  }

  allRows.forEach(({ assembly, segment }) => {
    renderAssemblyJaratTimelineRow(parent, assembly, segment, lifecycleFuvarIds);
  });
}

export function renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    assemblyRenderStates.delete(containerId);
    return;
  }

  bindAssemblyTransientHandlers();
  closeAssemblyTransientUi();

  const mode = options?.mode === "jarat"
    ? "jarat"
    : (options?.mode === "list" ? "list" : assemblyViewMode);
  const normalizedOptions = {
    ...options,
    mode,
    showViewModeToggle: options?.showViewModeToggle !== false,
    showDropoffToggle: options?.showDropoffToggle !== false,
    showJaratStatusFilter: options?.showJaratStatusFilter === true
  };

  assemblyRenderStates.set(containerId, {
    containerId,
    soforok,
    vontatok,
    potkocsik,
    options: normalizedOptions
  });

  container.innerHTML = "";

  const persistedAssemblies = buildAssemblies(soforok, vontatok, potkocsik);
  const draftAssemblies = buildDraftAssemblies(soforok, vontatok, potkocsik);
  const assemblies = mode === "timeline"
    ? [...draftAssemblies, ...persistedAssemblies]
    : persistedAssemblies;
  const spedicioOnlyAssemblies = Boolean(options?.spedicioOnly)
    ? assemblies.filter((assembly) => {
      return (assembly?.fuvarBlocks || []).some((block) => {
        const fuvar = findFuvarByBlock(block);
        return Boolean(fuvar?.spediccio);
      });
    })
    : assemblies;
  const dropoffView = buildAssemblyDropoffView(spedicioOnlyAssemblies);

  renderAssemblyPager(container, containerId, soforok, vontatok, potkocsik, dropoffView);
  if (mode === "timeline" && options?.showDraftBoard !== false) {
    renderDraftAssemblyBoard(container, soforok, vontatok, potkocsik);
  }
  if (mode === "timeline" || mode === "jarat") {
    renderTimeScale(container);
  }

  if (spedicioOnlyAssemblies.length === 0) {
    const empty = document.createElement("div");
    empty.className = "assembly-empty-state";
    empty.textContent = options?.spedicioOnly
      ? "Nincs olyan szerelvény, amelyen spedíciós fuvar szerepel."
      : "Nincs még összeállított szerelvény. Húzz egy fuvarfeladatot erőforrásra az idővonalon.";
    container.appendChild(empty);
    return;
  }

  const useDropoffFilter = normalizedOptions.showDropoffToggle && assemblyDropoffVehiclesFilterActive;
  const visibleAssemblies = useDropoffFilter
    ? spedicioOnlyAssemblies
      .filter((assembly) => dropoffView.insightByAssemblyId.has(assembly.id))
      .map((assembly, index) => ({ assembly, index }))
      .sort((left, right) => {
        const leftInsight = dropoffView.insightByAssemblyId.get(left.assembly.id);
        const rightInsight = dropoffView.insightByAssemblyId.get(right.assembly.id);

        const leftDistance = leftInsight?.bestDistanceKm ?? Number.POSITIVE_INFINITY;
        const rightDistance = rightInsight?.bestDistanceKm ?? Number.POSITIVE_INFINITY;
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        const leftUnmatched = leftInsight?.unmatchedExportCount ?? 0;
        const rightUnmatched = rightInsight?.unmatchedExportCount ?? 0;
        if (leftUnmatched !== rightUnmatched) {
          return rightUnmatched - leftUnmatched;
        }

        return left.index - right.index;
      })
      .map(({ assembly }) => assembly)
    : spedicioOnlyAssemblies;

  const filteredAssemblies = visibleAssemblies;
  const focusedFuvar = findFuvarById(focusedFuvarId);
  const shouldFilterByFocusedFuvarAvailability = Boolean(
    focusedFuvar?.felrakas?.ido && focusedFuvar?.lerakas?.ido
  );
  const availabilityFilteredAssemblies = shouldFilterByFocusedFuvarAvailability
    ? filteredAssemblies.filter((assembly) => isAssemblyAvailableForFuvar(assembly, focusedFuvar))
    : filteredAssemblies;

  if (useDropoffFilter && visibleAssemblies.length === 0) {
    const info = document.createElement("div");
    info.className = "timeline-filter-empty";
    info.textContent = "Nincs olyan szerelvény, ahol az export lerakást követő 4 órában hiányzik import fuvar.";
    container.appendChild(info);
    return;
  }

  if (shouldFilterByFocusedFuvarAvailability && availabilityFilteredAssemblies.length === 0) {
    const info = document.createElement("div");
    info.className = "timeline-filter-empty";
    info.textContent = "A fókuszált fuvar felrakási időpontjában nincs elérhető teljes szerelvény.";
    container.appendChild(info);
    return;
  }

  const lifecycleFuvarIds = buildFocusedLifecycleFuvarIdSet();
  const lifecycleMatches = lifecycleFuvarIds.size > 0
    ? availabilityFilteredAssemblies.filter((assembly) => assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds))
    : [];
  const lifecycleRemainder = lifecycleFuvarIds.size > 0
    ? availabilityFilteredAssemblies.filter((assembly) => !assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds))
    : availabilityFilteredAssemblies;
  const orderedAssemblies = lifecycleFuvarIds.size > 0
    ? [...lifecycleMatches, ...lifecycleRemainder]
    : filteredAssemblies;

  if (mode === "list") {
    renderAssemblyListView(container, orderedAssemblies, lifecycleFuvarIds);
    return;
  }

  if (mode === "jarat") {
    renderAssemblyJaratTimelineView(container, orderedAssemblies, lifecycleFuvarIds);
    syncPinnedAssemblyResourceNames(container);
    return;
  }

  orderedAssemblies.forEach((assembly) => {
    renderAssemblyRow(container, assembly, soforok, vontatok, potkocsik, lifecycleFuvarIds);
  });

  syncPinnedAssemblyResourceNames(container);
}

export function renderJaratTimeline(containerId, soforok, vontatok, potkocsik, options = {}) {
  renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik, {
    ...options,
    mode: "jarat",
    showViewModeToggle: false,
    showDropoffToggle: false,
    showJaratStatusFilter: true
  });
}
