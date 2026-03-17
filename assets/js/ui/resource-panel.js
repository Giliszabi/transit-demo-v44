// ======================================================================
// TransIT v4.4 – RESOURCE PANEL (Sofőr / Vontató / Pótkocsi)
// 3 külön scrollos oszlop, mindegyik kattintható és matchinget indít
// ======================================================================

import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";

// Matching integráció
import { evaluateFuvarokForResource } from "./matching.js";
import { renderTimeline } from "./timeline.js";

// =======================================================
// PANEL GENERÁTOR – LÉTREHOZZA A 3 OSZLOPOT
// =======================================================
export function renderResourcePanel(containerId, FUVAROK, onSelectResource) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="resource-columns">
      
      <div class="resource-column">
        <h3>👤 Sofőrök</h3>
        <div class="resource-list" id="list-sofor"></div>
      </div>

      <div class="resource-column">
        <h3>🚛 Vontatók</h3>
        <div class="resource-list" id="list-vontato"></div>
      </div>

      <div class="resource-column">
        <h3>🚚 Pótkocsik</h3>
        <div class="resource-list" id="list-potkocsi"></div>
      </div>

    </div>
  `;

  renderSoforList("list-sofor", SOFOROK, FUVAROK, onSelectResource);
  renderVontatoList("list-vontato", VONTATOK, FUVAROK, onSelectResource);
  renderPotkocsiList("list-potkocsi", POTKOCSIK, FUVAROK, onSelectResource);
}

// ======================================================================
// SEGÉDFÜGGVÉNY – egy erőforrás kártya HTML-je
// ======================================================================
function resourceCardHtml(icon, title, position) {
  return `
    <div class="res-card">
      <div class="res-title">${icon} ${title}</div>
      <div class="res-pos">📍 ${position || "-"}</div>
    </div>
  `;
}

// ======================================================================
// SOFŐR LISTA
// ======================================================================
function renderSoforList(targetId, list, FUVAROK, onSelectResource) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  list.forEach((s) => {
    const div = document.createElement("div");
    div.className = "resource-card";
    div.dataset.id = s.id;
    div.dataset.type = "sofor";

    div.innerHTML = resourceCardHtml("👤", s.nev, s.jelenlegi_pozicio?.hely);

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(s, FUVAROK, "sofor");
      onSelectResource("sofor", s, results);
    });

    el.appendChild(div);
  });
}

// ======================================================================
// VONTATÓ LISTA
// ======================================================================
function renderVontatoList(targetId, list, FUVAROK, onSelectResource) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  list.forEach((v) => {
    const div = document.createElement("div");
    div.className = "resource-card";
    div.dataset.id = v.id;
    div.dataset.type = "vontato";

    div.innerHTML = resourceCardHtml("🚛", v.rendszam, v.jelenlegi_pozicio?.hely);

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(v, FUVAROK, "vontato");
      onSelectResource("vontato", v, results);
    });

    el.appendChild(div);
  });
}

// ======================================================================
// PÓTKOCSI LISTA
// ======================================================================
function renderPotkocsiList(targetId, list, FUVAROK, onSelectResource) {
  const el = document.getElementById(targetId);
  el.innerHTML = "";

  list.forEach((p) => {
    const div = document.createElement("div");
    div.className = "resource-card";
    div.dataset.id = p.id;
    div.dataset.type = "potkocsi";

    div.innerHTML = resourceCardHtml("🚚", p.rendszam, p.jelenlegi_pozicio?.hely);

    div.addEventListener("click", () => {
      const results = evaluateFuvarokForResource(p, FUVAROK, "potkocsi");
      onSelectResource("potkocsi", p, results);
    });

    el.appendChild(div);
  });
}
