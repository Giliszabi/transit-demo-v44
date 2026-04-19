import { DEMO_NEARBY_FREE_PAIR_SCENARIO, createScenarioTimelineBlock } from "./demo-warning-scenario.js";

// ==========================================================
// TransIT v4.4 – Pótkocsi adatbázis (Bővített – 12 pótkocsi)
// 4 belföldi + 8 nemzetközi
// ==========================================================

function randomADR() { return Math.random() < 0.3; }

function tb(fuvarId, label, start, end, felrakasCim, lerakasCim, viszonylat) {
  return createScenarioTimelineBlock({ fuvarId, label, start, end, felrakasCim, lerakasCim, viszonylat });
}

export const POTKOCSIK = [
  // ═══ BELFÖLDI (4) ═══
  { id: "P1", rendszam: "WBU760", tipus: "belföldi", adr: randomADR(), jelenlegi_pozicio: { hely: "Környe" }, timeline: [] },
  { id: "P2", rendszam: "WKE201", tipus: "belföldi", adr: true, jelenlegi_pozicio: { hely: "Budapest" },
    timeline: [tb("BF01","Környe → Esztergom","2026-04-13T06:00","2026-04-13T08:30","Környe","Esztergom","belfold")] },
  { id: "P3", rendszam: "WGY301", tipus: "belföldi", adr: false, jelenlegi_pozicio: { hely: "Győr" }, timeline: [] },
  { id: "P12", rendszam: "WDB120", tipus: "belföldi", adr: randomADR(), jelenlegi_pozicio: { hely: "Debrecen" },
    timeline: [tb("BF02","Debrecen → Budapest","2026-04-14T08:00","2026-04-14T12:00","Debrecen","Budapest","belfold")] },

  // ═══ NEMZETKÖZI (8) ═══
  { id: "P4", rendszam: "AAKW011", tipus: "nemzetkozi", adr: randomADR(), jelenlegi_pozicio: { hely: "Budapest" },
    linkedVontatoId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoVontatoId,
    timeline: [createScenarioTimelineBlock({ fuvarId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoFuvarId, label: "Demo rakott – Budapest → Győr", start: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoStartIso, end: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoEndIso, felrakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPickupAddress, lerakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoDropoffAddress, viszonylat: "belfold" })] },
  { id: "P5", rendszam: "WAB112", tipus: "nemzetkozi", adr: randomADR(), jelenlegi_pozicio: { hely: "Környe" }, timeline: [] },
  { id: "P6", rendszam: "WGG021", tipus: "nemzetkozi", adr: true, jelenlegi_pozicio: { hely: "Környe" },
    timeline: [tb("EX01","Környe → München","2026-04-13T04:00","2026-04-13T14:00","Környe","München","export")] },
  { id: "P7", rendszam: "WTR774", tipus: "nemzetkozi", adr: true, jelenlegi_pozicio: { hely: "Budapest" }, timeline: [] },
  { id: "P8", rendszam: "WHB801", tipus: "nemzetkozi", adr: true, jelenlegi_pozicio: { hely: "Budapest" },
    timeline: [tb("IM03","Hamburg → Környe","2026-04-13T22:00","2026-04-14T10:00","Hamburg","Környe","import")] },
  { id: "P9", rendszam: "WML901", tipus: "nemzetkozi", adr: randomADR(), jelenlegi_pozicio: { hely: "Környe" }, timeline: [] },
  { id: "P10", rendszam: "WRT100", tipus: "nemzetkozi", adr: false, jelenlegi_pozicio: { hely: "Győr" },
    timeline: [tb("EX05","Tatabánya → Wien","2026-04-14T06:00","2026-04-14T12:00","Tatabánya","Wien","export")] },
  { id: "P11", rendszam: "WWE110", tipus: "nemzetkozi", adr: true, jelenlegi_pozicio: { hely: "Tatabánya" }, timeline: [] }
];
