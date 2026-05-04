import { FUVAROK } from "../data/fuvarok.js";
import { SPEDICIO_PARTNER_NAMES } from "../data/spedicio-partners.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toTimestamp(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function toTypeKey(fuvar) {
  return String(fuvar?.kategoria || fuvar?.viszonylat || "unknown").toLowerCase();
}

function formatPriceLabel(price, currency) {
  const amount = String(price || "").trim();
  const curr = String(currency || "").trim();
  if (!amount) {
    return "";
  }
  return curr ? `${amount} ${curr}` : amount;
}

function buildPriceHistory(partnerName, typeKey, excludeFuvarId = null) {
  return FUVAROK
    .filter((fuvar) => fuvar?.id !== excludeFuvarId)
    .filter((fuvar) => fuvar?.spediccio)
    .filter((fuvar) => String(fuvar?.spediccioPartner || "") === partnerName)
    .filter((fuvar) => toTypeKey(fuvar) === typeKey)
    .map((fuvar) => {
      const form = fuvar?.spediccioForm || {};
      const priceLabel = formatPriceLabel(form.orderPrice, form.currency);
      return {
        fuvarId: fuvar.id,
        endMs: toTimestamp(fuvar?.lerakas?.ido || fuvar?.felrakas?.ido),
        priceLabel
      };
    })
    .filter((item) => Boolean(item.priceLabel))
    .sort((a, b) => b.endMs - a.endMs);
}

function buildDeterministicDummyScore(partnerName, typeKey) {
  const seed = `${normalizeText(partnerName)}|${typeKey}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100);
}

function buildDeterministicDummyPrice(partnerName, typeKey) {
  const seed = `price|${normalizeText(partnerName)}|${typeKey}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  // EUR 650–2800 range, 50-es kerekítés
  const raw = 650 + (abs % 44) * 50;
  return `${raw} EUR`;
}

function buildFuvarBlockForPartner(fuvar) {
  const form = fuvar?.spediccioForm || {};
  const priceLabel = formatPriceLabel(form.orderPrice, form.currency);
  const driverLabel = [form.driver1, form.driver2].filter(Boolean).join(" + ") || "-";
  const tractor = form.tractorPlate || "-";
  const trailer = form.trailerPlate || "-";
  const dispatcher = form.dispatcher || "-";

  const partnerSummaryParts = [];
  if (priceLabel) {
    partnerSummaryParts.push(`Ar: ${priceLabel}`);
  }
  if (driverLabel !== "-") {
    partnerSummaryParts.push(`Gépjárművezető: ${driverLabel}`);
  }
  if (tractor !== "-" || trailer !== "-") {
    partnerSummaryParts.push(`Jarmu: ${tractor} / ${trailer}`);
  }
  if (dispatcher !== "-") {
    partnerSummaryParts.push(`Fuvarszervezo: ${dispatcher}`);
  }

  return {
    start: fuvar.felrakas?.ido,
    end: fuvar.lerakas?.ido,
    type: "fuvar",
    label: fuvar.megnevezes,
    fuvarId: fuvar.id,
    felrakasCim: fuvar.felrakas?.cim,
    lerakasCim: fuvar.lerakas?.cim,
    adr: fuvar.adr,
    surgos: fuvar.surgos,
    kategoria: fuvar.kategoria,
    spedicioOperationType: fuvar.spediccioOperationType || "task-assignment",
    partnerSummary: partnerSummaryParts.join(" | "),
    partnerPriceLabel: priceLabel
  };
}

export function assignFuvarToSpedicioPartner(fuvarId, partnerName, operationType = "task-assignment") {
  const fuvar = FUVAROK.find((item) => item.id === fuvarId);
  if (!fuvar || !partnerName) {
    return false;
  }

  fuvar.spediccio = true;
  fuvar.spediccioPartner = partnerName;
  fuvar.spediccioOperationType = operationType;

  const typeKey = toTypeKey(fuvar);
  const priceHistory = buildPriceHistory(partnerName, typeKey, fuvar.id);
  if (priceHistory.length > 0) {
    fuvar.spediccioLastKnownPrice = priceHistory[0].priceLabel;
  } else {
    delete fuvar.spediccioLastKnownPrice;
  }

  return true;
}

export function getLatestSpedicioPriceForFuvarAndPartner(fuvar, partnerName) {
  if (!fuvar || !partnerName) {
    return "";
  }

  const typeKey = toTypeKey(fuvar);
  const priceHistory = buildPriceHistory(partnerName, typeKey, fuvar.id);
  return priceHistory[0]?.priceLabel || "";
}

export function buildSpedicioPartnerResources(selectedFuvarId = null) {
  const selectedFuvar = selectedFuvarId
    ? FUVAROK.find((item) => item.id === selectedFuvarId) || null
    : null;
  const selectedTypeKey = selectedFuvar ? toTypeKey(selectedFuvar) : "";

  const partners = SPEDICIO_PARTNER_NAMES.map((partnerName, index) => {
    const assignedFuvarok = FUVAROK
      .filter((fuvar) => fuvar?.spediccio)
      .filter((fuvar) => String(fuvar?.spediccioPartner || "") === partnerName)
      .sort((a, b) => toTimestamp(a?.felrakas?.ido) - toTimestamp(b?.felrakas?.ido));

    const timeline = assignedFuvarok
      .filter((fuvar) => fuvar?.felrakas?.ido && fuvar?.lerakas?.ido)
      .map((fuvar) => buildFuvarBlockForPartner(fuvar));

    const actualTypeCount = selectedTypeKey
      ? assignedFuvarok.filter((fuvar) => toTypeKey(fuvar) === selectedTypeKey).length
      : 0;

    const dummyTypeScore = selectedTypeKey
      ? buildDeterministicDummyScore(partnerName, selectedTypeKey)
      : 0;

    const combinedTypeScore = actualTypeCount * 1000 + dummyTypeScore;

    const realPrice = selectedTypeKey
      ? (buildPriceHistory(partnerName, selectedTypeKey)[0]?.priceLabel || "")
      : "";
    const latestPrice = realPrice ||
      (selectedTypeKey ? buildDeterministicDummyPrice(partnerName, selectedTypeKey) : "");

    return {
      id: partnerName,
      nev: partnerName,
      jelenlegi_pozicio: {
        hely: selectedTypeKey ? `Prioritas: ${combinedTypeScore}` : "Spedicio partner"
      },
      timeline,
      spedicioMeta: {
        assignedCount: assignedFuvarok.length,
        actualTypeCount,
        dummyTypeScore,
        combinedTypeScore,
        latestPrice,
        selectedTypeKey,
        initialIndex: index
      }
    };
  });

  if (!selectedFuvar) {
    return partners;
  }

  return partners
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const scoreDiff = right.item.spedicioMeta.combinedTypeScore - left.item.spedicioMeta.combinedTypeScore;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      if (left.item.spedicioMeta.latestPrice && !right.item.spedicioMeta.latestPrice) {
        return -1;
      }
      if (!left.item.spedicioMeta.latestPrice && right.item.spedicioMeta.latestPrice) {
        return 1;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}
