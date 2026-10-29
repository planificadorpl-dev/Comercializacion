"use server";

import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── In-Memory Server Cache ─────────────────────────────────────
let cachedAsesores: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

export async function invalidateAsesoresCache() {
  cachedAsesores = null;
}

// ── Asesores CRUD ──────────────────────────────────────────────

export async function getAsesores(soloActivos = false) {
  const now = Date.now();
  if (cachedAsesores && now - cachedAsesores.timestamp < CACHE_TTL_MS) {
    const list = cachedAsesores.data;
    return soloActivos ? list.filter((a) => a.activo !== false) : list;
  }

  // Read advisor overrides to exclude ex-collaborators
  let exCollaboratorsSet = new Set<string>();
  try {
    // Check PostgreSQL personal_config first
    const rows = await query<{ data: any }>(
      "SELECT data FROM public.personal_config WHERE key = 'main_config' LIMIT 1"
    );
    if (rows.length > 0 && rows[0].data?.overrides) {
      for (const [key, val] of Object.entries(rows[0].data.overrides as Record<string, any>)) {
        if (val?.isExCollaborator === true || val?.status === "ex") {
          exCollaboratorsSet.add(key.toLowerCase().trim());
        }
      }
    } else {
      // Fallback to local file
      const fs = await import("fs/promises");
      const path = await import("path");
      const configPath = path.join(process.cwd(), "data", "advisor-config.json");
      const configRaw = await fs.readFile(configPath, "utf-8");
      const configJson = JSON.parse(configRaw);
      if (configJson?.overrides) {
        for (const [key, val] of Object.entries(configJson.overrides as Record<string, any>)) {
          if (val?.isExCollaborator === true || val?.status === "ex") {
            exCollaboratorsSet.add(key.toLowerCase().trim());
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  // 1. Try Native PostgreSQL First
  try {
    const rows = await query<{ id: number; nombre: string; activo: boolean }>(
      "SELECT id, nombre, activo FROM public.asesores_config ORDER BY nombre ASC"
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const processed = rows.filter((item) => {
        if (!item.nombre) return false;
        const lower = item.nombre.toLowerCase().trim();
        if (lower === "planificación" || lower === "planificacion") return false;
        if (soloActivos && exCollaboratorsSet.has(lower)) return false;
        return true;
      });

      cachedAsesores = { data: processed, timestamp: now };
      return soloActivos ? processed.filter((a) => a.activo !== false) : processed;
    }
  } catch {
    // Fallback if postgres not available yet
  }

  // 2. Try Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("asesores_config")
      .select("*")
      .order("nombre");

    if (!error && data) {
      const processed = data.filter((item: any) => {
        if (!item.nombre) return false;
        const lower = item.nombre.toLowerCase().trim();
        if (lower === "planificación" || lower === "planificacion") return false;
        if (soloActivos && exCollaboratorsSet.has(lower)) return false;
        return true;
      });

      cachedAsesores = { data: processed, timestamp: now };
      return soloActivos ? processed.filter((a) => a.activo !== false) : processed;
    }
  } catch (err: any) {
    console.warn("Error getting asesores:", err.message);
  }

  return cachedAsesores ? cachedAsesores.data : [];
}

export async function addAsesor(asesor: { nombre: string; activo?: boolean }) {
  const nombre = asesor.nombre.trim();
  const activo = asesor.activo ?? true;

  // 1. PostgreSQL
  try {
    await query(
      `INSERT INTO public.asesores_config (nombre, activo)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET activo = EXCLUDED.activo`,
      [nombre, activo]
    );
  } catch (pgErr) {
    console.warn("Postgres addAsesor aviso:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("asesores_config").insert([{ nombre, activo }]);
  } catch {
    // Ignore if Supabase fails
  }

  invalidateAsesoresCache();
  revalidatePath("/admin/asesores");
  revalidatePath("/");
}

export async function updateAsesor(id: string | number, updates: { nombre?: string; activo?: boolean }) {
  // 1. PostgreSQL
  try {
    if (updates.nombre !== undefined && updates.activo !== undefined) {
      await query(
        "UPDATE public.asesores_config SET nombre = $1, activo = $2 WHERE id = $3",
        [updates.nombre.trim(), updates.activo, id]
      );
    } else if (updates.nombre !== undefined) {
      await query(
        "UPDATE public.asesores_config SET nombre = $1 WHERE id = $2",
        [updates.nombre.trim(), id]
      );
    } else if (updates.activo !== undefined) {
      await query(
        "UPDATE public.asesores_config SET activo = $1 WHERE id = $2",
        [updates.activo, id]
      );
    }
  } catch (pgErr) {
    console.warn("Postgres updateAsesor aviso:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    const payload: any = {};
    if (updates.nombre !== undefined) payload.nombre = updates.nombre.trim();
    if (updates.activo !== undefined) payload.activo = updates.activo;
    await supabase.from("asesores_config").update(payload).eq("id", id);
  } catch {
    // Ignore
  }

  invalidateAsesoresCache();
  revalidatePath("/admin/asesores");
  revalidatePath("/");
}

export async function deleteAsesor(id: string | number) {
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.asesores_config WHERE id = $1", [id]);
  } catch (pgErr) {
    console.warn("Postgres deleteAsesor aviso:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("asesores_config").delete().eq("id", id);
  } catch {
    // Ignore
  }

  invalidateAsesoresCache();
  revalidatePath("/admin/asesores");
  revalidatePath("/");
}
