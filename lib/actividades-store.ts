import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

const ACTIVIDADES_FILE_PATH = path.join(process.cwd(), "data", "actividades.json");

export interface ActividadStoreRecord {
  id?: string;
  fecha: string;
  hora: string;
  asesor: string;
  tipo: string;
  solicitudes: number;
  clientes_captados: number;
  volantes: number;
  llamadas_info: number;
  llamadas_agenda: number;
  estado?: string | null;
  municipio?: string | null;
  parroquia?: string | null;
  sector?: string | null;
  condominio?: string | null;
  notas?: string | null;
  reporte_wa?: string | null;
  uid?: string | null;
  checklist?: Record<string, boolean> | null;
  checklist_cumplimiento_pct?: number | null;
  checklist_cumplidos?: number | null;
  checklist_total?: number | null;
  checklist_factor_scores?: any;
  created_at?: string;
}

interface StoredActividades {
  actividades: ActividadStoreRecord[];
}

async function ensureDirectory() {
  const dir = path.dirname(ACTIVIDADES_FILE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export async function readActividadesLocal(): Promise<ActividadStoreRecord[]> {
  try {
    await ensureDirectory();
    const data = await fs.readFile(ACTIVIDADES_FILE_PATH, "utf-8");
    const parsed: StoredActividades = JSON.parse(data);
    return Array.isArray(parsed.actividades) ? parsed.actividades : [];
  } catch {
    return [];
  }
}

export async function writeActividadesLocal(records: ActividadStoreRecord[]): Promise<boolean> {
  if (process.env.VERCEL) return true;
  try {
    await ensureDirectory();
    await fs.writeFile(
      ACTIVIDADES_FILE_PATH,
      JSON.stringify({ actividades: records }, null, 2),
      "utf-8"
    );
    return true;
  } catch {
    return false;
  }
}

export async function readAllActividades(): Promise<ActividadStoreRecord[]> {
  // 1. Try Native PostgreSQL First
  try {
    const rows = await query<any>(
      `SELECT id, fecha::text, hora, asesor, tipo, solicitudes,
              clientes_captados, volantes, llamadas_info, llamadas_agenda,
              estado, municipio, parroquia, sector, condominio, notas,
              reporte_wa, uid, checklist, checklist_cumplimiento_pct,
              checklist_cumplidos, checklist_total, checklist_factor_scores,
              created_at
       FROM public.actividades
       ORDER BY fecha DESC, hora DESC`
    );
    if (Array.isArray(rows) && rows.length > 0) {
      writeActividadesLocal(rows).catch(() => {});
      return rows;
    }
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("actividades")
      .select("*")
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      writeActividadesLocal(data).catch(() => {});
      return data;
    }
  } catch (supErr) {}

  // 3. Local mirror fallback
  return readActividadesLocal();
}

export async function appendActividadesLocal(newRecords: ActividadStoreRecord[]): Promise<boolean> {
  try {
    const existing = await readActividadesLocal();
    const combined = [...newRecords, ...existing];
    return writeActividadesLocal(combined);
  } catch {
    return false;
  }
}

