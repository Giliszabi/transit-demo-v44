// =============================================================
// TransIT v4.4 – SZÍNKEZELŐ MODUL
// - Kategória színek (export, import, belföld, spedi)
// - Státusz színek (új, folyamatban, lezárt)
// - Stabil random generálás ugyanarra a kulcsra
// - Használja: fuvar-panel, timeline, matching engine, filters
// =============================================================

// Profibb, jól olvasható TMS-paletta
const COLOR_POOL = [
  "#4FC3F7", // világoskék
  "#FFB74D", // narancs
  "#9575CD", // lila
  "#4DB6AC", // türkiz
  "#F06292", // pink
  "#7986CB", // indigo
  "#81C784", // zöld
  "#BA68C8", // középlila
  "#FF8A65", // lazac
  "#90A4AE"  // szürkés-kék
];

// Lokális tár kategóriák és színek tárolására
const CATEGORY_COLORS = {};
const STATUS_COLORS = {};

// =============================================================
// Stabil random generátor kulcs alapján
// =============================================================
function getOrAssignRandomColor(key) {
  if (!CATEGORY_COLORS[key]) {
    const color = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
    CATEGORY_COLORS[key] = color;
  }
  return CATEGORY_COLORS[key];
}

// =============================================================
// Fuvar kategória színek
// "belfold" | "export" | "import" | "spediccio"
// =============================================================
export function getCategoryColor(category) {
  if (!category) return "#ccc";
  return getOrAssignRandomColor(category);
}

// =============================================================
// Fuvar státusz színek
// "uj" | "folyamatban" | "lezart"
// =============================================================
STATUS_COLORS["uj"]          = "#4fc3f7"; // kék
STATUS_COLORS["folyamatban"] = "#ffb74d"; // narancs
STATUS_COLORS["lezart"]      = "#90a4ae"; // szürkés-kék

export function getStatusColor(status) {
  return STATUS_COLORS[status] || "#ccc";
}

// =============================================================
// Exportáljuk a raw belső mappinget (ha valahol kell debug)
// =============================================================
export function _debugCategoryColors() {
  return CATEGORY_COLORS;
}

export function _debugStatusColors() {
  return STATUS_COLORS;
}
