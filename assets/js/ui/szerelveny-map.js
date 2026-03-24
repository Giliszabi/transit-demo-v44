// ============================================================
// TransIT v4.4 – SZERELVENY TERKEP (OpenStreetMap + Leaflet)
// - Szerelveny markerek
// - Benzinkut es kamionparkolo POI-k
// - Hover tooltip: szerelveny adatok
// ============================================================

import { formatDate } from "../utils.js";
import { FUVAROK } from "../data/fuvarok.js";

const mapRegistry = new Map();
const routeCache = new Map();

const CITY_COORDS = {
  budapest: [47.4979, 19.0402],
  gyor: [47.6875, 17.6504],
  tatabanya: [47.5692, 18.4048],
  szekesfehervar: [47.1860, 18.4221],
  kecskemet: [46.9062, 19.6913],
  pecs: [46.0727, 18.2323],
  miskolc: [48.1035, 20.7784],
  debrecen: [47.5316, 21.6273],
  szeged: [46.2530, 20.1414],
  nyiregyhaza: [47.9558, 21.7167],
  szombathely: [47.2307, 16.6218],
  kornye: [47.5478, 18.3337],
  frankfurt: [50.1109, 8.6821],
  wien: [48.2082, 16.3738],
  munchen: [48.1351, 11.5820],
  milano: [45.4642, 9.1900],
  brno: [49.1951, 16.6068],
  linz: [48.3069, 14.2858]
};

const FUEL_POIS = [
  { name: "MOL M0 Dunaharaszti", coords: [47.3604, 19.0933] },
  { name: "OMV M1 Biatorbagy", coords: [47.4708, 18.8332] },
  { name: "Shell Gyor M1", coords: [47.6921, 17.6341] },
  { name: "MOL Kecskemet M5", coords: [46.9301, 19.7051] },
  { name: "OMV Szeged M5", coords: [46.2428, 20.1490] }
];

const TRUCK_PARKING_POIS = [
  { name: "Kamionparkolo M0 Csepel", coords: [47.3972, 19.0988] },
  { name: "Kamionparkolo M1 Tata", coords: [47.6476, 18.3030] },
  { name: "Kamionparkolo M3 Gyortelek", coords: [47.9357, 21.6222] },
  { name: "Kamionparkolo M5 Kiskunfelegyhaza", coords: [46.7041, 19.8452] },
  { name: "Kamionparkolo M7 Szekesfehervar", coords: [47.1897, 18.4448] }
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveCoordsFromLocation(rawLocation) {
  const location = normalize(rawLocation);

  const key = Object.keys(CITY_COORDS).find((candidate) => {
    return location.includes(candidate);
  });

  if (key) {
    return CITY_COORDS[key];
  }

  return CITY_COORDS.budapest;
}

function normalizeCoordKey(coord) {
  return `${Number(coord[0]).toFixed(5)},${Number(coord[1]).toFixed(5)}`;
}

function isSameCoord(a, b) {
  if (!a || !b) {
    return false;
  }

  return Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;
}

function coordToOsrmToken(coord) {
  return `${coord[1]},${coord[0]}`;
}

async function fetchRoadSegment(fromCoord, toCoord) {
  const cacheKey = `${normalizeCoordKey(fromCoord)}=>${normalizeCoordKey(toCoord)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const endpoint = `https://router.project-osrm.org/route/v1/driving/${coordToOsrmToken(fromCoord)};${coordToOsrmToken(toCoord)}?overview=full&geometries=geojson&steps=false`;

  const requestPromise = fetch(endpoint)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`OSRM HTTP ${response.status}`);
      }

      return response.json();
    })
    .then((payload) => {
      const route = payload?.routes?.[0];
      const coords = route?.geometry?.coordinates;

      if (!Array.isArray(coords) || coords.length < 2) {
        throw new Error("OSRM geometry missing");
      }

      return coords.map(([lng, lat]) => [lat, lng]);
    });

  routeCache.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } catch (error) {
    routeCache.delete(cacheKey);
    throw error;
  }
}

function getFuvarBlocks(resource) {
  return (resource?.timeline || []).filter((block) => block.type === "fuvar" && !block.synthetic);
}

function collectAssemblyFuvarBlocks(vontato, sofor, potkocsi) {
  const unique = new Map();

  [vontato, sofor, potkocsi].forEach((resource) => {
    getFuvarBlocks(resource).forEach((block) => {
      const key = block.fuvarId || `${block.label}|${block.start}|${block.end}`;
      if (!unique.has(key)) {
        unique.set(key, block);
      }
    });
  });

  return Array.from(unique.values()).sort((a, b) => new Date(a.start) - new Date(b.start));
}

function resolveLinkedSofor(vontato, soforok) {
  return soforok.find((s) => {
    return s.id === vontato.linkedSoforId || s.linkedVontatoId === vontato.id;
  }) || null;
}

function resolveLinkedPotkocsi(vontato, potkocsik) {
  return potkocsik.find((p) => {
    return p.id === vontato.linkedPotkocsiId || p.linkedVontatoId === vontato.id;
  }) || null;
}

function buildAssemblies(soforok, vontatok, potkocsik) {
  return vontatok
    .map((vontato) => {
      const sofor = resolveLinkedSofor(vontato, soforok);
      const potkocsi = resolveLinkedPotkocsi(vontato, potkocsik);
      const fuvarBlocks = collectAssemblyFuvarBlocks(vontato, sofor, potkocsi);

      return {
        id: vontato.id,
        sofor,
        vontato,
        potkocsi,
        fuvarBlocks
      };
    })
    .filter((assembly) => Boolean(assembly.sofor || assembly.potkocsi || assembly.fuvarBlocks.length > 0));
}

function getAssemblyLocationLabel(assembly) {
  return (
    assembly.vontato?.jelenlegi_pozicio?.hely ||
    assembly.potkocsi?.jelenlegi_pozicio?.hely ||
    assembly.sofor?.jelenlegi_pozicio?.hely ||
    "Budapest"
  );
}

function getRouteCoordsForAssembly(assembly) {
  const waypoints = [];

  assembly.fuvarBlocks.forEach((block) => {
    const fuvar = FUVAROK.find((item) => item.id === block.fuvarId);

    const pickupAddress = block.felrakasCim || fuvar?.felrakas?.cim || "";
    const dropoffAddress = block.lerakasCim || fuvar?.lerakas?.cim || "";

    if (!pickupAddress && !dropoffAddress) {
      return;
    }

    const pickup = resolveCoordsFromLocation(pickupAddress);
    const dropoff = resolveCoordsFromLocation(dropoffAddress);

    if (pickup) {
      waypoints.push(pickup);
    }

    if (dropoff) {
      waypoints.push(dropoff);
    }
  });

  return waypoints;
}

async function buildRoadRouteCoords(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return [];
  }

  const result = [];

  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const fromCoord = waypoints[i];
    const toCoord = waypoints[i + 1];

    if (isSameCoord(fromCoord, toCoord)) {
      continue;
    }

    try {
      const segment = await fetchRoadSegment(fromCoord, toCoord);

      segment.forEach((point, index) => {
        if (result.length > 0 && index === 0) {
          return;
        }
        result.push(point);
      });
    } catch (error) {
      // Ha routing hiba van, lokális fallback-ként egyenes szakaszt rajzolunk.
      if (result.length === 0 || !isSameCoord(result[result.length - 1], fromCoord)) {
        result.push(fromCoord);
      }
      result.push(toCoord);
    }
  }

  return result;
}

function createTruckIcon(isComplete) {
  return window.L.divIcon({
    className: "assembly-truck-icon-wrapper",
    html: `<span class="assembly-truck-icon ${isComplete ? "complete" : "partial"}">🚛</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [0, -14]
  });
}

function getAssemblyProgress(assembly) {
  if (!assembly.fuvarBlocks.length) {
    return 0;
  }

  const startMs = Math.min(...assembly.fuvarBlocks.map((block) => new Date(block.start).getTime()));
  const endMs = Math.max(...assembly.fuvarBlocks.map((block) => new Date(block.end).getTime()));

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0.5;
  }

  const nowMs = Date.now();

  if (nowMs <= startMs) {
    return 0.1;
  }

  if (nowMs >= endMs) {
    return 0.9;
  }

  const ratio = (nowMs - startMs) / (endMs - startMs);
  return Math.min(0.92, Math.max(0.08, ratio));
}

function getPointAlongRoute(routeCoords, progress) {
  if (!Array.isArray(routeCoords) || routeCoords.length === 0) {
    return null;
  }

  if (routeCoords.length === 1) {
    return routeCoords[0];
  }

  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  const segmentLengths = [];
  let total = 0;

  for (let i = 0; i < routeCoords.length - 1; i += 1) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segmentLengths.push(length);
    total += length;
  }

  if (total <= 0) {
    return routeCoords[0];
  }

  const target = total * clamped;
  let traveled = 0;

  for (let i = 0; i < segmentLengths.length; i += 1) {
    const segment = segmentLengths[i];
    const next = traveled + segment;

    if (target <= next) {
      const t = segment > 0 ? (target - traveled) / segment : 0;
      const from = routeCoords[i];
      const to = routeCoords[i + 1];

      return [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t
      ];
    }

    traveled = next;
  }

  return routeCoords[routeCoords.length - 1];
}

function withCollisionOffset(coords, offsetIndex) {
  const [lat, lng] = coords;
  const radius = 0.012 * (1 + Math.floor(offsetIndex / 6));
  const angle = (offsetIndex % 6) * (Math.PI / 3);

  return [
    lat + Math.sin(angle) * radius,
    lng + Math.cos(angle) * radius
  ];
}

function createAssemblyTooltip(assembly, locationLabel, progressLabel = "-") {
  const soforName = assembly.sofor?.nev || "nincs";
  const vontatoRendszam = assembly.vontato?.rendszam || "nincs";
  const potkocsiRendszam = assembly.potkocsi?.rendszam || "nincs";

  const fuvarList = assembly.fuvarBlocks.length > 0
    ? assembly.fuvarBlocks.map((block, index) => {
      const tags = [
        block.kategoria,
        block.adr ? "ADR" : "",
        block.surgos ? "Surgos" : ""
      ].filter(Boolean).join(" • ");

      return `
        <div class="assembly-tooltip-fuvar">
          <div><strong>${index + 1}. ${escapeHtml(block.label)}</strong></div>
          <div>${escapeHtml(formatDate(block.start))} → ${escapeHtml(formatDate(block.end))}</div>
          <div>${escapeHtml(tags || "nincs extra jeloles")}</div>
        </div>
      `;
    }).join("")
    : "<div class=\"assembly-tooltip-fuvar\">Nincs hozzarendelt fuvar.</div>";

  return `
    <div class="assembly-tooltip-card">
      <div class="assembly-tooltip-title">Szerelveny • ${escapeHtml(assembly.id)}</div>
      <div>📍 ${escapeHtml(locationLabel)}</div>
      <div>🧭 Haladas: ${escapeHtml(progressLabel)}</div>
      <div>👤 Sofor: ${escapeHtml(soforName)}</div>
      <div>🚛 Vontato: ${escapeHtml(vontatoRendszam)}</div>
      <div>🚚 Potkocsi: ${escapeHtml(potkocsiRendszam)}</div>
      <div class="assembly-tooltip-sep">Fuvarok:</div>
      ${fuvarList}
    </div>
  `;
}

function createLeafletState(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return null;
  }

  if (!window.L) {
    container.innerHTML = "<div class=\"assembly-map-error\">A terkep modul nem toltheto be (Leaflet hianyzik).</div>";
    return null;
  }

  if (mapRegistry.has(containerId)) {
    return mapRegistry.get(containerId);
  }

  const map = window.L.map(containerId, {
    zoomControl: true,
    attributionControl: true
  }).setView([47.1625, 19.5033], 7);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const assemblyLayer = window.L.layerGroup().addTo(map);
  const fuelLayer = window.L.layerGroup().addTo(map);
  const parkingLayer = window.L.layerGroup().addTo(map);

  const legend = window.L.control({ position: "bottomright" });
  legend.onAdd = function onAdd() {
    const div = window.L.DomUtil.create("div", "assembly-map-legend");
    div.innerHTML = `
      <div><span class="legend-dot assembly"></span> Szerelveny</div>
      <div><span class="legend-dot fuel"></span> Benzinkut</div>
      <div><span class="legend-dot parking"></span> Kamionparkolo</div>
    `;
    return div;
  };
  legend.addTo(map);

  const state = {
    map,
    assemblyLayer,
    fuelLayer,
    parkingLayer,
    assemblyGraphics: new Map(),
    focusedAssemblyId: null,
    focusedFuvarId: null,
    renderToken: 0
  };

  window.addEventListener("assembly:focus", async (event) => {
    const assemblyId = event?.detail?.assemblyId;
    if (!assemblyId) {
      return;
    }

    let graphics = state.assemblyGraphics.get(assemblyId);
    if (!graphics) {
      return;
    }

    if (graphics.routeReadyPromise) {
      try {
        await graphics.routeReadyPromise;
      } catch (_) {
        // Fallback route marad; fókusz így is működik marker szinten.
      }
      graphics = state.assemblyGraphics.get(assemblyId);
      if (!graphics) {
        return;
      }
    }

    state.focusedAssemblyId = assemblyId;

    const targetBounds = graphics.routeBounds || graphics.markerBounds;
    if (targetBounds) {
      state.map.fitBounds(targetBounds, {
        padding: [28, 28],
        maxZoom: 11
      });
    }

    if (graphics.marker) {
      graphics.marker.openTooltip();
    }

    applyMapVisualFocus(state);
  });

  window.addEventListener("fuvar:focus", (event) => {
    state.focusedFuvarId = event?.detail?.fuvarId || null;

    // Fuvar fókuszban a route kiemelés legyen az elsődleges, ne az assembly kattintás.
    state.focusedAssemblyId = null;
    applyMapVisualFocus(state, {
      fitToFuvar: Boolean(state.focusedFuvarId)
    });
  });

  mapRegistry.set(containerId, state);
  return state;
}

function renderPois(state) {
  state.fuelLayer.clearLayers();
  state.parkingLayer.clearLayers();

  FUEL_POIS.forEach((poi) => {
    const marker = window.L.circleMarker(poi.coords, {
      radius: 6,
      color: "#ffd166",
      fillColor: "#f4a261",
      fillOpacity: 0.95,
      weight: 2
    });

    marker.bindTooltip(`⛽ ${escapeHtml(poi.name)}`, { direction: "top", sticky: true });
    marker.addTo(state.fuelLayer);
  });

  TRUCK_PARKING_POIS.forEach((poi) => {
    const marker = window.L.circleMarker(poi.coords, {
      radius: 6,
      color: "#8ecae6",
      fillColor: "#219ebc",
      fillOpacity: 0.95,
      weight: 2
    });

    marker.bindTooltip(`🅿️ ${escapeHtml(poi.name)}`, { direction: "top", sticky: true });
    marker.addTo(state.parkingLayer);
  });
}

function getRouteStyle(entry, state, isAssemblyFocused = false) {
  const hasFuvarFocus = Boolean(state.focusedFuvarId);
  const fuvarMatch = !hasFuvarFocus || entry.fuvarIds.has(state.focusedFuvarId);

  if (hasFuvarFocus && !fuvarMatch) {
    return {
      color: "#657383",
      weight: 2,
      opacity: 0.2,
      dashArray: "6 9"
    };
  }

  if (hasFuvarFocus && fuvarMatch) {
    return {
      color: "#12d6ff",
      weight: isAssemblyFocused ? 6 : 5,
      opacity: 1,
      dashArray: null
    };
  }

  return {
    color: entry.isComplete ? "#4cd964" : "#ffb703",
    weight: isAssemblyFocused ? 5 : 3,
    opacity: isAssemblyFocused ? 1 : 0.86,
    dashArray: entry.isComplete ? null : "8 6"
  };
}

function applyMapVisualFocus(state, options = {}) {
  const hasFuvarFocus = Boolean(state.focusedFuvarId);
  const fitToFuvar = Boolean(options.fitToFuvar && state.focusedFuvarId);
  const focusBounds = [];

  state.assemblyGraphics.forEach((entry, assemblyId) => {
    const assemblyFocused = state.focusedAssemblyId === assemblyId;
    const fuvarMatch = !hasFuvarFocus || entry.fuvarIds.has(state.focusedFuvarId);

    if (entry.routeLayer) {
      entry.routeLayer.setStyle(getRouteStyle(entry, state, assemblyFocused));
    }

    const markerEl = entry.marker?.getElement();
    if (markerEl) {
      markerEl.style.opacity = fuvarMatch ? "1" : "0.22";
      markerEl.style.filter = fuvarMatch ? "none" : "grayscale(1) saturate(0.2)";
      markerEl.style.transform = fuvarMatch ? "scale(1)" : "scale(0.92)";
    }

    if (fitToFuvar && fuvarMatch) {
      if (entry.routeBounds?.isValid()) {
        focusBounds.push(entry.routeBounds.getSouthWest());
        focusBounds.push(entry.routeBounds.getNorthEast());
      } else if (entry.markerBounds?.isValid()) {
        focusBounds.push(entry.markerBounds.getSouthWest());
        focusBounds.push(entry.markerBounds.getNorthEast());
      }
    }
  });

  const poiOpacity = hasFuvarFocus ? 0.22 : 0.95;
  const poiStrokeOpacity = hasFuvarFocus ? 0.28 : 1;

  state.fuelLayer.eachLayer((marker) => {
    if (marker.setStyle) {
      marker.setStyle({
        fillOpacity: poiOpacity,
        opacity: poiStrokeOpacity
      });
    }
  });

  state.parkingLayer.eachLayer((marker) => {
    if (marker.setStyle) {
      marker.setStyle({
        fillOpacity: poiOpacity,
        opacity: poiStrokeOpacity
      });
    }
  });

  if (fitToFuvar && focusBounds.length > 0) {
    state.map.fitBounds(focusBounds, {
      padding: [34, 34],
      maxZoom: 11
    });
  }
}

async function renderAssemblies(state, assemblies) {
  state.assemblyLayer.clearLayers();
  state.assemblyGraphics.clear();

  state.renderToken += 1;
  const renderToken = state.renderToken;

  const cityCounters = new Map();
  const bounds = [];
  const routeJobs = [];

  assemblies.forEach((assembly) => {
    const locationLabel = getAssemblyLocationLabel(assembly);
    const baseCoords = resolveCoordsFromLocation(locationLabel);
    const coordKey = baseCoords.join(",");
    const offsetIndex = cityCounters.get(coordKey) || 0;
    cityCounters.set(coordKey, offsetIndex + 1);

    const coords = withCollisionOffset(baseCoords, offsetIndex);
    bounds.push(coords);

    const isComplete = Boolean(
      assembly.sofor && assembly.vontato && assembly.potkocsi && assembly.fuvarBlocks.length > 0
    );
    const fuvarIds = new Set(
      assembly.fuvarBlocks
        .map((block) => block.fuvarId)
        .filter(Boolean)
    );

    const progressValue = getAssemblyProgress(assembly);
    const progressLabel = assembly.fuvarBlocks.length > 0
      ? `${Math.round(progressValue * 100)}%`
      : "telephely";

    const marker = window.L.marker(coords, {
      icon: createTruckIcon(isComplete),
      title: `Szerelveny ${assembly.id}`
    });

    marker.bindTooltip(createAssemblyTooltip(assembly, locationLabel, progressLabel), {
      direction: "top",
      sticky: true,
      opacity: 0.98,
      className: "assembly-tooltip"
    });

    marker.on("mouseover", () => marker.openTooltip());
    marker.on("mouseout", () => marker.closeTooltip());
    marker.addTo(state.assemblyLayer);

    const waypointCoords = getRouteCoordsForAssembly(assembly);

    let markerBounds = window.L.latLngBounds([coords, coords]);

    const entry = {
      marker,
      routeLayer: null,
      markerBounds,
      routeBounds: null,
      routeReadyPromise: null,
      isComplete,
      fuvarIds
    };

    state.assemblyGraphics.set(assembly.id, entry);

    const routeReadyPromise = (async () => {
      const routeCoords = await buildRoadRouteCoords(waypointCoords);

      if (state.renderToken !== renderToken) {
        return;
      }

      if (routeCoords.length < 2) {
        return;
      }

      const routeLayer = window.L.polyline(
        routeCoords,
        getRouteStyle(entry, state, state.focusedAssemblyId === assembly.id)
      ).addTo(state.assemblyLayer);

      const routeBounds = routeLayer.getBounds();
      if (routeBounds?.isValid()) {
        bounds.push(routeBounds.getSouthWest());
        bounds.push(routeBounds.getNorthEast());
      }

      const truckPoint = getPointAlongRoute(routeCoords, progressValue);
      if (truckPoint) {
        marker.setLatLng(truckPoint);
        markerBounds = window.L.latLngBounds([truckPoint, truckPoint]);
      }

      const updated = state.assemblyGraphics.get(assembly.id);
      if (updated) {
        updated.routeLayer = routeLayer;
        updated.routeBounds = routeBounds;
        updated.markerBounds = markerBounds;
      }
    })();

    entry.routeReadyPromise = routeReadyPromise;

    routeJobs.push(routeReadyPromise);
  });

  if (bounds.length > 0) {
    state.map.fitBounds(bounds, {
      padding: [26, 26],
      maxZoom: 10
    });
  } else {
    state.map.setView([47.1625, 19.5033], 7);
  }

  try {
    await Promise.all(routeJobs);
  } catch (_) {
    // A részleges route hiba nem állíthatja meg a térkép megjelenítést.
  }

  if (state.renderToken !== renderToken) {
    return;
  }

  const allBounds = [];
  state.assemblyGraphics.forEach((graphics) => {
    if (graphics.routeBounds?.isValid()) {
      allBounds.push(graphics.routeBounds.getSouthWest());
      allBounds.push(graphics.routeBounds.getNorthEast());
    }

    if (graphics.markerBounds?.isValid()) {
      allBounds.push(graphics.markerBounds.getSouthWest());
      allBounds.push(graphics.markerBounds.getNorthEast());
    }
  });

  if (allBounds.length > 0) {
    state.map.fitBounds(allBounds, {
      padding: [26, 26],
      maxZoom: 10
    });
  }

  applyMapVisualFocus(state, {
    fitToFuvar: Boolean(state.focusedFuvarId)
  });
}

export function renderSzerelvenyMap(containerId, soforok, vontatok, potkocsik) {
  const state = createLeafletState(containerId);
  if (!state) {
    return;
  }

  const assemblies = buildAssemblies(soforok, vontatok, potkocsik);
  renderAssemblies(state, assemblies);
  renderPois(state);
  applyMapVisualFocus(state, {
    fitToFuvar: false
  });

  // A map kontener ujratriggerelese fontos dinamikus panelben.
  setTimeout(() => {
    state.map.invalidateSize();
  }, 0);
}
