import { DEMO_NEARBY_FREE_PAIR_SCENARIO, createScenarioTimelineBlock } from "./demo-warning-scenario.js";

// ==========================================================
// TransIT v4.4 – Vontató adatbázis (Demo Dataset)
// 3 belföldi + 3 nemzetközi vontató
// Forrásadatok: Gépkocsitörzs Excel file  [1](https://technetichu-my.sharepoint.com/personal/szabolcs_gilincsek_technetic_hu/_layouts/15/Doc.aspx?sourcedoc=%7BE4F49845-3E48-4629-9F17-368EFABCD60D%7D&file=Ge%CC%81pja%CC%81rmu%CC%8Bto%CC%88rzs_20260127083949%20(1).xlsx&action=default&mobileredirect=true).xlsx&action=default&mobileredirect=true).xlsx&action=default&mobileredirect=true)
// Minden vontató ADR-képes (kérés szerint nincs ADR-limit)
// ==========================================================

export const VONTATOK = [

  // ===========================
  // 3 BELFÖLDI VONTATÓ
  // ===========================
  {
    id: "V1",
    rendszam: "ABCDEF123",
    tipus: "belföldi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: []
  },

  // ===========================
  // 3 NEMZETKÖZI VONTATÓ
  // ===========================
  {
    id: "V4",
    rendszam: "AAAJ510",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Budapest" },
    linkedPotkocsiId: DEMO_NEARBY_FREE_PAIR_SCENARIO.cargoPotkocsiId,
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
    id: "V5",
    rendszam: "AAEZ551",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Környe" },
    linkedSoforId: "S5",
    timeline: []
  },
  {
    id: "V6",
    rendszam: "PUN079",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: []
  },
  {
    id: "V7",
    rendszam: "AAJX904",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Budapest" },
    linkedSoforId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeSoforId,
    timeline: [
      createScenarioTimelineBlock({
        fuvarId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeFuvarId,
        label: "Demo felszabaduló pár – Tatabánya → Budapest",
        start: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeStartIso,
        end: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeEndIso,
        felrakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativePickupAddress,
        lerakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeDropoffAddress,
        viszonylat: "belfold"
      })
    ]
  }

];
