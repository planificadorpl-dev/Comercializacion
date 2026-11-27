import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { isCloudflareWorkers } from "@/lib/runtime-env";
import { EvaluacionRecord } from "@/lib/evaluaciones-data";

export const EVALUACIONES_FILE_PATH = path.join(process.cwd(), "data", "evaluaciones.json");

interface StoredEvaluaciones {
  evaluaciones: EvaluacionRecord[];
}

async function ensureDirectory() {
  const dir = path.dirname(EVALUACIONES_FILE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export async function readEvaluacionesLocal(): Promise<EvaluacionRecord[]> {
  try {
    await ensureDirectory();
    const data = await fs.readFile(EVALUACIONES_FILE_PATH, "utf-8");
    const parsed: StoredEvaluaciones = JSON.parse(data);
    return Array.isArray(parsed.evaluaciones) ? parsed.evaluaciones : [];
  } catch {
    return [];
  }
}

export async function writeEvaluacionesLocal(evaluaciones: EvaluacionRecord[]): Promise<boolean> {
  if (process.env.VERCEL || isCloudflareWorkers()) return true;
  try {
    await ensureDirectory();
    await fs.writeFile(
      EVALUACIONES_FILE_PATH,
      JSON.stringify({ evaluaciones }, null, 2),
      "utf-8"
    );
    return true;
  } catch {
    return false;
  }
}

function mapEvaluacionRow(r: any): EvaluacionRecord {
  return {
    id: r.id,
    asesor: r.asesor,
    evaluador: r.evaluador,
    evaluadorRol: r.evaluadorRol ?? r.evaluador_rol,
    frecuencia: r.frecuencia,
    fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : String(r.fecha || ""),
    estado: r.estado || "",
    municipio: r.municipio || "",
    parroquia: r.parroquia || "",
    sector: r.sector || "",
    items: r.items || {},
    observacionesGenerales: r.observacionesGenerales ?? r.observaciones_generales ?? "",
    cumplimientoPct: Number(r.cumplimientoPct ?? r.cumplimiento_pct ?? 0),
    puntuacionTotal: Number(r.puntuacionTotal ?? r.puntuacion_total ?? 0),
    puntuacionMaxima: Number(r.puntuacionMaxima ?? r.puntuacion_maxima ?? 0),
    puntuacionPromedio: Number(r.puntuacionPromedio ?? r.puntuacion_promedio ?? 0),
    itemsCumplidos: Number(r.itemsCumplidos ?? r.items_cumplidos ?? 0),
    itemsTotal: Number(r.itemsTotal ?? r.items_total ?? 0),
    factorScores: r.factorScores ?? r.factor_scores ?? {},
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  };
}

async function readEvaluacionesFromPostgres(): Promise<EvaluacionRecord[] | null> {
  try {
    const rows = await query<any>(
      `SELECT id, asesor, evaluador, evaluador_rol as "evaluadorRol", frecuencia,
              fecha::text as fecha, estado, municipio, parroquia, sector,
              items, observaciones_generales as "observacionesGenerales",
              cumplimiento_pct as "cumplimientoPct", puntuacion_total as "puntuacionTotal",
              puntuacion_maxima as "puntuacionMaxima", puntuacion_promedio as "puntuacionPromedio",
              items_cumplidos as "itemsCumplidos", items_total as "itemsTotal",
              factor_scores as "factorScores", created_at as "createdAt", updated_at as "updatedAt"
       FROM public.evaluaciones
       ORDER BY fecha DESC, created_at DESC`
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
  } catch {}
  return null;
}

async function readEvaluacionesFromSupabase(): Promise<EvaluacionRecord[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("evaluaciones")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(mapEvaluacionRow);
    }
  } catch {}
  return null;
}

export async function readEvaluaciones(): Promise<EvaluacionRecord[]> {
  const rows = isCloudflareWorkers()
    ? (await readEvaluacionesFromSupabase()) || (await readEvaluacionesFromPostgres())
    : (await readEvaluacionesFromPostgres()) || (await readEvaluacionesFromSupabase());

  if (rows && rows.length > 0) {
    writeEvaluacionesLocal(rows).catch(() => {});
    return rows;
  }

  return readEvaluacionesLocal();
}

