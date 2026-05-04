// =============================================================
//  TransIT v4.4 – AUTO-ASSIGN ENGINE
//  "Fuvarok összerakása" – teljes kiosztó algoritmus
// =============================================================
//
//  Lépések:
//  1. Nullázás – minden fuvar assignment + timeline törlése
//  2. Relay generálás – FUVAROK-hoz ELO-/UTO- generálás (ha hiányzik)
//  3. Járatképzés – export+import párosítás (időbeli közelség, greedy)
//  4. Erőforrás-kiosztás – sofőr / vontató / pótkocsi járatonként
//  5. Eredmény visszaadása – { jaratok, unassigned, warnings, stats }
//
//  Megjegyzés: csak in-memory módosítás, UI-t a hívó frissíti.
// =============================================================

import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { SPEDICIO_PARTNER_NAMES } from "../data/spedicio-partners.js";
import {
  evaluateSoforForFuvar,
  evaluateVontatoForFuvar,
  evaluatePotkocsiForFuvar
} from "../ui/matching.js";

// ── Relay-generáló logika (inline, mert a fuvarok.js-ben nem exportált) ──────

const DOMESTIC_SPEED_KMH = 50;
const FALLBACK_DISTANCE_KM = 35;
const FALLBACK_TRAVEL_MIN = 40;
const DOMESTIC_COORDS = {
  "Berhida": { lat: 47.110993, lon: 18.133937 },
  "Biatorbágy": { lat: 47.473944, lon: 18.823286 },
  "Budapest": { lat: 47.497879, lon: 19.040238 },
  "Dunaharaszti": { lat: 47.354155, lon: 19.091220 },
  "Ecser": { lat: 47.444502, lon: 19.318456 },
  "Gyál": { lat: 47.384545, lon: 19.217307 },
  "Gyöngyöshalász": { lat: 47.741773, lon: 19.921728 },
  "Győr": { lat: 47.683503, lon: 17.634283 },
  "Hatvan": { lat: 47.668397, lon: 19.674387 },
  "Kecskemét": { lat: 46.907476, lon: 19.692085 },
  "Kincsesbánya": { lat: 47.264460, lon: 18.273911 },
  "Kocs": { lat: 47.605500, lon: 18.213200 },
  "Komárom": { lat: 47.741735, lon: 18.121826 },
  "Környe": { lat: 47.547579, lon: 18.331852 },
  "Páty": { lat: 47.515450, lon: 18.827170 },
  "Rácalmás": { lat: 47.025902, lon: 18.939328 },
  "Szalkszentmárton": { lat: 46.975524, lon: 19.013285 },
  "Szigetszentmiklós": { lat: 47.348706, lon: 19.045241 },
  "Százhalombatta": { lat: 47.317199, lon: 18.912095 },
  "Székesfehérvár": { lat: 47.191017, lon: 18.410811 },
  "Tata": { lat: 47.651621, lon: 18.328208 },
  "Tatabánya": { lat: 47.583845, lon: 18.397986 },
  "Zalacséb": { lat: 46.861011, lon: 16.662287 },
  "Ócsa": { lat: 47.301189, lon: 19.231362 },
  "Környe, Telephely": { lat: 47.547579, lon: 18.331852 }
};

function getDomesticCoords(address) {
  return DOMESTIC_COORDS[String(address || "").trim()] || null;
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal = sinDLat ** 2 + sinDLon ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function estimateTravelMin(addressA, addressB) {
  const cA = getDomesticCoords(addressA);
  const cB = getDomesticCoords(addressB);
  const km = (cA && cB) ? haversineKm(cA, cB) : FALLBACK_DISTANCE_KM;
  return Math.max(FALLBACK_TRAVEL_MIN, Math.round((km / DOMESTIC_SPEED_KMH) * 60));
}

function estimateDistanceKm(addressA, addressB) {
  const cA = getDomesticCoords(addressA);
  const cB = getDomesticCoords(addressB);
  return (cA && cB) ? Math.round(haversineKm(cA, cB)) : FALLBACK_DISTANCE_KM;
}

function addMinutes(isoStr, minutes) {
  const d = new Date(isoStr);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

function isKornye(address) {
  return String(address || "").toLowerCase().includes("kornye") ||
         String(address || "").toLowerCase().includes("környe");
}

function buildRelayForFuvar(fuvar) {
  const generated = [];
  const felC = String(fuvar?.felrakas?.cim || "");
  const leC = String(fuvar?.lerakas?.cim || "");

  if (fuvar.viszonylat === "export" && !isKornye(felC)) {
    const travelMin = estimateTravelMin(felC, "Környe, Telephely");
    const distKm = estimateDistanceKm(felC, "Környe, Telephely");
    generated.push({
      id: `ELO-${fuvar.id}`,
      megnevezes: `Előfutás – ${felC} → Környe [${fuvar.id}]`,
      viszonylat: "belfold",
      fixedDomestic: true,
      felrakas: { cim: felC, ido: addMinutes(fuvar.felrakas.ido, -travelMin) },
      lerakas: { cim: "Környe, Telephely", ido: fuvar.felrakas.ido },
      tavolsag_km: distKm,
      adr: false,
      surgos: false,
      elofutasExportFuvarId: fuvar.id
    });
  }

  if (fuvar.viszonylat === "import" && !isKornye(leC)) {
    const travelMin = estimateTravelMin("Környe, Telephely", leC);
    const distKm = estimateDistanceKm("Környe, Telephely", leC);
    generated.push({
      id: `UTO-${fuvar.id}`,
      megnevezes: `Utófutás – Környe → ${leC} [${fuvar.id}]`,
      viszonylat: "belfold",
      fixedDomestic: true,
      felrakas: { cim: "Környe, Telephely", ido: fuvar.lerakas.ido },
      lerakas: { cim: leC, ido: addMinutes(fuvar.lerakas.ido, travelMin) },
      tavolsag_km: distKm,
      adr: false,
      surgos: false,
      utofutasImportFuvarId: fuvar.id
    });
  }

  return generated;
}

// ── Segédfüggvények ──────────────────────────────────────────────────────────

function isoMs(isoStr) {
  const ms = new Date(isoStr || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Timeline blokkot ad egy erőforráshoz, ha nincs még ilyen fuvarId */
function addTimelineBlock(resource, fuvar) {
  if (!Array.isArray(resource.timeline)) {
    resource.timeline = [];
  }
  if (resource.timeline.some((b) => b.fuvarId === fuvar.id)) {
    return; // már van
  }
  resource.timeline.push({
    fuvarId: fuvar.id,
    label: fuvar.megnevezes,
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    felrakasCim: fuvar.felrakas?.cim,
    lerakasCim: fuvar.lerakas?.cim,
    viszonylat: fuvar.viszonylat,
    type: "fuvar"
  });
}

/**
 * Megkeresi az első megfelelő sofőrt a fuvarhoz.
 * Visszaad: sofőr-objektum vagy null.
 */
function findBestSofor(fuvar) {
  let bestWarn = null;
  for (const sofor of SOFOROK) {
    const result = evaluateSoforForFuvar(sofor, fuvar);
    if (result.grade === "ok") return sofor;
    if (result.grade === "warn" && !bestWarn) bestWarn = sofor;
  }
  return bestWarn;
}

/**
 * Megkeresi az első megfelelő vontatót a fuvarhoz.
 * Ha a sofőrnek van dedikált vontatója, azt próbálja először.
 */
function findBestVontato(fuvar, sofor) {
  const preferred = sofor?.linkedVontatoId
    ? VONTATOK.find((v) => v.id === sofor.linkedVontatoId)
    : null;

  if (preferred) {
    const result = evaluateVontatoForFuvar(preferred, fuvar);
    if (result.grade === "ok" || result.grade === "warn") return preferred;
  }

  let bestWarn = null;
  for (const vontato of VONTATOK) {
    const result = evaluateVontatoForFuvar(vontato, fuvar);
    if (result.grade === "ok") return vontato;
    if (result.grade === "warn" && !bestWarn) bestWarn = vontato;
  }
  return bestWarn;
}

/**
 * Megkeresi az első megfelelő pótkocsit a fuvarhoz.
 * Ha a vontatónak van dedikált pótkocsija, azt próbálja először.
 */
function findBestPotkocsi(fuvar, vontato) {
  const preferred = vontato?.linkedPotkocsiId
    ? POTKOCSIK.find((p) => p.id === vontato.linkedPotkocsiId)
    : null;

  if (preferred) {
    const result = evaluatePotkocsiForFuvar(preferred, fuvar);
    if (result.grade === "ok" || result.grade === "warn") return preferred;
  }

  let bestWarn = null;
  for (const pk of POTKOCSIK) {
    const result = evaluatePotkocsiForFuvar(pk, fuvar);
    if (result.grade === "ok") return pk;
    if (result.grade === "warn" && !bestWarn) bestWarn = pk;
  }
  return bestWarn;
}

/**
 * Kiosztja az erőforrásokat egy fuvarhoz (in-place módosítás).
 * Visszaad: { sofor, vontato, potkocsi, warnings, unassignedReason }
 */
function assignResourcesToFuvar(fuvar, soforOverride = null, vontatoOverride = null, potkocsiOverride = null) {
  const sofor = soforOverride || findBestSofor(fuvar);
  const vontato = vontatoOverride || findBestVontato(fuvar, sofor);
  const potkocsi = potkocsiOverride || findBestPotkocsi(fuvar, vontato);

  const warnings = [];

  if (sofor) {
    fuvar.assignedSoforId = sofor.id;
    addTimelineBlock(sofor, fuvar);
    const result = evaluateSoforForFuvar(sofor, fuvar);
    if (result.grade === "warn") warnings.push(...result.warnings);
  }

  if (vontato) {
    fuvar.assignedVontatoId = vontato.id;
    addTimelineBlock(vontato, fuvar);
  }

  if (potkocsi) {
    fuvar.assignedPotkocsiId = potkocsi.id;
    addTimelineBlock(potkocsi, fuvar);
  }

  const unassignedReason = !sofor ? "Nincs elérhető sofőr"
    : !vontato ? "Nincs elérhető vontató"
    : !potkocsi ? "Nincs elérhető pótkocsi"
    : null;

  return { sofor, vontato, potkocsi, warnings, unassignedReason };
}

// ── Fő export ────────────────────────────────────────────────────────────────

/**
 * Lefuttatja a teljes automatikus kiosztást.
 * Visszaad egy eredmény-objektumot – az adatokat nem alkalmazza (hívó dönt).
 *
 * @returns {{
 *   jaratok: Array,
 *   unassigned: Array,
 *   warnings: Array,
 *   stats: { total: number, assigned: number, partial: number, unassigned: number, jaratCount: number }
 * }}
 */
export function runAutoAssign() {
  // ── 1. Nullázás (working copy) ─────────────────────────────────────────────
  // Mélymásolat a tényleges adatokon, hogy a "Mégsem" ne veszítsen el semmit.
  // A hívó felelős az eredmény tényleges FUVAROK-ba való visszaírásáért.
  const fuvarokSnapshot = FUVAROK.map((f) => ({ ...f }));
  const soforokSnapshot = SOFOROK.map((s) => ({ ...s, timeline: [] }));
  const vontatokSnapshot = VONTATOK.map((v) => ({ ...v, timeline: [] }));
  const potkocsikSnapshot = POTKOCSIK.map((p) => ({ ...p, timeline: [] }));

  // Nullázzuk az eredeti listák timeline-jait és assignment mezőit (snapshot)
  fuvarokSnapshot.forEach((f) => {
    delete f.assignedSoforId;
    delete f.assignedVontatoId;
    delete f.assignedPotkocsiId;
  });

  // ── 2. Relay-generálás ─────────────────────────────────────────────────────
  const existingIds = new Set(fuvarokSnapshot.map((f) => f.id));
  const baseForRelay = fuvarokSnapshot.filter(
    (f) => (f.viszonylat === "export" || f.viszonylat === "import") && !f.fixedDomestic
  );

  for (const fuvar of baseForRelay) {
    const relays = buildRelayForFuvar(fuvar);
    relays.forEach((relay) => {
      if (!existingIds.has(relay.id)) {
        fuvarokSnapshot.push(relay);
        existingIds.add(relay.id);
      }
    });
  }

  // ── Erőforráslista ideiglenes átírás ──────────────────────────────────────
  // Az evaluálás a valós SOFOROK/VONTATOK/POTKOCSIK listákat használja,
  // ezért a snapshot adatait ideiglenesen visszaírjuk az eredeti tömbökbe,
  // majd a hívó alkalmazza a végleges eredményt.
  // MEGJEGYZÉS: Ez a modul teljes egészében a snapshot-ba ír,
  // az eredeti objetkumaokat nem módosítja.

  // Saját mini-lista a kiosztáshoz (matching.js-t nem importáljuk újra)
  // Az evaluálófüggvények az eredeti SOFOROK/VONTATOK/POTKOCSIK-ot olvassák,
  // de a timeline-ok a snapshotban módosulnak. Ezért a kolliziót a snapshoten
  // ellenőritjük saját hasCollision-nel.

  function hasSnapCollision(timeline, start, end) {
    const s = new Date(start);
    const e = new Date(end);
    return timeline.some((b) => {
      if (b.synthetic) return false;
      const bs = new Date(b.start);
      const be = new Date(b.end);
      return s < be && e > bs;
    });
  }

  function findBestSoforSnap(fuvar) {
    let bestWarn = null;
    for (const sofor of soforokSnapshot) {
      if (hasSnapCollision(sofor.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) continue;
      const result = evaluateSoforForFuvar({ ...sofor, timeline: [] }, fuvar);
      if (result.grade === "ok") return sofor;
      if (result.grade === "warn" && !bestWarn) bestWarn = sofor;
    }
    return bestWarn;
  }

  function findBestVontatoSnap(fuvar, sofor) {
    const preferred = sofor?.linkedVontatoId
      ? vontatokSnapshot.find((v) => v.id === sofor.linkedVontatoId)
      : null;
    if (preferred && !hasSnapCollision(preferred.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
      return preferred;
    }
    let bestWarn = null;
    for (const v of vontatokSnapshot) {
      if (hasSnapCollision(v.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) continue;
      const result = evaluateVontatoForFuvar({ ...v, timeline: [] }, fuvar);
      if (result.grade === "ok") return v;
      if (result.grade === "warn" && !bestWarn) bestWarn = v;
    }
    return bestWarn;
  }

  function findBestPotkocsiSnap(fuvar, vontato) {
    const preferred = vontato?.linkedPotkocsiId
      ? potkocsikSnapshot.find((p) => p.id === vontato.linkedPotkocsiId)
      : null;
    if (preferred && !hasSnapCollision(preferred.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
      return preferred;
    }
    let bestWarn = null;
    for (const pk of potkocsikSnapshot) {
      if (hasSnapCollision(pk.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) continue;
      const result = evaluatePotkocsiForFuvar({ ...pk, timeline: [] }, fuvar);
      if (result.grade === "ok") return pk;
      if (result.grade === "warn" && !bestWarn) bestWarn = pk;
    }
    return bestWarn;
  }

  function assignSnap(fuvar, soforOverride = null, vontatoOverride = null, potkocsiOverride = null) {
    const sofor = soforOverride || findBestSoforSnap(fuvar);
    const vontato = vontatoOverride || findBestVontatoSnap(fuvar, sofor);
    const potkocsi = potkocsiOverride || findBestPotkocsiSnap(fuvar, vontato);

    const warnings = [];
    if (sofor) {
      fuvar.assignedSoforId = sofor.id;
      addTimelineBlock(sofor, fuvar);
      const r = evaluateSoforForFuvar({ ...sofor, timeline: [] }, fuvar);
      if (r.grade === "warn") warnings.push(...r.warnings);
    }
    if (vontato) {
      fuvar.assignedVontatoId = vontato.id;
      addTimelineBlock(vontato, fuvar);
    }
    if (potkocsi) {
      fuvar.assignedPotkocsiId = potkocsi.id;
      addTimelineBlock(potkocsi, fuvar);
    }

    return {
      sofor: sofor || null,
      vontato: vontato || null,
      potkocsi: potkocsi || null,
      warnings,
      unassignedReason: !sofor ? "Nincs elérhető sofőr"
        : !vontato ? "Nincs elérhető vontató"
        : !potkocsi ? "Nincs elérhető pótkocsi"
        : null
    };
  }

  // ── 3. Járatképzés ─────────────────────────────────────────────────────────
  const exportFuvarok = fuvarokSnapshot
    .filter((f) => f.viszonylat === "export")
    .sort((a, b) => {
      // Sürgős előre, majd idő szerint
      if (a.surgos !== b.surgos) return a.surgos ? -1 : 1;
      return isoMs(a.felrakas?.ido) - isoMs(b.felrakas?.ido);
    });

  const importPool = fuvarokSnapshot
    .filter((f) => f.viszonylat === "import")
    .slice(); // másolat a kiválasztáshoz

  const jaratok = [];
  const usedExportIds = new Set();
  const usedImportIds = new Set();

  for (const exportF of exportFuvarok) {
    if (usedExportIds.has(exportF.id)) continue;

    // Előfutás keresése ehhez az exporthoz
    const elofutas = fuvarokSnapshot.find(
      (f) => f.elofutasExportFuvarId === exportF.id
    ) || null;

    // Legjobb import keresése időbeli közelség alapján
    const exportEndMs = isoMs(exportF.lerakas?.ido);
    let bestImport = null;
    let bestDiff = Infinity;
    for (const imp of importPool) {
      if (usedImportIds.has(imp.id)) continue;
      const diff = Math.abs(isoMs(imp.felrakas?.ido) - exportEndMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestImport = imp;
      }
    }

    // Utófutás keresése a megtalált importhoz
    const utofutas = bestImport
      ? fuvarokSnapshot.find((f) => f.utofutasImportFuvarId === bestImport.id) || null
      : null;

    if (bestImport) {
      usedImportIds.add(bestImport.id);
    }
    usedExportIds.add(exportF.id);

    jaratok.push({
      jaratId: `J-${exportF.id}${bestImport ? `-${bestImport.id}` : ""}`,
      exportFuvar: exportF,
      importFuvar: bestImport,
      elofutasFuvar: elofutas,
      utofutasFuvar: utofutas,
      resources: null,    // kitöltődik 4. lépésben
      warnings: [],
      unassignedFuvars: []
    });
  }

  // Párosítatlan importok → fél-járat
  for (const imp of importPool) {
    if (usedImportIds.has(imp.id)) continue;
    const utofutas = fuvarokSnapshot.find((f) => f.utofutasImportFuvarId === imp.id) || null;
    jaratok.push({
      jaratId: `J-IMPORT-${imp.id}`,
      exportFuvar: null,
      importFuvar: imp,
      elofutasFuvar: null,
      utofutasFuvar: utofutas,
      resources: null,
      warnings: [],
      unassignedFuvars: []
    });
    usedImportIds.add(imp.id);
  }

  // Belföldi fuvarok (nem relay) → önálló járat
  const belfoldiFuvarok = fuvarokSnapshot.filter(
    (f) => f.viszonylat === "belfold" && !f.elofutasExportFuvarId && !f.utofutasImportFuvarId
  );
  for (const bf of belfoldiFuvarok) {
    jaratok.push({
      jaratId: `J-BF-${bf.id}`,
      exportFuvar: null,
      importFuvar: null,
      elofutasFuvar: null,
      utofutasFuvar: null,
      belfoldiFuvar: bf,
      resources: null,
      warnings: [],
      unassignedFuvars: []
    });
  }

  // ── 4. Erőforrás-kiosztás járásonként ─────────────────────────────────────
  for (const jarat of jaratok) {
    const fuvarokInJarat = [
      jarat.elofutasFuvar,
      jarat.exportFuvar,
      jarat.importFuvar,
      jarat.utofutasFuvar,
      jarat.belfoldiFuvar
    ].filter(Boolean);

    // A fő fuvar az export (vagy import ha nincs export, vagy belföldi)
    const mainFuvar = jarat.exportFuvar || jarat.importFuvar || jarat.belfoldiFuvar;
    if (!mainFuvar) continue;

    // Kiosztás a fő fuvarra
    const res = assignSnap(mainFuvar);
    jarat.resources = res;
    jarat.warnings.push(...res.warnings);

    if (res.unassignedReason) {
      jarat.unassignedFuvars.push({ fuvar: mainFuvar, reason: res.unassignedReason });
    }

    // A többi fuvar ugyanazokat az erőforrásokat kapja
    for (const fuvar of fuvarokInJarat) {
      if (fuvar === mainFuvar) continue;
      const r = assignSnap(fuvar, res.sofor, res.vontato, res.potkocsi);
      if (r.unassignedReason) {
        jarat.unassignedFuvars.push({ fuvar, reason: r.unassignedReason });
      }
      jarat.warnings.push(...r.warnings);
    }
  }

  // ── 5. Összesítés ──────────────────────────────────────────────────────────
  const allUnassigned = [];
  const allWarnings = [];

  for (const jarat of jaratok) {
    allWarnings.push(...jarat.warnings.map((w) => `[${jarat.jaratId}] ${w}`));
    allUnassigned.push(...jarat.unassignedFuvars);
  }

  const assignedCount = fuvarokSnapshot.filter((f) => f.assignedSoforId).length;
  const totalCount = fuvarokSnapshot.length;
  const partialCount = fuvarokSnapshot.filter(
    (f) => f.assignedSoforId && (!f.assignedVontatoId || !f.assignedPotkocsiId)
  ).length;

  return {
    jaratok,
    fuvarokSnapshot,
    soforokSnapshot,
    vontatokSnapshot,
    potkocsikSnapshot,
    unassigned: allUnassigned,
    warnings: allWarnings,
    stats: {
      total: totalCount,
      assigned: assignedCount,
      partial: partialCount,
      unassigned: totalCount - assignedCount,
      jaratCount: jaratok.length
    },
    spedicioPartners: SPEDICIO_PARTNER_NAMES.slice(0, 3)
  };
}

/**
 * Az auto-assign eredményét visszaírja az eredeti tömbökbe (in-place).
 * Ezt csak akkor hívja a hívó, ha a felhasználó jóváhagyta.
 */
export function applyAutoAssignResult(result) {
  const { fuvarokSnapshot, soforokSnapshot, vontatokSnapshot, potkocsikSnapshot } = result;

  // Fuvarok
  for (const snap of fuvarokSnapshot) {
    const orig = FUVAROK.find((f) => f.id === snap.id);
    if (orig) {
      orig.assignedSoforId = snap.assignedSoforId || undefined;
      orig.assignedVontatoId = snap.assignedVontatoId || undefined;
      orig.assignedPotkocsiId = snap.assignedPotkocsiId || undefined;
    } else {
      // Újonnan generált relay
      FUVAROK.push(snap);
    }
  }

  // Sofőrök timeline
  for (const snap of soforokSnapshot) {
    const orig = SOFOROK.find((s) => s.id === snap.id);
    if (orig) orig.timeline = snap.timeline;
  }

  // Vontatok timeline
  for (const snap of vontatokSnapshot) {
    const orig = VONTATOK.find((v) => v.id === snap.id);
    if (orig) orig.timeline = snap.timeline;
  }

  // Potkocsik timeline
  for (const snap of potkocsikSnapshot) {
    const orig = POTKOCSIK.find((p) => p.id === snap.id);
    if (orig) orig.timeline = snap.timeline;
  }
}
