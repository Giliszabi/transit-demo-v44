// ============================================================
// TransIT v4.4 – ADVANCED TIMELINE ENGINE
// - C‑típusú TMS időskála (4 órás blokkok)
// - Fuvar blokkok pozícionálása
// - Ütközésvizsgálat
// - Matching Engine szerinti highlight (ok/bad/warn)
// ============================================================

import { distanceKm, formatDate } from "../utils.js";
import { FUVAROK } from "../data/fuvarok.js";
import { evaluateFuvarTags } from "./matching.js";
import { getFuvarTagMeta, getCategoryPalette } from "./colors.js";

const HOUR_WIDTH = 40;               // 1 óra = 40px
const TIMELINE_HOURS = 72;           // 3 nap
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;
const REST_DRAG_SNAP_MINUTES = 30;
let timelineOffsetHours = 0;
let focusedFuvarId = null;
let openTimelineContextMenu = null;
let openTimelineEventForm = null;
let lastTimelineRenderState = null;
const collapsedTimelineGroups = new Set();
const timelineSearchTerms = {
  sofor: "",
  vontato: "",
  potkocsi: ""
};
let dropoffVehiclesFilterActive = false;
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
const AUTO_DEADHEAD_MAX_DISTANCE_KM = 120;
const AUTO_DEADHEAD_LABEL = "Rezsifutás";

window.addEventListener("fuvar:focus", (event) => {
  focusedFuvarId = event?.detail?.fuvarId || null;
  rerenderCurrentTimeline();
});

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function applySearchToTimelineGroupBody(body, searchTerm) {
  const term = normalizeSearchText(searchTerm);

  body.querySelectorAll(".timeline-resource").forEach((row) => {
    const haystack = row.dataset.searchText || "";
    row.hidden = term.length > 0 && !haystack.includes(term);
  });
}

function getAddressCoords(address) {
  const normalized = normalizeSearchText(address);
  if (!normalized) {
    return null;
  }

  const cityKey = Object.keys(ADDRESS_COORDS).find((key) => normalized.includes(key));
  return cityKey ? ADDRESS_COORDS[cityKey] : null;
}

function findFuvarByTimelineBlock(block) {
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

function getExportImportProximityHint(block, focusedImportFuvar) {
  if (!focusedImportFuvar || block?.type !== "fuvar" || block?.kategoria !== "export") {
    return null;
  }

  const blockFuvar = findFuvarByTimelineBlock(block);
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

function hasImportBlockWithinWindow(resource, exportEndMs) {
  return (resource?.timeline || []).some((block) => {
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

function getDropoffResourceInsight(resource, importCandidates) {
  const exportBlocks = (resource?.timeline || []).filter((block) => {
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

    return !hasImportBlockWithinWindow(resource, exportEndMs);
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

function buildDropoffResourceView(groups) {
  const importCandidates = getImportPlanningCandidates();
  const insightByResourceKey = new Map();
  let totalMatched = 0;

  groups.forEach((group) => {
    const type = getKindFromGroupName(group.name);

    (group.list || []).forEach((resource) => {
      const insight = getDropoffResourceInsight(resource, importCandidates);
      if (!insight) {
        return;
      }

      insightByResourceKey.set(`${type}:${resource.id}`, insight);
      totalMatched += 1;
    });
  });

  return {
    insightByResourceKey,
    totalMatched
  };
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

function updateStickyHeaderOffset(container) {
  const nav = container.querySelector(".timeline-nav");
  if (!nav) {
    return;
  }

  const navHeight = Math.ceil(nav.getBoundingClientRect().height);
  container.style.setProperty("--timeline-nav-height", `${navHeight}px`);
}

function syncPinnedResourceNames(container) {
  const updatePinned = () => {
    const scrollLeft = container.scrollLeft;

    container.querySelectorAll(".timeline-resource-name").forEach((el) => {
      el.style.transform = `translate3d(${scrollLeft}px, 0, 0)`;
    });
  };

  container.onscroll = updatePinned;
  updatePinned();
}

function getBlockTags(block) {
  if (block.type !== "fuvar") {
    return [];
  }

  const tags = [];

  if (block.adr) {
    tags.push("adr");
  }

  if (block.surgos) {
    tags.push("surgos");
  }

  if (block.kategoria) {
    tags.push(block.kategoria);
  }

  return tags;
}

function renderBlockTags(block) {
  const tags = getBlockTags(block);

  return `
    <div class="timeline-block-tags${tags.length === 0 ? " empty" : ""}">
      ${tags.map((tag) => {
        const meta = getFuvarTagMeta(tag);
        return `
          <span
            class="fuvar-tag timeline-tag"
            style="--tag-bg:${meta.color};--tag-text:${meta.textColor};"
            data-tag="${tag}"
          >
            ${meta.label}
          </span>
        `;
      }).join("")}
    </div>
  `;
}

// ============================================================
// Alap dátum – ma 00:00
// ============================================================
function getBaseDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTimelineFilterReferenceDate() {
  return getWindowStartDate();
}

function notifyTimelineWindowChanged() {
  window.dispatchEvent(new CustomEvent("timeline:window-change", {
    detail: {
      start: getWindowStartDate().toISOString(),
      end: getWindowEndDate().toISOString(),
      offsetHours: timelineOffsetHours
    }
  }));
}

// ============================================================
// Dátum → Pixel pozíció
// ============================================================
function dateToPosition(dateStr) {
  const base = getWindowStartDate();
  const t = new Date(dateStr);
  const diffHours = (t - base) / (1000 * 60 * 60);
  return diffHours * HOUR_WIDTH;
}

// ============================================================
// Blokk szélesség
// ============================================================
function blockWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = (e - s) / (1000 * 60 * 60);
  return Math.max(20, diff * HOUR_WIDTH);
}

function getBlockDurationHours(block) {
  const start = new Date(block.start).getTime();
  const end = new Date(block.end).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
}

function formatDurationHours(hours) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}

function canDragRestBlock(block, type) {
  return type === "sofor" && !block?.synthetic && block.type === "piheno";
}

function updateBlockTimeText(blockEl, block) {
  const timeEl = blockEl.querySelector(".timeline-block-time");
  if (!timeEl) {
    return;
  }

  timeEl.textContent = `${formatDate(block.start)} → ${formatDate(block.end)}`;
}

function hasNonSyntheticOverlap(resource, movingBlock, nextStartIso, nextEndIso) {
  const nextStart = new Date(nextStartIso);
  const nextEnd = new Date(nextEndIso);

  return (resource.timeline || []).some((candidate) => {
    if (!candidate || candidate === movingBlock || candidate.synthetic) {
      return false;
    }

    const cStart = new Date(candidate.start);
    const cEnd = new Date(candidate.end);
    return nextStart < cEnd && nextEnd > cStart;
  });
}

function makeRestBlockDraggable(blockEl, bar, resource, block, type) {
  if (!canDragRestBlock(block, type)) {
    return;
  }

  const windowStart = getWindowStartDate();
  const windowEnd = getWindowEndDate();
  const blockStart = new Date(block.start);
  const blockEnd = new Date(block.end);

  if (blockStart < windowStart || blockEnd > windowEnd) {
    return;
  }

  blockEl.classList.add("timeline-block-draggable");
  blockEl.title = "Pihenő blokk mozgatása";

  blockEl.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const dragStartX = event.clientX;
    const initialStartMs = new Date(block.start).getTime();
    const initialEndMs = new Date(block.end).getTime();
    const durationMs = initialEndMs - initialStartMs;
    const minStartMs = windowStart.getTime();
    const maxStartMs = windowEnd.getTime() - durationMs;

    const onMouseMove = (moveEvent) => {
      const deltaPx = moveEvent.clientX - dragStartX;
      const deltaMinutesRaw = (deltaPx / HOUR_WIDTH) * 60;
      const snappedMinutes = Math.round(deltaMinutesRaw / REST_DRAG_SNAP_MINUTES) * REST_DRAG_SNAP_MINUTES;
      const shiftedStartMs = Math.min(maxStartMs, Math.max(minStartMs, initialStartMs + minutesToMs(snappedMinutes)));
      const shiftedEndMs = shiftedStartMs + durationMs;

      const nextStartIso = new Date(shiftedStartMs).toISOString();
      const nextEndIso = new Date(shiftedEndMs).toISOString();

      if (hasNonSyntheticOverlap(resource, block, nextStartIso, nextEndIso)) {
        return;
      }

      block.start = nextStartIso;
      block.end = nextEndIso;

      blockEl.style.left = `${dateToPosition(block.start)}px`;
      updateBlockTimeText(blockEl, block);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function getFocusedFuvarRange() {
  if (!focusedFuvarId) {
    return null;
  }

  const fuvar = FUVAROK.find((item) => item.id === focusedFuvarId);
  if (!fuvar?.felrakas?.ido || !fuvar?.lerakas?.ido) {
    return null;
  }

  const visibleRange = clipBlockToWindow({
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    type: "fuvar",
    label: fuvar.megnevezes
  });

  if (!visibleRange) {
    return null;
  }

  return {
    left: dateToPosition(visibleRange.renderStart),
    right: dateToPosition(visibleRange.renderEnd),
    width: blockWidth(visibleRange.renderStart, visibleRange.renderEnd)
  };
}

function appendFocusedFuvarMarker(bar, focusedRange) {
  if (!focusedRange) {
    return;
  }

  const marker = document.createElement("div");
  marker.className = "timeline-fuvar-focus-range";
  marker.style.left = `${focusedRange.left}px`;
  marker.style.width = `${focusedRange.width}px`;
  bar.appendChild(marker);
}

function snapToMinuteStep(date, stepMinutes) {
  const stepMs = minutesToMs(stepMinutes);
  const snapped = Math.round(date.getTime() / stepMs) * stepMs;
  return new Date(snapped);
}

function formatLocalDateTimeInput(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeInput(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getManualEventMeta(kind) {
  if (kind === "piheno") {
    return { type: "piheno", label: "Pihenő" };
  }

  if (kind === "szabadsag") {
    return { type: "szabadsag", label: "Szabadság" };
  }

  if (kind === "rezsifutas") {
    return { type: "rezsifutas", label: "Rezsifutás" };
  }

  if (kind === "allas") {
    return { type: "allas", label: "Állás" };
  }

  if (kind === "szerviz") {
    return { type: "szerviz", label: "Szervíz" };
  }

  if (kind === "standby") {
    return { type: "standby", label: "Standby" };
  }

  return { type: "beteg", label: "Betegszab." };
}

function getDefaultDurationHours(eventKind) {
  if (eventKind === "piheno") return 9;
  if (eventKind === "szabadsag") return 24;
  if (eventKind === "beteg") return 24;
  if (eventKind === "szerviz") return 8;
  if (eventKind === "standby") return 8;
  if (eventKind === "allas") return 8;
  if (eventKind === "rezsifutas") return 4;
  return 8;
}

function rerenderCurrentTimeline() {
  if (!lastTimelineRenderState) {
    return;
  }

  renderTimeline(lastTimelineRenderState.containerId, lastTimelineRenderState.groups);
}

function addManualDriverEvent(resource, eventKind, startDate, endDate) {
  if (!resource.timeline) {
    resource.timeline = [];
  }

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  if (endDate <= startDate) {
    alert("A befejezésnek később kell lennie, mint a kezdés.");
    return false;
  }

  if (hasCollision(resource.timeline, startIso, endIso)) {
    alert("⚠️ Ebben az időszakban már van foglalás.");
    return false;
  }

  const meta = getManualEventMeta(eventKind);
  resource.timeline.push({
    start: startIso,
    end: endIso,
    type: meta.type,
    label: meta.label,
    synthetic: false,
    manual: true
  });

  rerenderCurrentTimeline();
  return true;
}

function removeTimelineBlock(resource, block) {
  if (!resource?.timeline || !block) {
    return false;
  }

  const index = resource.timeline.indexOf(block);
  if (index === -1) {
    return false;
  }

  resource.timeline.splice(index, 1);
  rerenderCurrentTimeline();
  return true;
}

function closeTimelineContextMenu() {
  if (!openTimelineContextMenu) {
    return;
  }

  openTimelineContextMenu.remove();
  openTimelineContextMenu = null;
}

function closeTimelineEventForm() {
  if (!openTimelineEventForm) {
    return;
  }

  openTimelineEventForm.remove();
  openTimelineEventForm = null;
}

function setEndFromStart(startInput, endInput, durationHours) {
  const startDate = parseDateTimeInput(startInput.value);
  if (!startDate) {
    return;
  }

  const endDate = new Date(startDate.getTime() + durationHours * 3600 * 1000);
  endInput.value = formatLocalDateTimeInput(endDate);
}

function askAndCreateManualEvent(resource, eventKind, defaultStart) {
  closeTimelineEventForm();

  const formHost = document.createElement("div");
  formHost.className = "timeline-event-form-overlay";

  const defaultDurationHours = getDefaultDurationHours(eventKind);
  const defaultEnd = new Date(defaultStart.getTime() + defaultDurationHours * 3600 * 1000);

  formHost.innerHTML = `
    <div class="timeline-event-form" role="dialog" aria-modal="true" aria-label="Esemény hozzáadása">
      <div class="timeline-event-form-title">${getManualEventMeta(eventKind).label} hozzáadása</div>
      <label class="timeline-event-form-label">
        Kezdés dátum és idő
        <input class="timeline-event-form-input" name="start" type="datetime-local" value="${formatLocalDateTimeInput(defaultStart)}" />
      </label>
      <label class="timeline-event-form-label">
        Befejezés dátum és idő
        <input class="timeline-event-form-input" name="end" type="datetime-local" value="${formatLocalDateTimeInput(defaultEnd)}" />
      </label>
      ${eventKind === "piheno" ? `
        <div class="timeline-event-form-quick-title">Gyors időtartam</div>
        <div class="timeline-event-form-quick-grid">
          <button type="button" class="timeline-event-quick-btn" data-hours="9">9 órás</button>
          <button type="button" class="timeline-event-quick-btn" data-hours="11">11 órás</button>
          <button type="button" class="timeline-event-quick-btn" data-hours="24">24 órás</button>
          <button type="button" class="timeline-event-quick-btn" data-hours="45">45 órás</button>
        </div>
      ` : ""}
      <div class="timeline-event-form-actions">
        <button type="button" class="timeline-event-form-cancel">Mégse</button>
        <button type="button" class="timeline-event-form-save">Mentés</button>
      </div>
    </div>
  `;

  document.body.appendChild(formHost);
  openTimelineEventForm = formHost;

  const form = formHost.querySelector(".timeline-event-form");
  const startInput = formHost.querySelector('input[name="start"]');
  const endInput = formHost.querySelector('input[name="end"]');
  const cancelBtn = formHost.querySelector(".timeline-event-form-cancel");
  const saveBtn = formHost.querySelector(".timeline-event-form-save");
  const quickButtons = Array.from(formHost.querySelectorAll(".timeline-event-quick-btn"));
  let selectedQuickHours = null;

  const syncQuickButtonVisualState = () => {
    quickButtons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.hours) === selectedQuickHours);
    });
  };

  const setSelectedQuickHours = (hours) => {
    selectedQuickHours = Number.isFinite(hours) && hours > 0 ? hours : null;
    syncQuickButtonVisualState();
  };

  quickButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const hours = Number(btn.dataset.hours);
      if (!Number.isFinite(hours) || hours <= 0) {
        return;
      }

      setSelectedQuickHours(hours);
      setEndFromStart(startInput, endInput, hours);
    });
  });

  startInput.addEventListener("input", () => {
    if (selectedQuickHours) {
      setEndFromStart(startInput, endInput, selectedQuickHours);
    }
  });

  endInput.addEventListener("input", () => {
    if (eventKind === "piheno") {
      setSelectedQuickHours(null);
    }
  });

  formHost.addEventListener("click", (event) => {
    if (event.target === formHost) {
      closeTimelineEventForm();
    }
  });

  form.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  cancelBtn.addEventListener("click", () => {
    closeTimelineEventForm();
  });

  saveBtn.addEventListener("click", () => {
    const parsedStart = parseDateTimeInput(startInput.value);
    if (!parsedStart) {
      alert("Hibás kezdési időpont formátum.");
      return;
    }

    const parsedEnd = parseDateTimeInput(endInput.value);
    if (!parsedEnd) {
      alert("Hibás befejezési időpont formátum.");
      return;
    }

    const added = addManualDriverEvent(resource, eventKind, parsedStart, parsedEnd);
    if (added) {
      closeTimelineEventForm();
    }
  });

  startInput.focus();
  startInput.select();

  if (eventKind === "piheno") {
    setSelectedQuickHours(9);
    setEndFromStart(startInput, endInput, 9);
  }
}

function closeTimelineTransientUi() {
  closeTimelineContextMenu();
  closeTimelineEventForm();
}

function buildContextActions(resource, resourceType, clickedDate) {
  if (resourceType === "sofor") {
    return [
      {
        label: "Pihenő hozzáadása",
        action: () => askAndCreateManualEvent(resource, "piheno", clickedDate)
      },
      {
        label: "Szabadság hozzáadása",
        action: () => askAndCreateManualEvent(resource, "szabadsag", clickedDate)
      },
      {
        label: "Betegszabadság hozzáadása",
        action: () => askAndCreateManualEvent(resource, "beteg", clickedDate)
      }
    ];
  }

  if (resourceType === "vontato") {
    return [
      {
        label: "Rezsifutás hozzáadása",
        action: () => askAndCreateManualEvent(resource, "rezsifutas", clickedDate)
      },
      {
        label: "Állás hozzáadása",
        action: () => askAndCreateManualEvent(resource, "allas", clickedDate)
      },
      {
        label: "Szervíz hozzáadása",
        action: () => askAndCreateManualEvent(resource, "szerviz", clickedDate)
      }
    ];
  }

  if (resourceType === "potkocsi") {
    return [
      {
        label: "Standby hozzáadása",
        action: () => askAndCreateManualEvent(resource, "standby", clickedDate)
      },
      {
        label: "Állás hozzáadása",
        action: () => askAndCreateManualEvent(resource, "allas", clickedDate)
      },
      {
        label: "Szervíz hozzáadása",
        action: () => askAndCreateManualEvent(resource, "szerviz", clickedDate)
      }
    ];
  }

  return [
    {
      label: "Ehhez az erőforráshoz a menüopciók hamarosan érkeznek",
      disabled: true
    }
  ];
}

function showTimelineContextMenu(event, resource, resourceType, clickedDate) {
  closeTimelineContextMenu();

  const menu = document.createElement("div");
  menu.className = "timeline-context-menu";

  const actions = buildContextActions(resource, resourceType, clickedDate);
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
        closeTimelineContextMenu();
        item.action();
      });
    }

    menu.appendChild(btn);
  });

  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;

  document.body.appendChild(menu);
  openTimelineContextMenu = menu;
}

function showTimelineCustomContextMenu(event, actions) {
  closeTimelineContextMenu();

  const menu = document.createElement("div");
  menu.className = "timeline-context-menu";

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
        closeTimelineContextMenu();
        item.action();
      });
    }

    menu.appendChild(btn);
  });

  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;

  document.body.appendChild(menu);
  openTimelineContextMenu = menu;
}

function enableTimelineRowContextMenu(bar, resource, resourceType) {
  bar.addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const rect = bar.getBoundingClientRect();
    const localX = Math.max(0, Math.min(event.clientX - rect.left, TIMELINE_WIDTH));
    const clickedDate = snapToMinuteStep(
      addHours(getWindowStartDate(), localX / HOUR_WIDTH),
      REST_DRAG_SNAP_MINUTES
    );

    showTimelineContextMenu(event, resource, resourceType, clickedDate);
  });
}

function enableManualBlockContextMenu(blockEl, resource, block) {
  if (!block?.manual || block.type === "fuvar") {
    return;
  }

  blockEl.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();

    showTimelineCustomContextMenu(event, [
      {
        label: `${block.label || "Esemény"} törlése`,
        action: () => {
          const confirmed = confirm("Biztosan törlöd ezt az eseményt?");
          if (!confirmed) {
            return;
          }

          removeTimelineBlock(resource, block);
        }
      }
    ]);
  });
}

document.addEventListener("click", () => {
  closeTimelineContextMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTimelineTransientUi();
  }
});

// ============================================================
// Ütközésvizsgálat (collision detection)
// ============================================================
export function hasCollision(timeline, start, end) {
  const s = new Date(start);
  const e = new Date(end);

  return timeline.some(b => {
    if (b.synthetic) {
      return false;
    }

    const bs = new Date(b.start);
    const be = new Date(b.end);
    return (s < be && e > bs); 
  });
}

function getFuvarCategory(block) {
  if (block?.kategoria) {
    return block.kategoria;
  }

  if (!block?.fuvarId) {
    return "";
  }

  const fuvar = FUVAROK.find((item) => item.id === block.fuvarId);
  return fuvar?.kategoria || fuvar?.viszonylat || "";
}

function isFinitePositiveGap(startMs, endMs) {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs;
}

export function refreshAutoDeadheadBlocksForVontato(vontato) {
  if (!vontato) {
    return;
  }

  if (!Array.isArray(vontato.timeline)) {
    vontato.timeline = [];
  }

  const preserved = vontato.timeline.filter((block) => !(block?.synthetic && block?.autoDeadhead));
  const fuvarBlocks = preserved
    .filter((block) => block?.type === "fuvar" && !block?.synthetic)
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  const autoBlocks = [];

  for (let index = 0; index < fuvarBlocks.length - 1; index += 1) {
    const current = fuvarBlocks[index];
    const next = fuvarBlocks[index + 1];

    const currentCategory = getFuvarCategory(current);
    const nextCategory = getFuvarCategory(next);
    if (currentCategory !== "export" || nextCategory !== "import") {
      continue;
    }

    const currentEndMs = new Date(current.end).getTime();
    const nextStartMs = new Date(next.start).getTime();
    if (!isFinitePositiveGap(nextStartMs, currentEndMs)) {
      continue;
    }

    const distance = estimateAddressDistanceKm(current.lerakasCim, next.felrakasCim);
    if (!Number.isFinite(distance) || distance > AUTO_DEADHEAD_MAX_DISTANCE_KM) {
      continue;
    }

    autoBlocks.push({
      start: current.end,
      end: next.start,
      type: "rezsifutas",
      label: AUTO_DEADHEAD_LABEL,
      synthetic: true,
      autoDeadhead: true,
      sourceFuvarId: current.fuvarId,
      targetFuvarId: next.fuvarId,
      estDistanceKm: Math.round(distance)
    });
  }

  vontato.timeline = [...preserved, ...autoBlocks].sort((left, right) => {
    return new Date(left.start) - new Date(right.start);
  });
}

// ============================================================
// Időskála (header) kirajzolása (4 órás bontás)
// ============================================================
function renderTimeScale(container) {

  const header = document.createElement("div");
  header.className = "timeline-timescale";
  header.style.position = "relative";
  header.style.height = "40px";
  header.style.width = TIMELINE_WIDTH + "px";
  header.style.borderBottom = "1px solid #555";

  const base = getWindowStartDate();

  for (let h = 0; h <= TIMELINE_HOURS; h++) {

    const line = document.createElement("div");
    line.style.position = "absolute";
    line.style.left = (h * HOUR_WIDTH) + "px";
    line.style.top = "0px";
    line.style.width = "1px";
    line.style.height = "40px";
    line.style.background = (h % 4 === 0) ? "#777" : "#444";
    header.appendChild(line);

    // 4 óránként label
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

// ============================================================
// Egyetlen erőforrás timeline sor (sofor / vontato / potkocsi)
// ============================================================
function renderResourceRow(parent, r, type) {

  const row = document.createElement("div");
  row.className = "timeline-resource";
  row.dataset.resourceType = type;
  row.dataset.resourceId = r.id;

  const displayName = r.rendszam || r.nev || "-";
  const location = r.jelenlegi_pozicio?.hely || "-";
  row.dataset.searchText = normalizeSearchText(`${displayName} ${location}`);

  // MATCHING HIGHLIGHT (ok/bad/warn)
  if (r.matchGrade === "ok") {
    row.classList.add("match-ok");
  } else if (r.matchGrade === "bad") {
    row.classList.add("match-bad");
  } else if (r.matchGrade === "warn") {
    row.classList.add("match-warn");
  }

  // Erőforrás név része
  const name = document.createElement("div");
  name.className = "timeline-resource-name";

  if (r.matchGrade === "ok") {
    name.classList.add("match-ok");
  } else if (r.matchGrade === "bad") {
    name.classList.add("match-bad");
  } else if (r.matchGrade === "warn") {
    name.classList.add("match-warn");
  }

  name.dataset.resourceType = type;
  name.dataset.resourceId = r.id;

  name.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      ${type === "sofor" ? "👤" : type === "vontato" ? "🚛" : "🚚"}
      <strong>${displayName}</strong>
    </div>
    <div style="font-size:11px;opacity:0.6;">
      📍 ${location}
    </div>
  `;

  // Timeline sáv
  const bar = document.createElement("div");
  bar.className = "timeline-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.height = "78px";
  bar.style.position = "relative";

  const focusedRange = getFocusedFuvarRange();
  const focusedImportFuvar = getFocusedImportFuvar();
  appendFocusedFuvarMarker(bar, focusedRange);
  enableTimelineRowContextMenu(bar, r, type);

  // Timeline blokkok kirajzolása
  if (r.timeline) {
    r.timeline.forEach(block => {
      if (type === "sofor" && block?.synthetic && block.type !== "fuvar") {
        return;
      }

      const visibleBlock = clipBlockToWindow(block);
      if (!visibleBlock) {
        return;
      }

      const div = document.createElement("div");
      div.className = "timeline-block";
      div.classList.add(visibleBlock.type);

      const left = dateToPosition(visibleBlock.renderStart);
      const width = blockWidth(visibleBlock.renderStart, visibleBlock.renderEnd);

      div.style.left = left + "px";
      div.style.width = width + "px";

      if (visibleBlock.type === "fuvar" && visibleBlock.kategoria) {
        const palette = getCategoryPalette(visibleBlock.kategoria);
        div.style.setProperty("--timeline-block-bg", palette.border);
        div.style.setProperty("--timeline-block-border", palette.borderStrong);
        div.style.setProperty("--timeline-block-glow", palette.glow);
        div.style.setProperty("--timeline-block-accent", palette.accent);
      }

      const proximityHint = getExportImportProximityHint(visibleBlock, focusedImportFuvar);
      const proximityHintHtml = proximityHint
        ? `<span class="timeline-import-link-hint">↔ ${formatDistanceKm(proximityHint.distance)} • Δt ${formatSignedHours(proximityHint.deltaHours)}</span>`
        : "";

      div.innerHTML = `
        <div class="timeline-block-title"><strong>${visibleBlock.label}</strong>${proximityHintHtml}</div>
        ${renderBlockTags(visibleBlock)}
        <div class="timeline-block-time">
          ${formatDate(visibleBlock.start)} → ${formatDate(visibleBlock.end)}
        </div>
      `;

      if (type === "sofor" && block.type === "piheno") {
        const restFlag = document.createElement("div");
        restFlag.className = "timeline-rest-flag";
        restFlag.textContent = `${formatDurationHours(getBlockDurationHours(block))}h`;
        div.appendChild(restFlag);
      }

      makeRestBlockDraggable(div, bar, r, block, type);
      enableManualBlockContextMenu(div, r, block);

      bar.appendChild(div);
    });
  }

  row.appendChild(name);
  row.appendChild(bar);
  parent.appendChild(row);
}

// ============================================================
// TELJES TIMELINE RENDER
// ============================================================
export function renderTimeline(containerId, groups) {
  const container = document.getElementById(containerId);
  closeTimelineTransientUi();
  container.innerHTML = "";
  lastTimelineRenderState = { containerId, groups };
  const dropoffView = buildDropoffResourceView(groups);

  renderTimelinePager(container, containerId, groups, dropoffView);

  // TimeScale felül
  renderTimeScale(container);
  updateStickyHeaderOffset(container);

  if (dropoffVehiclesFilterActive && dropoffView.totalMatched === 0) {
    const info = document.createElement("div");
    info.className = "timeline-filter-empty";
    info.textContent = "Nincs olyan erőforrás, ahol az export lerakást követő 4 órában hiányzik import fuvar.";
    container.appendChild(info);
  }

  // Csoportok (sofőr / vontató / pótkocsi)
  groups.forEach(g => {
    const group = document.createElement("section");
    group.className = "timeline-group";

    const type = getKindFromGroupName(g.name);

    const header = document.createElement("div");
    header.className = "timeline-group-header";

    const title = document.createElement("button");
    title.type = "button";
    title.className = "timeline-group-title";

    const label = document.createElement("span");
    label.className = "timeline-group-title-text";
    label.textContent = `${g.icon} ${g.name}`;

    const icon = document.createElement("span");
    icon.className = "timeline-group-toggle-icon";
    icon.setAttribute("aria-hidden", "true");

    title.appendChild(label);
    title.appendChild(icon);

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "timeline-group-search";
    searchInput.placeholder = "Keresés";
    searchInput.value = timelineSearchTerms[type] || "";
    searchInput.setAttribute("aria-label", `${g.name} keresés`);

    const body = document.createElement("div");
    body.className = "timeline-group-body";

    const isCollapsed = collapsedTimelineGroups.has(g.name);
    if (isCollapsed) {
      title.classList.add("collapsed");
      title.setAttribute("aria-expanded", "false");
      body.hidden = true;
    } else {
      title.setAttribute("aria-expanded", "true");
    }

    title.addEventListener("click", () => {
      const collapsed = title.classList.toggle("collapsed");
      title.setAttribute("aria-expanded", String(!collapsed));
      body.hidden = collapsed;

      if (collapsed) {
        collapsedTimelineGroups.add(g.name);
      } else {
        collapsedTimelineGroups.delete(g.name);
      }
    });

    searchInput.addEventListener("input", () => {
      timelineSearchTerms[type] = searchInput.value;
      applySearchToTimelineGroupBody(body, searchInput.value);
    });

    header.appendChild(title);
    header.appendChild(searchInput);
    group.appendChild(header);
    group.appendChild(body);
    container.appendChild(group);

    const baseList = dropoffVehiclesFilterActive
      ? (g.list || []).filter((resource) => dropoffView.insightByResourceKey.has(`${type}:${resource.id}`))
      : g.list;

    const sortedList = dropoffVehiclesFilterActive
      ? baseList
        .map((resource, index) => ({ resource, index }))
        .sort((left, right) => {
          const leftInsight = dropoffView.insightByResourceKey.get(`${type}:${left.resource.id}`);
          const rightInsight = dropoffView.insightByResourceKey.get(`${type}:${right.resource.id}`);

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
        .map(({ resource }) => resource)
      : sortResourcesByMatch(baseList);

    sortedList.forEach(r => {
      renderResourceRow(body, r, type);
    });

    applySearchToTimelineGroupBody(body, timelineSearchTerms[type] || "");
  });

  syncPinnedResourceNames(container);
}

// ============================================================
// Fuvar blokk hozzáadása (B-modell – csak hozzárendeléskor)
// ============================================================
export function addFuvarBlockToTimeline(resource, fuvar) {

  evaluateFuvarTags(fuvar);

  if (!resource.timeline) resource.timeline = [];

  // Ütközés ellenőrzése
  if (hasCollision(resource.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    alert("⚠️ Ez az erőforrás foglalt ebben az időszakban!");
    return false;
  }

  resource.timeline.push({
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    type: "fuvar",
    label: fuvar.megnevezes,
    fuvarId: fuvar.id,
    felrakasCim: fuvar.felrakas.cim,
    lerakasCim: fuvar.lerakas.cim,
    adr: fuvar.adr,
    surgos: fuvar.surgos,
    kategoria: fuvar.kategoria
  });

  return true;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

function getWindowStartDate() {
  return addHours(getBaseDate(), timelineOffsetHours);
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

function getKindFromGroupName(name) {
  if (name.includes("Sofőr")) return "sofor";
  if (name.includes("Vontató")) return "vontato";
  return "potkocsi";
}

function ensureDataForWindow(groups) {
  // A timeline-t nem töltjük automatikus dummy eseményekkel, minden esemény kézi felvétel.
  void groups;
}

function renderTimelinePager(container, containerId, groups, dropoffView) {
  const nav = document.createElement("div");
  nav.className = "timeline-nav";

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn timeline-nav-btn";
  prevBtn.textContent = "← Előző 72 óra";

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn timeline-nav-btn";
  nextBtn.textContent = "Következő 72 óra →";

  const label = document.createElement("div");
  label.className = "timeline-nav-label";
  label.textContent = formatWindowLabel(getWindowStartDate(), getWindowEndDate());

  const dropoffBtn = document.createElement("button");
  dropoffBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
  dropoffBtn.type = "button";
  dropoffBtn.setAttribute("aria-pressed", String(dropoffVehiclesFilterActive));
  dropoffBtn.textContent = `Lerakó autók (${dropoffView.totalMatched})`;
  dropoffBtn.classList.toggle("active", dropoffVehiclesFilterActive);

  prevBtn.addEventListener("click", () => {
    timelineOffsetHours -= TIMELINE_HOURS;
    ensureDataForWindow(groups);
    renderTimeline(containerId, groups);
    notifyTimelineWindowChanged();
  });

  nextBtn.addEventListener("click", () => {
    timelineOffsetHours += TIMELINE_HOURS;
    ensureDataForWindow(groups);
    renderTimeline(containerId, groups);
    notifyTimelineWindowChanged();
  });

  dropoffBtn.addEventListener("click", () => {
    dropoffVehiclesFilterActive = !dropoffVehiclesFilterActive;
    renderTimeline(containerId, groups);
  });

  nav.appendChild(prevBtn);
  nav.appendChild(label);
  nav.appendChild(nextBtn);
  nav.appendChild(dropoffBtn);
  container.appendChild(nav);
}
