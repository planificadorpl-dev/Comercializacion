import fs from "fs/promises";
import path from "path";
import { query, queryRow } from "@/lib/db";
import { AdvisorChecklistRecord } from "./evaluaciones-data";

const CHECKLISTS_FILE_PATH = path.join(process.cwd(), "data", "advisor-checklists.json");

interface StoredChecklists {
  checklists: AdvisorChecklistRecord[];
}

async function ensureDirectory() {
  const dir = path.dirname(CHECKLISTS_FILE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Ignore if exists
  }
}

async function readChecklistsLocal(): Promise<AdvisorChecklistRecord[]> {
  try {
    await ensureDirectory();
    const data = await fs.readFile(CHECKLISTS_FILE_PATH, "utf-8");
    const parsed: StoredChecklists = JSON.parse(data);
    return Array.isArray(parsed.checklists) ? parsed.checklists : [];
  } catch {
    return [];
  }
}

async function writeChecklistsLocal(list: AdvisorChecklistRecord[]): Promise<boolean> {
  try {
    await ensureDirectory();
    await fs.writeFile(
      CHECKLISTS_FILE_PATH,
      JSON.stringify({ checklists: list }, null, 2),
      "utf-8"
    );
    return true;
  } catch (err) {
    return false;
  }
}

export async function readAdvisorChecklists(): Promise<AdvisorChecklistRecord[]> {
  // 1. Try Native PostgreSQL First
  try {
    const rows = await query<any>(
      `SELECT id, asesor, fecha::text, items, cumplimiento_pct as "cumplimientoPct",
              items_cumplidos as "itemsCumplidos", items_total as "itemsTotal",
              factor_scores as "factorScores", created_at as "createdAt"
       FROM public.advisor_checklists
       ORDER BY fecha DESC, created_at DESC`
    );

    if (Array.isArray(rows) && rows.length > 0) {
      writeChecklistsLocal(rows).catch(() => {});
      return rows;
    }
  } catch (pgErr) {}

  // 2. Fallback to local
  return readChecklistsLocal();
}

export async function saveAdvisorChecklist(record: AdvisorChecklistRecord): Promise<boolean> {
  let pgSuccess = false;
  // 1. PostgreSQL
  try {
    await query(
      `INSERT INTO public.advisor_checklists (
         id, asesor, fecha, items, cumplimiento_pct, items_cumplidos,
         items_total, factor_scores, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (asesor, fecha) DO UPDATE SET
         items = EXCLUDED.items,
         cumplimiento_pct = EXCLUDED.cumplimiento_pct,
         items_cumplidos = EXCLUDED.items_cumplidos,
         items_total = EXCLUDED.items_total,
         factor_scores = EXCLUDED.factor_scores`,
      [
        record.id || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        record.asesor,
        record.fecha,
        JSON.stringify(record.items || {}),
        record.cumplimientoPct || 0,
        record.itemsCumplidos || 0,
        record.itemsTotal || 30,
        JSON.stringify(record.factorScores || {}),
        record.createdAt || new Date().toISOString(),
      ]
    );
    pgSuccess = true;
  } catch (pgErr) {
    console.warn("Postgres saveAdvisorChecklist aviso:", pgErr);
  }

  // 2. Local mirror
  const existing = await readChecklistsLocal();
  const index = existing.findIndex(
    (c) => c.asesor === record.asesor && c.fecha === record.fecha
  );

  if (index >= 0) {
    existing[index] = { ...existing[index], ...record };
  } else {
    existing.unshift(record);
  }

  const localSaved = await writeChecklistsLocal(existing);
  return pgSuccess || localSaved;
}

export async function getLatestChecklistForAdvisor(
  asesor: string
): Promise<AdvisorChecklistRecord | null> {
  // 1. Try PostgreSQL
  try {
    const row = await queryRow<any>(
      `SELECT id, asesor, fecha::text, items, cumplimiento_pct as "cumplimientoPct",
              items_cumplidos as "itemsCumplidos", items_total as "itemsTotal",
              factor_scores as "factorScores", created_at as "createdAt"
       FROM public.advisor_checklists
       WHERE LOWER(TRIM(asesor)) = LOWER(TRIM($1))
       ORDER BY fecha DESC, created_at DESC
       LIMIT 1`,
      [asesor]
    );
    if (row) return row;
  } catch (pgErr) {}

  // 2. Fallback to local
  const all = await readChecklistsLocal();
  const filtered = all
    .filter((c) => c.asesor.trim().toLowerCase() === asesor.trim().toLowerCase())
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return filtered.length > 0 ? filtered[0] : null;
}
