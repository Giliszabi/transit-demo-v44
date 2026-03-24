// ===================================================================
// DRAG & DROP ENGINE + MATCHING ENGINE
// ===================================================================

import { FUVAROK } from "../data/fuvarok.js";
import { SOFOROK } from "../data/soforok.js";
import { VONTATOK } from "../data/vontatok.js";
import { POTKOCSIK } from "../data/potkocsik.js";

import { evaluateSoforForFuvar, evaluateVontatoForFuvar, evaluatePotkocsiForFuvar } from "./matching.js";
import { addFuvarBlockToTimeline, hasCollision, refreshAutoDeadheadBlocksForVontato } from "./timeline.js";

const dragState = {
  kind: null,
  fuvarId: null,
  sourceType: null,
  sourceId: null
};

let refreshViewsHandler = null;

export function setDragDropRefreshHandler(handler) {
  refreshViewsHandler = typeof handler === "function" ? handler : null;
}

function runRefreshViews() {
  if (refreshViewsHandler) {
    refreshViewsHandler();
  }
}

function refreshAllAutoDeadheads() {
  VONTATOK.forEach((vontato) => {
    refreshAutoDeadheadBlocksForVontato(vontato);
  });
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

  refreshAllAutoDeadheads();
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

function assignResourcePair(sourceType, sourceId, targetType, targetId) {
  const source = getResourceByType(sourceType, sourceId);
  const target = getResourceByType(targetType, targetId);

  if (!source || !target) {
    return false;
  }

  if (!isValidResourcePair(sourceType, targetType)) {
    alert("Csak ezek a kapcsolások engedélyezettek: pótkocsi ↔ vontató, sofőr ↔ vontató.");
    return false;
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

function handleFuvarDropOnResource(targetType, targetId, explicitFuvarId = null) {
  const fuvarId = explicitFuvarId || dragState.fuvarId;
  const fuvar = FUVAROK.find((f) => f.id === fuvarId);
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

    row.addEventListener("drop", (e) => {
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
      const added = handleFuvarDropOnResource(type, resourceId, fuvarId);

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

    card.addEventListener("drop", (e) => {
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
        changed = handleFuvarDropOnResource(targetType, targetId, transferFuvarId);
      }

      if (dragState.kind === "resource") {
        changed = assignResourcePair(
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
