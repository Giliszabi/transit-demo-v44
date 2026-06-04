const DRIVER_DISPATCH_NOTES_STORAGE_KEY = "transit.v44.driverDispatchNotes.v1";

let cachedDriverNotes = null;

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
    .map((driverId) => normalizeDriverId(driverId))
    .filter(Boolean);
}

function normalizeNote(value) {
  return String(value || "").trim();
}

function loadDriverNotes() {
  if (cachedDriverNotes && typeof cachedDriverNotes === "object") {
    return { ...cachedDriverNotes };
  }

  if (!canUseBrowserStorage()) {
    cachedDriverNotes = {};
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(DRIVER_DISPATCH_NOTES_STORAGE_KEY);
    if (!raw) {
      cachedDriverNotes = {};
      return {};
    }

    const parsed = JSON.parse(raw);
    const notes = (parsed && typeof parsed.notes === "object" && parsed.notes) || {};
    const normalized = {};

    Object.entries(notes).forEach(([driverId, note]) => {
      const normalizedDriverId = normalizeDriverId(driverId);
      const normalizedNote = normalizeNote(note);
      if (!normalizedDriverId || !normalizedNote) {
        return;
      }

      normalized[normalizedDriverId] = normalizedNote;
    });

    cachedDriverNotes = normalized;
    return { ...normalized };
  } catch (_error) {
    cachedDriverNotes = {};
    return {};
  }
}

function saveDriverNotes(notes) {
  cachedDriverNotes = { ...notes };

  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DRIVER_DISPATCH_NOTES_STORAGE_KEY,
      JSON.stringify({ notes: cachedDriverNotes })
    );
  } catch (_error) {
    // no-op
  }
}

function emitDriverDispatchNoteChanged(detail = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("driver-dispatch-note-changed", {
    detail: {
      notes: { ...(cachedDriverNotes || {}) },
      ...detail
    }
  }));
}

export function getDriverDispatchNote(driverId) {
  const normalizedDriverId = normalizeDriverId(driverId);
  if (!normalizedDriverId) {
    return "";
  }

  return String(loadDriverNotes()[normalizedDriverId] || "");
}

export function setDriverDispatchNote(driverIds, note, options = {}) {
  const normalizedIds = normalizeDriverIdList(driverIds);
  if (!normalizedIds.length) {
    return false;
  }

  const normalizedNote = normalizeNote(note);
  const emit = options.emit !== false;
  const next = loadDriverNotes();
  let changed = false;

  normalizedIds.forEach((driverId) => {
    if (!normalizedNote) {
      if (Object.hasOwn(next, driverId)) {
        delete next[driverId];
        changed = true;
      }
      return;
    }

    if (next[driverId] !== normalizedNote) {
      next[driverId] = normalizedNote;
      changed = true;
    }
  });

  if (!changed) {
    return false;
  }

  saveDriverNotes(next);
  if (emit) {
    emitDriverDispatchNoteChanged({ source: "set" });
  }

  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== DRIVER_DISPATCH_NOTES_STORAGE_KEY) {
      return;
    }

    cachedDriverNotes = null;
    loadDriverNotes();
    emitDriverDispatchNoteChanged({ source: "storage" });
  });
}
