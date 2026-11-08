import { NextRequest, NextResponse } from "next/server";
import { getFactibilidadBoxes, getFactibilidadBoxesInRadius } from "@/lib/ozmap-service";
import { getCurrentSessionUser } from "@/app/actions/auth";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentSessionUser();
    const isCommercialAdvisor = sessionUser?.rol === "asesor";

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

      // For commercial advisors, strictly enforce 1 km max radius
      const maxAllowed = isCommercialAdvisor ? 1000 : 1500;
      const clampedRadius = Math.min(Math.max(radius, 100), maxAllowed);
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

    // Commercial advisors cannot download the full network infrastructure without coordinates
    if (isCommercialAdvisor) {
      return NextResponse.json(
        {
          success: true,
          mode: "asesor_restricted",
          total: 0,
          naps: 0,
          mangas: 0,
          data: [],
          message: "Consulta restringida a 1 km por punto para asesores comerciales.",
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // Default / Full: Return all network boxes (high speed database/cache for Admins / Supervisors)
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
