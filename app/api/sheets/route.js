import { NextResponse } from "next/server";
import zlib from "zlib";
import { parseSheetData, buildPivotTable, computeStats } from "@/app/lib/dataProcessor";
import { getSheetsClient } from "@/app/lib/googleAuth";
import { query } from "@/lib/db";
import { runSheetsSync } from "@/lib/sheets-sync-service";

// In-memory cache for responses (TTL 15 minutes)
const CACHE_TTL_MS = 15 * 60 * 1000;
const sheetsMemoryCache = new Map();

export function clearSheetsCache() {
  sheetsMemoryCache.clear();
}

function sendOptimizedResponse(request, payload, fromCache = false, preGzipped = null) {
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  const supportsGzip = acceptEncoding.includes("gzip");
  const finalPayload = fromCache ? { ...payload, fromCache: true } : payload;

  if (supportsGzip) {
    const gzipped = (preGzipped && !fromCache) ? preGzipped : zlib.gzipSync(Buffer.from(JSON.stringify(finalPayload)));
    return new NextResponse(gzipped, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Encoding": "gzip",
        "Cache-Control": "public, max-age=180, stale-while-revalidate=600",
        "Vary": "Accept-Encoding",
      },
    });
  }

  return new NextResponse(JSON.stringify(finalPayload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=180, stale-while-revalidate=600",
    },
  });
}

function toIsoDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(val);
  return str.includes("T") ? str.split("T")[0] : str.slice(0, 10);
}

const MONTH_NAMES_MAP = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function toSpanishMonth(val, fechaFallback) {
  if (val && String(val).trim()) return String(val).trim();
  const dateStr = toIsoDate(fechaFallback);
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    return MONTH_NAMES_MAP[m - 1] || "";
  }
  return "";
}

/**
 * GET /api/sheets
 * 
 * Fetches Google Sheets spreadsheet data directly (with fast in-memory caching).
 * Falls back to PostgreSQL if Google Sheets is unreachable or in intranet mode.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const sheetName = searchParams.get("sheetName") || "DATA LIMPIA";
    const confSheet = searchParams.get("confSheet") || "";
    const fullMatrix = searchParams.get("fullMatrix") === "true";
    const apiKey = searchParams.get("apiKey") || process.env.GOOGLE_API_KEY;
    const forceRefresh = searchParams.get("refresh") === "true";

    const now = Date.now();
    const cacheKey = `${spreadsheetId}_${sheetName}_${confSheet}_${fullMatrix}`;

    if (!forceRefresh && sheetsMemoryCache.has(cacheKey)) {
      const cached = sheetsMemoryCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL_MS) {
        return sendOptimizedResponse(request, cached.payload, true, cached.gzippedBuf);
      }
    }

    let records = [];
    let source = "google_sheets";

    // ── 1. Fetch directly from Google Sheets if spreadsheetId is provided ──────
    if (spreadsheetId) {
      try {
        const sheets = await getSheetsClient();
        const dataResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: sheetName,
        });

        if (dataResponse.data && dataResponse.data.values) {
          records = parseSheetData(dataResponse.data.values, sheetName);
          source = "google_sheets";
        }
      } catch (sheetsErr) {
        console.warn(`Aviso al consultar Google Sheets API (${sheetName}):`, sheetsErr.message);
        if (apiKey) {
          try {
            const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
            const dataResponse = await fetch(dataUrl, { cache: "no-store" });
            if (dataResponse.ok) {
              const dataJson = await dataResponse.json();
              records = parseSheetData(dataJson.values, sheetName);
              source = "google_sheets";
            }
          } catch {}
        }
      }
    }

    // ── 2. Fallback: Query Native PostgreSQL if Google Sheets returned no records ─
    if (records.length === 0) {
      try {
        const upperSheet = sheetName.toUpperCase();
        if (upperSheet.includes("DATA LIMPIA") || upperSheet.includes("CUADRO DIARIO")) {
          const rows = await query("SELECT * FROM public.instalaciones ORDER BY fecha ASC");
          if (Array.isArray(rows) && rows.length > 0) {
            records = rows.map((r, i) => ({
              id: r.id || i,
              fecha: toIsoDate(r.fecha),
              mes: r.mes || "",
              tecnico_1: r.tecnico_1 || "",
              tecnico_2: r.tecnico_2 || null,
              router: r.router || "0",
              nombre_cliente: r.nombre_cliente || "",
              cedula: r.cedula || "",
              zona: r.zona || "",
              sector: r.sector || "",
              asesor: r.asesor || "",
              equipo: r.equipo || "",
              estatus: r.estatus || "INSTALADO",
              plan: r.plan || "",
              power_go: r.power_go || "NO",
              servicio: r.servicio || "RESIDENCIAL",
              oficina: r.oficina || "OTROS",
              estado: r.estado || null,
            }));
            source = "postgresql";
          }
        } else if (upperSheet.includes("SOLICITUDES")) {
          const rows = await query("SELECT * FROM public.solicitudes ORDER BY fecha_solicitud ASC");
          if (Array.isArray(rows) && rows.length > 0) {
            records = rows.map((r, i) => ({
              id: r.id || i,
              fecha: toIsoDate(r.fecha_solicitud),
              mes: toSpanishMonth(r.mes, r.fecha_solicitud),
              asesor: r.promotor || r.asesor_normalizado || "Sin Asesor",
              estatus: r.estatus || "Pendiente",
              nombre_cliente: r.nombre_cliente || `${r.nombres || ""} ${r.apellidos || ""}`.trim(),
              cedula: r.cedula || "",
              plan: r.plan || "",
              tipo_operacion: r.tipo_operacion || "Instalación",
              power_go: r.power_go || "NO",
              estado: r.estado || "",
              municipio: r.municipio || "",
              zona: r.parroquia || r.estado || "N/A",
              sector: r.sector || "",
              ubicacion: r.ubicacion || "",
              canal: r.canal || "",
              sede_taquilla: r.sede_taquilla || "",
              fuente: r.fuente || "",
            }));
            source = "postgresql";
          }
        }
      } catch (pgErr) {
        console.warn("PostgreSQL read skipped/fallback:", pgErr.message);
      }
    }

    const responsePayload = {
      success: true,
      source,
      spreadsheetId: spreadsheetId || "intranet-postgres",
      sheetName,
      rawCount: records.length,
      data: records,
      fetchedAt: new Date().toISOString(),
    };

    const gzippedBuf = zlib.gzipSync(Buffer.from(JSON.stringify(responsePayload)));

    sheetsMemoryCache.set(cacheKey, {
      timestamp: now,
      payload: responsePayload,
      gzippedBuf,
    });

    return sendOptimizedResponse(request, responsePayload, false, gzippedBuf);
  } catch (error) {
    console.error("API Error in /api/sheets:", error);
    return NextResponse.json(
      { error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
