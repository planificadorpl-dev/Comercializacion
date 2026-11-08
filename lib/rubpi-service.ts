import fs from "fs/promises";
import path from "path";
import { formatProperCase } from "@/lib/utils";
import { isValidGeoName, normalizeLocation, normGeoKey } from "@/lib/geo_normalization";

export interface CleanGeoRecord {
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
}

export type GeoHierarchyTree = Record<string, Record<string, Record<string, string[]>>>;

export interface RubpiGeodataResult {
  syncedAt: string;
  totalRawUsers: number;
  totalResidential: number;
  totalSectors: number;
  totalOriginallyMissing: number;
  totalEnriched: number;
  sectors: CleanGeoRecord[];
  hierarchy: GeoHierarchyTree;
}

const CACHE_FILE_PATH = path.join(process.cwd(), "data", "geodata-cache.json");

// In-memory cache for ultra-fast 0ms reads in Node.js serverless/runtime
let memoryGeoCache: RubpiGeodataResult | null = null;

// Credentials from Environment variables (MUST be set in Vercel and .env.local)
const RUBPI_BASE_URL = process.env.RUBPI_BASE_URL || "https://powerlink.rubpi.com";
const RUBPI_USERNAME = process.env.RUBPI_USERNAME || "";
const RUBPI_PASSWORD = process.env.RUBPI_PASSWORD || "";

/**
 * 1. Log in to Rubpi API to acquire JWT bearer token
 */
async function loginRubpi(): Promise<string> {
  if (!RUBPI_USERNAME || !RUBPI_PASSWORD) {
    throw new Error(
      "Credenciales de Rubpi no configuradas. Por favor define RUBPI_USERNAME y RUBPI_PASSWORD en las variables de entorno de Vercel y en .env.local."
    );
  }

  const res = await fetch(`${RUBPI_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: RUBPI_USERNAME,
      password: RUBPI_PASSWORD,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error de autenticación con Rubpi (Status ${res.status}): ${errorText}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Respuesta inválida de Rubpi: no se recibió access_token.");
  }

  return json.access_token;
}

/**
 * 2. Start asynchronous export task on Rubpi
 */
async function startRubpiExport(token: string): Promise<string> {
  const res = await fetch(`${RUBPI_BASE_URL}/api/exports/users?is_natural=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Error al iniciar exportación en Rubpi (Status ${res.status}): ${errorText}`);
  }

  const json = await res.json();
  if (!json.task_id) {
    throw new Error("No se obtuvo task_id de exportación de Rubpi.");
  }

  return json.task_id;
}

/**
 * 3. Poll Rubpi export task status until COMPLETED or timeout
 */
async function pollRubpiTask(token: string, taskId: string, maxAttempts = 36, intervalMs = 4000): Promise<void> {
  let attempts = 0;
  let status = "PENDING";

  while ((status === "PENDING" || status === "PROCESSING") && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;

    const res = await fetch(`${RUBPI_BASE_URL}/api/exports/users/${taskId}/status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Error al consultar estatus de tarea Rubpi ${taskId} (Status ${res.status})`);
    }

    const json = await res.json();
    status = json.status;
  }

  if (status !== "COMPLETED") {
    throw new Error(`La exportación en Rubpi finalizó con estado: ${status} luego de ${attempts} intentos.`);
  }
}

/**
 * 4. Download export data JSON
 */
async function downloadRubpiData(token: string, taskId: string): Promise<any[]> {
  const res = await fetch(`${RUBPI_BASE_URL}/api/exports/users/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Error al descargar archivo de exportación Rubpi ${taskId} (Status ${res.status})`);
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Normalization & Cleaning Pipeline translated directly from Power Query M
 */
function cleanStateValue(raw: string | null | undefined): string {
  const clean = formatProperCase(raw);
  if (!clean) return "";
  if (/dttcap|distrito\s*cap/i.test(clean)) return "Distrito Capital";
  return clean;
}

function cleanCityValue(raw: string | null | undefined): string {
  const clean = formatProperCase(raw);
  if (!clean) return "";

  // Power BI M Replacements:
  // San Antonio De Los Altos / Los Salias (Polonias) -> Los Salias
  if (/san\s*antonio\s*de\s*los\s*altos|los\s*salias/i.test(clean)) {
    return "Los Salias";
  }
  // Caracas / El Valle / Propatria -> Libertador
  if (/caracas|el\s*valle|propatria|libertador/i.test(clean)) {
    return "Libertador";
  }
  // Los Teques / Guaicaipuro / Av Bicentenario / Victor Baptista / Los Lagos -> Guaicaipuro
  if (/los\s*teques|guaicaipuro|bicentenario|victor\s*baptista|los\s*lagos/i.test(clean)) {
    return "Guaicaipuro";
  }
  // Santos Michelena / Santo Michelena / Tejerias -> Santos Michelena
  if (/santo\s*michelena|santos\s*michelena|tejerias/i.test(clean)) {
    return "Santos Michelena";
  }
  // Jose Rafael Revenga / El Consejo
  if (/revenga|el\s*consejo/i.test(clean)) {
    return "José Rafael Revenga";
  }
  // Carrizal
  if (/carrizal/i.test(clean)) {
    return "Carrizal";
  }

  return clean;
}

function cleanUrbanValue(raw: string | null | undefined, fallbackMunicipio: string): string {
  let clean = formatProperCase(raw);
  if (!clean) return fallbackMunicipio;

  // Power BI M replacements:
  // "Las Dalias" -> "Los Teques"
  if (/las\s*dalias/i.test(clean)) {
    return "Los Teques";
  }
  // "Rosaleda" -> "San Antonio De Los Altos"
  if (/rosaleda/i.test(clean)) {
    return "San Antonio de Los Altos";
  }
  if (/san\s*antonio\s*de\s*los\s*altos/i.test(clean)) {
    return "San Antonio de Los Altos";
  }
  if (/cecilio\s*acosta/i.test(clean)) {
    return "Cecilio Acosta (San Diego y San José)";
  }
  if (/las\s*tejerias/i.test(clean)) {
    return "Las Tejerías";
  }
  if (/sucre.*catia/i.test(clean)) {
    return "Sucre (Catia)";
  }

  return clean;
}

function cleanSectorValue(raw: string | null | undefined): string {
  let clean = formatProperCase(raw);
  if (!clean) return "";

  // Power BI M replacements:
  if (/las\s*dalias/i.test(clean)) {
    return "Los Teques";
  }

  return clean;
}

/**
 * Intelligently resolves missing sector for records lacking one
 * using the urban field, address keywords, and the canonical normalization engine.
 */
export function resolveMissingSector(
  rawUrban: string | null | undefined,
  rawAddress: string | null | undefined,
  fallbackMunicipio: string,
  fallbackEstado: string
): { sector: string; parroquia?: string; municipio?: string; estado?: string } | null {
  // 1. Try resolving via urban field
  if (rawUrban) {
    const normUrb = normalizeLocation({ sector: rawUrban, zona: fallbackMunicipio });
    if (normUrb.isRecognized && normUrb.sector && isValidGeoName(normUrb.sector)) {
      return {
        sector: normUrb.sector,
        parroquia: normUrb.parroquia || undefined,
        municipio: normUrb.municipio || fallbackMunicipio,
        estado: normUrb.estado || fallbackEstado,
      };
    }
  }

  // 2. Try resolving via address text pattern matching and normalization
  if (rawAddress) {
    const normAddr = normalizeLocation({ sector: rawAddress, zona: rawUrban || fallbackMunicipio });
    if (normAddr.isRecognized && normAddr.sector && isValidGeoName(normAddr.sector)) {
      return {
        sector: normAddr.sector,
        parroquia: normAddr.parroquia || undefined,
        municipio: normAddr.municipio || fallbackMunicipio,
        estado: normAddr.estado || fallbackEstado,
      };
    }

    // Keyword heuristics for common residential pockets
    const upperAddr = String(rawAddress).toUpperCase();
    if (upperAddr.includes("SUIZA")) {
      return { sector: "La Rosaleda", parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" };
    }
    if (upperAddr.includes("ROSALEDA")) {
      return { sector: "La Rosaleda", parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" };
    }
    if (upperAddr.includes("DALIAS")) {
      return { sector: "Centro Los Teques", parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" };
    }
    if (upperAddr.includes("SILSA")) {
      return { sector: "Propatria", parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" };
    }
    if (upperAddr.includes("COLISEO")) {
      return { sector: "C.C. Coliseo", parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" };
    }
  }

  return null;
}

/**
 * Enriches Rubpi users dataset, filling in missing sectors where possible
 */
export function enrichRubpiUsers(records: any[]): {
  totalResidential: number;
  totalWithOriginalSector: number;
  totalEnriched: number;
  stillMissing: number;
  users: any[];
} {
  let totalResidential = 0;
  let totalWithOriginalSector = 0;
  let totalEnriched = 0;
  let stillMissing = 0;

  const enrichedUsers = records.map((r) => {
    const serviceType = String(r.service_type || "").trim().toUpperCase();
    if (serviceType !== "RESIDENCIAL") {
      return r;
    }
    totalResidential++;

    const estado = cleanStateValue(r.state);
    const municipio = cleanCityValue(r.city);
    let parroquia = cleanUrbanValue(r.urban, municipio);
    let sector = cleanSectorValue(r.sector);
    let isEnriched = false;

    if (sector && isValidGeoName(sector)) {
      totalWithOriginalSector++;
    } else {
      const resolved = resolveMissingSector(r.urban, r.address, municipio, estado);
      if (resolved) {
        sector = resolved.sector;
        if (resolved.parroquia) parroquia = resolved.parroquia;
        totalEnriched++;
        isEnriched = true;
      } else {
        stillMissing++;
      }
    }

    return {
      ...r,
      state: estado,
      city: municipio,
      urban: parroquia,
      sector: sector || "Sin Sector",
      isSectorEnriched: isEnriched,
    };
  });

  return {
    totalResidential,
    totalWithOriginalSector,
    totalEnriched,
    stillMissing,
    users: enrichedUsers,
  };
}

/**
 * Processes raw Rubpi records into a structured and deduplicated geographic hierarchy,
 * recovering sectors from urban and address where missing.
 */
export function processRubpiGeodata(records: any[]): RubpiGeodataResult {
  const tree: GeoHierarchyTree = {};
  const comboSet = new Set<string>();
  const flatSectors: CleanGeoRecord[] = [];
  let totalResidential = 0;
  let totalOriginallyMissing = 0;
  let totalEnriched = 0;

  for (const r of records) {
    const serviceType = String(r.service_type || "").trim().toUpperCase();
    if (serviceType !== "RESIDENCIAL") continue;
    totalResidential++;

    const estado = cleanStateValue(r.state);
    const municipio = cleanCityValue(r.city);
    let parroquia = cleanUrbanValue(r.urban, municipio);
    let sector = cleanSectorValue(r.sector);

    if (!isValidGeoName(sector)) {
      totalOriginallyMissing++;
      const resolved = resolveMissingSector(r.urban, r.address, municipio, estado);
      if (resolved) {
        sector = resolved.sector;
        if (resolved.parroquia) parroquia = resolved.parroquia;
        totalEnriched++;
      }
    }

    if (!isValidGeoName(estado) || !isValidGeoName(municipio) || !isValidGeoName(parroquia) || !isValidGeoName(sector)) {
      continue;
    }

    const dedupeKey = `${estado.toLowerCase()}|${municipio.toLowerCase()}|${parroquia.toLowerCase()}|${sector.toLowerCase()}`;
    if (!comboSet.has(dedupeKey)) {
      comboSet.add(dedupeKey);
      flatSectors.push({ estado, municipio, parroquia, sector });

      if (!tree[estado]) tree[estado] = {};
      if (!tree[estado][municipio]) tree[estado][municipio] = {};
      if (!tree[estado][municipio][parroquia]) tree[estado][municipio][parroquia] = [];

      if (!tree[estado][municipio][parroquia].includes(sector)) {
        tree[estado][municipio][parroquia].push(sector);
      }
    }
  }

  // Sort sectors alphabetically in each node
  for (const est in tree) {
    for (const mun in tree[est]) {
      for (const parr in tree[est][mun]) {
        tree[est][mun][parr].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
      }
    }
  }

  flatSectors.sort((a, b) => {
    const cmpEst = a.estado.localeCompare(b.estado, "es", { sensitivity: "base" });
    if (cmpEst !== 0) return cmpEst;
    const cmpMun = a.municipio.localeCompare(b.municipio, "es", { sensitivity: "base" });
    if (cmpMun !== 0) return cmpMun;
    const cmpParr = a.parroquia.localeCompare(b.parroquia, "es", { sensitivity: "base" });
    if (cmpParr !== 0) return cmpParr;
    return a.sector.localeCompare(b.sector, "es", { sensitivity: "base" });
  });

  return {
    syncedAt: new Date().toISOString(),
    totalRawUsers: records.length,
    totalResidential,
    totalSectors: flatSectors.length,
    totalOriginallyMissing,
    totalEnriched,
    sectors: flatSectors,
    hierarchy: tree,
  };
}

/**
 * Reads geodata from disk cache (`data/geodata-cache.json`)
 */
export async function readGeodataFromDisk(): Promise<RubpiGeodataResult | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sectors) && parsed.sectors.length > 0) {
      return parsed as RubpiGeodataResult;
    }
  } catch {
    // Disk cache not available
  }
  return null;
}

/**
 * Writes geodata to disk cache (`data/geodata-cache.json`)
 */
export async function writeGeodataToDisk(data: RubpiGeodataResult): Promise<void> {
  if (process.env.VERCEL) return; // Read-only runtime on Vercel
  try {
    await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("No se pudo persistir el caché geográfico en disco:", err);
  }
}

/**
 * Main function: Get geodata using multi-tier caching:
 * Memory (0ms) -> Disk Cache (~10ms) -> Remote Rubpi Sync
 */
export async function getMasterGeodata(forceRefresh = false): Promise<RubpiGeodataResult> {
  if (!forceRefresh) {
    if (memoryGeoCache) {
      return memoryGeoCache;
    }

    const diskData = await readGeodataFromDisk();
    if (diskData) {
      memoryGeoCache = diskData;
      return diskData;
    }
  }

  return syncMasterGeodataFromRubpi();
}

/**
 * Executes a full live fetch from Rubpi, cleans data, writes disk cache, and updates memory
 */
export async function syncMasterGeodataFromRubpi(): Promise<RubpiGeodataResult> {
  console.log("[Rubpi] Iniciando sesión...");
  const token = await loginRubpi();
  console.log("[Rubpi] Creando tarea de exportación...");
  const taskId = await startRubpiExport(token);
  console.log(`[Rubpi] Tarea iniciada: ${taskId}. Monitoreando progreso...`);
  await pollRubpiTask(token, taskId);
  console.log("[Rubpi] Exportación completada. Descargando usuarios...");
  const rawUsers = await downloadRubpiData(token, taskId);
  console.log(`[Rubpi] Descargados ${rawUsers.length} registros. Procesando limpieza...`);

  const cleanResult = processRubpiGeodata(rawUsers);
  console.log(`[Rubpi] Limpieza completada: ${cleanResult.totalSectors} sectores canónicos.`);

  // Update caches
  memoryGeoCache = cleanResult;
  await writeGeodataToDisk(cleanResult);
  console.log("[Rubpi] Caché en disco actualizado con éxito.");

  return cleanResult;
}
