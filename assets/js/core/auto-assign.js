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
  evaluatePotkocsiForFuvar,
  setDispatchProfile as setMatchingDispatchProfile
} from "../ui/matching.js";
import { setSessionState, saveSessionState } from "./session-state.js";

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

function normalizeAutoAssignOptions(options = {}) {
  const profileConfig = options?.profileConfig && typeof options.profileConfig === "object"
    ? options.profileConfig
    : null;

  return {
    profileConfig,
    planningDate: options?.planningDate || null,
    strictMode: Boolean(options?.strictMode)
  };
}

function getMainFuvarForSorting(jarat) {
  return jarat?.exportFuvar || jarat?.importFuvar || jarat?.belfoldiFuvar || null;
}

function sortJaratokByProfilePriority(jaratok, profileConfig) {
  const profileId = profileConfig?.id || null;
  const params = profileConfig?.params || {};

  if (!profileId) {
    return [...jaratok];
  }

  const sorted = [...jaratok];

  sorted.sort((left, right) => {
    const leftMain = getMainFuvarForSorting(left);
    const rightMain = getMainFuvarForSorting(right);

    if (!leftMain || !rightMain) {
      return 0;
    }

    if (leftMain.surgos !== rightMain.surgos) {
      return leftMain.surgos ? -1 : 1;
    }

    if (profileId === "service-focus") {
      const delayAlertMinutes = Number(params.delayAlertMinutes);
      const cutoffMs = Number.isFinite(delayAlertMinutes)
        ? delayAlertMinutes * 60 * 1000
        : 45 * 60 * 1000;
      const leftPickup = isoMs(leftMain.felrakas?.ido);
      const rightPickup = isoMs(rightMain.felrakas?.ido);
      const now = Date.now();
      const leftCritical = leftPickup > 0 && (leftPickup - now) <= cutoffMs;
      const rightCritical = rightPickup > 0 && (rightPickup - now) <= cutoffMs;
      if (leftCritical !== rightCritical) {
        return leftCritical ? -1 : 1;
      }
    }

    if (profileId === "quick-flow") {
      const leftStart = isoMs(leftMain.felrakas?.ido);
      const rightStart = isoMs(rightMain.felrakas?.ido);
      return leftStart - rightStart;
    }

    const leftDistance = Number(leftMain.tavolsag_km) || 0;
    const rightDistance = Number(rightMain.tavolsag_km) || 0;
    return leftDistance - rightDistance;
  });

  return sorted;
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
export function runAutoAssign(options = {}) {
  const runOptions = normalizeAutoAssignOptions(options);
  const profileConfig = runOptions.profileConfig;

  if (profileConfig?.id && profileConfig?.params) {
    setMatchingDispatchProfile(profileConfig.id, profileConfig.params);
  }

  // ── 1. Nullázás (working copy) ─────────────────────────────────────────────
  // Mélymásolat a tényleges adatokon, hogy a "Mégsem" ne veszítsen el semmit.
  // A hívó felelős az eredmény tényleges FUVAROK-ba való visszaírásáért.
  const fuvarokSnapshot = FUVAROK.map((f) => ({ ...f }));
  const soforokSnapshot = SOFOROK.map((s) => ({ ...s, timeline: [] }));
  const vontatokSnapshot = VONTATOK.map((v) => ({ ...v, timeline: [] }));
  const potkocsikSnapshot = POTKOCSIK.map((p) => ({ ...p, timeline: [] }));

  const previousAssignmentsByFuvarId = new Map(
    FUVAROK.map((f) => [
      f.id,
      {
        soforId: f.assignedSoforId || null,
        vontatoId: f.assignedVontatoId || null,
        potkocsiId: f.assignedPotkocsiId || null
      }
    ])
  );

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

  function getPreferredResourcesFromPreviousAssignment(fuvar) {
    const previous = previousAssignmentsByFuvarId.get(fuvar?.id);
    if (!previous) {
      return { sofor: null, vontato: null, potkocsi: null };
    }

    const sofor = previous.soforId
      ? soforokSnapshot.find((item) => item.id === previous.soforId) || null
      : null;
    const vontato = previous.vontatoId
      ? vontatokSnapshot.find((item) => item.id === previous.vontatoId) || null
      : null;
    const potkocsi = previous.potkocsiId
      ? potkocsikSnapshot.find((item) => item.id === previous.potkocsiId) || null
      : null;

    return { sofor, vontato, potkocsi };
  }

  function canUsePreferredSofor(sofor, fuvar) {
    if (!sofor) return false;
    if (hasSnapCollision(sofor.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) return false;
    const result = evaluateSoforForFuvar({ ...sofor, timeline: [] }, fuvar);
    return result.grade !== "bad";
  }

  function canUsePreferredVontato(vontato, fuvar) {
    if (!vontato) return false;
    if (hasSnapCollision(vontato.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) return false;
    const result = evaluateVontatoForFuvar({ ...vontato, timeline: [] }, fuvar);
    return result.grade !== "bad";
  }

  function canUsePreferredPotkocsi(potkocsi, fuvar) {
    if (!potkocsi) return false;
    if (hasSnapCollision(potkocsi.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) return false;
    const result = evaluatePotkocsiForFuvar({ ...potkocsi, timeline: [] }, fuvar);
    return result.grade !== "bad";
  }

  function assignSnap(fuvar, soforOverride = null, vontatoOverride = null, potkocsiOverride = null) {
    const preferred = getPreferredResourcesFromPreviousAssignment(fuvar);

    const sofor = soforOverride
      || (canUsePreferredSofor(preferred.sofor, fuvar) ? preferred.sofor : null)
      || findBestSoforSnap(fuvar);
    const vontato = vontatoOverride
      || (canUsePreferredVontato(preferred.vontato, fuvar) ? preferred.vontato : null)
      || findBestVontatoSnap(fuvar, sofor);
    const potkocsi = potkocsiOverride
      || (canUsePreferredPotkocsi(preferred.potkocsi, fuvar) ? preferred.potkocsi : null)
      || findBestPotkocsiSnap(fuvar, vontato);

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

  function collectUniqueAssignedResources(fuvarokInJarat) {
    const soforIds = [...new Set(fuvarokInJarat.map((f) => f.assignedSoforId).filter(Boolean))];
    const vontatoIds = [...new Set(fuvarokInJarat.map((f) => f.assignedVontatoId).filter(Boolean))];
    const potkocsiIds = [...new Set(fuvarokInJarat.map((f) => f.assignedPotkocsiId).filter(Boolean))];

    return {
      soforok: soforIds
        .map((id) => soforokSnapshot.find((item) => item.id === id))
        .filter(Boolean),
      vontatok: vontatoIds
        .map((id) => vontatokSnapshot.find((item) => item.id === id))
        .filter(Boolean),
      potkocsik: potkocsiIds
        .map((id) => potkocsikSnapshot.find((item) => item.id === id))
        .filter(Boolean)
    };
  }

  // ── 3. Járatképzés – SZERELVÉNY-FIRST ────────────────────────────────────
  //
  //  Logikai elv:
  //  Egy járat = egy sofőr+vontató+(pótkocsi) szerelvény + az ahhoz időben
  //  ütközésmentesen illeszthető fuvar-sorozat (előfutás→export→import→utófutás).
  //
  //  Lépések:
  //  3a. Szerelvény-lista felépítése (linkedId-k + előző assignmentek alapján)
  //  3b. Minden ismert szerelvényhez kiosztjuk az illeszkedő fuvar-sorozatokat
  //  3c. Fennmaradó fuvarok → greedy párosítás (régi logika, fallback)
  //  3d. Belföldi fuvarok → egyenként saját járat

  // ─── 3a. Szerelvény-lista ────────────────────────────────────────────────
  // Elsődleges forrás: vontatók linkedSoforId / linkedPotkocsiId kapcsolatai
  // Másodlagos forrás: az előző kiosztásból ismert (sofor, vontato, potkocsi) hármasok

  const szerelvenyMap = new Map(); // kulcs: vontatoId → { vontatoId, soforId, potkocsiId }

  for (const v of vontatokSnapshot) {
    szerelvenyMap.set(v.id, {
      vontatoId: v.id,
      soforId: v.linkedSoforId || null,
      potkocsiId: v.linkedPotkocsiId || null
    });
  }

  // Előző assignmentekből kiegészítés: ha az előző kiosztásban egy vontatóhoz
  // más sofőr/pótkocsi volt rendelve, azt adjuk hozzá (de linkedId prioritást élvez)
  for (const [, prev] of previousAssignmentsByFuvarId) {
    if (!prev.vontatoId) continue;
    const entry = szerelvenyMap.get(prev.vontatoId);
    if (entry) {
      if (!entry.soforId && prev.soforId) entry.soforId = prev.soforId;
      if (!entry.potkocsiId && prev.potkocsiId) entry.potkocsiId = prev.potkocsiId;
    }
  }

  // ─── Segédfüggvény: befér-e egy fuvar-lista az adott szerelvénybe? ────────
  // Elfogadjuk a szerelvényt, ha az összes fuvar ütközésmentes az eddig
  // hozzájuk tartozó timeline-on (a temporális kiosztásra csak itt ellenőrzünk,
  // a tényleges timeline-írás a 4. lépésben történik).
  function fuvarokFitIntoSzerelveny(fuvarList, sz) {
    const sofor = sz.soforId ? soforokSnapshot.find((s) => s.id === sz.soforId) : null;
    const vontato = vontatokSnapshot.find((v) => v.id === sz.vontatoId);
    const potkocsi = sz.potkocsiId ? potkocsikSnapshot.find((p) => p.id === sz.potkocsiId) : null;
    if (!vontato) return false;

    for (const fuvar of fuvarList) {
      const s = fuvar.felrakas?.ido;
      const e = fuvar.lerakas?.ido;
      if (!s || !e) continue;
      if (sofor && hasSnapCollision(sofor.timeline, s, e)) return false;
      if (hasSnapCollision(vontato.timeline, s, e)) return false;
      if (potkocsi && hasSnapCollision(potkocsi.timeline, s, e)) return false;
    }
    return true;
  }

  // ─── 3b. Fuvar-sorozat felépítés és szerelvényhez rendelés ───────────────
  // Összes fuvarot kataloizgáljuk: export-ok alapján próbálunk sorozatokat alkotni.

  const exportFuvarok = fuvarokSnapshot
    .filter((f) => f.viszonylat === "export")
    .sort((a, b) => {
      if (a.surgos !== b.surgos) return a.surgos ? -1 : 1;
      return isoMs(a.felrakas?.ido) - isoMs(b.felrakas?.ido);
    });

  const importPool = fuvarokSnapshot
    .filter((f) => f.viszonylat === "import")
    .slice();

  const jaratok = [];
  const usedExportIds = new Set();
  const usedImportIds = new Set();

  // Szerelvény prioritás: ha az előző kiosztás szerint egy exporthoz volt rendelve
  // vontató, az adott szerelvénnyel próbálkozunk elsőként.
  function getPreferredSzerelvenyForFuvar(fuvar) {
    const prev = previousAssignmentsByFuvarId.get(fuvar.id);
    if (prev?.vontatoId && szerelvenyMap.has(prev.vontatoId)) {
      return szerelvenyMap.get(prev.vontatoId);
    }
    return null;
  }

  // Szerelvény-prioritású export feldolgozás
  for (const exportF of exportFuvarok) {
    if (usedExportIds.has(exportF.id)) continue;

    const elofutas = fuvarokSnapshot.find((f) => f.elofutasExportFuvarId === exportF.id) || null;

    // Import keresés: időbeli közelség
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

    const utofutas = bestImport
      ? fuvarokSnapshot.find((f) => f.utofutasImportFuvarId === bestImport.id) || null
      : null;

    const fuvarSorozat = [elofutas, exportF, bestImport, utofutas].filter(Boolean);

    // Keressük a legjobb szerelvényt ehhez a sorozathoz
    const preferredSz = getPreferredSzerelvenyForFuvar(exportF);
    let matchedSzerelveny = null;

    if (preferredSz && fuvarokFitIntoSzerelveny(fuvarSorozat, preferredSz)) {
      matchedSzerelveny = preferredSz;
    } else {
      // Bejárjuk az összes szerelvényt és az első illeszkedőt választjuk
      for (const [, sz] of szerelvenyMap) {
        if (sz === preferredSz) continue; // már megpróbáltuk
        if (fuvarokFitIntoSzerelveny(fuvarSorozat, sz)) {
          matchedSzerelveny = sz;
          break;
        }
      }
    }

    if (bestImport) usedImportIds.add(bestImport.id);
    usedExportIds.add(exportF.id);

    jaratok.push({
      jaratId: `J-${exportF.id}${bestImport ? `-${bestImport.id}` : ""}`,
      szerelvenyId: matchedSzerelveny ? matchedSzerelveny.vontatoId : null,
      szerelveny: matchedSzerelveny || null,
      exportFuvar: exportF,
      importFuvar: bestImport,
      elofutasFuvar: elofutas,
      utofutasFuvar: utofutas,
      resources: null,
      warnings: [],
      unassignedFuvars: []
    });
  }

  // Párosítatlan importok → fél-járat
  for (const imp of importPool) {
    if (usedImportIds.has(imp.id)) continue;
    const utofutas = fuvarokSnapshot.find((f) => f.utofutasImportFuvarId === imp.id) || null;
    const fuvarSorozat = [imp, utofutas].filter(Boolean);
    let matchedSzerelveny = null;
    for (const [, sz] of szerelvenyMap) {
      if (fuvarokFitIntoSzerelveny(fuvarSorozat, sz)) {
        matchedSzerelveny = sz;
        break;
      }
    }
    jaratok.push({
      jaratId: `J-IMPORT-${imp.id}`,
      szerelvenyId: matchedSzerelveny ? matchedSzerelveny.vontatoId : null,
      szerelveny: matchedSzerelveny || null,
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
    let matchedSzerelveny = null;
    for (const [, sz] of szerelvenyMap) {
      if (fuvarokFitIntoSzerelveny([bf], sz)) {
        matchedSzerelveny = sz;
        break;
      }
    }
    jaratok.push({
      jaratId: `J-BF-${bf.id}`,
      szerelvenyId: matchedSzerelveny ? matchedSzerelveny.vontatoId : null,
      szerelveny: matchedSzerelveny || null,
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
  const prioritizedJaratok = sortJaratokByProfilePriority(jaratok, profileConfig);

  for (const jarat of prioritizedJaratok) {
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

    // Szerelvény-first: ha a 3. lépés talált szerelvényt, annak erőforrásait
    // adjuk át override-ként, így a kiosztás garantáltan azt a kombinációt kapja.
    let szOverrideSofor = null;
    let szOverrideVontato = null;
    let szOverridePotkocsi = null;
    if (jarat.szerelveny) {
      const sz = jarat.szerelveny;
      szOverrideSofor = sz.soforId ? soforokSnapshot.find((s) => s.id === sz.soforId) || null : null;
      szOverrideVontato = sz.vontatoId ? vontatokSnapshot.find((v) => v.id === sz.vontatoId) || null : null;
      szOverridePotkocsi = sz.potkocsiId ? potkocsikSnapshot.find((p) => p.id === sz.potkocsiId) || null : null;
    }

    // Kiosztás a fő fuvarra (szerelvény override-okkal ha van)
    const res = assignSnap(mainFuvar, szOverrideSofor, szOverrideVontato, szOverridePotkocsi);
    jarat.resources = res;
    jarat.warnings.push(...res.warnings);

    if (res.unassignedReason) {
      jarat.unassignedFuvars.push({ fuvar: mainFuvar, reason: res.unassignedReason });
    }

    // A többi fuvar ugyanazokat az erőforrásokat kapja (szerelvény override-ok ha volt)
    for (const fuvar of fuvarokInJarat) {
      if (fuvar === mainFuvar) continue;
      const r = assignSnap(
        fuvar,
        szOverrideSofor || res.sofor,
        szOverrideVontato || res.vontato,
        szOverridePotkocsi || res.potkocsi
      );
      if (r.unassignedReason) {
        jarat.unassignedFuvars.push({ fuvar, reason: r.unassignedReason });
      }
      jarat.warnings.push(...r.warnings);
    }

    for (const fuvar of fuvarokInJarat) {
      const complete = Boolean(fuvar.assignedSoforId && fuvar.assignedVontatoId && fuvar.assignedPotkocsiId);
      if (complete) continue;

      const alreadyTracked = jarat.unassignedFuvars.some((entry) => entry?.fuvar?.id === fuvar.id);
      if (!alreadyTracked) {
        jarat.unassignedFuvars.push({ fuvar, reason: "Hiányos erőforrás-hozzárendelés" });
      }
    }

    const resourceSets = collectUniqueAssignedResources(fuvarokInJarat);
    jarat.resourceSets = resourceSets;

    if (!jarat.resources) {
      jarat.resources = { sofor: null, vontato: null, potkocsi: null, warnings: [], unassignedReason: null };
    }

    if (!jarat.resources.sofor && resourceSets.soforok.length > 0) {
      jarat.resources.sofor = resourceSets.soforok[0];
    }
    if (!jarat.resources.vontato && resourceSets.vontatok.length > 0) {
      jarat.resources.vontato = resourceSets.vontatok[0];
    }
    if (!jarat.resources.potkocsi && resourceSets.potkocsik.length > 0) {
      jarat.resources.potkocsi = resourceSets.potkocsik[0];
    }

    if (resourceSets.soforok.length > 1) {
      jarat.warnings.push(`Több sofőr érintett a járatban (${resourceSets.soforok.length} db)`);
    }
    if (resourceSets.vontatok.length > 1) {
      jarat.warnings.push(`Több vontató érintett a járatban (${resourceSets.vontatok.length} db)`);
    }
    if (resourceSets.potkocsik.length > 1) {
      jarat.warnings.push(`Több pótkocsi érintett a járatban (${resourceSets.potkocsik.length} db)`);
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
    spedicioPartners: SPEDICIO_PARTNER_NAMES.slice(0, 3),
    profileConfig,
    planningDate: runOptions.planningDate,
    strictMode: runOptions.strictMode
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

  const profileConfig = result?.profileConfig || null;
  const fuvarAssignments = FUVAROK.map((fuvar) => ({
    fuvarId: fuvar.id,
    assignedSoforId: fuvar.assignedSoforId || null,
    assignedVontatoId: fuvar.assignedVontatoId || null,
    assignedPotkocsiId: fuvar.assignedPotkocsiId || null
  }));

  setSessionState({
    schemaVersion: 1,
    appliedAt: new Date().toISOString(),
    profileId: profileConfig?.id || null,
    profileName: profileConfig?.name || null,
    profileSnapshot: profileConfig,
    fuvarAssignments,
    resourceTimelines: {
      soforok: SOFOROK.map((sofor) => ({ id: sofor.id, timeline: sofor.timeline || [] })),
      vontatok: VONTATOK.map((vontato) => ({ id: vontato.id, timeline: vontato.timeline || [] })),
      potkocsik: POTKOCSIK.map((potkocsi) => ({ id: potkocsi.id, timeline: potkocsi.timeline || [] }))
    },
    stats: result?.stats || null,
    warnings: result?.warnings || []
  });
  saveSessionState();
}
