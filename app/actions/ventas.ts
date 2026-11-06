"use server";

import { query, queryRow } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getSheetsClient } from "@/app/lib/googleAuth";
import { geoHierarchy as fallbackGeoHierarchy } from "@/lib/geo_hierarchy";
import { formatProperCase } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────────

function getVenezuelaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

const DEFAULT_REAL_PLANES = [
  { id: 11, nombre: "400MB", tipo: "Domiciliario", activo: true, has_tv: false },
  { id: 15, nombre: "600MB", tipo: "Domiciliario", activo: true, has_tv: true },
  { id: 21, nombre: "800 MB", tipo: "Domiciliario", activo: true, has_tv: true },
  { id: 16, nombre: "1GB", tipo: "Domiciliario", activo: true, has_tv: true },
  { id: 22, nombre: "400 MB", tipo: "Empresarial", activo: true, has_tv: false },
  { id: 26, nombre: "600 MB", tipo: "Empresarial", activo: true, has_tv: false },
  { id: 25, nombre: "800 MB", tipo: "Empresarial", activo: true, has_tv: false },
  { id: 27, nombre: "1 GB", tipo: "Empresarial", activo: true, has_tv: false },
];

// ── Config Loaders ──────────────────────────────────────────────

export async function getVentasConfig() {
  // 1. Try Native PostgreSQL First
  try {
    const [geodataRows, planesRows] = await Promise.all([
      query<any>("SELECT * FROM public.geodata_config ORDER BY estado, municipio, parroquia, sector"),
      query<any>("SELECT * FROM public.planes_config ORDER BY tipo, nombre"),
    ]);

    if (geodataRows && geodataRows.length > 0) {
      const geoHierarchy: Record<string, Record<string, Record<string, string[]>>> = {};
      geodataRows.forEach((row: any) => {
        const e = row.estado || "N/A";
        const m = row.municipio || "N/A";
        const p = row.parroquia || "N/A";
        const s = row.sector || "N/A";
        if (!geoHierarchy[e]) geoHierarchy[e] = {};
        if (!geoHierarchy[e][m]) geoHierarchy[e][m] = {};
        if (!geoHierarchy[e][m][p]) geoHierarchy[e][m][p] = [];
        if (!geoHierarchy[e][m][p].includes(s)) {
          geoHierarchy[e][m][p].push(s);
        }
      });

      return {
        geoHierarchy,
        planes: planesRows.length > 0 ? planesRows : DEFAULT_REAL_PLANES,
      };
    }
  } catch (pgErr) {
    // Fallback if Postgres query fails
  }

  // 2. Try Supabase fallback
  try {
    const supabase = await createClient();
    const [geodataRes, planesRes] = await Promise.all([
      supabase
        .from("geodata_config")
        .select("*")
        .order("estado")
        .order("municipio")
        .order("parroquia")
        .order("sector"),
      supabase.from("planes_config").select("*").order("tipo").order("nombre"),
    ]);

    const geoHierarchy: Record<string, Record<string, Record<string, string[]>>> = {};

    if (geodataRes.data && geodataRes.data.length > 0) {
      geodataRes.data.forEach((row: any) => {
        const e = row.estado || "N/A";
        const m = row.municipio || "N/A";
        const p = row.parroquia || "N/A";
        const s = row.sector || "N/A";
        if (!geoHierarchy[e]) geoHierarchy[e] = {};
        if (!geoHierarchy[e][m]) geoHierarchy[e][m] = {};
        if (!geoHierarchy[e][m][p]) geoHierarchy[e][m][p] = [];
        if (!geoHierarchy[e][m][p].includes(s)) {
          geoHierarchy[e][m][p].push(s);
        }
      });
    }

    return {
      geoHierarchy: Object.keys(geoHierarchy).length > 0 ? geoHierarchy : fallbackGeoHierarchy,
      planes: (planesRes.data && planesRes.data.length > 0) ? planesRes.data : DEFAULT_REAL_PLANES,
    };
  } catch (err: any) {
    console.warn("Error fetching ventas config, using fallbacks:", err.message);
    return {
      geoHierarchy: fallbackGeoHierarchy,
      planes: DEFAULT_REAL_PLANES,
    };
  }
}

// ── Geodata CRUD (Admin) ──────────────────────────────────────────

export async function addGeodata(row: { estado: string; municipio: string; parroquia: string; sector?: string }) {
  // 1. PostgreSQL
  try {
    await query(
      `INSERT INTO public.geodata_config (estado, municipio, parroquia, sector)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (estado, municipio, parroquia, sector) DO NOTHING`,
      [row.estado.trim(), row.municipio.trim(), row.parroquia.trim(), (row.sector || "General").trim()]
    );
  } catch (pgErr) {
    console.warn("Postgres addGeodata:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("geodata_config").insert([row]);
  } catch {}

  revalidatePath("/admin");
}

export async function deleteGeodata(id: number | string) {
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.geodata_config WHERE id = $1", [id]);
  } catch (pgErr) {
    console.warn("Postgres deleteGeodata:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("geodata_config").delete().eq("id", id);
  } catch {}

  revalidatePath("/admin");
}

export async function syncGeodataFromSheets(): Promise<{
  success: boolean;
  importedCount: number;
  totalFound: number;
  message: string;
}> {
  try {
    const sheets = await getSheetsClient();

    // 1. Obtener registros actuales en PostgreSQL
    let existingSet = new Set<string>();
    try {
      const rows = await query<any>("SELECT estado, municipio, parroquia, sector FROM public.geodata_config");
      rows.forEach((r) => {
        existingSet.add(
          `${(r.estado || "").trim().toLowerCase()}|${(r.municipio || "").trim().toLowerCase()}|${(r.parroquia || "").trim().toLowerCase()}|${(r.sector || "").trim().toLowerCase()}`
        );
      });
    } catch {
      // Supabase fallback
      const supabase = await createClient();
      const { data: existingRows } = await supabase
        .from("geodata_config")
        .select("estado, municipio, parroquia, sector");
      (existingRows || []).forEach((r) => {
        existingSet.add(
          `${(r.estado || "").trim().toLowerCase()}|${(r.municipio || "").trim().toLowerCase()}|${(r.parroquia || "").trim().toLowerCase()}|${(r.sector || "").trim().toLowerCase()}`
        );
      });
    }

    // 2. Leer hoja de Planificación
    const planSpreadsheetId = "1_PzDJLZ8jnPTZq9PgQMLfomwBwles8XOd8RD5Ksko2Y";
    const planRes = await sheets.spreadsheets.values.get({
      spreadsheetId: planSpreadsheetId,
      range: "Data!A:G",
    });

    const rows = planRes.data.values || [];
    if (rows.length < 2) {
      return {
        success: true,
        importedCount: 0,
        totalFound: 0,
        message: "No se encontraron filas de sectores en la hoja de planificación.",
      };
    }

    const header = rows[0].map((h: string) => (h || "").trim().toLowerCase());
    const estIdx = header.findIndex((h: string) => h.includes("estado"));
    const munIdx = header.findIndex((h: string) => h.includes("municipio") || h.includes("oficina"));
    const parIdx = header.findIndex((h: string) => h.includes("parroquia"));
    const secIdx = header.findIndex((h: string) => h.includes("sector"));

    const newRowsToInsert: Array<{ estado: string; municipio: string; parroquia: string; sector: string }> = [];
    const pendingSet = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sector = secIdx !== -1 && row[secIdx] ? String(row[secIdx]).trim() : "";
      if (!sector || sector.toUpperCase() === "N/A" || sector.toUpperCase() === "SECTOR") continue;

      const estado = estIdx !== -1 && row[estIdx] ? String(row[estIdx]).trim() : "Miranda";
      const municipio = munIdx !== -1 && row[munIdx] ? String(row[munIdx]).trim() : "General";
      const parroquia = parIdx !== -1 && row[parIdx] ? String(row[parIdx]).trim() : "General";

      const dedupeKey = `${estado.toLowerCase()}|${municipio.toLowerCase()}|${parroquia.toLowerCase()}|${sector.toLowerCase()}`;
      if (!existingSet.has(dedupeKey) && !pendingSet.has(dedupeKey)) {
        pendingSet.add(dedupeKey);
        newRowsToInsert.push({
          estado: formatProperCase(estado),
          municipio: formatProperCase(municipio),
          parroquia: formatProperCase(parroquia),
          sector: formatProperCase(sector),
        });
      }
    }

    // 3. Inserción en PostgreSQL
    let insertedCount = 0;
    for (const item of newRowsToInsert) {
      try {
        await query(
          `INSERT INTO public.geodata_config (estado, municipio, parroquia, sector)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (estado, municipio, parroquia, sector) DO NOTHING`,
          [item.estado, item.municipio, item.parroquia, item.sector]
        );
        insertedCount++;
      } catch (err) {
        // Fallback or ignore
      }
    }

    revalidatePath("/admin/geodata");
    return {
      success: true,
      importedCount: insertedCount,
      totalFound: rows.length - 1,
      message:
        insertedCount > 0
          ? `Se importaron ${insertedCount} sectores nuevos en PostgreSQL.`
          : "Todos los sectores de Google Sheets ya están sincronizados en PostgreSQL.",
    };
  } catch (error: any) {
    console.error("Error en syncGeodataFromSheets:", error);
    return {
      success: false,
      importedCount: 0,
      totalFound: 0,
      message: error.message || "Error al sincronizar con Google Sheets.",
    };
  }
}

// ── Planes CRUD (Admin) ───────────────────────────────────────────

let cachedPlanes: { data: any[]; timestamp: number } | null = null;
const PLANES_CACHE_TTL = 10 * 60 * 1000;

export async function getPlanes() {
  const now = Date.now();
  if (cachedPlanes && now - cachedPlanes.timestamp < PLANES_CACHE_TTL) {
    return cachedPlanes.data;
  }

  // 1. PostgreSQL
  try {
    const rows = await query("SELECT * FROM public.planes_config ORDER BY tipo, nombre");
    if (rows && rows.length > 0) {
      cachedPlanes = { data: rows, timestamp: now };
      return rows;
    }
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("planes_config")
      .select("*")
      .order("tipo")
      .order("nombre");
    if (!error && data) {
      cachedPlanes = { data, timestamp: now };
      return data;
    }
  } catch (err: any) {}

  return cachedPlanes ? cachedPlanes.data : [];
}

export async function addPlan(plan: { nombre: string; tipo: string; activo: boolean; has_tv: boolean }) {
  cachedPlanes = null;
  // 1. PostgreSQL
  try {
    await query(
      `INSERT INTO public.planes_config (nombre, tipo, activo, has_tv)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nombre) DO UPDATE SET
         tipo = EXCLUDED.tipo,
         activo = EXCLUDED.activo,
         has_tv = EXCLUDED.has_tv`,
      [plan.nombre.trim(), plan.tipo, plan.activo, plan.has_tv]
    );
  } catch (pgErr) {
    console.warn("Postgres addPlan:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("planes_config").insert([plan]);
  } catch {}

  revalidatePath("/admin");
}

export async function updatePlan(id: number, plan: { nombre?: string; tipo?: string; activo?: boolean; has_tv?: boolean }) {
  cachedPlanes = null;
  // 1. PostgreSQL
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (plan.nombre !== undefined) {
      fields.push(`nombre = $${idx++}`);
      values.push(plan.nombre.trim());
    }
    if (plan.tipo !== undefined) {
      fields.push(`tipo = $${idx++}`);
      values.push(plan.tipo);
    }
    if (plan.activo !== undefined) {
      fields.push(`activo = $${idx++}`);
      values.push(plan.activo);
    }
    if (plan.has_tv !== undefined) {
      fields.push(`has_tv = $${idx++}`);
      values.push(plan.has_tv);
    }

    if (fields.length > 0) {
      values.push(id);
      await query(`UPDATE public.planes_config SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    }
  } catch (pgErr) {
    console.warn("Postgres updatePlan:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("planes_config").update(plan).eq("id", id);
  } catch {}

  revalidatePath("/admin");
}

export async function deletePlan(id: number) {
  cachedPlanes = null;
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.planes_config WHERE id = $1", [id]);
  } catch (pgErr) {
    console.warn("Postgres deletePlan:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("planes_config").delete().eq("id", id);
  } catch {}

  revalidatePath("/admin");
}

// ── Actividades ──────────────────────────────────────────────────

export async function getActividades(asesor?: string, fecha?: string, cerrada?: boolean) {
  // 1. PostgreSQL
  try {
    let sql = "SELECT * FROM public.actividades WHERE 1=1";
    const params: any[] = [];
    let idx = 1;

    if (asesor) {
      sql += ` AND asesor = $${idx++}`;
      params.push(asesor);
    }
    if (fecha) {
      sql += ` AND fecha = $${idx++}`;
      params.push(fecha);
    }
    if (cerrada !== undefined) {
      sql += ` AND cerrada = $${idx++}`;
      params.push(cerrada);
    }

    sql += " ORDER BY created_at DESC LIMIT 100";
    const rows = await query(sql, params);
    if (rows && rows.length > 0) return rows;
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    let querySup = supabase
      .from("actividades")
      .select("*")
      .order("created_at", { ascending: false });

    if (asesor) querySup = querySup.eq("asesor", asesor);
    if (fecha) querySup = querySup.eq("fecha", fecha);
    if (cerrada !== undefined) querySup = querySup.eq("cerrada", cerrada);

    const { data, error } = await querySup.limit(100);
    if (!error) return data || [];
  } catch (err: any) {
    console.warn("Error fetching actividades:", err.message);
  }
  return [];
}

export async function saveActividad(activity: {
  fecha: string;
  hora: string;
  asesor: string;
  tipo: string;
  clientes_captados?: number;
  volantes?: number;
  llamadas_info?: number;
  llamadas_agenda?: number;
  estado: string;
  municipio: string;
  parroquia: string;
  sector?: string;
  condominio?: string;
  notas?: string;
}) {
  // 1. PostgreSQL
  try {
    const row = await queryRow(
      `INSERT INTO public.actividades (
         fecha, hora, asesor, tipo, clientes_captados, volantes,
         llamadas_info, llamadas_agenda, estado, municipio, parroquia,
         sector, condominio, notas, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       RETURNING *`,
      [
        activity.fecha,
        activity.hora,
        activity.asesor,
        activity.tipo,
        activity.clientes_captados || 0,
        activity.volantes || 0,
        activity.llamadas_info || 0,
        activity.llamadas_agenda || 0,
        activity.estado,
        activity.municipio,
        activity.parroquia,
        activity.sector || null,
        activity.condominio || null,
        activity.notas || null,
      ]
    );
    if (row) return row;
  } catch (pgErr) {
    console.warn("Postgres saveActividad:", pgErr);
  }

  // 2. Supabase fallback
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actividades")
    .insert([activity])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteActividad(id: number | string) {
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.actividades WHERE id = $1", [id]);
  } catch (pgErr) {
    console.warn("Postgres deleteActividad:", pgErr);
  }

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("actividades").delete().eq("id", id);
  } catch {}
}

// ── Solicitudes ──────────────────────────────────────────────────

export async function getSolicitudes(filters?: {
  promotor?: string;
  desde?: string;
  hasta?: string;
  search?: string;
}) {
  // 1. PostgreSQL
  try {
    let sql = "SELECT * FROM public.solicitudes WHERE 1=1";
    const params: any[] = [];
    let idx = 1;

    if (filters?.promotor) {
      sql += ` AND promotor = $${idx++}`;
      params.push(filters.promotor);
    }
    if (filters?.desde) {
      sql += ` AND fecha_solicitud >= $${idx++}`;
      params.push(filters.desde);
    }
    if (filters?.hasta) {
      sql += ` AND fecha_solicitud <= $${idx++}`;
      params.push(filters.hasta + " 23:59:59");
    }
    if (filters?.search) {
      sql += ` AND (nombres ILIKE $${idx} OR apellidos ILIKE $${idx} OR cedula ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }

    sql += " ORDER BY fecha_solicitud DESC LIMIT 200";
    const rows = await query(sql, params);
    if (rows && rows.length > 0) return rows;
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    let querySup = supabase
      .from("solicitudes")
      .select("*")
      .order("fecha_solicitud", { ascending: false });

    if (filters?.promotor) querySup = querySup.eq("promotor", filters.promotor);
    if (filters?.desde) querySup = querySup.gte("fecha_solicitud", filters.desde);
    if (filters?.hasta) querySup = querySup.lte("fecha_solicitud", filters.hasta + "T23:59:59");
    if (filters?.search) {
      querySup = querySup.or(
        `nombres.ilike.%${filters.search}%,apellidos.ilike.%${filters.search}%,cedula.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await querySup.limit(200);
    if (!error) return data || [];
  } catch (err: any) {
    console.warn("Error fetching solicitudes:", err.message);
  }

  return [];
}

export async function saveSolicitud(solicitud: any) {
  // 1. PostgreSQL
  try {
    const row = await queryRow(
      `INSERT INTO public.solicitudes (
         fecha_solicitud, promotor, fuente, nombres, apellidos, cedula,
         telefono, plan, estado, municipio, parroquia, sector, estatus,
         tipo_operacion, power_go, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       RETURNING *`,
      [
        solicitud.fecha_solicitud || new Date().toISOString(),
        solicitud.promotor || null,
        solicitud.fuente || null,
        solicitud.nombres || null,
        solicitud.apellidos || null,
        solicitud.cedula || null,
        solicitud.telefono || null,
        solicitud.plan || null,
        solicitud.estado || null,
        solicitud.municipio || null,
        solicitud.parroquia || null,
        solicitud.sector || null,
        solicitud.estatus || "Pendiente",
        solicitud.tipo_operacion || "Instalación",
        solicitud.power_go || "NO",
      ]
    );
    if (row) return row;
  } catch (pgErr) {
    console.warn("Postgres saveSolicitud:", pgErr);
  }

  // 2. Supabase fallback
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .insert([solicitud])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSolicitud(id: string | number) {
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.solicitudes WHERE id = $1", [id]);
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("solicitudes").delete().eq("id", id);
  } catch {}
}

export async function cerrarJornada(asesor: string, fecha: string) {
  // 1. PostgreSQL
  try {
    const res = await query(
      "UPDATE public.actividades SET cerrada = true WHERE asesor = $1 AND fecha = $2 AND cerrada = false RETURNING id",
      [asesor, fecha]
    );
    return { cerradas: res.length };
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("actividades")
      .update({ cerrada: true })
      .eq("asesor", asesor)
      .eq("fecha", fecha)
      .eq("cerrada", false)
      .select("id");

    if (!error) return { cerradas: data?.length || 0 };
  } catch {}

  return { cerradas: 0 };
}
