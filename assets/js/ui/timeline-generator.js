// ============================================================
// TransIT v4.4 – Continuous Timeline Generator (72h)
// - Minden erőforrásnak folyamatos timeline-t generál (ha üres)
// - A szintetikus fuvar blokkokat automatikusan semleges eseményre cseréli
// - Gépjárművezető: piheno | szabadsag | beteg  (beteg >= 24h)
// - Vontató: szerviz | allas
// - Pótkocsi: szerviz | standby
// ============================================================

const TIMELINE_HOURS = 72;

const IDLE_BLOCK_BY_KIND = {
  sofor: { type: "piheno", label: "Pihenő" },
  vontato: { type: "allas", label: "Állás" },
  potkocsi: { type: "standby", label: "Standby" }
};

function getBaseDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
  const sum = items.reduce((acc, item) => acc + item.w, 0);
  let random = Math.random() * sum;

  for (const item of items) {
    random -= item.w;
    if (random <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1].value;
}

function toISO(date) {
  return date.toISOString();
}

function clampEnd(end, maxEnd) {
  return end > maxEnd ? maxEnd : end;
}

function getIdleBlockMeta(kind) {
  return IDLE_BLOCK_BY_KIND[kind] || IDLE_BLOCK_BY_KIND.potkocsi;
}

export function genWindowBlocks(kind, windowStart, windowHours) {
  const start0 = new Date(windowStart);
  const endMax = addHours(start0, windowHours);

  const blocks = [];
  let cursor = new Date(start0);
  let hasDriverGap = false;

  while (cursor < endMax) {
    let type;
    let durationH;
    let label;

    if (kind === "sofor") {
      type = pickWeighted([
        { value: "fuvar", w: 55 },
        { value: "piheno", w: 25 },
        { value: "szabadsag", w: 10 },
        { value: "beteg", w: 10 }
      ]);

      if (type === "fuvar") {
        durationH = randInt(4, 14);
        label = "Fuvar";
      } else if (type === "piheno") {
        durationH = randInt(6, 12);
        label = "Pihenő";
      } else if (type === "szabadsag") {
        durationH = randInt(12, 36);
        label = "Szabadság";
      } else {
        durationH = randInt(24, 48);
        label = "Betegszab.";
      }
    } else if (kind === "vontato") {
      type = pickWeighted([
        { value: "fuvar", w: 65 },
        { value: "szerviz", w: 20 },
        { value: "allas", w: 15 }
      ]);

      if (type === "fuvar") {
        durationH = randInt(6, 16);
        label = "Fuvar";
      } else if (type === "szerviz") {
        durationH = randInt(6, 24);
        label = "Szerviz";
      } else {
        durationH = randInt(4, 18);
        label = "Állás";
      }
    } else {
      type = pickWeighted([
        { value: "fuvar", w: 60 },
        { value: "szerviz", w: 20 },
        { value: "standby", w: 20 }
      ]);

      if (type === "fuvar") {
        durationH = randInt(6, 16);
        label = "Fuvar";
      } else if (type === "szerviz") {
        durationH = randInt(6, 24);
        label = "Szerviz";
      } else {
        durationH = randInt(4, 24);
        label = "Standby";
      }
    }

    const s = new Date(cursor);
    const e = clampEnd(addHours(s, durationH), endMax);

    if (type === "fuvar") {
      const idleMeta = getIdleBlockMeta(kind);
      type = idleMeta.type;
      label = idleMeta.label;
    }

    blocks.push({
      start: toISO(s),
      end: toISO(e),
      type,
      label,
      synthetic: true
    });

    cursor = new Date(e);

    if (kind === "sofor" && cursor < endMax) {
      const elapsedHours = (cursor.getTime() - start0.getTime()) / (1000 * 60 * 60);
      const shouldInsertGap = hasDriverGap ? Math.random() < 0.25 : elapsedHours >= 18;

      if (shouldInsertGap) {
        const gapHours = randInt(2, 6);
        const gapEnd = clampEnd(addHours(cursor, gapHours), endMax);

        if (gapEnd > cursor) {
          cursor = new Date(gapEnd);
          hasDriverGap = true;
        }
      }
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      start: toISO(start0),
      end: toISO(endMax),
      type: kind === "sofor" ? "piheno" : "standby",
      label: "N/A",
      synthetic: true
    });
  }

  return blocks;
}

function genContinuousTimeline(kind) {
  return genWindowBlocks(kind, getBaseDate(), TIMELINE_HOURS);
}

function normalizeSyntheticFuvarBlocks(timeline, kind) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return;
  }

  const idleMeta = getIdleBlockMeta(kind);

  timeline.forEach((block) => {
    if (block?.synthetic && block.type === "fuvar") {
      block.type = idleMeta.type;
      block.label = idleMeta.label;
    }
  });
}

function ensureForList(list, kind) {
  list.forEach((resource) => {
    if (!resource.timeline) {
      resource.timeline = [];
    }

    normalizeSyntheticFuvarBlocks(resource.timeline, kind);

    resource.timeline = resource.timeline.filter((block) => {
      return !(block?.synthetic && block.type !== "fuvar");
    });
  });
}

export function ensureContinuousTimelines(SOFOROK, VONTATOK, POTKOCSIK) {
  ensureForList(SOFOROK, "sofor");
  ensureForList(VONTATOK, "vontato");
  ensureForList(POTKOCSIK, "potkocsi");
}