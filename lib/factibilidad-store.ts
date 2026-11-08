import fs from "fs/promises";
import path from "path";
import https from "https";
import { query, isDatabaseConfigured } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export interface FactibilidadBox {
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
  project?: string | null;
  cablesCount?: number;
  implanted: boolean;
  updatedAt?: string | null;
}

const OZMAP_DEFAULT_URL = "https://powerlink.ozmap.com.br:9994";

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

const CACHE_FILE_PATH = path.join(process.cwd(), "data", "factibilidad-cache.json");

// In-process memory cache for instantaneous subsequent calls (0ms)
let memoryCache: {
  boxes: FactibilidadBox[];
  timestamp: number;
  syncedAt?: string;
  source: string;
} | null = null;
const MEMORY_TTL = 30 * 60 * 1000; // 30 minutes in memory

let isSyncing = false;
let tableEnsured = false;

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

function fetchOzmapRaw(path: string): Promise<any> {
  const baseUrl = process.env.OZMAP_URL || OZMAP_DEFAULT_URL;
  const cookie = process.env.OZMAP_COOKIE;

  if (!cookie) {
    return Promise.reject(
      new Error("OZMAP_COOKIE no está configurada en las variables de entorno.")
    );
  }

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
    req.setTimeout(35000, () => {
      req.destroy();
      reject(new Error("Timeout conectando con el servidor de OZmap"));
    });
  });
}

/**
 * Ensure the table exists in PostgreSQL / Supabase
 */
async function ensureFactibilidadTable(): Promise<void> {
  if (tableEnsured || !isDatabaseConfigured()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.factibilidad_cajas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        box_type TEXT,
        box_type_name TEXT,
        is_nap BOOLEAN NOT NULL DEFAULT true,
        total_ports INT NOT NULL DEFAULT 0,
        available_ports INT NOT NULL DEFAULT 0,
        used_ports INT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'disponible',
        potencia TEXT,
        pon TEXT,
        sector TEXT,
        observation TEXT,
        project TEXT,
        cables_count INT DEFAULT 0,
        implanted BOOLEAN DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_status ON public.factibilidad_cajas(status);
      CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_is_nap ON public.factibilidad_cajas(is_nap);
      CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_coords ON public.factibilidad_cajas(lat, lng);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn("Aviso: No se pudo auto-crear tabla factibilidad_cajas en Postgres:", err);
  }
}

/**
 * Read boxes from local JSON cache (takes ~15ms)
 */
async function readBoxesFromDisk(): Promise<{ boxes: FactibilidadBox[]; syncedAt?: string } | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.boxes) && parsed.boxes.length > 0) {
      return {
        boxes: parsed.boxes,
        syncedAt: parsed.syncedAt,
      };
    }
  } catch {
    // Disk cache not yet present
  }
  return null;
}

/**
 * Write boxes to local JSON cache
 */
async function writeBoxesToDisk(boxes: FactibilidadBox[]): Promise<void> {
  if (process.env.VERCEL) return; // Vercel has read-only filesystem at runtime
  try {
    await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
    await fs.writeFile(
      CACHE_FILE_PATH,
      JSON.stringify(
        {
          syncedAt: new Date().toISOString(),
          total: boxes.length,
          boxes,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (err) {
    console.warn("No se pudo escribir el archivo de caché en disco:", err);
  }
}

/**
 * Read boxes from PostgreSQL (takes ~30-50ms)
 */
async function readBoxesFromPostgres(): Promise<{ boxes: FactibilidadBox[]; syncedAt?: string } | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    await ensureFactibilidadTable();
    const rows = await query<any>(`
      SELECT 
        id, 
        name, 
        lat, 
        lng, 
        box_type as "boxType", 
        box_type_name as "boxTypeName", 
        is_nap as "isNap", 
        total_ports as "totalPorts", 
        available_ports as "availablePorts", 
        used_ports as "usedPorts", 
        status, 
        potencia, 
        pon, 
        sector, 
        observation, 
        project, 
        cables_count as "cablesCount", 
        implanted,
        updated_at as "updatedAt",
        synced_at as "syncedAt"
      FROM public.factibilidad_cajas
      ORDER BY name ASC
    `);

    if (Array.isArray(rows) && rows.length > 0) {
      const upperRows = rows.map((r: any) => ({
        ...r,
        name: (r.name || "").toUpperCase(),
      }));
      return {
        boxes: upperRows,
        syncedAt: rows[0]?.syncedAt || undefined,
      };
    }
  } catch (err) {
    console.warn("PostgreSQL read factibilidad_cajas error:", err);
  }
  return null;
}

/**
 * Read boxes from Supabase Client fallback
 */
async function readBoxesFromSupabase(): Promise<{ boxes: FactibilidadBox[]; syncedAt?: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("factibilidad_cajas")
      .select("*")
      .order("name", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: FactibilidadBox[] = data.map((b: any) => ({
        id: b.id,
        name: (b.name || "").toUpperCase(),
        lat: b.lat,
        lng: b.lng,
        boxType: b.box_type,
        boxTypeName: b.box_type_name,
        isNap: b.is_nap,
        totalPorts: b.total_ports,
        availablePorts: b.available_ports,
        usedPorts: b.used_ports,
        status: b.status,
        potencia: b.potencia,
        pon: b.pon,
        sector: b.sector,
        observation: b.observation,
        project: b.project,
        cablesCount: b.cables_count,
        implanted: b.implanted,
        updatedAt: b.updated_at,
      }));
      return {
        boxes: mapped,
        syncedAt: data[0]?.synced_at || undefined,
      };
    }
  } catch {
    // Supabase fallback not available
  }
  return null;
}

/**
 * Save boxes into PostgreSQL in batches of 250 rows
 */
async function saveBoxesToPostgres(boxes: FactibilidadBox[]): Promise<number> {
  if (!isDatabaseConfigured() || boxes.length === 0) return 0;
  await ensureFactibilidadTable();

  const BATCH_SIZE = 250;
  let totalSaved = 0;

  for (let i = 0; i < boxes.length; i += BATCH_SIZE) {
    const chunk = boxes.slice(i, i + BATCH_SIZE);
    const valuePlaceholders: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    for (const b of chunk) {
      valuePlaceholders.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, NOW())`
      );
      values.push(
        b.id,
        b.name,
        b.lat,
        b.lng,
        b.boxType,
        b.boxTypeName,
        b.isNap,
        b.totalPorts,
        b.availablePorts,
        b.usedPorts,
        b.status,
        b.potencia || null,
        b.pon || null,
        b.sector || null,
        b.observation || null,
        b.project || null,
        b.cablesCount || 0,
        b.implanted,
        b.updatedAt ? new Date(b.updatedAt) : new Date()
      );
    }

    const sql = `
      INSERT INTO public.factibilidad_cajas (
        id, name, lat, lng, box_type, box_type_name, is_nap, total_ports,
        available_ports, used_ports, status, potencia, pon, sector,
        observation, project, cables_count, implanted, updated_at, synced_at
      ) VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        box_type = EXCLUDED.box_type,
        box_type_name = EXCLUDED.box_type_name,
        is_nap = EXCLUDED.is_nap,
        total_ports = EXCLUDED.total_ports,
        available_ports = EXCLUDED.available_ports,
        used_ports = EXCLUDED.used_ports,
        status = EXCLUDED.status,
        potencia = EXCLUDED.potencia,
        pon = EXCLUDED.pon,
        sector = EXCLUDED.sector,
        observation = EXCLUDED.observation,
        project = EXCLUDED.project,
        cables_count = EXCLUDED.cables_count,
        implanted = EXCLUDED.implanted,
        updated_at = EXCLUDED.updated_at,
        synced_at = NOW();
    `;

    try {
      await query(sql, values);
      totalSaved += chunk.length;
    } catch (chunkErr) {
      console.error("Error guardando lote de cajas en PostgreSQL:", chunkErr);
    }
  }

  return totalSaved;
}

/**
 * Fetch fresh data directly from OZmap, transform and normalize
 */
export async function fetchAndTransformOzmapBoxes(): Promise<FactibilidadBox[]> {
  const raw = await fetchOzmapRaw("/api/v2/boxes?limit=10000");
  if (!raw || !Array.isArray(raw.rows)) {
    throw new Error(raw?.error || raw?.message || "No se recibieron cajas válidas de OZmap");
  }

  const boxes: FactibilidadBox[] = raw.rows
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
        name: (b.name || "").toLowerCase().includes("manga") ? "Manga de Empalme" : "Caja Nap",
        isNap: b.hierarchyLevel === 3 || !(b.name || "").toLowerCase().includes("manga"),
        defaultPorts: b.hierarchyLevel === 3 ? 16 : 0,
      };

      const parsedObs = parseObservation(b.observation);
      const totalPorts = parsedObs.puertos || typeInfo.defaultPorts;

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
        name: (b.name || "CAJA SIN NOMBRE").toUpperCase().trim(),
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
        observation: b.observation || null,
        project: b.project || null,
        cablesCount,
        implanted: Boolean(b.implanted),
        updatedAt: b.updatedAt || b.createdAt || null,
      };
    });

  return boxes;
}

/**
 * Synchronize boxes: pulls from OZmap, updates Database & Cache
 */
export async function syncBoxesWithOzmap(): Promise<{
  success: boolean;
  total: number;
  savedInPostgres: number;
  syncedAt: string;
}> {
  if (isSyncing) {
    return {
      success: true,
      total: memoryCache?.boxes.length || 0,
      savedInPostgres: 0,
      syncedAt: memoryCache?.syncedAt || new Date().toISOString(),
    };
  }

  isSyncing = true;
  try {
    const boxes = await fetchAndTransformOzmapBoxes();
    const syncedAt = new Date().toISOString();

    // 1. Update In-Process Memory Cache (immediate)
    memoryCache = {
      boxes,
      timestamp: Date.now(),
      syncedAt,
      source: "ozmap-sync",
    };

    // 2. Write to Local JSON Cache
    await writeBoxesToDisk(boxes);

    // 3. Upsert to PostgreSQL / Supabase
    let savedInPostgres = 0;
    try {
      savedInPostgres = await saveBoxesToPostgres(boxes);
    } catch (pgErr) {
      console.warn("No se pudo guardar la sincronización en PostgreSQL:", pgErr);
    }

    return {
      success: true,
      total: boxes.length,
      savedInPostgres,
      syncedAt,
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Get all boxes using highest speed multi-tier storage:
 * 1. Memory Cache: 0ms
 * 2. Local Disk Cache: ~15ms
 * 3. PostgreSQL Database: ~40ms
 * 4. Fresh OZmap Fetch (fallback only if totally empty)
 */
export async function getFastFactibilidadBoxes(forceRefresh = false): Promise<FactibilidadBox[]> {
  const now = Date.now();

  // 1. In-Memory Cache (0ms)
  if (!forceRefresh && memoryCache && now - memoryCache.timestamp < MEMORY_TTL) {
    return memoryCache.boxes;
  }

  // 2. If forceRefresh requested, trigger sync
  if (forceRefresh) {
    const syncRes = await syncBoxesWithOzmap();
    if (memoryCache && memoryCache.boxes.length > 0) {
      return memoryCache.boxes;
    }
  }

  // 3. Try Local Disk Cache (~15ms)
  const diskData = await readBoxesFromDisk();
  if (diskData && diskData.boxes.length > 0) {
    memoryCache = {
      boxes: diskData.boxes,
      timestamp: now,
      syncedAt: diskData.syncedAt,
      source: "disk-cache",
    };

    // If PostgreSQL configured but not yet populated in the background, seed it asynchronously
    if (isDatabaseConfigured()) {
      saveBoxesToPostgres(diskData.boxes).catch(() => {});
    }

    return diskData.boxes;
  }

  // 4. Try PostgreSQL Database (~40ms)
  const pgData = await readBoxesFromPostgres();
  if (pgData && pgData.boxes.length > 0) {
    memoryCache = {
      boxes: pgData.boxes,
      timestamp: now,
      syncedAt: pgData.syncedAt,
      source: "postgres",
    };
    writeBoxesToDisk(pgData.boxes).catch(() => {});
    return pgData.boxes;
  }

  // 5. Try Supabase Client fallback
  const sbData = await readBoxesFromSupabase();
  if (sbData && sbData.boxes.length > 0) {
    memoryCache = {
      boxes: sbData.boxes,
      timestamp: now,
      syncedAt: sbData.syncedAt,
      source: "supabase",
    };
    writeBoxesToDisk(sbData.boxes).catch(() => {});
    return sbData.boxes;
  }

  // 6. Absolute Fallback: Initial Sync from OZmap
  const syncRes = await syncBoxesWithOzmap();
  return memoryCache?.boxes || [];
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

/**
 * Radius query for point feasibility
 */
export async function getFastFactibilidadBoxesInRadius(
  lat: number,
  lng: number,
  radiusMeters = 1000,
  forceRefresh = false
): Promise<{ boxes: FactibilidadBox[]; totalInRadius: number; availableInRadius: number }> {
  const allBoxes = await getFastFactibilidadBoxes(forceRefresh);

  const nearby = allBoxes
    .map((b) => ({
      box: b,
      dist: calcDistanceMeters(lat, lng, b.lat, b.lng),
    }))
    .filter((item) => item.dist <= radiusMeters)
    .sort((a, b) => a.dist - b.dist)
    .map((item) => item.box);

  const availableInRadius = nearby.filter((b) => b.isNap && b.availablePorts > 0).length;

  return {
    boxes: nearby,
    totalInRadius: nearby.length,
    availableInRadius,
  };
}

