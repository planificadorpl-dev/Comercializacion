import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { query, transaction } from "@/lib/db";

const ADMIN_DATA_PATH = path.join(process.cwd(), "data", "admin-entities.json");

export interface DepartamentoEntity {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  responsable?: string;
}

export interface SedeTaquillaEntity {
  id: string;
  nombre: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  activo: boolean;
}

export interface CanalComercialEntity {
  id: string;
  nombre: string;
  tipo?: string;
  descripcion?: string;
  comisionPct?: number;
  activo: boolean;
}

export interface AdminEntitiesData {
  departamentos: DepartamentoEntity[];
  sedesTaquilla: SedeTaquillaEntity[];
  canalesComerciales: CanalComercialEntity[];
}

const DEFAULT_DATA: AdminEntitiesData = {
  departamentos: [
    {
      id: "ventas",
      nombre: "Ventas",
      descripcion: "Gestión comercial, asesores de campo y prospección",
      color: "emerald",
    },
    {
      id: "tecnico",
      nombre: "Técnico / Operaciones",
      descripcion: "Instalaciones, cuadrillas de soporte y mantenimiento de fibra",
      color: "sky",
    },
    {
      id: "administracion",
      nombre: "Administración",
      descripcion: "Gestión financiera, facturación, recursos y soporte interno",
      color: "purple",
    },
    {
      id: "atencion_cliente",
      nombre: "Atención al Cliente / Soporte",
      descripcion: "Recepción de solicitudes, taquillas presenciales y call center",
      color: "amber",
    },
  ],
  sedesTaquilla: [
    {
      id: "valle",
      nombre: "Valle",
      direccion: "Av. Intercomunal de El Valle, Centro Comercial",
      ciudad: "Caracas",
      telefono: "+58 212-0000001",
      activo: true,
    },
    {
      id: "independencia",
      nombre: "Independencia",
      direccion: "Av. Independencia, Edif. Torre Central",
      ciudad: "Caracas",
      telefono: "+58 212-0000002",
      activo: true,
    },
  ],
  canalesComerciales: [
    {
      id: "ventas-calle",
      nombre: "Ventas de Calle (Comercial)",
      tipo: "comercial",
      descripcion: "Fuerza de ventas externa, puerta a puerta y eventos zonales",
      comisionPct: 5.0,
      activo: true,
    },
  ],
};

async function readAdminDataLocal(): Promise<AdminEntitiesData> {
  try {
    const data = await fs.readFile(ADMIN_DATA_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return {
      departamentos: parsed.departamentos || DEFAULT_DATA.departamentos,
      sedesTaquilla: parsed.sedesTaquilla || DEFAULT_DATA.sedesTaquilla,
      canalesComerciales: parsed.canalesComerciales || DEFAULT_DATA.canalesComerciales,
    };
  } catch (err: any) {
    return DEFAULT_DATA;
  }
}

async function writeAdminDataLocal(data: AdminEntitiesData): Promise<boolean> {
  if (process.env.VERCEL) return true;
  try {
    await fs.writeFile(ADMIN_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing local admin data:", err);
    return false;
  }
}

async function readAdminData(): Promise<AdminEntitiesData> {
  // 1. Try Native PostgreSQL First
  try {
    const [depRows, sedRows, canRows] = await Promise.all([
      query<any>("SELECT id, nombre, descripcion, color, responsable FROM public.departamentos ORDER BY orden ASC, nombre ASC"),
      query<any>("SELECT id, nombre, direccion, ciudad, telefono, activo FROM public.sedes_taquilla ORDER BY nombre ASC"),
      query<any>("SELECT id, nombre, tipo, descripcion, comision_pct as \"comisionPct\", activo FROM public.canales_comerciales ORDER BY nombre ASC"),
    ]);

    if (depRows.length > 0 || sedRows.length > 0 || canRows.length > 0) {
      const res: AdminEntitiesData = {
        departamentos: depRows.map((d) => ({
          id: d.id,
          nombre: d.nombre,
          descripcion: d.descripcion || "",
          color: d.color || "emerald",
          responsable: d.responsable || "",
        })),
        sedesTaquilla: sedRows.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          direccion: s.direccion || "",
          ciudad: s.ciudad || "Caracas",
          telefono: s.telefono || "",
          activo: s.activo !== false,
        })),
        canalesComerciales: canRows.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo || "comercial",
          descripcion: c.descripcion || "",
          comisionPct: parseFloat(c.comisionPct || 0),
          activo: c.activo !== false,
        })),
      };
      // Keep local file synced
      writeAdminDataLocal(res).catch(() => {});
      return res;
    }
  } catch (pgErr) {}

  // 2. Fallback to local
  return readAdminDataLocal();
}

async function writeAdminData(data: AdminEntitiesData): Promise<boolean> {
  let pgSuccess = false;
  // 1. PostgreSQL transaction
  try {
    await transaction(async (client) => {
      // Departamentos
      await client.query("DELETE FROM public.departamentos");
      for (let i = 0; i < data.departamentos.length; i++) {
        const d = data.departamentos[i];
        await client.query(
          "INSERT INTO public.departamentos (id, nombre, descripcion, color, responsable, orden) VALUES ($1, $2, $3, $4, $5, $6)",
          [d.id, d.nombre, d.descripcion || null, d.color || null, d.responsable || null, i]
        );
      }

      // Sedes Taquilla
      await client.query("DELETE FROM public.sedes_taquilla");
      for (const s of data.sedesTaquilla) {
        await client.query(
          "INSERT INTO public.sedes_taquilla (id, nombre, direccion, ciudad, telefono, activo) VALUES ($1, $2, $3, $4, $5, $6)",
          [s.id, s.nombre, s.direccion || null, s.ciudad || null, s.telefono || null, s.activo !== false]
        );
      }

      // Canales Comerciales
      await client.query("DELETE FROM public.canales_comerciales");
      for (const c of data.canalesComerciales) {
        await client.query(
          "INSERT INTO public.canales_comerciales (id, nombre, tipo, descripcion, comision_pct, activo) VALUES ($1, $2, $3, $4, $5, $6)",
          [c.id, c.nombre, c.tipo || null, c.descripcion || null, c.comisionPct || 0, c.activo !== false]
        );
      }
    });
    pgSuccess = true;
  } catch (pgErr) {
    console.warn("Postgres writeAdminData warning:", pgErr);
  }

  // 2. Local mirror
  const localSuccess = await writeAdminDataLocal(data);
  return pgSuccess || localSuccess;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = await readAdminData();
  return NextResponse.json(
    { success: true, data },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, entity, item, id } = body;

    const current = await readAdminData();

    if (action === "create") {
      if (entity === "departamento") {
        if (!item.nombre || !item.nombre.trim()) {
          return NextResponse.json({ success: false, error: "El nombre del departamento es requerido" }, { status: 400 });
        }
        const newId = item.id || item.nombre.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString().slice(-4);
        current.departamentos.push({
          id: newId,
          nombre: item.nombre.trim(),
          descripcion: item.descripcion?.trim() || "",
          color: item.color || "emerald",
          responsable: item.responsable?.trim() || "",
        });
      } else if (entity === "sede") {
        if (!item.nombre || !item.nombre.trim()) {
          return NextResponse.json({ success: false, error: "El nombre de la sede es requerido" }, { status: 400 });
        }
        const newId = item.id || item.nombre.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4);
        current.sedesTaquilla.push({
          id: newId,
          nombre: item.nombre.trim(),
          direccion: item.direccion?.trim() || "",
          ciudad: item.ciudad?.trim() || "Caracas",
          telefono: item.telefono?.trim() || "",
          activo: item.activo !== false,
        });
      } else if (entity === "canal") {
        if (!item.nombre || !item.nombre.trim()) {
          return NextResponse.json({ success: false, error: "El nombre del canal es requerido" }, { status: 400 });
        }
        const newId = item.id || item.nombre.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4);
        current.canalesComerciales.push({
          id: newId,
          nombre: item.nombre.trim(),
          tipo: item.tipo?.trim() || "comercial",
          descripcion: item.descripcion?.trim() || "",
          comisionPct: Number(item.comisionPct) || 0,
          activo: item.activo !== false,
        });
      } else {
        return NextResponse.json({ success: false, error: "Entidad inválida" }, { status: 400 });
      }
    } else if (action === "update") {
      if (entity === "departamento") {
        const idx = current.departamentos.findIndex((d) => d.id === id);
        if (idx !== -1) current.departamentos[idx] = { ...current.departamentos[idx], ...item };
      } else if (entity === "sede") {
        const idx = current.sedesTaquilla.findIndex((s) => s.id === id);
        if (idx !== -1) current.sedesTaquilla[idx] = { ...current.sedesTaquilla[idx], ...item };
      } else if (entity === "canal") {
        const idx = current.canalesComerciales.findIndex((c) => c.id === id);
        if (idx !== -1) current.canalesComerciales[idx] = { ...current.canalesComerciales[idx], ...item };
      }
    } else if (action === "delete") {
      if (entity === "departamento") {
        current.departamentos = current.departamentos.filter((d) => d.id !== id);
      } else if (entity === "sede") {
        current.sedesTaquilla = current.sedesTaquilla.filter((s) => s.id !== id);
      } else if (entity === "canal") {
        current.canalesComerciales = current.canalesComerciales.filter((c) => c.id !== id);
      }
    } else if (action === "saveAll") {
      if (body.data) {
        current.departamentos = body.data.departamentos || current.departamentos;
        current.sedesTaquilla = body.data.sedesTaquilla || current.sedesTaquilla;
        current.canalesComerciales = body.data.canalesComerciales || current.canalesComerciales;
      }
    }

    const saved = await writeAdminData(current);
    if (!saved) {
      return NextResponse.json({ success: false, error: "Error al guardar cambios en la base de datos" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Operación completada exitosamente en PostgreSQL",
      data: current,
    });
  } catch (error: any) {
    console.error("Error in POST /api/admin/entities:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error procesando solicitud" },
      { status: 500 }
    );
  }
}
