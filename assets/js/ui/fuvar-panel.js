// ==============================================================
// Fuvar kártyák + gyorsszűrők + MATCHING ENGINE integráció + Auto-assign
// ==============================================================

import { FUVAROK } from "../data/fuvarok.js";
import { SPEDICIO_PARTNER_NAMES } from "../data/spedicio-partners.js";
import { formatDate } from "../utils.js";
import { evaluateFuvarTags, evaluateAllResources, evaluateFuvarokForResource } from "./matching.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { renderTimeline, refreshAutoDriverStatesForLinkedConvoys, refreshAutoTransitBlocksForResource } from "./timeline.js";
import { getFuvarTagMeta, getCategoryPalette } from "./colors.js";
import { enableFuvarDrag } from "./dragdrop.js";
import { getDomesticTransitRoleInfo } from "./transit-relations.js";
import { openAutoAssignModal } from "./auto-assign-modal.js";

const FILTERS = ["all", "adr", "surgos", "kezes2", "belfold", "export", "import", "elofutas", "utofutas", "spediccio"];
const DEFAULT_FUVAR_FILTER_STATE = Object.freeze({
  category: "all",
  assignment: "all",
  adr: false,
  surgos: false,
  kezes2: false,
  spediccio: false,
  elapsed: false,
  dayOffset: null,
  query: "",
  idScope: null
});
const BASE_CARD_COLUMN_OPTIONS = [
  { id: "pickupLocation", label: "Felrakó" },
  { id: "dropoffLocation", label: "Lerakó" },
  { id: "region", label: "Régió" },
  { id: "pickup", label: "Felrakás dátuma" },
  { id: "delivery", label: "Lerakás dátuma" },
  { id: "client", label: "Megbízó" },
  { id: "distance", label: "Távolság" },
  { id: "latestDeparture", label: "Legkésőbbi indulás" },
  { id: "type", label: "Típus" },
  { id: "status", label: "Státusz" },
  { id: "driver", label: "Gépjárművezető" },
  { id: "tractor", label: "Vontató" },
  { id: "trailer", label: "Pótkocsi" }
];

const EXCEL_UNIFIED_FIELD_LABELS = [...new Set([
  "Becsült legkésőbbi indulás",
  "Tervezett erőforrások",
  "Felrakók",
  "Lerakók",
  "Lerakó régiók",
  "Felrakó régiók",
  "Státusz",
  "Tranzit idő",
  "Vezetési idő",
  "KM",
  "Partner referencia",
  "Partner referencia szám",
  "SZF",
  "SZF kód",
  "Tag",
  "Tag2",
  "Tag3",
  "Tranzitországok",
  "Start cím",
  "Stop cím",
  "Export befejezés 1",
  "Utolsó cím",
  "Ráosztott Pót típus",
  "Fuvarszervező",
  "Megbízó partner",
  "Önköltség",
  "Menetirányítás egység",
  "Megfelelőség",
  "Cikluskezdés",
  "Vezetési idő a cikluson belül (terv)",
  "Hátralévő vezetési idő (terv)",
  "Hátralévő vezetési idő (valós)",
  "Összes költség",
  "Összes költség /KM",
  "Összes gépjárművezető költség /KM",
  "Összes vontató költség /KM",
  "Lerakó ország",
  "Akasztási magasság",
  "Akasztás",
  "Munkarend",
  "Négykezes",
  "Preferált országok",
  "Nem preferált országok",
  "Üzemanyag tank kapacitás",
  "Vontató üzemanyag díj /KM",
  "Vontató útdíj /KM",
  "Vontató amortizáció /KM",
  "Vontató biztosítás /KM",
  "Vontató ITS /KM",
  "Gépjárművezető napidíj /KM",
  "Gépjárművezető ADR költség /KM",
  "Gépjárművezető Forduló díj /KM",
  "Gépjárművezető távolság érték /KM",
  "Gépjárművezető hűség bónusz /KM",
  "Foglaltság",
  "Rövid munka",
  "Rövid munka egyezőség",
  "Megelőző fuvar utolsó címe Magyarországi?",
  "Hétvégi vállalások száma",
  "Külföldön töltött hétvégi napok száma (valós)",
  "Külföldön töltött hétvégi órák száma (valós)",
  "Megjegyzés"
])];

const EXCEL_COLUMN_OPTIONS = EXCEL_UNIFIED_FIELD_LABELS.map((label, index) => ({
  id: `excel_${index + 1}`,
  label,
  excelLabel: label
}));

export const FUVAR_CARD_COLUMN_OPTIONS = [...BASE_CARD_COLUMN_OPTIONS, ...EXCEL_COLUMN_OPTIONS];
const FUVAR_CARD_COLUMN_OPTION_MAP = new Map(FUVAR_CARD_COLUMN_OPTIONS.map((item) => [item.id, item]));

export const DEFAULT_FUVAR_CARD_COLUMNS = [
  "pickupLocation",
  "dropoffLocation",
  "region",
  "pickup",
  "delivery",
  "client",
  "distance",
  "latestDeparture",
];

export function createDefaultFuvarFilterState() {
  return { ...DEFAULT_FUVAR_FILTER_STATE };
}
const CITY_COORDS = {
  // Core international hubs
  milano: { lat: 45.4642, lon: 9.19 },
  hamburg: { lat: 53.5511, lon: 9.9937 },
  lubeck: { lat: 53.8655, lon: 10.6866 },
  munchen: { lat: 48.1351, lon: 11.582 },
  stuttgart: { lat: 48.7758, lon: 9.1829 },
  dusseldorf: { lat: 51.2277, lon: 6.7735 },
  rotterdam: { lat: 51.9244, lon: 4.4777 },
  frankfurt: { lat: 50.1109, lon: 8.6821 },
  wien: { lat: 48.2082, lon: 16.3738 },
  bratislava: { lat: 48.1486, lon: 17.1077 },
  praha: { lat: 50.0755, lon: 14.4378 },
  brno: { lat: 49.1951, lon: 16.6068 },
  linz: { lat: 48.3069, lon: 14.2858 },

  // Domestic cities
  budapest: { lat: 47.4979, lon: 19.0402 },
  gyor: { lat: 47.6875, lon: 17.6504 },
  vac: { lat: 47.7826, lon: 19.1332 },
  dunakeszi: { lat: 47.6364, lon: 19.1386 },
  debrecen: { lat: 47.5316, lon: 21.6273 },
  szeged: { lat: 46.253, lon: 20.1414 },
  miskolc: { lat: 48.1035, lon: 20.7784 },
  pecs: { lat: 46.0727, lon: 18.2323 },
  tatabanya: { lat: 47.5692, lon: 18.4048 },
  kecskemet: { lat: 46.8964, lon: 19.6897 },
  esztergom: { lat: 47.7853, lon: 18.7423 },
  kornye: { lat: 47.5449, lon: 18.3188 },
  szekesfehervar: { lat: 47.186, lon: 18.4221 },
  paty: { lat: 47.5171, lon: 18.8287 },
  tata: { lat: 47.6529, lon: 18.3184 },
  komarom: { lat: 47.7432, lon: 18.1216 },
  szigetszentmiklos: { lat: 47.3471, lon: 19.0430 },
  racalmas: { lat: 47.0222, lon: 18.9405 },
  berhida: { lat: 47.1110, lon: 18.1340 },
  dunaharaszti: { lat: 47.3542, lon: 19.0912 },
  kocs: { lat: 47.6070, lon: 18.2150 },
  hatvan: { lat: 47.6676, lon: 19.6761 },
  biatorbagy: { lat: 47.4739, lon: 18.8233 },
  ecser: { lat: 47.4445, lon: 19.3240 },
  gyal: { lat: 47.3820, lon: 19.2210 },
  gyongyoshalasz: { lat: 47.7420, lon: 19.9290 },
  jaszfenyszaru: { lat: 47.5710, lon: 19.7210 },
  kincsesbanya: { lat: 47.2640, lon: 18.2790 },
  nagykoros: { lat: 47.0340, lon: 19.7780 },
  ocsa: { lat: 47.2990, lon: 19.2300 },
  szalkszentmarton: { lat: 46.9760, lon: 19.0140 },
  szazhalombatta: { lat: 47.3170, lon: 18.9130 },
  zalacseb: { lat: 46.8610, lon: 16.6620 },

  // Additional EU cities from current dataset
  tilburg: { lat: 51.5555, lon: 5.0913 },
  moerdijk: { lat: 51.7017, lon: 4.6289 },
  oostrum: { lat: 51.5300, lon: 5.9500 },
  nurnberg: { lat: 49.4521, lon: 11.0767 },
  bjerringbro: { lat: 56.3779, lon: 9.6614 },
  neutraubling: { lat: 48.9860, lon: 12.1960 },
  grossmehring: { lat: 48.9350, lon: 11.5320 },
  bitozeves: { lat: 50.4050, lon: 13.6200 },
  eindhoven: { lat: 51.4416, lon: 5.4697 },
  emmerich_am_rhein: { lat: 51.8390, lon: 6.2470 },
  le_plessis_belleville: { lat: 49.0950, lon: 2.7440 },
  antwerpen: { lat: 51.2194, lon: 4.4025 },
  jelling: { lat: 55.7550, lon: 9.4250 },
  fosse: { lat: 47.9030, lon: 1.2090 },
  berkel_enschot: { lat: 51.5790, lon: 5.1400 },
  enschede: { lat: 52.2215, lon: 6.8937 },
  harderwijk: { lat: 52.3508, lon: 5.6222 },
  hagen: { lat: 51.3670, lon: 7.4630 },
  meinerzhagen: { lat: 51.1060, lon: 7.6400 },
  seriate: { lat: 45.6850, lon: 9.7240 },
  fraga: { lat: 41.5220, lon: 0.3500 },
  gent: { lat: 51.0543, lon: 3.7174 },
  kuurne: { lat: 50.8510, lon: 3.2830 },
  turnhout: { lat: 51.3225, lon: 4.9447 },
  willebroek: { lat: 51.0600, lon: 4.3600 },
  ctverin: { lat: 50.5400, lon: 15.0100 },
  klasterec_nad_ohri: { lat: 50.3890, lon: 13.1830 },
  kojetice: { lat: 50.2380, lon: 14.5090 },
  pardubice: { lat: 50.0340, lon: 15.7810 },
  uzice_cz: { lat: 50.4300, lon: 14.3800 },
  broby: { lat: 55.3320, lon: 10.2480 },
  fredericia: { lat: 55.5650, lon: 9.7520 },
  villamblain: { lat: 48.0060, lon: 1.6510 },
  born_nl: { lat: 51.0310, lon: 5.8100 },
  groot_ammers: { lat: 51.9230, lon: 4.8230 },
  hasselt_nl: { lat: 52.5920, lon: 6.0950 },
  maasvlakte: { lat: 51.9470, lon: 3.9970 },
  sevenum: { lat: 51.4110, lon: 6.0380 },
  sluis: { lat: 51.3090, lon: 3.3870 },
  vianen: { lat: 51.9920, lon: 5.1000 },
  jedlicze: { lat: 49.7170, lon: 21.6490 },
  biwer: { lat: 49.7060, lon: 6.3730 },
  hannover: { lat: 52.3759, lon: 9.7320 },
  krefeld: { lat: 51.3388, lon: 6.5853 },
  neunkirchen_am_sand: { lat: 49.5230, lon: 11.3200 },
  regensburg: { lat: 49.0134, lon: 12.1016 },
  sankt_egidien: { lat: 50.7860, lon: 12.6200 },
  wedemark: { lat: 52.5600, lon: 9.7200 },
  zwickau: { lat: 50.7180, lon: 12.4940 },
  brescello: { lat: 44.8990, lon: 10.5160 },
  benavente_pt: { lat: 38.9790, lon: -8.8070 },
  setubal: { lat: 38.5240, lon: -8.8890 },
  las_torres_de_cotillas: { lat: 38.0270, lon: -1.2410 },
  munchwilen: { lat: 47.4480, lon: 8.9960 },
  hlinik_nad_hronom: { lat: 48.6490, lon: 18.8070 }
};
const CITY_ALIASES = {
  // Existing aliases
  "budapest": "budapest",
  "gyor": "gyor",
  "vac": "vac",
  "dunakeszi": "dunakeszi",
  "debrecen": "debrecen",
  "szeged": "szeged",
  "miskolc": "miskolc",
  "pecs": "pecs",
  "tatabanya": "tatabanya",
  "kecskemet": "kecskemet",
  "esztergom": "esztergom",
  "kornye": "kornye",
  "szekesfehervar": "szekesfehervar",
  "milano": "milano",
  "milan": "milano",
  "hamburg": "hamburg",
  "lubeck": "lubeck",
  "lubek": "lubeck",
  "munchen": "munchen",
  "munich": "munchen",
  "stuttgart": "stuttgart",
  "dusseldorf": "dusseldorf",
  "duesseldorf": "dusseldorf",
  "rotterdam": "rotterdam",
  "frankfurt": "frankfurt",
  "wien": "wien",
  "vienna": "wien",
  "bratislava": "bratislava",
  "praha": "praha",
  "prague": "praha",
  "brno": "brno",
  "linz": "linz",

  // Domestic additions
  "paty": "paty",
  "tata": "tata",
  "komarom": "komarom",
  "szigetszentmiklos": "szigetszentmiklos",
  "racalmas": "racalmas",
  "berhida": "berhida",
  "dunaharaszti": "dunaharaszti",
  "kocs": "kocs",
  "hatvan": "hatvan",
  "biatorbagy": "biatorbagy",
  "ecser": "ecser",
  "gyal": "gyal",
  "gyongyoshalasz": "gyongyoshalasz",
  "jaszfenyszaru": "jaszfenyszaru",
  "kincsesbanya": "kincsesbanya",
  "nagykoros": "nagykoros",
  "ocsa": "ocsa",
  "szalkszentmarton": "szalkszentmarton",
  "szazhalombatta": "szazhalombatta",
  "zalacseb": "zalacseb",

  // Foreign additions
  "tilburg": "tilburg",
  "moerdijk": "moerdijk",
  "oostrum": "oostrum",
  "nurnberg": "nurnberg",
  "bjerringbro": "bjerringbro",
  "neutraubling": "neutraubling",
  "grossmehring": "grossmehring",
  "bitozeves": "bitozeves",
  "eindhoven": "eindhoven",
  "emmerich am rhein": "emmerich_am_rhein",
  "emmerich": "emmerich_am_rhein",
  "le plessis-belleville": "le_plessis_belleville",
  "le plessis belleville": "le_plessis_belleville",
  "antwerpen": "antwerpen",
  "jelling": "jelling",
  "fosse": "fosse",
  "berkel-enschot": "berkel_enschot",
  "berkel enschot": "berkel_enschot",
  "enschede": "enschede",
  "harderwijk": "harderwijk",
  "hagen": "hagen",
  "meinerzhagen": "meinerzhagen",
  "seriate": "seriate",
  "fraga": "fraga",
  "gent": "gent",
  "kuurne": "kuurne",
  "turnhout": "turnhout",
  "willebroek": "willebroek",
  "ctverin": "ctverin",
  "klasterec nad ohri": "klasterec_nad_ohri",
  "kojetice": "kojetice",
  "pardubice": "pardubice",
  "uzice": "uzice_cz",
  "broby": "broby",
  "fredericia": "fredericia",
  "villamblain": "villamblain",
  "born": "born_nl",
  "groot-ammers": "groot_ammers",
  "groot ammers": "groot_ammers",
  "hasselt": "hasselt_nl",
  "maasvlakte": "maasvlakte",
  "sevenum": "sevenum",
  "sluis": "sluis",
  "vianen": "vianen",
  "jedlicze": "jedlicze",
  "biwer": "biwer",
  "hannover": "hannover",
  "krefeld": "krefeld",
  "neunkirchen am sand": "neunkirchen_am_sand",
  "regensburg": "regensburg",
  "sankt egidien": "sankt_egidien",
  "wedemark": "wedemark",
  "zwickau": "zwickau",
  "brescello": "brescello",
  "benavente": "benavente_pt",
  "setubal": "setubal",
  "las torres de cotillas": "las_torres_de_cotillas",
  "munchwilen": "munchwilen",
  "hlinik nad hronom": "hlinik_nad_hronom"
};
const ROAD_DISTANCE_CACHE = new Map();
const ROAD_DISTANCE_FALLBACK_MULTIPLIER = 1.2;
const AVERAGE_ROUTE_SPEED_KMH = 80;
let roadDistanceRefreshTimer = null;
let focusedFuvarId = null;
let focusedAssemblyId = null;
let currentFuvarSort = {
  columnId: null,
  direction: "asc"
};
const expandedFuvarChainIds = new Set();

window.addEventListener("fuvar:focus", (event) => {
  focusedFuvarId = event?.detail?.fuvarId || null;
});

window.addEventListener("assembly:focus", (event) => {
  focusedAssemblyId = event?.detail?.assemblyId || null;
});
export const SPEDICIO_PARTNERS = [...SPEDICIO_PARTNER_NAMES];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe");
}

function isDateLikeLabel(label) {
  const normalized = normalizeText(label);
  return ["indulas", "felrakas", "lerakas", "cikluskezdes", "eta", "datum", "vege"].some((part) => normalized.includes(part));
}

function isNumberLikeLabel(label) {
  const normalized = normalizeText(label);
  return [" km", "km", "koltseg", "/km", "ido", "orak", "szama", "kapacitas", "magassag", "foglaltsag"].some((part) => normalized.includes(part.trim()));
}

function getColumnMeta(columnId) {
  const baseMap = {
    pickupLocation: { width: 132, sortType: "text" },
    dropoffLocation: { width: 132, sortType: "text" },
    region: { width: 84, sortType: "text" },
    pickup: { width: 146, sortType: "date" },
    delivery: { width: 146, sortType: "date" },
    client: { width: 188, sortType: "text" },
    distance: { width: 88, sortType: "number" },
    latestDeparture: { width: 172, sortType: "date" },
    type: { width: 116, sortType: "text" },
    status: { width: 130, sortType: "text" },
    driver: { width: 180, sortType: "text" },
    tractor: { width: 132, sortType: "text" },
    trailer: { width: 132, sortType: "text" }
  };

  if (baseMap[columnId]) {
    return baseMap[columnId];
  }

  const optionMeta = FUVAR_CARD_COLUMN_OPTION_MAP.get(columnId);
  const label = optionMeta?.excelLabel || optionMeta?.label || "";
  const sortType = isDateLikeLabel(label) ? "date" : isNumberLikeLabel(label) ? "number" : "text";

  if (sortType === "date") {
    return { width: 168, sortType };
  }

  if (sortType === "number") {
    return { width: 132, sortType };
  }

  if (["Megjegyzés", "Megbízó partner", "Partner referencia", "Partner referencia szám", "Felrakók", "Lerakók", "Utolsó cím", "Start cím", "Stop cím"].includes(label)) {
    return { width: 220, sortType };
  }

  return { width: 164, sortType };
}

function getColumnWidthStyle(columnId) {
  const { width } = getColumnMeta(columnId);
  return `width:${width}px;min-width:${width}px;max-width:${width}px;`;
}

function extractNumericValue(value) {
  const normalized = String(value || "").replace(/\s+/g, " ");
  const match = normalized.match(/-?\d+(?:[\.,]\d+)?/);
  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number.parseFloat(match[0].replace(",", "."));
}

function normalizeFuvarFilterState(filter) {
  if (!filter || filter === "all") {
    return createDefaultFuvarFilterState();
  }

  if (typeof filter === "string") {
    const base = createDefaultFuvarFilterState();

    if (["belfold", "export", "import", "elofutas", "utofutas", "spediccio"].includes(filter)) {
      base.category = filter === "spediccio" ? "all" : filter;
      if (filter === "spediccio") {
        base.spediccio = true;
      }
      return base;
    }

    if (filter === "adr" || filter === "surgos" || filter === "kezes2") {
      base[filter] = true;
      return base;
    }

    return base;
  }

  return {
    category: ["all", "belfold", "export", "import", "elofutas", "utofutas"].includes(filter.category) ? filter.category : "all",
    assignment: ["all", "ready", "planning", "unassigned"].includes(filter.assignment) ? filter.assignment : "all",
    adr: Boolean(filter.adr),
    surgos: Boolean(filter.surgos),
    kezes2: Boolean(filter.kezes2),
    spediccio: Boolean(filter.spediccio),
    elapsed: Boolean(filter.elapsed),
    dayOffset: Number.isInteger(filter.dayOffset)
      ? filter.dayOffset
      : null,
    query: String(filter.query || ""),
    idScope: Array.isArray(filter.idScope) && filter.idScope.length > 0
      ? [...new Set(filter.idScope.map((item) => String(item || "")).filter(Boolean))]
      : null
  };
}

function isElapsedFuvar(fuvar, timelineReferenceDate) {
  if (!timelineReferenceDate || !fuvar?.lerakas?.ido) {
    return false;
  }

  const reference = new Date(timelineReferenceDate).getTime();
  const delivery = new Date(fuvar.lerakas.ido).getTime();

  if (!Number.isFinite(reference) || !Number.isFinite(delivery)) {
    return false;
  }

  return delivery < reference;
}

function getDayReferenceBase(referenceDate) {
  const base = referenceDate ? new Date(referenceDate) : new Date();
  if (!Number.isFinite(base.getTime())) {
    return new Date();
  }
  return base;
}

function isSameCalendarDay(leftDate, rightDate) {
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function isFuvarPickupOnDayOffset(fuvar, dayOffset, referenceDate) {
  const pickupMs = new Date(fuvar?.felrakas?.ido || "").getTime();
  if (!Number.isFinite(pickupMs)) {
    return false;
  }

  const base = getDayReferenceBase(referenceDate);
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset);
  return isSameCalendarDay(new Date(pickupMs), target);
}

function getFuvarAssignmentStatusKey(fuvar) {
  const hasRequiredDrivers = fuvar?.onlyTwoKezesRequired
    ? Boolean(fuvar?.assignedSoforId && fuvar?.assignedSecondarySoforId)
    : Boolean(fuvar?.assignedSoforId);

  if (hasRequiredDrivers && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId) {
    return "ready";
  }

  if (fuvar?.assignedSoforId || fuvar?.assignedSecondarySoforId || fuvar?.assignedVontatoId || fuvar?.assignedPotkocsiId) {
    return "planning";
  }

  return "unassigned";
}

function matchesUnifiedFuvarFilter(fuvar, filterState, options = {}) {
  if (Array.isArray(filterState.idScope) && filterState.idScope.length > 0 && !filterState.idScope.includes(fuvar.id)) {
    return false;
  }

  if (filterState.category !== "all") {
    if (filterState.category === "elofutas" || filterState.category === "utofutas") {
      const transitRoleInfo = getDomesticTransitRoleInfo(fuvar);
      if (transitRoleInfo?.role !== filterState.category) {
        return false;
      }
    } else if (fuvar.kategoria !== filterState.category) {
      return false;
    }
  }

  if (filterState.assignment !== "all" && getFuvarAssignmentStatusKey(fuvar) !== filterState.assignment) {
    return false;
  }

  if (filterState.adr && !fuvar.adr) {
    return false;
  }

  if (filterState.surgos && !fuvar.surgos) {
    return false;
  }

  if (filterState.kezes2 && !(fuvar.kezes === "2" || fuvar.onlyTwoKezesRequired)) {
    return false;
  }

  if (filterState.spediccio && !fuvar.spediccio) {
    return false;
  }

  if (filterState.elapsed && !isElapsedFuvar(fuvar, options.timelineReferenceDate)) {
    return false;
  }

  if (filterState.dayOffset !== null && !isFuvarPickupOnDayOffset(fuvar, filterState.dayOffset, options.timelineReferenceDate)) {
    return false;
  }

  const query = normalizeText(filterState.query);
  if (!query) {
    return true;
  }

  const haystack = normalizeText([
    fuvar.id,
    fuvar.megnevezes,
    fuvar.kategoria,
    fuvar.viszonylat,
    fuvar.felrakas?.cim,
    fuvar.lerakas?.cim,
    getAssignedResourceName("sofor", fuvar.assignedSoforId),
    getAssignedResourceName("sofor", fuvar.assignedSecondarySoforId),
    getAssignedResourceName("vontato", fuvar.assignedVontatoId),
    getAssignedResourceName("potkocsi", fuvar.assignedPotkocsiId)
  ].join(" "));

  return haystack.includes(query);
}

function normalizeFieldKey(label) {
  return normalizeText(label)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getTransitMinutes(fuvar) {
  const start = new Date(fuvar?.felrakas?.ido || "").getTime();
  const end = new Date(fuvar?.lerakas?.ido || "").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return Math.round((end - start) / 60000);
}

function formatMinutesToHours(minutes) {
  if (!Number.isFinite(minutes)) {
    return "-";
  }
  const hours = (minutes / 60).toFixed(1);
  return `${hours} óra`;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

function resolveFuvarDistanceKm(fuvar) {
  const rawDistance = fuvar?.tavolsag_km;

  if (typeof rawDistance === "number" && Number.isFinite(rawDistance) && rawDistance >= 0) {
    return rawDistance;
  }

  if (typeof rawDistance === "string") {
    const normalized = rawDistance.trim().toLowerCase();
    if (normalized && normalized !== "undefined" && normalized !== "null" && normalized !== "nan" && normalized !== "-") {
      const parsed = Number(normalized.replace(",", "."));
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }

  const pickupAddress = fuvar?.felrakas?.cim;
  const dropoffAddress = fuvar?.lerakas?.cim;
  if (!pickupAddress || !dropoffAddress) {
    return null;
  }

  const computedKm = getRoadDistanceKm(pickupAddress, dropoffAddress, { prime: true });
  return Number.isFinite(computedKm) ? computedKm : null;
}

function calculateRouteTravelMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return null;
  }

  return Math.max(1, Math.round((distanceKm / AVERAGE_ROUTE_SPEED_KMH) * 60));
}

function getLatestDepartureReferenceTimeMs(fuvar) {
  const relation = normalizeText(fuvar?.viszonylat || fuvar?.kategoria || "");

  if (relation.includes("export")) {
    return new Date(fuvar?.lerakas?.ido || "").getTime();
  }

  if (relation.includes("import")) {
    return new Date(fuvar?.felrakas?.ido || "").getTime();
  }

  return new Date(fuvar?.felrakas?.ido || "").getTime();
}

function getLatestDepartureEstimate(fuvar) {
  const referenceTimeMs = getLatestDepartureReferenceTimeMs(fuvar);
  const pickupAddress = fuvar?.felrakas?.cim;
  const dropoffAddress = fuvar?.lerakas?.cim;

  if (!Number.isFinite(referenceTimeMs) || !pickupAddress || !dropoffAddress) {
    return null;
  }

  const routeDistanceKm = resolveFuvarDistanceKm(fuvar);
  if (!Number.isFinite(routeDistanceKm)) {
    return null;
  }

  const singleMinutes = calculateRouteTravelMinutes(routeDistanceKm);
  const doubleMinutes = Number.isFinite(singleMinutes) ? Math.max(1, Math.round(singleMinutes / 2)) : null;

  if (!Number.isFinite(singleMinutes) || !Number.isFinite(doubleMinutes)) {
    return null;
  }

  const singleMs = referenceTimeMs - (singleMinutes * 60 * 1000);
  const doubleMs = referenceTimeMs - (doubleMinutes * 60 * 1000);

  return {
    singleMs,
    doubleMs,
    singleIso: new Date(singleMs).toISOString(),
    doubleIso: new Date(doubleMs).toISOString()
  };
}

function getCountryFromAddress(address) {
  const normalized = normalizeText(address);
  if (normalized.includes("magyarorszag") || normalized.includes("hungary")) {
    return "Magyarország";
  }
  if (normalized.includes("milano") || normalized.includes("milan")) {
    return "Olaszország";
  }
  if (normalized.includes("wien") || normalized.includes("vienna")) {
    return "Ausztria";
  }
  if (normalized.includes("munchen") || normalized.includes("frankfurt")) {
    return "Németország";
  }
  return "-";
}

function getExcelFieldValue(fuvar, excelLabel, context) {
  const transitMinutes = getTransitMinutes(fuvar);
  const resolvedDistanceKm = resolveFuvarDistanceKm(fuvar);
  const estimatedCost = Number(fuvar?.osszkoltseg || fuvar?.onkoltseg || ((Number.isFinite(resolvedDistanceKm) ? resolvedDistanceKm : 0) * 430));
  const costPerKm = Number.isFinite(resolvedDistanceKm) && resolvedDistanceKm > 0
    ? estimatedCost / resolvedDistanceKm
    : null;
  const lowerLabel = normalizeText(excelLabel);

  if (lowerLabel === normalizeText("Tervezett indulás")) {
    return formatDate(fuvar?.felrakas?.ido);
  }
  if (lowerLabel === normalizeText("Becsült legkésőbbi indulás")) {
    if (fuvar?.becsult_legkesobbi_indulas) {
      return formatDate(fuvar.becsult_legkesobbi_indulas);
    }
    if (fuvar?.felrakas?.ido) {
      const base = new Date(fuvar.felrakas.ido).getTime();
      return formatDate(new Date(base + 30 * 60000).toISOString());
    }
  }
  if (lowerLabel === normalizeText("Felrakók")) {
    return getDisplayLocation(fuvar?.felrakas?.cim);
  }
  if (lowerLabel === normalizeText("Lerakók") || lowerLabel === normalizeText("Utolsó cím") || lowerLabel === normalizeText("Stop cím")) {
    return getDisplayLocation(fuvar?.lerakas?.cim);
  }
  if (lowerLabel === normalizeText("Start cím") || lowerLabel === normalizeText("Első cím")) {
    return getDisplayLocation(fuvar?.felrakas?.cim);
  }
  if (lowerLabel === normalizeText("Lerakó régiók")) {
    return fuvar?.lerako_regiok || getDisplayLocation(fuvar?.lerakas?.cim);
  }
  if (lowerLabel === normalizeText("Felrakó régiók")) {
    return fuvar?.felrako_regiok || getDisplayLocation(fuvar?.felrakas?.cim);
  }
  if (lowerLabel === normalizeText("Státusz")) {
    return context.statusLabel;
  }
  if (lowerLabel === normalizeText("Tranzit idő")) {
    return formatMinutesToHours(transitMinutes);
  }
  if (lowerLabel === normalizeText("Vezetési idő") || lowerLabel === normalizeText("Vezetési idő a cikluson belül (terv)")) {
    const driving = fuvar?.vezetesi_ido_perc || (Number.isFinite(transitMinutes) ? Math.round(transitMinutes * 0.78) : null);
    return formatMinutesToHours(driving);
  }
  if (lowerLabel === normalizeText("Hátralévő vezetési idő (terv)") || lowerLabel === normalizeText("Hátralévő vezetési idő (valós)")) {
    const remaining = fuvar?.hatralevo_vezetesi_ido_perc || (Number.isFinite(transitMinutes) ? Math.max(0, 540 - Math.round(transitMinutes * 0.78)) : null);
    return formatMinutesToHours(remaining);
  }
  if (lowerLabel === normalizeText("KM")) {
    return Number.isFinite(resolvedDistanceKm) ? `${Math.round(resolvedDistanceKm)} km` : "-";
  }
  if (lowerLabel === normalizeText("ADR")) {
    return fuvar?.adr ? "Igen" : "Nem";
  }
  if (lowerLabel === normalizeText("Tervezett erőforrások") || lowerLabel === normalizeText("Erőforrások")) {
    return `👤 ${context.soforName} • 🚛 ${context.vontatoName} • 🔗 ${context.potkocsiName}`;
  }
  if (lowerLabel === normalizeText("Vontató")) {
    return context.vontatoName;
  }
  if (lowerLabel === normalizeText("Pót") || lowerLabel === normalizeText("Ráosztott Pót típus")) {
    return context.potkocsiName;
  }
  if (lowerLabel === normalizeText("1. Gépjárművezető") || lowerLabel === normalizeText("2. Gépjárművezető") || lowerLabel === normalizeText("Nemzetközi gépjárművezető 1") || lowerLabel === normalizeText("Nemzetközi gépjárművezető 2")) {
    return context.soforName;
  }
  if (lowerLabel === normalizeText("Menetirányítás egység")) {
    return fuvar?.menetiranyitas_egyseg || `${fuvar?.viszonylat || "fuvar"}-${fuvar?.id || "-"}`;
  }
  if (lowerLabel === normalizeText("Megfelelőség")) {
    return context.isFullyAssigned ? "Megfelel" : "Ellenőrzendő";
  }
  if (lowerLabel === normalizeText("Cikluskezdés")) {
    return formatDate(fuvar?.felrakas?.ido);
  }
  if (lowerLabel === normalizeText("Összes költség") || lowerLabel === normalizeText("Önköltség")) {
    return formatCurrency(estimatedCost);
  }
  if (lowerLabel === normalizeText("Összes költség /KM")) {
    return Number.isFinite(costPerKm) ? `${costPerKm.toFixed(0)} Ft/km` : "-";
  }
  if (lowerLabel === normalizeText("Összes gépjárművezető költség /KM")) {
    return Number.isFinite(costPerKm) ? `${(costPerKm * 0.44).toFixed(0)} Ft/km` : "-";
  }
  if (lowerLabel === normalizeText("Összes vontató költség /KM")) {
    return Number.isFinite(costPerKm) ? `${(costPerKm * 0.56).toFixed(0)} Ft/km` : "-";
  }
  if (lowerLabel === normalizeText("Lerakó ország")) {
    return getCountryFromAddress(fuvar?.lerakas?.cim);
  }
  if (lowerLabel === normalizeText("Tag") || lowerLabel === normalizeText("Tag2") || lowerLabel === normalizeText("Tag3")) {
    return fuvar?.[lowerLabel] || "-";
  }

  const bag = fuvar?.excelData || fuvar?.excel || {};
  if (Object.prototype.hasOwnProperty.call(bag, excelLabel) && bag[excelLabel] !== null && bag[excelLabel] !== "") {
    return String(bag[excelLabel]);
  }

  const normalizedKey = normalizeFieldKey(excelLabel);
  if (Object.prototype.hasOwnProperty.call(fuvar, normalizedKey) && fuvar[normalizedKey] !== null && fuvar[normalizedKey] !== "") {
    return String(fuvar[normalizedKey]);
  }

  if (Object.prototype.hasOwnProperty.call(fuvar, excelLabel) && fuvar[excelLabel] !== null && fuvar[excelLabel] !== "") {
    return String(fuvar[excelLabel]);
  }

  return "-";
}

function getBaseColumnDisplayValue(fuvar, columnId, context) {
  if (columnId === "pickupLocation") {
    return getDisplayLocation(fuvar.felrakas.cim);
  }
  if (columnId === "dropoffLocation") {
    return getDisplayLocation(fuvar.lerakas.cim);
  }
  if (columnId === "region") {
    return getFuvarRegionCode(fuvar);
  }
  if (columnId === "pickup") {
    return formatDate(fuvar.felrakas.ido);
  }
  if (columnId === "delivery") {
    return formatDate(fuvar.lerakas.ido);
  }
  if (columnId === "client") {
    return fuvar?.megbizo || getExcelFieldValue(fuvar, "Megbízó partner", context);
  }
  if (columnId === "distance") {
    const assemblyDropoffAddress = getFocusedAssemblyDropoffAddress();
    const selectedAssemblyDistance = getSelectedAssemblyDistanceKm(fuvar, assemblyDropoffAddress);
    if (focusedAssemblyId && Number.isFinite(selectedAssemblyDistance)) {
      return `${Math.round(selectedAssemblyDistance)} km`;
    }

    const resolvedDistanceKm = resolveFuvarDistanceKm(fuvar);
    return Number.isFinite(resolvedDistanceKm) ? `${Math.round(resolvedDistanceKm)} km` : "-";
  }
  if (columnId === "latestDeparture") {
    const departure = getLatestDepartureEstimate(fuvar);
    if (!departure) {
      return "👤 -\n👥 -";
    }

    return `👤 ${formatDate(departure.singleIso)}\n👥 ${formatDate(departure.doubleIso)}`;
  }
  if (columnId === "type") {
    return context.viszonylatLabel;
  }
  if (columnId === "status") {
    return context.statusLabel;
  }
  if (columnId === "driver") {
    return `👤 ${context.soforName}`;
  }
  if (columnId === "tractor") {
    return `🚛 ${context.vontatoName}`;
  }
  if (columnId === "trailer") {
    return `🔗 ${context.potkocsiName}`;
  }
  return "-";
}

function getBaseColumnSortValue(fuvar, columnId, context) {
  if (columnId === "pickupLocation") {
    return normalizeText(getDisplayLocation(fuvar.felrakas.cim));
  }
  if (columnId === "dropoffLocation") {
    return normalizeText(getDisplayLocation(fuvar.lerakas.cim));
  }
  if (columnId === "region") {
    return getFuvarRegionCode(fuvar);
  }
  if (columnId === "pickup") {
    return new Date(fuvar.felrakas.ido).getTime();
  }
  if (columnId === "delivery") {
    return new Date(fuvar.lerakas.ido).getTime();
  }
  if (columnId === "client") {
    return normalizeText(fuvar?.megbizo || getExcelFieldValue(fuvar, "Megbízó partner", context));
  }
  if (columnId === "distance") {
    const assemblyDropoffAddress = getFocusedAssemblyDropoffAddress();
    const selectedAssemblyDistance = getSelectedAssemblyDistanceKm(fuvar, assemblyDropoffAddress);
    if (focusedAssemblyId && Number.isFinite(selectedAssemblyDistance)) {
      return selectedAssemblyDistance;
    }

    const resolvedDistanceKm = resolveFuvarDistanceKm(fuvar);
    return Number.isFinite(resolvedDistanceKm) ? resolvedDistanceKm : 0;
  }
  if (columnId === "latestDeparture") {
    const departure = getLatestDepartureEstimate(fuvar);
    return Number.isFinite(departure?.singleMs) ? departure.singleMs : Number.NEGATIVE_INFINITY;
  }
  if (columnId === "type") {
    return normalizeText(context.viszonylatLabel);
  }
  if (columnId === "status") {
    return normalizeText(context.statusLabel);
  }
  if (columnId === "driver") {
    return normalizeText(context.soforName);
  }
  if (columnId === "tractor") {
    return normalizeText(context.vontatoName);
  }
  if (columnId === "trailer") {
    return normalizeText(context.potkocsiName);
  }
  return "";
}

function getExcelFieldSortValue(fuvar, excelLabel, context) {
  const normalized = normalizeText(excelLabel);

  if (normalized === normalizeText("Tervezett indulás") || normalized === normalizeText("Becsült legkésőbbi indulás") || normalized === normalizeText("Cikluskezdés") || normalized === normalizeText("Felrakás")) {
    return new Date(fuvar?.felrakas?.ido || 0).getTime();
  }

  if (normalized === normalizeText("Lerakás") || normalized === normalizeText("Export befejezés 1") || normalized === normalizeText("EF vége") || normalized === normalizeText("Telephelyre érkezés ETA")) {
    return new Date(fuvar?.lerakas?.ido || 0).getTime();
  }

  if (isNumberLikeLabel(excelLabel)) {
    return extractNumericValue(getExcelFieldValue(fuvar, excelLabel, context));
  }

  return normalizeText(getExcelFieldValue(fuvar, excelLabel, context));
}

function getDisplayLocation(address) {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "-";
  }

  const first = normalizeText(parts[0]);
  const startsWithCountry = first.includes("magyarorszag")
    || first.includes("hungary")
    || KNOWN_FOREIGN_FIRST_PARTS.some((country) => first.includes(country))
    || first.endsWith("orszag");

  if (startsWithCountry && parts[1]) {
    return parts[1];
  }

  return parts[0];
}

const COUNTRY_CODE_BY_COUNTRY_ALIAS = {
  magyarorszag: "HU",
  hungary: "HU",
  nemetorszag: "DE",
  germany: "DE",
  ausztria: "AT",
  austria: "AT",
  hollandia: "NL",
  netherlands: "NL",
  olaszorszag: "IT",
  italy: "IT",
  spanyolorszag: "ES",
  spain: "ES",
  csehorszag: "CZ",
  czech: "CZ",
  szlovakia: "SK",
  slovakia: "SK",
  dania: "DK",
  denmark: "DK",
  belgia: "BE",
  belgium: "BE",
  lengyelorszag: "PL",
  poland: "PL",
  luxemburg: "LU",
  luxembourg: "LU",
  portugal: "PT",
  franciaorszag: "FR",
  france: "FR",
  svajc: "CH",
  switzerland: "CH"
};

const COUNTRY_CODE_BY_CITY_ALIAS = {
  milano: "IT",
  brescello: "IT",
  hamburg: "DE",
  lubeck: "DE",
  munchen: "DE",
  stuttgart: "DE",
  dusseldorf: "DE",
  frankfurt: "DE",
  nurnberg: "DE",
  regensburg: "DE",
  hannover: "DE",
  wien: "AT",
  rotterdam: "NL",
  oostrum: "NL",
  groot_ammers: "NL",
  maasvlakte: "NL",
  vianen: "NL",
  sevenum: "NL",
  sluis: "NL",
  enschede: "NL",
  harderwijk: "NL",
  eindhoven: "NL",
  moerdijk: "NL",
  praha: "CZ",
  brno: "CZ",
  bitozeves: "CZ",
  klasterec_nad_ohri: "CZ",
  pardubice: "CZ",
  bratislava: "SK",
  jelling: "DK",
  bjerringbro: "DK",
  fredericia: "DK",
  broby: "DK",
  antwerpen: "BE",
  gent: "BE",
  kuurne: "BE",
  turnhout: "BE",
  willebroek: "BE",
  biwer: "LU",
  setubal: "PT",
  benavente_pt: "PT",
  las_torres_de_cotillas: "ES",
  fraga: "ES",
  munchwilen: "CH"
};

const POSTAL_PREFIX_BY_CITY_ALIAS = {
  budapest: "10",
  gyor: "90",
  vac: "26",
  dunakeszi: "21",
  debrecen: "40",
  szeged: "67",
  miskolc: "35",
  pecs: "76",
  tatabanya: "28",
  kecskemet: "60",
  esztergom: "25",
  kornye: "28",
  szekesfehervar: "80",
  paty: "20",
  tata: "28",
  komarom: "29",
  szigetszentmiklos: "23",
  racalmas: "24",
  berhida: "81",
  dunaharaszti: "23",
  kocs: "28",
  hatvan: "30",
  biatorbagy: "20",
  ecser: "22",
  gyal: "23",
  gyongyoshalasz: "32",
  jaszfenyszaru: "51",
  kincsesbanya: "80",
  nagykoros: "27",
  ocsa: "23",
  szalkszentmarton: "60",
  szazhalombatta: "24",
  zalacseb: "89",
  milano: "20",
  hamburg: "20",
  lubeck: "23",
  munchen: "80",
  stuttgart: "70",
  dusseldorf: "40",
  rotterdam: "30",
  frankfurt: "60",
  wien: "10",
  bratislava: "81",
  praha: "11",
  brno: "60",
  linz: "40",
  oostrum: "58",
  nurnberg: "90",
  bjerringbro: "88",
  neutraubling: "93",
  grossmehring: "85",
  bitozeves: "43",
  eindhoven: "56",
  antwerpen: "20",
  jelling: "73",
  berkel_enschot: "50",
  enschede: "75",
  harderwijk: "38",
  hagen: "58",
  seriate: "24",
  fraga: "22",
  gent: "90",
  kuurne: "85",
  turnhout: "23",
  willebroek: "28",
  pardubice: "53",
  fredericia: "70",
  born_nl: "61",
  groot_ammers: "29",
  maasvlakte: "31",
  sevenum: "59",
  sluis: "45",
  vianen: "41",
  jedlicze: "38",
  biwer: "68",
  hannover: "30",
  krefeld: "47",
  regensburg: "93",
  zwickau: "08",
  brescello: "42",
  benavente_pt: "21",
  setubal: "29",
  las_torres_de_cotillas: "30",
  munchwilen: "95",
  hlinik_nad_hronom: "96"
};

function inferCountryCodeFromAddress(address) {
  const normalizedAddress = normalizeText(address);
  const aliasCode = Object.entries(COUNTRY_CODE_BY_COUNTRY_ALIAS).find(([alias]) => normalizedAddress.includes(alias))?.[1];
  if (aliasCode) {
    return aliasCode;
  }

  const cityAlias = getCityKeyFromAddress(address);
  if (cityAlias && COUNTRY_CODE_BY_CITY_ALIAS[cityAlias]) {
    return COUNTRY_CODE_BY_CITY_ALIAS[cityAlias];
  }

  if (isHungaryAddress(address)) {
    return "HU";
  }

  return "ZZ";
}

function extractPostalPrefix(address) {
  const match = String(address || "").match(/\b(\d{4,5})\b/);
  if (match?.[1]) {
    return match[1].slice(0, 2);
  }

  const cityAlias = getCityKeyFromAddress(address);
  if (cityAlias && POSTAL_PREFIX_BY_CITY_ALIAS[cityAlias]) {
    return POSTAL_PREFIX_BY_CITY_ALIAS[cityAlias];
  }

  return "00";
}

function getFuvarRegionCode(fuvar) {
  const relation = normalizeText(fuvar?.viszonylat);
  const pickupAddress = fuvar?.felrakas?.cim || "";
  const dropoffAddress = fuvar?.lerakas?.cim || "";

  let countrySourceAddress = dropoffAddress;
  let postalSourceAddress = dropoffAddress;

  if (relation === "import") {
    countrySourceAddress = pickupAddress;
    postalSourceAddress = dropoffAddress;
  } else if (relation !== "export") {
    countrySourceAddress = dropoffAddress || pickupAddress;
    postalSourceAddress = dropoffAddress || pickupAddress;
  }

  const countryCode = inferCountryCodeFromAddress(countrySourceAddress);
  const postalPrefix = extractPostalPrefix(postalSourceAddress);
  return `${countryCode}${postalPrefix}`;
}

function scheduleRoadDistanceRefresh() {
  if (roadDistanceRefreshTimer) {
    return;
  }

  roadDistanceRefreshTimer = window.setTimeout(() => {
    roadDistanceRefreshTimer = null;
    window.dispatchEvent(new CustomEvent("fuvar:road-distance-updated"));
  }, 120);
}

const KNOWN_FOREIGN_FIRST_PARTS = [
  "hollandia", "nemetorszag", "germany", "dania", "franciaorszag", "olaszorszag",
  "csehorszag", "luxemburg", "ausztria", "austria", "belgium", "netherlands",
  "lengyelorszag", "polska", "romania", "szerbiai", "bulgaria", "horvato",
  "szlovakia", "ukrajna"
];

function isHungaryAddress(address) {
  const normalized = normalizeText(address);
  if (normalized.includes("magyarorszag") || normalized.includes("hungary")) {
    return true;
  }
  // Ha nincs vesszős ország-prefix (pl. "Páty", "Tata"), feltétel szerint Magyarország
  if (!String(address || "").includes(",")) {
    return true;
  }
  const firstPart = normalizeText(String(address || "").split(",")[0].trim());
  return !KNOWN_FOREIGN_FIRST_PARTS.some((country) => firstPart.includes(country));
}

function hasFullAssignment(fuvar) {
  const hasRequiredDrivers = fuvar?.onlyTwoKezesRequired
    ? Boolean(fuvar?.assignedSoforId && fuvar?.assignedSecondarySoforId)
    : Boolean(fuvar?.assignedSoforId);

  return Boolean(hasRequiredDrivers && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId);
}

function hasSameTrio(leftFuvar, rightFuvar) {
  return leftFuvar.assignedSoforId === rightFuvar.assignedSoforId
    && (leftFuvar.assignedSecondarySoforId || null) === (rightFuvar.assignedSecondarySoforId || null)
    && leftFuvar.assignedVontatoId === rightFuvar.assignedVontatoId
    && leftFuvar.assignedPotkocsiId === rightFuvar.assignedPotkocsiId;
}

function getCityKeyFromAddress(address) {
  const display = normalizeText(getDisplayLocation(address));
  const normalizedAddress = normalizeText(address);
  if (!display) {
    return "";
  }

  const matchedKey = Object.keys(CITY_ALIASES).find((alias) => {
    return display.includes(alias) || normalizedAddress.includes(alias);
  });

  return matchedKey ? CITY_ALIASES[matchedKey] : "";
}

function estimateDistanceKm(addressA, addressB) {
  const cityA = getCityKeyFromAddress(addressA);
  const cityB = getCityKeyFromAddress(addressB);

  const a = CITY_COORDS[cityA];
  const b = CITY_COORDS[cityB];

  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  const latDiffKm = (a.lat - b.lat) * 111;
  const avgLatRad = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const lonDiffKm = (a.lon - b.lon) * 111 * Math.cos(avgLatRad);
  return Math.sqrt(latDiffKm * latDiffKm + lonDiffKm * lonDiffKm);
}

async function fetchRoadDistanceKm(cityA, cityB) {
  if (!cityA || !cityB) {
    return Number.NaN;
  }

  if (cityA === cityB) {
    return 0;
  }

  const from = CITY_COORDS[cityA];
  const to = CITY_COORDS[cityB];
  if (!from || !to) {
    return Number.NaN;
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), 3500);

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`,
      {
        method: "GET",
        signal: abortController.signal
      }
    );

    if (!response.ok) {
      return Number.NaN;
    }

    const payload = await response.json();
    const meters = payload?.routes?.[0]?.distance;
    return Number.isFinite(meters) ? meters / 1000 : Number.NaN;
  } catch (_error) {
    return Number.NaN;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getRoadDistanceKm(addressA, addressB, options = { prime: true }) {
  const cityA = getCityKeyFromAddress(addressA);
  const cityB = getCityKeyFromAddress(addressB);

  if (!cityA || !cityB) {
    return Number.POSITIVE_INFINITY;
  }

  const key = [cityA, cityB].sort().join("::");
  const cached = ROAD_DISTANCE_CACHE.get(key);
  if (Number.isFinite(cached?.km)) {
    return cached.km;
  }

  if (options?.prime && !cached?.pending) {
    ROAD_DISTANCE_CACHE.set(key, { km: Number.NaN, pending: true });

    fetchRoadDistanceKm(cityA, cityB)
      .then((km) => {
        if (Number.isFinite(km)) {
          ROAD_DISTANCE_CACHE.set(key, { km, pending: false });
          scheduleRoadDistanceRefresh();
          return;
        }

        ROAD_DISTANCE_CACHE.set(key, { km: Number.NaN, pending: false });
      })
      .catch(() => {
        ROAD_DISTANCE_CACHE.set(key, { km: Number.NaN, pending: false });
      });
  }

  const airDistanceKm = estimateDistanceKm(addressA, addressB);
  return Number.isFinite(airDistanceKm)
    ? airDistanceKm * ROAD_DISTANCE_FALLBACK_MULTIPLIER
    : Number.POSITIVE_INFINITY;
}

function getSelectedAssemblyDistanceKm(fuvar, assemblyDropoffAddress) {
  if (!focusedAssemblyId || !assemblyDropoffAddress || !fuvar?.felrakas?.cim) {
    return Number.POSITIVE_INFINITY;
  }

  return getRoadDistanceKm(assemblyDropoffAddress, fuvar.felrakas.cim, { prime: true });
}

function findRecommendedImportForFocusedExport() {
  if (!focusedFuvarId) {
    return null;
  }

  const focusedFuvar = FUVAROK.find((fuvar) => fuvar.id === focusedFuvarId);
  if (!focusedFuvar) {
    return null;
  }

  evaluateFuvarTags(focusedFuvar);
  if (focusedFuvar.kategoria !== "export") {
    return null;
  }

  if (isHungaryAddress(focusedFuvar.lerakas.cim)) {
    return null;
  }

  if (!hasFullAssignment(focusedFuvar)) {
    return null;
  }

  const hasAssignedReturnImport = FUVAROK.some((candidate) => {
    if (candidate.id === focusedFuvar.id) {
      return false;
    }

    evaluateFuvarTags(candidate);
    return candidate.kategoria === "import"
      && isHungaryAddress(candidate.lerakas.cim)
      && hasFullAssignment(candidate)
      && hasSameTrio(candidate, focusedFuvar);
  });

  if (hasAssignedReturnImport) {
    return null;
  }

  const importCandidates = FUVAROK.filter((candidate) => {
    evaluateFuvarTags(candidate);
    return candidate.kategoria === "import" && isHungaryAddress(candidate.lerakas.cim);
  });

  if (importCandidates.length === 0) {
    return null;
  }

  let bestCandidate = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  importCandidates.forEach((candidate) => {
    const distance = estimateDistanceKm(focusedFuvar.lerakas.cim, candidate.felrakas.cim);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  });

  return bestCandidate ? { fuvarId: bestCandidate.id, basedOnFuvarId: focusedFuvar.id } : null;
}

function getFocusedAssemblyDropoffAddress() {
  if (!focusedAssemblyId) {
    return "";
  }

  const completedFuvarok = FUVAROK
    .filter((fuvar) => fuvar?.assignedVontatoId === focusedAssemblyId)
    .filter((fuvar) => fuvar?.lerakas?.cim && fuvar?.lerakas?.ido)
    .sort((left, right) => new Date(right.lerakas.ido) - new Date(left.lerakas.ido));

  if (completedFuvarok.length > 0) {
    return completedFuvarok[0].lerakas.cim;
  }

  const fallbackFuvar = FUVAROK.find((fuvar) => {
    return fuvar?.assignedVontatoId === focusedAssemblyId && fuvar?.lerakas?.cim;
  });

  if (fallbackFuvar?.lerakas?.cim) {
    return fallbackFuvar.lerakas.cim;
  }

  const selectedVontato = VONTATOK.find((item) => item.id === focusedAssemblyId);
  const latestTimelineDropoff = (selectedVontato?.timeline || [])
    .filter((block) => block?.type === "fuvar" && !block?.synthetic && block?.lerakasCim)
    .sort((left, right) => new Date(right.end || right.start) - new Date(left.end || left.start))[0]?.lerakasCim;

  if (latestTimelineDropoff) {
    return latestTimelineDropoff;
  }

  return selectedVontato?.jelenlegi_pozicio?.hely || "";
}

function getRecommendationResourceByScope(scope) {
  if (!scope?.type || !scope?.id) {
    return null;
  }

  if (scope.type === "sofor") {
    return SOFOROK.find((item) => item.id === scope.id) || null;
  }

  if (scope.type === "vontato") {
    return VONTATOK.find((item) => item.id === scope.id) || null;
  }

  if (scope.type === "potkocsi") {
    return POTKOCSIK.find((item) => item.id === scope.id) || null;
  }

  return null;
}

function getRecommendationResourceContext(scope) {
  const primaryResource = getRecommendationResourceByScope(scope);
  if (!primaryResource || !scope?.type) {
    return null;
  }

  const resources = [];
  const seen = new Set();
  const pushResource = (type, resource) => {
    if (!type || !resource?.id) {
      return;
    }

    const key = `${type}:${resource.id}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    resources.push({ type, resource });
  };

  pushResource(scope.type, primaryResource);

  if (scope.type === "sofor") {
    const linkedVontato = primaryResource.linkedVontatoId
      ? VONTATOK.find((item) => item.id === primaryResource.linkedVontatoId) || null
      : VONTATOK.find((item) => item.linkedSoforId === primaryResource.id) || null;
    pushResource("vontato", linkedVontato);

    const linkedPotkocsi = linkedVontato?.linkedPotkocsiId
      ? POTKOCSIK.find((item) => item.id === linkedVontato.linkedPotkocsiId) || null
      : linkedVontato
        ? POTKOCSIK.find((item) => item.linkedVontatoId === linkedVontato.id) || null
        : null;
    pushResource("potkocsi", linkedPotkocsi);
  }

  if (scope.type === "vontato") {
    const linkedSofor = primaryResource.linkedSoforId
      ? SOFOROK.find((item) => item.id === primaryResource.linkedSoforId) || null
      : SOFOROK.find((item) => item.linkedVontatoId === primaryResource.id) || null;
    const linkedPotkocsi = primaryResource.linkedPotkocsiId
      ? POTKOCSIK.find((item) => item.id === primaryResource.linkedPotkocsiId) || null
      : POTKOCSIK.find((item) => item.linkedVontatoId === primaryResource.id) || null;
    pushResource("sofor", linkedSofor);
    pushResource("potkocsi", linkedPotkocsi);
  }

  if (scope.type === "potkocsi") {
    const linkedVontato = primaryResource.linkedVontatoId
      ? VONTATOK.find((item) => item.id === primaryResource.linkedVontatoId) || null
      : null;
    const linkedSofor = linkedVontato?.linkedSoforId
      ? SOFOROK.find((item) => item.id === linkedVontato.linkedSoforId) || null
      : linkedVontato
        ? SOFOROK.find((item) => item.linkedVontatoId === linkedVontato.id) || null
        : null;
    pushResource("vontato", linkedVontato);
    pushResource("sofor", linkedSofor);
  }

  return {
    primaryType: scope.type,
    primaryResource,
    resources
  };
}

function isResourceAssignedToFuvar(resource, scopeType, fuvar) {
  if (!resource?.id || !scopeType || !fuvar) {
    return false;
  }

  if (scopeType === "sofor") {
    return fuvar.assignedSoforId === resource.id || fuvar.assignedSecondarySoforId === resource.id;
  }

  if (scopeType === "vontato") {
    return fuvar.assignedVontatoId === resource.id;
  }

  if (scopeType === "potkocsi") {
    return fuvar.assignedPotkocsiId === resource.id;
  }

  return false;
}

function getFocusedFuvarForResource(resource, scopeType) {
  if (!resource || !scopeType || !focusedFuvarId) {
    return null;
  }

  const focusedFuvar = FUVAROK.find((item) => item.id === focusedFuvarId) || null;
  if (!focusedFuvar) {
    return null;
  }

  if (isResourceAssignedToFuvar(resource, scopeType, focusedFuvar)) {
    return focusedFuvar;
  }

  const hasTimelineBlock = (resource.timeline || []).some((block) => {
    return block?.type === "fuvar"
      && !block?.synthetic
      && block?.fuvarId === focusedFuvar.id;
  });

  return hasTimelineBlock ? focusedFuvar : null;
}

function getFocusedFuvarForContext(context) {
  if (!context || !focusedFuvarId) {
    return null;
  }

  const focusedFuvar = FUVAROK.find((item) => item.id === focusedFuvarId) || null;
  if (!focusedFuvar) {
    return null;
  }

  const matchedResource = context.resources.find(({ type, resource }) => {
    return isResourceAssignedToFuvar(resource, type, focusedFuvar)
      || (resource.timeline || []).some((block) => {
        return block?.type === "fuvar"
          && !block?.synthetic
          && block?.fuvarId === focusedFuvar.id;
      });
  });

  return matchedResource ? focusedFuvar : null;
}

function getLatestAnchorCandidateForResource(resource) {
  const fuvarBlocks = (resource?.timeline || [])
    .filter((block) => block?.type === "fuvar" && !block?.synthetic)
    .sort((left, right) => new Date(right.end || right.start) - new Date(left.end || left.start));

  const latestBlock = fuvarBlocks[0] || null;
  const linkedFuvar = latestBlock?.fuvarId
    ? FUVAROK.find((item) => item.id === latestBlock.fuvarId) || null
    : null;

  const anchorEndMs = Number.isFinite(new Date(latestBlock?.end || latestBlock?.start || "").getTime())
    ? new Date(latestBlock.end || latestBlock.start).getTime()
    : Number.NaN;

  return {
    anchorEndMs,
    anchorDropAddress: latestBlock?.lerakasCim
      || linkedFuvar?.lerakas?.cim
      || resource?.jelenlegi_pozicio?.hely
      || "",
    anchorFuvar: linkedFuvar,
    latestBlock
  };
}

function getRecommendationAnchorForContext(context) {
  const focusedFuvar = getFocusedFuvarForContext(context);
  if (focusedFuvar) {
    const focusedEndMs = new Date(focusedFuvar?.lerakas?.ido || "").getTime();
    return {
      anchorEndMs: Number.isFinite(focusedEndMs) ? focusedEndMs : Date.now(),
      anchorDropAddress: focusedFuvar?.lerakas?.cim || context?.primaryResource?.jelenlegi_pozicio?.hely || "",
      anchorFuvar: focusedFuvar,
      basedOnFocusedFuvar: true
    };
  }

  const candidates = (context?.resources || [])
    .map(({ resource }) => getLatestAnchorCandidateForResource(resource))
    .filter((item) => Number.isFinite(item.anchorEndMs));

  const bestCandidate = candidates.sort((left, right) => right.anchorEndMs - left.anchorEndMs)[0] || null;

  return {
    anchorEndMs: bestCandidate?.anchorEndMs || Date.now(),
    anchorDropAddress: bestCandidate?.anchorDropAddress || context?.primaryResource?.jelenlegi_pozicio?.hely || "",
    anchorFuvar: bestCandidate?.anchorFuvar || null,
    basedOnFocusedFuvar: false
  };
}

function estimateResourceTransitHours(anchorDropAddress, pickupAddress) {
  if (!anchorDropAddress || !pickupAddress) {
    return 3;
  }

  const roadKm = getRoadDistanceKm(anchorDropAddress, pickupAddress, { prime: true });
  if (!Number.isFinite(roadKm)) {
    return 3;
  }

  return Math.max(0.5, roadKm / 67);
}

function getSafeTimeMs(value) {
  const timeMs = new Date(value || "").getTime();
  return Number.isFinite(timeMs) ? timeMs : Number.NaN;
}

function getRecommendationFuvarCategory(fuvar) {
  return fuvar?.kategoria || fuvar?.viszonylat || "";
}

function isDomesticDriverContext(context) {
  return (context?.resources || []).some(({ type, resource }) => {
    return type === "sofor" && normalizeText(resource?.tipus || "").includes("belfold");
  });
}

function buildTransitionMetrics(fromAddress, fromEndMs, toAddress, toPickupMs) {
  const transitHours = estimateResourceTransitHours(fromAddress, toAddress);
  const arrivalMs = Number.isFinite(fromEndMs)
    ? fromEndMs + Math.round(transitHours * 3600 * 1000)
    : Number.NaN;
  const slackMs = Number.isFinite(toPickupMs) && Number.isFinite(arrivalMs)
    ? (toPickupMs - arrivalMs)
    : Number.NEGATIVE_INFINITY;
  const reachable = slackMs >= 0;
  const roadKm = getRoadDistanceKm(fromAddress, toAddress, { prime: true });
  const normalizedDistance = Number.isFinite(roadKm) ? roadKm : 450;
  const waitHours = reachable ? (slackMs / (1000 * 60 * 60)) : 0;
  const missingHours = reachable ? 0 : (Math.abs(slackMs) / (1000 * 60 * 60));

  return {
    reachable,
    pickupMs: Number.isFinite(toPickupMs) ? toPickupMs : Number.POSITIVE_INFINITY,
    score: normalizedDistance + (waitHours * 6) + (missingHours * 95)
  };
}

function getFocusedFuvarRecommendationMeta(anchorFuvar, candidateFuvar, context) {
  if (!anchorFuvar || !candidateFuvar) {
    return null;
  }

  if (anchorFuvar.id === candidateFuvar.id) {
    return {
      score: Number.POSITIVE_INFINITY,
      reachable: false,
      pickupMs: Number.POSITIVE_INFINITY,
      selfReference: true
    };
  }

  const anchorPickupMs = getSafeTimeMs(anchorFuvar?.felrakas?.ido);
  const anchorDropoffMs = getSafeTimeMs(anchorFuvar?.lerakas?.ido);
  const candidatePickupMs = getSafeTimeMs(candidateFuvar?.felrakas?.ido);
  const candidateDropoffMs = getSafeTimeMs(candidateFuvar?.lerakas?.ido);

  const forwardMetrics = buildTransitionMetrics(
    anchorFuvar?.lerakas?.cim || "",
    anchorDropoffMs,
    candidateFuvar?.felrakas?.cim || "",
    candidatePickupMs
  );
  const reverseMetrics = buildTransitionMetrics(
    candidateFuvar?.lerakas?.cim || "",
    candidateDropoffMs,
    anchorFuvar?.felrakas?.cim || "",
    anchorPickupMs
  );

  const anchorRole = getDomesticTransitRoleInfo(anchorFuvar)?.role || null;
  const candidateRole = getDomesticTransitRoleInfo(candidateFuvar)?.role || null;
  const shouldPreferForward = anchorRole === "utofutas" && candidateRole === "elofutas";
  const shouldPreferReverse = anchorRole === "elofutas" && candidateRole === "utofutas";

  let selectedMetrics = null;
  if (shouldPreferForward) {
    selectedMetrics = forwardMetrics;
  } else if (shouldPreferReverse) {
    selectedMetrics = reverseMetrics;
  } else if (Number.isFinite(candidatePickupMs) && Number.isFinite(anchorDropoffMs) && candidatePickupMs >= anchorDropoffMs) {
    selectedMetrics = forwardMetrics;
  } else if (Number.isFinite(candidateDropoffMs) && Number.isFinite(anchorPickupMs) && candidateDropoffMs <= anchorPickupMs) {
    selectedMetrics = reverseMetrics;
  } else {
    selectedMetrics = forwardMetrics.score <= reverseMetrics.score ? forwardMetrics : reverseMetrics;
  }

  let rolePenalty = 0;
  if (isDomesticDriverContext(context) && getRecommendationFuvarCategory(anchorFuvar) === "belfold") {
    if (shouldPreferForward || shouldPreferReverse) {
      rolePenalty = -320;
    } else if (anchorRole === "utofutas" && candidateRole === "utofutas") {
      rolePenalty = 680;
    } else if (anchorRole === "elofutas" && candidateRole === "elofutas") {
      rolePenalty = 680;
    } else if (anchorRole === "utofutas") {
      rolePenalty = candidateRole ? 220 : 320;
    } else if (anchorRole === "elofutas") {
      rolePenalty = candidateRole ? 220 : 320;
    } else if (candidateRole) {
      rolePenalty = 120;
    } else if (getRecommendationFuvarCategory(candidateFuvar) !== "belfold") {
      rolePenalty = 220;
    } else {
      rolePenalty = 110;
    }
  }

  return {
    score: selectedMetrics.score + rolePenalty,
    reachable: selectedMetrics.reachable,
    pickupMs: selectedMetrics.pickupMs,
    selfReference: false
  };
}

function getAggregateMatchForFuvar(context, fuvar, matchMaps) {
  const resourceMatches = (context?.resources || []).map(({ type, resource }, index) => {
    const result = matchMaps[index]?.get(fuvar.id) || null;
    return { type, resource, result };
  });

  const suitable = resourceMatches.every(({ result }) => result?.suitable !== false);
  let grade = "ok";
  let penalty = 0;

  resourceMatches.forEach(({ result }, index) => {
    if (!result) {
      return;
    }

    if (result.grade === "bad") {
      grade = "bad";
    } else if (grade !== "bad" && result.grade === "warn") {
      grade = "warn";
    }

    const gradePenalty = result.grade === "warn" ? 24 : result.grade === "bad" ? 80 : 0;
    const mismatchPenalty = result.suitable ? 0 : 260;
    penalty += index === 0 ? (gradePenalty + mismatchPenalty) : Math.round((gradePenalty + mismatchPenalty) * 0.8);
  });

  return {
    suitable,
    grade,
    penalty
  };
}

function buildResourceRecommendationOrderMap(resourceScope, fuvarList) {
  const context = getRecommendationResourceContext(resourceScope);
  if (!context || !resourceScope?.type || !Array.isArray(fuvarList) || fuvarList.length === 0) {
    return null;
  }

  const matchMaps = context.resources.map(({ type, resource }) => {
    const matches = evaluateFuvarokForResource(resource, fuvarList, type);
    return new Map(matches.map((entry) => [entry.fuvarId, entry.result || null]));
  });
  const anchor = getRecommendationAnchorForContext(context);
  const orderMap = new Map();

  fuvarList.forEach((fuvar) => {
    const aggregateMatch = getAggregateMatchForFuvar(context, fuvar, matchMaps);
    const pickupMs = new Date(fuvar?.felrakas?.ido || "").getTime();
    const focusedMeta = anchor.anchorFuvar && anchor.basedOnFocusedFuvar
      ? getFocusedFuvarRecommendationMeta(anchor.anchorFuvar, fuvar, context)
      : null;
    const transitHours = estimateResourceTransitHours(anchor.anchorDropAddress, fuvar?.felrakas?.cim || "");
    const arrivalMs = anchor.anchorEndMs + Math.round(transitHours * 3600 * 1000);
    const slackMs = Number.isFinite(pickupMs) ? (pickupMs - arrivalMs) : Number.NEGATIVE_INFINITY;
    const reachable = focusedMeta ? focusedMeta.reachable : slackMs >= 0;
    const actionable = !hasFullAssignment(fuvar);
    const roadKm = getRoadDistanceKm(anchor.anchorDropAddress, fuvar?.felrakas?.cim || "", { prime: true });
    const normalizedDistance = Number.isFinite(roadKm) ? roadKm : 450;
    const waitHours = reachable ? (slackMs / (1000 * 60 * 60)) : 0;
    const missingHours = reachable ? 0 : (Math.abs(slackMs) / (1000 * 60 * 60));
    const assignedPenalty = actionable ? 0 : 120;

    const fallbackScore = normalizedDistance
      + (waitHours * 6)
      + (missingHours * 95)
      + assignedPenalty;
    const score = (focusedMeta?.score ?? fallbackScore)
      + aggregateMatch.penalty
      + assignedPenalty;

    orderMap.set(fuvar.id, {
      score,
      suitable: aggregateMatch.suitable,
      reachable,
      actionable,
      pickupMs: Number.isFinite(focusedMeta?.pickupMs) ? focusedMeta.pickupMs : Number.isFinite(pickupMs) ? pickupMs : Number.POSITIVE_INFINITY,
      selfReference: Boolean(focusedMeta?.selfReference)
    });
  });

  return orderMap;
}

function compareByResourceRecommendation(leftFuvar, rightFuvar, orderMap) {
  const left = orderMap?.get(leftFuvar.id) || null;
  const right = orderMap?.get(rightFuvar.id) || null;

  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  if (left.selfReference !== right.selfReference) {
    return left.selfReference ? 1 : -1;
  }

  if (left.suitable !== right.suitable) {
    return left.suitable ? -1 : 1;
  }

  if (left.reachable !== right.reachable) {
    return left.reachable ? -1 : 1;
  }

  if (left.actionable !== right.actionable) {
    return left.actionable ? -1 : 1;
  }

  if (left.score !== right.score) {
    return left.score - right.score;
  }

  return left.pickupMs - right.pickupMs;
}

function renderAssemblyDistanceTag(fuvar, assemblyDropoffAddress) {
  if (!focusedAssemblyId || !assemblyDropoffAddress || !fuvar?.felrakas?.cim) {
    return "";
  }

  const roadDistanceKm = getSelectedAssemblyDistanceKm(fuvar, assemblyDropoffAddress);
  if (!Number.isFinite(roadDistanceKm)) {
    return "";
  }

  return `<span class="fuvar-tag fuvar-card-tag fuvar-assembly-distance-tag" title="Távolság a kijelölt szerelvény lerakójától">${Math.round(roadDistanceKm)} km</span>`;
}

function getQuickFilterPreviewState(filterState, key) {
  const preview = normalizeFuvarFilterState(filterState);

  if (key === "ready" || key === "planning") {
    preview.assignment = key;
    return preview;
  }

  if (key.startsWith("day-offset-")) {
    const rawOffset = Number.parseInt(key.slice("day-offset-".length), 10);
    preview.dayOffset = Number.isInteger(rawOffset) ? rawOffset : null;
    return preview;
  }

  preview[key] = true;
  return preview;
}

function getWeekStartDate(referenceDate, weekOffset = 0) {
  const base = getDayReferenceBase(referenceDate);
  const weekStart = new Date(base);
  const dayOfWeek = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dayOfWeek + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function buildWeekDayOffsets(referenceDate, weekOffset = 0) {
  const weekStart = getWeekStartDate(referenceDate, weekOffset);
  const base = getDayReferenceBase(referenceDate);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);
    current.setHours(0, 0, 0, 0);

    const label = current.toLocaleDateString("hu-HU", {
      month: "2-digit",
      day: "2-digit"
    }).replace(/\/$/, "");

    const offset = Math.round((current.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
    return { label, offset };
  });
}

function formatWeekRangeLabel(referenceDate, weekOffset = 0) {
  const weekDays = buildWeekDayOffsets(referenceDate, weekOffset);
  if (weekDays.length !== 7) {
    return "";
  }

  return `${weekDays[0].label} - ${weekDays[6].label}`;
}

function getQuickFilterPreviewCount(filterState, key, options = {}) {
  const previewState = getQuickFilterPreviewState(filterState, key);
  const timelineReferenceDate = options.timelineReferenceDate;

  return FUVAROK.filter((fuvar) => {
    evaluateFuvarTags(fuvar);
    return matchesUnifiedFuvarFilter(fuvar, previewState, { timelineReferenceDate });
  }).length;
}

function getQuickFilterColorMeta(key) {
  if (key === "adr") {
    return getCategoryPalette("adr");
  }

  if (key === "surgos") {
    return getCategoryPalette("surgos");
  }

  if (key === "kezes2") {
    return {
      accent: "#b39ddb",
      text: "#f3e5ff",
      badgeText: "#1a0a2e",
      softBg: "rgba(179, 157, 219, 0.16)",
      softBgStrong: "rgba(179, 157, 219, 0.26)",
      border: "rgba(179, 157, 219, 0.44)",
      borderStrong: "rgba(179, 157, 219, 0.65)",
      glow: "rgba(179, 157, 219, 0.2)"
    };
  }

  if (key === "spediccio") {
    return getCategoryPalette("spediccio");
  }

  if (key === "ready") {
    return {
      accent: "#5cc98d",
      text: "#dffff0",
      badgeText: "#0f2a1d",
      softBg: "rgba(92, 201, 141, 0.18)",
      softBgStrong: "rgba(92, 201, 141, 0.24)",
      border: "rgba(92, 201, 141, 0.45)",
      borderStrong: "rgba(92, 201, 141, 0.62)",
      glow: "rgba(92, 201, 141, 0.22)"
    };
  }

  if (key === "planning") {
    return {
      accent: "#ffc107",
      text: "#fff4c7",
      badgeText: "#332300",
      softBg: "rgba(255, 193, 7, 0.16)",
      softBgStrong: "rgba(255, 193, 7, 0.24)",
      border: "rgba(255, 193, 7, 0.44)",
      borderStrong: "rgba(255, 193, 7, 0.62)",
      glow: "rgba(255, 193, 7, 0.2)"
    };
  }

  if (key === "elapsed") {
    return {
      accent: "#ef5350",
      text: "#fff0f0",
      badgeText: "#2d0f10",
      softBg: "rgba(239, 83, 80, 0.16)",
      softBgStrong: "rgba(239, 83, 80, 0.22)",
      border: "rgba(239, 83, 80, 0.44)",
      borderStrong: "rgba(239, 83, 80, 0.62)",
      glow: "rgba(239, 83, 80, 0.2)"
    };
  }

  return {
    accent: "#4fc3f7",
    text: "#ebf8ff",
    badgeText: "#0d1b23",
    softBg: "rgba(79, 195, 247, 0.16)",
    softBgStrong: "rgba(79, 195, 247, 0.22)",
    border: "rgba(79, 195, 247, 0.4)",
    borderStrong: "rgba(79, 195, 247, 0.62)",
    glow: "rgba(79, 195, 247, 0.2)"
  };
}

function syncUnifiedFilterControls(container, filterState, options = {}) {
  const categorySelect = container.querySelector('[data-filter-role="category"]');
  const assignmentSelect = container.querySelector('[data-filter-role="assignment"]');
  const queryInput = container.querySelector('[data-filter-role="query"]');
  const timelineReferenceDate = options.timelineReferenceDate;
  const weekOffset = Number.isInteger(options.weekOffset) ? options.weekOffset : 0;

  if (categorySelect) categorySelect.value = filterState.category;
  if (assignmentSelect) assignmentSelect.value = filterState.assignment;
  if (queryInput) queryInput.value = filterState.query;

  const weekLabelNode = container.querySelector("[data-filter-week-label]");
  if (weekLabelNode) {
    weekLabelNode.textContent = formatWeekRangeLabel(timelineReferenceDate, weekOffset);
  }

  container.querySelectorAll(".fuvar-filter-toggle").forEach((node) => {
    const key = node.dataset.toggle;
    const colorMeta = getQuickFilterColorMeta(key);
    if (key === "ready" || key === "planning") {
      node.classList.toggle("active", filterState.assignment === key);
    } else if (key.startsWith("day-offset-")) {
      const targetOffset = Number.parseInt(key.slice("day-offset-".length), 10);
      node.classList.toggle("active", Number.isInteger(targetOffset) && filterState.dayOffset === targetOffset);
    } else {
      node.classList.toggle("active", Boolean(filterState[key]));
    }

    node.style.setProperty("--filter-accent", colorMeta.accent);
    node.style.setProperty("--filter-bg", colorMeta.softBg);
    node.style.setProperty("--filter-bg-active", colorMeta.softBgStrong);
    node.style.setProperty("--filter-border", colorMeta.border);
    node.style.setProperty("--filter-border-strong", colorMeta.borderStrong);
    node.style.setProperty("--filter-text", colorMeta.text);
    node.style.setProperty("--filter-glow", colorMeta.glow);

    const countNode = node.querySelector("[data-filter-count]");
    if (countNode) {
      const count = getQuickFilterPreviewCount(filterState, key, {
        timelineReferenceDate
      });
      countNode.textContent = String(count);
      countNode.style.setProperty("--filter-count-bg", colorMeta.accent);
      countNode.style.setProperty("--filter-count-text", colorMeta.badgeText);
      countNode.style.setProperty("--filter-count-ring", colorMeta.borderStrong);
    }
  });
}

function getDraggedFuvarIdFromEvent(event) {
  const transfer = event.dataTransfer;
  if (transfer) {
    const fromTransfer = transfer.getData("application/x-transit-fuvar-id") || transfer.getData("text/plain");
    if (fromTransfer) {
      return fromTransfer;
    }
  }

  // Egyes böngészők dragover alatt nem adják vissza a payloadot;
  // ilyenkor a ténylegesen húzott kártyáról olvassuk ki az ID-t.
  const draggingCard = document.querySelector(".menu-card.dragging");
  return draggingCard?.dataset?.id || "";
}

function closeSpedicioModal(overlay, onKeyDown) {
  if (onKeyDown) {
    document.removeEventListener("keydown", onKeyDown);
  }

  if (overlay?.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openSpedicioPartnerPicker(initialPartner = "") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "spediccio-modal-overlay";
    overlay.innerHTML = `
      <div class="spediccio-modal spediccio-partner-modal" role="dialog" aria-modal="true" aria-label="Spedíciós partner választása">
        <div class="spediccio-modal-header">
          <h3>Partner kiválasztása</h3>
          <button type="button" class="spediccio-modal-close" aria-label="Bezárás">✕</button>
        </div>
        <input class="spediccio-modal-search" type="search" placeholder="Keresés partner névre..." />
        <div class="spediccio-partner-list" role="listbox" aria-label="Partnerek"></div>
        <div class="spediccio-modal-actions">
          <button type="button" class="btn spediccio-cancel-btn">Mégse</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const dialog = overlay.querySelector(".spediccio-modal");
    const closeBtn = overlay.querySelector(".spediccio-modal-close");
    const cancelBtn = overlay.querySelector(".spediccio-cancel-btn");
    const searchInput = overlay.querySelector(".spediccio-modal-search");
    const list = overlay.querySelector(".spediccio-partner-list");

    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      closeSpedicioModal(overlay, onKeyDown);
      resolve(value);
    };

    const renderPartnerList = () => {
      const term = normalizeText(searchInput.value);
      const filtered = SPEDICIO_PARTNERS.filter((partner) => {
        return normalizeText(partner).includes(term);
      });

      if (filtered.length === 0) {
        list.innerHTML = '<div class="spediccio-empty">Nincs találat.</div>';
        return;
      }

      list.innerHTML = filtered.map((partner) => {
        const selectedClass = partner === initialPartner ? "selected" : "";
        return `<button type="button" class="spediccio-partner-item ${selectedClass}" data-partner="${partner.replace(/"/g, "&quot;")}">${partner}</button>`;
      }).join("");

      list.querySelectorAll(".spediccio-partner-item").forEach((button) => {
        button.addEventListener("click", () => {
          finish(button.dataset.partner || button.textContent.trim());
        });
      });
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(null);
      }
    });

    closeBtn.addEventListener("click", () => finish(null));
    cancelBtn.addEventListener("click", () => finish(null));
    searchInput.addEventListener("input", renderPartnerList);

    dialog.addEventListener("click", (event) => event.stopPropagation());
    document.addEventListener("keydown", onKeyDown);

    renderPartnerList();
    searchInput.focus();
  });
}

function buildFuvarDetailsFieldRows(fuvar, context) {
  return FUVAR_CARD_COLUMN_OPTIONS.map((option) => {
    const value = option.excelLabel
      ? getExcelFieldValue(fuvar, option.excelLabel, context)
      : getBaseColumnDisplayValue(fuvar, option.id, context);

    return `
      <div class="fuvar-details-row">
        <div class="fuvar-details-label">${escapeHtml(option.label)}</div>
        <div class="fuvar-details-value">${escapeHtml(value)}</div>
      </div>
    `;
  }).join("");
}

function openFuvarDetailsModal(fuvar, context) {
  const overlay = document.createElement("div");
  overlay.className = "spediccio-modal-overlay fuvar-details-overlay";

  const tagsHtml = getFuvarTags(fuvar)
    .map((tag) => renderTag(tag, "fuvar-card-tag"))
    .join("");

  overlay.innerHTML = `
    <div class="spediccio-modal fuvar-details-modal" role="dialog" aria-modal="true" aria-label="Fuvar adatlap">
      <div class="spediccio-modal-header fuvar-details-header">
        <div>
          <h3>${escapeHtml(fuvar.megnevezes || fuvar.id || "Fuvar adatlap")}</h3>
          <div class="spediccio-modal-subtitle">${escapeHtml(fuvar.id || "-")}</div>
        </div>
        <button type="button" class="spediccio-modal-close" aria-label="Bezárás">✕</button>
      </div>
      <div class="fuvar-details-summary">
        <div class="fuvar-tag-list fuvar-details-tag-list">${tagsHtml || '<span class="fuvar-details-empty">Nincs badge.</span>'}</div>
      </div>
      <div class="fuvar-details-grid">
        ${buildFuvarDetailsFieldRows(fuvar, context)}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const dialog = overlay.querySelector(".fuvar-details-modal");
  const closeBtn = overlay.querySelector(".spediccio-modal-close");

  const finish = () => {
    closeSpedicioModal(overlay, onKeyDown);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      finish();
    }
  });

  dialog.addEventListener("click", (event) => event.stopPropagation());
  closeBtn.addEventListener("click", finish);
  document.addEventListener("keydown", onKeyDown);
}

export function openSpedicioOrderFormModal(fuvar) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "spediccio-modal-overlay";

    overlay.innerHTML = `
      <div class="spediccio-modal spediccio-form-modal" role="dialog" aria-modal="true" aria-label="Partnerhez rendelés űrlap">
        <div class="spediccio-modal-header">
          <h3>Partnerhez rendelés • ${fuvar.megnevezes}</h3>
          <button type="button" class="spediccio-modal-close" aria-label="Bezárás">✕</button>
        </div>

        <div class="spediccio-status-grid">
          <div class="spediccio-status ok">✔ OTD</div>
          <div class="spediccio-status bad">✖ CMR</div>
          <div class="spediccio-status bad">✖ SZÁMLA</div>
        </div>

        <form class="spediccio-form-grid">
          <label>
            <span>Megrendelés kód</span>
            <input name="orderCode" type="text" value="" />
          </label>

          <label>
            <span>Spedíciós partner</span>
            <input name="partnerName" type="text" value="" />
          </label>

          <label class="spediccio-price-row">
            <span>Megrendelés ár és pénznem</span>
            <div>
              <input name="orderPrice" type="text" placeholder="Összeg" value="" />
              <select name="currency">
                <option value="" selected>---</option>
                <option value="HUF">HUF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </label>

          <label>
            <span>Partner ajánlat szám</span>
            <input name="partnerOfferNo" type="text" value="" />
          </label>

          <label>
            <span>Gépjárművezető 1</span>
            <input name="driver1" type="text" value="" />
          </label>

          <label>
            <span>Gépjárművezető 2</span>
            <input name="driver2" type="text" value="" />
          </label>

          <label>
            <span>Vontató rendszám</span>
            <input name="tractorPlate" type="text" value="" />
          </label>

          <label>
            <span>Pót rendszám</span>
            <input name="trailerPlate" type="text" value="" />
          </label>

          <label>
            <span>Fuvarszervező</span>
            <input name="dispatcher" type="text" value="" />
          </label>

          <label>
            <span>Partner kapcsolattartó</span>
            <input name="partnerContact" type="text" value="" />
          </label>

          <label>
            <span>Visszaigazolás dátuma</span>
            <input name="confirmDate" type="date" value="" />
          </label>

          <label>
            <span>Várható teljesítés dátuma</span>
            <input name="etaDate" type="date" value="" />
          </label>

          <label class="full-width">
            <span>Pénzügyi konfiguráció</span>
            <input name="financeConfig" type="text" value="" placeholder="Válasszon ki egy pénzügyi konfigurációt..." />
          </label>

          <div class="spediccio-modal-actions full-width">
            <button type="button" class="btn spediccio-cancel-btn">Mégse</button>
            <button type="submit" class="btn spediccio-save-btn">Mentés</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const dialog = overlay.querySelector(".spediccio-modal");
    const closeBtn = overlay.querySelector(".spediccio-modal-close");
    const cancelBtn = overlay.querySelector(".spediccio-cancel-btn");
    const form = overlay.querySelector(".spediccio-form-grid");

    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      closeSpedicioModal(overlay, onKeyDown);
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(form).entries());
      finish(formData);
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(null);
      }
    });

    dialog.addEventListener("click", (event) => event.stopPropagation());
    closeBtn.addEventListener("click", () => finish(null));
    cancelBtn.addEventListener("click", () => finish(null));

    document.addEventListener("keydown", onKeyDown);
  });
}

function renderTag(tag, extraClass = "") {
  const meta = getFuvarTagMeta(tag);
  const className = ["fuvar-tag", extraClass].filter(Boolean).join(" ");

  if (tag === "spediccio") {
    return `
      <span
        class="${className} fuvar-tag-removable"
        style="--tag-bg:${meta.color};--tag-text:${meta.textColor};"
        data-tag="${tag}"
      >
        <span class="fuvar-tag-text">${meta.label}</span>
        <button
          type="button"
          class="fuvar-tag-remove"
          data-action="remove-spediccio"
          aria-label="Spedíció jelölés törlése"
          title="Spedíció jelölés törlése"
        >x</button>
      </span>
    `;
  }

  return `
    <span
      class="${className}"
      style="--tag-bg:${meta.color};--tag-text:${meta.textColor};"
      data-tag="${tag}"
    >
      ${meta.label}
    </span>
  `;
}

function getFuvarTags(fuvar) {
  const tags = [];

  if (fuvar.adr) {
    tags.push("adr");
  }

  if (fuvar.surgos) {
    tags.push("surgos");
  }

  if (fuvar.kategoria) {
    tags.push(fuvar.kategoria);
  }

  const transitRoleInfo = getDomesticTransitRoleInfo(fuvar);
  if (transitRoleInfo?.role) {
    tags.push(transitRoleInfo.role);
  }

  if (fuvar.onlyTwoKezesRequired) {
    tags.push("twoKezesOnly");
  }

  return tags;
}

function clearSpedicioAssignment(fuvar) {
  fuvar.spediccio = false;
  delete fuvar.spediccioPartner;
  delete fuvar.spediccioForm;
  delete fuvar.spediccioOperationType;
}

function clearFuvarResourceAssignment(fuvar) {
  delete fuvar.assignedSoforId;
  delete fuvar.assignedSecondarySoforId;
  delete fuvar.assignedVontatoId;
  delete fuvar.assignedPotkocsiId;

  [SOFOROK, VONTATOK, POTKOCSIK].forEach((list) => {
    list.forEach((resource) => {
      if (!resource.timeline) {
        return;
      }

      resource.timeline = resource.timeline.filter((block) => {
        return !(block.type === "fuvar" && !block.synthetic && block.fuvarId === fuvar.id);
      });
    });
  });

  SOFOROK.forEach((sofor) => {
    refreshAutoTransitBlocksForResource(sofor, FUVAROK);
  });

  VONTATOK.forEach((vontato) => {
    refreshAutoTransitBlocksForResource(vontato, FUVAROK);
  });

  POTKOCSIK.forEach((potkocsi) => {
    refreshAutoTransitBlocksForResource(potkocsi, FUVAROK);
  });

  refreshAutoDriverStatesForLinkedConvoys(SOFOROK, VONTATOK, POTKOCSIK);
}

function getDomesticImportLinkOptions(fuvar) {
  const fuvarStartMs = new Date(fuvar?.felrakas?.ido || "").getTime();

  return FUVAROK
    .filter((candidate) => candidate?.id !== fuvar?.id)
    .filter((candidate) => (candidate?.kategoria || candidate?.viszonylat) === "import")
    .filter((candidate) => {
      if (!candidate?.lerakas?.cim || !isHungaryAddress(candidate.lerakas.cim)) {
        return false;
      }

      const candidateEndMs = new Date(candidate?.lerakas?.ido || "").getTime();
      if (!Number.isFinite(candidateEndMs) || !Number.isFinite(fuvarStartMs)) {
        return true;
      }

      return candidateEndMs <= fuvarStartMs;
    })
    .sort((left, right) => new Date(right.lerakas.ido) - new Date(left.lerakas.ido));
}

function renderDomesticUtofutasControl(fuvar) {
  if ((fuvar?.kategoria || fuvar?.viszonylat) !== "belfold") {
    return "";
  }

  const options = getDomesticImportLinkOptions(fuvar);
  const selectedImportId = fuvar.utofutasImportFuvarId || fuvar.kapcsoltImportFuvarId || "";

  const optionHtml = options.map((candidate) => {
    const selected = candidate.id === selectedImportId ? "selected" : "";
    const endLabel = candidate?.lerakas?.ido
      ? new Date(candidate.lerakas.ido).toLocaleString("hu-HU", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
      : "-";

    return `<option value="${candidate.id}" ${selected}>[${candidate.id}] ${candidate.megnevezes} • lerakás: ${endLabel}</option>`;
  }).join("");

  return `
    <div class="fuvar-utofutas-link-row">
      <label class="fuvar-utofutas-link-label" for="utofutas-link-${fuvar.id}">Utófutás import forrás</label>
      <select
        id="utofutas-link-${fuvar.id}"
        class="fuvar-utofutas-link-select"
        data-action="set-utofutas-import-link"
        data-fuvar-id="${fuvar.id}"
      >
        <option value="">Nincs (belföldi önálló fuvar)</option>
        ${optionHtml}
      </select>
    </div>
  `;
}

function getFuvarCategory(fuvar) {
  return fuvar?.kategoria || fuvar?.viszonylat || "";
}

function getLinkedExportFromDomestic(domesticFuvar) {
  const linkedExportId = domesticFuvar?.elofutasExportFuvarId || domesticFuvar?.kapcsoltExportFuvarId || "";
  if (!linkedExportId) {
    return null;
  }

  return FUVAROK.find((candidate) => candidate.id === linkedExportId) || null;
}

function getLinkedImportFromDomestic(domesticFuvar) {
  const linkedImportId = domesticFuvar?.utofutasImportFuvarId || domesticFuvar?.kapcsoltImportFuvarId || "";
  if (!linkedImportId) {
    return null;
  }

  return FUVAROK.find((candidate) => candidate.id === linkedImportId) || null;
}

function addMinutesToIso(isoValue, minutes) {
  const baseTime = new Date(isoValue).getTime();
  if (!Number.isFinite(baseTime)) {
    return isoValue;
  }

  return new Date(baseTime + minutes * 60 * 1000).toISOString().slice(0, 16);
}

function getFuvarDurationMinutes(fuvar) {
  const startTime = new Date(fuvar?.felrakas?.ido || "").getTime();
  const endTime = new Date(fuvar?.lerakas?.ido || "").getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return 40;
  }

  return Math.max(15, Math.round((endTime - startTime) / 60000));
}

function hasDomesticTransitLink(domesticFuvar) {
  return Boolean(
    domesticFuvar?.elofutasExportFuvarId
    || domesticFuvar?.kapcsoltExportFuvarId
    || domesticFuvar?.utofutasImportFuvarId
    || domesticFuvar?.kapcsoltImportFuvarId
  );
}

function rememberDomesticSchedule(domesticFuvar) {
  if (domesticFuvar?.transitOriginalSchedule) {
    return;
  }

  domesticFuvar.transitOriginalSchedule = {
    felrakasIdo: domesticFuvar?.felrakas?.ido || "",
    lerakasIdo: domesticFuvar?.lerakas?.ido || ""
  };
}

function restoreDomesticSchedule(domesticFuvar) {
  if (!domesticFuvar?.transitOriginalSchedule || hasDomesticTransitLink(domesticFuvar)) {
    return;
  }

  if (domesticFuvar.felrakas && domesticFuvar.transitOriginalSchedule.felrakasIdo) {
    domesticFuvar.felrakas.ido = domesticFuvar.transitOriginalSchedule.felrakasIdo;
  }

  if (domesticFuvar.lerakas && domesticFuvar.transitOriginalSchedule.lerakasIdo) {
    domesticFuvar.lerakas.ido = domesticFuvar.transitOriginalSchedule.lerakasIdo;
  }

  delete domesticFuvar.transitOriginalSchedule;
}

function syncDomesticScheduleWithExport(domesticFuvar, exportFuvar) {
  if (!domesticFuvar?.felrakas || !domesticFuvar?.lerakas || !exportFuvar?.felrakas?.ido) {
    return;
  }

  rememberDomesticSchedule(domesticFuvar);
  const durationMinutes = getFuvarDurationMinutes(domesticFuvar);
  domesticFuvar.lerakas.ido = exportFuvar.felrakas.ido;
  domesticFuvar.felrakas.ido = addMinutesToIso(exportFuvar.felrakas.ido, -durationMinutes);
}

function syncDomesticScheduleWithImport(domesticFuvar, importFuvar) {
  if (!domesticFuvar?.felrakas || !domesticFuvar?.lerakas || !importFuvar?.lerakas?.ido) {
    return;
  }

  rememberDomesticSchedule(domesticFuvar);
  const durationMinutes = getFuvarDurationMinutes(domesticFuvar);
  domesticFuvar.felrakas.ido = importFuvar.lerakas.ido;
  domesticFuvar.lerakas.ido = addMinutesToIso(importFuvar.lerakas.ido, durationMinutes);
}

function clearDomesticExportLink(domesticFuvar) {
  const linkedExport = getLinkedExportFromDomestic(domesticFuvar);
  if (linkedExport && linkedExport.elofutasBelfoldFuvarId === domesticFuvar.id) {
    delete linkedExport.elofutasBelfoldFuvarId;
  }

  FUVAROK.forEach((candidate) => {
    if (getFuvarCategory(candidate) === "export" && candidate.elofutasBelfoldFuvarId === domesticFuvar.id) {
      delete candidate.elofutasBelfoldFuvarId;
    }
  });

  delete domesticFuvar.elofutasExportFuvarId;
  delete domesticFuvar.kapcsoltExportFuvarId;
  restoreDomesticSchedule(domesticFuvar);
}

function clearDomesticImportLink(domesticFuvar) {
  const linkedImport = getLinkedImportFromDomestic(domesticFuvar);
  if (linkedImport && linkedImport.utofutasBelfoldFuvarId === domesticFuvar.id) {
    delete linkedImport.utofutasBelfoldFuvarId;
  }

  FUVAROK.forEach((candidate) => {
    if (getFuvarCategory(candidate) === "import" && candidate.utofutasBelfoldFuvarId === domesticFuvar.id) {
      delete candidate.utofutasBelfoldFuvarId;
    }
  });

  delete domesticFuvar.utofutasImportFuvarId;
  delete domesticFuvar.kapcsoltImportFuvarId;
  restoreDomesticSchedule(domesticFuvar);
}

function clearExportDomesticLink(exportFuvar) {
  const linkedDomesticId = exportFuvar?.elofutasBelfoldFuvarId || "";
  if (!linkedDomesticId) {
    return;
  }

  const linkedDomestic = FUVAROK.find((candidate) => candidate.id === linkedDomesticId);
  if (linkedDomestic && linkedDomestic.elofutasExportFuvarId === exportFuvar.id) {
    delete linkedDomestic.elofutasExportFuvarId;
    delete linkedDomestic.kapcsoltExportFuvarId;
    restoreDomesticSchedule(linkedDomestic);
  }

  delete exportFuvar.elofutasBelfoldFuvarId;
}

function clearImportDomesticLink(importFuvar) {
  const linkedDomesticId = importFuvar?.utofutasBelfoldFuvarId || "";
  if (!linkedDomesticId) {
    return;
  }

  const linkedDomestic = FUVAROK.find((candidate) => candidate.id === linkedDomesticId);
  if (linkedDomestic && linkedDomestic.utofutasImportFuvarId === importFuvar.id) {
    delete linkedDomestic.utofutasImportFuvarId;
    delete linkedDomestic.kapcsoltImportFuvarId;
    restoreDomesticSchedule(linkedDomestic);
  }

  delete importFuvar.utofutasBelfoldFuvarId;
}

function setExportDomesticLink(exportFuvar, domesticFuvarId) {
  clearExportDomesticLink(exportFuvar);

  if (!domesticFuvarId) {
    return;
  }

  const domesticFuvar = FUVAROK.find((candidate) => candidate.id === domesticFuvarId);
  if (!domesticFuvar || getFuvarCategory(domesticFuvar) !== "belfold") {
    return;
  }

  clearDomesticExportLink(domesticFuvar);
  exportFuvar.elofutasBelfoldFuvarId = domesticFuvar.id;
  domesticFuvar.elofutasExportFuvarId = exportFuvar.id;
  syncDomesticScheduleWithExport(domesticFuvar, exportFuvar);
}

function setImportDomesticLink(importFuvar, domesticFuvarId) {
  clearImportDomesticLink(importFuvar);

  if (!domesticFuvarId) {
    return;
  }

  const domesticFuvar = FUVAROK.find((candidate) => candidate.id === domesticFuvarId);
  if (!domesticFuvar || getFuvarCategory(domesticFuvar) !== "belfold") {
    return;
  }

  clearDomesticImportLink(domesticFuvar);
  importFuvar.utofutasBelfoldFuvarId = domesticFuvar.id;
  domesticFuvar.utofutasImportFuvarId = importFuvar.id;
  syncDomesticScheduleWithImport(domesticFuvar, importFuvar);
}

function getDomesticExportOptions(domesticFuvar) {
  const domesticEndMs = new Date(domesticFuvar?.lerakas?.ido || "").getTime();

  return FUVAROK
    .filter((candidate) => candidate?.id !== domesticFuvar?.id)
    .filter((candidate) => getFuvarCategory(candidate) === "export")
    .filter((candidate) => {
      const exportStartMs = new Date(candidate?.felrakas?.ido || "").getTime();
      if (!Number.isFinite(domesticEndMs) || !Number.isFinite(exportStartMs)) {
        return true;
      }

      return domesticEndMs <= exportStartMs;
    })
    .sort((left, right) => new Date(left.felrakas?.ido || "").getTime() - new Date(right.felrakas?.ido || "").getTime());
}

function getDomesticImportOptions(domesticFuvar) {
  return getDomesticImportLinkOptions(domesticFuvar);
}

function getDomesticCandidatesForExport(exportFuvar) {
  const exportStartMs = new Date(exportFuvar?.felrakas?.ido || "").getTime();

  return FUVAROK
    .filter((candidate) => candidate?.id !== exportFuvar?.id)
    .filter((candidate) => getFuvarCategory(candidate) === "belfold")
    .filter((candidate) => {
      const domesticEndMs = new Date(candidate?.lerakas?.ido || "").getTime();
      if (!Number.isFinite(exportStartMs) || !Number.isFinite(domesticEndMs)) {
        return true;
      }

      return domesticEndMs <= exportStartMs;
    })
    .sort((left, right) => new Date(left.lerakas?.ido || "").getTime() - new Date(right.lerakas?.ido || "").getTime());
}

function getDomesticCandidatesForImport(importFuvar) {
  const importEndMs = new Date(importFuvar?.lerakas?.ido || "").getTime();

  return FUVAROK
    .filter((candidate) => candidate?.id !== importFuvar?.id)
    .filter((candidate) => getFuvarCategory(candidate) === "belfold")
    .filter((candidate) => {
      const domesticStartMs = new Date(candidate?.felrakas?.ido || "").getTime();
      if (!Number.isFinite(importEndMs) || !Number.isFinite(domesticStartMs)) {
        return true;
      }

      return domesticStartMs >= importEndMs;
    })
    .sort((left, right) => new Date(left.felrakas?.ido || "").getTime() - new Date(right.felrakas?.ido || "").getTime());
}

function formatTransitSelectOptions(optionList, selectedId, timeField = "felrakas") {
  return optionList.map((candidate) => {
    const selected = candidate.id === selectedId ? "selected" : "";
    const timeValue = candidate?.[timeField]?.ido || "";
    const timeLabel = timeValue
      ? new Date(timeValue).toLocaleString("hu-HU", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
      : "-";

    return `<option value="${escapeHtml(candidate.id)}" ${selected}>[${escapeHtml(candidate.id)}] ${escapeHtml(candidate.megnevezes)} • ${timeLabel}</option>`;
  }).join("");
}

function buildTransitLinkEditorFields(fuvar) {
  const category = getFuvarCategory(fuvar);

  if (category === "belfold") {
    const exportOptions = getDomesticExportOptions(fuvar);
    const importOptions = getDomesticImportOptions(fuvar);
    const selectedExportId = fuvar.elofutasExportFuvarId || fuvar.kapcsoltExportFuvarId || "";
    const selectedImportId = fuvar.utofutasImportFuvarId || fuvar.kapcsoltImportFuvarId || "";

    return `
      <label class="timeline-event-form-label">
        Előfutás kapcsolt export
        <select class="timeline-event-form-input" name="elofutasExportFuvarId">
          <option value="">Nincs kapcsolt export</option>
          ${formatTransitSelectOptions(exportOptions, selectedExportId, "felrakas")}
        </select>
      </label>
      <label class="timeline-event-form-label">
        Utófutás kapcsolt import
        <select class="timeline-event-form-input" name="utofutasImportFuvarId">
          <option value="">Nincs kapcsolt import</option>
          ${formatTransitSelectOptions(importOptions, selectedImportId, "lerakas")}
        </select>
      </label>
    `;
  }

  if (category === "export") {
    const domesticOptions = getDomesticCandidatesForExport(fuvar);
    const selectedDomesticId = fuvar.elofutasBelfoldFuvarId || "";

    return `
      <label class="timeline-event-form-label">
        Kapcsolt előfutás (belföld)
        <select class="timeline-event-form-input" name="elofutasBelfoldFuvarId">
          <option value="">Nincs kapcsolt belföld</option>
          ${formatTransitSelectOptions(domesticOptions, selectedDomesticId, "lerakas")}
        </select>
      </label>
    `;
  }

  if (category === "import") {
    const domesticOptions = getDomesticCandidatesForImport(fuvar);
    const selectedDomesticId = fuvar.utofutasBelfoldFuvarId || "";

    return `
      <label class="timeline-event-form-label">
        Kapcsolt utófutás (belföld)
        <select class="timeline-event-form-input" name="utofutasBelfoldFuvarId">
          <option value="">Nincs kapcsolt belföld</option>
          ${formatTransitSelectOptions(domesticOptions, selectedDomesticId, "felrakas")}
        </select>
      </label>
    `;
  }

  return "";
}

function applyTransitLinkEditorForm(fuvar, formData) {
  const category = getFuvarCategory(fuvar);

  if (category === "belfold") {
    clearDomesticExportLink(fuvar);
    clearDomesticImportLink(fuvar);

    if (formData.elofutasExportFuvarId) {
      const exportFuvar = FUVAROK.find((candidate) => candidate.id === formData.elofutasExportFuvarId);
      if (exportFuvar) {
        setExportDomesticLink(exportFuvar, fuvar.id);
      }
    }

    if (formData.utofutasImportFuvarId) {
      const importFuvar = FUVAROK.find((candidate) => candidate.id === formData.utofutasImportFuvarId);
      if (importFuvar) {
        setImportDomesticLink(importFuvar, fuvar.id);
      }
    }

    return;
  }

  if (category === "export") {
    setExportDomesticLink(fuvar, formData.elofutasBelfoldFuvarId || "");
    return;
  }

  if (category === "import") {
    setImportDomesticLink(fuvar, formData.utofutasBelfoldFuvarId || "");
  }
}

function shouldShowTransitLinkEditor(fuvar) {
  const category = getFuvarCategory(fuvar);
  return category === "belfold" || category === "export" || category === "import";
}

function openTransitLinkEditorModal(fuvar) {
  return new Promise((resolve) => {
    const fieldsHtml = buildTransitLinkEditorFields(fuvar);
    if (!fieldsHtml) {
      resolve(false);
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "spediccio-modal-overlay";
    overlay.innerHTML = `
      <div class="spediccio-modal" role="dialog" aria-modal="true" aria-label="Kapcsolt fuvar szerkesztése">
        <div class="spediccio-modal-header">
          <h3>Kapcsolt fuvar szerkesztése • ${escapeHtml(fuvar.id)}</h3>
          <button type="button" class="spediccio-modal-close" aria-label="Bezárás">✕</button>
        </div>
        <div class="spediccio-modal-subtitle">${escapeHtml(fuvar.megnevezes || "")}</div>
        <form class="spediccio-form-grid transit-link-form-grid">
          ${fieldsHtml}
          <div class="spediccio-modal-actions full-width">
            <button type="button" class="btn spediccio-cancel-btn" data-action="cancel">Mégse</button>
            <button type="submit" class="btn spediccio-save-btn">Mentés</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const dialog = overlay.querySelector(".spediccio-modal");
    const closeBtn = overlay.querySelector(".spediccio-modal-close");
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const form = overlay.querySelector(".transit-link-form-grid");

    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      closeSpedicioModal(overlay, onKeyDown);
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(form).entries());
      applyTransitLinkEditorForm(fuvar, formData);
      finish(true);
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    dialog.addEventListener("click", (event) => event.stopPropagation());
    closeBtn.addEventListener("click", () => finish(false));
    cancelBtn.addEventListener("click", () => finish(false));

    document.addEventListener("keydown", onKeyDown);
  });
}

function getAssignedResourceName(type, id) {
  if (!id) {
    return "-";
  }

  if (type === "sofor") {
    return SOFOROK.find((item) => item.id === id)?.nev || "-";
  }

  if (type === "vontato") {
    return VONTATOK.find((item) => item.id === id)?.rendszam || "-";
  }

  return POTKOCSIK.find((item) => item.id === id)?.rendszam || "-";
}

function getAssignedSoforDisplayName(fuvar) {
  const primary = getAssignedResourceName("sofor", fuvar.assignedSoforId);
  const secondary = getAssignedResourceName("sofor", fuvar.assignedSecondarySoforId);

  if (primary === "-" && secondary === "-") {
    return "-";
  }

  if (secondary !== "-") {
    return `${primary} + ${secondary}`;
  }

  return primary;
}

function renderFuvarAssignment(fuvar) {
  const soforName = getAssignedSoforDisplayName(fuvar);
  const vontatoName = getAssignedResourceName("vontato", fuvar.assignedVontatoId);
  const potkocsiName = getAssignedResourceName("potkocsi", fuvar.assignedPotkocsiId);

  if (soforName === "-" && vontatoName === "-" && potkocsiName === "-") {
    return "";
  }

  return `
    <div class="fuvar-resource-assignment">
      <div class="fuvar-resource-assignment-title">Társított erőforrások</div>
      <div class="fuvar-resource-assignment-row">👤 Gépjárművezető: ${soforName}</div>
      <div class="fuvar-resource-assignment-row">🚛 Vontató: ${vontatoName}</div>
      <div class="fuvar-resource-assignment-row">🚚 Pótkocsi: ${potkocsiName}</div>
      <div class="fuvar-resource-assignment-actions">
        <button type="button" class="fuvar-resource-clear-btn" data-action="clear-fuvar-assignment">Társítás törlése</button>
      </div>
    </div>
  `;
}

// =============================================================
//  GYORSSZŰRŐK HOZZÁRENDELÉSE
// =============================================================
export function renderFuvarFilters(containerId, onFilterChange, options = {}) {
  const cont = document.getElementById(containerId);
  let filterState = normalizeFuvarFilterState(options.initialFilterState);
  let weekOffset = 0;
  filterState.query = "";
  const initialWeekDays = buildWeekDayOffsets(
    typeof options.getTimelineReferenceDate === "function"
      ? options.getTimelineReferenceDate()
      : options.timelineReferenceDate,
    weekOffset
  );
  cont.innerHTML = `
    <div class="fuvar-filter-bar">
      <div class="fuvar-filter-row fuvar-filter-row-main">
        <label class="fuvar-filter-field">
          <span>Típus</span>
          <select class="btn fuvar-filter-select" data-filter-role="category">
            <option value="all">Összes típus</option>
            <option value="belfold">Belföld</option>
            <option value="export">Export</option>
            <option value="import">Import</option>
            <option value="elofutas">Előfutás</option>
            <option value="utofutas">Utófutás</option>
          </select>
        </label>
        <label class="fuvar-filter-field">
          <span>Erőforrás</span>
          <select class="btn fuvar-filter-select" data-filter-role="assignment">
            <option value="all">Összes állapot</option>
            <option value="ready">Kész</option>
            <option value="planning">Tervezés alatt</option>
            <option value="unassigned">Szabad</option>
          </select>
        </label>
        <button class="btn fuvar-filter-toggle" type="button" data-toggle="adr"><span class="fuvar-filter-toggle-label">ADR</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-toggle" type="button" data-toggle="surgos"><span class="fuvar-filter-toggle-label">Sürgős</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-toggle" type="button" data-toggle="kezes2"><span class="fuvar-filter-toggle-label">Négy kezes</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-toggle" type="button" data-toggle="elapsed"><span class="fuvar-filter-toggle-label">Elmaradt</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-toggle fuvar-filter-ready" type="button" data-toggle="ready"><span class="fuvar-filter-toggle-label">Kész</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-toggle fuvar-filter-planning" type="button" data-toggle="planning"><span class="fuvar-filter-toggle-label">Tervezés alatt</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-toggle fuvar-filter-spediccio" type="button" data-toggle="spediccio"><span class="fuvar-filter-toggle-label">Spedíció</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
        <button class="btn fuvar-filter-reset" type="button" data-action="reset">Szűrők törlése</button>
        <button class="btn" type="button" id="btn-auto-assign" data-action="auto-assign">Fuvarok összerakása</button>
      </div>
      <div class="fuvar-filter-row fuvar-filter-row-dates">
        <button class="btn fuvar-filter-week-nav" type="button" data-action="week-prev" aria-label="Előző hét">◀</button>
        <div class="fuvar-filter-week-label" data-filter-week-label></div>
        ${initialWeekDays.map((day) => {
          return `<button class="btn fuvar-filter-toggle" type="button" data-toggle="day-offset-${day.offset}"><span class="fuvar-filter-toggle-label">${day.label}</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>`;
        }).join("")}
        <button class="btn fuvar-filter-week-nav" type="button" data-action="week-next" aria-label="Következő hét">▶</button>
      </div>
    </div>
  `;

  const emit = () => {
    const timelineReferenceDate = typeof options.getTimelineReferenceDate === "function"
      ? options.getTimelineReferenceDate()
      : options.timelineReferenceDate;

    const weekDays = buildWeekDayOffsets(timelineReferenceDate, weekOffset);
    const dateButtonNodes = cont.querySelectorAll(".fuvar-filter-row-dates .fuvar-filter-toggle");
    weekDays.forEach((day, index) => {
      const buttonNode = dateButtonNodes[index];
      if (!buttonNode) {
        return;
      }

      buttonNode.dataset.toggle = `day-offset-${day.offset}`;
      const labelNode = buttonNode.querySelector(".fuvar-filter-toggle-label");
      if (labelNode) {
        labelNode.textContent = day.label;
      }
    });

    syncUnifiedFilterControls(cont, filterState, { timelineReferenceDate, weekOffset });
    onFilterChange({ ...filterState });
  };

  cont.querySelector('[data-filter-role="category"]')?.addEventListener("change", (event) => {
    filterState.category = event.target.value;
    emit();
  });

  cont.querySelector('[data-filter-role="assignment"]')?.addEventListener("change", (event) => {
    filterState.assignment = event.target.value;
    emit();
  });

  cont.querySelectorAll(".fuvar-filter-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.toggle;

      if (key === "ready" || key === "planning") {
        filterState.assignment = filterState.assignment === key ? "all" : key;
      } else if (key.startsWith("day-offset-")) {
        const targetOffset = Number.parseInt(key.slice("day-offset-".length), 10);
        filterState.dayOffset = filterState.dayOffset === targetOffset ? null : targetOffset;
      } else {
        filterState[key] = !filterState[key];
      }

      emit();
    });
  });

  cont.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
    filterState = createDefaultFuvarFilterState();
    weekOffset = 0;
    emit();
  });

  cont.querySelector('[data-action="week-prev"]')?.addEventListener("click", () => {
    weekOffset -= 1;
    emit();
  });

  cont.querySelector('[data-action="week-next"]')?.addEventListener("click", () => {
    weekOffset += 1;
    emit();
  });

  cont.querySelector('[data-action="auto-assign"]')?.addEventListener("click", () => {
    openAutoAssignModal({
      getAutoAssignOptions: options.getAutoAssignOptions,
      onApplied: () => {
        emit();
      }
    });
  });

  syncUnifiedFilterControls(cont, filterState, {
    weekOffset,
    timelineReferenceDate: typeof options.getTimelineReferenceDate === "function"
      ? options.getTimelineReferenceDate()
      : options.timelineReferenceDate
  });

  const spediccioButton = cont.querySelector('.fuvar-filter-spediccio');
  if (spediccioButton) {
    const clearDropState = () => {
      spediccioButton.classList.remove("drop-ready");
    };

    spediccioButton.addEventListener("dragover", (event) => {
      const fuvarId = getDraggedFuvarIdFromEvent(event);
      if (!fuvarId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      spediccioButton.classList.add("drop-ready");
    });

    spediccioButton.addEventListener("dragleave", clearDropState);

    spediccioButton.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDropState();

      const fuvarId = getDraggedFuvarIdFromEvent(event);
      const fuvar = FUVAROK.find((item) => item.id === fuvarId);
      if (!fuvar) {
        return;
      }

      fuvar.spediccio = true;
      emit();
    });
  }
}

// =============================================================
//  FUVARKÁRTYÁK GENERÁLÁSA
// =============================================================
function buildFuvarChainModels(rowModels, visibleFuvarIds) {
  const modelById = new Map(rowModels.map((model) => [model.fuvar.id, model]));
  const exportRelayByRootId = new Map();
  const importRelayByRootId = new Map();

  const findRelayByNameReference = (rootId, type) => {
    if (!rootId) {
      return null;
    }

    const needle = `[${rootId}]`;
    return rowModels.find((candidate) => {
      const name = String(candidate?.fuvar?.megnevezes || "");
      if (!name.includes(needle)) {
        return false;
      }

      if (type === "export") {
        return normalizeText(name).includes("elofutas");
      }

      if (type === "import") {
        return normalizeText(name).includes("utofutas");
      }

      return false;
    }) || null;
  };

  const findRelayByIdPattern = (rootId, type) => {
    if (!rootId) {
      return null;
    }

    if (type === "export") {
      return modelById.get(`ELO-${rootId}`) || null;
    }

    if (type === "import") {
      return modelById.get(`UTO-${rootId}`) || null;
    }

    return null;
  };

  rowModels.forEach((model) => {
    const fuvar = model.fuvar;
    if (fuvar?.elofutasExportFuvarId) {
      exportRelayByRootId.set(fuvar.elofutasExportFuvarId, model);
    }
    if (fuvar?.utofutasImportFuvarId) {
      importRelayByRootId.set(fuvar.utofutasImportFuvarId, model);
    }
  });

  const chains = [];

  rowModels.forEach((model) => {
    const fuvar = model.fuvar;
    const category = fuvar?.kategoria || fuvar?.viszonylat || "";
    const isDomesticRelay = Boolean(fuvar?.elofutasExportFuvarId || fuvar?.utofutasImportFuvarId);

    let stageModels = null;
    if (category === "export") {
      stageModels = [];
      const relay = exportRelayByRootId.get(fuvar.id)
        || rowModels.find((candidate) => candidate.fuvar?.elofutasExportFuvarId === fuvar.id)
        || modelById.get(fuvar?.elofutasBelfoldFuvarId || "")
        || findRelayByIdPattern(fuvar.id, "export")
        || findRelayByNameReference(fuvar.id, "export");
      if (relay) {
        stageModels.push(relay);
      }
      stageModels.push(model);
      if (stageModels.length < 2) {
        return;
      }
    } else if (category === "import") {
      stageModels = [model];
      const relay = importRelayByRootId.get(fuvar.id)
        || rowModels.find((candidate) => candidate.fuvar?.utofutasImportFuvarId === fuvar.id)
        || modelById.get(fuvar?.utofutasBelfoldFuvarId || "")
        || findRelayByIdPattern(fuvar.id, "import")
        || findRelayByNameReference(fuvar.id, "import");
      if (relay) {
        stageModels.push(relay);
      }
      if (stageModels.length < 2) {
        return;
      }
    } else if (category === "belfold" && !isDomesticRelay) {
      stageModels = [model];
    }

    if (!stageModels || stageModels.length === 0) {
      return;
    }

    const hasVisibleStage = stageModels.some((stageModel) => visibleFuvarIds.has(stageModel.fuvar.id));
    if (!hasVisibleStage) {
      return;
    }

    chains.push({
      chainId: `chain:${fuvar.id}`,
      rootModel: model,
      stageModels
    });
  });

  return chains;
}

function getFuvarStageLabel(stageFuvar, rootFuvar, index) {
  if (stageFuvar?.elofutasExportFuvarId) {
    return "Előfutás";
  }

  if (stageFuvar?.utofutasImportFuvarId) {
    return "Utófutás";
  }

  const rootCategory = rootFuvar?.kategoria || rootFuvar?.viszonylat || "";
  if (stageFuvar?.id === rootFuvar?.id && rootCategory === "export") {
    return "Export";
  }
  if (stageFuvar?.id === rootFuvar?.id && rootCategory === "import") {
    return "Import";
  }

  void index;
  return "Belföld";
}

function buildChainRootDisplayData(rootModel, stageModels) {
  const firstStage = stageModels[0] || rootModel;
  const lastStage = stageModels[stageModels.length - 1] || rootModel;

  const rootFuvar = rootModel.fuvar;
  const displayFuvar = {
    ...rootFuvar,
    felrakas: {
      ...(rootFuvar?.felrakas || {}),
      cim: firstStage?.fuvar?.felrakas?.cim || rootFuvar?.felrakas?.cim,
      ido: firstStage?.fuvar?.felrakas?.ido || rootFuvar?.felrakas?.ido
    },
    lerakas: {
      ...(rootFuvar?.lerakas || {}),
      cim: lastStage?.fuvar?.lerakas?.cim || rootFuvar?.lerakas?.cim,
      ido: lastStage?.fuvar?.lerakas?.ido || rootFuvar?.lerakas?.ido
    }
  };

  const totalDistanceKm = stageModels.reduce((sum, stageModel) => {
    const km = resolveFuvarDistanceKm(stageModel?.fuvar);
    return Number.isFinite(km) ? sum + km : sum;
  }, 0);

  if (totalDistanceKm > 0) {
    displayFuvar.tavolsag_km = Math.round(totalDistanceKm);
  }

  const stageStatusKeys = stageModels.map((stageModel) => stageModel?.context?.assignmentStatusKey || "unassigned");
  const aggregateStatusKey = stageStatusKeys.every((key) => key === "ready")
    ? "ready"
    : stageStatusKeys.some((key) => key === "ready" || key === "planning")
      ? "planning"
      : "unassigned";
  const aggregateStatusLabel = aggregateStatusKey === "ready"
    ? "✅ Kész"
    : aggregateStatusKey === "planning"
      ? "🔨 Tervezés alatt"
      : "⬜ Szabad";

  const displayContext = {
    ...rootModel.context,
    assignmentStatusKey: aggregateStatusKey,
    statusLabel: aggregateStatusLabel,
    isFullyAssigned: aggregateStatusKey === "ready"
  };

  return {
    displayFuvar,
    displayContext
  };
}

function buildStageDisplaySegments(stageModels) {
  const segments = [];

  stageModels.forEach((stageModel, index) => {
    const previousSegment = index > 0 ? segments[index - 1] : null;
    const nextStageModel = index < stageModels.length - 1 ? stageModels[index + 1] : null;

    const startAddress = previousSegment?.endAddress || stageModel?.fuvar?.felrakas?.cim || "";
    const ownEndAddress = stageModel?.fuvar?.lerakas?.cim || "";
    const chainedEndAddress = nextStageModel?.fuvar?.felrakas?.cim || "";

    let endAddress = chainedEndAddress || ownEndAddress;
    if (normalizeText(endAddress) === normalizeText(startAddress) && ownEndAddress) {
      endAddress = ownEndAddress;
    }

    segments.push({
      startAddress,
      endAddress
    });
  });

  return segments;
}

export function renderFuvarCards(containerId, filter = "all", onSelectFuvar, options = {}) {
  const container = document.getElementById(containerId);
  const filterState = normalizeFuvarFilterState(filter);
  if (currentFuvarSort.columnId === "route") {
    currentFuvarSort.columnId = "pickupLocation";
  }
  const allowedColumnIds = new Set(FUVAR_CARD_COLUMN_OPTIONS.map((item) => item.id));
  const requestedColumns = Array.isArray(options.visibleColumns) ? options.visibleColumns : DEFAULT_FUVAR_CARD_COLUMNS;
  const expandedRequestedColumns = requestedColumns.flatMap((id) => {
    if (id === "route") {
      return ["pickupLocation", "dropoffLocation"];
    }
    return [id];
  });
  const regionAwareRequestedColumns = [...expandedRequestedColumns];
  if (!regionAwareRequestedColumns.includes("region")) {
    const dropoffIndex = regionAwareRequestedColumns.indexOf("dropoffLocation");
    if (dropoffIndex >= 0) {
      regionAwareRequestedColumns.splice(dropoffIndex + 1, 0, "region");
    } else {
      regionAwareRequestedColumns.push("region");
    }
  }

  const visibleColumns = regionAwareRequestedColumns.filter((id) => allowedColumnIds.has(id));
  const effectiveColumnsBase = visibleColumns.length > 0 ? visibleColumns : DEFAULT_FUVAR_CARD_COLUMNS;
  const effectiveColumns = [...effectiveColumnsBase];
  const distanceIndex = effectiveColumns.indexOf("distance");
  if (distanceIndex >= 0 && !effectiveColumns.includes("latestDeparture")) {
    effectiveColumns.splice(distanceIndex + 1, 0, "latestDeparture");
  }
  const importRecommendation = filterState.category === "import" ? findRecommendedImportForFocusedExport() : null;
  const renderList = [...FUVAROK];
  const assemblyDropoffAddress = getFocusedAssemblyDropoffAddress();
  const hasAssemblyDistanceContext = Boolean(focusedAssemblyId && assemblyDropoffAddress);

  if (filterState.category === "import" && importRecommendation?.fuvarId) {
    renderList.sort((a, b) => {
      if (a.id === importRecommendation.fuvarId) return -1;
      if (b.id === importRecommendation.fuvarId) return 1;
      return 0;
    });
  }

  container.innerHTML = `
    <div class="fuvar-card-table-scroll">
      <div class="fuvar-card-table-header"></div>
      <div class="fuvar-card-table-body"></div>
    </div>
  `;

  const headerRow = container.querySelector(".fuvar-card-table-header");
  const body = container.querySelector(".fuvar-card-table-body");

  const rowModels = [];
  const visibleFuvarIds = new Set();

  renderList.forEach((fuvar) => {
    evaluateFuvarTags(fuvar);

    if (matchesUnifiedFuvarFilter(fuvar, filterState, {
      timelineReferenceDate: options.timelineReferenceDate
    })) {
      visibleFuvarIds.add(fuvar.id);
    }

    const tagsHtml = [
      renderAssemblyDistanceTag(fuvar, assemblyDropoffAddress),
      ...getFuvarTags(fuvar).map((tag) => renderTag(tag, "fuvar-card-tag")),
      fuvar.spediccio
        ? `<button type="button" class="fuvar-spediccio-form-btn fuvar-spediccio-form-btn-inline" data-action="open-spediccio-form">Adatlap</button>`
        : ""
    ].filter(Boolean).join("");

    void importRecommendation;

    const soforName = getAssignedSoforDisplayName(fuvar);
    const vontatoName = getAssignedResourceName("vontato", fuvar.assignedVontatoId);
    const potkocsiName = getAssignedResourceName("potkocsi", fuvar.assignedPotkocsiId);

    const viszonylatLabel = { export: "Export", import: "Import", belfold: "Belföld" }[fuvar.viszonylat] ?? fuvar.viszonylat;
    const assignmentStatusKey = getFuvarAssignmentStatusKey(fuvar);
    const isFullyAssigned = assignmentStatusKey === "ready";
    const statusLabel = assignmentStatusKey === "ready"
      ? "✅ Kész"
      : assignmentStatusKey === "planning"
        ? "🔨 Tervezés alatt"
        : "⬜ Szabad";

    const clearBtnHtml = isFullyAssigned
      ? `<button type="button" class="fuvar-resource-clear-btn fuvar-header-clear-btn" data-action="clear-fuvar-assignment">Erőforrás törlés</button>`
      : "";
    const transitLinkBtnHtml = shouldShowTransitLinkEditor(fuvar)
      ? '<button type="button" class="fuvar-transit-edit-btn" data-action="edit-transit-link">Kapcsolás</button>'
      : "";
    const actionButtonsHtml = [transitLinkBtnHtml, clearBtnHtml].filter(Boolean).join("");

    const context = {
      soforName,
      vontatoName,
      potkocsiName,
      statusLabel,
      viszonylatLabel,
      isFullyAssigned,
      assignmentStatusKey
    };

    rowModels.push({
      fuvar,
      tagsHtml,
      actionButtonsHtml,
      context
    });
  });

  const chainModels = buildFuvarChainModels(rowModels, visibleFuvarIds);

  const recommendationOrderMap = buildResourceRecommendationOrderMap(
    options.recommendationResource,
    chainModels.map((model) => model.rootModel.fuvar)
  );

  if (recommendationOrderMap) {
    chainModels.sort((left, right) => {
      return compareByResourceRecommendation(left.rootModel.fuvar, right.rootModel.fuvar, recommendationOrderMap);
    });
  }

  const isAssemblyDistanceSort = currentFuvarSort.columnId === "assemblyDistance";
  if (!recommendationOrderMap && currentFuvarSort.columnId && (effectiveColumns.includes(currentFuvarSort.columnId) || isAssemblyDistanceSort)) {
    const sortMeta = isAssemblyDistanceSort ? { sortType: "number" } : getColumnMeta(currentFuvarSort.columnId);

    chainModels.sort((left, right) => {
      const optionMeta = FUVAR_CARD_COLUMN_OPTION_MAP.get(currentFuvarSort.columnId);
      const leftRoot = left.rootModel;
      const rightRoot = right.rootModel;

      const leftValue = isAssemblyDistanceSort
        ? getSelectedAssemblyDistanceKm(leftRoot.fuvar, assemblyDropoffAddress)
        : optionMeta?.excelLabel
          ? getExcelFieldSortValue(leftRoot.fuvar, optionMeta.excelLabel, leftRoot.context)
          : getBaseColumnSortValue(leftRoot.fuvar, currentFuvarSort.columnId, leftRoot.context);
      const rightValue = isAssemblyDistanceSort
        ? getSelectedAssemblyDistanceKm(rightRoot.fuvar, assemblyDropoffAddress)
        : optionMeta?.excelLabel
          ? getExcelFieldSortValue(rightRoot.fuvar, optionMeta.excelLabel, rightRoot.context)
          : getBaseColumnSortValue(rightRoot.fuvar, currentFuvarSort.columnId, rightRoot.context);

      let result = 0;
      if (sortMeta.sortType === "number" || sortMeta.sortType === "date") {
        const safeLeft = Number.isFinite(Number(leftValue)) ? Number(leftValue) : Number.NEGATIVE_INFINITY;
        const safeRight = Number.isFinite(Number(rightValue)) ? Number(rightValue) : Number.NEGATIVE_INFINITY;
        result = safeLeft - safeRight;
      } else {
        result = String(leftValue || "").localeCompare(String(rightValue || ""), "hu");
      }

      return currentFuvarSort.direction === "desc" ? -result : result;
    });
  }

  const assemblyDistanceHeaderActive = currentFuvarSort.columnId === "assemblyDistance";
  const assemblyDistanceIndicator = assemblyDistanceHeaderActive
    ? (currentFuvarSort.direction === "asc" ? " ↑" : " ↓")
    : "";

  let headerHtml = `
    <button
      type="button"
      class="fuvar-card-header-cell fuvar-card-header-cell-lane${assemblyDistanceHeaderActive ? " active" : ""}"
      data-sort-column="assemblyDistance"
      style="width:var(--fuvar-tag-lane-width);min-width:var(--fuvar-tag-lane-width);max-width:var(--fuvar-tag-lane-width);"
      ${hasAssemblyDistanceContext ? "" : "disabled"}
      title="${hasAssemblyDistanceContext ? "Rendezés a kijelölt szerelvénytől mért távolság alapján" : "Válassz ki egy szerelvényt a rendezéshez"}"
    >
      KM${assemblyDistanceIndicator}
    </button>
  `;
  
  headerHtml += effectiveColumns.map((columnId) => {
    const optionMeta = FUVAR_CARD_COLUMN_OPTION_MAP.get(columnId);
    if (!optionMeta) {
      return "";
    }

    const isActive = currentFuvarSort.columnId === columnId;
    const indicator = isActive ? (currentFuvarSort.direction === "asc" ? " ↑" : " ↓") : "";

    return `
      <button
        type="button"
        class="fuvar-card-header-cell${isActive ? " active" : ""}"
        data-sort-column="${columnId}"
        style="${getColumnWidthStyle(columnId)}"
      >
        ${optionMeta.label}${indicator}
      </button>
    `;
  }).join("");
  
  headerRow.innerHTML = headerHtml;

  headerRow.querySelectorAll("[data-sort-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const columnId = button.dataset.sortColumn;

      if (currentFuvarSort.columnId === columnId) {
        currentFuvarSort.direction = currentFuvarSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentFuvarSort.columnId = columnId;
        currentFuvarSort.direction = "asc";
      }

      renderFuvarCards(containerId, filter, onSelectFuvar, options);
      enableFuvarDrag();
    });
  });

  const renderColumnsHtml = (cardFuvar, cardContext) => {
    return effectiveColumns.map((columnId) => {
      const optionMeta = FUVAR_CARD_COLUMN_OPTION_MAP.get(columnId);
      if (!optionMeta) {
        return "";
      }

      const value = optionMeta.excelLabel
        ? getExcelFieldValue(cardFuvar, optionMeta.excelLabel, cardContext)
        : getBaseColumnDisplayValue(cardFuvar, columnId, cardContext);

      const extraClass = columnId === "distance"
        ? " fuvar-card-distance"
        : columnId === "latestDeparture"
          ? " fuvar-card-latest-departure"
        : "";

      return `
        <div class="fuvar-card-item${extraClass}" style="${getColumnWidthStyle(columnId)}">
          <span class="fuvar-card-item-value">${value}</span>
        </div>
      `;
    }).join("");
  };

  chainModels.forEach(({ chainId, rootModel, stageModels }) => {
    const { fuvar, tagsHtml, actionButtonsHtml } = rootModel;
    const { displayFuvar, displayContext } = buildChainRootDisplayData(rootModel, stageModels);
    const expanded = expandedFuvarChainIds.has(chainId);

    const card = document.createElement("div");
    card.className = "menu-card";
    card.style.marginBottom = "6px";
    card.dataset.id = fuvar.id;

    const categoryPalette = getCategoryPalette(fuvar.kategoria || fuvar.viszonylat || "all");
    card.style.setProperty("--fuvar-card-bg", categoryPalette.softBg);
    card.style.setProperty("--fuvar-card-bg-strong", categoryPalette.softBgStrong);
    card.style.setProperty("--fuvar-card-border", categoryPalette.border);
    card.style.setProperty("--fuvar-card-glow", categoryPalette.glow);

    if (displayContext.assignmentStatusKey === "ready") {
      card.style.setProperty("--fuvar-card-bg", "rgba(92, 201, 141, 0.25)");
      card.style.setProperty("--fuvar-card-bg-strong", "rgba(92, 201, 141, 0.34)");
      card.style.setProperty("--fuvar-card-border", "rgba(92, 201, 141, 0.65)");
      card.style.setProperty("--fuvar-card-glow", "rgba(92, 201, 141, 0.24)");
    } else if (displayContext.assignmentStatusKey === "planning") {
      card.style.setProperty("--fuvar-card-bg", "rgba(255, 193, 7, 0.24)");
      card.style.setProperty("--fuvar-card-bg-strong", "rgba(255, 193, 7, 0.33)");
      card.style.setProperty("--fuvar-card-border", "rgba(255, 193, 7, 0.6)");
      card.style.setProperty("--fuvar-card-glow", "rgba(255, 193, 7, 0.22)");
    }

    if (focusedFuvarId === fuvar.id) {
      card.classList.add("active-fuvar");
    }

    const columnsHtml = renderColumnsHtml(displayFuvar, displayContext);

    const toggleHtml = `
      <button
        type="button"
        class="fuvar-chain-toggle"
        data-action="toggle-chain"
        title="Részletek megjelenítése"
      >
        <span class="fuvar-chain-toggle-arrow">${expanded ? "▾" : "▸"}</span>
        <span class="fuvar-chain-toggle-count">${stageModels.length}</span>
      </button>
    `;

    card.innerHTML = `
      <div class="fuvar-card-inline">
        <div class="fuvar-tag-list fuvar-tag-list-inline">${toggleHtml}${tagsHtml}</div>
        <div class="fuvar-card-grid fuvar-card-grid-inline">
          ${columnsHtml}
        </div>
        <div class="fuvar-card-inline-actions">${actionButtonsHtml}</div>
      </div>
    `;

    const toggleBtn = card.querySelector('[data-action="toggle-chain"]');
    if (toggleBtn) {
      toggleBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (expandedFuvarChainIds.has(chainId)) {
          expandedFuvarChainIds.delete(chainId);
        } else {
          expandedFuvarChainIds.add(chainId);
        }

        renderFuvarCards(containerId, filter, onSelectFuvar, options);
        enableFuvarDrag();
      });
    }

    card.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("fuvar:focus", {
        detail: { fuvarId: fuvar.id }
      }));

      const results = evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, fuvar);
      if (typeof onSelectFuvar === "function") {
        onSelectFuvar(results);
      }

      document.querySelectorAll(".menu-card").forEach((element) => element.classList.remove("active-fuvar"));
      card.classList.add("active-fuvar");
    });

    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      openFuvarDetailsModal(fuvar, displayContext);
    });

    const removeSpediccioBtn = card.querySelector('[data-action="remove-spediccio"]');
    if (removeSpediccioBtn) {
      removeSpediccioBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        clearSpedicioAssignment(fuvar);
        renderFuvarCards(containerId, filter, onSelectFuvar, options);
        enableFuvarDrag();
      });
    }

    const openSpediccioFormBtn = card.querySelector('[data-action="open-spediccio-form"]');
    if (openSpediccioFormBtn) {
      openSpediccioFormBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const formData = await openSpedicioOrderFormModal(fuvar);
        if (formData) {
          fuvar.spediccioForm = formData;
          window.dispatchEvent(new CustomEvent("spediccio:form-updated", {
            detail: {
              fuvarId: fuvar.id,
              partnerName: fuvar.spediccioPartner || ""
            }
          }));
        }
      });
    }

    const editTransitLinkBtn = card.querySelector('[data-action="edit-transit-link"]');
    if (editTransitLinkBtn) {
      editTransitLinkBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const didSave = await openTransitLinkEditorModal(fuvar);
        if (!didSave) {
          return;
        }

        renderFuvarCards(containerId, filter, onSelectFuvar, options);
        enableFuvarDrag();
        window.dispatchEvent(new CustomEvent("fuvar:focus", {
          detail: { fuvarId: fuvar.id }
        }));

        const results = evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, fuvar);
        if (typeof onSelectFuvar === "function") {
          onSelectFuvar(results);
        }
      });
    }

    const clearAssignmentBtn = card.querySelector('[data-action="clear-fuvar-assignment"]');
    if (clearAssignmentBtn) {
      clearAssignmentBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        clearFuvarResourceAssignment(fuvar);
        renderFuvarCards(containerId, filter, onSelectFuvar, options);
        enableFuvarDrag();

        const results = evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, fuvar);
        if (typeof onSelectFuvar === "function") {
          onSelectFuvar(results);
        }
      });
    }

    body.appendChild(card);

    if (expanded) {
      const stageContainer = document.createElement("div");
      stageContainer.className = "fuvar-stage-list";
      const stageSegments = buildStageDisplaySegments(stageModels);

      stageModels.forEach((stageModel, index) => {
        const stageFuvar = stageModel.fuvar;
        const stageContext = stageModel.context;
        const stageSegment = stageSegments[index] || {
          startAddress: stageFuvar?.felrakas?.cim || "",
          endAddress: stageFuvar?.lerakas?.cim || ""
        };
        const stageLabel = getFuvarStageLabel(stageFuvar, fuvar, index);

        const stageDisplayFuvar = {
          ...stageFuvar,
          felrakas: {
            ...(stageFuvar?.felrakas || {}),
            cim: stageSegment.startAddress || stageFuvar?.felrakas?.cim
          },
          lerakas: {
            ...(stageFuvar?.lerakas || {}),
            cim: stageSegment.endAddress || stageFuvar?.lerakas?.cim
          }
        };

        const stageDistanceKm = getRoadDistanceKm(
          stageDisplayFuvar?.felrakas?.cim,
          stageDisplayFuvar?.lerakas?.cim,
          { prime: true }
        );

        if (Number.isFinite(stageDistanceKm)) {
          stageDisplayFuvar.tavolsag_km = Math.round(stageDistanceKm);
        }

        const stageColumnsHtml = renderColumnsHtml(stageDisplayFuvar, stageContext);

        const stageNode = document.createElement("div");
        stageNode.className = `menu-card fuvar-stage-card ${stageContext?.assignmentStatusKey || "unassigned"}`;
        stageNode.dataset.id = stageFuvar.id;
        stageNode.dataset.fuvarId = stageFuvar.id;
        stageNode.style.marginBottom = "0";
        stageNode.innerHTML = `
          <div class="fuvar-card-inline">
            <div class="fuvar-tag-list fuvar-tag-list-inline fuvar-stage-tag-lane">
              <span class="fuvar-stage-index">${index + 1}</span>
              <span class="fuvar-stage-label">${stageLabel}</span>
            </div>
            <div class="fuvar-card-grid fuvar-card-grid-inline">
              ${stageColumnsHtml}
            </div>
            <div class="fuvar-card-inline-actions"></div>
          </div>
        `;

        if (focusedFuvarId === stageFuvar.id) {
          stageNode.classList.add("active-fuvar-stage");
        }

        stageNode.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          window.dispatchEvent(new CustomEvent("fuvar:focus", {
            detail: { fuvarId: stageFuvar.id }
          }));

          const results = evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, stageFuvar);
          if (typeof onSelectFuvar === "function") {
            onSelectFuvar(results);
          }

          renderFuvarCards(containerId, filter, onSelectFuvar, options);
          enableFuvarDrag();
        });

        stageNode.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openFuvarDetailsModal(stageDisplayFuvar, stageContext);
        });

        stageContainer.appendChild(stageNode);
      });

      body.appendChild(stageContainer);
    }
  });
}
