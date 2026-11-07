import { NextRequest, NextResponse } from "next/server";
import { getFactibilidadBoxes, getFactibilidadBoxesInRadius } from "@/lib/ozmap-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const radiusStr = searchParams.get("radius");

    // Case 1: Point query by coordinates (Radius 1 km limit)
    if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      const radius = radiusStr ? parseInt(radiusStr, 10) : 1000;

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          { success: false, error: "Coordenadas inválidas" },
          { status: 400 }
        );
      }

      const clampedRadius = Math.min(Math.max(radius, 100), 1500);
      const result = await getFactibilidadBoxesInRadius(lat, lng, clampedRadius, forceRefresh);

      return NextResponse.json(
        {
          success: true,
          mode: "radius",
          radiusMeters: clampedRadius,
          center: [lat, lng],
          total: result.totalInRadius,
          available: result.availableInRadius,
          data: result.boxes,
        },
        {
          headers: {
            "Cache-Control": forceRefresh
              ? "no-store"
              : "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Default / Full: Return all network boxes (high speed database/cache)
    const boxes = await getFactibilidadBoxes(forceRefresh);
    return NextResponse.json(
      {
        success: true,
        mode: "full",
        total: boxes.length,
        naps: boxes.filter((b) => b.isNap).length,
        mangas: boxes.filter((b) => !b.isNap).length,
        data: boxes,
      },
      {
        headers: {
          "Cache-Control": forceRefresh
            ? "no-store"
            : "public, max-age=120, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (error: any) {
    console.error("Error en API de factibilidad OZmap:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Error al consultar factibilidad",
      },
      { status: 500 }
    );
  }
}
