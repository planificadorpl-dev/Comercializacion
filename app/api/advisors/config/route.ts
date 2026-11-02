import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { query, queryRow } from "@/lib/db";
import {
  AdvisorOverridesMap,
  TechnicianOverridesMap,
} from "@/lib/normalization";

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
  if (process.env.VERCEL) return true;
  try {
    await ensureConfigDirectory();
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing local advisor config:", err);
    return false;
  }
}

async function readConfig(): Promise<StoredConfig> {
  // 1. Try Native PostgreSQL First
  try {
    const row = await queryRow<{ data: any }>(
      "SELECT data FROM public.personal_config WHERE key = 'main_config' LIMIT 1"
    );
    if (row && row.data) {
      const parsed = row.data;
      const config: StoredConfig = {
        overrides: parsed.overrides || {},
        aliases: parsed.aliases || {},
        technicianOverrides: parsed.technicianOverrides || {},
        technicianAliases: parsed.technicianAliases || {},
      };
      // Keep local file in sync
      writeConfigLocal(config).catch(() => {});
      return config;
    }
  } catch (pgErr) {}

  // 2. Fallback to local
  return readConfigLocal();
}

async function writeConfig(config: StoredConfig): Promise<boolean> {
  let pgSuccess = false;
  // 1. PostgreSQL
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

  // 2. Local mirror
  const localSuccess = await writeConfigLocal(config);
  return pgSuccess || localSuccess;
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
