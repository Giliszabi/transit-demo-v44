// ===================================================================
// DRAG & DROP ENGINE + MATCHING ENGINE
// ===================================================================

import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";
import { distanceKm, formatDate } from "../utils.js";

import { evaluateSoforForFuvar, evaluateVontatoForFuvar, evaluatePotkocsiForFuvar } from "./matching.js";
import { addFuvarBlockToTimeline, hasCollision, refreshAutoDriverStatesForLinkedConvoys, refreshAutoTransitBlocksForResource } from "./timeline.js";
import { assignFuvarToSpedicioPartner } from "./spedicio-partners.js";

const dragState = {
  kind: null,
  fuvarId: null,
  sourceType: null,
  sourceId: null
};

let refreshViewsHandler = null;

const SOON_FREE_PAIR_WINDOW_MS = 4 * 3600 * 1000;
const NEARBY_FREE_PAIR_MAX_DISTANCE_KM = 80;
const LOCATION_COORDS = {
  budapest: { lat: 47.4979, lng: 19.0402 },
  gyor: { lat: 47.6875, lng: 17.6504 },
  vac: { lat: 47.7826, lng: 19.1332 },
  dunakeszi: { lat: 47.6364, lng: 19.1386 },
  debrecen: { lat: 47.5316, lng: 21.6273 },
  szeged: { lat: 46.253, lng: 20.1414 },
  miskolc: { lat: 48.1035, lng: 20.7784 },
  pecs: { lat: 46.0727, lng: 18.2323 },
  tatabanya: { lat: 47.5692, lng: 18.4048 },
  kecskemet: { lat: 46.8964, lng: 19.6897 },
  esztergom: { lat: 47.7853, lng: 18.7423 },
  szekesfehervar: { lat: 47.186, lng: 18.4221 },
  kornye: { lat: 47.5449, lng: 18.3188 }
};

export function setDragDropRefreshHandler(handler) {
  refreshViewsHandler = typeof handler === "function" ? handler : null;
}

function runRefreshViews() {
  if (refreshViewsHandler) {
    refreshViewsHandler();
  }
}

function refreshAllAutoTransitSegments() {
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

function resetDragState() {
  dragState.kind = null;
  dragState.fuvarId = null;
  dragState.sourceType = null;
  dragState.sourceId = null;
}

function clearHighlights() {
  document.querySelectorAll(".timeline-resource-name")
    .forEach((el) => el.classList.remove("drop-ok", "drop-bad"));

  document.querySelectorAll(".resource-card")
    .forEach((el) => el.classList.remove("drop-ok", "drop-bad"));
}

function getResourceByType(type, id) {
  if (type === "sofor") {
    return SOFOROK.find((s) => s.id === id) || null;
  }

  if (type === "vontato") {
    return VONTATOK.find((v) => v.id === id) || null;
  }

  if (type === "potkocsi") {
    return POTKOCSIK.find((p) => p.id === id) || null;
  }

  if (type === "partner") {
    return { id, nev: id, timeline: [] };
  }

  return null;
}

function evaluateFuvarSuitability(resourceType, resource, fuvar) {
  if (!resource || !fuvar) {
    return { suitable: false, reasons: ["Hiányzó erőforrás vagy fuvar."] };
  }

  if (resourceType === "sofor") {
    return evaluateSoforForFuvar(resource, fuvar);
  }

  if (resourceType === "vontato") {
    return evaluateVontatoForFuvar(resource, fuvar);
  }

  return evaluatePotkocsiForFuvar(resource, fuvar);
}

function normalizeLocationText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getResourceLocation(resource) {
  return String(resource?.jelenlegi_pozicio?.hely || "").trim();
}

function isKornyeLocation(location) {
  return normalizeLocationText(location).includes("kornye");
}

function getLocationCoords(location) {
  const normalized = normalizeLocationText(location);
  if (!normalized) {
    return null;
  }

  const cityKey = Object.keys(LOCATION_COORDS).find((key) => normalized.includes(key));
  return cityKey ? LOCATION_COORDS[cityKey] : null;
}

function estimateLocationDistanceKm(locationA, locationB) {
  const coordsA = getLocationCoords(locationA);
  const coordsB = getLocationCoords(locationB);

  if (!coordsA || !coordsB) {
    return Number.POSITIVE_INFINITY;
  }

  return distanceKm(coordsA, coordsB);
}

function getRealFuvarBlocks(resource) {
  if (!Array.isArray(resource?.timeline)) {
    return [];
  }

  return resource.timeline
    .filter((block) => block?.type === "fuvar" && !block?.synthetic)
    .slice()
    .sort((left, right) => new Date(left.start) - new Date(right.start));
}

function getProjectedAssemblyResources(sourceType, source, targetType, target) {
  if (isDriverTractorPair(sourceType, targetType)) {
    const sofor = sourceType === "sofor" ? source : target;
    const vontato = sourceType === "vontato" ? source : target;
    const potkocsi = vontato?.linkedPotkocsiId
      ? getResourceByType("potkocsi", vontato.linkedPotkocsiId)
      : null;

    return { sofor, vontato, potkocsi };
  }

  if (isTrailerTractorPair(sourceType, targetType)) {
    const potkocsi = sourceType === "potkocsi" ? source : target;
    const vontato = sourceType === "vontato" ? source : target;
    const sofor = vontato?.linkedSoforId
      ? getResourceByType("sofor", vontato.linkedSoforId)
      : null;

    return { sofor, vontato, potkocsi };
  }

  return { sofor: null, vontato: null, potkocsi: null };
}

function getCargoReferenceBlock(vontato, potkocsi) {
  const nowMs = Date.now();
  const blocks = [...getRealFuvarBlocks(vontato), ...getRealFuvarBlocks(potkocsi)].sort((left, right) => {
    return new Date(left.start) - new Date(right.start);
  });

  if (!blocks.length) {
    return null;
  }

  return blocks.find((block) => new Date(block.end).getTime() >= nowMs) || blocks[blocks.length - 1] || null;
}

function findNearbySoonFreePair(referenceLocation, excludedVontatoId) {
  const nowMs = Date.now();
  let bestCandidate = null;

  VONTATOK.forEach((candidateVontato) => {
    if (!candidateVontato || candidateVontato.id === excludedVontatoId) {
      return;
    }

    const candidateSofor = candidateVontato.linkedSoforId
      ? getResourceByType("sofor", candidateVontato.linkedSoforId)
      : SOFOROK.find((item) => item.linkedVontatoId === candidateVontato.id) || null;

    if (!candidateSofor) {
      return;
    }

    const blocks = getRealFuvarBlocks(candidateVontato);
    if (!blocks.length) {
      return;
    }

    const currentOrNextIndex = blocks.findIndex((block) => new Date(block.end).getTime() >= nowMs);
    if (currentOrNextIndex === -1) {
      return;
    }

    const currentOrNextBlock = blocks[currentOrNextIndex];
    const availableAtMs = new Date(currentOrNextBlock.end).getTime();
    if (!Number.isFinite(availableAtMs)) {
      return;
    }

    if (availableAtMs < nowMs || availableAtMs - nowMs > SOON_FREE_PAIR_WINDOW_MS) {
      return;
    }

    const hasNextFuvar = blocks.some((block, index) => {
      return index > currentOrNextIndex && new Date(block.start).getTime() >= availableAtMs;
    });
    if (hasNextFuvar) {
      return;
    }

    const stopLocation = currentOrNextBlock?.lerakasCim
      || getResourceLocation(candidateVontato)
      || getResourceLocation(candidateSofor);
    if (!stopLocation) {
      return;
    }

    const distance = estimateLocationDistanceKm(referenceLocation, stopLocation);
    if (!Number.isFinite(distance) || distance > NEARBY_FREE_PAIR_MAX_DISTANCE_KM) {
      return;
    }

    const candidate = {
      sofor: candidateSofor,
      vontato: candidateVontato,
      stopLocation,
      availableAtMs,
      distance,
      sourceBlock: currentOrNextBlock
    };

    if (!bestCandidate) {
      bestCandidate = candidate;
      return;
    }

    if (candidate.availableAtMs < bestCandidate.availableAtMs) {
      bestCandidate = candidate;
      return;
    }

    if (candidate.availableAtMs === bestCandidate.availableAtMs && candidate.distance < bestCandidate.distance) {
      bestCandidate = candidate;
    }
  });

  return bestCandidate;
}

function buildNearbyFreePairWarningContext(sourceType, source, targetType, target) {
  const projected = getProjectedAssemblyResources(sourceType, source, targetType, target);
  if (!projected.sofor || !projected.vontato || !projected.potkocsi) {
    return null;
  }

  const tractorLocation = getResourceLocation(projected.vontato);
  if (!tractorLocation || isKornyeLocation(tractorLocation)) {
    return null;
  }

  const cargoBlock = getCargoReferenceBlock(projected.vontato, projected.potkocsi);
  if (!cargoBlock) {
    return null;
  }

  const nearbyPair = findNearbySoonFreePair(tractorLocation, projected.vontato.id);
  if (!nearbyPair) {
    return null;
  }

  return {
    sofor: projected.sofor,
    vontato: projected.vontato,
    potkocsi: projected.potkocsi,
    tractorLocation,
    cargoBlock,
    nearbyPair
  };
}

function buildTraktorbanWarningContext(sourceType, source, targetType, target) {
  let sofor = null;
  let vontato = null;
  let potkocsi = null;

  if (isDriverTractorPair(sourceType, targetType)) {
    sofor = sourceType === "sofor" ? source : target;
    vontato = sourceType === "vontato" ? source : target;
    if (vontato?.linkedPotkocsiId) {
      potkocsi = getResourceByType("potkocsi", vontato.linkedPotkocsiId);
    }
  } else if (isTrailerTractorPair(sourceType, targetType)) {
    potkocsi = sourceType === "potkocsi" ? source : target;
    vontato = sourceType === "vontato" ? source : target;
    if (vontato?.linkedSoforId) {
      sofor = getResourceByType("sofor", vontato.linkedSoforId);
    }
  }

  if (!sofor || !vontato || !potkocsi) {
    return null;
  }

  const soforLocation = getResourceLocation(sofor);
  const vontatoLocation = getResourceLocation(vontato);
  const potkocsiLocation = getResourceLocation(potkocsi);
  const comboLocation = vontatoLocation || soforLocation;

  if (!comboLocation || !potkocsiLocation) {
    return null;
  }

  if (normalizeLocationText(comboLocation) === normalizeLocationText(potkocsiLocation)) {
    return null;
  }

  return {
    sofor,
    vontato,
    potkocsi,
    comboLocation,
    potkocsiLocation
  };
}

function askTraktorbanExitConfirmation(context) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "timeline-event-form-overlay traktor-warning-overlay";

    const soforName = context.sofor?.nev || context.sofor?.id || "-";
    const vontatoName = context.vontato?.rendszam || context.vontato?.id || "-";
    const potkocsiName = context.potkocsi?.rendszam || context.potkocsi?.id || "-";

    overlay.innerHTML = `
      <div class="timeline-event-form traktor-warning-modal" role="dialog" aria-modal="true" aria-label="Traktorban kilépés megerősítése">
        <div class="timeline-event-form-title">Erőforrás helyeltérés</div>
        <div class="traktor-warning-question">Biztosan traktorban lépsz ki?</div>
        <div class="traktor-warning-details">
          <div>👤 Sofőr + 🚛 Vontató helye: <strong>${context.comboLocation}</strong></div>
          <div>🚚 Pótkocsi helye: <strong>${context.potkocsiLocation}</strong></div>
          <div class="traktor-warning-resources">${soforName} • ${vontatoName} • ${potkocsiName}</div>
        </div>
        <div class="timeline-event-form-actions">
          <button type="button" class="timeline-event-form-cancel" data-action="cancel">Mégse</button>
          <button type="button" class="timeline-event-form-save" data-action="confirm">Igen, traktorban lépek ki</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };

    const finish = (accepted) => {
      cleanup();
      resolve(Boolean(accepted));
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');

    cancelBtn?.addEventListener("click", () => finish(false));
    confirmBtn?.addEventListener("click", () => finish(true));

    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
    confirmBtn?.focus();
  });
}

function askNearbyFreePairConfirmation(context) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "timeline-event-form-overlay traktor-warning-overlay";

    const nearbySoforName = context.nearbyPair?.sofor?.nev || context.nearbyPair?.sofor?.id || "-";
    const nearbyVontatoName = context.nearbyPair?.vontato?.rendszam || context.nearbyPair?.vontato?.id || "-";
    const distanceLabel = Number.isFinite(context.nearbyPair?.distance)
      ? `${Math.round(context.nearbyPair.distance)} km`
      : "ismeretlen távolság";
    const availabilityLabel = context.nearbyPair?.availableAtMs
      ? formatDate(new Date(context.nearbyPair.availableAtMs).toISOString())
      : "-";

    overlay.innerHTML = `
      <div class="timeline-event-form traktor-warning-modal" role="dialog" aria-modal="true" aria-label="Közeli szabad erőforrás figyelmeztetés">
        <div class="timeline-event-form-title">Erőforrás alternatíva</div>
        <div class="traktor-warning-question">A közelben hamarosan lesz egy szabad sofőr+vontató. Biztosan küldesz egy másikat?</div>
        <div class="traktor-warning-details">
          <div>🚛 Rakott vontató helye: <strong>${context.tractorLocation}</strong></div>
          <div>📦 Érintett fuvar: <strong>${context.cargoBlock?.label || "-"}</strong></div>
          <div>🕒 Szabaduló páros: <strong>${availabilityLabel}</strong> • ${distanceLabel}</div>
          <div class="traktor-warning-resources">${nearbySoforName} • ${nearbyVontatoName} • ${context.nearbyPair?.stopLocation || "-"}</div>
        </div>
        <div class="timeline-event-form-actions">
          <button type="button" class="timeline-event-form-cancel" data-action="cancel">Mégse</button>
          <button type="button" class="timeline-event-form-save" data-action="confirm">Igen, küldök másikat</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };

    const finish = (accepted) => {
      cleanup();
      resolve(Boolean(accepted));
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    const cancelBtn = overlay.querySelector('[data-action="cancel"]');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');

    cancelBtn?.addEventListener("click", () => finish(false));
    confirmBtn?.addEventListener("click", () => finish(true));

    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
    confirmBtn?.focus();
  });
}

function askSpedicioDropOperation(context) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "spediccio-modal-overlay";

    const fuvarLabel = context?.fuvar?.megnevezes || context?.fuvar?.id || "-";
    const partnerLabel = context?.partnerName || "-";

    overlay.innerHTML = `
      <div class="spediccio-modal spediccio-drop-action-modal" role="dialog" aria-modal="true" aria-label="Spediciós művelet választása">
        <div class="spediccio-modal-header">
          <h3>Milyen műveletet szeretnél végrehajtani?</h3>
        </div>
        <div class="spediccio-drop-action-summary">
          <div><strong>Fuvar:</strong> ${fuvarLabel}</div>
          <div><strong>Partner:</strong> ${partnerLabel}</div>
        </div>
        <div class="spediccio-modal-actions spediccio-drop-action-buttons">
          <button type="button" class="btn spediccio-drop-action-btn" data-action="offer-request">Ajánlatkérés</button>
          <button type="button" class="btn spediccio-drop-action-btn" data-action="task-assignment">Feladat társítás</button>
          <button type="button" class="btn spediccio-cancel-btn" data-action="cancel">Mégsem</button>
        </div>
      </div>
    `;

    const finish = (value) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(null);
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(null);
      }
    });

    overlay.querySelector('[data-action="offer-request"]')?.addEventListener("click", () => {
      finish("offer-request");
    });

    overlay.querySelector('[data-action="task-assignment"]')?.addEventListener("click", () => {
      finish("task-assignment");
    });

    overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", () => {
      finish(null);
    });

    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="offer-request"]')?.focus();
  });
}

function isDriverTractorPair(sourceType, targetType) {
  return (
    (sourceType === "sofor" && targetType === "vontato") ||
    (sourceType === "vontato" && targetType === "sofor")
  );
}

function isTrailerTractorPair(sourceType, targetType) {
  return (
    (sourceType === "potkocsi" && targetType === "vontato") ||
    (sourceType === "vontato" && targetType === "potkocsi")
  );
}

function isValidResourcePair(sourceType, targetType) {
  if (sourceType === "partner" || targetType === "partner") {
    return false;
  }

  return isDriverTractorPair(sourceType, targetType) || isTrailerTractorPair(sourceType, targetType);
}

function unlinkSofor(sofor) {
  if (!sofor?.linkedVontatoId) {
    return;
  }

  const currentVontato = VONTATOK.find((v) => v.id === sofor.linkedVontatoId);
  if (currentVontato && currentVontato.linkedSoforId === sofor.id) {
    delete currentVontato.linkedSoforId;
  }

  delete sofor.linkedVontatoId;
}

function unlinkVontatoSofor(vontato) {
  if (!vontato?.linkedSoforId) {
    return;
  }

  const currentSofor = SOFOROK.find((s) => s.id === vontato.linkedSoforId);
  if (currentSofor && currentSofor.linkedVontatoId === vontato.id) {
    delete currentSofor.linkedVontatoId;
  }

  delete vontato.linkedSoforId;
}

function unlinkPotkocsi(potkocsi) {
  if (!potkocsi?.linkedVontatoId) {
    return;
  }

  const currentVontato = VONTATOK.find((v) => v.id === potkocsi.linkedVontatoId);
  if (currentVontato && currentVontato.linkedPotkocsiId === potkocsi.id) {
    delete currentVontato.linkedPotkocsiId;
  }

  delete potkocsi.linkedVontatoId;
}

function unlinkVontatoPotkocsi(vontato) {
  if (!vontato?.linkedPotkocsiId) {
    return;
  }

  const currentPotkocsi = POTKOCSIK.find((p) => p.id === vontato.linkedPotkocsiId);
  if (currentPotkocsi && currentPotkocsi.linkedVontatoId === vontato.id) {
    delete currentPotkocsi.linkedVontatoId;
  }

  delete vontato.linkedPotkocsiId;
}

function linkSoforToVontato(sofor, vontato) {
  unlinkSofor(sofor);
  unlinkVontatoSofor(vontato);

  sofor.linkedVontatoId = vontato.id;
  vontato.linkedSoforId = sofor.id;
}

function linkPotkocsiToVontato(potkocsi, vontato) {
  unlinkPotkocsi(potkocsi);
  unlinkVontatoPotkocsi(vontato);

  potkocsi.linkedVontatoId = vontato.id;
  vontato.linkedPotkocsiId = potkocsi.id;
}

function getStoredAssignment(fuvar) {
  return {
    soforId: fuvar.assignedSoforId || null,
    vontatoId: fuvar.assignedVontatoId || null,
    potkocsiId: fuvar.assignedPotkocsiId || null
  };
}

function saveFuvarAssignment(fuvar, assignment) {
  if (assignment.soforId) fuvar.assignedSoforId = assignment.soforId;
  else delete fuvar.assignedSoforId;

  if (assignment.vontatoId) fuvar.assignedVontatoId = assignment.vontatoId;
  else delete fuvar.assignedVontatoId;

  if (assignment.potkocsiId) fuvar.assignedPotkocsiId = assignment.potkocsiId;
  else delete fuvar.assignedPotkocsiId;
}

function removeFuvarBlocksForResource(resource, fuvarId) {
  if (!resource?.timeline) {
    return;
  }

  resource.timeline = resource.timeline.filter((block) => {
    return !(block.type === "fuvar" && !block.synthetic && block.fuvarId === fuvarId);
  });
}

function removeFuvarBlocksFromAllResources(fuvarId) {
  SOFOROK.forEach((resource) => removeFuvarBlocksForResource(resource, fuvarId));
  VONTATOK.forEach((resource) => removeFuvarBlocksForResource(resource, fuvarId));
  POTKOCSIK.forEach((resource) => removeFuvarBlocksForResource(resource, fuvarId));
}

function getLinkedAssignmentPatch(resourceType, resource) {
  const patch = {
    soforId: null,
    vontatoId: null,
    potkocsiId: null
  };

  if (!resource) {
    return patch;
  }

  if (resourceType === "sofor") {
    patch.soforId = resource.id;
    if (resource.linkedVontatoId) {
      patch.vontatoId = resource.linkedVontatoId;
      const linkedVontato = getResourceByType("vontato", resource.linkedVontatoId);
      if (linkedVontato?.linkedPotkocsiId) {
        patch.potkocsiId = linkedVontato.linkedPotkocsiId;
      }
    }
    return patch;
  }

  if (resourceType === "vontato") {
    patch.vontatoId = resource.id;
    if (resource.linkedSoforId) {
      patch.soforId = resource.linkedSoforId;
    }
    if (resource.linkedPotkocsiId) {
      patch.potkocsiId = resource.linkedPotkocsiId;
    }
    return patch;
  }

  patch.potkocsiId = resource.id;
  if (resource.linkedVontatoId) {
    patch.vontatoId = resource.linkedVontatoId;
    const linkedVontato = getResourceByType("vontato", resource.linkedVontatoId);
    if (linkedVontato?.linkedSoforId) {
      patch.soforId = linkedVontato.linkedSoforId;
    }
  }

  return patch;
}

function mergeAssignments(base, patch) {
  const merged = { ...base };

  if (patch.soforId) merged.soforId = patch.soforId;
  if (patch.vontatoId) merged.vontatoId = patch.vontatoId;
  if (patch.potkocsiId) merged.potkocsiId = patch.potkocsiId;

  return merged;
}

function canAssignFuvarToResource(resourceType, resource, fuvar) {
  if (!resource) {
    return false;
  }

  const suitability = evaluateFuvarSuitability(resourceType, resource, fuvar);
  if (!suitability?.suitable) {
    return false;
  }

  const timelineWithoutCurrentFuvar = (resource.timeline || []).filter((block) => {
    return !(block.type === "fuvar" && block.fuvarId === fuvar.id);
  });

  return !hasCollision(timelineWithoutCurrentFuvar, fuvar.felrakas.ido, fuvar.lerakas.ido);
}

function normalizeFuvarAssignment(fuvar, preferredType = null, preferredId = null) {
  let assignment = getStoredAssignment(fuvar);

  if (preferredType && preferredId) {
    assignment = {
      soforId: null,
      vontatoId: null,
      potkocsiId: null,
      ...assignment,
      [`${preferredType}Id`]: preferredId
    };
  }

  const expandFromType = (typeKey) => {
    const resourceId = assignment[`${typeKey}Id`];
    if (!resourceId) {
      return;
    }

    const resource = getResourceByType(typeKey, resourceId);
    assignment = mergeAssignments(assignment, getLinkedAssignmentPatch(typeKey, resource));
  };

  expandFromType("sofor");
  expandFromType("vontato");
  expandFromType("potkocsi");

  if (assignment.soforId) {
    const resource = getResourceByType("sofor", assignment.soforId);
    if (!canAssignFuvarToResource("sofor", resource, fuvar)) {
      assignment.soforId = null;
    }
  }

  if (assignment.vontatoId) {
    const resource = getResourceByType("vontato", assignment.vontatoId);
    if (!canAssignFuvarToResource("vontato", resource, fuvar)) {
      assignment.vontatoId = null;
    }
  }

  if (assignment.potkocsiId) {
    const resource = getResourceByType("potkocsi", assignment.potkocsiId);
    if (!canAssignFuvarToResource("potkocsi", resource, fuvar)) {
      assignment.potkocsiId = null;
    }
  }

  return assignment;
}

function applyFuvarAssignment(fuvar, assignment) {
  removeFuvarBlocksFromAllResources(fuvar.id);
  saveFuvarAssignment(fuvar, assignment);

  if (assignment.soforId) {
    const sofor = getResourceByType("sofor", assignment.soforId);
    if (sofor) {
      addFuvarBlockToTimeline(sofor, fuvar);
    }
  }

  if (assignment.vontatoId) {
    const vontato = getResourceByType("vontato", assignment.vontatoId);
    if (vontato) {
      addFuvarBlockToTimeline(vontato, fuvar);
    }
  }

  if (assignment.potkocsiId) {
    const potkocsi = getResourceByType("potkocsi", assignment.potkocsiId);
    if (potkocsi) {
      addFuvarBlockToTimeline(potkocsi, fuvar);
    }
  }

  refreshAllAutoTransitSegments();
}

function rebalanceAllFuvarAssignments() {
  FUVAROK.forEach((fuvar) => {
    const current = getStoredAssignment(fuvar);
    if (!current.soforId && !current.vontatoId && !current.potkocsiId) {
      return;
    }

    // A fuvar saját blokkjait el kell távolítani MIELŐTT az értékelés fut,
    // különben a collision-check "saját magával" ütközik és törli az ID-t.
    removeFuvarBlocksFromAllResources(fuvar.id);
    const normalized = normalizeFuvarAssignment(fuvar);
    applyFuvarAssignment(fuvar, normalized);
  });
}

async function assignResourcePair(sourceType, sourceId, targetType, targetId) {
  const source = getResourceByType(sourceType, sourceId);
  const target = getResourceByType(targetType, targetId);

  if (!source || !target) {
    return false;
  }

  if (!isValidResourcePair(sourceType, targetType)) {
    alert("Csak ezek a kapcsolások engedélyezettek: pótkocsi ↔ vontató, sofőr ↔ vontató.");
    return false;
  }

  const warningContext = buildTraktorbanWarningContext(sourceType, source, targetType, target);
  if (warningContext) {
    const accepted = await askTraktorbanExitConfirmation(warningContext);
    if (!accepted) {
      return false;
    }
  }

  const nearbyFreePairWarning = buildNearbyFreePairWarningContext(sourceType, source, targetType, target);
  if (nearbyFreePairWarning) {
    const accepted = await askNearbyFreePairConfirmation(nearbyFreePairWarning);
    if (!accepted) {
      return false;
    }
  }

  if (isDriverTractorPair(sourceType, targetType)) {
    const sofor = sourceType === "sofor" ? source : target;
    const vontato = sourceType === "vontato" ? source : target;
    linkSoforToVontato(sofor, vontato);
    rebalanceAllFuvarAssignments();
    return true;
  }

  const potkocsi = sourceType === "potkocsi" ? source : target;
  const vontato = sourceType === "vontato" ? source : target;
  linkPotkocsiToVontato(potkocsi, vontato);
  rebalanceAllFuvarAssignments();
  return true;
}

function getFuvarIdFromDataTransfer(event) {
  const transfer = event?.dataTransfer;
  if (!transfer) {
    return null;
  }

  const candidate =
    transfer.getData("application/x-transit-fuvar-id") ||
    transfer.getData("text/plain");

  if (!candidate) {
    return null;
  }

  return FUVAROK.some((item) => item.id === candidate) ? candidate : null;
}

function hasFuvarTransferType(event) {
  const types = event?.dataTransfer?.types;
  if (!types) {
    return false;
  }

  const list = Array.from(types);
  return list.includes("application/x-transit-fuvar-id") || list.includes("text/plain");
}

function getDraggedFuvarId(event = null) {
  if (dragState.kind === "fuvar" && dragState.fuvarId) {
    return dragState.fuvarId;
  }

  return getFuvarIdFromDataTransfer(event);
}

function getDropStateForResourceCard(targetType, targetId, transferFuvarId = null) {
  const fuvarId = transferFuvarId || (dragState.kind === "fuvar" ? dragState.fuvarId : null);

  if (!dragState.kind && !fuvarId) {
    return { allowed: false };
  }

  if (fuvarId) {
    const fuvar = FUVAROK.find((f) => f.id === fuvarId);

    if (targetType === "partner") {
      return { allowed: Boolean(fuvar?.spediccio), result: { suitable: Boolean(fuvar?.spediccio) } };
    }

    const resource = getResourceByType(targetType, targetId);
    const result = evaluateFuvarSuitability(targetType, resource, fuvar);
    return { allowed: Boolean(result?.suitable), result };
  }

  if (dragState.kind === "resource") {
    const isSame = dragState.sourceType === targetType && dragState.sourceId === targetId;
    if (isSame) {
      return { allowed: false };
    }

    return { allowed: isValidResourcePair(dragState.sourceType, targetType) };
  }

  return { allowed: false };
}

async function handleFuvarDropOnResource(targetType, targetId, explicitFuvarId = null) {
  const fuvarId = explicitFuvarId || dragState.fuvarId;
  const fuvar = FUVAROK.find((f) => f.id === fuvarId);

  if (targetType === "partner") {
    if (!fuvar) {
      return false;
    }

    if (!fuvar.spediccio) {
      alert("Partnerre csak spedició badge-es fuvar húzható.");
      return false;
    }

    const operation = await askSpedicioDropOperation({ fuvar, partnerName: targetId });
    if (!operation) {
      return false;
    }

    return assignFuvarToSpedicioPartner(fuvar.id, targetId, operation);
  }

  const resource = getResourceByType(targetType, targetId);
  const result = evaluateFuvarSuitability(targetType, resource, fuvar);

  if (!resource || !fuvar) {
    return false;
  }

  if (!result.suitable) {
    alert("Ez az erőforrás NEM alkalmas ehhez a fuvarhoz:\n- " + result.reasons.join("\n- "));
    return false;
  }

  if (hasCollision(resource.timeline || [], fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    alert("⚠️ Ez az erőforrás foglalt ebben az időszakban!");
    return false;
  }

  const assignment = normalizeFuvarAssignment(fuvar, targetType, targetId);
  if (!assignment[`${targetType}Id`]) {
    alert("A kiválasztott erőforrás nem rendelhető ehhez a fuvarhoz.");
    return false;
  }

  applyFuvarAssignment(fuvar, assignment);
  return true;
}

// DRAG START – FUVAR KÁRTYÁK
export function enableFuvarDrag() {
  document.querySelectorAll(".menu-card").forEach((card) => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (event) => {
      const fuvarId = card.dataset.id;
      if (!fuvarId) {
        return;
      }

      if (event.dataTransfer) {
        event.dataTransfer.setData("application/x-transit-fuvar-id", fuvarId);
        event.dataTransfer.setData("text/plain", fuvarId);
        event.dataTransfer.effectAllowed = "copyMove";
      }

      dragState.kind = "fuvar";
      dragState.fuvarId = fuvarId;
      dragState.sourceType = null;
      dragState.sourceId = null;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      resetDragState();
      clearHighlights();
    });
  });
}

// DROP TARGET – TIMELINE (csak fuvar húzható ide)
export function enableTimelineDrop() {
  document.querySelectorAll(".timeline-resource-name").forEach((row) => {
    row.addEventListener("dragover", (e) => {
      const fuvarId = getDraggedFuvarId(e);
      const hasTransfer = hasFuvarTransferType(e);
      if (!fuvarId && !hasTransfer) {
        return;
      }

      e.preventDefault();

      if (!fuvarId) {
        row.classList.remove("drop-ok", "drop-bad");
        return;
      }

      const type = row.dataset.resourceType;
      const id = row.dataset.resourceId;
      const fuvar = FUVAROK.find((f) => f.id === fuvarId);

      if (type === "partner") {
        if (fuvar?.spediccio) {
          row.classList.add("drop-ok");
          row.classList.remove("drop-bad");
        } else {
          row.classList.add("drop-bad");
          row.classList.remove("drop-ok");
        }
        return;
      }

      const resource = getResourceByType(type, id);
      const result = evaluateFuvarSuitability(type, resource, fuvar);

      if (result?.suitable) {
        row.classList.add("drop-ok");
        row.classList.remove("drop-bad");
      } else {
        row.classList.add("drop-bad");
        row.classList.remove("drop-ok");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-ok", "drop-bad");
    });

    row.addEventListener("drop", async (e) => {
      const fuvarId = getDraggedFuvarId(e);
      const hasTransfer = hasFuvarTransferType(e);
      if (hasTransfer) {
        e.preventDefault();
      }
      if (!fuvarId) {
        return;
      }

      row.classList.remove("drop-ok", "drop-bad");

      const type = row.dataset.resourceType;
      const resourceId = row.dataset.resourceId;
      const added = await handleFuvarDropOnResource(type, resourceId, fuvarId);

      if (!added) {
        return;
      }

      resetDragState();
      clearHighlights();
      runRefreshViews();
    });
  });
}

// ============================================================
// ERŐFORRÁS KÁRTYÁKRA VALÓ DROP
// - Fuvar → Erőforrás
// - Erőforrás → Erőforrás (Sofőr↔Vontató, Pótkocsi↔Vontató)
// ============================================================
export function enableResourceCardDrop() {
  document.querySelectorAll(".resource-card").forEach((card) => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", () => {
      const sourceType = card.dataset.type;
      const sourceId = card.dataset.id;

      if (sourceType === "partner") {
        return;
      }

      if (!sourceType || !sourceId) {
        return;
      }

      dragState.kind = "resource";
      dragState.fuvarId = null;
      dragState.sourceType = sourceType;
      dragState.sourceId = sourceId;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      resetDragState();
      clearHighlights();
    });

    card.addEventListener("dragover", (e) => {
      const transferFuvarId = getDraggedFuvarId(e);
      const hasTransfer = hasFuvarTransferType(e);
      if (!dragState.kind && !transferFuvarId && !hasTransfer) {
        return;
      }

      e.preventDefault();

      if (!dragState.kind && !transferFuvarId) {
        card.classList.remove("drop-ok", "drop-bad");
        return;
      }

      const targetType = card.dataset.type;
      const targetId = card.dataset.id;
      const dropState = getDropStateForResourceCard(targetType, targetId, transferFuvarId);

      if (dropState.allowed) {
        card.classList.add("drop-ok");
        card.classList.remove("drop-bad");
      } else {
        card.classList.add("drop-bad");
        card.classList.remove("drop-ok");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drop-ok", "drop-bad");
    });

    card.addEventListener("drop", async (e) => {
      const transferFuvarId = getDraggedFuvarId(e);
      const hasTransfer = hasFuvarTransferType(e);
      if (hasTransfer) {
        e.preventDefault();
      }
      if (!dragState.kind && !transferFuvarId) {
        return;
      }

      card.classList.remove("drop-ok", "drop-bad");

      const targetType = card.dataset.type;
      const targetId = card.dataset.id;
      let changed = false;

      if (transferFuvarId || dragState.kind === "fuvar") {
        changed = await handleFuvarDropOnResource(targetType, targetId, transferFuvarId);
      }

      if (dragState.kind === "resource") {
        changed = await assignResourcePair(
          dragState.sourceType,
          dragState.sourceId,
          targetType,
          targetId
        );
      }

      if (changed) {
        resetDragState();
        runRefreshViews();
      }

      clearHighlights();
    });
  });
}
