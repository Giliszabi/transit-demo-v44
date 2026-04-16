import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEligibilityIndex,
  evaluateDriverAgainstJob,
  evaluateDriverEligibility
} from "../assets/js/core/eligibility-engine.js";

test("leave override blocks driver start", () => {
  const driver = {
    id: "DRV-1",
    nev: "Teszt Sofőr",
    kezes: "1",
    adr: true,
    active: true,
    timeline: [],
    driving: {
      dailyDrivenHours: 0,
      dailyLimitHours: 9,
      weeklyDrivenHours: 0,
      weeklyLimitHours: 56,
      fortnightDrivenHours: 0,
      fortnightLimitHours: 90,
      restMinutesEarned: 660
    }
  };

  const schedule = {
    driverId: "DRV-1",
    cycleLengthDays: 7,
    workDays: 5,
    restDays: 2,
    cycleAnchorDate: "2026-04-16",
    exceptions: [{ date: "2026-04-16", override: "ON_LEAVE" }]
  };

  const jobs = [{
    id: "JOB-1",
    felrakas: { ido: "2026-04-16T08:00:00", cim: "Budapest" },
    lerakas: { ido: "2026-04-16T16:00:00", cim: "Wien" },
    adr: false,
    kezes: 1,
    tavolsag_km: 480
  }];

  const result = evaluateDriverEligibility({
    driver,
    schedule,
    vehicles: [],
    jobs,
    planningDate: "2026-04-16"
  });

  assert.equal(result.canStart, false);
  assert.ok(result.reasons.some((reason) => reason.code === "ON_LEAVE"));
});

test("adr incompatibility removes the job from compatible set", () => {
  const driver = {
    id: "DRV-2",
    nev: "ADR Nélküli",
    kezes: "1",
    adr: false,
    active: true,
    timeline: [],
    driving: {
      dailyDrivenHours: 1,
      dailyLimitHours: 9,
      weeklyDrivenHours: 8,
      weeklyLimitHours: 56,
      fortnightDrivenHours: 18,
      fortnightLimitHours: 90,
      restMinutesEarned: 660
    }
  };

  const schedule = {
    driverId: "DRV-2",
    cycleLengthDays: 7,
    workDays: 7,
    restDays: 0,
    cycleAnchorDate: "2026-04-16",
    exceptions: []
  };

  const jobs = [
    {
      id: "JOB-ADR",
      felrakas: { ido: "2026-04-16T08:00:00", cim: "Budapest" },
      lerakas: { ido: "2026-04-16T14:00:00", cim: "Prága" },
      adr: true,
      kezes: 1,
      tavolsag_km: 320
    },
    {
      id: "JOB-OK",
      felrakas: { ido: "2026-04-16T15:00:00", cim: "Budapest" },
      lerakas: { ido: "2026-04-16T21:00:00", cim: "Brno" },
      adr: false,
      kezes: 1,
      tavolsag_km: 300
    }
  ];

  const result = evaluateDriverEligibility({
    driver,
    schedule,
    vehicles: [],
    jobs,
    planningDate: "2026-04-16"
  });

  assert.equal(result.canStart, true);
  assert.deepEqual(result.compatibleJobIds, ["JOB-OK"]);
});

test("timeline collision makes a job incompatible", () => {
  const result = evaluateDriverAgainstJob({
    driver: {
      id: "DRV-3",
      nev: "Ütköző Sofőr",
      kezes: "1",
      adr: true,
      active: true,
      timeline: [
        {
          start: "2026-04-16T07:00:00",
          end: "2026-04-16T12:00:00",
          type: "fuvar",
          synthetic: false
        }
      ],
      driving: {
        dailyDrivenHours: 1,
        dailyLimitHours: 9,
        weeklyDrivenHours: 8,
        weeklyLimitHours: 56,
        fortnightDrivenHours: 18,
        fortnightLimitHours: 90,
        restMinutesEarned: 660
      }
    },
    schedule: {
      driverId: "DRV-3",
      cycleLengthDays: 7,
      workDays: 7,
      restDays: 0,
      cycleAnchorDate: "2026-04-16",
      exceptions: []
    },
    vehicles: [],
    job: {
      id: "JOB-COLLIDE",
      felrakas: { ido: "2026-04-16T10:00:00", cim: "Győr" },
      lerakas: { ido: "2026-04-16T14:00:00", cim: "Linz" },
      adr: false,
      kezes: 1,
      tavolsag_km: 280
    },
    planningDate: "2026-04-16"
  });

  assert.equal(result.compatible, false);
  assert.ok(result.reasons.some((reason) => reason.code === "TIMELINE_COLLISION"));
});

test("buildEligibilityIndex returns results by driver id", () => {
  const index = buildEligibilityIndex({
    drivers: [{
      id: "DRV-4",
      nev: "Index Sofőr",
      kezes: "1",
      adr: true,
      active: true,
      timeline: []
    }],
    driverSchedules: [{
      driverId: "DRV-4",
      cycleLengthDays: 7,
      workDays: 7,
      restDays: 0,
      cycleAnchorDate: "2026-04-16",
      exceptions: []
    }],
    vehicles: [],
    jobs: [{
      id: "JOB-INDEX",
      felrakas: { ido: "2026-04-16T08:00:00", cim: "Tatabánya" },
      lerakas: { ido: "2026-04-16T12:00:00", cim: "Wien" },
      adr: false,
      kezes: 1,
      tavolsag_km: 240
    }],
    planningDate: "2026-04-16"
  });

  assert.equal(index.has("DRV-4"), true);
  assert.deepEqual(index.get("DRV-4").compatibleJobIds, ["JOB-INDEX"]);
});