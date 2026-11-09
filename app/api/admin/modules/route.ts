import { NextResponse } from "next/server";
import { fetchAllModules, persistModuleStatus, persistModuleRoles } from "@/lib/modules-service";
import { AppUserRole } from "@/lib/modules-types";

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
    const { moduleId, enabledForUsers, targetRoles, updatedBy } = body;

    if (!moduleId) {
      return NextResponse.json(
        { success: false, error: "moduleId es requerido" },
        { status: 400 }
      );
    }

    if (Array.isArray(targetRoles)) {
      const res = await persistModuleRoles(moduleId, targetRoles as AppUserRole[], updatedBy);
      return NextResponse.json(res);
    }

    if (typeof enabledForUsers === "boolean") {
      const res = await persistModuleStatus(moduleId, enabledForUsers, updatedBy);
      return NextResponse.json(res);
    }

    return NextResponse.json(
      { success: false, error: "Datos incompletos (se requiere enabledForUsers o targetRoles)" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/admin/modules error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al actualizar módulo" },
      { status: 500 }
    );
  }
}
