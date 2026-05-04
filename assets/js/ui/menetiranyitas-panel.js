import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { loadGeneratedPlanningData } from "../data/generated-loader.js";
import { buildEligibilityIndex } from "../core/eligibility-engine.js";
import { ensureContinuousTimelines } from "./timeline-generator.js";
import { renderTimeline } from "./timeline.js";
import { renderSzerelvenyMap } from "./szerelveny-map.js";
import { getAssemblyOperationLogEntries, renderSzerelvenyTimeline } from "./szerelveny-timeline.js";

const CONTINUOUS_LIMIT_MIN = 4 * 60 + 30;
const DAILY_LIMIT_NORMAL_MIN = 9 * 60;
const DAILY_LIMIT_EXTENDED_MIN = 10 * 60;
const WEEKLY_LIMIT_MIN = 56 * 60;
const FORTNIGHT_LIMIT_MIN = 90 * 60;
const DAILY_REST_SHORT_MIN = 9 * 60;
const DAILY_REST_LONG_MIN = 11 * 60;
const WEEKLY_REST_REDUCED_MIN = 24 * 60;
const WEEKLY_REST_REGULAR_MIN = 45 * 60;

const REFRESH_INTERVAL_MS = 30000;

const STATUS_META = {
  driving: { label: "Vezetés", className: "seg-driving", icon: "🚛" },
  rest: { label: "Pihenő", className: "seg-rest", icon: "🛌" },
  leave: { label: "Szabadság", className: "seg-rest", icon: "🌿" },
  work: { label: "Egyéb munka", className: "seg-work", icon: "🛠️" },
  standby: { label: "Készenlét", className: "seg-standby", icon: "⏳" },
  warning: { label: "Lehetséges jogsértés", className: "seg-warning", icon: "⚠️" }
};

const RISK_META = {
  green: { label: "Biztonságos", className: "risk-green" },
  yellow: { label: "Közepes kockázat", className: "risk-yellow" },
  red: { label: "Magas kockázat", className: "risk-red" }
};

const RISK_FILTER_META = {
  all: {
    label: "Összes",
    shortLabel: "Minden gépjárművezető",
    description: "A teljes heatmap lista megjelenítése szűrés nélkül.",
    className: "risk-filter-all"
  },
  red: {
    ...RISK_META.red,
    shortLabel: "Piros",
    description: "Kritikus szabály- vagy ETA-kockázat, azonnali diszpécseri figyelmet igényel."
  },
  yellow: {
    ...RISK_META.yellow,
    shortLabel: "Sárga",
    description: "Közelgő limit vagy szűkülő pihenőablak, előkészítést igényel."
  },
  green: {
    ...RISK_META.green,
    shortLabel: "Zöld",
    description: "A vezetési és pihenőidő ablakok jelenleg biztonságos tartományban vannak."
  }
};

const CITY_COORDS = {
  budapest: [47.4979, 19.0402],
  gyor: [47.6875, 17.6504],
  tatabanya: [47.5692, 18.4048],
  szekesfehervar: [47.1860, 18.4221],
  kecskemet: [46.9062, 19.6913],
  pecs: [46.0727, 18.2323],
  miskolc: [48.1035, 20.7784],
  debrecen: [47.5316, 21.6273],
  szeged: [46.2530, 20.1414],
  nyiregyhaza: [47.9558, 21.7167],
  szombathely: [47.2307, 16.6218],
  frankfurt: [50.1109, 8.6821],
  wien: [48.2082, 16.3738],
  munchen: [48.1351, 11.5820],
  milano: [45.4642, 9.1900],
  brno: [49.1951, 16.6068],
  linz: [48.3069, 14.2858]
};

const CITY_LABELS = {
  budapest: "Budapest",
  gyor: "Győr",
  tatabanya: "Tatabánya",
  szekesfehervar: "Székesfehérvár",
  kecskemet: "Kecskemét",
  pecs: "Pécs",
  miskolc: "Miskolc",
  debrecen: "Debrecen",
  szeged: "Szeged",
  nyiregyhaza: "Nyíregyháza",
  szombathely: "Szombathely",
  frankfurt: "Frankfurt",
  wien: "Wien",
  munchen: "München",
  milano: "Milano",
  brno: "Brno",
  linz: "Linz"
};

const CORRIDOR_BY_CITY = {
  budapest: "M0",
  gyor: "M1",
  tatabanya: "M1",
  szekesfehervar: "M7",
  kecskemet: "M5",
  pecs: "M6",
  miskolc: "M3",
  debrecen: "M35",
  szeged: "M5",
  nyiregyhaza: "M3",
  szombathely: "M86",
  frankfurt: "A3",
  wien: "A4",
  munchen: "A8",
  milano: "A4",
  brno: "D1",
  linz: "A1"
};

const REST_POINTS = [
  {
    name: "Győr M1 Truckpark",
    kind: "parking",
    corridors: ["M1"],
    baseDetourMin: 12,
    coords: [47.7018, 17.6213]
  },
  {
    name: "Nickelsdorf Autohof",
    kind: "parking",
    corridors: ["M1", "A4"],
    baseDetourMin: 38,
    coords: [47.9451, 17.0741]
  },
  {
    name: "OMV M1 Biatorbágy",
    kind: "fuel",
    corridors: ["M1", "M0"],
    baseDetourMin: 15,
    coords: [47.4708, 18.8332]
  },
  {
    name: "Székesfehérvár Truck Service",
    kind: "service",
    corridors: ["M7", "M1"],
    baseDetourMin: 18,
    coords: [47.1897, 18.4448]
  },
  {
    name: "Kecskemét M5 Depó",
    kind: "depot",
    corridors: ["M5"],
    baseDetourMin: 14,
    coords: [46.9093, 19.6889]
  },
  {
    name: "Szeged M5 Truckpark",
    kind: "parking",
    corridors: ["M5"],
    baseDetourMin: 21,
    coords: [46.2531, 20.1480]
  },
  {
    name: "Miskolc M30 pihenő",
    kind: "parking",
    corridors: ["M3"],
    baseDetourMin: 16,
    coords: [48.1102, 20.7671]
  },
  {
    name: "Debrecen Logisztikai Depot",
    kind: "depot",
    corridors: ["M35", "M3"],
    baseDetourMin: 22,
    coords: [47.5222, 21.6408]
  },
  {
    name: "Linz Truck Center",
    kind: "service",
    corridors: ["A1"],
    baseDetourMin: 27,
    coords: [48.3037, 14.2862]
  },
  {
    name: "Frankfurt Ost Parkzone",
    kind: "parking",
    corridors: ["A3"],
    baseDetourMin: 24,
    coords: [50.1166, 8.7398]
  }
];

const REST_POINT_ICONS = {
  parking: "🅿️",
  service: "🔧",
  fuel: "⛽",
  depot: "🏭"
};

const appState = {
  profiles: [],
  alerts: [],
  exportFilters: {
    driverQuery: "",
    vehicleQuery: "",
    jobQuery: "",
    workPattern: "all",
    matchRule: "all"
  },
  riskFilter: "all",
  selectedDriverId: null,
  selectedExportDate: null,
  refreshTimerId: null,
  generatedPlanning: null
};

const TIMELINE_PANEL_IDS = ["assembly-timeline", "resource-timeline"];

let timelineDockLayoutState = {
  zones: {
    left: ["assembly-timeline"],
    right: ["resource-timeline"],
    full: []
  }
};

window.addEventListener("DOMContentLoaded", initMenetiranyitasPanel);
window.addEventListener("keydown", onGlobalKeydown);
window.addEventListener("beforeunload", () => {
  if (appState.refreshTimerId) {
    clearInterval(appState.refreshTimerId);
  }
});

async function initMenetiranyitasPanel() {
  appState.generatedPlanning = await loadGeneratedPlanningData();
  appState.selectedExportDate = appState.generatedPlanning?.planningContext?.effectiveExportDate
    || appState.generatedPlanning?.planningContext?.planningDate
    || null;

  ensureContinuousTimelines(SOFOROK, VONTATOK, POTKOCSIK);
  ensureDemoRigAssignments();

  initTimelineDockLayout();

  renderSzerelvenyMap("monitor-map-container", SOFOROK, VONTATOK, POTKOCSIK);
  renderResourceTimelinePanel();

  if (document.getElementById("assembly-timeline-container")) {
    renderSzerelvenyTimeline("assembly-timeline-container", SOFOROK, VONTATOK, POTKOCSIK);
  }

  window.addEventListener("assembly:resources:changed", () => {
    renderSzerelvenyMap("monitor-map-container", SOFOROK, VONTATOK, POTKOCSIK);
    renderResourceTimelinePanel();

    if (document.getElementById("assembly-timeline-container")) {
      renderSzerelvenyTimeline("assembly-timeline-container", SOFOROK, VONTATOK, POTKOCSIK);
    }

    refreshDashboard({ preserveSelection: true, focusMode: "none" });
  });

  const driverList = document.getElementById("driver-state-list");
  const exportDriverList = document.getElementById("export-driver-list");
  const exportDateSwitcher = document.getElementById("export-date-switcher");
  const exportTableFilters = document.getElementById("export-table-filters");
  const exportTableContainer = document.getElementById("export-table-container");
  const alertsList = document.getElementById("monitor-alerts-list");
  const riskLegend = document.getElementById("risk-legend");

  if (driverList) {
    driverList.addEventListener("click", onDriverListClick);
    driverList.addEventListener("keydown", onDriverListKeydown);
  }

  if (exportDriverList) {
    exportDriverList.addEventListener("click", onDriverListClick);
    exportDriverList.addEventListener("keydown", onDriverListKeydown);
  }

  if (exportTableContainer) {
    exportTableContainer.addEventListener("click", onDriverListClick);
    exportTableContainer.addEventListener("keydown", onDriverListKeydown);
  }

  if (exportTableFilters) {
    exportTableFilters.addEventListener("input", onExportTableFiltersChanged);
    exportTableFilters.addEventListener("change", onExportTableFiltersChanged);
  }

  if (exportDateSwitcher) {
    exportDateSwitcher.addEventListener("click", onExportDateSwitcherClick);
    exportDateSwitcher.addEventListener("keydown", onExportDateSwitcherKeydown);
    exportDateSwitcher.addEventListener("change", onExportDateSwitcherChange);
  }

  if (alertsList) {
    alertsList.addEventListener("click", onAlertListClick);
    alertsList.addEventListener("keydown", onAlertListKeydown);
  }

  if (riskLegend) {
    riskLegend.addEventListener("click", onRiskLegendClick);
    riskLegend.addEventListener("keydown", onRiskLegendKeydown);
  }

  refreshDashboard({ preserveSelection: false, focusMode: "assembly" });
  startAutoRefresh();

  setTimeout(() => {
    const selectedProfile = getSelectedProfile();
    if (selectedProfile) {
      syncMapFocus(selectedProfile, "assembly");
    }
  }, 220);
}

function getTimelinePanelElement(panelId) {
  return document.getElementById(`monitor-panel-${panelId}`);
}

function cloneTimelineDockLayout(layout) {
  return {
    zones: {
      left: [...(layout?.zones?.left || [])],
      right: [...(layout?.zones?.right || [])],
      full: [...(layout?.zones?.full || [])]
    }
  };
}

function getTimelineZoneByPanel(panelId) {
  if (timelineDockLayoutState.zones.left.includes(panelId)) {
    return "left";
  }

  if (timelineDockLayoutState.zones.right.includes(panelId)) {
    return "right";
  }

  if (timelineDockLayoutState.zones.full.includes(panelId)) {
    return "full";
  }

  return null;
}

function dockTimelinePanelToZone(panelId, zone) {
  if (!TIMELINE_PANEL_IDS.includes(panelId) || !["left", "right"].includes(zone)) {
    return;
  }

  const next = cloneTimelineDockLayout(timelineDockLayoutState);
  next.zones.left = next.zones.left.filter((id) => id !== panelId);
  next.zones.right = next.zones.right.filter((id) => id !== panelId);
  next.zones.full = next.zones.full.filter((id) => id !== panelId);
  next.zones[zone].push(panelId);
  timelineDockLayoutState = next;
  applyTimelineDockLayout();
}

function toggleTimelinePanelFullwidth(panelId) {
  if (!TIMELINE_PANEL_IDS.includes(panelId)) {
    return;
  }

  const next = cloneTimelineDockLayout(timelineDockLayoutState);
  const isFull = next.zones.full.includes(panelId);

  if (isFull) {
    next.zones.full = next.zones.full.filter((id) => id !== panelId);
    const fallbackZone = panelId === "resource-timeline" ? "right" : "left";
    next.zones[fallbackZone].push(panelId);
  } else {
    next.zones.left = next.zones.left.filter((id) => id !== panelId);
    next.zones.right = next.zones.right.filter((id) => id !== panelId);
    next.zones.full.push(panelId);
  }

  timelineDockLayoutState = next;
  applyTimelineDockLayout();
}

function moveTimelinePanelOneStep(panelId, direction) {
  if (!TIMELINE_PANEL_IDS.includes(panelId) || !["up", "down"].includes(direction)) {
    return;
  }

  const next = cloneTimelineDockLayout(timelineDockLayoutState);
  const zone = ["left", "right", "full"].find((zoneName) => next.zones[zoneName].includes(panelId));
  if (!zone) {
    return;
  }

  const list = next.zones[zone];
  const index = list.indexOf(panelId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= list.length) {
    return;
  }

  [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
  timelineDockLayoutState = next;
  applyTimelineDockLayout();
}

function updateTimelinePanelButtons(panelId) {
  const panel = getTimelinePanelElement(panelId);
  if (!panel) {
    return;
  }

  const zone = getTimelineZoneByPanel(panelId);
  const zoneList = zone ? (timelineDockLayoutState.zones[zone] || []) : [];
  const index = zone ? zoneList.indexOf(panelId) : -1;

  const leftBtn = panel.querySelector('[data-action="dock-left"]');
  const rightBtn = panel.querySelector('[data-action="dock-right"]');
  const upBtn = panel.querySelector('[data-action="move-up"]');
  const downBtn = panel.querySelector('[data-action="move-down"]');
  const fullBtn = panel.querySelector('[data-action="toggle-fullwidth"]');

  leftBtn?.classList.toggle("active-zone", zone === "left");
  rightBtn?.classList.toggle("active-zone", zone === "right");

  if (fullBtn) {
    fullBtn.textContent = zone === "full" ? "Fél szélesség" : "Teljes szélesség";
  }

  if (upBtn) {
    upBtn.disabled = index <= 0;
  }

  if (downBtn) {
    downBtn.disabled = index < 0 || index >= zoneList.length - 1;
  }
}

function applyTimelineDockLayout() {
  const leftColumn = document.querySelector('#monitor-dock-layout .dock-column[data-zone="left"]');
  const rightColumn = document.querySelector('#monitor-dock-layout .dock-column[data-zone="right"]');
  const fullColumn = document.querySelector('#monitor-dock-layout .dock-column[data-zone="full"]');

  const appendPanel = (column, panelId) => {
    const panel = getTimelinePanelElement(panelId);
    if (!column || !panel) {
      return;
    }
    panel.classList.remove("hidden-by-layout");
    column.appendChild(panel);
  };

  TIMELINE_PANEL_IDS.forEach((panelId) => {
    getTimelinePanelElement(panelId)?.classList.remove("hidden-by-layout");
  });

  timelineDockLayoutState.zones.left.forEach((panelId) => appendPanel(leftColumn, panelId));
  timelineDockLayoutState.zones.right.forEach((panelId) => appendPanel(rightColumn, panelId));
  timelineDockLayoutState.zones.full.forEach((panelId) => appendPanel(fullColumn, panelId));

  TIMELINE_PANEL_IDS.forEach((panelId) => {
    updateTimelinePanelButtons(panelId);
  });
}

function bindTimelineDockToolbarActions() {
  TIMELINE_PANEL_IDS.forEach((panelId) => {
    const panel = getTimelinePanelElement(panelId);
    if (!panel) {
      return;
    }

    panel.querySelector('[data-action="move-up"]')?.addEventListener("click", () => {
      moveTimelinePanelOneStep(panelId, "up");
    });

    panel.querySelector('[data-action="move-down"]')?.addEventListener("click", () => {
      moveTimelinePanelOneStep(panelId, "down");
    });

    panel.querySelector('[data-action="dock-left"]')?.addEventListener("click", () => {
      dockTimelinePanelToZone(panelId, "left");
    });

    panel.querySelector('[data-action="dock-right"]')?.addEventListener("click", () => {
      dockTimelinePanelToZone(panelId, "right");
    });

    panel.querySelector('[data-action="toggle-fullwidth"]')?.addEventListener("click", () => {
      toggleTimelinePanelFullwidth(panelId);
    });
  });
}

function initTimelineDockLayout() {
  const dockLayout = document.getElementById("monitor-dock-layout");
  if (!dockLayout) {
    return;
  }

  bindTimelineDockToolbarActions();
  applyTimelineDockLayout();
}

function renderResourceTimelinePanel() {
  if (!document.getElementById("timeline-container")) {
    return;
  }

  renderTimeline("timeline-container", [
    { icon: "👤", name: "Gépjárművezetők", list: SOFOROK },
    { icon: "🚛", name: "Vontatók", list: VONTATOK },
    { icon: "🚚", name: "Pótkocsik", list: POTKOCSIK }
  ]);
}

function startAutoRefresh() {
  if (appState.refreshTimerId) {
    clearInterval(appState.refreshTimerId);
  }

  appState.refreshTimerId = setInterval(() => {
    refreshDashboard({ preserveSelection: true, focusMode: "none" });
  }, REFRESH_INTERVAL_MS);
}

function refreshDashboard(options = {}) {
  const { preserveSelection = true, focusMode = "assembly" } = options;
  const now = new Date();
  ensureSelectedExportDate();

  const profiles = buildDriverProfiles(now);
  const filteredProfiles = getRiskFilteredProfiles(profiles);
  appState.profiles = profiles;
  appState.alerts = buildAlerts(profiles);

  if (!preserveSelection) {
    appState.selectedDriverId = null;
  } else if (!filteredProfiles.some((profile) => profile.driver.id === appState.selectedDriverId)) {
    appState.selectedDriverId = null;
  }

  const selectedProfile = getSelectedProfile();

  renderKpiStrip(profiles);
  renderRiskLegend(profiles);
  renderPlanningContextStrip();
  renderExportDateSwitcher();
  renderExportTableFilters(profiles);
  renderExportTable(profiles, appState.selectedDriverId);
  renderExportDriverList(profiles, appState.selectedDriverId);
  renderDriverStateList(filteredProfiles, appState.selectedDriverId);
  renderMainPanel(selectedProfile, now);
  renderInsightsPanel(selectedProfile);
  renderOperationLogPanel();
  renderAlertsPanel(appState.alerts, appState.selectedDriverId);

  if (selectedProfile && focusMode !== "none") {
    syncMapFocus(selectedProfile, focusMode);
  }
}

function ensureDemoRigAssignments() {
  SOFOROK.forEach((driver) => {
    delete driver.linkedVontatoId;
  });

  VONTATOK.forEach((vontato) => {
    delete vontato.linkedSoforId;
    delete vontato.linkedPotkocsiId;
  });

  POTKOCSIK.forEach((potkocsi) => {
    delete potkocsi.linkedVontatoId;
  });

  const pairCount = Math.min(SOFOROK.length, VONTATOK.length, POTKOCSIK.length);

  for (let i = 0; i < pairCount; i += 1) {
    const driver = SOFOROK[i];
    const vontato = VONTATOK[i];
    const potkocsi = POTKOCSIK[i];

    driver.linkedVontatoId = vontato.id;
    vontato.linkedSoforId = driver.id;
    vontato.linkedPotkocsiId = potkocsi.id;
    potkocsi.linkedVontatoId = vontato.id;

    const primaryFuvar = FUVAROK[i % FUVAROK.length];
    const secondaryFuvar = FUVAROK[(i + 3) % FUVAROK.length];

    ensureResourceFuvarBlock(driver, primaryFuvar);
    ensureResourceFuvarBlock(vontato, primaryFuvar);
    ensureResourceFuvarBlock(potkocsi, primaryFuvar);

    if (i % 2 === 0) {
      ensureResourceFuvarBlock(driver, secondaryFuvar);
      ensureResourceFuvarBlock(vontato, secondaryFuvar);
      ensureResourceFuvarBlock(potkocsi, secondaryFuvar);
    }
  }
}

function ensureResourceFuvarBlock(resource, fuvar) {
  if (!resource || !fuvar) {
    return;
  }

  if (!Array.isArray(resource.timeline)) {
    resource.timeline = [];
  }

  const alreadyExists = resource.timeline.some((block) => {
    return !block.synthetic && block.type === "fuvar" && block.fuvarId === fuvar.id;
  });

  if (alreadyExists) {
    return;
  }

  resource.timeline.push({
    start: fuvar.felrakas.ido,
    end: fuvar.lerakas.ido,
    type: "fuvar",
    label: fuvar.megnevezes,
    fuvarId: fuvar.id,
    felrakasCim: fuvar.felrakas.cim,
    lerakasCim: fuvar.lerakas.cim,
    adr: Boolean(fuvar.adr),
    surgos: Boolean(fuvar.surgos),
    kategoria: fuvar.kategoria || fuvar.viszonylat || "fuvar"
  });

  resource.timeline.sort((a, b) => {
    return new Date(a.start) - new Date(b.start);
  });
}

function buildDriverProfiles(now) {
  const planningDate = appState.generatedPlanning?.planningContext?.planningDate || now.toISOString().slice(0, 10);
  const selectedExportDate = getSelectedExportDate();
  const eligibilityIndex = buildEligibilityIndex({
    drivers: SOFOROK,
    driverSchedules: appState.generatedPlanning?.driverSchedules || [],
    vehicles: VONTATOK,
    jobs: FUVAROK,
    planningDate
  });

  return SOFOROK.map((driver, index) => {
    const eligibility = eligibilityIndex.get(driver.id) || null;
    driver.dispatchEligibility = eligibility;
    const exportAssignments = resolveExportAssignmentsForDriver(driver, selectedExportDate);
    return buildDriverProfile(driver, index, now, eligibility, exportAssignments);
  });
}

function buildDriverProfile(driver, index, now, eligibility, exportAssignments = []) {
  const currentBlock = findCurrentBlock(driver.timeline || [], now);
  const seedBase = makeSeed(`${driver.id}|${driver.nev}`);
  const timeBucket = Math.floor(now.getTime() / (15 * 60 * 1000));
  const seed = seedBase + timeBucket * 17 + index * 29;

  const statusKey = resolveStatusKey(currentBlock, seed);
  const metrics = computeRuleMetrics(statusKey, seed, index);
  const risk = evaluateRisk(metrics, statusKey);

  const rig = resolveRigForDriver(driver);
  const activeFuvar = resolveActiveFuvar(rig, index, now);
  const eta = computeEtaProjection(activeFuvar, metrics, risk, seed, now);
  const predictionEvents = buildPredictionEvents(driver, metrics, risk, seed, now);
  const recommendedStops = buildRestRecommendations(driver, metrics, seed);
  const compatibility = evaluateFuvarCompatibility(activeFuvar, metrics, eta, risk, seed, now);
  const strip = buildTachoStrip(statusKey, metrics, risk, now);
  const primaryExportAssignment = exportAssignments[0] || null;

  return {
    driver,
    eligibility,
    exportAssignments,
    primaryExportAssignment,
    status: {
      key: statusKey,
      ...STATUS_META[statusKey]
    },
    metrics,
    risk,
    rig,
    activeFuvar,
    eta,
    predictionEvents,
    recommendedStops,
    compatibility,
    strip
  };
}

function resolveExportAssignmentsForDriver(driver, selectedExportDate) {
  const assignments = appState.generatedPlanning?.exportAssignments;
  if (!Array.isArray(assignments) || !assignments.length || !driver) {
    return [];
  }

  const driverKey = normalizePlanningKey(driver.nev || driver.name || driver.id);
  const vehiclePlateKey = normalizePlanningKey(driver.dedicatedVehiclePlate || "");
  const linkedVehiclePlateKey = normalizePlanningKey(resolveRigForDriver(driver)?.vontato?.rendszam || "");

  return assignments.filter((assignment) => {
    if (selectedExportDate && String(assignment.exportDate || "").slice(0, 10) !== selectedExportDate) {
      return false;
    }
    const assignmentVehicleKey = normalizePlanningKey(assignment.vehiclePlate || "");
    const driverMatch = (assignment.driverNames || []).some((name) => normalizePlanningKey(name) === driverKey);
    const vehicleMatch = Boolean(assignmentVehicleKey)
      && (assignmentVehicleKey === vehiclePlateKey || assignmentVehicleKey === linkedVehiclePlateKey);
    return driverMatch || vehicleMatch;
  });
}

function getAvailableExportDates() {
  const dates = appState.generatedPlanning?.planningContext?.availableExportDates;
  if (Array.isArray(dates) && dates.length) {
    return dates
      .filter((item) => Number(item.parsedAssignmentCount || 0) > 0)
      .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
  }

  const exportAssignments = appState.generatedPlanning?.exportAssignments || [];
  const uniqueDates = [...new Set(exportAssignments.map((item) => String(item.exportDate || "").slice(0, 10)).filter(Boolean))].sort();
  return uniqueDates
    .map((date) => ({ date, parsedAssignmentCount: getExportAssignmentsForDate(date).length }))
    .filter((item) => Number(item.parsedAssignmentCount || 0) > 0)
    .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
}

function ensureSelectedExportDate() {
  const availableDates = getAvailableExportDates();
  if (!availableDates.length) {
    appState.selectedExportDate = appState.generatedPlanning?.planningContext?.effectiveExportDate
      || appState.generatedPlanning?.planningContext?.planningDate
      || null;
    return;
  }

  const availableDateKeys = new Set(availableDates.map((item) => item.date));
  if (!appState.selectedExportDate || !availableDateKeys.has(appState.selectedExportDate)) {
    const effectiveDate = appState.generatedPlanning?.planningContext?.effectiveExportDate;
    appState.selectedExportDate = availableDateKeys.has(effectiveDate)
      ? effectiveDate
      : availableDates[0].date;
  }
}

function getSelectedExportDate() {
  ensureSelectedExportDate();
  return appState.selectedExportDate;
}

function getExportAssignmentsForDate(exportDate) {
  const normalizedDate = String(exportDate || "").slice(0, 10);
  return (appState.generatedPlanning?.exportAssignments || []).filter((assignment) => {
    return String(assignment.exportDate || "").slice(0, 10) === normalizedDate;
  });
}

function resolveAssignmentDriverMatch(assignment, profiles) {
  const assignmentVehicleKey = normalizePlanningKey(assignment.vehiclePlate || "");
  const assignmentDriverKeys = new Set((assignment.driverNames || []).map((name) => normalizePlanningKey(name)).filter(Boolean));
  const matchedProfiles = [];

  profiles.forEach((profile) => {
    const driverKey = normalizePlanningKey(profile.driver.nev || profile.driver.name || profile.driver.id);
    const dedicatedVehicleKey = normalizePlanningKey(profile.driver.dedicatedVehiclePlate || "");
    const linkedVehicleKey = normalizePlanningKey(profile.rig.vontato?.rendszam || "");
    const byName = assignmentDriverKeys.has(driverKey);
    const byVehicle = Boolean(assignmentVehicleKey)
      && (assignmentVehicleKey === dedicatedVehicleKey || assignmentVehicleKey === linkedVehicleKey);

    if (!byName && !byVehicle) {
      return;
    }

    matchedProfiles.push({
      id: profile.driver.id,
      name: profile.driver.nev,
      byName,
      byVehicle
    });
  });

  let matchRule = "none";
  let matchLabel = "Nincs párosítás";
  let confidenceTone = "low";

  if (matchedProfiles.length === 1) {
    const match = matchedProfiles[0];
    if (match.byName && match.byVehicle) {
      matchRule = "both";
      matchLabel = "Név + rendszám";
      confidenceTone = "high";
    } else if (match.byName) {
      matchRule = "name";
      matchLabel = "Csak név";
      confidenceTone = "medium";
    } else {
      matchRule = "vehicle";
      matchLabel = "Csak rendszám";
      confidenceTone = "medium";
    }
  } else if (matchedProfiles.length > 1) {
    const allByName = matchedProfiles.every((match) => match.byName && !match.byVehicle);
    const allByVehicle = matchedProfiles.every((match) => match.byVehicle && !match.byName);
    matchRule = "multi";
    confidenceTone = "low";
    if (allByName) {
      matchLabel = "Több jelölt név alapján";
    } else if (allByVehicle) {
      matchLabel = "Több jelölt rendszám alapján";
    } else {
      matchLabel = "Több vegyes jelölt";
    }
  }

  return {
    matchedProfiles,
    primaryProfile: matchedProfiles.length === 1 ? matchedProfiles[0] : null,
    matchRule,
    matchLabel,
    confidenceTone,
    matchedDriverLabel: matchedProfiles.length
      ? matchedProfiles.map((match) => match.name).join(", ")
      : "nincs felismert gépjárművezető"
  };
}

function renderExportTableFilters(profiles) {
  const container = document.getElementById("export-table-filters");
  if (!container) {
    return;
  }

  const assignments = getExportAssignmentsForDate(getSelectedExportDate());
  if (!assignments.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  const workPatterns = [...new Set(assignments.map((assignment) => assignment.originalWorkPatternCode || assignment.workPatternCode).filter(Boolean))].sort();
  const workPatternOptions = workPatterns
    .map((value) => `<option value="${escapeHtml(value)}"${appState.exportFilters.workPattern === value ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");

  container.hidden = false;
  container.innerHTML = `
    <div class="export-filter-grid">
      <label class="export-filter-field">
        <span>Gépjárművezető kereső</span>
        <input type="search" value="${escapeHtml(appState.exportFilters.driverQuery)}" data-export-filter="driverQuery" placeholder="név vagy részlet" />
      </label>
      <label class="export-filter-field">
        <span>Vontató</span>
        <input type="search" value="${escapeHtml(appState.exportFilters.vehicleQuery)}" data-export-filter="vehicleQuery" placeholder="rendszám" />
      </label>
      <label class="export-filter-field">
        <span>SZF-SZÁM</span>
        <input type="search" value="${escapeHtml(appState.exportFilters.jobQuery)}" data-export-filter="jobQuery" placeholder="fuvarszám" />
      </label>
      <label class="export-filter-field">
        <span>MI neve</span>
        <select data-export-filter="workPattern">
          <option value="all">Összes</option>
          ${workPatternOptions}
        </select>
      </label>
      <label class="export-filter-field">
        <span>Párosítás</span>
        <select data-export-filter="matchRule">
          <option value="all"${appState.exportFilters.matchRule === "all" ? " selected" : ""}>Összes</option>
          <option value="both"${appState.exportFilters.matchRule === "both" ? " selected" : ""}>Név + rendszám</option>
          <option value="name"${appState.exportFilters.matchRule === "name" ? " selected" : ""}>Csak név</option>
          <option value="vehicle"${appState.exportFilters.matchRule === "vehicle" ? " selected" : ""}>Csak rendszám</option>
          <option value="multi"${appState.exportFilters.matchRule === "multi" ? " selected" : ""}>Több jelölt</option>
          <option value="none"${appState.exportFilters.matchRule === "none" ? " selected" : ""}>Nincs párosítás</option>
        </select>
      </label>
    </div>
  `;
}

function applyExportTableFilters(rows) {
  const driverQuery = normalizePlanningKey(appState.exportFilters.driverQuery);
  const vehicleQuery = normalizePlanningKey(appState.exportFilters.vehicleQuery);
  const jobQuery = normalizePlanningKey(appState.exportFilters.jobQuery);
  const workPattern = appState.exportFilters.workPattern;
  const matchRule = appState.exportFilters.matchRule;

  return rows.filter(({ assignment, match }) => {
    const driverText = normalizePlanningKey((assignment.driverNames || []).join(" "));
    const vehicleText = normalizePlanningKey(assignment.vehiclePlate || "");
    const jobText = normalizePlanningKey(assignment.jobId || "");
    const workPatternText = String(assignment.originalWorkPatternCode || assignment.workPatternCode || "");

    if (driverQuery && !driverText.includes(driverQuery) && !normalizePlanningKey(match.matchedDriverLabel).includes(driverQuery)) {
      return false;
    }

    if (vehicleQuery && !vehicleText.includes(vehicleQuery)) {
      return false;
    }

    if (jobQuery && !jobText.includes(jobQuery)) {
      return false;
    }

    if (workPattern !== "all" && workPatternText !== workPattern) {
      return false;
    }

    if (matchRule !== "all" && match.matchRule !== matchRule) {
      return false;
    }

    return true;
  });
}

function findCurrentBlock(timeline, now) {
  const nowMs = now.getTime();

  return timeline.find((block) => {
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    return nowMs >= start && nowMs < end;
  }) || null;
}

function resolveStatusKey(block, seed) {
  if (!block) {
    return randomInt(seed + 3, 0, 1) === 0 ? "driving" : "rest";
  }

  if (block.type === "fuvar") {
    const mode = randomInt(seed + 5, 0, 10);
    if (mode < 7) {
      return "driving";
    }
    if (mode < 9) {
      return "work";
    }
    return "standby";
  }

  if (block.type === "piheno") {
    return "rest";
  }

  if (block.type === "szabadsag" || block.type === "beteg") {
    return "leave";
  }

  return "standby";
}

function computeRuleMetrics(statusKey, seed, index) {
  const usesExtendedDay = randomInt(seed + 7, 0, 10) > 6;
  const dailyLimitMin = usesExtendedDay ? DAILY_LIMIT_EXTENDED_MIN : DAILY_LIMIT_NORMAL_MIN;

  const continuousDrivenMin =
    statusKey === "driving" || statusKey === "work"
      ? randomInt(seed + 11, 72, 296)
      : randomInt(seed + 11, 0, 40);

  const continuousRemainingMin =
    statusKey === "driving" || statusKey === "work"
      ? Math.max(0, CONTINUOUS_LIMIT_MIN - continuousDrivenMin)
      : randomInt(seed + 13, 130, CONTINUOUS_LIMIT_MIN);

  let dailyUsedMin =
    statusKey === "leave"
      ? randomInt(seed + 17, 65, 235)
      : statusKey === "rest"
        ? randomInt(seed + 17, 180, 430)
        : randomInt(seed + 17, 320, 620);

  if (index % 2 === 0) {
    dailyUsedMin += randomInt(seed + 19, 0, 28);
  }

  const dailyRemainingMin = Math.max(0, dailyLimitMin - dailyUsedMin);

  const weeklyUsedMin = randomInt(seed + 23, 1880, WEEKLY_LIMIT_MIN + 240);
  const weeklyRemainingMin = Math.max(0, WEEKLY_LIMIT_MIN - weeklyUsedMin);

  const fortnightUsedMin = randomInt(seed + 29, 3560, FORTNIGHT_LIMIT_MIN + 220);
  const fortnightRemainingMin = Math.max(0, FORTNIGHT_LIMIT_MIN - fortnightUsedMin);

  const requiredDailyRestMin = randomInt(seed + 31, 0, 10) > 6 ? DAILY_REST_LONG_MIN : DAILY_REST_SHORT_MIN;
  const accruedDailyRestMin =
    statusKey === "rest" || statusKey === "leave"
      ? randomInt(seed + 37, 210, 820)
      : randomInt(seed + 37, 20, 240);
  const dailyRestRemainingMin = Math.max(0, requiredDailyRestMin - accruedDailyRestMin);

  const weeklyRestTargetMin = randomInt(seed + 41, 0, 10) > 5 ? WEEKLY_REST_REGULAR_MIN : WEEKLY_REST_REDUCED_MIN;
  const weeklyRestProgressMin =
    statusKey === "rest" || statusKey === "leave"
      ? randomInt(seed + 43, 280, weeklyRestTargetMin + 360)
      : randomInt(seed + 43, 20, Math.min(weeklyRestTargetMin, 920));
  const weeklyRestRemainingMin = Math.max(0, weeklyRestTargetMin - weeklyRestProgressMin);

  const weeklyRestDeadlineMin = randomInt(seed + 47, 100, 2600) - Math.floor(weeklyUsedMin / 11);

  const breakDueMin =
    statusKey === "driving" || statusKey === "work"
      ? continuousRemainingMin
      : randomInt(seed + 53, 160, 560);

  return {
    usesExtendedDay,
    dailyLimitMin,
    continuousDrivenMin,
    continuousRemainingMin,
    breakDueMin,
    dailyUsedMin,
    dailyRemainingMin,
    weeklyUsedMin,
    weeklyRemainingMin,
    fortnightUsedMin,
    fortnightRemainingMin,
    requiredDailyRestMin,
    accruedDailyRestMin,
    dailyRestRemainingMin,
    weeklyRestTargetMin,
    weeklyRestProgressMin,
    weeklyRestRemainingMin,
    weeklyRestDeadlineMin,
    dailyUtilization: safeRatio(dailyUsedMin, dailyLimitMin),
    weeklyUtilization: safeRatio(weeklyUsedMin, WEEKLY_LIMIT_MIN),
    fortnightUtilization: safeRatio(fortnightUsedMin, FORTNIGHT_LIMIT_MIN)
  };
}

function evaluateRisk(metrics, statusKey) {
  let score = 0;
  const reasons = [];

  if ((statusKey === "driving" || statusKey === "work") && metrics.continuousRemainingMin <= 20) {
    score += 44;
    reasons.push("20 percen belül kötelező szünet");
  } else if ((statusKey === "driving" || statusKey === "work") && metrics.continuousRemainingMin <= 60) {
    score += 24;
    reasons.push("Szünetablak 1 órán belül");
  }

  if (metrics.dailyRemainingMin <= 0) {
    score += 36;
    reasons.push("Napi vezetési limit túllépve");
  } else if (metrics.dailyRemainingMin <= 45) {
    score += 20;
    reasons.push("Napi limit közel");
  }

  if (metrics.weeklyRemainingMin <= 0 || metrics.fortnightRemainingMin <= 0) {
    score += 34;
    reasons.push("Heti vagy 2 hetes vezetési limit elérve");
  } else if (metrics.weeklyRemainingMin <= 120 || metrics.fortnightRemainingMin <= 180) {
    score += 18;
    reasons.push("Heti limitablak közel");
  }

  if (metrics.weeklyRestDeadlineMin <= 60) {
    score += 32;
    reasons.push("Heti pihenő határidő kritikusan közel");
  } else if (metrics.weeklyRestDeadlineMin <= 180) {
    score += 16;
    reasons.push("Heti pihenő hamarosan esedékes");
  }

  if (metrics.dailyRestRemainingMin > 0 && metrics.dailyRemainingMin < Math.floor(metrics.dailyRestRemainingMin / 3)) {
    score += 14;
    reasons.push("Pihenő csúszás miatt ETA kockázat");
  }

  if (statusKey === "rest" || statusKey === "leave") {
    score -= 10;
  }

  score = clamp(score, 5, 100);

  let level = "green";
  if (score >= 70) {
    level = "red";
  } else if (score >= 40) {
    level = "yellow";
  }

  if (reasons.length === 0) {
    reasons.push("Minden időablak biztonságos tartományban");
  }

  return {
    level,
    score,
    ...RISK_META[level],
    reasons
  };
}

function resolveRigForDriver(driver) {
  const vontato = VONTATOK.find((item) => {
    return item.id === driver.linkedVontatoId || item.linkedSoforId === driver.id;
  }) || null;

  const potkocsi = POTKOCSIK.find((item) => {
    return item.id === vontato?.linkedPotkocsiId || item.linkedVontatoId === vontato?.id;
  }) || null;

  return {
    id: vontato?.id || null,
    sofor: driver,
    vontato,
    potkocsi,
    fuvarBlocks: collectRigFuvarBlocks(driver, vontato, potkocsi)
  };
}

function collectRigFuvarBlocks(sofor, vontato, potkocsi) {
  const unique = new Map();

  [sofor, vontato, potkocsi].forEach((resource) => {
    (resource?.timeline || []).forEach((block) => {
      if (block.type !== "fuvar" || block.synthetic) {
        return;
      }

      const key = block.fuvarId || `${block.label}|${block.start}|${block.end}`;
      if (!unique.has(key)) {
        unique.set(key, block);
      }
    });
  });

  return Array.from(unique.values()).sort((a, b) => new Date(a.start) - new Date(b.start));
}

function resolveActiveFuvar(rig, index, now) {
  const nowMs = now.getTime();

  let activeBlock = rig.fuvarBlocks.find((block) => {
    return new Date(block.end).getTime() > nowMs;
  }) || rig.fuvarBlocks[0] || null;

  let fuvar = activeBlock ? FUVAROK.find((item) => item.id === activeBlock.fuvarId) : null;

  if (!fuvar) {
    fuvar = FUVAROK[index % FUVAROK.length];
  }

  if (!activeBlock && fuvar) {
    activeBlock = {
      start: fuvar.felrakas.ido,
      end: fuvar.lerakas.ido,
      type: "fuvar",
      label: fuvar.megnevezes,
      fuvarId: fuvar.id,
      felrakasCim: fuvar.felrakas.cim,
      lerakasCim: fuvar.lerakas.cim,
      adr: Boolean(fuvar.adr),
      surgos: Boolean(fuvar.surgos),
      kategoria: fuvar.kategoria || fuvar.viszonylat || "fuvar"
    };
  }

  return {
    fuvar,
    block: activeBlock
  };
}

function computeEtaProjection(activeFuvar, metrics, risk, seed, now) {
  const baseEta = new Date(activeFuvar.block?.end || now);

  const restPenaltyMin = metrics.continuousRemainingMin < 60 ? randomInt(seed + 59, 12, 35) : 0;
  const riskPenaltyMin =
    risk.level === "red"
      ? randomInt(seed + 61, 14, 28)
      : risk.level === "yellow"
        ? randomInt(seed + 61, 6, 16)
        : randomInt(seed + 61, 0, 6);
  const trafficPenaltyMin = randomInt(seed + 67, 2, 14);

  const etaCorrectionMin = restPenaltyMin + riskPenaltyMin + trafficPenaltyMin;
  const correctedEta = addMinutes(baseEta, etaCorrectionMin);
  const nowToEtaMin = Math.max(0, diffMinutes(correctedEta, now));

  return {
    baseEta,
    correctedEta,
    etaCorrectionMin,
    nowToEtaMin,
    isLateRisk: etaCorrectionMin >= 12
  };
}

function buildPredictionEvents(driver, metrics, risk, seed, now) {
  const driveExpireInMin = Math.max(5, metrics.breakDueMin);
  const restStartInMin = Math.max(8, driveExpireInMin + 4);
  const dailyLimitInMin = metrics.dailyRemainingMin > 0 ? Math.max(10, Math.min(720, metrics.dailyRemainingMin + 30)) : 6;
  const weeklyLimitInMin = metrics.weeklyRemainingMin > 0 ? Math.max(20, Math.min(2160, Math.round(metrics.weeklyRemainingMin / 4))) : 12;

  const rawEvents = [
    {
      key: "drive-expire",
      title: "Vezetési idő lejár",
      inMin: driveExpireInMin,
      severity: risk.level === "red" ? "red" : "yellow"
    },
    {
      key: "rest-start",
      title: "Következő kötelező pihenő kezdete",
      inMin: restStartInMin,
      severity: "yellow"
    },
    {
      key: "daily-limit",
      title: "Napi vezetési limit elérés",
      inMin: dailyLimitInMin,
      severity: metrics.dailyRemainingMin <= 0 ? "red" : "yellow"
    },
    {
      key: "weekly-limit",
      title: "Heti vezetési limit elérés",
      inMin: weeklyLimitInMin,
      severity: metrics.weeklyRemainingMin <= 0 ? "red" : "green"
    }
  ];

  return rawEvents.map((event, idx) => {
    const position = predictPosition(driver, event.inMin, seed + idx * 13);

    return {
      ...event,
      at: addMinutes(now, event.inMin),
      coords: position.coords,
      locationLabel: position.locationLabel,
      corridor: position.corridor
    };
  });
}

function buildRestRecommendations(driver, metrics, seed) {
  const cityKey = resolveCityKey(driver.jelenlegi_pozicio?.hely);
  const corridor = CORRIDOR_BY_CITY[cityKey] || "M1";

  let points = REST_POINTS.filter((point) => point.corridors.includes(corridor));

  if (points.length < 4) {
    const additional = REST_POINTS.filter((point) => !points.includes(point));
    points = points.concat(additional);
  }

  return points.slice(0, 4).map((point, idx) => {
    const extraDetour = randomInt(seed + 71 + idx * 5, 0, 12);
    const riskPenalty = metrics.breakDueMin <= 45 ? randomInt(seed + 73 + idx * 7, 0, 8) : 0;

    return {
      ...point,
      detourMin: point.baseDetourMin + extraDetour + riskPenalty
    };
  });
}

function evaluateFuvarCompatibility(activeFuvar, metrics, eta, risk, seed, now) {
  const fuvar = activeFuvar.fuvar;
  if (!fuvar) {
    return {
      canStartOnTime: false,
      canFinishInWindow: false,
      windowCompatible: false,
      suggestSwap: true,
      requiresMandatoryRest: true,
      minutesToPickup: 0,
      minutesToDelivery: 0,
      projectedCompletionMin: 0,
      recommendation: "Nincs fuvar-adat a kompatibilitás számításhoz."
    };
  }

  const pickupAt = new Date(fuvar.felrakas.ido);
  const deliveryAt = new Date(fuvar.lerakas.ido);

  const minutesToPickup = Math.max(0, diffMinutes(pickupAt, now));
  const minutesToDelivery = Math.max(0, diffMinutes(deliveryAt, now));

  const driveMin = Math.round(((fuvar.tavolsag_km || 280) / 67) * 60);
  const mandatoryRestInsertMin = metrics.continuousRemainingMin < driveMin
    ? 45 + randomInt(seed + 79, 8, 28)
    : 0;

  const projectedCompletionMin =
    minutesToPickup +
    driveMin +
    mandatoryRestInsertMin +
    eta.etaCorrectionMin +
    (risk.level === "red" ? 18 : 0);

  const canStartOnTime = minutesToPickup <= 150;
  const canFinishInWindow = projectedCompletionMin <= minutesToDelivery + 30;
  const windowCompatible = canStartOnTime && canFinishInWindow;
  const suggestSwap = !canFinishInWindow || risk.level === "red";
  const requiresMandatoryRest = mandatoryRestInsertMin > 0 || metrics.continuousRemainingMin < 35;

  let recommendation = "A fuvar a jelenlegi időablak szerint teljesíthető.";

  if (!windowCompatible && suggestSwap) {
    recommendation = "Gépjárművezetőcsere javasolt vagy pickup ablak újratervezése szükséges.";
  } else if (requiresMandatoryRest) {
    recommendation = "Kötelező pihenő beiktatása szükséges a lerakás előtt.";
  }

  return {
    canStartOnTime,
    canFinishInWindow,
    windowCompatible,
    suggestSwap,
    requiresMandatoryRest,
    minutesToPickup,
    minutesToDelivery,
    projectedCompletionMin,
    recommendation
  };
}

function buildTachoStrip(statusKey, metrics, risk, now) {
  const segments = buildStripSegments(statusKey, metrics, risk);
  const markers = buildStripMarkers(metrics, risk, now);

  return {
    segments,
    markers
  };
}

function buildStripSegments(statusKey, metrics, risk) {
  const driveRatio = safeRatio(metrics.continuousDrivenMin, CONTINUOUS_LIMIT_MIN);
  const remainingRatio = safeRatio(metrics.continuousRemainingMin, CONTINUOUS_LIMIT_MIN);

  let segments;

  if (statusKey === "rest" || statusKey === "leave") {
    segments = [
      { key: "rest", label: "Pihenő / szabadság", width: 34 },
      { key: "standby", label: "Készenlét", width: 13 },
      { key: "work", label: "Egyéb munka", width: 12 },
      { key: "driving", label: "Vezetési keret", width: 22 },
      { key: risk.level === "red" ? "warning" : "rest", label: risk.level === "red" ? "Breach zóna" : "Biztonságos", width: 19 }
    ];
  } else {
    segments = [
      {
        key: statusKey === "work" ? "work" : "driving",
        label: STATUS_META[statusKey].label,
        width: 22 + driveRatio * 24
      },
      { key: "work", label: "Egyéb munka", width: statusKey === "work" ? 16 : 8 },
      { key: "standby", label: "Készenlét", width: 8 },
      {
        key: "driving",
        label: "Fennmaradó vezetés",
        width: 12 + remainingRatio * 18
      },
      { key: "rest", label: "Kötelező pihenő", width: 12 },
      {
        key: "warning",
        label: "Lehetséges jogsértés",
        width: risk.level === "red" ? 15 : risk.level === "yellow" ? 11 : 7
      }
    ];
  }

  const sum = segments.reduce((acc, segment) => acc + segment.width, 0) || 1;

  return segments.map((segment) => {
    return {
      ...segment,
      widthPct: Number(((segment.width / sum) * 100).toFixed(2)),
      className: STATUS_META[segment.key]?.className || STATUS_META.driving.className
    };
  });
}

function buildStripMarkers(metrics, risk, now) {
  const horizonMin = 12 * 60;

  const toPct = (minutes) => {
    return clamp(50 + (minutes / horizonMin) * 45, 2, 98);
  };

  const restStartInMin = Math.max(8, metrics.breakDueMin);
  const restWindowWidthPct = clamp((45 / horizonMin) * 45, 4, 10);
  const breachStartPct = toPct(restStartInMin + 45);
  const breachWidthPct = risk.level === "red" ? 9 : risk.level === "yellow" ? 7 : 4;

  const toNextMidnightMin = minutesToNextMidnight(now);
  const daySwitchPct = toNextMidnightMin <= horizonMin ? toPct(toNextMidnightMin) : null;

  return {
    restStartPct: toPct(restStartInMin),
    restWindowWidthPct,
    breachStartPct,
    breachWidthPct,
    daySwitchPct,
    restStartInMin
  };
}

function buildAlerts(profiles) {
  const alerts = [];

  profiles.forEach((profile) => {
    const driverId = profile.driver.id;

    if (profile.metrics.breakDueMin <= 60) {
      alerts.push({
        severity: profile.metrics.breakDueMin <= 30 ? "red" : "yellow",
        driverId,
        focusMode: "assembly",
        fuvarId: profile.activeFuvar.fuvar?.id || null,
        etaMin: profile.metrics.breakDueMin,
        message: `Gépjárművezető ${driverId}: ${formatDuration(profile.metrics.breakDueMin)} múlva kötelező szünet`
      });
    }

    if (profile.metrics.dailyUtilization >= 0.85) {
      alerts.push({
        severity: profile.metrics.dailyUtilization >= 0.92 ? "red" : "yellow",
        driverId,
        focusMode: "assembly",
        fuvarId: profile.activeFuvar.fuvar?.id || null,
        etaMin: Math.max(5, profile.metrics.dailyRemainingMin),
        message: `Gépjárművezető ${driverId}: Napi vezetési limit ${Math.round(profile.metrics.dailyUtilization * 100)}%-on`
      });
    }

    if (profile.metrics.weeklyRestDeadlineMin <= 180) {
      alerts.push({
        severity: profile.metrics.weeklyRestDeadlineMin <= 60 ? "red" : "yellow",
        driverId,
        focusMode: "assembly",
        fuvarId: profile.activeFuvar.fuvar?.id || null,
        etaMin: Math.max(5, profile.metrics.weeklyRestDeadlineMin),
        message: `Gépjárművezető ${driverId}: Heti pihenő ${formatDuration(profile.metrics.weeklyRestDeadlineMin)} múlva esedékes`
      });
    }

    if (profile.risk.level === "red") {
      alerts.push({
        severity: "red",
        driverId,
        focusMode: "fuvar",
        fuvarId: profile.activeFuvar.fuvar?.id || null,
        etaMin: Math.max(5, profile.metrics.breakDueMin),
        message: `Gépjárművezető ${driverId}: Possible breach ${formatDuration(Math.max(5, profile.metrics.breakDueMin))} múlva`
      });
    }
  });

  const severityWeight = { red: 0, yellow: 1, green: 2 };

  return alerts
    .sort((a, b) => {
      const sevDiff = (severityWeight[a.severity] ?? 3) - (severityWeight[b.severity] ?? 3);
      if (sevDiff !== 0) {
        return sevDiff;
      }

      return a.etaMin - b.etaMin;
    })
    .slice(0, 14);
}

function renderKpiStrip(profiles) {
  const container = document.getElementById("monitor-kpi-strip");
  if (!container) {
    return;
  }

  const greenCount = profiles.filter((profile) => profile.risk.level === "green").length;
  const yellowCount = profiles.filter((profile) => profile.risk.level === "yellow").length;
  const redCount = profiles.filter((profile) => profile.risk.level === "red").length;

  const averageBreakDueMin = Math.round(
    profiles.reduce((acc, profile) => acc + profile.metrics.breakDueMin, 0) / Math.max(1, profiles.length)
  );

  const averageEtaCorrectionMin = Math.round(
    profiles.reduce((acc, profile) => acc + profile.eta.etaCorrectionMin, 0) / Math.max(1, profiles.length)
  );

  const mandatoryRestSoon = profiles.filter((profile) => profile.metrics.breakDueMin <= 120).length;

  container.innerHTML = `
    <article class="kpi-card">
      <div class="kpi-label">Kockázatos fuvarok</div>
      <div class="kpi-value">🟢 ${greenCount} • 🟡 ${yellowCount} • 🔴 ${redCount}</div>
      <div class="kpi-note">gépjárművezető kockázati állapot valós időben</div>
    </article>
    <article class="kpi-card">
      <div class="kpi-label">Átlagos szünet-kényszer</div>
      <div class="kpi-value">${formatDuration(averageBreakDueMin)}</div>
      <div class="kpi-note">a következő kötelező megállóig</div>
    </article>
    <article class="kpi-card">
      <div class="kpi-label">Átlag ETA korrekció</div>
      <div class="kpi-value">+${formatDuration(averageEtaCorrectionMin)}</div>
      <div class="kpi-note">prediktált csúszás szerelvényenként</div>
    </article>
    <article class="kpi-card">
      <div class="kpi-label">Kötelező pihenő ≤ 2h</div>
      <div class="kpi-value">${mandatoryRestSoon} gépjárművezető</div>
      <div class="kpi-note">diszpécseri beavatkozásra jelölt</div>
    </article>
  `;
}

function renderRiskLegend(profiles) {
  const container = document.getElementById("risk-legend");
  if (!container) {
    return;
  }

  const counts = {
    green: profiles.filter((profile) => profile.risk.level === "green").length,
    yellow: profiles.filter((profile) => profile.risk.level === "yellow").length,
    red: profiles.filter((profile) => profile.risk.level === "red").length
  };

  const totalCount = profiles.length;
  const activeFilter = appState.riskFilter;
  const legendOrder = ["all", "red", "yellow", "green"];

  container.innerHTML = legendOrder
    .map((key) => {
      const meta = RISK_FILTER_META[key];
      const isActive = activeFilter === key;
      const count = key === "all" ? totalCount : counts[key];
      const colorDot = key === "all"
        ? '<span class="risk-legend-dot risk-filter-all" aria-hidden="true"></span>'
        : `<span class="risk-legend-dot ${meta.className}" aria-hidden="true"></span>`;

      return `
        <button
          type="button"
          class="risk-legend-button ${isActive ? "active" : ""} ${meta.className}"
          data-risk-filter="${escapeHtml(key)}"
          aria-pressed="${isActive ? "true" : "false"}"
          title="${escapeHtml(meta.description)}"
        >
          <span class="risk-legend-head">
            ${colorDot}
            <span class="risk-legend-title">${escapeHtml(meta.shortLabel)}</span>
            <span class="risk-legend-count">${count}</span>
          </span>
          <span class="risk-legend-copy">${escapeHtml(meta.description)}</span>
        </button>
      `;
    })
    .join("");
}

function getRiskFilteredProfiles(profiles) {
  if (appState.riskFilter === "all") {
    return profiles;
  }

  return profiles.filter((profile) => profile.risk.level === appState.riskFilter);
}

function renderPlanningContextStrip() {
  const container = document.getElementById("planning-context-strip");
  if (!container) {
    return;
  }

  const planning = appState.generatedPlanning;
  if (!planning?.loaded) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  const planningContext = planning.planningContext || {};
  const importReport = planning.importReport || {};
  const rosterMeta = planning.rosterMeta || {};
  const selectedExportDate = getSelectedExportDate();
  const selectedExportAssignments = getExportAssignmentsForDate(selectedExportDate);
  const requestedDate = formatDateOnlyLabel(planningContext.planningDate);
  const selectedDate = formatDateOnlyLabel(selectedExportDate);
  const effectiveExportDate = formatDateOnlyLabel(planningContext.effectiveExportDate);
  const effectiveRosterDate = formatDateOnlyLabel(rosterMeta.effectiveRosterDate);
  const exportAssignmentCount = selectedExportAssignments.length
    ? selectedExportAssignments.length
    : Number(importReport.exportAssignments || 0);
  const rosterAssignmentCount = Array.isArray(planning.rosterAssignments)
    ? planning.rosterAssignments.length
    : Number(importReport.rosterAssignments || 0);
  const driverCount = Number(importReport.drivers || planning.drivers?.length || 0);
  const vehicleCount = Number(importReport.vehicles || planning.vehicles?.length || 0);
  const fallbackPill = planningContext.exportFallbackUsed
    ? '<span class="planning-context-pill warning">EXPORT fallback aktív</span>'
    : '<span class="planning-context-pill success">EXPORT fallback nélkül</span>';

  container.hidden = false;
  container.innerHTML = `
    <article class="planning-context-card planning-context-card-wide">
      <div class="planning-context-label">Excel planning állapot</div>
      <div class="planning-context-headline">${fallbackPill}</div>
      <div class="planning-context-meta-row">
        <span class="planning-context-chip">Kért nap: ${escapeHtml(requestedDate)}</span>
        <span class="planning-context-chip">Megjelenített Export nap: ${escapeHtml(selectedDate)}</span>
        <span class="planning-context-chip">Effektív EXPORT: ${escapeHtml(effectiveExportDate)}</span>
        <span class="planning-context-chip">Effektív roster: ${escapeHtml(effectiveRosterDate)}</span>
      </div>
    </article>
    <article class="planning-context-card">
      <div class="planning-context-label">Importált kiosztás</div>
      <div class="planning-context-value">${exportAssignmentCount}</div>
      <div class="planning-context-note">a megjelenített Export nap sorai</div>
    </article>
    <article class="planning-context-card">
      <div class="planning-context-label">Roster hozzárendelés</div>
      <div class="planning-context-value">${rosterAssignmentCount}</div>
      <div class="planning-context-note">Munkabeosztásból betöltve</div>
    </article>
    <article class="planning-context-card">
      <div class="planning-context-label">Erőforrás készlet</div>
      <div class="planning-context-value">${driverCount} gépjárművezető • ${vehicleCount} vontató</div>
      <div class="planning-context-note">generated planning állapot</div>
    </article>
  `;
}

function renderExportDateSwitcher() {
  const container = document.getElementById("export-date-switcher");
  if (!container) {
    return;
  }

  const availableDates = getAvailableExportDates();
  if (!availableDates.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  const selectedDate = getSelectedExportDate();
  container.hidden = false;
  const selectedIndex = Math.max(0, availableDates.findIndex((item) => item.date === selectedDate));
  const hasPrevious = selectedIndex < availableDates.length - 1;
  const hasNext = selectedIndex > 0;
  const optionsHtml = availableDates
    .map((item) => {
      const date = item.date;
      const count = Number(item.parsedAssignmentCount || 0);
      const selectedAttr = date === selectedDate ? ' selected' : "";
      return `<option value="${escapeHtml(date)}"${selectedAttr}>${escapeHtml(formatDateOnlyLabel(date))} • ${count} sor</option>`;
    })
    .join("");

  container.innerHTML = `
    <div class="export-date-switcher-controls">
      <button type="button" class="export-date-nav" data-export-nav="previous" ${hasPrevious ? "" : "disabled"}>← Előző nap</button>
      <label class="export-date-select-wrap">
        <span>Export nap</span>
        <select class="export-date-select" data-export-select="true">
          ${optionsHtml}
        </select>
      </label>
      <button type="button" class="export-date-nav" data-export-nav="next" ${hasNext ? "" : "disabled"}>Következő nap →</button>
    </div>
  `;
}

function renderExportTable(profiles, selectedDriverId) {
  const container = document.getElementById("export-table-container");
  if (!container) {
    return;
  }

  const selectedDate = getSelectedExportDate();
  const assignments = getExportAssignmentsForDate(selectedDate);
  if (!assignments.length) {
    container.innerHTML = '<div class="empty-message">A kiválasztott Export napon nincs betöltött kiosztási sor.</div>';
    return;
  }

  const profileByAssignmentId = new Map();
  profiles.forEach((profile) => {
    (profile.exportAssignments || []).forEach((assignment) => {
      profileByAssignmentId.set(assignment.assignmentId, profile);
    });
  });

  const rows = assignments.map((assignment) => {
    const profile = profileByAssignmentId.get(assignment.assignmentId) || null;
    const match = resolveAssignmentDriverMatch(assignment, profiles);
    return { assignment, profile, match };
  });

  const filteredRows = applyExportTableFilters(rows);
  if (!filteredRows.length) {
    container.innerHTML = '<div class="empty-message">A jelenlegi szűrőkkel nincs látható Export sor.</div>';
    return;
  }

  const rowsHtml = filteredRows
    .map(({ assignment, profile, match }) => {
      const selectedClass = profile?.driver.id === selectedDriverId ? "selected" : "";
      const driverNames = (assignment.driverNames || []).join(", ") || profile?.driver.nev || "-";
      const workPattern = assignment.originalWorkPatternCode || assignment.workPatternCode || "-";
      const directProfile = match.primaryProfile || profile;
      const driverIdAttr = directProfile?.id ? ` data-driver-id="${escapeHtml(directProfile.id)}" role="button" tabindex="0"` : "";
      const confidenceClass = `confidence-${match.confidenceTone}`;

      return `
        <tr class="export-table-row ${selectedClass}"${driverIdAttr}>
          <td>${escapeHtml(workPattern)}</td>
          <td>${escapeHtml(assignment.vehiclePlate || "-")}</td>
          <td>${escapeHtml(driverNames)}</td>
          <td>${escapeHtml(assignment.jobId || "-")}</td>
          <td>${escapeHtml(assignment.plannerNote || "-")}</td>
          <td>${escapeHtml(assignment.dispatchNote || "-")}</td>
          <td>${escapeHtml(String(assignment.sourceRow || "-"))}</td>
          <td>
            <span class="match-confidence-badge ${confidenceClass}">${escapeHtml(match.matchLabel)}</span>
            <div class="match-confidence-detail">${escapeHtml(match.matchedDriverLabel)}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="export-table-meta">Megjelenített nap: ${escapeHtml(formatDateOnlyLabel(selectedDate))} • Szűrt sorok: ${filteredRows.length} / ${assignments.length}</div>
    <div class="export-table-shell">
      <table class="export-table-view">
        <thead>
          <tr>
            <th>MI neve</th>
            <th>Vontató rendszám</th>
            <th>Gépjárművezető(ök)</th>
            <th>SZF-SZÁM</th>
            <th>Jani megjegyzés</th>
            <th>Menetirányító megjegyzés</th>
            <th>Excel sor</th>
            <th>Párosítás</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

function formatDateOnlyLabel(dateLike) {
  const value = String(dateLike || "").slice(0, 10);
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function renderDriverStateList(profiles, selectedDriverId) {
  const container = document.getElementById("driver-state-list");
  if (!container) {
    return;
  }

  if (!profiles.length) {
    const label = RISK_FILTER_META[appState.riskFilter]?.label || "szűrt";
    container.innerHTML = `<div class="empty-message">Nincs megjeleníthető gépjárművezető a kiválasztott ${escapeHtml(label)} szűrővel.</div>`;
    return;
  }

  const ordered = [...profiles].sort((a, b) => b.risk.score - a.risk.score);

  container.innerHTML = ordered
    .map((profile) => {
      const eligibility = profile.eligibility;
      const selectedClass = profile.driver.id === selectedDriverId ? "selected" : "";
      const rigLabel = profile.rig.vontato
        ? `${profile.rig.vontato.rendszam} + ${profile.rig.potkocsi?.rendszam || "-"}`
        : "nincs kapcsolt rig";
      const primaryExportAssignment = profile.primaryExportAssignment;
      const eligibilityBadge = eligibility?.canStart
        ? `Indítható • ${eligibility.compatibleJobIds.length} fuvar`
        : `Blokkolt • ${(eligibility?.reasons || []).slice(0, 1).map((item) => item.message).join(" ") || "nincs kompatibilis fuvar"}`;
      const firstStartLabel = eligibility?.firstPossibleStartAt
        ? formatDateTimeCompact(eligibility.firstPossibleStartAt)
        : "-";
      const exportSummary = primaryExportAssignment
        ? `${primaryExportAssignment.vehiclePlate || "-"} • ${primaryExportAssignment.workPatternCode || "-"}`
        : "nincs Export kiosztás";
      const exportNote = primaryExportAssignment?.plannerNote || primaryExportAssignment?.dispatchNote || "nincs megjegyzés";

      return `
        <article
          class="driver-state-card ${profile.risk.className} ${selectedClass}"
          data-driver-id="${escapeHtml(profile.driver.id)}"
          role="button"
          tabindex="0"
          aria-label="Gépjárművezető kiválasztása: ${escapeHtml(profile.driver.nev)}"
        >
          <div class="driver-state-top">
            <span class="risk-dot ${profile.risk.className}" aria-hidden="true"></span>
            <strong>${escapeHtml(profile.driver.id)} • ${escapeHtml(profile.driver.nev)}</strong>
          </div>
          <div class="driver-state-badges">
            <span class="driver-badge">${escapeHtml(profile.status.icon)} ${escapeHtml(profile.status.label)}</span>
            <span class="driver-badge">${escapeHtml(profile.risk.label)}</span>
            <span class="driver-badge">${escapeHtml(eligibilityBadge)}</span>
          </div>
          <div class="driver-state-meta">
            ⏱️ Köv. szünet: ${formatDuration(profile.metrics.breakDueMin)}
          </div>
          <div class="driver-state-meta">
            📊 Napi: ${formatDuration(profile.metrics.dailyUsedMin)} / ${formatDuration(profile.metrics.dailyLimitMin)}
          </div>
          <div class="driver-state-meta">
            🚦 Első lehetséges indulás: ${escapeHtml(firstStartLabel)}
          </div>
          <div class="driver-state-meta export-assignment-meta">
            📤 Export: ${escapeHtml(exportSummary)}
          </div>
          <div class="driver-state-meta export-assignment-note">
            📝 ${escapeHtml(exportNote)}
          </div>
          <div class="driver-state-meta">
            🚛 Rig: ${escapeHtml(rigLabel)}
          </div>
        </article>
      `;

    function formatDateTimeCompact(dateLike) {
      const date = new Date(dateLike);
      if (!Number.isFinite(date.getTime())) {
        return "-";
      }

      return date.toLocaleString("hu-HU", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    })
    .join("");
}

function renderExportDriverList(profiles, selectedDriverId) {
  const container = document.getElementById("export-driver-list");
  if (!container) {
    return;
  }

  const exportProfiles = profiles
    .filter((profile) => profile.exportAssignments?.length)
    .sort((left, right) => right.exportAssignments.length - left.exportAssignments.length);

  if (!exportProfiles.length) {
    container.innerHTML = '<div class="empty-message">Az effektív Export napon nincs gépjárművezetőhöz köthető kiosztási sor.</div>';
    return;
  }

  container.innerHTML = exportProfiles
    .map((profile) => {
      const selectedClass = profile.driver.id === selectedDriverId ? "selected" : "";
      const assignments = profile.exportAssignments || [];
      const primaryAssignment = assignments[0] || null;
      const note = primaryAssignment?.plannerNote || primaryAssignment?.dispatchNote || "nincs megjegyzés";

      return `
        <article
          class="export-driver-card ${selectedClass}"
          data-driver-id="${escapeHtml(profile.driver.id)}"
          role="button"
          tabindex="0"
          aria-label="Export gépjárművezető kiválasztása: ${escapeHtml(profile.driver.nev)}"
        >
          <div class="export-driver-top">
            <strong>${escapeHtml(profile.driver.nev)}</strong>
            <span class="export-driver-count">${assignments.length} sor</span>
          </div>
          <div class="export-driver-route">
            🚛 ${escapeHtml(primaryAssignment?.vehiclePlate || "-")} • ${escapeHtml(primaryAssignment?.workPatternCode || "-")}
          </div>
          <div class="export-driver-note">📝 ${escapeHtml(note)}</div>
        </article>
      `;
    })
    .join("");
}

function renderMainPanel(profile, now) {
  const panel = document.getElementById("monitor-main-panel");
  const container = document.getElementById("tacho-main-content");
  if (!panel || !container) {
    return;
  }

  if (!profile) {
    panel.hidden = true;
    container.innerHTML = "";
    return;
  }

  panel.hidden = false;

  const counters = buildCounterCards(profile);

  const stripSegmentsHtml = profile.strip.segments
    .map((segment) => {
      return `
        <div class="tacho-strip-segment ${segment.className}" style="width:${segment.widthPct}%">
          <span>${escapeHtml(segment.label)}</span>
        </div>
      `;
    })
    .join("");

  const daySwitchMarker = profile.strip.markers.daySwitchPct == null
    ? ""
    : `<div class="strip-overlay-marker day-switch" style="left:${profile.strip.markers.daySwitchPct}%" title="Napváltási limit marker"></div>`;

  container.innerHTML = `
    <div class="main-driver-header">
      <div>
        <h3>${escapeHtml(profile.driver.id)} • ${escapeHtml(profile.driver.nev)}</h3>
        <div class="main-driver-sub">
          ${escapeHtml(profile.status.icon)} ${escapeHtml(profile.status.label)} • ${escapeHtml(profile.risk.label)}
        </div>
      </div>
      <div class="main-driver-risk ${profile.risk.className}">
        Risk score: ${profile.risk.score}
      </div>
    </div>

    <section class="tacho-strip-wrap ${profile.risk.className}">
      <div class="tacho-strip-label">1) Gépjárművezető időállapot-sáv (Tacho Timeline Strip)</div>
      <div class="tacho-strip">
        ${stripSegmentsHtml}
        <div class="strip-now">MOST</div>
        <div
          class="strip-overlay-marker rest-window"
          style="left:${profile.strip.markers.restStartPct}%;width:${profile.strip.markers.restWindowWidthPct}%"
          title="Kötelező pihenő időablak"
        ></div>
        <div
          class="strip-overlay-marker breach-window"
          style="left:${profile.strip.markers.breachStartPct}%;width:${profile.strip.markers.breachWidthPct}%"
          title="Potenciális jogsértés ablaka"
        ></div>
        ${daySwitchMarker}
      </div>
      <div class="tacho-strip-foot">
        <span>Ledolgozott folyamatos vezetés: <strong>${formatDuration(profile.metrics.continuousDrivenMin)}</strong></span>
        <span>Kötelező pihenő indul: <strong>${formatTime(addMinutes(now, profile.strip.markers.restStartInMin))}</strong></span>
        <span>Fennmaradó keret: <strong>${formatDuration(profile.metrics.continuousRemainingMin)}</strong></span>
      </div>
    </section>

    <section class="counter-grid-wrap">
      <div class="tacho-strip-label">2) Tachográf szabálykezelés és visszaszámlálók</div>
      <div class="counter-grid">
        ${counters.map((counter) => renderCounterCard(counter)).join("")}
      </div>
    </section>
  `;
}

function buildCounterCards(profile) {
  const metrics = profile.metrics;

  const cards = [
    {
      key: "A",
      title: "Folyamatos vezetés (4h 30m)",
      value: `${formatDuration(metrics.continuousDrivenMin)} / 4h 30m`,
      note: `Hátralévő vezetési idő a következő szünetig: ${formatDuration(metrics.continuousRemainingMin)}`,
      progress: clamp(safeRatio(metrics.continuousDrivenMin, CONTINUOUS_LIMIT_MIN) * 100, 0, 130),
      severity: resolveSeverityByRemaining(metrics.continuousRemainingMin, 20, 60)
    },
    {
      key: "B",
      title: "Napi vezetési limit (9h / 10h)",
      value: `${formatDuration(metrics.dailyUsedMin)} / ${formatDuration(metrics.dailyLimitMin)}`,
      note: metrics.usesExtendedDay ? "Hosszabbított nap (10h) aktív" : "Normál nap (9h) aktív",
      progress: clamp(safeRatio(metrics.dailyUsedMin, metrics.dailyLimitMin) * 100, 0, 130),
      severity: resolveSeverityByRemaining(metrics.dailyRemainingMin, 30, 90)
    },
    {
      key: "C",
      title: "Heti vezetési limit (56h)",
      value: `${formatDuration(metrics.weeklyUsedMin)} / 56h`,
      note: `Hátralévő heti keret: ${formatDuration(metrics.weeklyRemainingMin)}`,
      progress: clamp(safeRatio(metrics.weeklyUsedMin, WEEKLY_LIMIT_MIN) * 100, 0, 130),
      severity: resolveSeverityByRemaining(metrics.weeklyRemainingMin, 90, 240)
    },
    {
      key: "D",
      title: "2 hetes kombinált limit (90h)",
      value: `${formatDuration(metrics.fortnightUsedMin)} / 90h`,
      note: `Fortnight drive maradék: ${formatDuration(metrics.fortnightRemainingMin)}`,
      progress: clamp(safeRatio(metrics.fortnightUsedMin, FORTNIGHT_LIMIT_MIN) * 100, 0, 130),
      severity: resolveSeverityByRemaining(metrics.fortnightRemainingMin, 120, 300)
    },
    {
      key: "E",
      title: "Napi pihenőidő (9h / 11h)",
      value: `${formatDuration(metrics.accruedDailyRestMin)} / ${formatDuration(metrics.requiredDailyRestMin)}`,
      note: `Minimum required rest: ${formatDuration(metrics.dailyRestRemainingMin)} left`,
      progress: clamp(safeRatio(metrics.accruedDailyRestMin, metrics.requiredDailyRestMin) * 100, 0, 130),
      severity: resolveSeverityByRemaining(metrics.dailyRestRemainingMin, 45, 120)
    },
    {
      key: "F",
      title: "Heti pihenőidő (24h / 45h)",
      value: `${formatDuration(metrics.weeklyRestProgressMin)} / ${formatDuration(metrics.weeklyRestTargetMin)}`,
      note: `Heti pihenő határidő: ${formatDuration(Math.max(0, metrics.weeklyRestDeadlineMin))}`,
      progress: clamp(safeRatio(metrics.weeklyRestProgressMin, metrics.weeklyRestTargetMin) * 100, 0, 130),
      severity: resolveSeverityByRemaining(metrics.weeklyRestDeadlineMin, 60, 180)
    }
  ];

  return cards;
}

function renderCounterCard(counter) {
  return `
    <article class="counter-card severity-${counter.severity}">
      <div class="counter-top">
        <span class="counter-key">${escapeHtml(counter.key)}</span>
        <strong>${escapeHtml(counter.title)}</strong>
      </div>
      <div class="counter-value">${escapeHtml(counter.value)}</div>
      <div class="counter-progress">
        <span style="width:${counter.progress}%"></span>
      </div>
      <div class="counter-note">${escapeHtml(counter.note)}</div>
    </article>
  `;
}

function renderInsightsPanel(profile) {
  const container = document.getElementById("monitor-insight-grid");
  if (!container) {
    return;
  }

  if (!profile) {
    container.innerHTML = "<div class=\"empty-message\">Nincs predikciós adat.</div>";
    return;
  }

  const predictionList = profile.predictionEvents
    .map((event) => {
      const coords = `${event.coords[0].toFixed(4)}, ${event.coords[1].toFixed(4)}`;
      return `
        <li>
          <strong>${escapeHtml(event.title)}</strong>
          <span>${formatTime(event.at)} • ${escapeHtml(event.locationLabel)} (${escapeHtml(event.corridor)})</span>
          <span class="prediction-coords">${escapeHtml(coords)}</span>
        </li>
      `;
    })
    .join("");

  const restRecommendationList = profile.recommendedStops
    .map((stop) => {
      const icon = REST_POINT_ICONS[stop.kind] || "📍";
      return `
        <li>
          <strong>${escapeHtml(icon)} ${escapeHtml(stop.name)}</strong>
          <span>Eltérés: ${formatDuration(stop.detourMin)} • ${escapeHtml((stop.coords[0]).toFixed(4))}, ${escapeHtml((stop.coords[1]).toFixed(4))}</span>
        </li>
      `;
    })
    .join("");

  const rigLabel = profile.rig.vontato
    ? `Rig #${profile.rig.vontato.id} (Gépjárművezető: ${profile.driver.id})`
    : `Rig #N/A (Gépjárművezető: ${profile.driver.id})`;

  const rigStatus = `${profile.status.label} (${formatDuration(profile.metrics.continuousRemainingMin)} left)`;

  const etaDiffText = profile.eta.etaCorrectionMin > 0
    ? `+${formatDuration(profile.eta.etaCorrectionMin)} late risk`
    : "on-time";

  const exportAssignmentList = (profile.exportAssignments || [])
    .map((assignment) => {
      const note = assignment.plannerNote || assignment.dispatchNote || "nincs megjegyzés";
      return `
        <li>
          <strong>${escapeHtml(assignment.vehiclePlate || "-")}</strong>
          <span>Munkarend: ${escapeHtml(assignment.workPatternCode || "-")}</span>
          <span>${escapeHtml(note)}</span>
        </li>
      `;
    })
    .join("");

  const exportAssignmentBlock = profile.exportAssignments?.length
    ? `
      <article class="insight-card">
        <h4>Export napi kiosztás a gépjárművezetőhöz</h4>
        <p class="insight-subline">Az Excel EXPORT lap betöltött, gépjárművezetőhöz rendelt sorai.</p>
        <ul class="insight-list export-assignment-list">
          ${exportAssignmentList}
        </ul>
      </article>
    `
    : `
      <article class="insight-card">
        <h4>Export napi kiosztás a gépjárművezetőhöz</h4>
        <div class="empty-message">Ehhez a gépjárművezetőhöz nincs betöltött Export sor az effektív napon.</div>
      </article>
    `;

  container.innerHTML = `
    ${exportAssignmentBlock}
    <article class="insight-card">
      <h4>3) AI predikciós események</h4>
      <ul class="insight-list prediction-list">
        ${predictionList}
      </ul>
    </article>

    <article class="insight-card">
      <h4>Következő pihenőpont ajánlások</h4>
      <p class="insight-subline">A gépjárművezető ${formatDuration(profile.metrics.breakDueMin)} múlva köteles pihenni. Elérhető opciók:</p>
      <ul class="insight-list rest-list">
        ${restRecommendationList}
      </ul>
    </article>

    <article class="insight-card">
      <h4>5) Szerelvény integráció (Rig + Tacho)</h4>
      <div class="rig-status-block">
        <div><strong>${escapeHtml(rigLabel)}</strong></div>
        <div>Status: ${escapeHtml(rigStatus)}</div>
        <div>Next rest required by: ${formatTime(addMinutes(new Date(), Math.max(5, profile.metrics.breakDueMin)))}</div>
        <div>ETA to delivery: ${formatTime(profile.eta.correctedEta)} (${escapeHtml(etaDiffText)})</div>
      </div>
      <div class="rig-status-meta">
        🚛 ${escapeHtml(profile.rig.vontato?.rendszam || "nincs vontató")} • 🚚 ${escapeHtml(profile.rig.potkocsi?.rendszam || "nincs pótkocsi")}
      </div>
    </article>

    <article class="insight-card">
      <h4>6) Fuvarhoz kapcsolt tachográf kompatibilitás</h4>
      <div class="compat-grid">
        <div class="compat-item ${profile.compatibility.canStartOnTime ? "ok" : "bad"}">Pickup időben indítható: ${profile.compatibility.canStartOnTime ? "Igen" : "Nem"}</div>
        <div class="compat-item ${profile.compatibility.canFinishInWindow ? "ok" : "bad"}">Delivery ablak tartható: ${profile.compatibility.canFinishInWindow ? "Igen" : "Nem"}</div>
        <div class="compat-item ${profile.compatibility.windowCompatible ? "ok" : "bad"}">Ablak-kompatibilitás: ${profile.compatibility.windowCompatible ? "Megfelel" : "Rizikós"}</div>
        <div class="compat-item ${profile.compatibility.suggestSwap ? "bad" : "ok"}">Gépjárművezetőcsere javaslat: ${profile.compatibility.suggestSwap ? "Javasolt" : "Nem szükséges"}</div>
        <div class="compat-item ${profile.compatibility.requiresMandatoryRest ? "warn" : "ok"}">Kötelező pihenő beiktatás: ${profile.compatibility.requiresMandatoryRest ? "Szükséges" : "Nem szükséges"}</div>
      </div>
      <div class="compat-recommendation">${escapeHtml(profile.compatibility.recommendation)}</div>
    </article>
  `;
}

function formatOperationDetails(entry) {
  const details = [];

  if (entry.location) {
    details.push(`Hely: ${entry.location}`);
  }

  if (entry.sourceAssemblyId && entry.targetAssemblyId) {
    details.push(`Szerelvény: ${entry.sourceAssemblyId} → ${entry.targetAssemblyId}`);
  }

  if (entry.assignment) {
    const sofor = entry.assignment.soforId || "-";
    const vontato = entry.assignment.vontatoId || "-";
    const potkocsi = entry.assignment.potkocsiId || "nincs";
    details.push(`Új kiosztás: ${sofor} | ${vontato} | ${potkocsi}`);
  }

  return details.join(" • ");
}

function renderOperationLogPanel() {
  const container = document.getElementById("monitor-operation-log");
  if (!container) {
    return;
  }

  const entries = getAssemblyOperationLogEntries(80);
  if (entries.length === 0) {
    container.innerHTML = '<div class="assembly-operation-log-empty">Még nincs rögzített elakasztás vagy erőforrás törés.</div>';
    return;
  }

  container.innerHTML = entries.map((entry) => {
    const at = new Date(entry.at);
    const atLabel = Number.isNaN(at.getTime())
      ? "-"
      : at.toLocaleString("hu-HU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    const details = formatOperationDetails(entry);

    return `
      <div class="assembly-operation-log-item">
        <div class="assembly-operation-log-head">
          <div class="assembly-operation-log-type">${escapeHtml(entry.typeLabel)}</div>
          <div class="assembly-operation-log-time">${escapeHtml(atLabel)}</div>
        </div>
        <div class="assembly-operation-log-line">Fuvar: ${escapeHtml(entry.fuvarId)} • ${escapeHtml(entry.fuvarMegnevezes)}</div>
        ${details ? `<div class="assembly-operation-log-line">${escapeHtml(details)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderAlertsPanel(alerts, selectedDriverId) {
  const container = document.getElementById("monitor-alerts-list");
  if (!container) {
    return;
  }

  if (!alerts.length) {
    container.innerHTML = "<div class=\"empty-message\">Nincs aktív riasztás.</div>";
    return;
  }

  container.innerHTML = alerts
    .map((alert, index) => {
      const selectedClass = alert.driverId === selectedDriverId ? "selected" : "";
      return `
        <article
          class="monitor-alert-item severity-${alert.severity} ${selectedClass}"
          data-alert-index="${index}"
          role="button"
          tabindex="0"
        >
          <div class="alert-top">
            <strong>${escapeHtml(alert.severity.toUpperCase())}</strong>
            <span>Gépjárművezető ${escapeHtml(alert.driverId)}</span>
          </div>
          <div class="alert-message">${escapeHtml(alert.message)}</div>
          <div class="alert-foot">Kattintás: timeline highlight + MapView fókusz</div>
        </article>
      `;
    })
    .join("");
}

function onDriverListClick(event) {
  const card = event.target.closest("[data-driver-id]");
  if (!card || !event.currentTarget.contains(card)) {
    return;
  }

  const driverId = card.dataset.driverId;
  if (!driverId) {
    return;
  }

  appState.selectedDriverId = driverId;
  refreshDashboard({ preserveSelection: true, focusMode: "assembly" });
  pulseMainPanel();
}

function onDriverListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const card = event.target.closest("[data-driver-id]");
  if (!card || !event.currentTarget.contains(card)) {
    return;
  }

  event.preventDefault();

  const driverId = card.dataset.driverId;
  if (!driverId) {
    return;
  }

  appState.selectedDriverId = driverId;
  refreshDashboard({ preserveSelection: true, focusMode: "assembly" });
  pulseMainPanel();
}

function onRiskLegendClick(event) {
  const button = event.target.closest("[data-risk-filter]");
  if (!button || !event.currentTarget.contains(button)) {
    return;
  }

  const riskFilter = button.dataset.riskFilter;
  if (!Object.hasOwn(RISK_FILTER_META, riskFilter) || riskFilter === appState.riskFilter) {
    return;
  }

  appState.riskFilter = riskFilter;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });
}

function onRiskLegendKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const button = event.target.closest("[data-risk-filter]");
  if (!button || !event.currentTarget.contains(button)) {
    return;
  }

  event.preventDefault();

  const riskFilter = button.dataset.riskFilter;
  if (!Object.hasOwn(RISK_FILTER_META, riskFilter) || riskFilter === appState.riskFilter) {
    return;
  }

  appState.riskFilter = riskFilter;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });
}

function onGlobalKeydown(event) {
  if (event.key !== "Escape" || !appState.selectedDriverId) {
    return;
  }

  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return;
  }

  appState.selectedDriverId = null;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });
}

function onExportDateSwitcherClick(event) {
  const button = event.target.closest("[data-export-nav]");
  if (!button || !event.currentTarget.contains(button)) {
    return;
  }

  const availableDates = getAvailableExportDates();
  const currentIndex = availableDates.findIndex((item) => item.date === appState.selectedExportDate);
  if (currentIndex === -1) {
    return;
  }

  const delta = button.dataset.exportNav === "previous" ? 1 : -1;
  const nextDate = availableDates[currentIndex + delta]?.date;
  const exportDate = String(nextDate || "").slice(0, 10);
  if (!exportDate || exportDate === appState.selectedExportDate) {
    return;
  }

  appState.selectedExportDate = exportDate;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });
}

function onExportDateSwitcherKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const button = event.target.closest("[data-export-nav]");
  if (!button || !event.currentTarget.contains(button)) {
    return;
  }

  event.preventDefault();
  const availableDates = getAvailableExportDates();
  const currentIndex = availableDates.findIndex((item) => item.date === appState.selectedExportDate);
  if (currentIndex === -1) {
    return;
  }

  const delta = button.dataset.exportNav === "previous" ? 1 : -1;
  const nextDate = availableDates[currentIndex + delta]?.date;
  const exportDate = String(nextDate || "").slice(0, 10);
  if (!exportDate || exportDate === appState.selectedExportDate) {
    return;
  }

  appState.selectedExportDate = exportDate;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });
}

function onExportDateSwitcherChange(event) {
  const select = event.target.closest("[data-export-select]");
  if (!select || !event.currentTarget.contains(select)) {
    return;
  }

  const exportDate = String(select.value || "").slice(0, 10);
  if (!exportDate || exportDate === appState.selectedExportDate) {
    return;
  }

  appState.selectedExportDate = exportDate;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });
}

function onExportTableFiltersChanged(event) {
  const field = event.target.closest("[data-export-filter]");
  if (!field || !event.currentTarget.contains(field)) {
    return;
  }

  const key = field.dataset.exportFilter;
  if (!Object.hasOwn(appState.exportFilters, key)) {
    return;
  }

  appState.exportFilters[key] = field.value || "";
  renderExportTable(appState.profiles, appState.selectedDriverId);
}

function onAlertListClick(event) {
  const card = event.target.closest(".monitor-alert-item");
  if (!card) {
    return;
  }

  const alertIndex = Number(card.dataset.alertIndex);
  const alert = appState.alerts[alertIndex];
  if (!alert) {
    return;
  }

  appState.selectedDriverId = alert.driverId;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });

  const profile = getSelectedProfile();
  if (profile) {
    syncMapFocus(profile, alert.focusMode === "fuvar" ? "fuvar" : "assembly", alert.fuvarId);
  }

  pulseMainPanel();
}

function onAlertListKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const card = event.target.closest(".monitor-alert-item");
  if (!card) {
    return;
  }

  event.preventDefault();

  const alertIndex = Number(card.dataset.alertIndex);
  const alert = appState.alerts[alertIndex];
  if (!alert) {
    return;
  }

  appState.selectedDriverId = alert.driverId;
  refreshDashboard({ preserveSelection: true, focusMode: "none" });

  const profile = getSelectedProfile();
  if (profile) {
    syncMapFocus(profile, alert.focusMode === "fuvar" ? "fuvar" : "assembly", alert.fuvarId);
  }

  pulseMainPanel();
}

function getSelectedProfile() {
  return appState.profiles.find((profile) => profile.driver.id === appState.selectedDriverId) || null;
}

function syncMapFocus(profile, focusMode = "assembly", explicitFuvarId = null) {
  if (focusMode === "fuvar") {
    const fuvarId = explicitFuvarId || profile.activeFuvar.fuvar?.id || null;
    window.dispatchEvent(new CustomEvent("fuvar:focus", {
      detail: {
        fuvarId
      }
    }));
    return;
  }

  window.dispatchEvent(new CustomEvent("fuvar:focus", {
    detail: {
      fuvarId: null
    }
  }));

  if (!profile.rig.vontato?.id) {
    return;
  }

  window.dispatchEvent(new CustomEvent("assembly:focus", {
    detail: {
      assemblyId: profile.rig.vontato.id
    }
  }));
}

function pulseMainPanel() {
  const panel = document.getElementById("monitor-main-panel");
  if (!panel) {
    return;
  }

  panel.classList.remove("pulse-highlight");
  panel.offsetWidth;
  panel.classList.add("pulse-highlight");

  setTimeout(() => {
    panel.classList.remove("pulse-highlight");
  }, 850);
}

function predictPosition(driver, minutesAhead, seed) {
  const cityKey = resolveCityKey(driver.jelenlegi_pozicio?.hely);
  const base = CITY_COORDS[cityKey] || CITY_COORDS.budapest;
  const corridor = CORRIDOR_BY_CITY[cityKey] || "M1";

  const factor = Math.min(1, minutesAhead / 260);
  const latOffset = randomFloat(seed + 83, -0.36, 0.36) * factor;
  const lngOffset = randomFloat(seed + 89, -0.52, 0.52) * factor;

  return {
    coords: [base[0] + latOffset, base[1] + lngOffset],
    locationLabel: CITY_LABELS[cityKey] || "Budapest",
    corridor
  };
}

function resolveCityKey(rawLocation) {
  const normalized = normalizeText(rawLocation);

  const key = Object.keys(CITY_COORDS).find((candidate) => {
    return normalized.includes(candidate);
  });

  return key || "budapest";
}

function makeSeed(value) {
  const text = String(value || "");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function randomFloat(seed, min, max) {
  const ratio = pseudoRandom(seed);
  return min + ratio * (max - min);
}

function randomInt(seed, min, max) {
  return Math.floor(randomFloat(seed, min, max + 1));
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function safeRatio(value, base) {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0) {
    return 0;
  }

  return value / base;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function diffMinutes(later, earlier) {
  return Math.round((later.getTime() - earlier.getTime()) / (60 * 1000));
}

function minutesToNextMidnight(now) {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return diffMinutes(nextMidnight, now);
}

function formatDuration(totalMinutes) {
  const value = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(value / (24 * 60));
  const hours = Math.floor((value % (24 * 60)) / 60);
  const mins = value % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${String(mins).padStart(2, "0")}m`;
  }

  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, "0")}m`;
  }

  return `${mins}m`;
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePlanningKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSeverityByRemaining(remainingMin, redThreshold, yellowThreshold) {
  if (remainingMin <= redThreshold) {
    return "red";
  }

  if (remainingMin <= yellowThreshold) {
    return "yellow";
  }

  return "green";
}
