import { FUVAROK } from "../data/fuvarok.js";

/**
 * Fuvar kártyák kirenderelése egy adott konténerbe.
 * FUVAROK struktúra = meeting / Claude alapján.
 */
export function renderFuvarCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("Fuvar container nem található:", containerId);
    return;
  }

  if (!FUVAROK || FUVAROK.length === 0) {
    container.innerHTML = `
      <p style="opacity:0.6;">Nincs betöltött fuvar adat.</p>
    `;
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
      <h3 style="margin:0; font-size:16px;">${fuvar.megnevezes} ${adrBadge} ${urgent}</h3>
      <p style="opacity:0.7; margin-top:6px;">
        📍 ${fuvar.felrakas.cim.split(",")[0]} → ${fuvar.lerakas.cim.split(",")[0]}
      </p>
      <p style="opacity:0.5; margin-top:4px;">
        🚚 ${fuvar.tavolsag_km} km &nbsp;&nbsp; | &nbsp;&nbsp;
        🕒 Indulás: ${new Date(fuvar.felrakas.ido).toLocaleString("hu-HU")}
      </p>
    `;

    container.appendChild(card);
  });
}
