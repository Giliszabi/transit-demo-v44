// ==============================================================
// Fuvar kártyák + gyorsszűrők + MATCHING ENGINE integráció
// ==============================================================

import { FUVAROK } from "../data/fuvarok.js";
import { formatDate } from "../utils.js";
import { evaluateFuvarTags, evaluateAllResources } from "./matching.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { renderTimeline } from "./timeline.js";

// =============================================================
//  GYORSSZŰRŐK HOZZÁRENDELÉSE
// =============================================================
export function renderFuvarFilters(containerId, onFilterChange) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = `
    <button class="btn" data-filter="all">Összes</button>
    <button class="btn" data-filter="adr">ADR</button>
    <button class="btn" data-filter="surgos">Sürgős</button>
    <button class="btn" data-filter="belfold">Belföld</button>
    <button class="btn" data-filter="export">Export</button>
    <button class="btn" data-filter="import">Import</button>
    <button class="btn" data-filter="spediccio">Spedició</button>
  `;

  cont.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      onFilterChange(btn.dataset.filter);
    });
  });
}

// =============================================================
//  FUVARKÁRTYÁK GENERÁLÁSA
// =============================================================
export function renderFuvarCards(containerId, filter = "all", onSelectFuvar) {
  const container = document.getElementById(containerId);

  container.innerHTML = "";

  FUVAROK.forEach((fuvar) => {
    // Tag-ek generálása (ADR, sürgős, nemzetközi, belföld stb.)
    evaluateFuvarTags(fuvar);

    // Gyorsszűrők alkalmazása
    if (filter !== "all" && fuvar[filter] !== true && fuvar.kategoria !== filter) {
      return;
    }

    const card = document.createElement("div");
    card.className = "menu-card";
    card.style.marginBottom = "12px";
    card.dataset.id = fuvar.id;

    // Badge-ek
    const adrBadge = fuvar.adr
      ? `<span style="background:#c62828;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">ADR</span>`
      : "";

    const urgentBadge = fuvar.surgos
      ? `<span style="background:#ff5252;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">SÜRGŐS</span>`
      : "";

    const typeBadge = `
      <span style="background:#37474f;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">
        ${fuvar.kategoria.toUpperCase()}
      </span>
    `;

    // HTML
    card.innerHTML = `
      <h3 style="margin:0; font-size:16px;">
        ${fuvar.megnevezes} ${adrBadge} ${urgentBadge} ${typeBadge}
      </h3>
      <p style="margin-top:6px;opacity:0.7;">
        📍 ${fuvar.felrakas.cim.split(",")[0]} → ${fuvar.lerakas.cim.split(",")[0]}
      </p>
      <p style="margin-top:6px;opacity:0.8;">
        📦 Felrakás: <strong>${formatDate(fuvar.felrakas.ido)}</strong>
      </p>
      <p style="opacity:0.8;">
        📦 Lerakás: <strong>${formatDate(fuvar.lerakas.ido)}</strong>
      </p>
      <p style="margin-top:4px;opacity:0.5;">
        🚚 ${fuvar.tavolsag_km} km
      </p>
    `;

    // Rákattintok → MATCHING fut
    card.addEventListener("click", () => {
      const results = evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, fuvar);
      onSelectFuvar(results);

      // Ki is emeljük a UI-ban a kiválasztott kártyát
      document.querySelectorAll(".menu-card").forEach(c => c.classList.remove("active-fuvar"));
      card.classList.add("active-fuvar");
    });

    container.appendChild(card);
  });
}
