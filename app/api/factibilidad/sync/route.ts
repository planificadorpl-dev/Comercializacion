import { NextRequest, NextResponse } from "next/server";
import { syncBoxesWithOzmap, getFastFactibilidadBoxes } from "@/lib/factibilidad-store";

export async function GET() {
  try {
    const boxes = await getFastFactibilidadBoxes(false);
    return NextResponse.json({
      success: true,
      total: boxes.length,
      naps: boxes.filter((b) => b.isNap).length,
      mangas: boxes.filter((b) => !b.isNap).length,
      message: "Cajas cargadas desde almacenamiento de alta velocidad",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Error al verificar estado de sincronización" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const start = Date.now();
    const result = await syncBoxesWithOzmap();
    const durationMs = Date.now() - start;

    return NextResponse.json({
      success: true,
      message: "Sincronización con OZmap completada exitosamente",
      total: result.total,
      savedInPostgres: result.savedInPostgres,
      syncedAt: result.syncedAt,
      durationMs,
    });
  } catch (err: any) {
    console.error("Error en sincronización con OZmap:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Error al sincronizar con OZmap" },
      { status: 500 }
    );
  }
}

