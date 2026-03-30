function formatHoursCompact(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }

  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pickRandomSchedule() {
  return Math.random() < 0.5 ? "5/2" : "10/4";
}

export function ensureSoforDisplayMeta(sofor) {
  if (!sofor) {
    return {
      drivingLabel: "0/0",
      adrOk: false,
      akasztOk: false,
      rovidOk: false,
      schedule: "5/2"
    };
  }

  if (typeof sofor.akasztOk !== "boolean") {
    sofor.akasztOk = Math.random() < 0.5;
  }

  if (typeof sofor.rovidOk !== "boolean") {
    sofor.rovidOk = Math.random() < 0.5;
  }

  if (sofor.workSchedule !== "5/2" && sofor.workSchedule !== "10/4") {
    sofor.workSchedule = pickRandomSchedule();
  }

  const driving = sofor.driving || {};
  const dailyRemaining = Math.max(0, Number(driving.dailyLimitHours || 0) - Number(driving.dailyDrivenHours || 0));
  const weeklyRemaining = Math.max(0, Number(driving.weeklyLimitHours || 0) - Number(driving.weeklyDrivenHours || 0));

  return {
    drivingLabel: `${formatHoursCompact(dailyRemaining)}/${formatHoursCompact(weeklyRemaining)}`,
    adrOk: Boolean(sofor.adr),
    akasztOk: Boolean(sofor.akasztOk),
    rovidOk: Boolean(sofor.rovidOk),
    schedule: sofor.workSchedule
  };
}

export function buildSoforMetaTooltip(sofor) {
  const meta = ensureSoforDisplayMeta(sofor);
  return `Vezetési idő maradék (napi/heti): ${meta.drivingLabel}\nADR: ${meta.adrOk ? "igen" : "nem"}\nAKASZT: ${meta.akasztOk ? "igen" : "nem"}\nRÖVID: ${meta.rovidOk ? "igen" : "nem"}\nMunkarend: ${meta.schedule}`;
}

export function renderSoforMetaBadges(sofor, options = {}) {
  const meta = ensureSoforDisplayMeta(sofor);
  const compactClass = options.compact ? " driver-meta-row-compact" : "";
  const adrLabel = options.shortLabels ? "ADR" : "ADR";
  const akasztLabel = options.shortLabels ? "AK" : "AKASZT";
  const rovidLabel = options.shortLabels ? "RÖV" : "RÖVID";

  return `
    <div class="driver-meta-row${compactClass}">
      <span class="driver-pill driver-pill-driving">${meta.drivingLabel}</span>
      <span class="driver-pill ${meta.adrOk ? "driver-pill-ok" : "driver-pill-bad"}">${adrLabel}</span>
      <span class="driver-pill ${meta.akasztOk ? "driver-pill-ok" : "driver-pill-bad"}">${akasztLabel}</span>
      <span class="driver-pill ${meta.rovidOk ? "driver-pill-ok" : "driver-pill-bad"}">${rovidLabel}</span>
      <span class="driver-pill driver-pill-neutral">${meta.schedule}</span>
    </div>
  `;
}