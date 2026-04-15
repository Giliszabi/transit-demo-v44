function roundUpToQuarterHour(date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);

  const minutes = rounded.getMinutes();
  const offset = (15 - (minutes % 15)) % 15;
  if (offset > 0) {
    rounded.setMinutes(minutes + offset);
  }

  return rounded;
}

function shiftIso(baseDate, offsetMinutes) {
  return new Date(baseDate.getTime() + offsetMinutes * 60 * 1000).toISOString();
}

export function createScenarioTimelineBlock({
  fuvarId,
  label,
  start,
  end,
  felrakasCim,
  lerakasCim,
  viszonylat
}) {
  return {
    start,
    end,
    type: "fuvar",
    label,
    fuvarId,
    felrakasCim,
    lerakasCim,
    adr: false,
    surgos: false,
    kategoria: viszonylat
  };
}

const scenarioBase = roundUpToQuarterHour(new Date(2026, 3, 13, 11, 0));

export const DEMO_NEARBY_FREE_PAIR_SCENARIO = {
  cargoFuvarId: "F22",
  alternativeFuvarId: "F23",
  cargoVontatoId: "V4",
  cargoPotkocsiId: "P4",
  incomingSoforId: "S4",
  alternativeSoforId: "S7",
  alternativeVontatoId: "V7",
  cargoLocation: "Budapest",
  cargoPickupAddress: "Magyarország, Budapest, BILK Terminál",
  cargoDropoffAddress: "Magyarország, Győr, Átrakó terminál",
  alternativePickupAddress: "Magyarország, Tatabánya, Disztribúciós központ",
  alternativeDropoffAddress: "Magyarország, Budapest, BILK Terminál",
  cargoStartIso: shiftIso(scenarioBase, 120),
  cargoEndIso: shiftIso(scenarioBase, 330),
  alternativeStartIso: shiftIso(scenarioBase, 15),
  alternativeEndIso: shiftIso(scenarioBase, 75)
};