import { NextRequest, NextResponse } from "next/server";
import { getFactibilidadBoxes } from "@/lib/ozmap-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const boxes = await getFactibilidadBoxes(forceRefresh);

    return NextResponse.json({
      success: true,
      total: boxes.length,
      naps: boxes.filter((b) => b.isNap).length,
      mangas: boxes.filter((b) => !b.isNap).length,
      data: boxes,
    });
  } catch (error: any) {
    console.error("Error en API de factibilidad OZmap:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Error al conectar con OZmap",
      },
      { status: 500 }
    );
  }
}

