// ============================================================
// TransIT v4.4 – SZERELVENY TIMELINE
// - Vontato alapu szerelveny sorok
// - Soronkent: Fuvar + Sofor + Vontato + Potkocsi
// ============================================================

import { distanceKm, formatDate } from "../utils.js";
import { FUVAROK } from "../data/fuvarok.js";
import { addFuvarBlockToTimeline, hasCollision, refreshAutoDriverStatesForLinkedConvoys, refreshAutoTransitBlocksForResource } from "./timeline.js";
import { getCategoryPalette } from "./colors.js";

const HOUR_WIDTH = 40;
const TIMELINE_HOURS = 72;
const TIMELINE_WIDTH = HOUR_WIDTH * TIMELINE_HOURS;
const ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS = 260;
const ADDRESS_AUTOCOMPLETE_MIN_CHARS = 3;

let assemblyTimelineOffsetHours = 0;
let lastAssemblyRenderState = null;
let openAssemblyContextMenu = null;
let openAssemblyOperationModal = null;
let transientHandlersBound = false;
let focusedFuvarId = null;
let focusedAssemblyId = null;
let assemblyDropoffVehiclesFilterActive = false;
let assemblyViewMode = "timeline";
let assemblyOnlyJaratFilterActive = false;
const expandedAssemblyIds = new Set();
const ASSEMBLY_VIEW_MODES = ["timeline", "jarat", "list"];
const ASSEMBLY_VIEW_MODE_LABELS = {
  timeline: "Idővonal",
  jarat: "Járat idővonal",
  list: "Lista"
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

window.addEventListener("fuvar:focus", (event) => {
  focusedFuvarId = event?.detail?.fuvarId || null;
  rerenderCurrentAssemblyTimeline();
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

function closeAssemblyTransientUi() {
  closeAssemblyContextMenu();
  closeAssemblyOperationModal();
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
  if (!lastAssemblyRenderState) {
    return;
  }

  renderSzerelvenyTimeline(
    lastAssemblyRenderState.containerId,
    lastAssemblyRenderState.soforok,
    lastAssemblyRenderState.vontatok,
    lastAssemblyRenderState.potkocsik
  );
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
  const soforName = assembly.sofor?.nev || "nincs sofőr";
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
    alert("Nincs másik teljes (sofőr + vontató + pótkocsi) szerelvény az elakasztáshoz.");
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
        <input class="timeline-event-form-input" name="assemblySearch" type="search" placeholder="Keresés rendszám vagy sofőr alapján..." />
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
        Sofőr
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
      alert("A kiválasztott sofőr nem található.");
      return;
    }

    if (assignment.potkocsiId && !selectedPotkocsi) {
      alert("A kiválasztott pótkocsi nem található.");
      return;
    }

    if (selectedSofor && !canAssignFuvarToResource(selectedSofor, fuvar)) {
      alert("A kiválasztott sofőr foglalt a fuvar időszakában.");
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
  return vontatok
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
}

function renderAssemblyRow(parent, assembly, soforok, vontatok, potkocsik, lifecycleFuvarIds = new Set()) {
  const row = document.createElement("div");
  row.className = "timeline-resource assembly-row";
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

  const soforName = assembly.sofor?.nev || "nincs";
  const potkocsiRendszam = assembly.potkocsi?.rendszam || "nincs";

  name.innerHTML = `
    <div class="assembly-main">🚛 ${assembly.vontato.rendszam}</div>
    <div class="assembly-meta">👤 Sofőr: ${soforName}</div>
    <div class="assembly-meta">🚚 Pótkocsi: ${potkocsiRendszam}</div>
  `;

  const bar = document.createElement("div");
  bar.className = "timeline-bar assembly-bar";
  bar.style.width = TIMELINE_WIDTH + "px";
  bar.style.height = "64px";
  bar.style.position = "relative";

  let visibleBlocks = 0;
  const focusedImportFuvar = getFocusedImportFuvar();
  const completedJaratInfo = buildAssemblyCompletedJaratInfo(assembly.fuvarBlocks || [], assembly);

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

    const proximityHint = getExportImportProximityHint(visibleBlock, focusedImportFuvar);
    const proximityHintHtml = proximityHint
      ? `<span class="timeline-import-link-hint">↔ ${formatDistanceKm(proximityHint.distance)} • Δt ${formatSignedHours(proximityHint.deltaHours)}</span>`
      : "";

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
    const comboLine = `👤 ${soforName} | 🚛 ${assembly.vontato.rendszam} | 🚚 ${potkocsiRendszam}`;

    div.innerHTML = `
      <div class="assembly-block-line-primary">${urgentHtml}${transitRoleHtml}<strong>${route.pickup} → ${route.dropoff}</strong><span class="timeline-compact-separator">•</span><span>${startText} → ${endText}</span>${proximityHintHtml}</div>
      <div class="assembly-block-line-secondary">${comboLine}</div>
    `;

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

    const blockTooltip = buildAssemblyBlockTooltip(visibleBlock, jaratMeta);
    div.title = blockTooltip;
    bindAssemblyBlockHoverTooltip(div, blockTooltip);

    div.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();

      showAssemblyContextMenu(
        event,
        buildAssemblyBlockContextActions(assembly, block, soforok, vontatok, potkocsik)
      );
    });

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
  const nav = document.createElement("div");
  nav.className = "timeline-nav assembly-nav";

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
  dropoffBtn.setAttribute("aria-pressed", String(assemblyDropoffVehiclesFilterActive));
  dropoffBtn.textContent = `Lerakó autók (${dropoffView.totalMatched})`;
  dropoffBtn.classList.toggle("active", assemblyDropoffVehiclesFilterActive);

  const viewModeBtn = document.createElement("button");
  viewModeBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
  viewModeBtn.type = "button";
  viewModeBtn.setAttribute("aria-pressed", String(assemblyViewMode !== "timeline"));
  viewModeBtn.textContent = `Nézet: ${ASSEMBLY_VIEW_MODE_LABELS[assemblyViewMode] || "Idővonal"}`;
  viewModeBtn.classList.toggle("active", assemblyViewMode !== "timeline");

  const jaratOnlyBtn = document.createElement("button");
  jaratOnlyBtn.className = "btn timeline-nav-btn timeline-nav-toggle";
  jaratOnlyBtn.type = "button";
  jaratOnlyBtn.setAttribute("aria-pressed", String(assemblyOnlyJaratFilterActive));
  jaratOnlyBtn.textContent = "Csak járatok";
  jaratOnlyBtn.classList.toggle("active", assemblyOnlyJaratFilterActive);

  prevBtn.addEventListener("click", () => {
    assemblyTimelineOffsetHours -= TIMELINE_HOURS;
    renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik);
  });

  nextBtn.addEventListener("click", () => {
    assemblyTimelineOffsetHours += TIMELINE_HOURS;
    renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik);
  });

  dropoffBtn.addEventListener("click", () => {
    assemblyDropoffVehiclesFilterActive = !assemblyDropoffVehiclesFilterActive;
    renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik);
  });

  viewModeBtn.addEventListener("click", () => {
    const modeIndex = ASSEMBLY_VIEW_MODES.indexOf(assemblyViewMode);
    const nextMode = ASSEMBLY_VIEW_MODES[(modeIndex + 1) % ASSEMBLY_VIEW_MODES.length];
    assemblyViewMode = nextMode;
    renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik);
  });

  jaratOnlyBtn.addEventListener("click", () => {
    assemblyOnlyJaratFilterActive = !assemblyOnlyJaratFilterActive;
    renderSzerelvenyTimeline(containerId, soforok, vontatok, potkocsik);
  });

  const activeFilters = [];
  if (assemblyDropoffVehiclesFilterActive) {
    activeFilters.push(`Lerakó autók (${dropoffView.totalMatched})`);
  }
  if (assemblyViewMode !== "timeline") {
    activeFilters.push(`Nézet: ${ASSEMBLY_VIEW_MODE_LABELS[assemblyViewMode] || assemblyViewMode}`);
  }
  if (assemblyOnlyJaratFilterActive) {
    activeFilters.push("Csak járatok");
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
  nav.appendChild(dropoffBtn);
  nav.appendChild(viewModeBtn);
  nav.appendChild(jaratOnlyBtn);
  nav.appendChild(activeBadge);
  container.appendChild(nav);
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
      <div class="assembly-list-info-box assembly-list-meta">👤 Sofőr: ${escapeHtml(soforName)}<span>•</span>🚚 Pótkocsi: ${escapeHtml(potkocsiRendszam)}</div>
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
    { kind: "sofor", label: "Sofőr", resource: assembly.sofor },
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

  const name = document.createElement("div");
  name.className = "timeline-resource-name assembly-resource-name";
  name.innerHTML = `
    <div class="assembly-main">🧭 ${segment.jaratId} • 🚛 ${assembly.vontato.rendszam}</div>
    <div class="assembly-meta">${segment.status === "lezart" ? "Lezárt járat" : "Nyitott kör"} • ${formatDate(segment.start)} → ${formatDate(segment.end)}</div>
    <div class="assembly-meta">👤 Sofőr: ${soforName} • 🚚 Pótkocsi: ${potkocsiRendszam}</div>
  `;

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
      if (assemblyOnlyJaratFilterActive && segment.status !== "lezart") {
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
    return;
  }

  bindAssemblyTransientHandlers();
  closeAssemblyTransientUi();

  lastAssemblyRenderState = {
    containerId,
    soforok,
    vontatok,
    potkocsik
  };

  container.innerHTML = "";

  const assemblies = buildAssemblies(soforok, vontatok, potkocsik);
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
  if (assemblyViewMode === "timeline" || assemblyViewMode === "jarat") {
    renderTimeScale(container);
  }

  if (spedicioOnlyAssemblies.length === 0) {
    const empty = document.createElement("div");
    empty.className = "assembly-empty-state";
    empty.textContent = options?.spedicioOnly
      ? "Nincs olyan szerelvény, amelyen spediciós fuvar szerepel."
      : "Nincs még összeállított szerelvény. Húzz erőforrásokat egymásra a kártyákon.";
    container.appendChild(empty);
    return;
  }

  const visibleAssemblies = assemblyDropoffVehiclesFilterActive
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

  const filteredAssemblies = assemblyOnlyJaratFilterActive
    ? visibleAssemblies.filter((assembly) => assemblyHasCompletedJarat(assembly))
    : visibleAssemblies;

  if (assemblyDropoffVehiclesFilterActive && visibleAssemblies.length === 0) {
    const info = document.createElement("div");
    info.className = "timeline-filter-empty";
    info.textContent = "Nincs olyan szerelvény, ahol az export lerakást követő 4 órában hiányzik import fuvar.";
    container.appendChild(info);
    return;
  }

  if (assemblyOnlyJaratFilterActive && filteredAssemblies.length === 0) {
    const info = document.createElement("div");
    info.className = "timeline-filter-empty";
    info.textContent = "Nincs megjeleníthető járatként értelmezett szerelvény az aktuális szűrők mellett.";
    container.appendChild(info);
    return;
  }

  const lifecycleFuvarIds = buildFocusedLifecycleFuvarIdSet();
  const lifecycleMatches = lifecycleFuvarIds.size > 0
    ? filteredAssemblies.filter((assembly) => assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds))
    : [];
  const lifecycleRemainder = lifecycleFuvarIds.size > 0
    ? filteredAssemblies.filter((assembly) => !assemblyContainsLifecycleFuvar(assembly, lifecycleFuvarIds))
    : filteredAssemblies;
  const orderedAssemblies = lifecycleFuvarIds.size > 0
    ? [...lifecycleMatches, ...lifecycleRemainder]
    : filteredAssemblies;

  if (assemblyViewMode === "list") {
    renderAssemblyListView(container, orderedAssemblies, lifecycleFuvarIds);
    return;
  }

  if (assemblyViewMode === "jarat") {
    renderAssemblyJaratTimelineView(container, orderedAssemblies, lifecycleFuvarIds);
    return;
  }

  orderedAssemblies.forEach((assembly) => {
    renderAssemblyRow(container, assembly, soforok, vontatok, potkocsik, lifecycleFuvarIds);
  });
}
