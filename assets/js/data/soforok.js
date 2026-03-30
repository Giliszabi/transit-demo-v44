import { DEMO_NEARBY_FREE_PAIR_SCENARIO, createScenarioTimelineBlock } from "./demo-warning-scenario.js";

// ==========================================================
// TransIT v4.4 – Sofőr adatbázis (Demo Dataset)
// 3 belföldes + 3 nemzetközi (1 kezes) + 3 nemzetközi (2 kezes)
// ADR érték RANDOM generálva betöltéskor
// Forrásadatok: sofor_lista_kategoriak.xlsx  [1](https://technetichu-my.sharepoint.com/personal/szabolcs_gilincsek_technetic_hu/_layouts/15/Doc.aspx?sourcedoc=%7B0C0ECEB8-D05C-4DBC-A063-AF58EDE235BF%7D&file=sofor_lista_kategoriak.xlsx&action=default&mobileredirect=true)
// ==========================================================

// Random ADR generátor
function randomADR() {
  return Math.random() < 0.3; // 30% esély, piaci átlagnak megfelelő
}

// Random vezetési óra generátor (dummy adat)
function generateDrivingMetrics(tipus = "nemzetkozi") {
  const isDomestic = String(tipus || "").toLowerCase().includes("belfold");

  if (isDomestic) {
    return {
      // Belfoldes profil: szukebb keretek, foleg helyi fuvarokra
      dailyDrivenHours: 4 + Math.random() * 3,
      dailyLimitHours: 10,
      weeklyDrivenHours: 28 + Math.random() * 12,
      weeklyLimitHours: 56,
      fortnightDrivenHours: 52 + Math.random() * 22,
      fortnightLimitHours: 90,
      restMinutesEarned: (20 + Math.random() * 40) * 60
    };
  }

  return {
    // Nemzetkozi profil: demohoz tagabb maradek ido, hogy ne legyen minden export/import piros
    dailyDrivenHours: 0.3 + Math.random() * 1.5,
    dailyLimitHours: 18,
    weeklyDrivenHours: 8 + Math.random() * 10,
    weeklyLimitHours: 72,
    fortnightDrivenHours: 20 + Math.random() * 20,
    fortnightLimitHours: 130,
    restMinutesEarned: (55 + Math.random() * 90) * 60
  };
}

function createIntlProfile(tier) {
  if (tier === "weak") {
    return {
      dailyDrivenHours: 7.6,
      dailyLimitHours: 9,
      weeklyDrivenHours: 50,
      weeklyLimitHours: 56,
      fortnightDrivenHours: 84,
      fortnightLimitHours: 90,
      restMinutesEarned: 22 * 60
    };
  }

  if (tier === "medium") {
    return {
      dailyDrivenHours: 1.6,
      dailyLimitHours: 18,
      weeklyDrivenHours: 22,
      weeklyLimitHours: 66,
      fortnightDrivenHours: 42,
      fortnightLimitHours: 118,
      restMinutesEarned: 62 * 60
    };
  }

  return {
    dailyDrivenHours: 1.1,
    dailyLimitHours: 18,
    weeklyDrivenHours: 14,
    weeklyLimitHours: 72,
    fortnightDrivenHours: 28,
    fortnightLimitHours: 130,
    restMinutesEarned: 95 * 60
  };
}

export const SOFOROK = [
  // ===========================
  // 3 BELFÖLDES SOFŐR
  // ===========================
  {
    id: "S1",
    nev: "Aranyos László",
    tipus: "belföldes",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: [],
    driving: generateDrivingMetrics("belfoldes")
  },

  // ===========================
  // 3 NEMZETKÖZI – 1 KEZES
  // ===========================
  {
    id: "S4",
    nev: "Árgyellán István Augusto",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: [],
    driving: createIntlProfile("strong")
  },
  {
    id: "S5",
    nev: "Árvai Gábor",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Környe" },
    linkedVontatoId: "V5",
    timeline: [],
    driving: createIntlProfile("strong")
  },
  {
    id: "S6",
    nev: "Balázs István",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: true,
    jelenlegi_pozicio: { hely: "Környe" },
    timeline: [],
    driving: createIntlProfile("medium")
  },
  {
    id: "S7",
    nev: "Adamek István",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: true,
    jelenlegi_pozicio: { hely: "Budapest" },
    linkedVontatoId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeVontatoId,
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
    ],
    driving: createIntlProfile("weak")
  }

  // ===========================
  // 3 NEMZETKÖZI – 2 KEZES
  // ===========================
  /*
  ,
  {
    id: "S7",
    nev: "Adamek István",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "S8",
    nev: "Bagi Lajos",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Győr" },
    timeline: []
  },
  {
    id: "S9",
    nev: "Csák László",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Pécs" },
    timeline: []
  }
  */
];
