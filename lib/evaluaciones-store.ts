import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
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
  if (process.env.VERCEL) return true;
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

export async function readEvaluaciones(): Promise<EvaluacionRecord[]> {
  // 1. Try Native PostgreSQL First
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
      writeEvaluacionesLocal(rows).catch(() => {});
      return rows;
    }
  } catch (pgErr) {}

  // 2. Fallback to local
  return readEvaluacionesLocal();
}

