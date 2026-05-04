const SESSION_STORAGE_KEY = "transit.v44.dispatch.session";
const SESSION_SCHEMA_VERSION = 1;

let _sessionState = {
  schemaVersion: SESSION_SCHEMA_VERSION
};

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeTimelineList(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter((item) => isObject(item) && typeof item.id === "string" && Array.isArray(item.timeline))
    .map((item) => ({ id: item.id, timeline: item.timeline }));
}

function sanitizeSessionState(raw) {
  if (!isObject(raw)) {
    return { schemaVersion: SESSION_SCHEMA_VERSION };
  }

  const schemaVersion = Number(raw.schemaVersion);
  if (!Number.isInteger(schemaVersion) || schemaVersion !== SESSION_SCHEMA_VERSION) {
    return { schemaVersion: SESSION_SCHEMA_VERSION };
  }

  const fuvarAssignments = Array.isArray(raw.fuvarAssignments)
    ? raw.fuvarAssignments
      .filter((item) => isObject(item) && typeof item.fuvarId === "string")
      .map((item) => ({
        fuvarId: item.fuvarId,
        assignedSoforId: item.assignedSoforId || null,
        assignedVontatoId: item.assignedVontatoId || null,
        assignedPotkocsiId: item.assignedPotkocsiId || null
      }))
    : [];

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    appliedAt: typeof raw.appliedAt === "string" ? raw.appliedAt : null,
    profileId: typeof raw.profileId === "string" ? raw.profileId : null,
    profileName: typeof raw.profileName === "string" ? raw.profileName : null,
    profileSnapshot: isObject(raw.profileSnapshot) ? raw.profileSnapshot : null,
    fuvarAssignments,
    resourceTimelines: {
      soforok: normalizeTimelineList(raw.resourceTimelines?.soforok),
      vontatok: normalizeTimelineList(raw.resourceTimelines?.vontatok),
      potkocsik: normalizeTimelineList(raw.resourceTimelines?.potkocsik)
    },
    stats: isObject(raw.stats) ? raw.stats : null,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : []
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function getSessionState() {
  return cloneState(_sessionState);
}

export function setSessionState(partial) {
  if (!isObject(partial)) {
    return getSessionState();
  }

  _sessionState = sanitizeSessionState({
    ..._sessionState,
    ...partial,
    resourceTimelines: {
      ..._sessionState.resourceTimelines,
      ...(isObject(partial.resourceTimelines) ? partial.resourceTimelines : {})
    }
  });

  return getSessionState();
}

export function saveSessionState() {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(_sessionState));
  } catch (_error) {
    // no-op
  }

  return getSessionState();
}

export function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      _sessionState = { schemaVersion: SESSION_SCHEMA_VERSION };
      return getSessionState();
    }

    _sessionState = sanitizeSessionState(JSON.parse(raw));
    return getSessionState();
  } catch (_error) {
    _sessionState = { schemaVersion: SESSION_SCHEMA_VERSION };
    return getSessionState();
  }
}

export function clearSessionState() {
  _sessionState = { schemaVersion: SESSION_SCHEMA_VERSION };
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (_error) {
    // no-op
  }
}

function applyFuvarAssignmentsFromSession(fuvarok, assignments) {
  const fuvarById = new Map((Array.isArray(fuvarok) ? fuvarok : []).map((item) => [item.id, item]));
  let skipped = 0;
  let applied = 0;

  assignments.forEach((assignment) => {
    const fuvar = fuvarById.get(assignment.fuvarId);
    if (!fuvar) {
      skipped += 1;
      return;
    }

    fuvar.assignedSoforId = assignment.assignedSoforId || undefined;
    fuvar.assignedVontatoId = assignment.assignedVontatoId || undefined;
    fuvar.assignedPotkocsiId = assignment.assignedPotkocsiId || undefined;
    applied += 1;
  });

  return { applied, skipped };
}

function applyResourceTimelinesFromSession(targetList, snapshotList) {
  const map = new Map((Array.isArray(targetList) ? targetList : []).map((item) => [item.id, item]));
  let skipped = 0;
  let applied = 0;

  snapshotList.forEach((entry) => {
    const resource = map.get(entry.id);
    if (!resource) {
      skipped += 1;
      return;
    }

    resource.timeline = Array.isArray(entry.timeline) ? entry.timeline : [];
    applied += 1;
  });

  return { applied, skipped };
}

export function applySessionStateSnapshots({ fuvarok, soforok, vontatok, potkocsik }) {
  const state = getSessionState();
  if (!Array.isArray(state.fuvarAssignments) || state.fuvarAssignments.length === 0) {
    return {
      applied: false,
      schemaVersion: state.schemaVersion,
      profileId: state.profileId || null,
      profileName: state.profileName || null,
      assignmentStats: { applied: 0, skipped: 0 },
      timelineStats: {
        soforok: { applied: 0, skipped: 0 },
        vontatok: { applied: 0, skipped: 0 },
        potkocsik: { applied: 0, skipped: 0 }
      }
    };
  }

  const assignmentStats = applyFuvarAssignmentsFromSession(fuvarok, state.fuvarAssignments);
  const soforStats = applyResourceTimelinesFromSession(soforok, state.resourceTimelines?.soforok || []);
  const vontatoStats = applyResourceTimelinesFromSession(vontatok, state.resourceTimelines?.vontatok || []);
  const potkocsiStats = applyResourceTimelinesFromSession(potkocsik, state.resourceTimelines?.potkocsik || []);

  if (assignmentStats.skipped > 0) {
    console.warn(`[SessionState] Kihagyott fuvar assignment ID-k: ${assignmentStats.skipped}`);
  }
  if (soforStats.skipped > 0) {
    console.warn(`[SessionState] Kihagyott sofőr timeline ID-k: ${soforStats.skipped}`);
  }
  if (vontatoStats.skipped > 0) {
    console.warn(`[SessionState] Kihagyott vontató timeline ID-k: ${vontatoStats.skipped}`);
  }
  if (potkocsiStats.skipped > 0) {
    console.warn(`[SessionState] Kihagyott pótkocsi timeline ID-k: ${potkocsiStats.skipped}`);
  }

  return {
    applied: true,
    schemaVersion: state.schemaVersion,
    profileId: state.profileId || null,
    profileName: state.profileName || null,
    assignmentStats,
    timelineStats: {
      soforok: soforStats,
      vontatok: vontatoStats,
      potkocsik: potkocsiStats
    }
  };
}
