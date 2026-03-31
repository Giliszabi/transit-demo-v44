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
const FIXED_CATEGORY_COLORS = {
  belfold: "#66BB6A",
  export: "#42A5F5",
  import: "#FFB74D",
  spediccio: "#AB47BC"
};

const FUVAR_TAG_META = {
  all: {
    label: "Összes",
    color: "#78909C",
    textColor: "#F5F7FA"
  },
  adr: {
    label: "ADR",
    color: "#E53935",
    textColor: "#FFF4F4"
  },
  surgos: {
    label: "Sürgős",
    color: "#FB8C00",
    textColor: "#FFF8F1"
  },
  belfold: {
    label: "Belföld",
    color: FIXED_CATEGORY_COLORS.belfold,
    textColor: "#F3FFF6"
  },
  export: {
    label: "Export",
    color: FIXED_CATEGORY_COLORS.export,
    textColor: "#F3FAFF"
  },
  import: {
    label: "Import",
    color: FIXED_CATEGORY_COLORS.import,
    textColor: "#FFF8EF"
  },
  elofutas: {
    label: "Előfutás",
    color: "#2E9A79",
    textColor: "#F2FFF8"
  },
  utofutas: {
    label: "Utófutás",
    color: "#B66A2B",
    textColor: "#FFF6EC"
  },
  spediccio: {
    label: "Spedicció",
    color: FIXED_CATEGORY_COLORS.spediccio,
    textColor: "#FCF5FF"
  },
  ajanlatkeres: {
    label: "Ajánlatkérés",
    color: "#00ACC1",
    textColor: "#E8FBFF"
  }
};

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "").trim();
  if (normalized.length !== 6) {
    return { r: 79, g: 195, b: 247 };
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return { r: 79, g: 195, b: 247 };
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getReadableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.63 ? "#10202a" : "#f6fbff";
}

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
  if (FIXED_CATEGORY_COLORS[category]) {
    return FIXED_CATEGORY_COLORS[category];
  }
  return getOrAssignRandomColor(category);
}

export function getFuvarTagMeta(tag) {
  return FUVAR_TAG_META[tag] || {
    label: tag,
    color: getCategoryColor(tag),
    textColor: "#ffffff"
  };
}

export function getCategoryPalette(category) {
  const meta = getFuvarTagMeta(category);
  const accent = meta.color;

  return {
    accent,
    text: meta.textColor || getReadableTextColor(accent),
    badgeText: getReadableTextColor(accent),
    softBg: rgbaFromHex(accent, 0.12),
    softBgStrong: rgbaFromHex(accent, 0.18),
    border: rgbaFromHex(accent, 0.42),
    borderStrong: rgbaFromHex(accent, 0.62),
    glow: rgbaFromHex(accent, 0.22)
  };
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
