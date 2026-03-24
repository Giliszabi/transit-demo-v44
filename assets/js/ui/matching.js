// =======================================================
// TransIT v4.4 - MATCHING ENGINE (Bidirectional)
// Sofőr / Vontató / Pótkocsi ↔ Fuvar
// Szabályalapú relevancia-értékelés
// =======================================================

// Helper: time collision
function hasCollision(timeline, start, end) {
  const s = new Date(start);
  const e = new Date(end);

  return timeline.some(b => {
    if (b.synthetic) {
      return false;
    }

    const bs = new Date(b.start);
    const be = new Date(b.end);
    return (s < be && e > bs);
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ensureResourceTipus(resource, localTypeLabel) {
  if (!resource.tipus) {
    resource.tipus = Math.random() < 0.5 ? localTypeLabel : "nemzetkozi";
  }

  return resource.tipus;
}

function isDomesticOnlyTipus(tipus) {
  return normalizeText(tipus).includes("belfold");
}

// =======================================================
// FUVAR TAG-EK KIEGÉSZÍTÉSE (ADR, sürgős, típus)
// =======================================================
export function evaluateFuvarTags(fuvar) {
  const now = Date.now();
  const start = new Date(fuvar.felrakas.ido).getTime();

  // sürgős
  fuvar.surgos = (start - now) < (24 * 3600 * 1000);

  // ADR — ha nincs explicit, random
  if (fuvar.adr === undefined) {
    fuvar.adr = Math.random() < 0.25;
  }

  // fuvar típus: belföld / export / import / spedició
  const fel = fuvar.felrakas.cim.toLowerCase();
  const ler = fuvar.lerakas.cim.toLowerCase();

  const huFel = fel.includes("hungary") || fel.includes("budapest") || fel.includes("magyar");
  const huLer = ler.includes("hungary") || ler.includes("budapest") || ler.includes("magyar");

  if (huFel && huLer) {
    fuvar.kategoria = "belfold";
  } else if (huFel && !huLer) {
    fuvar.kategoria = "export";
  } else if (!huFel && huLer) {
    fuvar.kategoria = "import";
  } else {
    fuvar.kategoria = "spediccio";
  }
}

// =======================================================
// SOFŐR EVALUÁCIÓ
// =======================================================
export function evaluateSoforForFuvar(sofor, fuvar) {
  const reasons = [];
  let suitable = true;
  const soforTipus = ensureResourceTipus(sofor, "belföldes");

  // ADR
  if (fuvar.adr && !sofor.adr) {
    suitable = false;
    reasons.push("Nincs ADR képesítés");
  }

  // Belföldi vs nemzetközi
  if (fuvar.kategoria !== "belfold" && isDomesticOnlyTipus(soforTipus)) {
    suitable = false;
    reasons.push("Belföldes sofőr nem vihet nemzetközi fuvart");
  }

  // Kezes kompatibilitás
  if (fuvar.kezes && fuvar.kezes !== sofor.kezes) {
    suitable = false;
    reasons.push(`A fuvar ${fuvar.kezes} kezes, de a sofőr ${sofor.kezes} kezes`);
  }

  // Időütközés (timeline)
  if (hasCollision(sofor.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    suitable = false;
    reasons.push("Időben ütközik meglévő foglalással");
  }

  return {
    suitable,
    reasons,
    grade: suitable ? "ok" : "bad"
  };
}

// =======================================================
// VONTATÓ EVALUÁCIÓ
// =======================================================
export function evaluateVontatoForFuvar(vontato, fuvar) {
  const reasons = [];
  let suitable = true;
  const vontatoTipus = ensureResourceTipus(vontato, "belföldi");

  // ADR → minden vontató alkalmas (kérésed szerint)
  // nincs ADR feltétel

  // Belföldi vs nemzetközi
  if (fuvar.kategoria !== "belfold" && isDomesticOnlyTipus(vontatoTipus)) {
    suitable = false;
    reasons.push("Belföldi vontató nem vihet nemzetközi fuvart");
  }

  // Kezes kompatibilitás
  if (fuvar.kezes && fuvar.kezes !== vontato.kezes) {
    suitable = false;
    reasons.push(`A fuvar ${fuvar.kezes} kezes, de a vontató ${vontato.kezes} kezes`);
  }

  // Időütközés
  if (hasCollision(vontato.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    suitable = false;
    reasons.push("Időben ütközik meglévő foglalással");
  }

  return {
    suitable,
    reasons,
    grade: suitable ? "ok" : "bad"
  };
}

// =======================================================
// PÓTKOCSI EVALUÁCIÓ
// =======================================================
export function evaluatePotkocsiForFuvar(pk, fuvar) {
  const reasons = [];
  let suitable = true;
  const potkocsiTipus = ensureResourceTipus(pk, "belföldi");

  // ADR
  if (fuvar.adr && !pk.adr) {
    suitable = false;
    reasons.push("A fuvar ADR-es, de a pótkocsi nem ADR alkalmas");
  }

  // Belföldi vs nemzetközi
  if (fuvar.kategoria !== "belfold" && isDomesticOnlyTipus(potkocsiTipus)) {
    suitable = false;
    reasons.push("Belföldi pótkocsi nem vihet nemzetközi fuvart");
  }

  // Időütközés
  if (hasCollision(pk.timeline, fuvar.felrakas.ido, fuvar.lerakas.ido)) {
    suitable = false;
    reasons.push("Időben ütközik egy másik feladattal");
  }

  return {
    suitable,
    reasons,
    grade: suitable ? "ok" : "bad"
  };
}

// =======================================================
// MINDHÁROM EVALUÁCIÓ FUTTATÁSA
// =======================================================
export function evaluateAllResources(SOFOROK, VONTATOK, POTKOCSIK, fuvar) {
  return {
    soforok: SOFOROK.map(s => ({
      id: s.id,
      nev: s.nev, // UI használja, JS engine nem
      result: evaluateSoforForFuvar(s, fuvar)
    })),

    vontatok: VONTATOK.map(v => ({
      id: v.id,
      rendszam: v.rendszam,
      result: evaluateVontatoForFuvar(v, fuvar)
    })),

    potkocsik: POTKOCSIK.map(p => ({
      id: p.id,
      rendszam: p.rendszam,
      result: evaluatePotkocsiForFuvar(p, fuvar)
    }))
  };
}

// =======================================================
// ERŐFORRÁS → MELY FUVART VIHETI (reverse matching)
// =======================================================
export function evaluateFuvarokForResource(resource, FUVAROK, type) {
  return FUVAROK.map(f => {

    evaluateFuvarTags(f); // biztos legyenek tag-ek

    let res;
    if (type === "sofor") res = evaluateSoforForFuvar(resource, f);
    if (type === "vontato") res = evaluateVontatoForFuvar(resource, f);
    if (type === "potkocsi") res = evaluatePotkocsiForFuvar(resource, f);

    return {
      fuvarId: f.id,
      megnevezes: f.megnevezes,
      result: res
    };
  });
}
