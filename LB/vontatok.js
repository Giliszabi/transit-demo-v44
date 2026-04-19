import { DEMO_NEARBY_FREE_PAIR_SCENARIO, createScenarioTimelineBlock } from "./demo-warning-scenario.js";

// ==========================================================
// TransIT v4.4 – Vontató adatbázis (Bővített – 12 vontató)
// 4 belföldi + 8 nemzetközi
// ==========================================================

function tb(fuvarId, label, start, end, felrakasCim, lerakasCim, viszonylat) {
  return createScenarioTimelineBlock({ fuvarId, label, start, end, felrakasCim, lerakasCim, viszonylat });
}

export const VONTATOK = [
  // ═══ BELFÖLDI (4) ═══
  { id: "V1", rendszam: "ABCDEF123", tipus: "belföldi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" }, timeline: [] },
  { id: "V2", rendszam: "BKM-201", tipus: "belföldi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Budapest" },
    timeline: [tb("BF01","Környe → Esztergom","2026-04-13T06:00","2026-04-13T08:30","Környe","Esztergom","belfold")] },
  { id: "V3", rendszam: "GYR-302", tipus: "belföldi", kezes: "1", adr: false, jelenlegi_pozicio: { hely: "Győr" }, timeline: [] },
  { id: "V12", rendszam: "DEB-120", tipus: "belföldi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Debrecen" },
    timeline: [tb("BF02","Debrecen → Budapest","2026-04-14T08:00","2026-04-14T12:00","Debrecen","Budapest","belfold")] },

  // ═══ NEMZETKÖZI (8) ═══
  { id: "V4", rendszam: "AAAJ510", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Budapest" },
    linkedPotkocsiId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPotkocsiId,
    timeline: [createScenarioTimelineBlock({ fuvarId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoFuvarId, label: "Demo rakott – Budapest → Győr", start: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoStartIso, end: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoEndIso, felrakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPickupAddress, lerakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoDropoffAddress, viszonylat: "belfold" })] },
  { id: "V5", rendszam: "AAEZ551", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" }, linkedSoforId: "S5", timeline: [] },
  { id: "V6", rendszam: "PUN079", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" },
    timeline: [tb("EX01","Környe → München","2026-04-13T04:00","2026-04-13T14:00","Környe, Ipari Park","München, Logistik Hub","export")] },
  { id: "V7", rendszam: "AAJX904", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Budapest" },
    linkedSoforId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeSoforId,
    timeline: [createScenarioTimelineBlock({ fuvarId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeFuvarId, label: "Demo felszabaduló pár", start: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeStartIso, end: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeEndIso, felrakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativePickupAddress, lerakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeDropoffAddress, viszonylat: "belfold" })] },
  { id: "V8", rendszam: "HBG-801", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Budapest" }, linkedSoforId: "S9",
    timeline: [tb("IM03","Hamburg → Környe","2026-04-13T22:00","2026-04-14T10:00","Hamburg","Környe","import")] },
  { id: "V9", rendszam: "MLN-901", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" }, timeline: [] },
  { id: "V10", rendszam: "RTD-100", tipus: "nemzetkozi", kezes: "1", adr: false, jelenlegi_pozicio: { hely: "Győr" },
    timeline: [tb("EX05","Tatabánya → Wien","2026-04-14T06:00","2026-04-14T12:00","Tatabánya","Wien","export")] },
  { id: "V11", rendszam: "WIE-110", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Tatabánya" }, timeline: [] }
];
