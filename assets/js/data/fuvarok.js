import { DEMO_NEARBY_FREE_PAIR_SCENARIO } from "./demo-warning-scenario.js";
import { FUVAROK_REAL } from "./fuvarok-real.js";

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
        felrakas: { cim: felC, ido: startIdo },
        lerakas: { cim: "Környe, Telephely", ido: addMinutes(startIdo, travelMinutes) },
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
        felrakas: { cim: "Környe, Telephely", ido: addMinutes(endIdo, -travelMinutes) },
        lerakas: { cim: leC, ido: endIdo },
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
  {
    id: "F7",
    megnevezes: "Demo export – Tatabánya → Milano",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-30T07:30" },
    lerakas: { cim: "Milano, Hub Nord", ido: "2026-03-30T19:30" },
    tavolsag_km: 920,
    adr: false,
    surgos: false
  },
  {
    id: "F8",
    megnevezes: "Demo import – Milano → Győr",
    viszonylat: "import",
    felrakas: { cim: "Milano, Hub Nord", ido: "2026-03-30T05:30" },
    lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-30T13:00" },
    tavolsag_km: 930,
    adr: false,
    surgos: false
  },
  {
    id: "F10",
    megnevezes: "Teszt export – Környe → Lübeck",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-30T10:00" },
    lerakas: { cim: "Lübeck, Germany, Hafen-Terminal", ido: "2026-03-30T23:00" },
    tavolsag_km: 1080,
    adr: false,
    surgos: false
  },
  {
    id: "F11",
    megnevezes: "Teszt import – Hamburg → Környe",
    viszonylat: "import",
    felrakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-31T00:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-31T05:30" },
    tavolsag_km: 1060,
    adr: false,
    surgos: false
  },
  {
    id: "F12",
    megnevezes: "Belföldi teszt – Környe → Esztergom",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-30T06:30" },
    lerakas: { cim: "Magyarország, Esztergom, Ipari Park", ido: "2026-03-30T08:00" },
    tavolsag_km: 46,
    adr: false,
    surgos: false
  },
  {
    id: "F13",
    megnevezes: "Demo export – Győr → Hamburg",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-30T06:00" },
    lerakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-30T17:30" },
    tavolsag_km: 1110,
    adr: false,
    surgos: false
  },
  {
    id: "F14",
    megnevezes: "Demo import – Hamburg → Környe",
    viszonylat: "import",
    felrakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-30T19:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-30T23:45" },
    tavolsag_km: 1080,
    adr: false,
    surgos: true
  },
  {
    id: "F15",
    megnevezes: "Demo belföldi opció – Debrecen → Környe",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Debrecen, Logisztikai Központ", ido: "2026-03-30T14:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-30T19:00" },
    tavolsag_km: 270,
    adr: false,
    surgos: false
  },
  {
    id: "F16",
    megnevezes: "Demo belföldi opció – Debrecen → Szeged",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Debrecen, Logisztikai Központ", ido: "2026-03-30T14:20" },
    lerakas: { cim: "Magyarország, Szeged, Ipari Park", ido: "2026-03-30T20:20" },
    tavolsag_km: 240,
    adr: false,
    surgos: false
  },
  {
    id: "F17",
    megnevezes: "Demo import – Milano → Tatabánya",
    viszonylat: "import",
    felrakas: { cim: "Milano, Hub Nord", ido: "2026-03-30T09:00" },
    lerakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-30T22:30" },
    tavolsag_km: 930,
    adr: false,
    surgos: false
  },
  {
    id: "F18",
    megnevezes: "Demo belföldi – Tatabánya → Vác",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-30T09:00" },
    lerakas: { cim: "Magyarország, Vác, Ipari Park", ido: "2026-03-30T11:30" },
    tavolsag_km: 85,
    adr: false,
    surgos: false
  },
  {
    id: "F20",
    megnevezes: "Demo belföldi – Győr → Budapest",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-30T13:45" },
    lerakas: { cim: "Magyarország, Budapest, Logisztikai Park", ido: "2026-03-30T16:15" },
    tavolsag_km: 125,
    adr: false,
    surgos: false
  },
  {
    id: "F21",
    megnevezes: "Demo belföldi – Környe → Környe",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-30T16:30" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-30T18:00" },
    tavolsag_km: 22,
    adr: false,
    surgos: false
  },
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
