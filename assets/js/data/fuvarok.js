import { DEMO_NEARBY_FREE_PAIR_SCENARIO } from "./demo-warning-scenario.js";
import { FUVAROK_REAL } from "./fuvarok-real.js";

// --- Páty ↔ Környe előfutás / utófutás auto-generáló ---
// Előfutás: export ahol felrakás = Páty  →  feladat: Páty → Környe Telephely
// Utófutás: import ahol lerakás = Páty   →  feladat: Környe Telephely → Páty
function generatePatyRelayFuvarok(fuvarokList) {
  const TRAVEL_MIN = 40;
  const DISTANCE_KM = 35;

  function addMinutes(isoStr, minutes) {
    const d = new Date(isoStr);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString().slice(0, 16);
  }

  const result = [];
  fuvarokList.forEach((fuvar) => {
    const felC = String(fuvar?.felrakas?.cim || "");
    const leC = String(fuvar?.lerakas?.cim || "");

    if (fuvar.viszonylat === "export" && felC === "Páty") {
      const startIdo = fuvar.felrakas.ido;
      result.push({
        id: `ELO-${fuvar.id}`,
        megnevezes: `Előfutás – Páty → Környe [${fuvar.id}]`,
        viszonylat: "belfold",
        fixedDomestic: true,
        felrakas: { cim: "Páty", ido: startIdo },
        lerakas: { cim: "Környe, Telephely", ido: addMinutes(startIdo, TRAVEL_MIN) },
        tavolsag_km: DISTANCE_KM,
        adr: false,
        surgos: false,
        elofutasExportFuvarId: fuvar.id
      });
    }

    if (fuvar.viszonylat === "import" && leC === "Páty") {
      const endIdo = fuvar.lerakas.ido;
      result.push({
        id: `UTO-${fuvar.id}`,
        megnevezes: `Utófutás – Környe → Páty [${fuvar.id}]`,
        viszonylat: "belfold",
        fixedDomestic: true,
        felrakas: { cim: "Környe, Telephely", ido: addMinutes(endIdo, -TRAVEL_MIN) },
        lerakas: { cim: "Páty", ido: endIdo },
        tavolsag_km: DISTANCE_KM,
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
    felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-27T07:30" },
    lerakas: { cim: "Milano, Hub Nord", ido: "2026-03-27T19:30" },
    tavolsag_km: 920,
    adr: false,
    surgos: false
  },
  {
    id: "F8",
    megnevezes: "Demo import – Milano → Győr",
    viszonylat: "import",
    felrakas: { cim: "Milano, Hub Nord", ido: "2026-03-27T05:30" },
    lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-27T13:00" },
    tavolsag_km: 930,
    adr: false,
    surgos: false
  },
  {
    id: "F10",
    megnevezes: "Teszt export – Környe → Lübeck",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-27T10:00" },
    lerakas: { cim: "Lübeck, Germany, Hafen-Terminal", ido: "2026-03-27T23:00" },
    tavolsag_km: 1080,
    adr: false,
    surgos: false
  },
  {
    id: "F11",
    megnevezes: "Teszt import – Hamburg → Környe",
    viszonylat: "import",
    felrakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-28T00:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-28T05:30" },
    tavolsag_km: 1060,
    adr: false,
    surgos: false
  },
  {
    id: "F12",
    megnevezes: "Belföldi teszt – Környe → Esztergom",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-27T06:30" },
    lerakas: { cim: "Magyarország, Esztergom, Ipari Park", ido: "2026-03-27T08:00" },
    tavolsag_km: 46,
    adr: false,
    surgos: false
  },
  {
    id: "F13",
    megnevezes: "Demo export – Győr → Hamburg",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-27T06:00" },
    lerakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-27T17:30" },
    tavolsag_km: 1110,
    adr: false,
    surgos: false
  },
  {
    id: "F14",
    megnevezes: "Demo import – Hamburg → Környe",
    viszonylat: "import",
    felrakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-27T19:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-27T23:45" },
    tavolsag_km: 1080,
    adr: false,
    surgos: true
  },
  {
    id: "F15",
    megnevezes: "Demo belföldi opció – Debrecen → Környe",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Debrecen, Logisztikai Központ", ido: "2026-03-27T14:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-27T19:00" },
    tavolsag_km: 270,
    adr: false,
    surgos: false
  },
  {
    id: "F16",
    megnevezes: "Demo belföldi opció – Debrecen → Szeged",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Debrecen, Logisztikai Központ", ido: "2026-03-27T14:20" },
    lerakas: { cim: "Magyarország, Szeged, Ipari Park", ido: "2026-03-27T20:20" },
    tavolsag_km: 240,
    adr: false,
    surgos: false
  },
  {
    id: "F17",
    megnevezes: "Demo import – Milano → Tatabánya",
    viszonylat: "import",
    felrakas: { cim: "Milano, Hub Nord", ido: "2026-03-27T09:00" },
    lerakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-27T22:30" },
    tavolsag_km: 930,
    adr: false,
    surgos: false
  },
  {
    id: "F18",
    megnevezes: "Demo belföldi – Tatabánya → Vác",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-27T09:00" },
    lerakas: { cim: "Magyarország, Vác, Ipari Park", ido: "2026-03-27T11:30" },
    tavolsag_km: 85,
    adr: false,
    surgos: false
  },
  {
    id: "F20",
    megnevezes: "Demo belföldi – Győr → Budapest",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-27T13:45" },
    lerakas: { cim: "Magyarország, Budapest, Logisztikai Park", ido: "2026-03-27T16:15" },
    tavolsag_km: 125,
    adr: false,
    surgos: false
  },
  {
    id: "F21",
    megnevezes: "Demo belföldi – Környe → Környe",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-27T16:30" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-27T18:00" },
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
  // --- Auto-generált Páty előfutás / utófutás feladatok ---
  ...generatePatyRelayFuvarok(FUVAROK_REAL)
  /*
  ,{
    id: "F1",
    megnevezes: "Vegyszerek – BASF Frankfurt",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Budapest, Logisztikai Park 1.", ido: "2026-03-21T06:00" },
    lerakas: { cim: "Frankfurt, Industrial Zone", ido: "2026-03-21T20:00" },
    tavolsag_km: 820,
    adr: true,
    surgos: false
  },
  {
    megnevezes: "Autóalkatrészek – Wien",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Győr, Audi gyár", ido: "2026-03-21T08:00" },
    lerakas: { cim: "Wien, Lagerhaus 12", ido: "2026-03-21T14:00" },
    tavolsag_km: 120,
    adr: false,
    surgos: true
  },
  {
    id: "F3",
    megnevezes: "Élelmiszer – München",
    viszonylat: "import",
    felrakas: { cim: "München, Großmarkt", ido: "2026-03-19T10:00" },
    lerakas: { cim: "Magyarország, Budapest, Nagybani piac", ido: "2026-03-19T20:00" },
    tavolsag_km: 650,
    adr: false,
    surgos: false
  },
  {
    id: "F5",
    megnevezes: "Építőanyag – Miskolc",
    viszonylat: "belfold",
    felrakas: { cim: "Magyarország, Budapest, Csepel terminál", ido: "2026-03-21T07:00" },
    lerakas: { cim: "Magyarország, Miskolc, Telephely 4", ido: "2026-03-21T14:00" },
    tavolsag_km: 185,
    adr: false,
    surgos: false
  },
  {
    id: "F6",
    megnevezes: "Gyógyszeralapanyag – Pécs",
    viszonylat: "belfold",
    felrakas: { cim: "Magyarország, Kecskemét, Raktárbázis", ido: "2026-03-21T09:00" },
    lerakas: { cim: "Magyarország, Pécs, Egészségipari park", ido: "2026-03-21T16:30" },
    tavolsag_km: 235,
    adr: true,
    surgos: false
  },
  {
    id: "F9",
    megnevezes: "Papírtekercs – Linz → Budapest",
    viszonylat: "import",
    felrakas: { cim: "Linz, Papierfabrik Dock", ido: "2026-03-22T07:00" },
    lerakas: { cim: "Magyarország, Budapest, Raktárutca 8", ido: "2026-03-22T13:00" },
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
