import { FUVAROK } from "../data/fuvarok.js";

export function getFuvarCategoryFromFuvar(fuvar) {
  return fuvar?.kategoria || fuvar?.viszonylat || "";
}

export function isFullyAssignedFuvar(fuvar) {
  return Boolean(fuvar?.assignedSoforId && fuvar?.assignedVontatoId && fuvar?.assignedPotkocsiId);
}

export function findFuvarById(fuvarId, fuvarList = FUVAROK) {
  if (!fuvarId) {
    return null;
  }

  return fuvarList.find((item) => item.id === fuvarId) || null;
}

export function getLinkedImportFuvarForDomestic(domesticFuvar, fuvarList = FUVAROK) {
  if (!domesticFuvar || getFuvarCategoryFromFuvar(domesticFuvar) !== "belfold") {
    return null;
  }

  const directLinkedImportId = domesticFuvar.utofutasImportFuvarId || domesticFuvar.kapcsoltImportFuvarId || null;
  const directLinkedImport = findFuvarById(directLinkedImportId, fuvarList);
  if (directLinkedImport && getFuvarCategoryFromFuvar(directLinkedImport) === "import") {
    return directLinkedImport;
  }

  return fuvarList.find((candidate) => {
    return getFuvarCategoryFromFuvar(candidate) === "import"
      && candidate?.utofutasBelfoldFuvarId === domesticFuvar.id;
  }) || null;
}

export function getLinkedExportFuvarForDomestic(domesticFuvar, fuvarList = FUVAROK) {
  if (!domesticFuvar || getFuvarCategoryFromFuvar(domesticFuvar) !== "belfold") {
    return null;
  }

  const directLinkedExportId = domesticFuvar.elofutasExportFuvarId || domesticFuvar.kapcsoltExportFuvarId || null;
  const directLinkedExport = findFuvarById(directLinkedExportId, fuvarList);
  if (directLinkedExport && getFuvarCategoryFromFuvar(directLinkedExport) === "export") {
    return directLinkedExport;
  }

  return fuvarList.find((candidate) => {
    return getFuvarCategoryFromFuvar(candidate) === "export"
      && candidate?.elofutasBelfoldFuvarId === domesticFuvar.id;
  }) || null;
}

export function getDomesticTransitRoleInfo(fuvar, fuvarList = FUVAROK) {
  if (!fuvar || getFuvarCategoryFromFuvar(fuvar) !== "belfold") {
    return null;
  }

  const linkedExportFuvar = getLinkedExportFuvarForDomestic(fuvar, fuvarList);
  if (linkedExportFuvar) {
    return {
      role: "elofutas",
      label: `Előfutás • ${linkedExportFuvar.id}`,
      linkedFuvar: linkedExportFuvar
    };
  }

  const linkedImportFuvar = getLinkedImportFuvarForDomestic(fuvar, fuvarList);
  if (linkedImportFuvar) {
    return {
      role: "utofutas",
      label: `Utófutás • ${linkedImportFuvar.id}`,
      linkedFuvar: linkedImportFuvar
    };
  }

  return null;
}

function getSafeTime(fuvar, field) {
  const value = fuvar?.[field]?.ido || "";
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function buildDomesticTransitQueue(fuvarList = FUVAROK, options = {}) {
  const includeAssigned = Boolean(options.includeAssigned);
  const queue = {
    elofutas: [],
    utofutas: []
  };

  fuvarList
    .filter((fuvar) => getFuvarCategoryFromFuvar(fuvar) === "belfold")
    .forEach((fuvar) => {
      const transitRoleInfo = getDomesticTransitRoleInfo(fuvar, fuvarList);
      if (!transitRoleInfo) {
        return;
      }

      if (!includeAssigned && isFullyAssignedFuvar(fuvar)) {
        return;
      }

      queue[transitRoleInfo.role].push({
        role: transitRoleInfo.role,
        domesticFuvar: fuvar,
        linkedFuvar: transitRoleInfo.linkedFuvar,
        label: transitRoleInfo.label
      });
    });

  queue.elofutas.sort((left, right) => getSafeTime(left.domesticFuvar, "felrakas") - getSafeTime(right.domesticFuvar, "felrakas"));
  queue.utofutas.sort((left, right) => getSafeTime(left.domesticFuvar, "felrakas") - getSafeTime(right.domesticFuvar, "felrakas"));

  return {
    ...queue,
    total: queue.elofutas.length + queue.utofutas.length
  };
}