import { FUVAROK } from "../data/fuvarok.js";
import { formatDate } from "../utils.js";

export function renderFuvarCards(containerId) {
  const container = document.getElementById(containerId);
  if (!FUVAROK || FUVAROK.length === 0) {
    container.innerHTML = `<p style="opacity:0.6;">Nincs betöltött fuvar adat.</p>`;
    return;
  }

  container.innerHTML = "";

  FUVAROK.forEach((fuvar) => {
    const card = document.createElement("div");
    card.className = "menu-card";
    card.style.marginBottom = "12px";

    const adrBadge = fuvar.adr
      ? `<span style="background:#c62828;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">ADR</span>`
      : "";

    const urgent = fuvar.surgos
      ? `<span style="background:#ff5252;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">SÜRGŐS</span>`
      : "";

    card.innerHTML = `
      <h3 style="margin:0; font-size:16px;">
        ${fuvar.megnevezes} ${adrBadge} ${urgent}
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

    container.appendChild(card);
  });
}
