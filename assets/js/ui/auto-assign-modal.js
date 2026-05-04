// =============================================================
//  TransIT v4.4 – AUTO-ASSIGN MODAL
//  Előnézeti összefoglaló a "Fuvarok összerakása" eredményéhez
// =============================================================

import { runAutoAssign, applyAutoAssignResult } from "../core/auto-assign.js";

let _modalEl = null;
let _pendingResult = null;
let _onApplied = null;

// ── CSS stílus (egyszer injektálva) ──────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("auto-assign-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "auto-assign-modal-styles";
  style.textContent = `
    .aa-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: aa-fadein 0.18s ease;
    }
    @keyframes aa-fadein { from { opacity: 0 } to { opacity: 1 } }

    .aa-modal {
      background: #1a2133;
      border: 1px solid #2e3d58;
      border-radius: 10px;
      width: min(860px, 96vw);
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      color: #d4e4f7;
      font-family: inherit;
    }

    .aa-modal-header {
      padding: 18px 24px 14px;
      border-bottom: 1px solid #2e3d58;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .aa-modal-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #e8f0fb;
      flex: 1;
    }
    .aa-modal-close {
      background: none;
      border: none;
      color: #7a9bbf;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .aa-modal-close:hover { color: #e8f0fb; background: rgba(255,255,255,0.07); }

    .aa-stats-row {
      display: flex;
      gap: 14px;
      padding: 14px 24px;
      border-bottom: 1px solid #2e3d58;
      flex-wrap: wrap;
    }
    .aa-stat-chip {
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .aa-stat-chip.green { background: rgba(92,201,141,0.15); color: #5cc98d; border: 1px solid rgba(92,201,141,0.3); }
    .aa-stat-chip.blue  { background: rgba(79,195,247,0.12); color: #4fc3f7; border: 1px solid rgba(79,195,247,0.28); }
    .aa-stat-chip.orange{ background: rgba(251,140,0,0.13);  color: #fb8c00; border: 1px solid rgba(251,140,0,0.3); }
    .aa-stat-chip.red   { background: rgba(239,83,80,0.14);  color: #ef5350; border: 1px solid rgba(239,83,80,0.3); }

    .aa-modal-body {
      overflow-y: auto;
      flex: 1;
      padding: 0 24px 14px;
    }

    .aa-section-title {
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #7a9bbf;
      margin: 18px 0 8px;
    }

    .aa-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    .aa-table th {
      text-align: left;
      padding: 6px 10px;
      color: #7a9bbf;
      font-weight: 500;
      border-bottom: 1px solid #2e3d58;
      white-space: nowrap;
    }
    .aa-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #1e2d44;
      vertical-align: middle;
    }
    .aa-table tr:last-child td { border-bottom: none; }
    .aa-table tr:hover td { background: rgba(255,255,255,0.03); }

    .aa-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .aa-badge.ok     { background: rgba(92,201,141,0.15); color: #5cc98d; }
    .aa-badge.warn   { background: rgba(251,140,0,0.15);  color: #fb8c00; }
    .aa-badge.partial{ background: rgba(79,195,247,0.13); color: #4fc3f7; }
    .aa-badge.error  { background: rgba(239,83,80,0.14);  color: #ef5350; }

    .aa-warn-list, .aa-unassigned-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .aa-warn-list li, .aa-unassigned-list li {
      padding: 5px 10px;
      border-radius: 5px;
      margin-bottom: 4px;
      font-size: 0.82rem;
    }
    .aa-warn-list li   { background: rgba(251,140,0,0.1); color: #fbb040; }
    .aa-unassigned-list li { background: rgba(239,83,80,0.1); color: #ef7070; }

    .aa-spedicio-hint {
      background: rgba(171,71,188,0.1);
      border: 1px solid rgba(171,71,188,0.25);
      border-radius: 6px;
      padding: 10px 14px;
      margin-top: 10px;
      font-size: 0.82rem;
      color: #ce93d8;
    }
    .aa-spedicio-hint strong { color: #e1bee7; }

    .aa-modal-footer {
      padding: 14px 24px;
      border-top: 1px solid #2e3d58;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .aa-btn {
      padding: 8px 22px;
      border-radius: 6px;
      border: none;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
    }
    .aa-btn:active { transform: scale(0.97); }
    .aa-btn.cancel {
      background: rgba(255,255,255,0.07);
      color: #a0b8d0;
      border: 1px solid #2e3d58;
    }
    .aa-btn.cancel:hover { background: rgba(255,255,255,0.12); }
    .aa-btn.apply {
      background: #1e6fd4;
      color: #fff;
    }
    .aa-btn.apply:hover { opacity: 0.87; }
    .aa-btn.apply:disabled { opacity: 0.45; cursor: not-allowed; }

    .aa-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 36px 0;
      color: #7a9bbf;
      font-size: 0.9rem;
    }
    .aa-spinner {
      width: 22px; height: 22px;
      border: 3px solid #2e3d58;
      border-top-color: #4fc3f7;
      border-radius: 50%;
      animation: aa-spin 0.7s linear infinite;
    }
    @keyframes aa-spin { to { transform: rotate(360deg); } }

    #btn-auto-assign {
      background: rgba(30,111,212,0.18);
      color: #7ab8f5;
      border: 1px solid rgba(30,111,212,0.35);
      border-radius: 6px;
      padding: 5px 14px;
      font-size: 0.84rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    #btn-auto-assign:hover {
      background: rgba(30,111,212,0.32);
      color: #c2dbf8;
      border-color: rgba(30,111,212,0.6);
    }
    #btn-auto-assign:active { opacity: 0.8; }
  `;
  document.head.appendChild(style);
}

// ── HTML-generálás ─────────────────────────────────────────────────────────

function soforNev(id) {
  if (!id) return "–";
  // SOFOROK nem lesz importálva (circular dep. kerülés) – ID-t megjelenítjük
  return id;
}

function fuvarLabel(fuvar) {
  if (!fuvar) return "–";
  return fuvar.megnevezes || fuvar.id;
}

function statusBadge(jarat) {
  if (jarat.unassignedFuvars?.length > 0) {
    return `<span class="aa-badge error">Részleges</span>`;
  }
  if (jarat.warnings?.length > 0) {
    return `<span class="aa-badge warn">Figyelmeztetés</span>`;
  }
  return `<span class="aa-badge ok">OK</span>`;
}

function buildModalHtml(result) {
  const { jaratok, unassigned, warnings, stats, spedicioPartners } = result;

  const statsHtml = `
    <div class="aa-stats-row">
      <span class="aa-stat-chip blue">${stats.jaratCount} járat képzett</span>
      <span class="aa-stat-chip green">${stats.assigned} fuvar kiosztva</span>
      ${stats.partial > 0 ? `<span class="aa-stat-chip orange">${stats.partial} részleges</span>` : ""}
      ${stats.unassigned > 0 ? `<span class="aa-stat-chip red">${stats.unassigned} kiosztás nélkül</span>` : ""}
    </div>
  `;

  const jaratRows = jaratok.map((j) => {
    const soforText = j.resources?.sofor
      ? (j.resources.sofor.nev || j.resources.sofor.id)
      : `<span style="color:#ef7070">–</span>`;
    const vontatoText = j.resources?.vontato
      ? (j.resources.vontato.rendszam || j.resources.vontato.id)
      : `<span style="color:#ef7070">–</span>`;
    const potkocsiText = j.resources?.potkocsi
      ? (j.resources.potkocsi.rendszam || j.resources.potkocsi.id)
      : `<span style="color:#ef7070">–</span>`;

    return `<tr>
      <td style="color:#7ab8f5;font-size:0.75rem">${j.jaratId}</td>
      <td title="${fuvarLabel(j.exportFuvar)}">${j.exportFuvar ? truncate(fuvarLabel(j.exportFuvar), 28) : "<em style='color:#4a6070'>–</em>"}</td>
      <td title="${fuvarLabel(j.importFuvar)}">${j.importFuvar ? truncate(fuvarLabel(j.importFuvar), 28) : "<em style='color:#4a6070'>–</em>"}</td>
      <td>${soforText}</td>
      <td>${vontatoText}</td>
      <td>${potkocsiText}</td>
      <td>${statusBadge(j)}</td>
    </tr>`;
  }).join("");

  const warnHtml = warnings.length > 0
    ? `<div class="aa-section-title">Figyelmeztetések (${warnings.length})</div>
       <ul class="aa-warn-list">${warnings.map((w) => `<li>${escHtml(w)}</li>`).join("")}</ul>`
    : "";

  const unassignedHtml = unassigned.length > 0
    ? `<div class="aa-section-title">Kiosztás nélküli feladatok (${unassigned.length})</div>
       <ul class="aa-unassigned-list">
         ${unassigned.map((u) => `<li><strong>${escHtml(fuvarLabel(u.fuvar))}</strong> – ${escHtml(u.reason)}</li>`).join("")}
       </ul>
       ${spedicioPartners?.length > 0 ? `
         <div class="aa-spedicio-hint">
           💡 <strong>Alvállalkozó javaslat:</strong>
           A ki nem osztható fuvarokhoz az alábbi spedíciós partnerek vonhatók be:
           ${escHtml(spedicioPartners.join(" · "))}
         </div>` : ""}`
    : "";

  return `
    <div class="aa-modal-header">
      <span class="aa-modal-title">⊞&nbsp; Fuvarok összerakása – Előnézet</span>
      <button class="aa-modal-close" data-aa-action="close" title="Bezárás">×</button>
    </div>
    ${statsHtml}
    <div class="aa-modal-body">
      <div class="aa-section-title">Járatok (${jaratok.length})</div>
      <table class="aa-table">
        <thead>
          <tr>
            <th>Járat</th>
            <th>Export fuvar</th>
            <th>Import fuvar</th>
            <th>Sofőr</th>
            <th>Vontató</th>
            <th>Pótkocsi</th>
            <th>Státusz</th>
          </tr>
        </thead>
        <tbody>${jaratRows}</tbody>
      </table>
      ${warnHtml}
      ${unassignedHtml}
    </div>
    <div class="aa-modal-footer">
      <button class="aa-btn cancel" data-aa-action="cancel">Mégsem</button>
      <button class="aa-btn apply" data-aa-action="apply">Alkalmaz</button>
    </div>
  `;
}

function buildLoadingHtml() {
  return `
    <div class="aa-modal-header">
      <span class="aa-modal-title">⊞&nbsp; Fuvarok összerakása</span>
    </div>
    <div class="aa-modal-body">
      <div class="aa-loading">
        <div class="aa-spinner"></div>
        <span>Kiosztás futtatása…</span>
      </div>
    </div>
  `;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Modal lifecycle ───────────────────────────────────────────────────────────

function closeModal() {
  if (_modalEl && _modalEl.parentNode) {
    _modalEl.parentNode.removeChild(_modalEl);
  }
  _modalEl = null;
  _pendingResult = null;
}

function createOverlay(innerHtml) {
  const overlay = document.createElement("div");
  overlay.className = "aa-overlay";
  overlay.innerHTML = `<div class="aa-modal">${innerHtml}</div>`;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay.addEventListener("click", (e) => {
    const action = e.target.closest("[data-aa-action]")?.dataset.aaAction;
    if (action === "close" || action === "cancel") {
      closeModal();
    } else if (action === "apply") {
      if (_pendingResult) {
        applyAutoAssignResult(_pendingResult);
        closeModal();
        if (typeof _onApplied === "function") _onApplied();
      }
    }
  });

  return overlay;
}

/**
 * Megnyitja a "Fuvarok összerakása" modal-t.
 * @param {{ onApplied?: Function }} options
 */
export function openAutoAssignModal(options = {}) {
  injectStyles();
  _onApplied = options.onApplied || null;

  // Esetleges korábbi modal eltávolítása
  closeModal();

  // Loading állapot
  _modalEl = createOverlay(buildLoadingHtml());
  document.body.appendChild(_modalEl);

  // Algoritmus async-szerűen lefuttatjuk (setTimeout 0 hogy a loading megjelenjen)
  setTimeout(() => {
    try {
      _pendingResult = runAutoAssign();
    } catch (err) {
      console.error("[AutoAssign] Hiba az algoritmus futtatásakor:", err);
      if (_modalEl) {
        const body = _modalEl.querySelector(".aa-modal-body");
        if (body) {
          body.innerHTML = `<div class="aa-loading" style="color:#ef5350">
            Hiba történt az automatikus kiosztás során.<br/>
            <small>${escHtml(String(err?.message || err))}</small>
          </div>`;
        }
      }
      return;
    }

    if (!_modalEl) return; // felhasználó már bezárta

    const modal = _modalEl.querySelector(".aa-modal");
    if (modal) {
      modal.innerHTML = buildModalHtml(_pendingResult);
    }
  }, 0);
}
