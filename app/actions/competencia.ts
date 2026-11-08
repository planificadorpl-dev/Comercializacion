"use server";

import { query, queryRow } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Operadores ─────────────────────────────────────────────────────

let cachedOperadores: { data: any[]; timestamp: number } | null = null;
const OPERADORES_CACHE_TTL = 10 * 60 * 1000;

export async function getOperadores() {
  const now = Date.now();
  if (cachedOperadores && now - cachedOperadores.timestamp < OPERADORES_CACHE_TTL) {
    return cachedOperadores.data;
  }

  // 1. PostgreSQL
  try {
    const rows = await query("SELECT * FROM public.operadores_competencia ORDER BY nombre ASC");
    if (rows && rows.length > 0) {
      cachedOperadores = { data: rows, timestamp: now };
      return rows;
    }
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("operadores_competencia")
      .select("*")
      .order("nombre", { ascending: true });

    if (!error && data) {
      cachedOperadores = { data, timestamp: now };
      return data;
    }
  } catch (err: any) {
    console.warn("getOperadores exception:", err.message);
  }

  return cachedOperadores ? cachedOperadores.data : [];
}

export async function saveOperador(nombre: string, color_hex: string, logo_url?: string) {
  cachedOperadores = null;
  // 1. PostgreSQL
  try {
    const row = await queryRow(
      `INSERT INTO public.operadores_competencia (nombre, color_hex, logo_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (nombre) DO UPDATE SET color_hex = EXCLUDED.color_hex, logo_url = EXCLUDED.logo_url
       RETURNING *`,
      [nombre.trim(), color_hex, logo_url || null]
    );
    if (row) {
      revalidatePath("/competencia");
      return row;
    }
  } catch (pgErr) {}

  // 2. Supabase fallback
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operadores_competencia")
    .insert([{ nombre, color_hex, logo_url }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/competencia");
  return data;
}

export async function updateOperador(id: number, nombre: string, color_hex: string, logo_url?: string) {
  cachedOperadores = null;
  // 1. PostgreSQL
  try {
    const row = await queryRow(
      "UPDATE public.operadores_competencia SET nombre = $1, color_hex = $2, logo_url = $3 WHERE id = $4 RETURNING *",
      [nombre.trim(), color_hex, logo_url || null, id]
    );
    if (row) {
      revalidatePath("/competencia");
      return row;
    }
  } catch (pgErr) {}

  // 2. Supabase fallback
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operadores_competencia")
    .update({ nombre, color_hex, logo_url })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/competencia");
  return data;
}

export async function deleteOperador(id: number) {
  cachedOperadores = null;
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.ofertas_competencia WHERE operador_id = $1", [id]);
    await query("DELETE FROM public.operadores_competencia WHERE id = $1", [id]);
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("ofertas_competencia").delete().eq("operador_id", id);
    await supabase.from("operadores_competencia").delete().eq("id", id);
  } catch {}

  revalidatePath("/competencia");
  return true;
}

// ── Ofertas ────────────────────────────────────────────────────────

export async function saveOferta(oferta: any) {
  const operador_id = parseInt(String(oferta.operador_id), 10);
  const plan_nombre = (oferta.plan_nombre || oferta.nombre_plan || "").trim();
  const tecnologia = (oferta.tecnologia || "Fibra Óptica").trim();
  const velocidad_mbps = Math.round(Number(oferta.velocidad_mbps ?? oferta.velocidad_mb ?? 0));
  const tarifa_usd = parseFloat(Number(oferta.tarifa_usd ?? oferta.precio_mensual ?? 0).toFixed(2));
  const costo_instalacion_usd = parseFloat(Number(oferta.costo_instalacion_usd ?? oferta.costo_instalacion ?? 0).toFixed(2));
  const promocion = (oferta.promocion || oferta.notas || "").trim() || null;
  const es_simetrico = oferta.es_simetrico !== false;
  const incluye_tv = oferta.incluye_tv === true;
  const estado = oferta.estado || null;
  const municipio = oferta.municipio || null;
  const parroquia = oferta.parroquia || null;
  const sector = oferta.sector || null;
  const fecha_reporte = oferta.fecha_reporte || new Date().toISOString().split("T")[0];

  // 1. PostgreSQL (Intentar con columnas completas incluyendo es_simetrico e incluye_tv)
  try {
    const row = await queryRow(
      `INSERT INTO public.ofertas_competencia (
         operador_id, plan_nombre, tecnologia, velocidad_mbps, tarifa_usd,
         costo_instalacion_usd, promocion, es_simetrico, incluye_tv, estado,
         municipio, parroquia, sector, fecha_reporte
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        operador_id,
        plan_nombre,
        tecnologia,
        velocidad_mbps,
        tarifa_usd,
        costo_instalacion_usd,
        promocion,
        es_simetrico,
        incluye_tv,
        estado,
        municipio,
        parroquia,
        sector,
        fecha_reporte,
      ]
    );
    if (row) {
      revalidatePath("/competencia");
      return row;
    }
  } catch (pgErr) {
    // Fallback en PostgreSQL si la tabla aún no tiene las columnas booleanas
    try {
      const fallbackRow = await queryRow(
        `INSERT INTO public.ofertas_competencia (
           operador_id, plan_nombre, tecnologia, velocidad_mbps, tarifa_usd,
           costo_instalacion_usd, promocion, estado, municipio, parroquia,
           sector, fecha_reporte
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          operador_id,
          plan_nombre,
          tecnologia,
          velocidad_mbps,
          tarifa_usd,
          costo_instalacion_usd,
          promocion,
          estado,
          municipio,
          parroquia,
          sector,
          fecha_reporte,
        ]
      );
      if (fallbackRow) {
        revalidatePath("/competencia");
        return fallbackRow;
      }
    } catch (pgErr2) {}
  }

  // 2. Supabase fallback
  const supabase = await createClient();
  const payloadToInsert: Record<string, any> = {
    operador_id,
    plan_nombre,
    tecnologia,
    velocidad_mbps,
    tarifa_usd,
    costo_instalacion_usd,
    promocion,
    estado,
    municipio,
    parroquia,
    sector,
    fecha_reporte,
  };

  const { data, error } = await supabase
    .from("ofertas_competencia")
    .insert([payloadToInsert])
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/competencia");
  return data;
}

export async function deleteOferta(id: number) {
  // 1. PostgreSQL
  try {
    await query("DELETE FROM public.ofertas_competencia WHERE id = $1", [id]);
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    await supabase.from("ofertas_competencia").delete().eq("id", id);
  } catch {}

  revalidatePath("/competencia");
  return true;
}

export async function getOfertasRecientes(
  estado?: string,
  municipio?: string,
  parroquia?: string
) {
  // 1. PostgreSQL
  try {
    let sql = `
      SELECT o.*, row_to_json(op.*) as operador
      FROM public.ofertas_competencia o
      LEFT JOIN public.operadores_competencia op ON op.id = o.operador_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (estado) {
      sql += ` AND o.estado = $${idx++}`;
      params.push(estado);
    }
    if (municipio) {
      sql += ` AND o.municipio = $${idx++}`;
      params.push(municipio);
    }
    if (parroquia) {
      sql += ` AND o.parroquia = $${idx++}`;
      params.push(parroquia);
    }

    sql += " ORDER BY o.fecha_reporte DESC LIMIT 100";
    const rows = await query(sql, params);
    if (rows && rows.length > 0) return rows;
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    let querySup = supabase
      .from("ofertas_competencia")
      .select("*, operador:operadores_competencia(*)")
      .order("fecha_reporte", { ascending: false });

    if (estado) querySup = querySup.eq("estado", estado);
    if (municipio) querySup = querySup.eq("municipio", municipio);
    if (parroquia) querySup = querySup.eq("parroquia", parroquia);

    const { data, error } = await querySup.limit(100);
    if (!error) return data || [];
  } catch (err: any) {
    console.warn("getOfertasRecientes error:", err.message);
  }

  return [];
}

export async function getHistorialOperador(operadorId: number) {
  // 1. PostgreSQL
  try {
    const rows = await query(
      "SELECT * FROM public.ofertas_competencia WHERE operador_id = $1 ORDER BY fecha_reporte DESC",
      [operadorId]
    );
    if (rows && rows.length > 0) return rows;
  } catch (pgErr) {}

  // 2. Supabase fallback
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ofertas_competencia")
      .select("*")
      .eq("operador_id", operadorId)
      .order("fecha_reporte", { ascending: false });

    if (!error) return data || [];
  } catch (err: any) {
    console.warn("getHistorialOperador error:", err.message);
  }

  return [];
}
