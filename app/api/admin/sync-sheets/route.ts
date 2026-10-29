import { NextResponse } from "next/server";
import { runSheetsSync } from "@/lib/sheets-sync-service";
import { query } from "@/lib/db";

/**
 * GET /api/admin/sync-sheets
 * Retorna el estado actual de las tablas sincronizadas con Google Sheets.
 */
export async function GET() {
  try {
    const instRes = await query("SELECT count(*) as total, max(created_at) as last_created FROM public.instalaciones");
    const solRes = await query("SELECT count(*) as total, max(created_at) as last_created FROM public.solicitudes");

    return NextResponse.json({
      success: true,
      tables: {
        instalaciones: {
          total: parseInt(instRes[0]?.total || "0", 10),
          lastEntry: instRes[0]?.last_created || null,
        },
        solicitudes: {
          total: parseInt(solRes[0]?.total || "0", 10),
          lastEntry: solRes[0]?.last_created || null,
        },
      },
      message: "Tablas activas y sincronizadas",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error consultando estado: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sync-sheets
 * Ejecuta la sincronización atómica desde Google Sheets hacia PostgreSQL.
 */
export async function POST() {
  try {
    const result = await runSheetsSync();
    return NextResponse.json({
      success: true,
      message: "Sincronización completada exitosamente",
      ...result,
    });
  } catch (error: any) {
    console.error("Error en POST /api/admin/sync-sheets:", error);
    return NextResponse.json(
      { error: `Error en la sincronización: ${error.message}` },
      { status: 500 }
    );
  }
}
