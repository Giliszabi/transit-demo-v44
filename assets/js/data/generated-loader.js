import { SOFOROK } from "./soforok.js";
import { VONTATOK } from "./vontatok.js";

let loadedPlanningData = null;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeVehicleId(plateNumber) {
  return `VG-${normalizeText(plateNumber || "unknown")}`;
}

function createDrivingProfile(driver) {
  const twoHands = Number(driver?.requiredHands || driver?.kezes || 1) === 2;
  return {
    dailyDrivenHours: 0,
    dailyLimitHours: twoHands ? 18 : 9,
    weeklyDrivenHours: 18,
    weeklyLimitHours: 56,
    fortnightDrivenHours: 36,
    fortnightLimitHours: 90,
    restMinutesEarned: 11 * 60
  };
}

function createTimelineFromSchedule(schedule, planningDate) {
  const targetDate = String(planningDate || "").slice(0, 10);
  return (schedule?.exceptions || [])
    .filter((item) => item?.date === targetDate)
    .map((item) => {
      const blockStart = `${targetDate}T00:00:00`;
      const blockEnd = `${targetDate}T23:59:00`;
      if (item.override === "ON_LEAVE") {
        return { start: blockStart, end: blockEnd, type: "szabadsag", label: "Szabadság", synthetic: true };
      }
      if (item.override === "SICK_LEAVE") {
        return { start: blockStart, end: blockEnd, type: "beteg", label: "Betegállomány", synthetic: true };
      }
      if (item.override === "REST") {
        return { start: blockStart, end: blockEnd, type: "piheno", label: "Pihenőnap", synthetic: true };
      }
      return null;
    })
    .filter(Boolean);
}

async function fetchJson(relativePath) {
  const response = await fetch(relativePath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${relativePath}: ${response.status}`);
  }
  return response.json();
}

function replaceArrayContents(target, nextItems) {
  target.splice(0, target.length, ...nextItems);
}

function normalizeDateOnly(value) {
  return String(value || "").slice(0, 10);
}

function mapGeneratedVehicles(vehicles, drivers) {
  const handsByPlate = new Map();
  drivers.forEach((driver) => {
    if (!driver?.dedicatedVehiclePlate) {
      return;
    }
    handsByPlate.set(driver.dedicatedVehiclePlate, String(driver.requiredHands || 1));
  });

  return vehicles.map((vehicle) => ({
    id: makeVehicleId(vehicle.plateNumber),
    rendszam: vehicle.plateNumber,
    tipus: vehicle.vehicleType === "belfold" ? "belföldi" : "nemzetkozi",
    kezes: handsByPlate.get(vehicle.plateNumber) || "1",
    adr: Boolean(vehicle.adrCapable),
    active: vehicle.active !== false,
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: [],
    importedPlanning: vehicle
  }));
}

function mapGeneratedDrivers(drivers, schedules, planningDate) {
  const scheduleById = new Map(schedules.map((schedule) => [schedule.driverId, schedule]));
  return drivers.map((driver) => {
    const schedule = scheduleById.get(driver.driverId) || null;
    return {
      id: driver.driverId,
      driverId: driver.driverId,
      nev: driver.name,
      name: driver.name,
      tipus: driver.type === "belfold" ? "belföldes" : "nemzetkozi",
      kezes: String(driver.requiredHands || 1),
      requiredHands: Number(driver.requiredHands || 1),
      adr: Boolean(driver.adrQualified),
      adrQualified: Boolean(driver.adrQualified),
      active: driver.active !== false,
      dedicatedVehiclePlate: driver.dedicatedVehiclePlate || null,
      preferredCountries: Array.isArray(driver.preferredCountries) ? driver.preferredCountries : [],
      blockedCountries: Array.isArray(driver.blockedCountries) ? driver.blockedCountries : [],
      jelenlegi_pozicio: { hely: "Környe" },
      timeline: createTimelineFromSchedule(schedule, planningDate),
      driving: createDrivingProfile(driver),
      importedPlanning: driver,
      importedSchedule: schedule
    };
  });
}

function linkDriversAndVehicles(drivers, vehicles) {
  const vehicleByPlate = new Map(vehicles.map((vehicle) => [vehicle.rendszam, vehicle]));
  drivers.forEach((driver) => {
    const vehicle = vehicleByPlate.get(driver.dedicatedVehiclePlate || "");
    if (!vehicle) {
      return;
    }
    driver.linkedVontatoId = vehicle.id;
    vehicle.linkedSoforId = driver.id;
  });
}

function resolveRosterDate(rosterAssignments, planningDate) {
  const uniqueDates = [...new Set((rosterAssignments || []).map((item) => normalizeDateOnly(item.date)).filter(Boolean))].sort();
  if (!uniqueDates.length) {
    return null;
  }

  const target = normalizeDateOnly(planningDate);
  const exact = uniqueDates.find((item) => item === target);
  if (exact) {
    return exact;
  }

  const earlier = uniqueDates.filter((item) => item <= target);
  if (earlier.length) {
    return earlier[earlier.length - 1];
  }

  return uniqueDates[uniqueDates.length - 1];
}

function applyRosterAssignments(drivers, vehicles, rosterAssignments, planningDate) {
  const effectiveRosterDate = resolveRosterDate(rosterAssignments, planningDate);
  if (!effectiveRosterDate) {
    return { effectiveRosterDate: null, appliedCount: 0 };
  }

  const vehicleByPlate = new Map(vehicles.map((vehicle) => [vehicle.rendszam, vehicle]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const driverByName = new Map(drivers.map((driver) => [normalizeText(driver.nev), driver]));
  let appliedCount = 0;

  rosterAssignments
    .filter((item) => normalizeDateOnly(item.date) === effectiveRosterDate)
    .forEach((assignment) => {
      const vehicle = vehicleByPlate.get(assignment.vehiclePlate);
      const driver = driverById.get(assignment.driverId) || driverByName.get(normalizeText(assignment.driverName));
      if (!vehicle || !driver) {
        return;
      }
      driver.linkedVontatoId = vehicle.id;
      vehicle.linkedSoforId = driver.id;
      driver.rosterAssignment = assignment;
      vehicle.rosterAssignment = assignment;
      appliedCount += 1;
    });

  return { effectiveRosterDate, appliedCount };
}

export function getLoadedPlanningData() {
  return loadedPlanningData;
}

export async function loadGeneratedPlanningData() {
  if (loadedPlanningData) {
    return loadedPlanningData;
  }

  try {
    const [planningContext, drivers, driverSchedules, vehicles, importReport, rosterAssignments, exportAssignments] = await Promise.all([
      fetchJson("./assets/js/data/generated/planning-context.json"),
      fetchJson("./assets/js/data/generated/drivers.json"),
      fetchJson("./assets/js/data/generated/driver-schedules.json"),
      fetchJson("./assets/js/data/generated/vehicles.json"),
      fetchJson("./assets/js/data/generated/import-report.json"),
      fetchJson("./assets/js/data/generated/roster-assignments.json"),
      fetchJson("./assets/js/data/generated/export-assignments.json")
    ]);

    if (!Array.isArray(drivers) || drivers.length === 0) {
      loadedPlanningData = { planningContext, drivers: [], driverSchedules, vehicles: [], importReport, loaded: false };
      return loadedPlanningData;
    }

    const mappedDrivers = mapGeneratedDrivers(drivers, driverSchedules, planningContext?.planningDate);
    const mappedVehicles = mapGeneratedVehicles(vehicles, drivers);
    linkDriversAndVehicles(mappedDrivers, mappedVehicles);
    const rosterMeta = applyRosterAssignments(mappedDrivers, mappedVehicles, rosterAssignments, planningContext?.planningDate);

    replaceArrayContents(SOFOROK, mappedDrivers);
    replaceArrayContents(VONTATOK, mappedVehicles);

    loadedPlanningData = {
      loaded: true,
      planningContext,
      drivers,
      driverSchedules,
      vehicles,
      rosterAssignments,
      exportAssignments,
      uiDrivers: mappedDrivers,
      uiVehicles: mappedVehicles,
      rosterMeta,
      importReport
    };

    return loadedPlanningData;
  } catch (error) {
    console.warn("[generated-loader] fallback to demo data", error);
    loadedPlanningData = { loaded: false, error };
    return loadedPlanningData;
  }
}