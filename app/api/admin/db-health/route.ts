import { NextResponse } from "next/server";
import { query, testConnection, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const isConfigured = isDatabaseConfigured();
  if (!isConfigured) {
    return NextResponse.json({
      status: "unconfigured",
      configured: false,
      message: "DATABASE_URL no está definida en las variables de entorno.",
    });
  }

  const connTest = await testConnection();
  if (!connTest.ok) {
    return NextResponse.json({
      status: "error",
      configured: true,
      ok: false,
      error: connTest.message,
    });
  }

  // Count rows in main tables
  const tables = [
    "usuarios",
    "configuracion_modulos",
    "asesores_config",
    "personal_config",
    "departamentos",
    "sedes_taquilla",
    "canales_comerciales",
    "evaluaciones",
    "actividades",
    "advisor_checklists",
    "solicitudes",
    "instalaciones",
    "geodata_config",
    "planes_config",
    "operadores_competencia",
  ];

  const tableCounts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const res = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM public.${table}`
      );
      tableCounts[table] = parseInt(res[0]?.count || "0", 10);
    } catch {
      tableCounts[table] = -1; // Indicates table does not exist or error
    }
  }

  return NextResponse.json({
    status: "healthy",
    configured: true,
    ok: true,
    message: "Conexión a PostgreSQL activa y operativa",
    version: connTest.version,
    connectedAt: connTest.connectedAt,
    counts: tableCounts,
  });
}
