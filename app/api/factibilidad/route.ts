import { NextRequest, NextResponse } from "next/server";
import { getFactibilidadBoxes, getFactibilidadBoxesInRadius } from "@/lib/ozmap-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const full = searchParams.get("full") === "true";
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const radiusStr = searchParams.get("radius");

    // Case 1: Point query by coordinates (Radius 1 km limit to protect company network)
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

      // Safe clamp radius between 100m and 1500m (default 1000m / 1 km)
      const clampedRadius = Math.min(Math.max(radius, 100), 1500);

      const result = await getFactibilidadBoxesInRadius(lat, lng, clampedRadius, forceRefresh);

      return NextResponse.json({
        success: true,
        mode: "radius",
        radiusMeters: clampedRadius,
        center: [lat, lng],
        total: result.totalInRadius,
        available: result.availableInRadius,
        data: result.boxes,
      });
    }

    // Case 2: Full network requested (Admin only mode)
    if (full) {
      const boxes = await getFactibilidadBoxes(forceRefresh);
      return NextResponse.json({
        success: true,
        mode: "full",
        total: boxes.length,
        naps: boxes.filter((b) => b.isNap).length,
        mangas: boxes.filter((b) => !b.isNap).length,
        data: boxes,
      });
    }

    // Case 3: Initial empty state (Protected: zero bulk network leak)
    return NextResponse.json({
      success: true,
      mode: "empty",
      total: 0,
      data: [],
      message: "Ingresa coordenadas para consultar factibilidad en un radio protegido de 1 km.",
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
