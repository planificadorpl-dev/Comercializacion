import https from "https";

export interface OzBox {
  id: string;
  name: string;
  lat: number;
  lng: number;
  boxType: string;
  boxTypeName: string;
  isNap: boolean;
  totalPorts: number;
  availablePorts: number;
  usedPorts: number;
  status: "disponible" | "ocupada" | "critica" | "manga";
  potencia?: string | null;
  pon?: string | null;
  sector?: string | null;
  observation?: string | null;
  project?: string;
  cablesCount?: number;
  implanted: boolean;
}

const OZMAP_DEFAULT_URL = "https://powerlink.ozmap.com.br:9994";
const OZMAP_DEFAULT_COOKIE =
  "REMOVED_SECRET=JTIyJTdCJTVDJTIyd2ViX2V4cF9pZF92MiU1QyUyMiUzQSU1QyUyMmEwYmJiZjgyLTQzOWQtNGY0MS1hMjgyLTI4Nzg0ZmM4YzhkYSU1QyUyMiUyQyU1QyUyMmZpcnN0X3NlZW4lNUMlMjIlM0ExNzg2NzE1MDk3LjcwOSU1QyUyMiU3RCUyMg==; _s_id=s%3AREMOVED_SECRET.zZIoxIoKqG%2F7h7fMa5JxGqWgFRSNYRhF6b%2FjZGioGqw; mongoMachineId=1398319; locale=es; totango.heartbeat.last_module=OZmap; AMP_ffc1c66c15=JTdCJTIyZGV2aZW50SWQlMjIlM0ElMjI2MTVkM2QxMS1jNmRiLTQ2YTgtYmU1OS1kOTE4MTIwNzg3M2ElMjIlMkMlMjJ1c2VySWQlMjIlM0ElMjIwMjQ4NjYxNy02OGI4LTQ3MTYtOWIwOS03ZDhjZWFmMjE4OTUtNjllNjc3YjA0ZjQzY2ExOTgxNDA2YTEzJTIyJTJDJTIyc2Vzc2lvbklkJTIyJTNBMTc5Mzk3MzcxNDI2OCUyQyUyMm9wdE91dCUyMiUzQWZhbHNlJTJDJTIybGFzdEV2ZW50VGltZSUyMiUzQTE3OTM5NzM3MTU1OTYlMkMlMjJsYXN0RXZlbnRJZCUyMiUzQTUzMiUyQyUyMnBhZ2VDb3VudGVyJTIyJTNBMCUyQyUyMmNvb2tpZURvbWFpbiUyMiUzQSUyMi5vem1hcC5jb20uYnIlMjIlN0Q=; totango.heartbeat.last_ts=1793975367992";

const BOX_TYPES_MAP: Record<string, { name: string; isNap: boolean; defaultPorts: number }> = {
  "589ddcf07dfe452f10d7c274": { name: "Manga de Empalme", isNap: false, defaultPorts: 0 },
  "589ddcf07dfe452f10d7c275": { name: "Caja Nap 1x8", isNap: true, defaultPorts: 8 },
  "68421ee4c42836e0b7a30534": { name: "Caja Nap 1x16", isNap: true, defaultPorts: 16 },
  "68421f21c42836e0b7a305d1": { name: "Manga 48", isNap: false, defaultPorts: 0 },
  "68421f41c42836e0b7a30637": { name: "Manga 96", isNap: false, defaultPorts: 0 },
  "68421f94c42836e0b7a30736": { name: "Caja 1x16 (PON)", isNap: true, defaultPorts: 16 },
  "6842201254ed09a92778dfe3": { name: "Manga 144", isNap: false, defaultPorts: 0 },
  "68587e506b5e77294360fbd7": { name: "FDT", isNap: true, defaultPorts: 16 },
  "687270d1ee4a0f2d9d203310": { name: "Caja 1x16 (Splitter 1x4)", isNap: true, defaultPorts: 16 },
  "68727118ee4a0f2d9d2033cd": { name: "Caja 1x8 (Splitter 1x4)", isNap: true, defaultPorts: 8 },
};

// In-memory cache for fast subsequent requests (TTL: 15 minutes)
let cachedBoxes: { data: OzBox[]; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

function fetchOzmap(path: string): Promise<any> {
  const baseUrl = process.env.OZMAP_URL || OZMAP_DEFAULT_URL;
  const cookie = process.env.OZMAP_COOKIE || OZMAP_DEFAULT_COOKIE;
  const url = new URL(path, baseUrl);

  const agent = new https.Agent({ rejectUnauthorized: false });

  return new Promise((resolve, reject) => {
    const req = https.get(
      url.toString(),
      {
        agent,
        headers: {
          Cookie: cookie,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: `${baseUrl}/`,
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ error: "No JSON returned", raw: body.slice(0, 300) });
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Timeout conectando con el servidor de OZmap"));
    });
  });
}

function parseObservation(obs: string | undefined | null) {
  if (!obs) return { puertos: null, potencia: null, pon: null, sector: null };

  const clean = String(obs);
  const portsMatch = clean.match(/(\d+)\s*puertos/i);
  const potenciaMatch = clean.match(/Potencia\s*[:\s]*([^\n\r]+)/i);
  const ponMatch = clean.match(/(?:Nombre del PON|Pon)\s*[:\s]*([^\n\r]+)/i);
  const sectorMatch = clean.match(/(?:Sector|Zona)\s*[:\s]*\n*([^\n\r]+)/i);

  return {
    puertos: portsMatch ? parseInt(portsMatch[1], 10) : null,
    potencia: potenciaMatch ? potenciaMatch[1].trim() : null,
    pon: ponMatch ? ponMatch[1].trim() : null,
    sector: sectorMatch ? sectorMatch[1].trim() : null,
  };
}

export async function getFactibilidadBoxes(forceRefresh = false): Promise<OzBox[]> {
  const now = Date.now();
  if (!forceRefresh && cachedBoxes && now - cachedBoxes.timestamp < CACHE_TTL) {
    return cachedBoxes.data;
  }

  const raw = await fetchOzmap("/api/v2/boxes?limit=10000");

  if (!raw || !Array.isArray(raw.rows)) {
    throw new Error(raw?.error || raw?.message || "No se recibieron cajas válidas de OZmap");
  }

  const boxes: OzBox[] = raw.rows
    .filter((b: any) => {
      if (!b.coords || !Array.isArray(b.coords) || b.coords.length < 2) return false;
      const lng = b.coords[0];
      const lat = b.coords[1];
      return (
        typeof lat === "number" &&
        typeof lng === "number" &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat > 0 &&
        lng < 0
      );
    })
    .map((b: any) => {
      const typeInfo = BOX_TYPES_MAP[b.boxType] || {
        name: b.name.toLowerCase().includes("manga") ? "Manga de Empalme" : "Caja Nap",
        isNap: b.hierarchyLevel === 3 || !b.name.toLowerCase().includes("manga"),
        defaultPorts: b.hierarchyLevel === 3 ? 16 : 0,
      };

      const parsedObs = parseObservation(b.observation);
      const totalPorts = parsedObs.puertos || typeInfo.defaultPorts;

      // Drop cables connected to the box represent occupied ports
      const cablesCount = Array.isArray(b.cables) ? b.cables.length : 0;
      let usedPorts = 0;
      if (typeInfo.isNap && totalPorts > 0) {
        usedPorts = Math.min(cablesCount, totalPorts);
      }
      const availablePorts = Math.max(0, totalPorts - usedPorts);

      let status: "disponible" | "ocupada" | "critica" | "manga" = "manga";
      if (typeInfo.isNap) {
        if (availablePorts === 0 && totalPorts > 0) {
          status = "ocupada";
        } else if (availablePorts <= 2 && totalPorts > 0) {
          status = "critica";
        } else {
          status = "disponible";
        }
      }

      return {
        id: b.id,
        name: b.name || "Caja sin nombre",
        lat: b.coords[1],
        lng: b.coords[0],
        boxType: b.boxType,
        boxTypeName: typeInfo.name,
        isNap: typeInfo.isNap,
        totalPorts,
        availablePorts,
        usedPorts,
        status,
        potencia: parsedObs.potencia,
        pon: parsedObs.pon,
        sector: parsedObs.sector,
        observation: b.observation,
        project: b.project,
        cablesCount,
        implanted: Boolean(b.implanted),
      };
    });

  cachedBoxes = {
    data: boxes,
    timestamp: now,
  };

  return boxes;
}

function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function getFactibilidadBoxesInRadius(
  lat: number,
  lng: number,
  radiusMeters = 1000,
  forceRefresh = false
): Promise<{ boxes: OzBox[]; totalInRadius: number; availableInRadius: number }> {
  const allBoxes = await getFactibilidadBoxes(forceRefresh);

  // Filter only NAPs (hide trunk mangas from advisors) within requested radius
  const nearby = allBoxes
    .filter((b) => b.isNap)
    .map((b) => ({
      box: b,
      dist: calcDistanceMeters(lat, lng, b.lat, b.lng),
    }))
    .filter((item) => item.dist <= radiusMeters)
    .sort((a, b) => a.dist - b.dist)
    .map((item) => item.box);

  const availableInRadius = nearby.filter((b) => b.availablePorts > 0).length;

  return {
    boxes: nearby,
    totalInRadius: nearby.length,
    availableInRadius,
  };
}


