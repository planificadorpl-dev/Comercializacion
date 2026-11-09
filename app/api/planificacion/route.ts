import { NextResponse } from "next/server";
import {
  getPlanningMetadata,
  getPlanningSheetRecords,
  appendPlanningRecords,
  updatePlanningRecord,
  batchUpdatePlanningRecords,
  deletePlanningRecord,
  NewPlanningItem,
} from "@/lib/planificacion-service";
import { clearSheetsCache } from "@/app/api/sheets/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const [metadata, records] = await Promise.all([
      getPlanningMetadata(forceRefresh),
      getPlanningSheetRecords().catch((err) => {
        console.error("Error cargando registros de hoja Data:", err.message);
        return [];
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        metadata,
        records,
        total: records.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/planificacion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al obtener la planificación",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: NewPlanningItem[] = Array.isArray(body)
      ? body
      : body.items && Array.isArray(body.items)
      ? body.items
      : [body];

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron items para planificar." },
        { status: 400 }
      );
    }

    // Validate essential fields
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.fecha) {
        return NextResponse.json(
          { success: false, error: `El item ${i + 1} no tiene fecha definida.` },
          { status: 400 }
        );
      }
      if (!it.asesor) {
        return NextResponse.json(
          { success: false, error: `El item ${i + 1} no tiene asesor asignado.` },
          { status: 400 }
        );
      }
      if (!it.sector) {
        return NextResponse.json(
          { success: false, error: `El item ${i + 1} no tiene sector asignado.` },
          { status: 400 }
        );
      }
    }

    const result = await appendPlanningRecords(items);

    // Invalidate sheets cache so visualizers display fresh data immediately
    try {
      clearSheetsCache();
    } catch (_) {}

    return NextResponse.json({
      success: true,
      insertedCount: result.insertedCount,
      message: result.message,
    });
  } catch (error: any) {
    console.error("POST /api/planificacion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al guardar la planificación en Google Sheets",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    // Check for batch updates
    const updates = Array.isArray(body)
      ? body
      : body.updates && Array.isArray(body.updates)
      ? body.updates
      : body.items && Array.isArray(body.items)
      ? body.items
      : null;

    if (updates && updates.length > 0) {
      const result = await batchUpdatePlanningRecords(updates);
      try {
        clearSheetsCache();
      } catch (_) {}
      return NextResponse.json({
        success: true,
        updatedCount: result.updatedCount,
        message: result.message,
      });
    }

    const { sheetRowIndex, item } = body;

    if (!sheetRowIndex || !item) {
      return NextResponse.json(
        { success: false, error: "Se requiere sheetRowIndex e item para actualizar." },
        { status: 400 }
      );
    }

    const result = await updatePlanningRecord(sheetRowIndex, item);

    try {
      clearSheetsCache();
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("PUT /api/planificacion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al actualizar la planificación",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const sheetRowIndexStr = searchParams.get("sheetRowIndex");
    const sheetRowIndex = sheetRowIndexStr ? parseInt(sheetRowIndexStr, 10) : undefined;
    const fecha = searchParams.get("fecha") || undefined;
    const asesor = searchParams.get("asesor") || undefined;

    if (!id && !fecha && (!sheetRowIndex || sheetRowIndex < 2)) {
      return NextResponse.json(
        { success: false, error: "Se requiere id, fecha+asesor o índice de fila para eliminar." },
        { status: 400 }
      );
    }

    const result = await deletePlanningRecord({
      id: id || undefined,
      sheetRowIndex,
      fecha,
      asesor,
    });

    try {
      clearSheetsCache();
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("DELETE /api/planificacion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al eliminar la jornada",
      },
      { status: 500 }
    );
  }
}

