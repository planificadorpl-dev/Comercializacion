import type { OzBox } from "./ozmap-service";

export interface FeasibilityResult {
  clientCoords: [number, number];
  isFeasible: boolean;
  feasibilityLevel: "optima" | "factible_larga" | "limite" | "no_factible" | "saturada";
  distanceMeters: number;
  nearestNap: OzBox | null;
  nearestAvailableNap: OzBox | null;
  distanceToAvailableMeters: number | null;
  nearbyNaps: { box: OzBox; distance: number }[];
  diagnosisTitle: string;
  diagnosisMessage: string;
}

export function parseCoordinatesInput(input: string): [number, number] | null {
  if (!input || typeof input !== "string") return null;
  const clean = input.trim();

  // 1. Google Maps URL or query string (?q=lat,lng or @lat,lng or /place/lat,lng)
  const urlMatch = clean.match(/(?:q=|@|place\/)(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (isValidLatLng(lat, lng)) return [lat, lng];
  }

  // 2. Standard decimal degrees (e.g. "10.46742, -66.90589" or "10.46742 -66.90589")
  const decimalMatch = clean.match(/(-?\d+\.\d+)[\s,;]+(-?\d+\.\d+)/);
  if (decimalMatch) {
    let lat = parseFloat(decimalMatch[1]);
    let lng = parseFloat(decimalMatch[2]);

    // Invert if user pasted lng first (-66.9, 10.4)
    if (lat < 0 && lng > 0) {
      const temp = lat;
      lat = lng;
      lng = temp;
    }

    if (isValidLatLng(lat, lng)) return [lat, lng];
  }

  // 3. DMS (Degrees Minutes Seconds) (e.g. 10°28'02.7"N 66°54'21.2"W)
  const dmsMatch = clean.match(
    /(\d+)°(\d+)'([\d.]+)"?([NSns])[\s,]+(\d+)°(\d+)'([\d.]+)"?([EWewOo])/
  );
  if (dmsMatch) {
    let lat =
      parseInt(dmsMatch[1], 10) +
      parseInt(dmsMatch[2], 10) / 60 +
      parseFloat(dmsMatch[3]) / 3600;
    if (dmsMatch[4].toUpperCase() === "S") lat = -lat;

    let lng =
      parseInt(dmsMatch[5], 10) +
      parseInt(dmsMatch[6], 10) / 60 +
      parseFloat(dmsMatch[7]) / 3600;
    if (dmsMatch[8].toUpperCase() === "W" || dmsMatch[8].toUpperCase() === "O") lng = -lng;

    if (isValidLatLng(lat, lng)) return [lat, lng];
  }

  return null;
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function analyzeFeasibility(
  clientCoords: [number, number],
  boxes: OzBox[]
): FeasibilityResult {
  const [cLat, cLng] = clientCoords;

  // Filter only NAP boxes (distribution boxes)
  const napBoxes = boxes.filter((b) => b.isNap);

  // Compute distance to each NAP
  const sortedNaps = napBoxes
    .map((box) => ({
      box,
      distance: calculateDistanceMeters(cLat, cLng, box.lat, box.lng),
    }))
    .sort((a, b) => a.distance - b.distance);

  const nearestOverall = sortedNaps[0]?.box || null;
  const distanceToNearest = sortedNaps[0]?.distance ?? 999999;

  // Nearest NAP that actually has free ports
  const sortedAvailable = sortedNaps.filter((item) => item.box.availablePorts > 0);
  const nearestAvailable = sortedAvailable[0]?.box || null;
  const distanceToAvailable = sortedAvailable[0]?.distance ?? null;

  // Top 3 nearby NAPs within 600m
  const nearbyNaps = sortedNaps.slice(0, 4);

  let feasibilityLevel: "optima" | "factible_larga" | "limite" | "no_factible" | "saturada";
  let isFeasible = false;
  let diagnosisTitle = "";
  let diagnosisMessage = "";

  if (!nearestAvailable) {
    if (distanceToNearest <= 250) {
      feasibilityLevel = "saturada";
      diagnosisTitle = "Cajas cercanas sin puertos libres";
      diagnosisMessage = `Existe la caja ${nearestOverall?.name} a ${distanceToNearest}m pero se encuentra 100% ocupada (0 puertos disponibles).`;
    } else {
      feasibilityLevel = "no_factible";
      diagnosisTitle = "Sin cobertura de red";
      diagnosisMessage = `No hay cajas NAP con puertos disponibles en el radio de servicio.`;
    }
  } else if (distanceToAvailable <= 150) {
    feasibilityLevel = "optima";
    isFeasible = true;
    diagnosisTitle = "Factibilidad aprobada (Óptima)";
    diagnosisMessage = `Caja ${nearestAvailable.name} a solo ${distanceToAvailable}m con ${nearestAvailable.availablePorts} puertos libres. Acometida estándar directa.`;
  } else if (distanceToAvailable <= 250) {
    feasibilityLevel = "factible_larga";
    isFeasible = true;
    diagnosisTitle = "Factible con acometida extendida";
    diagnosisMessage = `Caja ${nearestAvailable.name} a ${distanceToAvailable}m con ${nearestAvailable.availablePorts} puertos libres. Requiere bobina de drop adicional.`;
  } else if (distanceToAvailable <= 350) {
    feasibilityLevel = "limite";
    isFeasible = false;
    diagnosisTitle = "En límite técnico de acometida";
    diagnosisMessage = `Caja ${nearestAvailable.name} a ${distanceToAvailable}m. Supera los 250m recomendados; requiere inspección técnica de campo previa.`;
  } else {
    // If nearest is close but saturated, and available is far
    if (distanceToNearest <= 150 && nearestOverall && nearestOverall.availablePorts === 0) {
      feasibilityLevel = "saturada";
      diagnosisTitle = "Caja inmediata saturada";
      diagnosisMessage = `La caja más cercana (${nearestOverall.name} a ${distanceToNearest}m) no tiene puertos. La siguiente con puertos está a ${distanceToAvailable}m (fuera de rango).`;
    } else {
      feasibilityLevel = "no_factible";
      diagnosisTitle = "Sin cobertura de acometida";
      diagnosisMessage = `La caja con puertos libres más cercana está a ${distanceToAvailable}m (límite máximo permitido es 250m).`;
    }
  }

  return {
    clientCoords,
    isFeasible,
    feasibilityLevel,
    distanceMeters: distanceToNearest,
    nearestNap: nearestOverall,
    nearestAvailableNap: nearestAvailable,
    distanceToAvailableMeters: distanceToAvailable,
    nearbyNaps,
    diagnosisTitle,
    diagnosisMessage,
  };
}

export function generateWhatsAppResponse(result: FeasibilityResult): string {
  const { clientCoords, isFeasible, feasibilityLevel, nearestAvailableNap, distanceToAvailableMeters, nearestNap, distanceMeters } = result;
  const coordsStr = `${clientCoords[0].toFixed(5)}, ${clientCoords[1].toFixed(5)}`;

  if (isFeasible && nearestAvailableNap && distanceToAvailableMeters !== null) {
    return (
      `*POWER LINK - CONSULTA DE FACTIBILIDAD TÉCNICA*\n\n` +
      `¡Hola! Hemos validado tus coordenadas (${coordsStr}):\n\n` +
      `✅ *ESTATUS: FACTIBILIDAD APROBADA*\n` +
      `• *Zona/Sector:* ${nearestAvailableNap.sector || "Área de cobertura activa"}\n` +
      `• *Caja de fibra asignada:* ${nearestAvailableNap.name}\n` +
      `• *Distancia de acometida:* ${distanceToAvailableMeters} metros (${distanceToAvailableMeters <= 150 ? "Óptima" : "Acometida estándar"})\n` +
      `• *Puertos disponibles:* Sí (${nearestAvailableNap.availablePorts} libres)\n\n` +
      `¡Tu dirección es 100% apta para instalar Internet de Fibra Óptica! ¿Con qué plan de velocidad te gustaría comenzar?`
    );
  }

  if (feasibilityLevel === "saturada" && nearestNap) {
    return (
      `*POWER LINK - CONSULTA DE FACTIBILIDAD TÉCNICA*\n\n` +
      `¡Hola! Hemos validado tus coordenadas (${coordsStr}):\n\n` +
      `⚠️ *ESTATUS: EN LISTA DE ESPERA / ZONA EN EXPANSIÓN*\n` +
      `• *Zona/Sector:* ${nearestNap.sector || "Área con red"}\n` +
      `• *Caja más cercana:* ${nearestNap.name} (${distanceMeters} metros)\n` +
      `• *Disponibilidad actual:* Capacidad al 100% (caja ocupada).\n\n` +
      `Nuestra red pasa cerca de tu ubicación pero en este momento no hay puertos libres. Hemos registrado tus datos para contactarte de inmediato en cuanto se habilite una nueva derivación.`
    );
  }

  return (
    `*POWER LINK - CONSULTA DE FACTIBILIDAD TÉCNICA*\n\n` +
    `¡Hola! Hemos validado tus coordenadas (${coordsStr}):\n\n` +
    `❌ *ESTATUS: FUERA DE RANGO DIRECTO*\n` +
    `• En este momento la red de fibra óptica más cercana se encuentra a más de 300 metros de tu punto, lo cual supera el estándar técnico de cable drop para garantizar la máxima velocidad.\n\n` +
    `Hemos guardado tu ubicación para considerarla en las próximas ampliaciones de cobertura.`
  );
}

