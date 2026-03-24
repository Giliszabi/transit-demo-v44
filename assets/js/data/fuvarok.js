export const FUVAROK = [
  {
    id: "F4",
    megnevezes: "Hűtött áru – Debrecen",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Szeged, Ipari Park", ido: "2026-03-25T07:00" },
    lerakas: { cim: "Magyarország, Debrecen, Logisztikai Központ", ido: "2026-03-25T14:00" },
    tavolsag_km: 220,
    adr: false,
    surgos: false
  },
  {
    id: "F7",
    megnevezes: "Elektronikai cikkek – Milano",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Tatabánya, Disztribúciós központ", ido: "2026-03-25T08:00" },
    lerakas: { cim: "Milano, Hub Nord", ido: "2026-03-25T16:00" },
    tavolsag_km: 920,
    adr: false,
    surgos: false
  },
  {
    id: "F8",
    megnevezes: "Textiláru – Milano → Győr",
    viszonylat: "import",
    felrakas: { cim: "Milano, Hub Nord", ido: "2026-03-25T17:00" },
    lerakas: { cim: "Magyarország, Győr, Átrakó terminál", ido: "2026-03-25T23:00" },
    tavolsag_km: 290,
    adr: false,
    surgos: false
  },
  {
    id: "F10",
    megnevezes: "Teszt export – Környe → Lübeck",
    viszonylat: "export",
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-25T06:00" },
    lerakas: { cim: "Lübeck, Germany, Hafen-Terminal", ido: "2026-03-25T18:00" },
    tavolsag_km: 1080,
    adr: false,
    surgos: false
  },
  {
    id: "F11",
    megnevezes: "Teszt import – Hamburg → Környe",
    viszonylat: "import",
    felrakas: { cim: "Hamburg, Germany, Logistics Dock", ido: "2026-03-25T20:00" },
    lerakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-25T23:30" },
    tavolsag_km: 1060,
    adr: false,
    surgos: false
  },
  {
    id: "F12",
    megnevezes: "Belföldi teszt – Környe → Esztergom",
    viszonylat: "belfold",
    fixedDomestic: true,
    felrakas: { cim: "Magyarország, Környe, Ipari Park", ido: "2026-03-25T09:00" },
    lerakas: { cim: "Magyarország, Esztergom, Ipari Park", ido: "2026-03-25T11:00" },
    tavolsag_km: 46,
    adr: false,
    surgos: false
  }
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
    id: "F2",
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
    .filter((fuvar) => fuvar.viszonylat === "belfold")
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
