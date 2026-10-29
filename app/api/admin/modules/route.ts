import { NextResponse } from "next/server";
import { fetchAllModules, persistModuleStatus } from "@/lib/modules-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetchAllModules();
    return NextResponse.json(res, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener módulos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { moduleId, enabledForUsers, updatedBy } = body;

    if (!moduleId || typeof enabledForUsers !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Datos incompletos (moduleId y enabledForUsers son requeridos)" },
        { status: 400 }
      );
    }

    const res = await persistModuleStatus(moduleId, enabledForUsers, updatedBy);
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al actualizar módulo" },
      { status: 500 }
    );
  }
}
