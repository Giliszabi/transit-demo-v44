const DRIVER_FINALIZATION_STORAGE_KEY = "transit.v44.driverFinalization.v1";

let cachedFinalizedDriverIds = null;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function normalizeDriverId(driverId) {
  return String(driverId || "").trim();
}

function normalizeDriverIdList(driverIds) {
  if (!Array.isArray(driverIds)) {
    return [];
  }

  return driverIds
    .map((item) => normalizeDriverId(item))
    .filter(Boolean);
}

function loadFinalizedDriverIds() {
  if (cachedFinalizedDriverIds instanceof Set) {
    return new Set(cachedFinalizedDriverIds);
  }

  if (!canUseBrowserStorage()) {
    cachedFinalizedDriverIds = new Set();
    return new Set(cachedFinalizedDriverIds);
  }

  try {
    const raw = window.sessionStorage.getItem(DRIVER_FINALIZATION_STORAGE_KEY);
    if (!raw) {
      cachedFinalizedDriverIds = new Set();
      return new Set(cachedFinalizedDriverIds);
    }

    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed?.driverIds) ? parsed.driverIds : [];
    cachedFinalizedDriverIds = new Set(normalizeDriverIdList(ids));
    return new Set(cachedFinalizedDriverIds);
  } catch (_error) {
    cachedFinalizedDriverIds = new Set();
    return new Set(cachedFinalizedDriverIds);
  }
}

function saveFinalizedDriverIds(finalizedDriverIds) {
  cachedFinalizedDriverIds = new Set(finalizedDriverIds);

  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DRIVER_FINALIZATION_STORAGE_KEY,
      JSON.stringify({
        driverIds: [...cachedFinalizedDriverIds]
      })
    );
  } catch (_error) {
    // no-op
  }
}

function emitDriverFinalizationChanged(detail = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("driver-finalization-changed", {
    detail: {
      finalizedDriverIds: [...(cachedFinalizedDriverIds || new Set())],
      ...detail
    }
  }));
}

export function getFinalizedDriverIds() {
  return loadFinalizedDriverIds();
}

export function isDriverFinalized(driverId) {
  const normalizedId = normalizeDriverId(driverId);
  if (!normalizedId) {
    return false;
  }

  return loadFinalizedDriverIds().has(normalizedId);
}

export function areAllDriversFinalized(driverIds) {
  const normalizedIds = normalizeDriverIdList(driverIds);
  if (!normalizedIds.length) {
    return false;
  }

  const finalized = loadFinalizedDriverIds();
  return normalizedIds.every((driverId) => finalized.has(driverId));
}

export function setDriversFinalized(driverIds, finalized, options = {}) {
  const normalizedIds = normalizeDriverIdList(driverIds);
  if (!normalizedIds.length) {
    return false;
  }

  const emit = options.emit !== false;
  const targetState = Boolean(finalized);
  const next = loadFinalizedDriverIds();
  let changed = false;

  normalizedIds.forEach((driverId) => {
    if (targetState) {
      if (!next.has(driverId)) {
        next.add(driverId);
        changed = true;
      }
      return;
    }

    if (next.delete(driverId)) {
      changed = true;
    }
  });

  if (!changed) {
    return false;
  }

  saveFinalizedDriverIds(next);
  if (emit) {
    emitDriverFinalizationChanged({ source: "set", targetState });
  }

  return true;
}

export function toggleDriversFinalized(driverIds) {
  const normalizedIds = normalizeDriverIdList(driverIds);
  if (!normalizedIds.length) {
    return false;
  }

  const shouldFinalize = !areAllDriversFinalized(normalizedIds);
  setDriversFinalized(normalizedIds, shouldFinalize, { emit: true });
  return shouldFinalize;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== DRIVER_FINALIZATION_STORAGE_KEY) {
      return;
    }

    cachedFinalizedDriverIds = null;
    loadFinalizedDriverIds();
    emitDriverFinalizationChanged({ source: "storage" });
  });
}
