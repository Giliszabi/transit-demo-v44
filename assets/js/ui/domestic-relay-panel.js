import { FUVAROK } from "../data/fuvarok.js";
import { buildDomesticTransitQueue, isFullyAssignedFuvar } from "./transit-relations.js";

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

function renderColumn(title, role, entries, selectedFuvarId) {
  const count = entries.length;
  const cardsHtml = entries.map(({ domesticFuvar, linkedFuvar }) => {
    const assignmentStatus = getAssignmentStatus(domesticFuvar);
    const activeClass = selectedFuvarId === domesticFuvar.id ? " active" : "";
    const linkedActiveClass = selectedFuvarId === linkedFuvar.id ? " linked-active" : "";
    const linkedLabel = role === "elofutas" ? "Kapcsolt export" : "Kapcsolt import";
    const linkedRoute = `${getShortAddress(linkedFuvar?.felrakas?.cim)} → ${getShortAddress(linkedFuvar?.lerakas?.cim)}`;

    return `
      <article class="domestic-relay-card ${role}${activeClass}${linkedActiveClass}" data-fuvar-id="${escapeHtml(domesticFuvar.id)}">
        <div class="domestic-relay-card-head">
          <span class="domestic-relay-role-badge ${role}">${role === "elofutas" ? "Előfutás" : "Utófutás"}</span>
          <span class="domestic-relay-status-badge ${assignmentStatus.className}">${assignmentStatus.label}</span>
        </div>
        <div class="domestic-relay-card-title">[${escapeHtml(domesticFuvar.id)}] ${escapeHtml(domesticFuvar.megnevezes)}</div>
        <div class="domestic-relay-card-route">${escapeHtml(getShortAddress(domesticFuvar?.felrakas?.cim))} → ${escapeHtml(getShortAddress(domesticFuvar?.lerakas?.cim))}</div>
        <div class="domestic-relay-card-time">${escapeHtml(formatDateTime(domesticFuvar?.felrakas?.ido))} → ${escapeHtml(formatDateTime(domesticFuvar?.lerakas?.ido))}</div>
        <div class="domestic-relay-linked-label">${linkedLabel}</div>
        <div class="domestic-relay-linked-title">[${escapeHtml(linkedFuvar.id)}] ${escapeHtml(linkedFuvar.megnevezes)}</div>
        <div class="domestic-relay-linked-route">${escapeHtml(linkedRoute)}</div>
        <div class="domestic-relay-card-actions">
          <button type="button" class="btn domestic-relay-action-btn" data-action="focus-domestic" data-fuvar-id="${escapeHtml(domesticFuvar.id)}">Erőforrás keresés</button>
          <button type="button" class="btn domestic-relay-action-btn secondary" data-action="focus-linked" data-fuvar-id="${escapeHtml(linkedFuvar.id)}">Kapcsolt fuvar</button>
        </div>
      </article>
    `;
  }).join("");

  const emptyHtml = `
    <div class="domestic-relay-empty-state">
      Nincs olyan ${role === "elofutas" ? "előfutás" : "utófutás"}, amely még tervezést igényelne.
    </div>
  `;

  return `
    <section class="domestic-relay-column ${role}">
      <div class="domestic-relay-column-head">
        <div class="domestic-relay-column-title">${title}</div>
        <div class="domestic-relay-column-count">${count} db</div>
      </div>
      <div class="domestic-relay-column-body">
        ${count > 0 ? cardsHtml : emptyHtml}
      </div>
    </section>
  `;
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

  const queue = buildDomesticTransitQueue(FUVAROK);
  container.innerHTML = `
    <div class="domestic-relay-board">
      <div class="domestic-relay-board-head">
        <div>
          <div class="domestic-relay-board-title">Kapcsolt belföldi szakaszok</div>
          <div class="domestic-relay-board-subtitle">Az adott exporthoz vagy importhoz tartozó, még nem teljesen kiosztott belföldi fuvarfeladatok.</div>
        </div>
        <div class="domestic-relay-board-total">${queue.total} nyitott szakasz</div>
      </div>
      <div class="domestic-relay-columns">
        ${renderColumn("Export előfutások", "elofutas", queue.elofutas, options.selectedFuvarId)}
        ${renderColumn("Import utófutások", "utofutas", queue.utofutas, options.selectedFuvarId)}
      </div>
    </div>
  `;

  container.querySelectorAll(".domestic-relay-card").forEach((card) => {
    card.addEventListener("click", () => {
      const fuvarId = card.dataset.fuvarId || "";
      if (fuvarId && typeof options.onSelectFuvar === "function") {
        options.onSelectFuvar(fuvarId);
      }
    });
  });

  container.querySelectorAll("[data-action='focus-domestic']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const fuvarId = button.dataset.fuvarId || "";
      if (fuvarId && typeof options.onSelectFuvar === "function") {
        options.onSelectFuvar(fuvarId);
      }
    });
  });

  container.querySelectorAll("[data-action='focus-linked']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const fuvarId = button.dataset.fuvarId || "";
      if (fuvarId && typeof options.onSelectLinkedFuvar === "function") {
        options.onSelectLinkedFuvar(fuvarId);
      }
    });
  });
}