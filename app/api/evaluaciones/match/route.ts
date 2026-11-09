import { NextResponse } from "next/server";
import { getMatchDataset } from "@/lib/match-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const asesor = searchParams.get("asesor") || undefined;
    const evaluador = searchParams.get("evaluador") || undefined;
    const status = searchParams.get("status") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const search = searchParams.get("search") || undefined;

    const data = await getMatchDataset({
      asesor,
      evaluador,
      status,
      from,
      to,
      search,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("Error en GET /api/evaluaciones/match:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al procesar el match de actividades." },
      { status: 500 }
    );
  }
}

