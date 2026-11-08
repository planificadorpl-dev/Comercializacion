import { NextRequest, NextResponse } from "next/server";
import type { OzBox } from "@/lib/ozmap-service";
import { calculateDistanceMeters, isValidLatLng } from "@/lib/factibilidad-utils";

interface CandidateEvaluation {
  box: OzBox;
  streetDistance: number;
  straightDistance: number;
  effectiveDistance: number;
  isStreetRoute: boolean;
  coordinates: [number, number][];
  detourFactor: number;
  hasObstacleDetour: boolean;
  isTopologyArtifact: boolean;
}

// In-memory cache to prevent redundant external routing calls
const routeCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

function getCacheKey(lat: number, lng: number, candidates: OzBox[]): string {
  const cKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const candIds = candidates.map((c) => c.id).sort().join(",");
  return `${cKey}|${candIds}`;
}

async function fetchStreetRoute(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<{ distance: number; coordinates: [number, number][]; isStreetRoute: boolean }> {
  const straightDist = calculateDistanceMeters(lat1, lng1, lat2, lng2);

  // Profile 1: Foot (pedestrian routes, passages, veredas, alleys - exact match for utility pole drops)
  try {
    const footUrl = `https://router.project-osrm.org/route/v1/foot/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(footUrl, {
      signal: AbortSignal.timeout(2800),
      headers: { "User-Agent": "PowerLinkFactibilidad/1.0" },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === "Ok" && json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const firstCoord = rawCoords[0];
        const lastCoord = rawCoords[rawCoords.length - 1];
        const snap1 = firstCoord ? calculateDistanceMeters(lat1, lng1, firstCoord[0], firstCoord[1]) : 0;
        const snap2 = lastCoord ? calculateDistanceMeters(lat2, lng2, lastCoord[0], lastCoord[1]) : 0;

        // If snap jump > 45m: The point is located on an unmapped barrio staircase, passage or patio.
        // Connecting to a distant snapped road creates an absurd spike across neighborhoods.
        if (snap1 > 45 || snap2 > 45) {
          return {
            distance: Math.max(straightDist, Math.round(straightDist * 1.15)),
            coordinates: [
              [lat1, lng1],
              [lat2, lng2],
            ],
            isStreetRoute: false,
          };
        }

        const totalDist = Math.round(route.distance + snap1 + snap2);

        // If distance collapsed to 0m or less than straight line
        if (totalDist <= 0 || totalDist < straightDist * 0.85) {
          return {
            distance: Math.max(straightDist, Math.round(straightDist * 1.15)),
            coordinates: [
              [lat1, lng1],
              [lat2, lng2],
            ],
            isStreetRoute: false,
          };
        }

        return {
          distance: totalDist,
          coordinates: [[lat1, lng1], ...rawCoords, [lat2, lng2]],
          isStreetRoute: true,
        };
      }
    }
  } catch {
    // Continue to driving fallback
  }

  // Profile 2: Driving (vehicular roads fallback)
  try {
    const driveUrl = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(driveUrl, {
      signal: AbortSignal.timeout(2200),
      headers: { "User-Agent": "PowerLinkFactibilidad/1.0" },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === "Ok" && json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const firstCoord = rawCoords[0];
        const lastCoord = rawCoords[rawCoords.length - 1];
        const snap1 = firstCoord ? calculateDistanceMeters(lat1, lng1, firstCoord[0], firstCoord[1]) : 0;
        const snap2 = lastCoord ? calculateDistanceMeters(lat2, lng2, lastCoord[0], lastCoord[1]) : 0;

        // If snap jump > 45m: The point is located on an unmapped barrio staircase, passage or patio.
        // Connecting to a distant snapped road creates an absurd spike across neighborhoods.
        if (snap1 > 45 || snap2 > 45) {
          return {
            distance: Math.max(straightDist, Math.round(straightDist * 1.15)),
            coordinates: [
              [lat1, lng1],
              [lat2, lng2],
            ],
            isStreetRoute: false,
          };
        }

        const totalDist = Math.round(route.distance + snap1 + snap2);

        // If distance collapsed to 0m or less than straight line
        if (totalDist <= 0 || totalDist < straightDist * 0.85) {
          return {
            distance: Math.max(straightDist, Math.round(straightDist * 1.15)),
            coordinates: [
              [lat1, lng1],
              [lat2, lng2],
            ],
            isStreetRoute: false,
          };
        }

        return {
          distance: totalDist,
          coordinates: [[lat1, lng1], ...rawCoords, [lat2, lng2]],
          isStreetRoute: true,
        };
      }
    }
  } catch {
    // Continue to straight fallback
  }

  // Fallback: Straight-line Euclidean distance
  return {
    distance: straightDist,
    coordinates: [
      [lat1, lng1],
      [lat2, lng2],
    ],
    isStreetRoute: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientCoords, candidates } = body;

    if (!Array.isArray(clientCoords) || clientCoords.length !== 2) {
      return NextResponse.json({ success: false, error: "Coordenadas del cliente inválidas" }, { status: 400 });
    }

    const [cLat, cLng] = clientCoords;
    if (!isValidLatLng(cLat, cLng)) {
      return NextResponse.json({ success: false, error: "Valores de latitud/longitud fuera de rango" }, { status: 400 });
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ success: false, error: "Se requiere lista de candidatos para enrutamiento" }, { status: 400 });
    }

    // Check memory cache
    const cacheKey = getCacheKey(cLat, cLng, candidates);
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Limit evaluation to at most 6 candidates to guarantee ultra-fast response
    const targetCandidates: OzBox[] = candidates.slice(0, 6);

    // Run parallel route queries
    const routeResults = await Promise.allSettled(
      targetCandidates.map((box) => fetchStreetRoute(cLat, cLng, box.lat, box.lng))
    );

    const evaluated: CandidateEvaluation[] = targetCandidates.map((box, idx) => {
      const straightDist = calculateDistanceMeters(cLat, cLng, box.lat, box.lng);
      const res = routeResults[idx];
      let streetDist = straightDist;
      let isStreet = false;
      let coords: [number, number][] = [
        [cLat, cLng],
        [box.lat, box.lng],
      ];

      if (res.status === "fulfilled") {
        streetDist = res.value.distance;
        isStreet = res.value.isStreetRoute;
        coords = res.value.coordinates;
      }

      let effectiveDist = streetDist;
      let isTopologyArtifact = false;

      // Realistic aerial telecom drop physics & OSM topology artifact filter:
      // In telecom, utility poles are 30-45m apart. Any box within <= 80m straight line is on
      // the same block, corner or across the immediate street.
      // If OSRM returns a massive detour (> 2.0x and > 75m extra), it is an OSM routing artifact
      // (such as one-way restriction, missing pedestrian link between road ways, or highway roundabout loop).
      // Aerial fiber drop cables do NOT drive around roundabouts; they span directly between poles.
      if (isStreet) {
        const rawDetour = straightDist > 0 ? streetDist / straightDist : 1;
        const diff = streetDist - straightDist;

        if (
          (straightDist <= 80 && (rawDetour > 2.0 && diff > 60)) ||
          (straightDist <= 130 && (rawDetour > 2.5 || streetDist > 300))
        ) {
          // Correct to realistic pole-to-pole drop with sag factor (+20%)
          effectiveDist = Math.max(straightDist, Math.round(straightDist * 1.2));
          isStreet = false;
          coords = [
            [cLat, cLng],
            [box.lat, box.lng],
          ];
          isTopologyArtifact = true;
        }
      }

      const detourFactor = straightDist > 0 ? Number((effectiveDist / straightDist).toFixed(2)) : 1;
      const hasObstacleDetour = isStreet && detourFactor >= 1.35 && effectiveDist - straightDist >= 40;

      return {
        box,
        streetDistance: effectiveDist,
        straightDistance: straightDist,
        effectiveDistance: effectiveDist,
        isStreetRoute: isStreet,
        coordinates: coords,
        detourFactor,
        hasObstacleDetour,
        isTopologyArtifact,
      };
    });

    // Separate available boxes (ports > 0) from saturated
    const available = evaluated.filter((item) => item.box.availablePorts > 0);
    // Sort by effective drop distance (street route when physical, pole span when ultra-close)
    available.sort((a, b) => a.effectiveDistance - b.effectiveDistance);

    const sortedAll = [...evaluated].sort((a, b) => a.effectiveDistance - b.effectiveDistance);
    const nearestOverall = sortedAll[0] || null;
    const bestAvailable = available[0] || null;

    const chosen = bestAvailable || nearestOverall;
    if (!chosen) {
      return NextResponse.json({ success: false, error: "No se encontraron rutas factibles" }, { status: 404 });
    }

    const dist = chosen.effectiveDistance;
    const straightDist = chosen.straightDistance;
    const isAvailable = chosen.box.availablePorts > 0;

    let feasibilityLevel: "optima" | "factible_larga" | "limite" | "no_factible" | "saturada" = "no_factible";
    let isFeasible = false;
    let diagnosisTitle = "";
    let diagnosisMessage = "";

    if (!bestAvailable) {
      if (dist <= 250) {
        feasibilityLevel = "saturada";
        diagnosisTitle = "Cajas cercanas saturadas";
        diagnosisMessage = `La caja ${nearestOverall?.box.name.toUpperCase()} está a ${dist}m vía calle pero no tiene puertos libres (0 disponibles).`;
      } else {
        feasibilityLevel = "no_factible";
        diagnosisTitle = "Sin cobertura de red";
        diagnosisMessage = `No existen cajas NAP con puertos libres en la zona.`;
      }
    } else if (dist <= 150) {
      feasibilityLevel = "optima";
      isFeasible = true;
      diagnosisTitle = "Factibilidad aprobada (Óptima)";
      diagnosisMessage = `Caja ${bestAvailable.box.name.toUpperCase()} a ${dist}m por tendido vial con ${bestAvailable.box.availablePorts} puertos libres.`;
    } else if (dist <= 250) {
      feasibilityLevel = "factible_larga";
      isFeasible = true;
      diagnosisTitle = "Factible con acometida extendida";
      diagnosisMessage = `Caja ${bestAvailable.box.name.toUpperCase()} a ${dist}m por tendido vial con ${bestAvailable.box.availablePorts} puertos libres. Requiere bobina extendida.`;
    } else if (dist <= 350) {
      feasibilityLevel = "limite";
      isFeasible = false;
      diagnosisTitle = "Límite técnico de tendido";
      diagnosisMessage = `Caja ${bestAvailable.box.name.toUpperCase()} a ${dist}m por calle. Supera los 250m recomendados; requiere inspección técnica de campo previa.`;
    } else {
      feasibilityLevel = "no_factible";
      diagnosisTitle = "Sin cobertura de acometida";
      diagnosisMessage = `La caja con puertos libres más cercana se ubica a ${dist}m por trazado vial (límite máximo permitido es 250m-350m).`;
    }

    // Append obstacle/detour note if detected
    if (chosen.hasObstacleDetour) {
      const extraMeters = dist - straightDist;
      diagnosisMessage += ` Ruta vial con desvío por edificación/manzana (+${extraMeters}m respecto a la línea recta).`;
    }

    const payload = {
      success: true,
      bestNap: chosen.box,
      route: {
        distanceMeters: chosen.streetDistance,
        straightDistanceMeters: chosen.straightDistance,
        isStreetRoute: chosen.isStreetRoute,
        coordinates: chosen.coordinates,
        detourFactor: chosen.detourFactor,
        hasObstacleDetour: chosen.hasObstacleDetour,
      },
      feasibility: {
        isFeasible,
        feasibilityLevel,
        diagnosisTitle,
        diagnosisMessage,
      },
      candidates: evaluated.map((item) => ({
        box: item.box,
        streetDistance: item.streetDistance,
        straightDistance: item.straightDistance,
        isStreetRoute: item.isStreetRoute,
        detourFactor: item.detourFactor,
        hasObstacleDetour: item.hasObstacleDetour,
        coordinates: item.coordinates,
      })),
    };

    // Cache clean response
    routeCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    // Clean cache size if grows over 200
    if (routeCache.size > 200) {
      const oldestKey = routeCache.keys().next().value;
      if (oldestKey) routeCache.delete(oldestKey);
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Error en endpoint de enrutamiento inteligente de factibilidad:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Error al calcular ruta vial" },
      { status: 500 }
    );
  }
}

