import fs from "fs/promises";
import path from "path";
import { query, queryRow } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { isCloudflareWorkers } from "@/lib/runtime-env";
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
  if (process.env.VERCEL || isCloudflareWorkers()) return true;
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

function mapChecklistRow(r: any): AdvisorChecklistRecord {
  return {
    id: r.id,
    asesor: r.asesor,
    fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 10) : String(r.fecha || ""),
    items: r.items || {},
    cumplimientoPct: Number(r.cumplimientoPct ?? r.cumplimiento_pct ?? 0),
    itemsCumplidos: Number(r.itemsCumplidos ?? r.items_cumplidos ?? 0),
    itemsTotal: Number(r.itemsTotal ?? r.items_total ?? 30),
    factorScores: r.factorScores ?? r.factor_scores ?? {},
    createdAt: r.createdAt ?? r.created_at,
  };
}

export async function readAdvisorChecklists(): Promise<AdvisorChecklistRecord[]> {
  const fromPg = async () => {
    try {
      const rows = await query<any>(
        `SELECT id, asesor, fecha::text, items, cumplimiento_pct as "cumplimientoPct",
                items_cumplidos as "itemsCumplidos", items_total as "itemsTotal",
                factor_scores as "factorScores", created_at as "createdAt"
         FROM public.advisor_checklists
         ORDER BY fecha DESC, created_at DESC`
      );
      return Array.isArray(rows) && rows.length > 0 ? rows : null;
    } catch {
      return null;
    }
  };

  const fromSupabase = async () => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("advisor_checklists")
        .select("*")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      return !error && Array.isArray(data) && data.length > 0 ? data.map(mapChecklistRow) : null;
    } catch {
      return null;
    }
  };

  const rows = isCloudflareWorkers()
    ? (await fromSupabase()) || (await fromPg())
    : (await fromPg()) || (await fromSupabase());

  if (rows) {
    writeChecklistsLocal(rows).catch(() => {});
    return rows;
  }

  return readChecklistsLocal();
}

export async function saveAdvisorChecklist(record: AdvisorChecklistRecord): Promise<boolean> {
  let pgSuccess = false;
  let supaSuccess = false;
  const recordId = record.id || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = record.createdAt || new Date().toISOString();

  if (!isCloudflareWorkers()) {
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
          recordId,
          record.asesor,
          record.fecha,
          JSON.stringify(record.items || {}),
          record.cumplimientoPct || 0,
          record.itemsCumplidos || 0,
          record.itemsTotal || 30,
          JSON.stringify(record.factorScores || {}),
          createdAt,
        ]
      );
      pgSuccess = true;
    } catch (pgErr) {
      console.warn("Postgres saveAdvisorChecklist aviso:", pgErr);
    }
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("advisor_checklists").upsert(
      {
        id: recordId,
        asesor: record.asesor,
        fecha: record.fecha,
        items: record.items || {},
        cumplimiento_pct: record.cumplimientoPct || 0,
        items_cumplidos: record.itemsCumplidos || 0,
        items_total: record.itemsTotal || 30,
        factor_scores: record.factorScores || {},
        created_at: createdAt,
      },
      { onConflict: "asesor,fecha" }
    );
    if (!error) supaSuccess = true;
  } catch (supaErr) {
    console.warn("Supabase saveAdvisorChecklist aviso:", supaErr);
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
  return pgSuccess || supaSuccess || localSaved;
}

export async function getLatestChecklistForAdvisor(
  asesor: string
): Promise<AdvisorChecklistRecord | null> {
  const fromPg = async () => {
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
      return row || null;
    } catch {
      return null;
    }
  };

  const fromSupabase = async () => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("advisor_checklists")
        .select("*")
        .ilike("asesor", asesor.trim())
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return !error && data ? mapChecklistRow(data) : null;
    } catch {
      return null;
    }
  };

  const row = isCloudflareWorkers()
    ? (await fromSupabase()) || (await fromPg())
    : (await fromPg()) || (await fromSupabase());

  if (row) return row;

  // Fallback to local
  const all = await readChecklistsLocal();
  const filtered = all
    .filter((c) => c.asesor.trim().toLowerCase() === asesor.trim().toLowerCase())
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return filtered.length > 0 ? filtered[0] : null;
}
