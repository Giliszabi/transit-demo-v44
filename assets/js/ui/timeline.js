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
import { getCategoryPalette } from "./colors.js";
import { buildSoforMetaTooltip, renderSoforMetaBadges } from "./sofor-display-meta.js";

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
let dayVehicleFilterMode = "all";
let dayVehicleFilterAnchor = null;
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
  vac: { lat: 47.7826, lng: 19.1332 },
  dunakeszi: { lat: 47.6364, lng: 19.1386 },
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

// =======================================================
// AKTÍV FUVARSZERVEZÉSI PROFIL (opcionális, modul-szintű)
// =======================================================
let _activeDispatchProfile = null;

/**
 * Beállítja az aktív dispatch profil adatait a timeline-modulban.
 * null → alapviselkedés, nincs profil-hatás.
 */
export function setDispatchProfile(profileId, params) {
  _activeDispatchProfile = params ? { _profileId: profileId, ...params } : null;
}

/** Visszaadja az érvényes rezsi-futás riasztási küszöböt (km). */
function getEffectiveDeadheadAlertKm() {
  if (_activeDispatchProfile?._profileId === "cost-saving") {
    return _activeDispatchProfile.deadheadAlertKm ?? AUTO_DEADHEAD_MAX_DISTANCE_KM;
  }
  return AUTO_DEADHEAD_MAX_DISTANCE_KM;
}
const KORNYE_HUB_ADDRESS = "Magyarország, Környe, Ipari Park";
const AVERAGE_TRANSIT_SPEED_KMH = 62;
const MIN_TRANSIT_HOURS = 0.5;
const MAX_TRANSIT_HOURS = 14;
const RECOMMENDATION_WAIT_PENALTY_PER_HOUR = 8;
const RECOMMENDATION_ASSIGNED_PENALTY = 120;
const RECOMMENDATION_FALLBACK_DISTANCE_KM = 400;
const ELOFUTAS_LABEL = "Előfutás";
const UTOFUTAS_LABEL = "Utófutás";
const AUTO_DRIVER_STATE_LABELS = {
  piheno: "Pihenő (automata)",
  vezetes: "Vezetés"
};
const DRIVER_STATE_DEBUG = true;
let activeTimelineHoverTooltip = null;

function ensureTimelineHoverTooltip() {
  if (activeTimelineHoverTooltip && activeTimelineHoverTooltip.isConnected) {
    return activeTimelineHoverTooltip;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "timeline-hover-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  activeTimelineHoverTooltip = tooltip;
  return tooltip;
}

function hideTimelineHoverTooltip() {
  if (!activeTimelineHoverTooltip) {
    return;
  }

  activeTimelineHoverTooltip.hidden = true;
}

function showTimelineHoverTooltip(content, clientX, clientY) {
  const tooltip = ensureTimelineHoverTooltip();
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

function bindTimelineBlockHoverTooltip(target, content) {
  if (!target || !content) {
    return;
  }

  target.addEventListener("mouseenter", (event) => {
    showTimelineHoverTooltip(content, event.clientX, event.clientY);
  });

  target.addEventListener("mousemove", (event) => {
    showTimelineHoverTooltip(content, event.clientX, event.clientY);
  });

  target.addEventListener("mouseleave", () => {
    hideTimelineHoverTooltip();
  });
}

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

const JARAT_FUVAR_REVENUE_PER_KM = 420;
const JARAT_FUVAR_COST_PER_KM = 255;
const JARAT_EMPTY_COST_PER_KM = 185;
const JARAT_UTOFUTAS_COST_PER_KM = 225;
const JARAT_ALLAS_COST_PER_HOUR = 4200;

function formatMoneyHuf(value) {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return `${safe.toLocaleString("hu-HU")} Ft`;
}

function getBlockDistanceKmValue(block) {
  if (Number.isFinite(block?.estDistanceKm)) {
    return Number(block.estDistanceKm);
  }

  if (Number.isFinite(block?.tavolsagKm)) {
    return Number(block.tavolsagKm);
  }

  if (block?.type === "fuvar") {
    const fuvar = findFuvarByTimelineBlock(block);
    if (Number.isFinite(fuvar?.tavolsag_km)) {
      return Number(fuvar.tavolsag_km);
    }
  }

  const fromAddress = block?.fromAddress || block?.felrakasCim || "";
  const toAddress = block?.toAddress || block?.lerakasCim || "";
  const estimated = estimateAddressDistanceKm(fromAddress, toAddress);
  return Number.isFinite(estimated) ? Math.round(estimated) : Number.NaN;
}

function getBlockFinancials(block) {
  const distanceKm = getBlockDistanceKmValue(block);
  const durationHours = getBlockDurationHours(block);
  let revenue = 0;
  let cost = 0;

  if (block?.type === "fuvar") {
    if (Number.isFinite(distanceKm)) {
      revenue = distanceKm * JARAT_FUVAR_REVENUE_PER_KM;
      cost = distanceKm * JARAT_FUVAR_COST_PER_KM;
    }
  } else if (block?.type === "elofutas" || block?.type === "rezsifutas") {
    if (Number.isFinite(distanceKm)) {
      cost = distanceKm * JARAT_EMPTY_COST_PER_KM;
    }
  } else if (block?.type === "utofutas") {
    if (Number.isFinite(distanceKm)) {
      cost = distanceKm * JARAT_UTOFUTAS_COST_PER_KM;
    }
  } else if (block?.type === "allas") {
    cost = durationHours * JARAT_ALLAS_COST_PER_HOUR;
  }

  return {
    distanceKm,
    durationHours,
    revenue,
    cost,
    profit: revenue - cost
  };
}

function isJaratRelevantBlockType(type) {
  return ["elofutas", "rezsifutas", "fuvar", "utofutas", "allas"].includes(type);
}

function buildJaratMetrics(blocks) {
  const metrics = {
    emptyKm: 0,
    revenue: 0,
    cost: 0,
    profit: 0
  };

  blocks.forEach((block) => {
    const financials = getBlockFinancials(block);

    if ((block?.type === "elofutas" || block?.type === "rezsifutas") && Number.isFinite(financials.distanceKm)) {
      metrics.emptyKm += financials.distanceKm;
    }

    metrics.revenue += financials.revenue;
    metrics.cost += financials.cost;
  });

  metrics.profit = metrics.revenue - metrics.cost;
  return metrics;
}

function buildCompletedJaratInfo(timeline) {
  const byBlock = new Map();
  const summaries = [];
  const ordered = (timeline || [])
    .filter((block) => !block?.synthetic || block?.autoLeadRun || block?.autoReposition || block?.autoUtofutas || block?.autoDeadhead || block?.autoReturnToHub)
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  let segment = [];
  let hasFuvar = false;
  let jaratCounter = 0;

  const flush = () => {
    segment = [];
    hasFuvar = false;
  };

  ordered.forEach((block) => {
    if (!isJaratRelevantBlockType(block?.type)) {
      flush();
      return;
    }

    segment.push(block);
    if (block?.type === "fuvar") {
      hasFuvar = true;

      const pickupAddress = block?.felrakasCim || "";
      const dropoffAddress = block?.lerakasCim || "";
      const standaloneKornyeRoundtrip = isKornyeAddress(pickupAddress) && isKornyeAddress(dropoffAddress);

      if (standaloneKornyeRoundtrip) {
        jaratCounter += 1;
        const metrics = buildJaratMetrics([block]);
        const jaratId = `JR-${jaratCounter}`;

        byBlock.set(block, {
          jaratId,
          metrics
        });

        summaries.push({
          jaratId,
          metrics,
          blockCount: 1,
          end: block.end
        });

        flush();
        return;
      }
    }

    if (block?.type === "utofutas" && hasFuvar) {
      jaratCounter += 1;
      const metrics = buildJaratMetrics(segment);
      const jaratId = `JR-${jaratCounter}`;

      segment.forEach((segmentBlock) => {
        byBlock.set(segmentBlock, {
          jaratId,
          metrics
        });
      });

      summaries.push({
        jaratId,
        metrics,
        blockCount: segment.length,
        end: block.end
      });

      flush();
    }
  });

  return {
    byBlock,
    summaries
  };
}

function buildTimelineBlockTooltip(block, jaratMeta = null) {
  const financials = getBlockFinancials(block);
  const distanceLabel = Number.isFinite(financials.distanceKm)
    ? `${Math.round(financials.distanceKm)} km`
    : "n/a";

  const lines = [];

  if (block?.type === "fuvar") {
    const linkedFuvar = findFuvarByTimelineBlock(block);
    const pickupAddress = block?.felrakasCim || linkedFuvar?.felrakas?.cim || "";
    const dropoffAddress = block?.lerakasCim || linkedFuvar?.lerakas?.cim || "";
    const transitRoleInfo = getDomesticTransitRoleInfo(linkedFuvar);

    lines.push(`${getCompactLocation(pickupAddress)} → ${getCompactLocation(dropoffAddress)}`);
    if (transitRoleInfo?.label) {
      lines.push(`Kapcsolt szakasz: ${transitRoleInfo.label}`);
    }
    lines.push(`Idő: ${formatDate(block.start)} → ${formatDate(block.end)}`);
    lines.push(`Táv: ${distanceLabel}`);
    lines.push(`Költség: ${formatMoneyHuf(financials.cost)}`);
    lines.push(`Bevétel: ${formatMoneyHuf(financials.revenue)}`);
    lines.push(`Eredményesség: ${formatMoneyHuf(financials.profit)}`);
  } else {
    lines.push(`${block?.label || "Szakasz"}`);
    lines.push(`${formatDate(block.start)} → ${formatDate(block.end)}`);
    lines.push(`Táv: ${distanceLabel}`);
    lines.push(`Költség: ${formatMoneyHuf(financials.cost)}`);
  }

  if (jaratMeta?.jaratId) {
    lines.push(`Kész járat: ${jaratMeta.jaratId}`);

    // cost-saving profil: rezsi-futás riasztás
    if (block?.autoDeadhead && Number.isFinite(financials.distanceKm)) {
      const alertKm = getEffectiveDeadheadAlertKm();
      if (financials.distanceKm > alertKm) {
        lines.push(`⚠ Rezsi-futás > ${alertKm} km küszöb (${Math.round(financials.distanceKm)} km)`);
      }
    }

  }

  return lines.join("\n");
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

// ======================================================================
// SOF\u0150R RENDEZ\u00c9SI SEG\u00c9DF\u00dcGGV\u00c9NYEK (timeline)
// ======================================================================

function getSoforSortValueTL(sofor, columnId) {
  const driving = sofor.driving || {};
  if (columnId === "daily") {
    return Math.max(0, (driving.dailyLimitHours || 0) - (driving.dailyDrivenHours || 0));
  }
  if (columnId === "weekly") {
    return Math.max(0, (driving.weeklyLimitHours || 0) - (driving.weeklyDrivenHours || 0));
  }
  if (columnId === "match") {
    // Dummy score: biztosan adjon látható sorrendet a Matching gombra.
    const idNum = Number.parseInt(String(sofor?.id || "").replace(/\D+/g, ""), 10) || 0;
    const name = getSoforSortNameTL(sofor);
    const nameScore = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100;
    return idNum * 100 + nameScore;
  }
  return 0;
}

function getSoforSortNameTL(sofor) {
  return String(sofor?.nev || "").toLocaleLowerCase("hu-HU");
}

function applySoforSortTL(list) {
  const state = window._soforSortState;
  if (!state?.columnId) {
    return sortResourcesByMatch(list);
  }
  const dir = state.direction === "asc" ? 1 : -1;
  if (state.columnId === "abc") {
    return [...list].sort((a, b) => getSoforSortNameTL(a).localeCompare(getSoforSortNameTL(b), "hu-HU") * dir);
  }
  return [...list].sort((a, b) => {
    return (getSoforSortValueTL(a, state.columnId) - getSoforSortValueTL(b, state.columnId)) * dir;
  });
}

function buildTimelineSoforSortBar() {
  const container = document.createElement("div");
  container.className = "timeline-sofor-sort-bar";

  const COLS = [
    { col: "abc", label: "ABC" },
    { col: "daily", label: "Napi id\u0151" },
    { col: "weekly", label: "Heti id\u0151" },
    { col: "match", label: "Matching" }
  ];

  COLS.forEach(({ col, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "timeline-sofor-sort-btn";
    btn.dataset.sortColumn = col;
    btn.title = `Rendez\u00e9s: ${label}`;
    const state = window._soforSortState;
    const isActive = state?.columnId === col;
    if (isActive) btn.classList.add("active");
    const arrow = isActive ? (state.direction === "asc" ? " \u2191" : " \u2193") : "";
    btn.textContent = label + arrow;

    [("mousedown"), ("keydown")].forEach((ev) => btn.addEventListener(ev, (e) => e.stopPropagation()));

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = window._soforSortState || { columnId: null, direction: "desc" };
      window._soforSortState = {
        columnId: col,
        direction: cur.columnId === col && cur.direction === "desc" ? "asc" : "desc"
      };
      window.dispatchEvent(new CustomEvent("sofor:sort-changed"));
    });

    container.appendChild(btn);
  });

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "timeline-sofor-sort-btn timeline-sofor-sort-btn-reset";
  resetBtn.dataset.sortReset = "true";
  resetBtn.title = "Rendezés visszaállítása";
  resetBtn.setAttribute("aria-label", "Rendezés visszaállítása");
  resetBtn.textContent = "X";
  resetBtn.disabled = !Boolean(window._soforSortState?.columnId);
  [("mousedown"), ("keydown")].forEach((ev) => resetBtn.addEventListener(ev, (e) => e.stopPropagation()));
  resetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    window._soforSortState = { columnId: null, direction: "desc" };
    window.dispatchEvent(new CustomEvent("sofor:sort-changed"));
  });
  container.appendChild(resetBtn);

  return container;
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

function getLocalDayBounds(anchorDate = new Date()) {
  const start = new Date(anchorDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    label: start.toLocaleDateString("hu-HU")
  };
}

function getAssignedFuvarBlocksOnDay(resource, dayStartMs, dayEndMs) {
  if (!Array.isArray(resource?.timeline)) {
    return [];
  }

  return resource.timeline.filter((block) => {
    if (!block || block.type !== "fuvar" || block.synthetic) {
      return false;
    }

    const startMs = new Date(block.start).getTime();
    const endMs = new Date(block.end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return false;
    }

    return startMs < dayEndMs && endMs > dayStartMs;
  });
}

function hasDepartureFromHubOnDay(resource, dayStartMs, dayEndMs) {
  const dayBlocks = getAssignedFuvarBlocksOnDay(resource, dayStartMs, dayEndMs);

  return dayBlocks.some((block) => {
    const startMs = new Date(block.start).getTime();
    if (!Number.isFinite(startMs) || startMs < dayStartMs || startMs >= dayEndMs) {
      return false;
    }

    return isKornyeAddress(block.felrakasCim || "");
  });
}

function matchesDayVehicleFilter(resource, mode, dayStartMs, dayEndMs) {
  if (mode === "all") {
    return true;
  }

  const dayBlocks = getAssignedFuvarBlocksOnDay(resource, dayStartMs, dayEndMs);

  if (mode === "departingToday") {
    return hasDepartureFromHubOnDay(resource, dayStartMs, dayEndMs);
  }

  if (mode === "idleToday") {
    return dayBlocks.length === 0;
  }

  return true;
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

  if (block.spedicioOperationType === "offer-request") {
    tags.push({ className: "timeline-tag-ajanlatkeres", label: "AJÁNLATKÉRÉS" });
  }

  if (block.surgos) {
    tags.push({ className: "timeline-tag-surgos", label: "SÜRGŐS" });
  }

  return tags;
}

function renderBlockTags(block) {
  const tags = getBlockTags(block);

  return `
    <div class="timeline-block-tags${tags.length === 0 ? " empty" : ""}">
      ${tags.map((tag) => `<span class="timeline-tag ${tag.className}">${tag.label}</span>`).join("")}
    </div>
  `;
}

function formatCompactTimelineDateTime(dateStr) {
  const date = new Date(dateStr);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getCompactLocation(address) {
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

function getFuvarRouteForBlock(block) {
  const linkedFuvar = findFuvarByTimelineBlock(block);
  const pickupAddress = block?.felrakasCim || linkedFuvar?.felrakas?.cim || "";
  const dropoffAddress = block?.lerakasCim || linkedFuvar?.lerakas?.cim || "";

  return {
    pickup: getCompactLocation(pickupAddress),
    dropoff: getCompactLocation(dropoffAddress)
  };
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

function isKornyeAddress(address) {
  return normalizeSearchText(address).includes("kornye");
}

function isHungarianAddress(address) {
  const normalized = normalizeSearchText(address);
  return normalized.includes("magyarorszag") || normalized.includes("hungary") || isKornyeAddress(address);
}

function estimateTransitDurationHours(fromAddress, toAddress) {
  const distance = estimateAddressDistanceKm(fromAddress, toAddress);
  if (!Number.isFinite(distance)) {
    return 2;
  }

  const hours = distance / AVERAGE_TRANSIT_SPEED_KMH;
  return Math.min(MAX_TRANSIT_HOURS, Math.max(MIN_TRANSIT_HOURS, hours));
}

function buildTransitBlock({
  startMs,
  endMs,
  type,
  label,
  fromAddress,
  toAddress,
  sourceFuvarId = null,
  targetFuvarId = null,
  flags = {}
}) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }

  const distance = estimateAddressDistanceKm(fromAddress, toAddress);

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    type,
    label,
    synthetic: true,
    sourceFuvarId,
    targetFuvarId,
    fromAddress,
    toAddress,
    estDistanceKm: Number.isFinite(distance) ? Math.round(distance) : undefined,
    ...flags
  };
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
      label: `Előfutás • ${linkedExportFuvar.id}`,
      linkedFuvar: linkedExportFuvar
    };
  }

  const linkedImportFuvar = getLinkedImportFuvarForDomestic(fuvar);
  if (linkedImportFuvar) {
    return {
      role: "utofutas",
      label: `Utófutás • ${linkedImportFuvar.id}`,
      linkedFuvar: linkedImportFuvar
    };
  }

  return null;
}

function getDomesticTransitRoleInfoForBlock(block) {
  const fuvar = findFuvarByTimelineBlock(block);
  if (!fuvar) {
    return null;
  }

  return getDomesticTransitRoleInfo(fuvar);
}

function isExplicitImportToDomesticUtofutas(prevBlock, currentBlock) {
  const prevFuvar = findFuvarByTimelineBlock(prevBlock);
  const currentFuvar = findFuvarByTimelineBlock(currentBlock);

  if (!prevFuvar || !currentFuvar) {
    return false;
  }

  const prevCategory = getFuvarCategoryFromFuvar(prevFuvar);
  const currentCategory = getFuvarCategoryFromFuvar(currentFuvar);
  if (prevCategory !== "import" || currentCategory !== "belfold") {
    return false;
  }

  const linkedImportFuvar = getLinkedImportFuvarForDomestic(currentFuvar);
  if (!linkedImportFuvar || linkedImportFuvar.id !== prevFuvar.id) {
    return false;
  }

  const importDropAddress = prevFuvar?.lerakas?.cim || prevBlock?.lerakasCim || "";
  const domesticPickupAddress = currentFuvar?.felrakas?.cim || currentBlock?.felrakasCim || "";

  // Utófutás explicit cross-dock eset: import Környére érkezik, és a belföld Környéről indul tovább.
  if (!isKornyeAddress(importDropAddress) || !isKornyeAddress(domesticPickupAddress)) {
    return false;
  }

  const prevEndMs = new Date(prevBlock?.end || prevFuvar?.lerakas?.ido || "").getTime();
  const currentStartMs = new Date(currentBlock?.start || currentFuvar?.felrakas?.ido || "").getTime();
  return Number.isFinite(prevEndMs) && Number.isFinite(currentStartMs) && currentStartMs >= prevEndMs;
}

function isFullyAssignedFuvar(fuvar) {
  return Boolean(fuvar?.assignedSoforId && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId);
}

function getRecommendationCategoryBonus(anchorCategory, candidateCategory) {
  if (!anchorCategory || !candidateCategory) {
    return 0;
  }

  if ((anchorCategory === "export" && candidateCategory === "import")
    || (anchorCategory === "import" && candidateCategory === "export")) {
    return 18;
  }

  if (anchorCategory !== candidateCategory) {
    return 6;
  }

  return 0;
}

function buildNextFuvarRecommendationEntry(anchorBlock, fuvar, anchorEndMs) {
  const startMs = new Date(fuvar?.felrakas?.ido || "").getTime();
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const distance = estimateAddressDistanceKm(anchorBlock.lerakasCim, fuvar.felrakas.cim);
  const transitHours = estimateTransitDurationHours(anchorBlock.lerakasCim, fuvar.felrakas.cim);
  const arrivalMs = anchorEndMs + Math.round(transitHours * 3600 * 1000);
  const slackMs = startMs - arrivalMs;
  const actionable = !isFullyAssignedFuvar(fuvar);
  const reachable = slackMs >= 0;
  const normalizedDistance = Number.isFinite(distance) ? distance : RECOMMENDATION_FALLBACK_DISTANCE_KM;
  const waitHours = reachable ? slackMs / (1000 * 60 * 60) : 0;
  const score = normalizedDistance
    + (waitHours * RECOMMENDATION_WAIT_PENALTY_PER_HOUR)
    + (actionable ? 0 : RECOMMENDATION_ASSIGNED_PENALTY)
    - getRecommendationCategoryBonus(anchorBlock.kategoria, getFuvarCategoryFromFuvar(fuvar));

  return {
    fuvar,
    startMs,
    distance,
    transitHours,
    slackMs,
    actionable,
    reachable,
    score
  };
}

function compareRecommendationEntries(left, right) {
  if (left.reachable !== right.reachable) {
    return left.reachable ? -1 : 1;
  }

  if (left.actionable !== right.actionable) {
    return left.actionable ? -1 : 1;
  }

  if (left.score !== right.score) {
    return left.score - right.score;
  }

  return left.startMs - right.startMs;
}

function findNextFuvarRecommendation(lastBlock, allFuvarok) {
  if (!lastBlock?.end || !lastBlock?.lerakasCim) {
    return null;
  }

  const lastEndMs = new Date(lastBlock.end).getTime();
  if (!Number.isFinite(lastEndMs)) {
    return null;
  }

  const candidates = allFuvarok
    .filter((fuvar) => fuvar?.id !== lastBlock.fuvarId)
    .filter((fuvar) => fuvar?.felrakas?.ido && fuvar?.felrakas?.cim)
    .map((fuvar) => buildNextFuvarRecommendationEntry(lastBlock, fuvar, lastEndMs))
    .filter(Boolean)
    .sort(compareRecommendationEntries);

  return candidates.find((entry) => entry.reachable && entry.actionable) || null;
}

export function refreshAutoTransitBlocksForResource(resource, allFuvarok = FUVAROK) {
  if (!resource) {
    return;
  }

  if (!Array.isArray(resource.timeline)) {
    resource.timeline = [];
  }

  const preserved = resource.timeline.filter((block) => {
    return !(block?.synthetic && (
      block?.autoDeadhead
      || block?.autoLeadRun
      || block?.autoReposition
      || block?.autoWaiting
      || block?.autoUtofutas
      || block?.autoReturnToHub
      || block?.autoDomesticRecommendation
    ));
  });

  const fuvarBlocks = preserved
    .filter((block) => block?.type === "fuvar" && !block?.synthetic)
    .map((block) => {
      const linkedFuvar = findFuvarByTimelineBlock(block);
      if (!linkedFuvar) {
        return block;
      }

      return {
        ...block,
        fuvarId: block?.fuvarId || linkedFuvar.id,
        felrakasCim: block?.felrakasCim || linkedFuvar?.felrakas?.cim || "",
        lerakasCim: block?.lerakasCim || linkedFuvar?.lerakas?.cim || "",
        kategoria: block?.kategoria || linkedFuvar?.kategoria || linkedFuvar?.viszonylat || ""
      };
    })
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  const autoBlocks = [];

  for (let index = 0; index < fuvarBlocks.length; index += 1) {
    const current = fuvarBlocks[index];
    const prev = index > 0 ? fuvarBlocks[index - 1] : null;
    const currentCategory = getFuvarCategory(current);

    const currentStartMs = new Date(current.start).getTime();
    const currentPickup = current.felrakasCim || "";

    if (Number.isFinite(currentStartMs) && currentPickup && !isKornyeAddress(currentPickup)) {
      if (!prev) {
        const leadHours = estimateTransitDurationHours(KORNYE_HUB_ADDRESS, currentPickup);
        const leadMs = Math.round(leadHours * 3600 * 1000);
        const leadType = "rezsifutas";
        const leadLabel = AUTO_DEADHEAD_LABEL;
        const leadBlock = buildTransitBlock({
          startMs: currentStartMs - leadMs,
          endMs: currentStartMs,
          type: leadType,
          label: leadLabel,
          fromAddress: KORNYE_HUB_ADDRESS,
          toAddress: currentPickup,
          targetFuvarId: current.fuvarId,
          flags: { autoDeadhead: true, autoReposition: true }
        });

        if (leadBlock) {
          autoBlocks.push(leadBlock);
        }
      } else {
        const prevEndMs = new Date(prev.end).getTime();
        const prevDrop = prev.lerakasCim || "";
        const sameAddress = normalizeSearchText(prevDrop) === normalizeSearchText(currentPickup);

        if (!sameAddress && isFinitePositiveGap(currentStartMs, prevEndMs)) {
          const gapMs = currentStartMs - prevEndMs;
          const estimatedMs = Math.round(estimateTransitDurationHours(prevDrop, currentPickup) * 3600 * 1000);
          const blockDurationMs = Math.min(gapMs, estimatedMs);
          const repositionEndMs = prevEndMs + blockDurationMs;

          let repositionType;
          let repositionLabel;
          let repositionFlags;

          if (currentCategory === "belfold") {
            if (isExplicitImportToDomesticUtofutas(prev, current)) {
              repositionType = "utofutas";
              repositionLabel = UTOFUTAS_LABEL;
              repositionFlags = { autoUtofutas: true, autoReposition: true };
            } else {
              repositionType = "rezsifutas";
              repositionLabel = AUTO_DEADHEAD_LABEL;
              repositionFlags = { autoDeadhead: true, autoReposition: true };
            }
          } else {
            repositionType = "rezsifutas";
            repositionLabel = AUTO_DEADHEAD_LABEL;
            repositionFlags = {
              autoReposition: true,
              autoDeadhead: true
            };
          }

          const repositionBlock = buildTransitBlock({
            startMs: prevEndMs,
            endMs: Math.min(currentStartMs, repositionEndMs),
            type: repositionType,
            label: repositionLabel,
            fromAddress: prevDrop,
            toAddress: currentPickup,
            sourceFuvarId: prev.fuvarId,
            targetFuvarId: current.fuvarId,
            flags: repositionFlags
          });

          if (repositionBlock) {
            autoBlocks.push(repositionBlock);
          }

          const waitingStartMs = Math.min(currentStartMs, repositionEndMs);
          if (currentStartMs > waitingStartMs) {
            const waitingBlock = buildTransitBlock({
              startMs: waitingStartMs,
              endMs: currentStartMs,
              type: "allas",
              label: "Állás (automata)",
              fromAddress: currentPickup,
              toAddress: currentPickup,
              sourceFuvarId: prev.fuvarId,
              targetFuvarId: current.fuvarId,
              flags: { autoWaiting: true, autoReposition: true }
            });

            if (waitingBlock) {
              autoBlocks.push(waitingBlock);
            }
          }
        }
      }
    }

  }

  const lastFuvar = fuvarBlocks[fuvarBlocks.length - 1] || null;
  if (lastFuvar?.lerakasCim && !isKornyeAddress(lastFuvar.lerakasCim)) {
    const lastEndMs = new Date(lastFuvar.end).getTime();
    if (Number.isFinite(lastEndMs)) {
      const recommendation = findNextFuvarRecommendation(lastFuvar, allFuvarok);

      if (!recommendation?.fuvar) {
        const returnHours = estimateTransitDurationHours(lastFuvar.lerakasCim, KORNYE_HUB_ADDRESS);
        const returnBlock = buildTransitBlock({
          startMs: lastEndMs,
          endMs: lastEndMs + Math.round(returnHours * 3600 * 1000),
          type: "rezsifutas",
          label: `${AUTO_DEADHEAD_LABEL} (vissza Környére)`,
          fromAddress: lastFuvar.lerakasCim,
          toAddress: KORNYE_HUB_ADDRESS,
          sourceFuvarId: lastFuvar.fuvarId,
          flags: { autoReturnToHub: true, autoDeadhead: true }
        });

        if (returnBlock) {
          autoBlocks.push(returnBlock);
        }
      }
    }
  }

  resource.timeline = [...preserved, ...autoBlocks].sort((left, right) => {
    return new Date(left.start) - new Date(right.start);
  });
}

export function refreshAutoDeadheadBlocksForVontato(vontato) {
  refreshAutoTransitBlocksForResource(vontato, FUVAROK);
}

function removeAutoSoforStateBlocks(sofor) {
  if (!Array.isArray(sofor?.timeline)) {
    return;
  }

  sofor.timeline = sofor.timeline.filter((block) => {
    return !(block?.synthetic && (
      block?.autoDriverState
      || block?.autoDeadhead
      || block?.autoLeadRun
      || block?.autoReposition
      || block?.autoWaiting
      || block?.autoUtofutas
      || block?.autoReturnToHub
      || block?.autoDomesticRecommendation
    ));
  });
}

function resolveLinkedVontatoForSofor(sofor, vontatok) {
  if (!sofor) {
    return null;
  }

  if (sofor.linkedVontatoId) {
    return vontatok.find((item) => item.id === sofor.linkedVontatoId) || null;
  }

  return vontatok.find((item) => item.linkedSoforId === sofor.id) || null;
}

function resolveLinkedPotkocsiForVontato(vontato, potkocsik) {
  if (!vontato) {
    return null;
  }

  if (vontato.linkedPotkocsiId) {
    return potkocsik.find((item) => item.id === vontato.linkedPotkocsiId) || null;
  }

  return potkocsik.find((item) => item.linkedVontatoId === vontato.id) || null;
}

function resolveInferredConvoyFromAssignments(sofor, vontatok, potkocsik) {
  if (!sofor?.id) {
    return { linkedVontato: null, linkedPotkocsi: null };
  }

  const latestAssigned = FUVAROK
    .filter((fuvar) => fuvar?.assignedSoforId === sofor.id)
    .filter((fuvar) => fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId)
    .sort((left, right) => {
      const leftEndMs = new Date(left?.lerakas?.ido || left?.felrakas?.ido || "").getTime();
      const rightEndMs = new Date(right?.lerakas?.ido || right?.felrakas?.ido || "").getTime();
      return rightEndMs - leftEndMs;
    })[0] || null;

  if (!latestAssigned) {
    return { linkedVontato: null, linkedPotkocsi: null };
  }

  const linkedVontato = vontatok.find((item) => item.id === latestAssigned.assignedVontatoId) || null;
  const linkedPotkocsi = potkocsik.find((item) => item.id === latestAssigned.assignedPotkocsiId) || null;

  return {
    linkedVontato,
    linkedPotkocsi
  };
}

function collectFuvarIdsFromTimeline(resource) {
  if (!Array.isArray(resource?.timeline)) {
    return new Set();
  }

  return new Set(
    resource.timeline
      .filter((block) => block?.type === "fuvar" && !block?.synthetic)
      .map((block) => block?.fuvarId)
      .filter(Boolean)
  );
}

function collectFuvarIntervalsFromTimeline(resource) {
  if (!Array.isArray(resource?.timeline)) {
    return [];
  }

  return resource.timeline
    .filter((block) => block?.type === "fuvar" && !block?.synthetic)
    .map((block) => {
      const startMs = new Date(block.start).getTime();
      const endMs = new Date(block.end).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return null;
      }

      return {
        startMs,
        endMs,
        fuvarId: block?.fuvarId || null,
        token: `${block?.label || ""}|${block?.start || ""}|${block?.end || ""}`
      };
    })
    .filter(Boolean);
}

function countSharedFuvarIds(baseSet, resourceIds) {
  if (!baseSet || baseSet.size === 0) {
    return 0;
  }

  let count = 0;
  const targetSet = resourceIds || new Set();
  baseSet.forEach((fuvarId) => {
    if (targetSet.has(fuvarId)) {
      count += 1;
    }
  });

  return count;
}

function getIntervalOverlapMs(left, right) {
  const startMs = Math.max(left.startMs, right.startMs);
  const endMs = Math.min(left.endMs, right.endMs);
  return endMs > startMs ? (endMs - startMs) : 0;
}

function computeTimelineOverlapScore(baseIntervals, baseIds, candidate) {
  const candidateIntervals = collectFuvarIntervalsFromTimeline(candidate);
  const candidateIds = collectFuvarIdsFromTimeline(candidate);

  let overlapMs = 0;
  let matchingTokenCount = 0;

  baseIntervals.forEach((baseInterval) => {
    candidateIntervals.forEach((candidateInterval) => {
      overlapMs += getIntervalOverlapMs(baseInterval, candidateInterval);

      if (baseInterval.token === candidateInterval.token) {
        matchingTokenCount += 1;
      }
    });
  });

  const sharedIdCount = countSharedFuvarIds(baseIds, candidateIds);

  return {
    sharedIdCount,
    matchingTokenCount,
    overlapMs
  };
}

function sumIntervalDurationMs(intervals) {
  return intervals.reduce((total, interval) => {
    return total + Math.max(0, interval.endMs - interval.startMs);
  }, 0);
}

function computeConvoyPairSyncScore(vontato, potkocsi) {
  if (!vontato || !potkocsi) {
    return {
      overlapMs: 0,
      overlapCount: 0
    };
  }

  const vontatoAllas = collectIntervalsByType(vontato, "allas");
  const potkocsiAllas = collectIntervalsByType(potkocsi, "allas");
  const allasOverlap = intersectIntervals(vontatoAllas, potkocsiAllas);

  const vontatoRezsi = collectIntervalsByType(vontato, "rezsifutas");
  const potkocsiRezsi = collectIntervalsByType(potkocsi, "rezsifutas");
  const rezsiOverlap = intersectIntervals(vontatoRezsi, potkocsiRezsi);

  const overlapMs = sumIntervalDurationMs(allasOverlap) + sumIntervalDurationMs(rezsiOverlap);

  return {
    overlapMs,
    overlapCount: allasOverlap.length + rezsiOverlap.length
  };
}

function resolveConvoyFromTimelineOverlap(sofor, vontatok, potkocsik) {
  const soforFuvarIds = collectFuvarIdsFromTimeline(sofor);
  const soforIntervals = collectFuvarIntervalsFromTimeline(sofor);
  if (soforFuvarIds.size === 0 && soforIntervals.length === 0) {
    return { linkedVontato: null, linkedPotkocsi: null };
  }

  let bestPair = {
    linkedVontato: null,
    linkedPotkocsi: null,
    pairOverlapMs: 0,
    pairOverlapCount: 0,
    driverVontatoOverlapMs: 0,
    driverVontatoSharedIds: 0,
    driverPotkocsiSharedIds: 0
  };

  const isBetterPair = (candidate, currentBest) => {
    if (candidate.pairOverlapMs !== currentBest.pairOverlapMs) {
      return candidate.pairOverlapMs > currentBest.pairOverlapMs;
    }

    if (candidate.pairOverlapCount !== currentBest.pairOverlapCount) {
      return candidate.pairOverlapCount > currentBest.pairOverlapCount;
    }

    if (candidate.driverVontatoOverlapMs !== currentBest.driverVontatoOverlapMs) {
      return candidate.driverVontatoOverlapMs > currentBest.driverVontatoOverlapMs;
    }

    if (candidate.driverVontatoSharedIds !== currentBest.driverVontatoSharedIds) {
      return candidate.driverVontatoSharedIds > currentBest.driverVontatoSharedIds;
    }

    return candidate.driverPotkocsiSharedIds > currentBest.driverPotkocsiSharedIds;
  };

  vontatok.forEach((vontato) => {
    const driverVontatoScore = computeTimelineOverlapScore(soforIntervals, soforFuvarIds, vontato);

    potkocsik.forEach((potkocsi) => {
      const convoyScore = computeConvoyPairSyncScore(vontato, potkocsi);
      if (convoyScore.overlapMs <= 0) {
        return;
      }

      const driverPotkocsiScore = computeTimelineOverlapScore(soforIntervals, soforFuvarIds, potkocsi);

      const candidate = {
        linkedVontato: vontato,
        linkedPotkocsi: potkocsi,
        pairOverlapMs: convoyScore.overlapMs,
        pairOverlapCount: convoyScore.overlapCount,
        driverVontatoOverlapMs: driverVontatoScore.overlapMs,
        driverVontatoSharedIds: driverVontatoScore.sharedIdCount,
        driverPotkocsiSharedIds: driverPotkocsiScore.sharedIdCount
      };

      if (isBetterPair(candidate, bestPair)) {
        bestPair = candidate;
      }
    });
  });

  return {
    linkedVontato: bestPair.linkedVontato,
    linkedPotkocsi: bestPair.linkedPotkocsi
  };
}

function collectIntervalsByType(resource, targetType) {
  if (!Array.isArray(resource?.timeline)) {
    return [];
  }

  return resource.timeline
    .filter((block) => block?.type === targetType)
    .map((block) => {
      const startMs = new Date(block.start).getTime();
      const endMs = new Date(block.end).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return null;
      }

      return {
        startMs,
        endMs,
        sourceBlock: block
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.startMs - right.startMs);
}

function intersectIntervals(leftIntervals, rightIntervals) {
  const overlaps = [];

  leftIntervals.forEach((leftItem) => {
    rightIntervals.forEach((rightItem) => {
      const startMs = Math.max(leftItem.startMs, rightItem.startMs);
      const endMs = Math.min(leftItem.endMs, rightItem.endMs);
      if (endMs > startMs) {
        overlaps.push({ startMs, endMs });
      }
    });
  });

  return overlaps.sort((left, right) => left.startMs - right.startMs);
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) {
    return [];
  }

  const merged = [{ ...intervals[0] }];

  for (let index = 1; index < intervals.length; index += 1) {
    const current = intervals[index];
    const last = merged[merged.length - 1];

    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function buildSoforStateBlocksFromOverlap(overlaps, mode, sofor, vontato, potkocsi) {
  if (overlaps.length === 0) {
    return [];
  }

  const type = mode === "allas" ? "piheno" : "vezetes";
  const stateLabelKey = mode === "allas" ? "piheno" : "vezetes";

  return mergeIntervals(overlaps).map((interval) => {
    return {
      start: new Date(interval.startMs).toISOString(),
      end: new Date(interval.endMs).toISOString(),
      type,
      label: AUTO_DRIVER_STATE_LABELS[stateLabelKey],
      synthetic: true,
      autoDriverState: true,
      driverStateType: stateLabelKey,
      linkedSoforId: sofor.id,
      linkedVontatoId: vontato.id,
      linkedPotkocsiId: potkocsi.id
    };
  });
}

export function refreshAutoDriverStatesForLinkedConvoys(soforok, vontatok, potkocsik) {
  soforok.forEach((sofor) => {
    const collectConvoyOverlaps = (candidateVontato, candidatePotkocsi) => {
      if (!candidateVontato || !candidatePotkocsi) {
        return {
          allasOverlap: [],
          rezsiOverlap: []
        };
      }

      const vontatoAllas = collectIntervalsByType(candidateVontato, "allas");
      const potkocsiAllas = collectIntervalsByType(candidatePotkocsi, "allas");
      const allasOverlap = intersectIntervals(vontatoAllas, potkocsiAllas);

      const vontatoRezsi = collectIntervalsByType(candidateVontato, "rezsifutas");
      const potkocsiRezsi = collectIntervalsByType(candidatePotkocsi, "rezsifutas");
      const rezsiOverlap = intersectIntervals(vontatoRezsi, potkocsiRezsi);

      return {
        allasOverlap,
        rezsiOverlap
      };
    };

    let linkedVontato = resolveLinkedVontatoForSofor(sofor, vontatok);
    let linkedPotkocsi = resolveLinkedPotkocsiForVontato(linkedVontato, potkocsik);

    if (!linkedVontato || !linkedPotkocsi) {
      const inferred = resolveInferredConvoyFromAssignments(sofor, vontatok, potkocsik);
      linkedVontato = linkedVontato || inferred.linkedVontato;
      linkedPotkocsi = linkedPotkocsi || inferred.linkedPotkocsi;
    }

    if (!linkedVontato || !linkedPotkocsi) {
      const overlapInferred = resolveConvoyFromTimelineOverlap(sofor, vontatok, potkocsik);
      linkedVontato = linkedVontato || overlapInferred.linkedVontato;
      linkedPotkocsi = linkedPotkocsi || overlapInferred.linkedPotkocsi;
    }

    if (!linkedVontato || !linkedPotkocsi) {
      return;
    }

    removeAutoSoforStateBlocks(sofor);

    let { allasOverlap, rezsiOverlap } = collectConvoyOverlaps(linkedVontato, linkedPotkocsi);

    if (allasOverlap.length === 0 && rezsiOverlap.length === 0) {
      const overlapInferred = resolveConvoyFromTimelineOverlap(sofor, vontatok, potkocsik);
      const overlapResult = collectConvoyOverlaps(overlapInferred.linkedVontato, overlapInferred.linkedPotkocsi);

      if (overlapResult.allasOverlap.length > 0 || overlapResult.rezsiOverlap.length > 0) {
        linkedVontato = overlapInferred.linkedVontato;
        linkedPotkocsi = overlapInferred.linkedPotkocsi;
        allasOverlap = overlapResult.allasOverlap;
        rezsiOverlap = overlapResult.rezsiOverlap;
      }
    }

    const autoBlocks = [
      ...buildSoforStateBlocksFromOverlap(allasOverlap, "allas", sofor, linkedVontato, linkedPotkocsi),
      ...buildSoforStateBlocksFromOverlap(rezsiOverlap, "rezsi", sofor, linkedVontato, linkedPotkocsi)
    ];

    if (autoBlocks.length === 0) {
      if (DRIVER_STATE_DEBUG) {
        console.info("[driver-state] no auto blocks", {
          soforId: sofor.id,
          soforName: sofor.nev,
          linkedVontatoId: linkedVontato?.id || null,
          linkedPotkocsiId: linkedPotkocsi?.id || null,
          allasOverlapCount: allasOverlap.length,
          rezsiOverlapCount: rezsiOverlap.length
        });
      }
      return;
    }

    if (DRIVER_STATE_DEBUG) {
      console.info("[driver-state] auto blocks generated", {
        soforId: sofor.id,
        soforName: sofor.nev,
        linkedVontatoId: linkedVontato?.id || null,
        linkedPotkocsiId: linkedPotkocsi?.id || null,
        allasOverlapCount: allasOverlap.length,
        rezsiOverlapCount: rezsiOverlap.length,
        generatedCount: autoBlocks.length
      });
    }

    sofor.timeline = [...sofor.timeline, ...autoBlocks].sort((left, right) => {
      return new Date(left.start) - new Date(right.start);
    });
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
  name.tabIndex = 0;
  name.setAttribute("role", "button");

  if (r.matchGrade === "ok") {
    name.classList.add("match-ok");
  } else if (r.matchGrade === "bad") {
    name.classList.add("match-bad");
  } else if (r.matchGrade === "warn") {
    name.classList.add("match-warn");
  }

  name.dataset.resourceType = type;
  name.dataset.resourceId = r.id;

  const dispatchResourceSelection = () => {
    window.dispatchEvent(new CustomEvent("timeline:resource-selected", {
      detail: {
        type,
        resourceId: r.id
      }
    }));
  };

  name.addEventListener("click", (event) => {
    event.stopPropagation();
    dispatchResourceSelection();
  });

  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dispatchResourceSelection();
    }
  });

  const rowIcon = type === "sofor"
    ? "👤"
    : type === "vontato"
      ? "🚛"
      : type === "potkocsi"
        ? "🚚"
        : "🤝";

  const partnerMeta = type === "partner"
    ? `
      <div style="font-size:11px;opacity:0.76;">Egyező fuvar típus: ${Number(r?.spedicioMeta?.actualTypeCount || 0)}</div>
      <div style="font-size:11px;opacity:0.76;">Előző ár: ${r?.spedicioMeta?.latestPrice || "-"}</div>
    `
    : type === "sofor"
      ? ""
      : `
      <div style="font-size:11px;opacity:0.6;">
        📍 ${location}
      </div>
    `;

  const soforMetaHtml = type === "sofor"
    ? `<div class="timeline-resource-driver-badges">${renderSoforMetaBadges(r, { compact: true, shortLabels: true })}</div>`
    : "";

  name.innerHTML = `
    <div class="timeline-resource-main-line">
      ${rowIcon}
      <strong>${displayName}</strong>
    </div>
    ${soforMetaHtml}
    ${partnerMeta}
  `;

  if (type === "sofor") {
    name.title = buildSoforMetaTooltip(r);
  }

  // Timeline sáv
  const bar = document.createElement("div");
  bar.className = "timeline-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.height = "56px";
  bar.style.position = "relative";

  const focusedRange = getFocusedFuvarRange();
  const focusedImportFuvar = getFocusedImportFuvar();
  const completedJaratInfo = buildCompletedJaratInfo(r.timeline || []);
  const latestCompletedJarat = completedJaratInfo.summaries[completedJaratInfo.summaries.length - 1] || null;

  if (latestCompletedJarat) {
    const summaryLine = document.createElement("div");
    summaryLine.className = "timeline-jarat-summary";
    summaryLine.textContent = `✅ ${latestCompletedJarat.jaratId} • Üres km: ${Math.round(latestCompletedJarat.metrics.emptyKm)} • Bevétel: ${formatMoneyHuf(latestCompletedJarat.metrics.revenue)} • Kiadás: ${formatMoneyHuf(latestCompletedJarat.metrics.cost)} • Eredményesség: ${formatMoneyHuf(latestCompletedJarat.metrics.profit)}`;
    name.appendChild(summaryLine);
  }

  appendFocusedFuvarMarker(bar, focusedRange);
  enableTimelineRowContextMenu(bar, r, type);

  // Timeline blokkok kirajzolása
  if (r.timeline) {
    r.timeline.forEach(block => {
      if (type === "sofor" && block?.synthetic && block.type !== "fuvar" && !block?.autoDriverState) {
        return;
      }

      const visibleBlock = clipBlockToWindow(block);
      if (!visibleBlock) {
        return;
      }

      const div = document.createElement("div");
      div.className = "timeline-block";
      div.classList.add(visibleBlock.type);

      // cost-saving profil: rezsi-futás riasztás ha távolság > küszöb
      if (visibleBlock.autoDeadhead && Number.isFinite(visibleBlock.estDistanceKm)) {
        const alertKm = getEffectiveDeadheadAlertKm();
        if (visibleBlock.estDistanceKm > alertKm) {
          div.classList.add("timeline-block-deadhead-over-alert");
        }
      }

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

      if (visibleBlock.type === "fuvar") {
        const route = getFuvarRouteForBlock(visibleBlock);
        const startText = formatCompactTimelineDateTime(visibleBlock.start);
        const endText = formatCompactTimelineDateTime(visibleBlock.end);
        const urgentHtml = visibleBlock.surgos
          ? '<span class="timeline-inline-urgent">SÜRGŐS</span>'
          : "";
        const transitRoleInfo = getDomesticTransitRoleInfoForBlock(visibleBlock);
        const transitRoleHtml = transitRoleInfo
          ? `<span class="timeline-inline-transit-role ${transitRoleInfo.role}">${transitRoleInfo.label}</span>`
          : "";
        const partnerSummaryHtml = type === "partner" && visibleBlock.partnerSummary
          ? `<div class="timeline-block-compact-line" style="opacity:0.84;">${visibleBlock.partnerSummary}</div>`
          : "";

        div.innerHTML = `
          <div class="timeline-block-compact-line">${urgentHtml}${transitRoleHtml}<strong>${route.pickup} → ${route.dropoff}</strong><span class="timeline-compact-separator">•</span><span>${startText} → ${endText}</span>${proximityHintHtml}</div>
          ${partnerSummaryHtml}
        `;
      } else {
        div.innerHTML = `
          <div class="timeline-block-title"><strong>${visibleBlock.label}</strong></div>
          ${renderBlockTags(visibleBlock)}
          <div class="timeline-block-time">
            ${formatDate(visibleBlock.start)} → ${formatDate(visibleBlock.end)}
          </div>
        `;
      }

      const jaratMeta = completedJaratInfo.byBlock.get(block) || null;
      if (jaratMeta?.jaratId) {
        div.classList.add("jarat-complete");
        const titleEl = div.querySelector(".timeline-block-title");
        if (titleEl) {
          const badge = document.createElement("span");
          badge.className = "timeline-jarat-badge";
          badge.textContent = jaratMeta.jaratId;
          titleEl.appendChild(badge);
        }
      }

      const blockTooltip = buildTimelineBlockTooltip(visibleBlock, jaratMeta);
      div.title = blockTooltip;
      bindTimelineBlockHoverTooltip(div, blockTooltip);

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

  const activeDayBounds = getLocalDayBounds(dayVehicleFilterAnchor || new Date());
  const isDayFilterActive = dayVehicleFilterMode !== "all";
  let hasAnyDayFilterMatch = false;

  // Csoportok (sofőr / vontató / pótkocsi)
  groups.forEach(g => {
    const group = document.createElement("section");
    group.className = "timeline-group";

    const type = g.type || getKindFromGroupName(g.name);

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
    if (type === "sofor") {
      header.appendChild(buildTimelineSoforSortBar());
    }
    group.appendChild(header);
    group.appendChild(body);
    container.appendChild(group);

    const baseList = dropoffVehiclesFilterActive
      ? (g.list || []).filter((resource) => dropoffView.insightByResourceKey.has(`${type}:${resource.id}`))
      : g.list;

    const dayFilteredList = isDayFilterActive
      ? (baseList || []).filter((resource) => matchesDayVehicleFilter(
        resource,
        dayVehicleFilterMode,
        activeDayBounds.startMs,
        activeDayBounds.endMs
      ))
      : baseList;

    if (isDayFilterActive && dayFilteredList?.length) {
      hasAnyDayFilterMatch = true;
    }

    const sortedList = dropoffVehiclesFilterActive
      ? dayFilteredList
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
      : (type === "sofor" ? applySoforSortTL(dayFilteredList) : sortResourcesByMatch(dayFilteredList));

    sortedList.forEach(r => {
      renderResourceRow(body, r, type);
    });

    applySearchToTimelineGroupBody(body, timelineSearchTerms[type] || "");
  });

  if (isDayFilterActive && !hasAnyDayFilterMatch) {
    const info = document.createElement("div");
    info.className = "timeline-filter-empty";
    info.textContent = dayVehicleFilterMode === "departingToday"
      ? `Nincs olyan erőforrás (${activeDayBounds.label}), amely aznap fuvarfeladattal indul a telephelyről.`
      : `Nincs olyan erőforrás (${activeDayBounds.label}), amely aznap teljesen fuvar nélkül marad.`;
    container.appendChild(info);
  }

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

  const departingTodayBtn = document.createElement("button");
  departingTodayBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
  departingTodayBtn.type = "button";
  departingTodayBtn.setAttribute("aria-pressed", String(dayVehicleFilterMode === "departingToday"));
  departingTodayBtn.textContent = "Ma induló autók";
  departingTodayBtn.classList.toggle("active", dayVehicleFilterMode === "departingToday");

  const idleTodayBtn = document.createElement("button");
  idleTodayBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
  idleTodayBtn.type = "button";
  idleTodayBtn.setAttribute("aria-pressed", String(dayVehicleFilterMode === "idleToday"));
  idleTodayBtn.textContent = "Ma üres autók";
  idleTodayBtn.classList.toggle("active", dayVehicleFilterMode === "idleToday");

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
    window.dispatchEvent(new CustomEvent("timeline:dropoff-filter-change", {
      detail: {
        active: dropoffVehiclesFilterActive,
        matchedCount: dropoffView.totalMatched
      }
    }));
    renderTimeline(containerId, groups);
  });

  departingTodayBtn.addEventListener("click", () => {
    const isSameMode = dayVehicleFilterMode === "departingToday";
    if (isSameMode) {
      dayVehicleFilterMode = "all";
      dayVehicleFilterAnchor = null;
    } else {
      dayVehicleFilterMode = "departingToday";
      dayVehicleFilterAnchor = new Date();
    }

    renderTimeline(containerId, groups);
  });

  idleTodayBtn.addEventListener("click", () => {
    const isSameMode = dayVehicleFilterMode === "idleToday";
    if (isSameMode) {
      dayVehicleFilterMode = "all";
      dayVehicleFilterAnchor = null;
    } else {
      dayVehicleFilterMode = "idleToday";
      dayVehicleFilterAnchor = new Date();
    }

    renderTimeline(containerId, groups);
  });

  nav.appendChild(prevBtn);
  nav.appendChild(label);
  nav.appendChild(nextBtn);
  nav.appendChild(dropoffBtn);
  nav.appendChild(departingTodayBtn);
  nav.appendChild(idleTodayBtn);
  container.appendChild(nav);
}
