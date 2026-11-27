import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { query, queryRow } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { isCloudflareWorkers } from "@/lib/runtime-env";
import {
  AdvisorOverridesMap,
  TechnicianOverridesMap,
} from "@/lib/normalization";
import { clearPlanningMetadataCache } from "@/lib/planificacion-service";

const CONFIG_FILE_PATH = path.join(process.cwd(), "data", "advisor-config.json");

export interface StoredConfig {
  overrides: AdvisorOverridesMap;
  aliases: Record<string, string>;
  technicianOverrides?: TechnicianOverridesMap;
  technicianAliases?: Record<string, string>;
}

async function ensureConfigDirectory() {
  const dir = path.dirname(CONFIG_FILE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // Ignore if exists
  }
}

async function readConfigLocal(): Promise<StoredConfig> {
  try {
    await ensureConfigDirectory();
    const data = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    const parsed = JSON.parse(data);

    if (parsed.overrides || parsed.aliases || parsed.technicianOverrides || parsed.technicianAliases) {
      return {
        overrides: parsed.overrides || {},
        aliases: parsed.aliases || {},
        technicianOverrides: parsed.technicianOverrides || {},
        technicianAliases: parsed.technicianAliases || {},
      };
    }

    return {
      overrides: parsed || {},
      aliases: {},
      technicianOverrides: {},
      technicianAliases: {},
    };
  } catch (err: any) {
    return { overrides: {}, aliases: {}, technicianOverrides: {}, technicianAliases: {} };
  }
}

async function writeConfigLocal(config: StoredConfig): Promise<boolean> {
  if (process.env.VERCEL || isCloudflareWorkers()) return true;
  try {
    await ensureConfigDirectory();
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing local advisor config:", err);
    return false;
  }
}

function normalizeStoredConfig(parsed: any): StoredConfig {
  return {
    overrides: parsed?.overrides || {},
    aliases: parsed?.aliases || {},
    technicianOverrides: parsed?.technicianOverrides || {},
    technicianAliases: parsed?.technicianAliases || {},
  };
}

async function readConfigFromPostgres(): Promise<StoredConfig | null> {
  try {
    const row = await queryRow<{ data: any }>(
      "SELECT data FROM public.personal_config WHERE key = 'main_config' LIMIT 1"
    );
    if (row && row.data) {
      return normalizeStoredConfig(row.data);
    }
  } catch {}
  return null;
}

async function readConfigFromSupabase(): Promise<StoredConfig | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("personal_config")
      .select("data")
      .eq("key", "main_config")
      .limit(1)
      .maybeSingle();

    if (!error && data?.data) {
      return normalizeStoredConfig(data.data);
    }
  } catch {}
  return null;
}

async function readConfig(): Promise<StoredConfig> {
  const fromPrimary = isCloudflareWorkers()
    ? (await readConfigFromSupabase()) || (await readConfigFromPostgres())
    : (await readConfigFromPostgres()) || (await readConfigFromSupabase());

  if (fromPrimary) {
    writeConfigLocal(fromPrimary).catch(() => {});
    return fromPrimary;
  }

  return readConfigLocal();
}

async function writeConfig(config: StoredConfig): Promise<boolean> {
  let pgSuccess = false;
  let supaSuccess = false;
  const inWorkers = isCloudflareWorkers();

  if (!inWorkers) {
    try {
      await query(
        `INSERT INTO public.personal_config (key, data, updated_at, updated_by)
         VALUES ('main_config', $1, NOW(), 'admin')
         ON CONFLICT (key) DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(config)]
      );
      pgSuccess = true;
    } catch (pgErr) {
      console.warn("Postgres writeConfig warning:", pgErr);
    }
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("personal_config").upsert({
      key: "main_config",
      data: config,
      updated_at: new Date().toISOString(),
      updated_by: "admin",
    });
    if (!error) supaSuccess = true;
  } catch (supaErr) {
    console.warn("Supabase writeConfig warning:", supaErr);
  }

  if (inWorkers && !supaSuccess) {
    try {
      await query(
        `INSERT INTO public.personal_config (key, data, updated_at, updated_by)
         VALUES ('main_config', $1, NOW(), 'admin')
         ON CONFLICT (key) DO UPDATE SET
           data = EXCLUDED.data,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(config)]
      );
      pgSuccess = true;
    } catch {}
  }

  const localSuccess = await writeConfigLocal(config);
  return pgSuccess || supaSuccess || localSuccess;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(
    {
      success: true,
      overrides: config.overrides,
      aliases: config.aliases,
      technicianOverrides: config.technicianOverrides || {},
      technicianAliases: config.technicianAliases || {},
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      overrides = {},
      aliases = {},
      technicianOverrides = {},
      technicianAliases = {},
    } = body;

    const saved = await writeConfig({
      overrides,
      aliases,
      technicianOverrides,
      technicianAliases,
    });

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Error al guardar la configuración en la base de datos" },
        { status: 500 }
      );
    }

    // Sincronizar estado en public.asesores_config para que el planificador y reportes reflejen cambios al instante
    try {
      if (overrides && typeof overrides === "object") {
        const supabase = await createClient();
        for (const [name, val] of Object.entries(overrides as Record<string, any>)) {
          if (!name || !name.trim()) continue;
          const isEx = val?.status === "ex" || val?.isExCollaborator === true;
          const cleanName = name.trim();
          await supabase
            .from("asesores_config")
            .update({ activo: !isEx, updated_at: new Date().toISOString() })
            .ilike("nombre", cleanName);

          if (!isCloudflareWorkers()) {
            await query(
              `UPDATE public.asesores_config 
               SET activo = $1, updated_at = NOW() 
               WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($2))`,
              [!isEx, cleanName]
            );
          }
        }
      }
    } catch (syncErr) {
      console.warn("Could not sync asesores_config:", syncErr);
    }

    // Invalidar caché en memoria del servicio de planificación
    try {
      clearPlanningMetadataCache();
    } catch (cacheErr) {}

    return NextResponse.json(
      {
        success: true,
        message: "Configuración integral de personal guardada exitosamente en PostgreSQL",
        overrides,
        aliases,
        technicianOverrides,
        technicianAliases,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in POST /api/advisors/config:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error procesando solicitud" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await writeConfig({ overrides: {}, aliases: {} });
    return NextResponse.json({
      success: true,
      message: "Configuración restablecida a valores por defecto",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
