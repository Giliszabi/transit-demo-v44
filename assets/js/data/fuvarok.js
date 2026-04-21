import { DEMO_NEARBY_FREE_PAIR_SCENARIO } from "./demo-warning-scenario.js";
import { FUVAROK_REAL } from "./fuvarok-real.js";

const FUVAR_DATE_SHIFT_DAYS = 10;
const MEBIZO_COMPANIES = [
  "Hankook Tire Magyarorszag Kft",
  "NNOCORE VISION KFT",
  "PANADDITÍV KFT",
  "Grundfos Operation A/S",
  "SCHENKER Neutraubling",
  "NTG GONDRAND KFT",
  "KÜHNE + NAGEL KFT",
  "UNITED SHIPPING HUNGÁRIA KFT",
  "DONECK PRONAT KFT",
  "XPO Transport Solutions Netherlands BV",
  "Hummels Trade Kft",
  "DHL FREIGHT MAGYARORSZÁG KFT"
];

function shiftIsoDateByDays(isoString, days) {
  if (!isoString) {
    return isoString;
  }

  const shifted = new Date(isoString);
  if (!Number.isFinite(shifted.getTime())) {
    return isoString;
  }

  shifted.setDate(shifted.getDate() + days);
  return shifted.toISOString().slice(0, 16);
}

function shiftFuvarDatesInPlace(fuvarokList, days) {
  fuvarokList.forEach((fuvar) => {
    if (fuvar?.felrakas?.ido) {
      fuvar.felrakas.ido = shiftIsoDateByDays(fuvar.felrakas.ido, days);
    }

    if (fuvar?.lerakas?.ido) {
      fuvar.lerakas.ido = shiftIsoDateByDays(fuvar.lerakas.ido, days);
    }
  });
}

function moveFuvarToPickupDate(fuvar, targetDate) {
  if (!fuvar?.felrakas?.ido || !fuvar?.lerakas?.ido || !targetDate) {
    return;
  }

  const pickupDate = new Date(fuvar.felrakas.ido);
  const dropoffDate = new Date(fuvar.lerakas.ido);
  if (!Number.isFinite(pickupDate.getTime()) || !Number.isFinite(dropoffDate.getTime())) {
    return;
  }

  const durationMs = dropoffDate.getTime() - pickupDate.getTime();
  const [year, month, day] = String(targetDate).split("-").map(Number);
  if (!year || !month || !day) {
    return;
  }

  const nextPickup = new Date(pickupDate);
  nextPickup.setFullYear(year, month - 1, day);

  const nextDropoff = new Date(nextPickup.getTime() + durationMs);
  fuvar.felrakas.ido = nextPickup.toISOString().slice(0, 16);
  fuvar.lerakas.ido = nextDropoff.toISOString().slice(0, 16);
}

function getFuvarDurationMinutes(fuvar) {
  const pickupMs = new Date(fuvar?.felrakas?.ido || "").getTime();
  const dropoffMs = new Date(fuvar?.lerakas?.ido || "").getTime();
  if (!Number.isFinite(pickupMs) || !Number.isFinite(dropoffMs) || dropoffMs <= pickupMs) {
    return 0;
  }

  return Math.round((dropoffMs - pickupMs) / 60000);
}

function shiftIsoByMinutes(isoValue, deltaMinutes) {
  const baseMs = new Date(isoValue || "").getTime();
  if (!Number.isFinite(baseMs)) {
    return isoValue;
  }

  return new Date(baseMs + deltaMinutes * 60 * 1000).toISOString().slice(0, 16);
}

function syncLinkedRelayWindow(relayFuvar, linkedFuvar, mode) {
  if (!relayFuvar?.felrakas?.ido || !relayFuvar?.lerakas?.ido || !linkedFuvar?.felrakas?.ido || !linkedFuvar?.lerakas?.ido) {
    return;
  }

  const relayDurationMinutes = getFuvarDurationMinutes(relayFuvar);
  if (mode === "export") {
    relayFuvar.lerakas.ido = linkedFuvar.felrakas.ido;
    relayFuvar.felrakas.ido = shiftIsoByMinutes(linkedFuvar.felrakas.ido, -relayDurationMinutes);
    return;
  }

  relayFuvar.felrakas.ido = linkedFuvar.lerakas.ido;
  relayFuvar.lerakas.ido = shiftIsoByMinutes(linkedFuvar.lerakas.ido, relayDurationMinutes);
}

function assignFocusedFuvarDays(fuvarokList) {
  const exportRelayList = fuvarokList.filter((fuvar) => fuvar?.viszonylat === "belfold" && fuvar?.elofutasExportFuvarId).slice(0, 2);
  const importRelayList = fuvarokList.filter((fuvar) => fuvar?.viszonylat === "belfold" && fuvar?.utofutasImportFuvarId).slice(0, 2);
  const regularDomesticList = fuvarokList
    .filter((fuvar) => fuvar?.viszonylat === "belfold" && !fuvar?.elofutasExportFuvarId && !fuvar?.utofutasImportFuvarId)
    .slice(0, 2);

  exportRelayList.forEach((relayFuvar) => {
    const linkedExport = fuvarokList.find((fuvar) => fuvar.id === relayFuvar.elofutasExportFuvarId);
    moveFuvarToPickupDate(linkedExport, "2026-04-21");
    syncLinkedRelayWindow(relayFuvar, linkedExport, "export");
  });

  importRelayList.forEach((relayFuvar) => {
    const linkedImport = fuvarokList.find((fuvar) => fuvar.id === relayFuvar.utofutasImportFuvarId);
    moveFuvarToPickupDate(linkedImport, "2026-04-22");
    syncLinkedRelayWindow(relayFuvar, linkedImport, "import");
  });

  regularDomesticList.forEach((fuvar, index) => {
    moveFuvarToPickupDate(fuvar, index % 2 === 0 ? "2026-04-21" : "2026-04-22");
  });
}

function setFuvarScheduleById(fuvarokList, fuvarId, pickupIso, dropoffIso) {
  const fuvar = fuvarokList.find((item) => item.id === fuvarId);
  if (!fuvar || !pickupIso || !dropoffIso) {
    return;
  }

  fuvar.felrakas = {
    ...(fuvar.felrakas || {}),
    ido: pickupIso
  };
  fuvar.lerakas = {
    ...(fuvar.lerakas || {}),
    ido: dropoffIso
  };
}

function applyOptimalDemoScenario(fuvarokList) {
  setFuvarScheduleById(fuvarokList, "FF-26-0004814", "2026-04-20T19:30", "2026-04-21T09:15");
  setFuvarScheduleById(fuvarokList, "UTO-FF-26-0004814", "2026-04-21T09:15", "2026-04-21T10:00");

  setFuvarScheduleById(fuvarokList, "FF-26-0004137", "2026-04-21T13:00", "2026-04-22T02:00");
  setFuvarScheduleById(fuvarokList, "ELO-FF-26-0004137", "2026-04-21T12:15", "2026-04-21T13:00");

  setFuvarScheduleById(fuvarokList, "FF-26-0004019", "2026-04-22T00:30", "2026-04-22T15:30");
  setFuvarScheduleById(fuvarokList, "UTO-FF-26-0004019", "2026-04-22T15:30", "2026-04-22T16:15");
}

function getStableCompanyIndex(seed) {
  return Array.from(String(seed || ""))
    .reduce((sum, char, index) => sum + (char.charCodeAt(0) * (index + 1)), 0);
}

function assignMegbizoCompanies(fuvarokList) {
  fuvarokList.forEach((fuvar, index) => {
    const companyIndex = (getStableCompanyIndex(fuvar?.id || index) + index) % MEBIZO_COMPANIES.length;
    const companyName = MEBIZO_COMPANIES[companyIndex];

    fuvar.megbizo = companyName;
    fuvar.excelData = {
      ...(fuvar.excelData || {}),
      "Megbízó partner": companyName
    };
  });
}

// --- Előfutás / utófutás auto-generáló ---
// Előfutás: export feladat felrakási helye → Környe Telephely
// Utófutás: Környe Telephely → import feladat lerakási helye
function generateRelayFuvarok(fuvarokList) {
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
    "Jászfényszaru": { lat: 47.569231, lon: 19.716815 },
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

  function addMinutes(isoStr, minutes) {
    const d = new Date(isoStr);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString().slice(0, 16);
  }

  function getDomesticCoords(address) {
    return DOMESTIC_COORDS[String(address || "").trim()] || null;
  }

  function estimateDomesticDistanceKm(addressA, addressB) {
    const coordsA = getDomesticCoords(addressA);
    const coordsB = getDomesticCoords(addressB);
    if (!coordsA || !coordsB) {
      return FALLBACK_DISTANCE_KM;
    }

    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(coordsB.lat - coordsA.lat);
    const dLon = toRad(coordsB.lon - coordsA.lon);
    const lat1 = toRad(coordsA.lat);
    const lat2 = toRad(coordsB.lat);
    const a = Math.sin(dLat / 2) ** 2
      + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function estimateDomesticTravelMinutes(addressA, addressB) {
    const distanceKm = estimateDomesticDistanceKm(addressA, addressB);
    const hours = Math.max(0.5, distanceKm / DOMESTIC_SPEED_KMH);
    return Math.max(FALLBACK_TRAVEL_MIN, Math.round(hours * 60));
  }

  function isKornye(address) {
    return String(address || "").toLowerCase().includes("kornye");
  }

  const result = [];
  fuvarokList.forEach((fuvar) => {
    const felC = String(fuvar?.felrakas?.cim || "");
    const leC = String(fuvar?.lerakas?.cim || "");

    // ELŐFUTÁS: export feladat felrakási helye → Környe (csak ha nem Környé-ből indul)
    if (fuvar.viszonylat === "export" && !isKornye(felC)) {
      const startIdo = fuvar.felrakas.ido;
      const travelMinutes = estimateDomesticTravelMinutes(felC, "Környe, Telephely");
      const distanceKm = Math.round(estimateDomesticDistanceKm(felC, "Környe, Telephely"));
      result.push({
        id: `ELO-${fuvar.id}`,
        megnevezes: `Előfutás – ${felC} → Környe [${fuvar.id}]`,
        viszonylat: "belfold",
        fixedDomestic: true,
        felrakas: { cim: felC, ido: addMinutes(startIdo, -travelMinutes) },
        lerakas: { cim: "Környe, Telephely", ido: startIdo },
        tavolsag_km: distanceKm,
        adr: false,
        surgos: false,
        elofutasExportFuvarId: fuvar.id
      });
    }

    // UTÓFUTÁS: Környe → import feladat lerakási helye (csak ha nem Környé-be érkezik)
    if (fuvar.viszonylat === "import" && !isKornye(leC)) {
      const endIdo = fuvar.lerakas.ido;
      const travelMinutes = estimateDomesticTravelMinutes("Környe, Telephely", leC);
      const distanceKm = Math.round(estimateDomesticDistanceKm("Környe, Telephely", leC));
      result.push({
        id: `UTO-${fuvar.id}`,
        megnevezes: `Utófutás – Környe → ${leC} [${fuvar.id}]`,
        viszonylat: "belfold",
        fixedDomestic: true,
        felrakas: { cim: "Környe, Telephely", ido: endIdo },
        lerakas: { cim: leC, ido: addMinutes(endIdo, travelMinutes) },
        tavolsag_km: distanceKm,
        adr: false,
        surgos: false,
        utofutasImportFuvarId: fuvar.id
      });
    }
  });
  return result;
}

export const FUVAROK = [
  // ═══ EXPORT fuvarok (30 db) ═══
  { id: "EX-001", megnevezes: "Export – Környe → München", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T06:00" }, lerakas: { cim: "München, Logistik Hub", ido: "2026-04-13T16:00" }, tavolsag_km: 540, adr: false, surgos: false },
  { id: "EX-002", megnevezes: "Export – Tatabánya → Milano", viszonylat: "export", felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-13T07:30" }, lerakas: { cim: "Milano, Hub Nord", ido: "2026-04-13T19:30" }, tavolsag_km: 920, adr: false, surgos: false },
  { id: "EX-003", megnevezes: "Export – Győr → Hamburg", viszonylat: "export", felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-13T05:00" }, lerakas: { cim: "Hamburg, Logistics Dock", ido: "2026-04-13T17:30" }, tavolsag_km: 1110, adr: false, surgos: true },
  { id: "EX-004", megnevezes: "Export – Környe → Wien", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T08:00" }, lerakas: { cim: "Wien, Freudenau Terminal", ido: "2026-04-13T12:00" }, tavolsag_km: 220, adr: false, surgos: false },
  { id: "EX-005", megnevezes: "Export – Budapest → Praha", viszonylat: "export", felrakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-13T10:00" }, lerakas: { cim: "Praha, CTPark", ido: "2026-04-13T18:00" }, tavolsag_km: 530, adr: true, surgos: false },
  { id: "EX-006", megnevezes: "Export – Környe → Lübeck", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T14:00" }, lerakas: { cim: "Lübeck, Hafen-Terminal", ido: "2026-04-14T03:00" }, tavolsag_km: 1080, adr: false, surgos: false },
  { id: "EX-007", megnevezes: "Export – Tatabánya → Wien", viszonylat: "export", felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-13T16:00" }, lerakas: { cim: "Wien, Freudenau Terminal", ido: "2026-04-13T20:00" }, tavolsag_km: 200, adr: false, surgos: false },
  { id: "EX-008", megnevezes: "Export – Budapest → Milano (ADR)", viszonylat: "export", felrakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-13T20:00" }, lerakas: { cim: "Milano, Hub Nord", ido: "2026-04-14T08:00" }, tavolsag_km: 960, adr: true, surgos: false },
  { id: "EX-009", megnevezes: "Export – Környe → Rotterdam", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T22:00" }, lerakas: { cim: "Rotterdam, ECT Delta", ido: "2026-04-14T12:00" }, tavolsag_km: 1280, adr: false, surgos: true },
  { id: "EX-010", megnevezes: "Export – Győr → Stuttgart", viszonylat: "export", felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-14T04:00" }, lerakas: { cim: "Stuttgart, Logistikzentrum", ido: "2026-04-14T14:00" }, tavolsag_km: 680, adr: false, surgos: false },
  { id: "EX-011", megnevezes: "Export – Tatabánya → München (ADR)", viszonylat: "export", felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-14T06:00" }, lerakas: { cim: "München, Logistik Hub", ido: "2026-04-14T14:30" }, tavolsag_km: 520, adr: true, surgos: false },
  { id: "EX-012", megnevezes: "Export – Környe → Düsseldorf", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-14T08:00" }, lerakas: { cim: "Düsseldorf, LogPort", ido: "2026-04-14T20:00" }, tavolsag_km: 1010, adr: false, surgos: false },
  { id: "EX-013", megnevezes: "Export – Budapest → Bratislava", viszonylat: "export", felrakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-14T10:00" }, lerakas: { cim: "Bratislava, D1 Park", ido: "2026-04-14T13:00" }, tavolsag_km: 200, adr: false, surgos: false },
  { id: "EX-014", megnevezes: "Export – Győr → Hamburg", viszonylat: "export", felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-14T14:00" }, lerakas: { cim: "Hamburg, Logistics Dock", ido: "2026-04-15T02:00" }, tavolsag_km: 1110, adr: false, surgos: false },
  { id: "EX-015", megnevezes: "Export – Környe → Milano", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-14T16:00" }, lerakas: { cim: "Milano, Hub Nord", ido: "2026-04-15T04:00" }, tavolsag_km: 920, adr: false, surgos: true },
  { id: "EX-016", megnevezes: "Export – Tatabánya → Praha", viszonylat: "export", felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-14T18:00" }, lerakas: { cim: "Praha, CTPark", ido: "2026-04-15T01:00" }, tavolsag_km: 480, adr: false, surgos: false },
  { id: "EX-017", megnevezes: "Export – Budapest → Wien", viszonylat: "export", felrakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-14T20:00" }, lerakas: { cim: "Wien, Freudenau Terminal", ido: "2026-04-14T23:30" }, tavolsag_km: 240, adr: false, surgos: false },
  { id: "EX-018", megnevezes: "Export – Környe → Hamburg (ADR)", viszonylat: "export", felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-15T02:00" }, lerakas: { cim: "Hamburg, Logistics Dock", ido: "2026-04-15T14:00" }, tavolsag_km: 1090, adr: true, surgos: false },
  { id: "EX-019", megnevezes: "Export – Győr → München", viszonylat: "export", felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-15T06:00" }, lerakas: { cim: "München, Logistik Hub", ido: "2026-04-15T12:00" }, tavolsag_km: 440, adr: false, surgos: false },
  { id: "EX-020", megnevezes: "Export – Tatabánya → Rotterdam", viszonylat: "export", felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-15T08:00" }, lerakas: { cim: "Rotterdam, ECT Delta", ido: "2026-04-15T22:00" }, tavolsag_km: 1300, adr: false, surgos: true },

  // ═══ IMPORT fuvarok (15 db) ═══
  { id: "IM-001", megnevezes: "Import – Milano → Környe", viszonylat: "import", felrakas: { cim: "Milano, Hub Nord", ido: "2026-04-13T04:00" }, lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T16:00" }, tavolsag_km: 920, adr: false, surgos: false },
  { id: "IM-002", megnevezes: "Import – Hamburg → Budapest", viszonylat: "import", felrakas: { cim: "Hamburg, Logistics Dock", ido: "2026-04-13T06:00" }, lerakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-13T18:00" }, tavolsag_km: 1100, adr: false, surgos: false },
  { id: "IM-003", megnevezes: "Import – Wien → Győr (ADR)", viszonylat: "import", felrakas: { cim: "Wien, Freudenau Terminal", ido: "2026-04-13T09:00" }, lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-13T12:30" }, tavolsag_km: 120, adr: true, surgos: false },
  { id: "IM-004", megnevezes: "Import – Rotterdam → Környe", viszonylat: "import", felrakas: { cim: "Rotterdam, ECT Delta", ido: "2026-04-13T12:00" }, lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-14T02:00" }, tavolsag_km: 1280, adr: false, surgos: true },
  { id: "IM-005", megnevezes: "Import – München → Tatabánya", viszonylat: "import", felrakas: { cim: "München, Logistik Hub", ido: "2026-04-13T18:00" }, lerakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-14T02:30" }, tavolsag_km: 520, adr: false, surgos: false },
  { id: "IM-006", megnevezes: "Import – Hamburg → Környe", viszonylat: "import", felrakas: { cim: "Hamburg, Logistics Dock", ido: "2026-04-13T22:00" }, lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-14T10:00" }, tavolsag_km: 1080, adr: false, surgos: false },
  { id: "IM-007", megnevezes: "Import – Praha → Budapest", viszonylat: "import", felrakas: { cim: "Praha, CTPark", ido: "2026-04-14T05:00" }, lerakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-14T12:00" }, tavolsag_km: 530, adr: false, surgos: false },
  { id: "IM-008", megnevezes: "Import – Milano → Győr (ADR)", viszonylat: "import", felrakas: { cim: "Milano, Hub Nord", ido: "2026-04-14T08:00" }, lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-14T18:30" }, tavolsag_km: 850, adr: true, surgos: false },
  { id: "IM-009", megnevezes: "Import – Düsseldorf → Környe", viszonylat: "import", felrakas: { cim: "Düsseldorf, LogPort", ido: "2026-04-14T10:00" }, lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-14T22:00" }, tavolsag_km: 1010, adr: false, surgos: false },
  { id: "IM-010", megnevezes: "Import – Wien → Tatabánya", viszonylat: "import", felrakas: { cim: "Wien, Freudenau Terminal", ido: "2026-04-14T16:00" }, lerakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-14T19:30" }, tavolsag_km: 200, adr: false, surgos: false },
  { id: "IM-011", megnevezes: "Import – Hamburg → Budapest", viszonylat: "import", felrakas: { cim: "Hamburg, Logistics Dock", ido: "2026-04-14T20:00" }, lerakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-15T08:00" }, tavolsag_km: 1100, adr: false, surgos: true },
  { id: "IM-012", megnevezes: "Import – München → Környe (ADR)", viszonylat: "import", felrakas: { cim: "München, Logistik Hub", ido: "2026-04-15T04:00" }, lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-15T12:00" }, tavolsag_km: 540, adr: true, surgos: false },
  { id: "IM-013", megnevezes: "Import – Rotterdam → Győr", viszonylat: "import", felrakas: { cim: "Rotterdam, ECT Delta", ido: "2026-04-15T06:00" }, lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-15T20:00" }, tavolsag_km: 1250, adr: false, surgos: false },
  { id: "IM-014", megnevezes: "Import – Bratislava → Budapest", viszonylat: "import", felrakas: { cim: "Bratislava, D1 Park", ido: "2026-04-15T08:00" }, lerakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-15T11:00" }, tavolsag_km: 200, adr: false, surgos: false },
  { id: "IM-015", megnevezes: "Import – Stuttgart → Tatabánya", viszonylat: "import", felrakas: { cim: "Stuttgart, Logistikzentrum", ido: "2026-04-15T10:00" }, lerakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-15T20:00" }, tavolsag_km: 680, adr: false, surgos: false },

  // ═══ BELFÖLDI fuvarok (5 db) ═══
  { id: "BF-001", megnevezes: "Belföldi – Környe → Esztergom", viszonylat: "belfold", fixedDomestic: true, felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T06:30" }, lerakas: { cim: "Magyarország, Esztergom, Ipari Park", ido: "2026-04-13T08:00" }, tavolsag_km: 46, adr: false, surgos: false },
  { id: "BF-002", megnevezes: "Belföldi – Debrecen → Budapest", viszonylat: "belfold", fixedDomestic: true, felrakas: { cim: "Magyarország, Debrecen, Logisztikai Központ", ido: "2026-04-14T08:00" }, lerakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-14T12:00" }, tavolsag_km: 230, adr: false, surgos: false },
  { id: "BF-003", megnevezes: "Belföldi – Győr → Környe", viszonylat: "belfold", fixedDomestic: true, felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-13T14:00" }, lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-04-13T15:30" }, tavolsag_km: 80, adr: false, surgos: false },
  { id: "BF-004", megnevezes: "Belföldi – Budapest → Tatabánya (ADR)", viszonylat: "belfold", fixedDomestic: true, felrakas: { cim: "Magyarország, Budapest, BILK Terminál", ido: "2026-04-14T15:00" }, lerakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-14T17:00" }, tavolsag_km: 75, adr: true, surgos: false },
  { id: "BF-005", megnevezes: "Belföldi – Tatabánya → Győr", viszonylat: "belfold", fixedDomestic: true, felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-04-15T09:00" }, lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-04-15T11:00" }, tavolsag_km: 95, adr: false, surgos: false },

  // ═══ DEMO SCENARIO fuvarok ═══
  {
    id: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoFuvarId,
    megnevezes: "Demo rakott vontató – Budapest → Győr",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: {
      cim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPickupAddress,
      ido: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoStartIso
    },
    lerakas: {
      cim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoDropoffAddress,
      ido: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoEndIso
    },
    tavolsag_km: 125,
    adr: false,
    surgos: false,
    assignedVontatoId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoVontatoId,
    assignedPotkocsiId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPotkocsiId
  },
  {
    id: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeFuvarId,
    megnevezes: "Demo felszabaduló pár – Tatabánya → Budapest",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: {
      cim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativePickupAddress,
      ido: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeStartIso
    },
    lerakas: {
      cim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeDropoffAddress,
      ido: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeEndIso
    },
    tavolsag_km: 55,
    adr: false,
    surgos: false,
    assignedSoforId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeSoforId,
    assignedVontatoId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeVontatoId
  },
  // --- Valós fuvarok (fuvarösszesítő_20260330150011.xlsx) ---
  ...FUVAROK_REAL,
  // --- Auto-generált előfutás / utófutás feladatok (Környe elosztó) ---
  ...generateRelayFuvarok(FUVAROK_REAL)
  /*
  ,{
    id: "F1",
    megnevezes: "Vegyszerek – BASF Frankfurt",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Budapest, Logisztikai Park 1.", ido: "2026-03-24T06:00" },
    lerakas: { cim: "Frankfurt, Industrial Zone", ido: "2026-03-24T20:00" },
    tavolsag_km: 820,
    adr: true,
    surgos: false
  },
  {
    megnevezes: "Autóalkatrészek – Wien",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Győr, Audi gyár", ido: "2026-03-24T08:00" },
    lerakas: { cim: "Wien, Lagerhaus 12", ido: "2026-03-24T14:00" },
    tavolsag_km: 120,
    adr: false,
    surgos: true
  },
  {
    id: "F3",
    megnevezes: "Élelmiszer – München",
    viszonylat: "import",
    felrakas: { cim: "München, Großmarkt", ido: "2026-03-22T10:00" },
    lerakas: { cim: "Magyarország, Budapest, Nagybani piac", ido: "2026-03-22T20:00" },
    tavolsag_km: 650,
    adr: false,
    surgos: false
  },
  {
    id: "F5",
    megnevezes: "Építőanyag – Miskolc",
    viszonylat: "belfold",
    felrakas: { cim: "Magyarország, Budapest, Csepel terminál", ido: "2026-03-24T07:00" },
    lerakas: { cim: "Magyarország, Miskolc, Telephely 4", ido: "2026-03-24T14:00" },
    tavolsag_km: 185,
    adr: false,
    surgos: false
  },
  {
    id: "F6",
    megnevezes: "Gyógyszeralapanyag – Pécs",
    viszonylat: "belfold",
    felrakas: { cim: "Magyarország, Kecskemét, Raktárbázis", ido: "2026-03-24T09:00" },
    lerakas: { cim: "Magyarország, Pécs, Egészségipari park", ido: "2026-03-24T16:30" },
    tavolsag_km: 235,
    adr: true,
    surgos: false
  },
  {
    id: "F9",
    megnevezes: "Papírtekercs – Linz → Budapest",
    viszonylat: "import",
    felrakas: { cim: "Linz, Papierfabrik Dock", ido: "2026-03-25T07:00" },
    lerakas: { cim: "Magyarország, Budapest, Raktárutca 8", ido: "2026-03-25T13:00" },
    tavolsag_km: 460,
    adr: false,
    surgos: true
  }
  */
];

shiftFuvarDatesInPlace(FUVAROK, FUVAR_DATE_SHIFT_DAYS);
assignFocusedFuvarDays(FUVAROK);
applyOptimalDemoScenario(FUVAROK);
assignMegbizoCompanies(FUVAROK);

function resetInitialSpedicioState() {
  FUVAROK.forEach((fuvar) => {
    fuvar.spediccio = false;
    delete fuvar.spediccioPartner;
    delete fuvar.spediccioForm;
    delete fuvar.spediccioOperationType;
    delete fuvar.spediccioLastKnownPrice;
  });
}

const BELFOLD_NAGYVAROSOK = [
  "Budapest",
  "Debrecen",
  "Szeged",
  "Miskolc",
  "Pécs",
  "Győr",
  "Nyíregyháza",
  "Kecskemét",
  "Székesfehérvár",
  "Szombathely"
];

const KORNYE_CIM = "Magyarország, Környe, Ipari Park";

const BELFOLD_TELEPULESEK = ["Környe", ...BELFOLD_NAGYVAROSOK];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getDomesticAddressForCity(city) {
  if (normalizeText(city) === "kornye") {
    return KORNYE_CIM;
  }

  return `Magyarország, ${city}, Logisztikai Központ`;
}

function findCityInText(text) {
  const haystack = normalizeText(text);

  return BELFOLD_TELEPULESEK.find((city) => {
    return haystack.includes(normalizeText(city));
  }) || null;
}

function extractDomesticCitiesFromName(name) {
  const cleaned = String(name || "")
    .replace(/^belf[öo]ldi fuvar\s*[–-]\s*/i, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const parts = cleaned
    .split(/\s*(?:↔|→|->|--|–|-)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const startCity = findCityInText(parts[0]);
  const endCity = findCityInText(parts[1]);

  if (!startCity || !endCity) {
    return null;
  }

  return [startCity, endCity];
}

function syncDomesticEndpointsToName() {
  FUVAROK
    .filter((fuvar) => fuvar.viszonylat === "belfold" && !fuvar.fixedDomestic)
    .forEach((fuvar) => {
      const cities = extractDomesticCitiesFromName(fuvar.megnevezes);
      if (!cities) {
        return;
      }

      const [startCity, endCity] = cities;
      fuvar.felrakas.cim = getDomesticAddressForCity(startCity);
      fuvar.lerakas.cim = getDomesticAddressForCity(endCity);
    });
}

function applyRandomDomesticEndpoints() {
  const belfoldFuvarok = FUVAROK.filter((f) => f.viszonylat === "belfold" && !f.fixedDomestic);
  const cityPool = [...BELFOLD_NAGYVAROSOK];

  shuffle(cityPool);

  belfoldFuvarok.forEach((fuvar, index) => {
    const city = cityPool[index % cityPool.length];
    const cityAddress = `Magyarország, ${city}, Logisztikai Központ`;
    const kornyeAsStart = Math.random() < 0.5;
    const startCity = kornyeAsStart ? "Környe" : city;
    const endCity = kornyeAsStart ? city : "Környe";

    fuvar.felrakas.cim = kornyeAsStart ? KORNYE_CIM : cityAddress;
    fuvar.lerakas.cim = kornyeAsStart ? cityAddress : KORNYE_CIM;
    fuvar.megnevezes = `Belföldi fuvar – ${startCity} → ${endCity}`;
  });
}

applyRandomDomesticEndpoints();
syncDomesticEndpointsToName();
resetInitialSpedicioState();
