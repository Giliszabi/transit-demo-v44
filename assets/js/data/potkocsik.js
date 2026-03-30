import { DEMO_NEARBY_FREE_PAIR_SCENARIO, createScenarioTimelineBlock } from "./demo-warning-scenario.js";

// ==========================================================
// TransIT v4.4 – Pótkocsi adatbázis (Demo Dataset)
// 3 belföldi + 3 nemzetközi pótkocsi
// ADR érték random generálva
// ==========================================================

// Random ADR generátor (30% esély)
function randomADR() {
  return Math.random() < 0.3;
}

export const POTKOCSIK = [

  // ===========================
  // 3 BELFÖLDI PÓTKOCSI
  // ===========================
  {
    id: "P1",
    rendszam: "WBU760",
    tipus: "belföldi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: []
  },

  // ===========================
  // 3 NEMZETKÖZI PÓTKOCSI
  // ===========================
  {
    id: "P4",
    rendszam: "AAKW011",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    linkedVontatoId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoVontatoId,
    timeline: [
      createScenarioTimelineBlock({
        fuvarId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoFuvarId,
        label: "Demo rakott vontató – Budapest → Győr",
        start: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoStartIso,
        end: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoEndIso,
        felrakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPickupAddress,
        lerakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoDropoffAddress,
        viszonylat: "belfold"
      })
    ]
  },
  {
    id: "P5",
    rendszam: "WAB112",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: []
  },
  {
    id: "P6",
    rendszam: "WGG021",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: []
  },
  {
    id: "P7",
    rendszam: "WTR774",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  }

];
