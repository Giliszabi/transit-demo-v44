function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfDay(dateLike) {
  const date = toDate(dateLike);
  if (!date) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function addMinutes(dateLike, minutes) {
  const date = toDate(dateLike);
  if (!date) {
    return null;
  }
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(dateLike, days) {
  const date = toDate(dateLike);
  if (!date) {
    return null;
  }
  date.setDate(date.getDate() + days);
  return date;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function dateOnly(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function uniqueReasons(reasons) {
  const seen = new Set();
  return reasons.filter((reason) => {
    const key = `${reason.code}|${reason.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getDriverId(driver) {
  return driver?.driverId || driver?.id || null;
}

function getDriverName(driver) {
  return driver?.name || driver?.nev || getDriverId(driver) || "-";
}

function getDriverRequiredHands(driver) {
  if (driver?.requiredHands) {
    return Number(driver.requiredHands) || 1;
  }
  if (driver?.kezes) {
    return Number(driver.kezes) || 1;
  }
  return 1;
}

function getDriverAdr(driver) {
  if (typeof driver?.adrQualified === "boolean") {
    return driver.adrQualified;
  }
  return Boolean(driver?.adr);
}

function getDriverActive(driver) {
  if (typeof driver?.active === "boolean") {
    return driver.active;
  }
  return true;
}

function getDriverTimeline(driver) {
  return Array.isArray(driver?.timeline) ? driver.timeline : [];
}

function getDrivingProfile(driver) {
  return driver?.driving || {
    dailyDrivenHours: 0,
    dailyLimitHours: getDriverRequiredHands(driver) === 2 ? 18 : 9,
    weeklyDrivenHours: 0,
    weeklyLimitHours: 56,
    fortnightDrivenHours: 0,
    fortnightLimitHours: 90,
    restMinutesEarned: 11 * 60
  };
}

function getJobId(job) {
  return job?.jobId || job?.id || null;
}

function getJobPickupAt(job) {
  return job?.pickupAt || job?.felrakas?.ido || null;
}

function getJobDropoffAt(job) {
  return job?.dropoffAt || job?.lerakas?.ido || null;
}

function getJobPickupAddress(job) {
  return job?.pickupAddress || job?.felrakas?.cim || "";
}

function getJobDropoffAddress(job) {
  return job?.dropoffAddress || job?.lerakas?.cim || "";
}

function getJobAdr(job) {
  return Boolean(job?.adrRequired ?? job?.adr);
}

function getJobRequiredHands(job) {
  return Number(job?.requiredHands || job?.kezes || 1) || 1;
}

function getJobDistanceKm(job) {
  return Number(job?.distanceKm || job?.tavolsag_km || 0) || 0;
}

function getCountryTokens(job) {
  const source = `${getJobPickupAddress(job)} ${getJobDropoffAddress(job)}`;
  return normalizeText(source)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasTimelineCollision(timeline, startIso, endIso) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) {
    return false;
  }

  return timeline.some((block) => {
    if (block?.synthetic) {
      return false;
    }
    const blockStart = toDate(block?.start);
    const blockEnd = toDate(block?.end);
    if (!blockStart || !blockEnd) {
      return false;
    }
    return start < blockEnd && end > blockStart;
  });
}

function findBlockingTimelineEnd(timeline, startIso, endIso) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) {
    return null;
  }

  let latestEnd = null;
  timeline.forEach((block) => {
    if (block?.synthetic) {
      return;
    }
    const blockStart = toDate(block?.start);
    const blockEnd = toDate(block?.end);
    if (!blockStart || !blockEnd) {
      return;
    }
    if (start < blockEnd && end > blockStart) {
      if (!latestEnd || blockEnd > latestEnd) {
        latestEnd = blockEnd;
      }
    }
  });

  return latestEnd;
}

function calculateRequiredDrivingHours(job) {
  const distanceKm = getJobDistanceKm(job);
  if (distanceKm > 0) {
    return Math.max(0.5, distanceKm / 67);
  }

  const pickupAt = toDate(getJobPickupAt(job));
  const dropoffAt = toDate(getJobDropoffAt(job));
  if (!pickupAt || !dropoffAt) {
    return 0.5;
  }
  const durationHours = (dropoffAt.getTime() - pickupAt.getTime()) / (60 * 60 * 1000);
  return Math.max(0.5, durationHours * 0.78);
}

function findSchedule(scheduleList, driverId) {
  return (Array.isArray(scheduleList) ? scheduleList : []).find((item) => item.driverId === driverId) || null;
}

function findScheduleOverride(schedule, planningDate) {
  const targetDate = dateOnly(planningDate);
  return (schedule?.exceptions || []).find((item) => item.date === targetDate) || null;
}

function getScheduleState(schedule, planningDate) {
  const override = findScheduleOverride(schedule, planningDate);
  if (override?.override === "ON_LEAVE") {
    return { state: "LEAVE", override };
  }
  if (override?.override === "SICK_LEAVE") {
    return { state: "SICK", override };
  }
  if (override?.override === "REST") {
    return { state: "REST", override };
  }

  const planningStart = startOfDay(planningDate);
  const anchorStart = startOfDay(schedule?.cycleAnchorDate || planningDate);
  if (!planningStart || !anchorStart) {
    return { state: "WORK", override: null };
  }

  const cycleLength = Number(schedule?.cycleLengthDays || 0) || 1;
  const workDays = Number(schedule?.workDays || cycleLength) || cycleLength;
  const elapsedDays = Math.floor((planningStart.getTime() - anchorStart.getTime()) / (24 * 60 * 60 * 1000));
  const cyclePos = ((elapsedDays % cycleLength) + cycleLength) % cycleLength;
  return { state: cyclePos < workDays ? "WORK" : "REST", override: null };
}

function buildVehicleIndex(vehicles) {
  const index = new Map();
  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    const plate = normalizeText(vehicle?.plateNumber || vehicle?.rendszam);
    if (plate) {
      index.set(plate, vehicle);
    }
  });
  return index;
}

function createReason(code, message) {
  return { code, message };
}

function evaluateGlobalAvailability(driver, schedule, vehicles, planningDate) {
  const reasons = [];
  let earliestStart = startOfDay(planningDate) || new Date();
  earliestStart = addMinutes(earliestStart, 5 * 60) || earliestStart;

  if (!getDriverActive(driver)) {
    reasons.push(createReason("INACTIVE", "A sofőr inaktív."));
  }

  const scheduleState = getScheduleState(schedule, planningDate);
  if (scheduleState.state === "LEAVE") {
    reasons.push(createReason("ON_LEAVE", "A sofőr szabadságon van."));
    earliestStart = addDays(earliestStart, 1) || earliestStart;
  } else if (scheduleState.state === "SICK") {
    reasons.push(createReason("SICK_LEAVE", "A sofőr betegállományban van."));
    earliestStart = addDays(earliestStart, 1) || earliestStart;
  } else if (scheduleState.state === "REST") {
    reasons.push(createReason("REST_DAY", "A mai nap a munkarend szerint pihenőnap."));
    earliestStart = addDays(earliestStart, 1) || earliestStart;
  }

  const dedicatedPlate = normalizeText(driver?.dedicatedVehiclePlate);
  if (dedicatedPlate) {
    const vehicleIndex = buildVehicleIndex(vehicles);
    const dedicatedVehicle = vehicleIndex.get(dedicatedPlate);
    if (!dedicatedVehicle || dedicatedVehicle.active === false) {
      reasons.push(createReason("DEDICATED_VEHICLE_UNAVAILABLE", "A dedikált vontató nem elérhető."));
    }
  }

  const driving = getDrivingProfile(driver);
  if ((driving.restMinutesEarned || 0) < 45 && (driving.dailyDrivenHours || 0) > 4.5) {
    reasons.push(createReason("REQUIRED_REST_PENDING", "A sofőrnek kötelező szünetet kell tartania."));
    earliestStart = addMinutes(earliestStart, 45 - (driving.restMinutesEarned || 0)) || earliestStart;
  }

  return {
    reasons,
    earliestStart,
    scheduleState
  };
}

export function evaluateDriverAgainstJob({ driver, schedule, vehicles, job, planningDate }) {
  const globalState = evaluateGlobalAvailability(driver, schedule, vehicles, planningDate);
  const reasons = [...globalState.reasons];

  const pickupAt = getJobPickupAt(job);
  const dropoffAt = getJobDropoffAt(job);
  const pickupDate = toDate(pickupAt);
  const dropoffDate = toDate(dropoffAt);
  if (!pickupDate || !dropoffDate || dropoffDate <= pickupDate) {
    reasons.push(createReason("JOB_TIME_WINDOW_MISS", "A fuvar időablaka hibás vagy hiányos."));
    return {
      compatible: false,
      reasons: uniqueReasons(reasons),
      firstPossibleStartAt: toIso(globalState.earliestStart)
    };
  }

  const requiredHands = getJobRequiredHands(job);
  if (requiredHands !== getDriverRequiredHands(driver)) {
    reasons.push(createReason("HAND_COUNT_MISMATCH", `A fuvar ${requiredHands} kezes, a sofőr ${getDriverRequiredHands(driver)} kezes.`));
  }

  if (getJobAdr(job) && !getDriverAdr(driver)) {
    reasons.push(createReason("ADR_MISSING", "ADR jogosultság hiányzik."));
  }

  const blockedCountries = new Set((driver?.blockedCountries || []).map((item) => normalizeText(item)));
  const countryTokens = getCountryTokens(job);
  if (countryTokens.some((token) => blockedCountries.has(token))) {
    reasons.push(createReason("BLOCKED_COUNTRY", "A fuvar tiltott országot érint a sofőr számára."));
  }

  const driving = getDrivingProfile(driver);
  const requiredHours = calculateRequiredDrivingHours(job);
  const remainingDailyHours = (driving.dailyLimitHours || 0) - (driving.dailyDrivenHours || 0);
  const remainingWeeklyHours = (driving.weeklyLimitHours || 0) - (driving.weeklyDrivenHours || 0);
  if (requiredHours > remainingDailyHours) {
    reasons.push(createReason("NO_DAILY_DRIVE_TIME", "Nincs elég napi vezetési időkeret."));
  }
  if (requiredHours > remainingWeeklyHours) {
    reasons.push(createReason("NO_WEEKLY_DRIVE_TIME", "Nincs elég heti vezetési időkeret."));
  }

  const timeline = getDriverTimeline(driver);
  if (hasTimelineCollision(timeline, pickupAt, dropoffAt)) {
    reasons.push(createReason("TIMELINE_COLLISION", "A fuvar időben ütközik meglévő foglalással."));
  }

  const blockingEnd = findBlockingTimelineEnd(timeline, pickupAt, dropoffAt);
  const effectiveEarliestStart = blockingEnd && blockingEnd > globalState.earliestStart ? blockingEnd : globalState.earliestStart;
  if (pickupDate < effectiveEarliestStart) {
    reasons.push(createReason("JOB_TIME_WINDOW_MISS", "A fuvar indulási ideje korábbi, mint a sofőr első lehetséges indulása."));
  }

  return {
    compatible: reasons.length === 0,
    reasons: uniqueReasons(reasons),
    firstPossibleStartAt: toIso(effectiveEarliestStart)
  };
}

export function evaluateDriverEligibility({ driver, schedule, vehicles, jobs, planningDate }) {
  const driverId = getDriverId(driver);
  const globalState = evaluateGlobalAvailability(driver, schedule, vehicles, planningDate);
  const compatibleJobIds = [];
  const allReasons = [...globalState.reasons];
  let earliestCompatiblePickup = null;
  let earliestUnblockedStart = globalState.earliestStart;

  (Array.isArray(jobs) ? jobs : []).forEach((job) => {
    const result = evaluateDriverAgainstJob({ driver, schedule, vehicles, job, planningDate });
    if (result.compatible) {
      const jobId = getJobId(job);
      if (jobId) {
        compatibleJobIds.push(jobId);
      }
      const pickupAt = toDate(getJobPickupAt(job));
      if (pickupAt && (!earliestCompatiblePickup || pickupAt < earliestCompatiblePickup)) {
        earliestCompatiblePickup = pickupAt;
      }
      return;
    }

    result.reasons.forEach((reason) => allReasons.push(reason));
    const candidateStart = toDate(result.firstPossibleStartAt);
    if (candidateStart && candidateStart > earliestUnblockedStart) {
      earliestUnblockedStart = candidateStart;
    }
  });

  const canStart = globalState.reasons.length === 0 && compatibleJobIds.length > 0;
  return {
    driverId,
    driverName: getDriverName(driver),
    planningDate: dateOnly(planningDate),
    canStart,
    firstPossibleStartAt: toIso(earliestCompatiblePickup || earliestUnblockedStart),
    reasons: canStart ? [] : uniqueReasons(allReasons).slice(0, 6),
    compatibleJobIds,
    warnings: []
  };
}

export function buildEligibilityIndex({ drivers, driverSchedules, vehicles, jobs, planningDate }) {
  const planningIsoDate = dateOnly(planningDate) || dateOnly(new Date()) || "";
  const index = new Map();
  (Array.isArray(drivers) ? drivers : []).forEach((driver) => {
    const driverId = getDriverId(driver);
    if (!driverId) {
      return;
    }
    const schedule = findSchedule(driverSchedules, driverId);
    const result = evaluateDriverEligibility({
      driver,
      schedule,
      vehicles,
      jobs,
      planningDate: planningIsoDate
    });
    index.set(driverId, result);
  });
  return index;
}