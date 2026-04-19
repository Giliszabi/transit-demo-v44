import { DEMO_NEARBY_FREE_PAIR_SCENARIO, createScenarioTimelineBlock } from "./demo-warning-scenario.js";

// ==========================================================
// TransIT v4.4 – Sofőr adatbázis (Demo Dataset – Bővített)
// 18 sofőr: 5 belföldes + 8 nemzetközi 1-kezes + 5 nemzetközi 2-kezes
// ==========================================================

function randomADR() { return Math.random() < 0.3; }

function generateDrivingMetrics(tipus) {
  const isDomestic = String(tipus || "").toLowerCase().includes("belfold");
  if (isDomestic) {
    return { dailyDrivenHours: 4 + Math.random() * 3, dailyLimitHours: 10, weeklyDrivenHours: 28 + Math.random() * 12, weeklyLimitHours: 56, fortnightDrivenHours: 52 + Math.random() * 22, fortnightLimitHours: 90, restMinutesEarned: (20 + Math.random() * 40) * 60 };
  }
  return { dailyDrivenHours: 0.3 + Math.random() * 1.5, dailyLimitHours: 18, weeklyDrivenHours: 8 + Math.random() * 10, weeklyLimitHours: 72, fortnightDrivenHours: 20 + Math.random() * 20, fortnightLimitHours: 130, restMinutesEarned: (55 + Math.random() * 90) * 60 };
}

function createIntlProfile(tier) {
  if (tier === "weak") return { dailyDrivenHours: 7.6, dailyLimitHours: 9, weeklyDrivenHours: 50, weeklyLimitHours: 56, fortnightDrivenHours: 84, fortnightLimitHours: 90, restMinutesEarned: 22 * 60 };
  if (tier === "medium") return { dailyDrivenHours: 1.6, dailyLimitHours: 18, weeklyDrivenHours: 22, weeklyLimitHours: 66, fortnightDrivenHours: 42, fortnightLimitHours: 118, restMinutesEarned: 62 * 60 };
  return { dailyDrivenHours: 1.1, dailyLimitHours: 18, weeklyDrivenHours: 14, weeklyLimitHours: 72, fortnightDrivenHours: 28, fortnightLimitHours: 130, restMinutesEarned: 95 * 60 };
}

function tb(fuvarId, label, start, end, felrakasCim, lerakasCim, viszonylat) {
  return createScenarioTimelineBlock({ fuvarId, label, start, end, felrakasCim, lerakasCim, viszonylat });
}

export const SOFOROK = [
  // ═══ BELFÖLDES (5) ═══
  { id: "S1", nev: "Aranyos László", tipus: "belföldes", kezes: "1", adr: randomADR(), jelenlegi_pozicio: { hely: "Környe" }, timeline: [], driving: generateDrivingMetrics("belfoldes") },
  { id: "S2", nev: "Bodnár Péter", tipus: "belföldes", kezes: "1", adr: false, jelenlegi_pozicio: { hely: "Budapest" },
    timeline: [tb("BF01","Környe → Esztergom","2026-04-13T06:00","2026-04-13T08:30","Környe","Esztergom","belfold")],
    driving: generateDrivingMetrics("belfoldes") },
  { id: "S3", nev: "Csonka Tamás", tipus: "belföldes", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Győr" }, timeline: [], driving: generateDrivingMetrics("belfoldes") },
  { id: "S15", nev: "Szűcs Gábor", tipus: "belföldes", kezes: "1", adr: false, jelenlegi_pozicio: { hely: "Debrecen" },
    timeline: [tb("BF02","Debrecen → Budapest","2026-04-14T08:00","2026-04-14T12:00","Debrecen","Budapest","belfold")],
    driving: generateDrivingMetrics("belfoldes") },
  { id: "S16", nev: "Varga Zoltán", tipus: "belföldes", kezes: "1", adr: randomADR(), jelenlegi_pozicio: { hely: "Tatabánya" }, timeline: [], driving: generateDrivingMetrics("belfoldes") },

  // ═══ NEMZETKÖZI 1-KEZES (8) ═══
  { id: "S4", nev: "Árgyellán István Augusto", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Budapest" }, timeline: [], driving: createIntlProfile("strong") },
  { id: "S5", nev: "Árvai Gábor", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" }, linkedVontatoId: "V5", timeline: [], driving: createIntlProfile("strong") },
  { id: "S6", nev: "Balázs István", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" },
    timeline: [tb("EX01","Környe → München","2026-04-13T04:00","2026-04-13T14:00","Környe, Ipari Park","München, Logistik Hub","export")],
    driving: createIntlProfile("medium") },
  { id: "S8", nev: "Farkas Attila", tipus: "nemzetkozi", kezes: "1", adr: false, jelenlegi_pozicio: { hely: "Győr" }, timeline: [], driving: createIntlProfile("strong") },
  { id: "S9", nev: "Horváth Dániel", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Budapest" }, linkedVontatoId: "V8",
    timeline: [tb("IM03","Hamburg → Környe","2026-04-13T22:00","2026-04-14T10:00","Hamburg, Logistics Dock","Környe, Ipari Park","import")],
    driving: createIntlProfile("medium") },
  { id: "S10", nev: "Jakab Márton", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Környe" }, timeline: [], driving: createIntlProfile("strong") },
  { id: "S11", nev: "Kiss Norbert", tipus: "nemzetkozi", kezes: "1", adr: false, jelenlegi_pozicio: { hely: "Tatabánya" },
    timeline: [tb("EX05","Tatabánya → Wien","2026-04-14T06:00","2026-04-14T12:00","Tatabánya","Wien, Freudenau","export")],
    driving: createIntlProfile("medium") },
  { id: "S12", nev: "Lakatos Bence", tipus: "nemzetkozi", kezes: "1", adr: true, jelenlegi_pozicio: { hely: "Győr" }, timeline: [], driving: createIntlProfile("strong") },

  // ═══ NEMZETKÖZI 2-KEZES (5) ═══
  { id: "S7", nev: "Adamek István", tipus: "nemzetkozi", kezes: "2", adr: true, jelenlegi_pozicio: { hely: "Budapest" },
    linkedVontatoId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeVontatoId,
    timeline: [createScenarioTimelineBlock({ fuvarId: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeFuvarId, label: "Demo felszabaduló pár – Tatabánya → Budapest", start: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeStartIso, end: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeEndIso, felrakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativePickupAddress, lerakasCim: DEMO_NEARBY_FREE_PAIR_SCENARIO.alternativeDropoffAddress, viszonylat: "belfold" })],
    driving: createIntlProfile("weak") },
  { id: "S13", nev: "Molnár Richárd", tipus: "nemzetkozi", kezes: "2", adr: true, jelenlegi_pozicio: { hely: "Környe" }, timeline: [], driving: createIntlProfile("strong") },
  { id: "S14", nev: "Nagy Kristóf", tipus: "nemzetkozi", kezes: "2", adr: false, jelenlegi_pozicio: { hely: "Budapest" },
    timeline: [tb("EX08","Budapest → Milano","2026-04-13T20:00","2026-04-14T08:00","Budapest, BILK","Milano, Hub Nord","export")],
    driving: createIntlProfile("medium") },
  { id: "S17", nev: "Oláh Sándor", tipus: "nemzetkozi", kezes: "2", adr: true, jelenlegi_pozicio: { hely: "Győr" },
    timeline: [tb("IM06","Rotterdam → Győr","2026-04-14T14:00","2026-04-15T06:00","Rotterdam, ECT Delta","Győr, Átrakó terminál","import")],
    driving: createIntlProfile("strong") },
  { id: "S18", nev: "Papp Levente", tipus: "nemzetkozi", kezes: "2", adr: true, jelenlegi_pozicio: { hely: "Tatabánya" }, timeline: [], driving: createIntlProfile("strong") }
];
