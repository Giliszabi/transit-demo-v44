import { FUVAROK } from "../data/fuvarok.js";
import { buildDomesticTransitQueue, isFullyAssignedFuvar } from "./transit-relations.js";

const relayUiState = {
  elofutas: {
    pickup: "",
    dropoff: "",
    sort: "time-asc",
    scrollTop: 0,
    scrollLeft: 0
  },
  utofutas: {
    pickup: "",
    dropoff: "",
    sort: "time-asc",
    scrollTop: 0,
    scrollLeft: 0
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getShortAddress(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "-";
  }

  const first = parts[0].toLowerCase();
  if ((first.includes("magyarország") || first.includes("hungary")) && parts[1]) {
    return parts[1];
  }

  return parts[0];
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toTimestamp(value) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date.getTime() : Number.POSITIVE_INFINITY;
}

function compareTextAsc(a, b) {
  return String(a || "").localeCompare(String(b || ""), "hu", { sensitivity: "base" });
}

function matchesLocationSearch(entry, pickupTerm, dropoffTerm) {
  const domesticPickup = normalizeSearchText(entry?.domesticFuvar?.felrakas?.cim);
  const domesticDropoff = normalizeSearchText(entry?.domesticFuvar?.lerakas?.cim);
  const linkedPickup = normalizeSearchText(entry?.linkedFuvar?.felrakas?.cim);
  const linkedDropoff = normalizeSearchText(entry?.linkedFuvar?.lerakas?.cim);

  const pickupHaystack = `${domesticPickup} ${linkedPickup}`.trim();
  const dropoffHaystack = `${domesticDropoff} ${linkedDropoff}`.trim();

  const pickupMatch = !pickupTerm || pickupHaystack.includes(pickupTerm);
  const dropoffMatch = !dropoffTerm || dropoffHaystack.includes(dropoffTerm);
  return pickupMatch && dropoffMatch;
}

function sortEntries(entries, sortKey) {
  const list = [...entries];

  list.sort((a, b) => {
    const aPickup = getShortAddress(a?.domesticFuvar?.felrakas?.cim);
    const bPickup = getShortAddress(b?.domesticFuvar?.felrakas?.cim);
    const aDropoff = getShortAddress(a?.domesticFuvar?.lerakas?.cim);
    const bDropoff = getShortAddress(b?.domesticFuvar?.lerakas?.cim);
    const aTime = toTimestamp(a?.domesticFuvar?.felrakas?.ido);
    const bTime = toTimestamp(b?.domesticFuvar?.felrakas?.ido);

    if (sortKey === "time-desc") {
      return bTime - aTime;
    }

    if (sortKey === "pickup-asc") {
      return compareTextAsc(aPickup, bPickup);
    }

    if (sortKey === "pickup-desc") {
      return compareTextAsc(bPickup, aPickup);
    }

    if (sortKey === "dropoff-asc") {
      return compareTextAsc(aDropoff, bDropoff);
    }

    if (sortKey === "dropoff-desc") {
      return compareTextAsc(bDropoff, aDropoff);
    }

    return aTime - bTime;
  });

  return list;
}

function getAssignmentStatus(fuvar) {
  if (isFullyAssignedFuvar(fuvar)) {
    return { label: "Kész", className: "ready" };
  }

  const assignedCount = [fuvar?.assignedSoforId, fuvar?.assignedVontatoId, fuvar?.assignedPotkocsiId]
    .filter(Boolean)
    .length;

  if (assignedCount > 0) {
    return { label: "Részben tervezett", className: "partial" };
  }

  return { label: "Erőforrás nélkül", className: "empty" };
}

function renderSortIcon(currentSort, ascKey, descKey) {
  if (currentSort === ascKey) return '<span class="relay-sort-icon active">▲</span>';
  if (currentSort === descKey) return '<span class="relay-sort-icon active">▼</span>';
  return '<span class="relay-sort-icon">⇅</span>';
}

function renderTableRows(role, entries, selectedFuvarId) {
  if (entries.length === 0) {
    return `
      <tr>
        <td colspan="7" class="domestic-relay-empty-cell">
          Nincs tervezést igénylő ${role === "elofutas" ? "előfutás" : "utófutás"}.
        </td>
      </tr>
    `;
  }

  return entries.map(({ domesticFuvar, linkedFuvar }) => {
    const assignmentStatus = getAssignmentStatus(domesticFuvar);
    const activeClass = selectedFuvarId === domesticFuvar.id ? " active" : "";
    const linkedActiveClass = selectedFuvarId === linkedFuvar?.id ? " linked-active" : "";

    return `
      <tr class="domestic-relay-row${activeClass}${linkedActiveClass}" data-fuvar-id="${escapeHtml(domesticFuvar.id)}">
        <td class="col-relay-status">
          <span class="domestic-relay-status-badge ${assignmentStatus.className}">${assignmentStatus.label}</span>
        </td>
        <td class="col-relay-pickup" title="${escapeHtml(domesticFuvar.felrakas?.cim || "")}">
          ${escapeHtml(getShortAddress(domesticFuvar?.felrakas?.cim))}
        </td>
        <td class="col-relay-dropoff" title="${escapeHtml(domesticFuvar.lerakas?.cim || "")}">
          ${escapeHtml(getShortAddress(domesticFuvar?.lerakas?.cim))}
        </td>
        <td class="col-relay-time-from">${escapeHtml(formatDateTime(domesticFuvar?.felrakas?.ido))}</td>
        <td class="col-relay-time-to">${escapeHtml(formatDateTime(domesticFuvar?.lerakas?.ido))}</td>
        <td class="col-relay-linked" title="${escapeHtml(linkedFuvar?.megnevezes || "")}">
          <span class="relay-linked-id">${escapeHtml(linkedFuvar?.id || "-")}</span>
          <span class="relay-linked-route">${escapeHtml(getShortAddress(linkedFuvar?.felrakas?.cim))}→${escapeHtml(getShortAddress(linkedFuvar?.lerakas?.cim))}</span>
        </td>
        <td class="col-relay-linked-time">${escapeHtml(formatDateTime(linkedFuvar?.lerakas?.ido))}</td>
      </tr>
    `;
  }).join("");
}

function resolveRole(options) {
  const role = options?.role === "utofutas" ? "utofutas" : "elofutas";
  return role;
}

function getRoleTitle(role) {
  return role === "elofutas" ? "Export előfutások" : "Import utófutások";
}

function getVisibleEntriesByRole(queue, role) {
  const state = relayUiState[role];
  const source = role === "elofutas" ? queue.elofutas : queue.utofutas;
  const pickupTerm = normalizeSearchText(state.pickup);
  const dropoffTerm = normalizeSearchText(state.dropoff);
  const filtered = source.filter((entry) => matchesLocationSearch(entry, pickupTerm, dropoffTerm));
  return sortEntries(filtered, state.sort);
}

export function renderTransitTaskBoard(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  if (options.hidden) {
    container.innerHTML = '<div class="domestic-relay-board-muted">A kapcsolt belföldi tervező spedicció szűrő mellett rejtve van.</div>';
    return;
  }

  const role = resolveRole(options);
  const state = relayUiState[role];
  const previousWrapper = container.querySelector(".domestic-relay-table-wrapper");
  if (previousWrapper) {
    state.scrollTop = previousWrapper.scrollTop;
    state.scrollLeft = previousWrapper.scrollLeft;
  }
  const queue = buildDomesticTransitQueue(FUVAROK);
  const source = role === "elofutas" ? queue.elofutas : queue.utofutas;
  const visibleEntries = getVisibleEntriesByRole(queue, role);
  const title = getRoleTitle(role);

  container.innerHTML = `
    <div class="domestic-relay-board" data-relay-role="${role}">
      <div class="domestic-relay-column-head">
        <div class="domestic-relay-column-title">${title}</div>
        <div class="domestic-relay-column-count">${visibleEntries.length}${visibleEntries.length !== source.length ? ` / ${source.length}` : ""} db</div>
      </div>
      <div class="domestic-relay-controls-row">
        <label class="domestic-relay-search-field">
          <span class="domestic-relay-search-label">Felrakó</span>
          <input
            type="search"
            class="domestic-relay-search-input"
            data-relay-search="pickup"
            placeholder="Keresés…"
            value="${escapeHtml(state.pickup)}"
          />
        </label>
        <label class="domestic-relay-search-field">
          <span class="domestic-relay-search-label">Lerakó</span>
          <input
            type="search"
            class="domestic-relay-search-input"
            data-relay-search="dropoff"
            placeholder="Keresés…"
            value="${escapeHtml(state.dropoff)}"
          />
        </label>
      </div>
      <div class="domestic-relay-table-wrapper">
        <table class="domestic-relay-table">
          <thead>
            <tr>
              <th class="col-relay-status">Állapot</th>
              <th class="col-relay-pickup sortable" data-sort-asc="pickup-asc" data-sort-desc="pickup-desc">Felrakó ${renderSortIcon(state.sort, "pickup-asc", "pickup-desc")}</th>
              <th class="col-relay-dropoff sortable" data-sort-asc="dropoff-asc" data-sort-desc="dropoff-desc">Lerakó ${renderSortIcon(state.sort, "dropoff-asc", "dropoff-desc")}</th>
              <th class="col-relay-time-from sortable" data-sort-asc="time-asc" data-sort-desc="time-desc">Felrakás ${renderSortIcon(state.sort, "time-asc", "time-desc")}</th>
              <th class="col-relay-time-to">Lerakás</th>
              <th class="col-relay-linked">Kapcsolt fuvar</th>
              <th class="col-relay-linked-time">Kap. lerakás</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(role, visibleEntries, options.selectedFuvarId)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const nextWrapper = container.querySelector(".domestic-relay-table-wrapper");
  if (nextWrapper) {
    nextWrapper.scrollTop = state.scrollTop || 0;
    nextWrapper.scrollLeft = state.scrollLeft || 0;
    nextWrapper.addEventListener("scroll", () => {
      state.scrollTop = nextWrapper.scrollTop;
      state.scrollLeft = nextWrapper.scrollLeft;
    });
  }

  container.querySelectorAll(".domestic-relay-search-input").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.relaySearch;
      if (key !== "pickup" && key !== "dropoff") {
        return;
      }

      state[key] = input.value || "";
      const start = input.selectionStart;
      const end = input.selectionEnd;
      renderTransitTaskBoard(containerId, options);

      const selector = `.domestic-relay-search-input[data-relay-search="${key}"]`;
      const nextInput = container.querySelector(selector);
      if (nextInput) {
        nextInput.focus({ preventScroll: true });
        if (Number.isInteger(start) && Number.isInteger(end)) {
          nextInput.setSelectionRange(start, end);
        }
      }
    });
  });

  container.querySelectorAll(".domestic-relay-table thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const ascKey = th.dataset.sortAsc;
      const descKey = th.dataset.sortDesc;
      if (!ascKey || !descKey) return;
      if (state.sort === ascKey) {
        state.sort = descKey;
      } else {
        state.sort = ascKey;
      }
      renderTransitTaskBoard(containerId, options);
    });
  });

  container.querySelectorAll(".domestic-relay-row").forEach((row) => {
    row.addEventListener("click", () => {
      const fuvarId = row.dataset.fuvarId || "";
      if (fuvarId && typeof options.onSelectFuvar === "function") {
        options.onSelectFuvar(fuvarId);
      }
    });
  });
}
