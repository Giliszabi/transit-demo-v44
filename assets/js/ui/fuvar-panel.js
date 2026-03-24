// ==============================================================
// Fuvar kártyák + gyorsszűrők + MATCHING ENGINE integráció
// ==============================================================

import { FUVAROK } from "../data/fuvarok.js";
import { formatDate } from "../utils.js";
import { evaluateFuvarTags, evaluateAllResources } from "./matching.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { renderTimeline, refreshAutoDeadheadBlocksForVontato } from "./timeline.js";
import { getFuvarTagMeta, getCategoryPalette } from "./colors.js";
import { enableFuvarDrag } from "./dragdrop.js";

const FILTERS = ["all", "adr", "surgos", "belfold", "export", "import", "spediccio"];
const DEFAULT_FUVAR_FILTER_STATE = Object.freeze({
  category: "all",
  assignment: "all",
  adr: false,
  surgos: false,
  spediccio: false,
  elapsed: false,
  query: ""
});
const BASE_CARD_COLUMN_OPTIONS = [
  { id: "route", label: "Útvonal" },
  { id: "pickup", label: "Felrakás" },
  { id: "delivery", label: "Lerakás" },
  { id: "distance", label: "Távolság" },
  { id: "type", label: "Típus" },
  { id: "status", label: "Státusz" },
  { id: "driver", label: "Sofőr" },
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
  "Összes sofőr költség /KM",
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
  "Sofőr napidíj /KM",
  "Sofőr ADR költség /KM",
  "Sofőr Forduló díj /KM",
  "Sofőr távolság érték /KM",
  "Sofőr hűség bónusz /KM",
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
  "route",
  "pickup",
  "delivery",
  "distance",
  "status",
  "driver",
  "tractor",
  "trailer",
  "excel_28",
  "excel_29",
  "excel_33",
  "excel_34"
];

export function createDefaultFuvarFilterState() {
  return { ...DEFAULT_FUVAR_FILTER_STATE };
}
const CITY_COORDS = {
  milano: { lat: 45.4642, lon: 9.19 },
  munchen: { lat: 48.1351, lon: 11.582 },
  frankfurt: { lat: 50.1109, lon: 8.6821 },
  wien: { lat: 48.2082, lon: 16.3738 },
  brno: { lat: 49.1951, lon: 16.6068 },
  linz: { lat: 48.3069, lon: 14.2858 },
  budapest: { lat: 47.4979, lon: 19.0402 },
  gyor: { lat: 47.6875, lon: 17.6504 },
  debrecen: { lat: 47.5316, lon: 21.6273 },
  szeged: { lat: 46.253, lon: 20.1414 },
  miskolc: { lat: 48.1035, lon: 20.7784 },
  pecs: { lat: 46.0727, lon: 18.2323 },
  tatabanya: { lat: 47.5692, lon: 18.4048 },
  kecskemet: { lat: 46.8964, lon: 19.6897 },
  szekesfehervar: { lat: 47.186, lon: 18.4221 }
};
let focusedFuvarId = null;
let currentFuvarSort = {
  columnId: null,
  direction: "asc"
};

window.addEventListener("fuvar:focus", (event) => {
  focusedFuvarId = event?.detail?.fuvarId || null;
});
const SPEDICIO_PARTNERS = [
  "EURASIA LOGISTICS Kft",
  "Radex Fuvarozó és Szállítmányozó Korlátolt Felelősségű Társaság",
  '"PLUTO" Árufuvarozó Korlátolt Felelősségű Társaság',
  "3B SCIENTIFIC GMBH",
  "606 S.R.O.",
  "ACTIVE PLUS LOGISTICS KFT.",
  "ADLER-TRANS KFT",
  "AGRICAMION Szállítmányozó És Kereskedelmi Korlátolt Felelősségű Társaság",
  "AGZO-SZITI KFT.",
  "AKTUELL Szolgáltató és Kereskedelmi Korlátolt Felelősségű Társaság",
  "ALFA SPED s.r.o.",
  "ANTS - IN GmbH",
  "ARANYGOMB KERESKEDELMI ÉS SZOLGÁLTATÓ"
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
    route: { width: 240, sortType: "text" },
    pickup: { width: 168, sortType: "date" },
    delivery: { width: 168, sortType: "date" },
    distance: { width: 116, sortType: "number" },
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

    if (["belfold", "export", "import", "spediccio"].includes(filter)) {
      base.category = filter === "spediccio" ? "all" : filter;
      if (filter === "spediccio") {
        base.spediccio = true;
      }
      return base;
    }

    if (filter === "adr" || filter === "surgos") {
      base[filter] = true;
      return base;
    }

    return base;
  }

  return {
    category: ["all", "belfold", "export", "import"].includes(filter.category) ? filter.category : "all",
    assignment: ["all", "ready", "planning", "unassigned"].includes(filter.assignment) ? filter.assignment : "all",
    adr: Boolean(filter.adr),
    surgos: Boolean(filter.surgos),
    spediccio: Boolean(filter.spediccio),
    elapsed: Boolean(filter.elapsed),
    query: String(filter.query || "")
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

function getFuvarAssignmentStatusKey(fuvar) {
  if (fuvar?.assignedSoforId && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId) {
    return "ready";
  }

  if (fuvar?.assignedSoforId || fuvar?.assignedVontatoId || fuvar?.assignedPotkocsiId) {
    return "planning";
  }

  return "unassigned";
}

function matchesUnifiedFuvarFilter(fuvar, filterState, options = {}) {
  if (filterState.category !== "all" && fuvar.kategoria !== filterState.category) {
    return false;
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

  if (filterState.spediccio && !fuvar.spediccio) {
    return false;
  }

  if (filterState.elapsed && !isElapsedFuvar(fuvar, options.timelineReferenceDate)) {
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
  const estimatedCost = Number(fuvar?.osszkoltseg || fuvar?.onkoltseg || (fuvar?.tavolsag_km || 0) * 430);
  const costPerKm = fuvar?.tavolsag_km ? estimatedCost / fuvar.tavolsag_km : null;
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
    return fuvar?.tavolsag_km ? `${fuvar.tavolsag_km} km` : "-";
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
  if (lowerLabel === normalizeText("1. Sofőr") || lowerLabel === normalizeText("2. Sofőr") || lowerLabel === normalizeText("Nemzetközi sofőr 1") || lowerLabel === normalizeText("Nemzetközi sofőr 2")) {
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
  if (lowerLabel === normalizeText("Összes sofőr költség /KM")) {
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
  if (columnId === "route") {
    return `📍 ${getDisplayLocation(fuvar.felrakas.cim)} → ${getDisplayLocation(fuvar.lerakas.cim)}`;
  }
  if (columnId === "pickup") {
    return `📦 ${formatDate(fuvar.felrakas.ido)}`;
  }
  if (columnId === "delivery") {
    return `📦 ${formatDate(fuvar.lerakas.ido)}`;
  }
  if (columnId === "distance") {
    return `🚚 ${fuvar.tavolsag_km} km`;
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
  if (columnId === "route") {
    return normalizeText(`${getDisplayLocation(fuvar.felrakas.cim)} ${getDisplayLocation(fuvar.lerakas.cim)}`);
  }
  if (columnId === "pickup") {
    return new Date(fuvar.felrakas.ido).getTime();
  }
  if (columnId === "delivery") {
    return new Date(fuvar.lerakas.ido).getTime();
  }
  if (columnId === "distance") {
    return Number(fuvar.tavolsag_km || 0);
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
  if ((first.includes("magyarorszag") || first.includes("hungary")) && parts[1]) {
    return parts[1];
  }

  return parts[0];
}

function isHungaryAddress(address) {
  const normalized = normalizeText(address);
  return normalized.includes("magyarorszag") || normalized.includes("hungary");
}

function hasFullAssignment(fuvar) {
  return Boolean(fuvar?.assignedSoforId && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId);
}

function hasSameTrio(leftFuvar, rightFuvar) {
  return leftFuvar.assignedSoforId === rightFuvar.assignedSoforId
    && leftFuvar.assignedVontatoId === rightFuvar.assignedVontatoId
    && leftFuvar.assignedPotkocsiId === rightFuvar.assignedPotkocsiId;
}

function getCityKeyFromAddress(address) {
  const display = normalizeText(getDisplayLocation(address));
  if (!display) {
    return "";
  }

  const aliases = {
    "budapest": "budapest",
    "gyor": "gyor",
    "debrecen": "debrecen",
    "szeged": "szeged",
    "miskolc": "miskolc",
    "pecs": "pecs",
    "tatabanya": "tatabanya",
    "kecskemet": "kecskemet",
    "szekesfehervar": "szekesfehervar",
    "milano": "milano",
    "munchen": "munchen",
    "frankfurt": "frankfurt",
    "wien": "wien",
    "brno": "brno",
    "linz": "linz"
  };

  const matchedKey = Object.keys(aliases).find((alias) => display.includes(alias));
  return matchedKey ? aliases[matchedKey] : "";
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

function getQuickFilterPreviewState(filterState, key) {
  const preview = normalizeFuvarFilterState(filterState);

  if (key === "ready" || key === "planning") {
    preview.assignment = key;
    return preview;
  }

  preview[key] = true;
  return preview;
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

  if (categorySelect) categorySelect.value = filterState.category;
  if (assignmentSelect) assignmentSelect.value = filterState.assignment;
  if (queryInput) queryInput.value = filterState.query;

  container.querySelectorAll(".fuvar-filter-toggle").forEach((node) => {
    const key = node.dataset.toggle;
    const colorMeta = getQuickFilterColorMeta(key);
    if (key === "ready" || key === "planning") {
      node.classList.toggle("active", filterState.assignment === key);
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
        timelineReferenceDate: options.timelineReferenceDate
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

function openSpedicioPartnerPicker(initialPartner = "") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "spediccio-modal-overlay";
    overlay.innerHTML = `
      <div class="spediccio-modal spediccio-partner-modal" role="dialog" aria-modal="true" aria-label="Spediciós partner választása">
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

function openSpedicioOrderFormModal(fuvar, partnerName) {
  return new Promise((resolve) => {
    const existing = fuvar.spediccioForm || {};
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
            <input name="orderCode" type="text" value="${existing.orderCode || `POR-SP-${fuvar.id}-0001000`}" />
          </label>

          <label>
            <span>Spediciós partner</span>
            <input name="partnerName" type="text" value="${partnerName}" readonly />
          </label>

          <label class="spediccio-price-row">
            <span>Megrendelés ár és pénznem</span>
            <div>
              <input name="orderPrice" type="text" placeholder="Összeg" value="${existing.orderPrice || ""}" />
              <select name="currency">
                <option value="" ${!existing.currency ? "selected" : ""}>---</option>
                <option value="HUF" ${existing.currency === "HUF" ? "selected" : ""}>HUF</option>
                <option value="EUR" ${existing.currency === "EUR" ? "selected" : ""}>EUR</option>
                <option value="USD" ${existing.currency === "USD" ? "selected" : ""}>USD</option>
              </select>
            </div>
          </label>

          <label>
            <span>Partner ajánlat szám</span>
            <input name="partnerOfferNo" type="text" value="${existing.partnerOfferNo || ""}" />
          </label>

          <label>
            <span>Sofőr 1</span>
            <input name="driver1" type="text" value="${existing.driver1 || ""}" />
          </label>

          <label>
            <span>Sofőr 2</span>
            <input name="driver2" type="text" value="${existing.driver2 || ""}" />
          </label>

          <label>
            <span>Vontató rendszám</span>
            <input name="tractorPlate" type="text" value="${existing.tractorPlate || ""}" />
          </label>

          <label>
            <span>Pót rendszám</span>
            <input name="trailerPlate" type="text" value="${existing.trailerPlate || ""}" />
          </label>

          <label>
            <span>Fuvarszervező</span>
            <input name="dispatcher" type="text" value="${existing.dispatcher || ""}" />
          </label>

          <label>
            <span>Partner kapcsolattartó</span>
            <input name="partnerContact" type="text" value="${existing.partnerContact || ""}" />
          </label>

          <label>
            <span>Visszaigazolás dátuma</span>
            <input name="confirmDate" type="date" value="${existing.confirmDate || ""}" />
          </label>

          <label>
            <span>Várható teljesítés dátuma</span>
            <input name="etaDate" type="date" value="${existing.etaDate || ""}" />
          </label>

          <label class="full-width">
            <span>Pénzügyi konfiguráció</span>
            <input name="financeConfig" type="text" value="${existing.financeConfig || ""}" placeholder="Válasszon ki egy pénzügyi konfigurációt..." />
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
          aria-label="Spedició jelölés törlése"
          title="Spedició jelölés törlése"
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

  if (fuvar.spediccio) {
    tags.push("spediccio");
  }

  return tags;
}

function clearSpedicioAssignment(fuvar) {
  fuvar.spediccio = false;
  delete fuvar.spediccioPartner;
  delete fuvar.spediccioForm;
}

function clearFuvarResourceAssignment(fuvar) {
  delete fuvar.assignedSoforId;
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

  VONTATOK.forEach((vontato) => {
    refreshAutoDeadheadBlocksForVontato(vontato);
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

function renderFuvarAssignment(fuvar) {
  const soforName = getAssignedResourceName("sofor", fuvar.assignedSoforId);
  const vontatoName = getAssignedResourceName("vontato", fuvar.assignedVontatoId);
  const potkocsiName = getAssignedResourceName("potkocsi", fuvar.assignedPotkocsiId);

  if (soforName === "-" && vontatoName === "-" && potkocsiName === "-") {
    return "";
  }

  return `
    <div class="fuvar-resource-assignment">
      <div class="fuvar-resource-assignment-title">Társított erőforrások</div>
      <div class="fuvar-resource-assignment-row">👤 Sofőr: ${soforName}</div>
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
  let filterState = createDefaultFuvarFilterState();
  cont.innerHTML = `
    <div class="fuvar-filter-bar">
      <label class="fuvar-filter-field">
        <span>Típus</span>
        <select class="btn fuvar-filter-select" data-filter-role="category">
          <option value="all">Összes típus</option>
          <option value="belfold">Belföld</option>
          <option value="export">Export</option>
          <option value="import">Import</option>
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
      <label class="fuvar-filter-field fuvar-filter-search-field">
        <span>Keresés</span>
        <input class="fuvar-filter-search" data-filter-role="query" type="search" placeholder="Fuvar, cím, sofőr, vontató..." />
      </label>
      <button class="btn fuvar-filter-toggle" type="button" data-toggle="adr"><span class="fuvar-filter-toggle-label">ADR</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
      <button class="btn fuvar-filter-toggle" type="button" data-toggle="surgos"><span class="fuvar-filter-toggle-label">Sürgős</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
      <button class="btn fuvar-filter-toggle" type="button" data-toggle="elapsed"><span class="fuvar-filter-toggle-label">Elmaradt</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
      <button class="btn fuvar-filter-toggle fuvar-filter-ready" type="button" data-toggle="ready"><span class="fuvar-filter-toggle-label">Kész</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
      <button class="btn fuvar-filter-toggle fuvar-filter-planning" type="button" data-toggle="planning"><span class="fuvar-filter-toggle-label">Tervezés alatt</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
      <button class="btn fuvar-filter-toggle fuvar-filter-spediccio" type="button" data-toggle="spediccio"><span class="fuvar-filter-toggle-label">Spedicció</span><span class="fuvar-filter-count-badge" data-filter-count>0</span></button>
      <button class="btn fuvar-filter-reset" type="button" data-action="reset">Szűrők törlése</button>
    </div>
  `;

  const emit = () => {
    const timelineReferenceDate = typeof options.getTimelineReferenceDate === "function"
      ? options.getTimelineReferenceDate()
      : options.timelineReferenceDate;

    syncUnifiedFilterControls(cont, filterState, { timelineReferenceDate });
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

  cont.querySelector('[data-filter-role="query"]')?.addEventListener("input", (event) => {
    filterState.query = event.target.value;
    emit();
  });

  cont.querySelectorAll(".fuvar-filter-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.toggle;

      if (key === "ready" || key === "planning") {
        filterState.assignment = filterState.assignment === key ? "all" : key;
      } else {
        filterState[key] = !filterState[key];
      }

      emit();
    });
  });

  cont.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
    filterState = createDefaultFuvarFilterState();
    emit();
  });

  syncUnifiedFilterControls(cont, filterState, {
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

    spediccioButton.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDropState();

      const fuvarId = getDraggedFuvarIdFromEvent(event);
      const fuvar = FUVAROK.find((item) => item.id === fuvarId);
      if (!fuvar) {
        return;
      }

      fuvar.spediccio = true;

      const selectedPartner = await openSpedicioPartnerPicker(fuvar.spediccioPartner || "");
      if (selectedPartner) {
        fuvar.spediccioPartner = selectedPartner;

        const formData = await openSpedicioOrderFormModal(fuvar, selectedPartner);
        if (formData) {
          fuvar.spediccioForm = formData;
        }
      }

      filterState.spediccio = true;
      emit();
    });
  }
}

// =============================================================
//  FUVARKÁRTYÁK GENERÁLÁSA
// =============================================================
export function renderFuvarCards(containerId, filter = "all", onSelectFuvar, options = {}) {
  const container = document.getElementById(containerId);
  const filterState = normalizeFuvarFilterState(filter);
  const allowedColumnIds = new Set(FUVAR_CARD_COLUMN_OPTIONS.map((item) => item.id));
  const requestedColumns = Array.isArray(options.visibleColumns) ? options.visibleColumns : DEFAULT_FUVAR_CARD_COLUMNS;
  const visibleColumns = requestedColumns.filter((id) => allowedColumnIds.has(id));
  const effectiveColumns = visibleColumns.length > 0 ? visibleColumns : DEFAULT_FUVAR_CARD_COLUMNS;
  const importRecommendation = filterState.category === "import" ? findRecommendedImportForFocusedExport() : null;
  const renderList = [...FUVAROK];

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

  renderList.forEach((fuvar) => {
    evaluateFuvarTags(fuvar);

    if (!matchesUnifiedFuvarFilter(fuvar, filterState, {
      timelineReferenceDate: options.timelineReferenceDate
    })) {
      return;
    }

    const tagsHtml = getFuvarTags(fuvar)
      .map((tag) => renderTag(tag, "fuvar-card-tag"))
      .join("");

    const partnerAssignment = fuvar.spediccio
      ? `<div class="fuvar-partner-assignment">🤝 Partnerhez rendelés${fuvar.spediccioPartner ? ` • ${fuvar.spediccioPartner}` : ""}</div>`
      : "";

    const recommendationHtml = importRecommendation?.fuvarId === fuvar.id
      ? `<div class="fuvar-import-recommendation">💡 Ajánlott visszfuvar a [${importRecommendation.basedOnFuvarId}] export lerakási pontjához</div>`
      : "";

    const soforName = getAssignedResourceName("sofor", fuvar.assignedSoforId);
    const vontatoName = getAssignedResourceName("vontato", fuvar.assignedVontatoId);
    const potkocsiName = getAssignedResourceName("potkocsi", fuvar.assignedPotkocsiId);

    const viszonylatLabel = { export: "Export", import: "Import", belfold: "Belföld" }[fuvar.viszonylat] ?? fuvar.viszonylat;
    const isFullyAssigned = fuvar.assignedSoforId && fuvar.assignedVontatoId && fuvar.assignedPotkocsiId;
    const statusLabel = isFullyAssigned ? "✅ Kész" : (fuvar.assignedSoforId || fuvar.assignedVontatoId || fuvar.assignedPotkocsiId) ? "🔨 Tervezés" : "⬜ Szabad";

    const clearBtnHtml = isFullyAssigned
      ? `<button type="button" class="fuvar-resource-clear-btn fuvar-header-clear-btn" data-action="clear-fuvar-assignment">Erőforrás törlés</button>`
      : "";

    const context = {
      soforName,
      vontatoName,
      potkocsiName,
      statusLabel,
      viszonylatLabel,
      isFullyAssigned
    };

    rowModels.push({
      fuvar,
      partnerAssignment,
      recommendationHtml,
      tagsHtml,
      clearBtnHtml,
      context
    });
  });

  if (currentFuvarSort.columnId && effectiveColumns.includes(currentFuvarSort.columnId)) {
    const sortMeta = getColumnMeta(currentFuvarSort.columnId);

    rowModels.sort((left, right) => {
      const optionMeta = FUVAR_CARD_COLUMN_OPTION_MAP.get(currentFuvarSort.columnId);

      const leftValue = optionMeta?.excelLabel
        ? getExcelFieldSortValue(left.fuvar, optionMeta.excelLabel, left.context)
        : getBaseColumnSortValue(left.fuvar, currentFuvarSort.columnId, left.context);
      const rightValue = optionMeta?.excelLabel
        ? getExcelFieldSortValue(right.fuvar, optionMeta.excelLabel, right.context)
        : getBaseColumnSortValue(right.fuvar, currentFuvarSort.columnId, right.context);

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

  headerRow.innerHTML = effectiveColumns.map((columnId) => {
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

  rowModels.forEach(({ fuvar, partnerAssignment, recommendationHtml, tagsHtml, clearBtnHtml, context }) => {
    const card = document.createElement("div");
    card.className = "menu-card";
    card.style.marginBottom = "6px";
    card.dataset.id = fuvar.id;

    const categoryPalette = getCategoryPalette(fuvar.kategoria || fuvar.viszonylat || "all");
    card.style.setProperty("--fuvar-card-bg", categoryPalette.softBg);
    card.style.setProperty("--fuvar-card-bg-strong", categoryPalette.softBgStrong);
    card.style.setProperty("--fuvar-card-border", categoryPalette.border);
    card.style.setProperty("--fuvar-card-glow", categoryPalette.glow);

    if (focusedFuvarId === fuvar.id) {
      card.classList.add("active-fuvar");
    }

    const columnsHtml = effectiveColumns.map((columnId) => {
      const optionMeta = FUVAR_CARD_COLUMN_OPTION_MAP.get(columnId);
      if (!optionMeta) {
        return "";
      }

      const value = optionMeta.excelLabel
        ? getExcelFieldValue(fuvar, optionMeta.excelLabel, context)
        : getBaseColumnDisplayValue(fuvar, columnId, context);

      const extraClass = columnId === "distance"
        ? " fuvar-card-distance"
        : columnId === "route"
          ? " fuvar-card-route"
          : "";

      return `
        <div class="fuvar-card-item${extraClass}" style="${getColumnWidthStyle(columnId)}">
          <span class="fuvar-card-item-value">${value}</span>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="fuvar-card-header">
        <div class="fuvar-card-header-left">
          <h3 class="fuvar-card-title">${fuvar.megnevezes}</h3>
          ${clearBtnHtml}
        </div>
        <div class="fuvar-tag-list">${tagsHtml}</div>
      </div>
      ${partnerAssignment}
      ${recommendationHtml}
      <div class="fuvar-card-grid">
        ${columnsHtml}
      </div>
    `;

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
  });
}
