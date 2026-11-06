import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  SystemModule,
  DEFAULT_SYSTEM_MODULES,
  AppUserRole,
} from "./modules-types";

export type { SystemModule, AppUserRole };
export { DEFAULT_SYSTEM_MODULES };

const MODULES_FILE_PATH = path.join(process.cwd(), "data", "system-modules.json");

export async function readModulesLocal(): Promise<SystemModule[]> {
  try {
    const content = await fs.readFile(MODULES_FILE_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const idMap = new Map(parsed.map((m: SystemModule) => [m.id, m]));
      return DEFAULT_SYSTEM_MODULES.map((def) => {
        const existing = idMap.get(def.id);
        return existing ? { ...def, ...existing } : def;
      });
    }
    return DEFAULT_SYSTEM_MODULES;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await writeModulesLocal(DEFAULT_SYSTEM_MODULES);
    }
    return DEFAULT_SYSTEM_MODULES;
  }
}

export async function writeModulesLocal(modules: SystemModule[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(MODULES_FILE_PATH), { recursive: true });
    await fs.writeFile(MODULES_FILE_PATH, JSON.stringify(modules, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write local system modules cache:", err);
  }
}

export async function fetchAllModules(): Promise<{ success: boolean; modules: SystemModule[]; error?: string }> {
  // 1. Try Native PostgreSQL First
  try {
    const rows = await query<{
      id: string;
      enabled_for_users: boolean;
      updated_at: string;
      updated_by?: string;
    }>("SELECT id, enabled_for_users, updated_at, updated_by FROM public.configuracion_modulos ORDER BY id ASC");

    if (Array.isArray(rows) && rows.length > 0) {
      const merged = DEFAULT_SYSTEM_MODULES.map((def) => {
        const row = rows.find((r) => r.id === def.id);
        if (row) {
          return {
            ...def,
            enabledForUsers: row.enabled_for_users !== undefined ? Boolean(row.enabled_for_users) : def.enabledForUsers,
            updatedAt: row.updated_at || def.updatedAt,
            updatedBy: row.updated_by || undefined,
          };
        }
        return def;
      });
      writeModulesLocal(merged).catch(() => {});
      return { success: true, modules: merged };
    }
  } catch {
    // Fallback if Postgres not yet reachable
  }

  // 2. Try Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("configuracion_modulos")
      .select("*")
      .order("id", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const merged = DEFAULT_SYSTEM_MODULES.map((def) => {
        const row = data.find((r: any) => r.id === def.id);
        if (row) {
          return {
            ...def,
            enabledForUsers: row.enabled_for_users !== undefined ? Boolean(row.enabled_for_users) : def.enabledForUsers,
            updatedAt: row.updated_at || def.updatedAt,
            updatedBy: row.updated_by || undefined,
          };
        }
        return def;
      });
      writeModulesLocal(merged).catch(() => {});
      return { success: true, modules: merged };
    }
  } catch {
    // Graceful fallback to local
  }

  const local = await readModulesLocal();
  return { success: true, modules: local };
}

export async function persistModuleStatus(
  moduleId: string,
  enabledForUsers: boolean,
  updatedBy?: string
): Promise<{ success: boolean; modules?: SystemModule[]; error?: string }> {
  try {
    const currentList = await readModulesLocal();
    const updated = currentList.map((m) =>
      m.id === moduleId
        ? {
            ...m,
            enabledForUsers,
            updatedAt: new Date().toISOString(),
            updatedBy: updatedBy || m.updatedBy,
          }
        : m
    );

    await writeModulesLocal(updated);

    // 1. Persist to native PostgreSQL
    try {
      await query(
        `INSERT INTO public.configuracion_modulos (id, enabled_for_users, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (id) DO UPDATE SET
           enabled_for_users = EXCLUDED.enabled_for_users,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
        [moduleId, enabledForUsers, updatedBy || "admin"]
      );
    } catch {
      // Ignored if postgres not configured yet
    }

    // 2. Fallback to Supabase
    try {
      const supabase = await createClient();
      await supabase.from("configuracion_modulos").upsert({
        id: moduleId,
        enabled_for_users: enabledForUsers,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || "admin",
      });
    } catch {
      // Ignored if table doesn't exist yet
    }

    return { success: true, modules: updated };
  } catch (err: any) {
    console.error("Error updating module status:", err);
    return { success: false, error: err.message || "Error al actualizar estado del panel" };
  }
}
