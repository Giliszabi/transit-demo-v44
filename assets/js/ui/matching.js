import { getDomesticTransitRoleInfo } from "./transit-relations.js";
import { getLoadedPlanningData } from "../data/generated-loader.js";
import { evaluateDriverAgainstJob } from "../core/eligibility-engine.js";

// =======================================================
// TransIT v4.4 - MATCHING ENGINE (Bidirectional)
// Gépjárművezető / Vontató / Pótkocsi ↔ Fuvar
// Szabályalapú relevancia-értékelés
// =======================================================

function isSameFuvarTimelineBlock(block, fuvar) {
  if (!block || !fuvar || block?.type !== "fuvar") {
    return false;
  }

  if (block?.fuvarId && fuvar?.id) {
    return block.fuvarId === fuvar.id;
  }

  return block?.label === fuvar?.megnevezes
    && block?.start === fuvar?.felrakas?.ido
    && block?.end === fuvar?.lerakas?.ido;
}

// Helper: time collision
function hasCollision(timeline, start, end, options = {}) {
  const s = new Date(start);
  const e = new Date(end);
  const ignoredFuvar = options?.ignoredFuvar || null;

  return timeline.some(b => {
    if (b.synthetic) {
      return false;
    }

    if (ignoredFuvar && isSameFuvarTimelineBlock(b, ignoredFuvar)) {
      return false;
    }

    const bs = new Date(b.start);
    const be = new Date(b.end);
    return (s < be && e > bs);
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ensureResourceTipus(resource, localTypeLabel) {
  if (!resource.tipus) {
    resource.tipus = Math.random() < 0.5 ? localTypeLabel : "nemzetkozi";
  }

  return resource.tipus;
}

function isDomesticOnlyTipus(tipus) {
  return normalizeText(tipus).includes("belfold");
}

export function getMatchGradePriority(matchGrade) {
  if (matchGrade === "ok") return 0;
  if (matchGrade === "warn") return 1;
  if (matchGrade === "bad") return 2;
  return 3;
}

export function getResourceMatchSortValue(resource) {
  const priority = getMatchGradePriority(resource?.matchGrade);
  const reasonCount = Array.isArray(resource?.matchReasons) ? resource.matchReasons.length : 0;
  return (priority * 100) + reasonCount;
}

export function sortResourcesByMatchQuality(list, getLabel = null) {
  return [...(Array.isArray(list) ? list : [])]
    .map((resource, index) => ({ resource, index }))
    .sort((left, right) => {
      const scoreDiff = getResourceMatchSortValue(left.resource) - getResourceMatchSortValue(right.resource);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const leftLabel = String(getLabel ? getLabel(left.resource) : (left.resource?.nev || left.resource?.rendszam || left.resource?.id || ""));
      const rightLabel = String(getLabel ? getLabel(right.resource) : (right.resource?.nev || right.resource?.rendszam || right.resource?.id || ""));
      const labelDiff = leftLabel.localeCompare(rightLabel, "hu-HU");
      if (labelDiff !== 0) {
        return labelDiff;
      }

      return left.index - right.index;
    })
    .map(({ resource }) => resource);
}

// =======================================================
// AKTÍV FUVARSZERVEZÉSI PROFIL (opcionális, modul-szintű)
// =======================================================
let _activeDispatchProfile = null;

/**
 * Beállítja az aktív dispatch profil adatait.
 * Ha nincs bekapcsolt profil, null-t kell átadni – ez esetben
 * a matching logika az alapértelmezett viselkedéssel fut.
 * @param {string|null} profileId
 * @param {Object|null} params  – a profil aktuális paraméterei (key→value)
 */
export function setDispatchProfile(profileId, params) {
  _activeDispatchProfile = params ? { _profileId: profileId, ...params } : null;
}

// =======================================================
// FUVAR TAG-EK KIEGÉSZÍTÉSE (ADR, sürgős, típus)
// =======================================================
export function evaluateFuvarTags(fuvar) {
  const now = Date.now();
  const start = new Date(fuvar.felrakas.ido).getTime();

  // sürgős
  fuvar.surgos = (start - now) < (24 * 3600 * 1000);

  // ADR — ha nincs explicit, random
  if (fuvar.adr === undefined) {
    fuvar.adr = Math.random() < 0.25;
  }

  // Fuvar típus: elsődlegesen a rögzített viszonylatot használjuk.
  // A "spediccio" nem automatikus fuvar-kategória, csak explicit UI állapot lehet.
  if (["belfold", "export", "import"].includes(fuvar.viszonylat)) {
    fuvar.kategoria = fuvar.viszonylat;
    return;
  }

  // Fallback csak legacy adatokhoz, ha nincs viszonylat megadva.
  const fel = fuvar.felrakas.cim.toLowerCase();
  const ler = fuvar.lerakas.cim.toLowerCase();

  const huFel = fel.includes("hungary") || fel.includes("budapest") || fel.includes("magyar");
  const huLer = ler.includes("hungary") || ler.includes("budapest") || ler.includes("magyar");

  if (huFel && huLer) {
    fuvar.kategoria = "belfold";
  } else if (huFel && !huLer) {
    fuvar.kategoria = "export";
  } else {
    fuvar.kategoria = "import";
  }
}

function isDomesticTransitFuvar(fuvar) {
  if (!fuvar) {
    return false;
  }

  if (fuvar.kategoria === "belfold" || fuvar.viszonylat === "belfold") {
    return true;
  }

  return Boolean(getDomesticTransitRoleInfo(fuvar));
}

// =======================================================
// SOFŐR EVALUÁCIÓ
// =======================================================
export function evaluateSoforForFuvar(sofor, fuvar) {
  evaluateFuvarTags(fuvar);

  const profile = _activeDispatchProfile;
  const reasons = [];   // kemény elutasítások
  const warnings = [];  // puha figyelmeztetések (profil-alapú)
  let suitable = true;
  const soforTipus = ensureResourceTipus(sofor, "belföldes");
  const domesticEligibleFuvar = isDomesticTransitFuvar(fuvar);

  // ADR
  // safe-compliance profil: ha adrStrictness < 50%, ADR hiány csak figyelmeztetés
  if (fuvar.adr && !sofor.adr) {
    const isRelaxed = profile?._profileId === "safe-compliance" && profile.adrStrictness < 50;
    if (isRelaxed) {
      warnings.push(`⚠ ADR képesítés hiányzik (engedélyezett, lazított szigor: ${profile.adrStrictness}%)`);
    } else {
      suitable = false;
      reasons.push("Nincs ADR képesítés");
    }
  }

  // Belföldi vs nemzetközi
  // quick-flow profil: ha flexibility >= 70%, belföldes gépjárművezető csak figyelmeztetés
  if (!domesticEligibleFuvar && isDomesticOnlyTipus(soforTipus)) {
    const isFlexible = profile?._profileId === "quick-flow" && profile.flexibility >= 70;
    if (isFlexible) {
      warnings.push(`⚠ Belföldes gépjárművezető – rugalmas mód aktív (${profile.flexibility}%)`);
    } else {
      suitable = false;
      reasons.push("Belföldes gépjárművezető nem vihet nemzetközi fuvart");
    }
  }

  // Kezes kompatibilitás – mindig kemény szabály
  if (fuvar.kezes && fuvar.kezes !== sofor.kezes) {
    suitable = false;
    reasons.push(`A fuvar ${fuvar.kezes} kezes, de a gépjárművezető ${sofor.kezes} kezes`);
  }

  // Időütközés – mindig kemény szabály
  if (hasCollision(sofor.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido, { ignoredFuvar: fuvar })) {
    suitable = false;
    reasons.push("Időben ütközik meglévő foglalással");
  }

  // Vezetési órák ellenőrzése
  if (sofor.driving) {
    let requiredHours = calculateRequiredDrivingHours(fuvar);

    // service-focus profil: etaBuffer hozzáadódik a szükséges időhöz
    if (profile?._profileId === "service-focus" && profile.etaBuffer > 0) {
      requiredHours += profile.etaBuffer;
    }

    // Napi limit ellenőrzés (EU: max 9 óra/nap)
    const remainingDailyHours = sofor.driving.dailyLimitHours - sofor.driving.dailyDrivenHours;
    if (requiredHours > remainingDailyHours) {
      suitable = false;
      reasons.push(`Nincs elég napi vezetési idő (szükséges: ${requiredHours.toFixed(1)}h, maradt: ${remainingDailyHours.toFixed(1)}h)`);
    } else if (profile?._profileId === "safe-compliance" && remainingDailyHours < profile.drivingReserveAlert) {
      // safe-compliance: alacsony tartalék figyelmeztetés (de még ok)
      warnings.push(`⚠ Alacsony napi tartalék: ${remainingDailyHours.toFixed(1)}h (küszöb: ${profile.drivingReserveAlert}h)`);
    }

    // Heti limit ellenőrzés (EU: max 56 óra/hét)
    const remainingWeeklyHours = sofor.driving.weeklyLimitHours - sofor.driving.weeklyDrivenHours;
    if (requiredHours > remainingWeeklyHours) {
      suitable = false;
      reasons.push(`Nincs elég heti vezetési idő (szükséges: ${requiredHours.toFixed(1)}h, maradt: ${remainingWeeklyHours.toFixed(1)}h)`);
    } else if (profile?._profileId === "safe-compliance" && remainingWeeklyHours < profile.drivingReserveAlert * 3) {
      warnings.push(`⚠ Alacsony heti tartalék: ${remainingWeeklyHours.toFixed(1)}h (küszöb: ${(profile.drivingReserveAlert * 3).toFixed(1)}h)`);
    }

    // Kötelező pihenő ellenőrzés (4.5 óra után)
    if (sofor.driving.restMinutesEarned < 45 * 60 && requiredHours > 4.5) {
      suitable = false;
      reasons.push(`Kötelező pihenő szükséges (maradt: ${(sofor.driving.restMinutesEarned / 60).toFixed(0)} perc)`);
    }
  }

  const loadedPlanning = getLoadedPlanningData();
  if (loadedPlanning?.loaded) {
    const schedule = loadedPlanning.driverSchedules?.find((item) => item.driverId === (sofor.driverId || sofor.id)) || null;
    const generatedResult = evaluateDriverAgainstJob({
      driver: sofor,
      schedule,
      vehicles: loadedPlanning.uiVehicles || loadedPlanning.vehicles || [],
      job: fuvar,
      planningDate: loadedPlanning.planningContext?.planningDate || new Date().toISOString().slice(0, 10)
    });

    if (!generatedResult.compatible) {
      suitable = false;
      generatedResult.reasons.forEach((reason) => {
        if (!reasons.includes(reason.message)) {
          reasons.push(reason.message);
        }
      });
    }
  }

  const grade = !suitable ? "bad" : warnings.length > 0 ? "warn" : "ok";

  return {
    suitable,
    reasons: [...reasons, ...warnings],
    warnings,
    grade
  };
}

// Helper: Calculate required driving hours for a fuvar
function calculateRequiredDrivingHours(fuvar) {
  const km = fuvar.tavolsag_km || 0;
  const avgSpeed = 67; // km/h (EU átlag)
  const hours = km / avgSpeed;
  return Math.max(0.5, hours); // minimum 0.5 óra
}

// =======================================================
// VONTATÓ EVALUÁCIÓ
// =======================================================
export function evaluateVontatoForFuvar(vontato, fuvar) {
  evaluateFuvarTags(fuvar);

  const reasons = [];
  let suitable = true;
  const vontatoTipus = ensureResourceTipus(vontato, "belföldi");
  const domesticEligibleFuvar = isDomesticTransitFuvar(fuvar);

  // ADR → minden vontató alkalmas (kérésed szerint)
  // nincs ADR feltétel

  // Belföldi vs nemzetközi
  if (!domesticEligibleFuvar && isDomesticOnlyTipus(vontatoTipus)) {
    suitable = false;
    reasons.push("Belföldi vontató nem vihet nemzetközi fuvart");
  }

  // Kezes kompatibilitás
  if (fuvar.kezes && fuvar.kezes !== vontato.kezes) {
    suitable = false;
    reasons.push(`A fuvar ${fuvar.kezes} kezes, de a vontató ${vontato.kezes} kezes`);
  }

  // Időütközés
  if (hasCollision(vontato.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido, { ignoredFuvar: fuvar })) {
    suitable = false;
    reasons.push("Időben ütközik meglévő foglalással");
  }

  return {
    suitable,
    reasons,
    warnings: [],
    grade: suitable ? "ok" : "bad"
  };
}

// =======================================================
// PÓTKOCSI EVALUÁCIÓ
// =======================================================
export function evaluatePotkocsiForFuvar(pk, fuvar) {
  evaluateFuvarTags(fuvar);

  const reasons = [];
  let suitable = true;
  const potkocsiTipus = ensureResourceTipus(pk, "belföldi");
  const domesticEligibleFuvar = isDomesticTransitFuvar(fuvar);

  // ADR
  if (fuvar.adr && !pk.adr) {
    suitable = false;
    reasons.push("A fuvar ADR-es, de a pótkocsi nem ADR alkalmas");
  }

  // Belföldi vs nemzetközi
  if (!domesticEligibleFuvar && isDomesticOnlyTipus(potkocsiTipus)) {
    suitable = false;
    reasons.push("Belföldi pótkocsi nem vihet nemzetközi fuvart");
  }

  // Időütközés
  if (hasCollision(pk.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido, { ignoredFuvar: fuvar })) {
    suitable = false;
    reasons.push("Időben ütközik egy másik feladattal");
  }

  return {
    suitable,
    reasons,
    warnings: [],
    grade: suitable ? "ok" : "bad"
  };
}

// =======================================================
// MINDHÁROM EVALUÁCIÓ FUTTATÁSA
// =======================================================
export function evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, fuvar) {
  return {
    soforok: SOFOROK.map(s => ({
      id: s.id,
      nev: s.nev, // UI használja, JS engine nem
      result: evaluateSoforForFuvar(s, fuvar)
    })),

    vontatok: VONTATOK.map(v => ({
      id: v.id,
      rendszam: v.rendszam,
      result: evaluateVontatoForFuvar(v, fuvar)
    })),

    potkocsik: POTKOCSIK.map(p => ({
      id: p.id,
      rendszam: p.rendszam,
      result: evaluatePotkocsiForFuvar(p, fuvar)
    }))
  };
}

// =======================================================
// ERŐFORRÁS → MELY FUVART VIHETI (reverse matching)
// =======================================================
export function evaluateFuvarokForResource(resource, FUVAROK, type) {
  return FUVAROK.map(f => {

    evaluateFuvarTags(f); // biztos legyenek tag-ek

    let res;
    if (type === "sofor") res = evaluateSoforForFuvar(resource, f);
    if (type === "vontato") res = evaluateVontatoForFuvar(resource, f);
    if (type === "potkocsi") res = evaluatePotkocsiForFuvar(resource, f);

    return {
      fuvarId: f.id,
      megnevezes: f.megnevezes,
      result: res
    };
  });
}
