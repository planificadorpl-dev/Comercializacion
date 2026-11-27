import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { isCloudflareWorkers } from "@/lib/runtime-env";
import {
  EvaluacionRecord,
  EvaluacionItemState,
  EVALUACION_FACTORES,
  calculateEvaluationScores,
  formatFrecuencia,
  formatEvaluadorRol,
} from "@/lib/evaluaciones-data";
import {
  syncAllEvaluacionesToSheet,
  PLANIFICACION_SPREADSHEET_ID,
} from "@/lib/evaluaciones-sheets";
import { getSheetsClient } from "@/app/lib/googleAuth";
import { readEvaluaciones, readEvaluacionesLocal, writeEvaluacionesLocal } from "@/lib/evaluaciones-store";

// In-memory cache for active advisors
let cachedActiveAdvisors: { advisors: string[]; timestamp: number } | null = null;
const ADVISORS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

function parseDateDDMMYYYY(str: string): number {
  const parts = str.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day).getTime();
    }
  }
  return 0;
}

/**
 * Extracts active sales advisors:
 * 1. From PostgreSQL asesores_config if available.
 * 2. From Google Sheets Data sheet if available.
 * 3. Fallback list.
 */
async function getAvailableAdvisors(): Promise<string[]> {
  const now = Date.now();
  if (cachedActiveAdvisors && now - cachedActiveAdvisors.timestamp < ADVISORS_CACHE_TTL_MS) {
    return cachedActiveAdvisors.advisors;
  }

  const filterActiveNames = (rows: { nombre: string }[]) =>
    rows
      .map((r) => (r.nombre || "").trim())
      .filter((n) => n && n.toLowerCase() !== "planificación" && n.toLowerCase() !== "planificacion");

  // 1. Try Supabase / PostgreSQL asesores_config
  const loadAdvisorsPg = async () => {
    try {
      const rows = await query<{ nombre: string }>(
        "SELECT nombre FROM public.asesores_config WHERE activo = true ORDER BY nombre ASC"
      );
      return rows ? filterActiveNames(rows) : [];
    } catch {
      return [];
    }
  };

  const loadAdvisorsSupabase = async () => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("asesores_config")
        .select("nombre")
        .eq("activo", true)
        .order("nombre", { ascending: true });
      return !error && Array.isArray(data) ? filterActiveNames(data) : [];
    } catch {
      return [];
    }
  };

  const primaryAdvisors = isCloudflareWorkers()
    ? await loadAdvisorsSupabase()
    : await loadAdvisorsPg();
  const dbList =
    primaryAdvisors.length > 0
      ? primaryAdvisors
      : isCloudflareWorkers()
      ? await loadAdvisorsPg()
      : await loadAdvisorsSupabase();

  if (dbList.length > 0) {
    cachedActiveAdvisors = { advisors: dbList, timestamp: now };
    return dbList;
  }

  // 2. Try Google Sheets
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PLANIFICACION_SPREADSHEET_ID,
      range: "Data!B:C",
    });

    const rows = res.data.values || [];
    if (rows.length > 1) {
      let maxTime = 0;
      let maxDateStr = "";

      for (let i = 1; i < rows.length; i++) {
        const fecha = (rows[i][0] || "").trim();
        const time = parseDateDDMMYYYY(fecha);
        if (time > maxTime) {
          maxTime = time;
          maxDateStr = fecha;
        }
      }

      if (maxDateStr) {
        const activeSet = new Set<string>();
        for (let i = 1; i < rows.length; i++) {
          const fecha = (rows[i][0] || "").trim();
          const asesor = (rows[i][1] || "").trim();
          if (fecha === maxDateStr && asesor) {
            activeSet.add(asesor);
          }
        }

        if (activeSet.size > 0) {
          const sortedList = Array.from(activeSet).sort((a, b) =>
            a.localeCompare(b, "es", { sensitivity: "base" })
          );
          cachedActiveAdvisors = { advisors: sortedList, timestamp: now };
          return sortedList;
        }
      }
    }
  } catch (err) {}

  // 3. Fallback list
  return [
    "Andrea Plaza",
    "Arianna Montaña",
    "Brainin Berrotera",
    "Carlos Ruiz",
    "Cindy Infante",
    "Daiana Torres",
    "Danyelis Muñoz",
    "Diarnelis Mendoza",
    "Gabriela Marrero",
    "Genesis Ochoa",
    "Lorena Esqueda",
    "Maria Azuaje",
    "Naomi Tovar",
    "Patricia Mendoza",
    "Stephany Manrique",
    "Yaisen Herrera",
    "Yamery Rodriguez",
    "Yeilis Puentes",
    "Yesenia Teran",
    "Yilda Gonzalez",
    "Yuliana Carvajal",
  ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const asesor = searchParams.get("asesor");
    const frecuencia = searchParams.get("frecuencia");
    const evaluadorRol = searchParams.get("evaluadorRol");
    const q = searchParams.get("q")?.toLowerCase().trim();

    let list = await readEvaluaciones();

    if (asesor) {
      list = list.filter((e) => e.asesor.toLowerCase() === asesor.toLowerCase());
    }
    if (frecuencia && frecuencia !== "todas") {
      list = list.filter((e) => e.frecuencia === frecuencia);
    }
    if (evaluadorRol && evaluadorRol !== "todos") {
      list = list.filter((e) => e.evaluadorRol === evaluadorRol);
    }
    if (q) {
      list = list.filter(
        (e) =>
          e.asesor.toLowerCase().includes(q) ||
          e.evaluador.toLowerCase().includes(q) ||
          e.sector.toLowerCase().includes(q) ||
          e.observacionesGenerales?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const advisors = await getAvailableAdvisors();

    return NextResponse.json(
      {
        success: true,
        evaluaciones: list,
        advisors,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al obtener evaluaciones" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      asesor,
      evaluador,
      evaluadorRol,
      frecuencia,
      fecha,
      estado,
      municipio,
      parroquia,
      sector,
      items = {},
      observacionesGenerales = "",
    } = body;

    if (
      !asesor?.trim() ||
      !evaluador?.trim() ||
      !frecuencia?.trim() ||
      !fecha?.trim() ||
      !estado?.trim() ||
      !municipio?.trim() ||
      !parroquia?.trim() ||
      !sector?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Todos los campos de asesor, evaluador, fecha, frecuencia, estado, municipio, parroquia y sector son obligatorios.",
        },
        { status: 400 }
      );
    }

    // Ensure all 30 factor items are complete and normalized with 1 to 5 rating
    const normalizedItems: Record<string, EvaluacionItemState> = {};
    EVALUACION_FACTORES.forEach((f) => {
      f.items.forEach((it) => {
        const raw = items[it.id];
        let score = 5;
        if (raw !== undefined) {
          if (typeof raw.puntuacion === "number" && !isNaN(raw.puntuacion)) {
            score = Math.max(1, Math.min(5, Math.round(raw.puntuacion)));
          } else if (raw.cumple !== undefined) {
            const isCumple = typeof raw.cumple === "boolean"
              ? raw.cumple
              : String(raw.cumple).toLowerCase() === "sí" ||
                String(raw.cumple).toLowerCase() === "si" ||
                String(raw.cumple).toLowerCase() === "true";
            score = isCumple ? 5 : 1;
          }
          normalizedItems[it.id] = {
            puntuacion: score,
            cumple: score >= 3,
            observacion: (raw.observacion || "").trim(),
          };
        } else {
          normalizedItems[it.id] = {
            puntuacion: 5,
            cumple: true,
            observacion: "",
          };
        }
      });
    });

    const scores = calculateEvaluationScores(normalizedItems);
    const nowIso = new Date().toISOString();
    const recordId = id && id.trim() ? id.trim() : `eval_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const record: EvaluacionRecord = {
      id: recordId,
      asesor: asesor.trim(),
      evaluador: evaluador.trim(),
      evaluadorRol: formatEvaluadorRol(evaluadorRol),
      frecuencia: formatFrecuencia(frecuencia),
      fecha: fecha.trim(),
      estado: estado.trim(),
      municipio: municipio.trim(),
      parroquia: parroquia.trim(),
      sector: sector.trim(),
      items: normalizedItems,
      observacionesGenerales: (observacionesGenerales || "").trim(),
      cumplimientoPct: scores.cumplimientoPct,
      puntuacionTotal: scores.puntuacionTotal,
      puntuacionMaxima: scores.puntuacionMaxima,
      puntuacionPromedio: scores.promedio,
      itemsCumplidos: scores.puntuacionTotal,
      itemsTotal: scores.puntuacionMaxima,
      factorScores: scores.factorScores,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Guardar en PostgreSQL (en Workers omitimos si falla rápido) y Supabase
    let pgSaved = false;
    let supaSaved = false;

    if (!isCloudflareWorkers()) {
      try {
        await query(
          `INSERT INTO public.evaluaciones (
             id, asesor, evaluador, evaluador_rol, frecuencia, fecha, estado, municipio, parroquia, sector,
             items, observaciones_generales, cumplimiento_pct, puntuacion_total, puntuacion_maxima,
             puntuacion_promedio, items_cumplidos, items_total, factor_scores, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT (id) DO UPDATE SET
             asesor = EXCLUDED.asesor,
             evaluador = EXCLUDED.evaluador,
             evaluador_rol = EXCLUDED.evaluador_rol,
             frecuencia = EXCLUDED.frecuencia,
             fecha = EXCLUDED.fecha,
             estado = EXCLUDED.estado,
             municipio = EXCLUDED.municipio,
             parroquia = EXCLUDED.parroquia,
             sector = EXCLUDED.sector,
             items = EXCLUDED.items,
             observaciones_generales = EXCLUDED.observaciones_generales,
             cumplimiento_pct = EXCLUDED.cumplimiento_pct,
             puntuacion_total = EXCLUDED.puntuacion_total,
             puntuacion_maxima = EXCLUDED.puntuacion_maxima,
             puntuacion_promedio = EXCLUDED.puntuacion_promedio,
             items_cumplidos = EXCLUDED.items_cumplidos,
             items_total = EXCLUDED.items_total,
             factor_scores = EXCLUDED.factor_scores,
             updated_at = NOW()`,
          [
            record.id,
            record.asesor,
            record.evaluador,
            record.evaluadorRol,
            record.frecuencia,
            record.fecha,
            record.estado,
            record.municipio,
            record.parroquia,
            record.sector,
            JSON.stringify(record.items),
            record.observacionesGenerales,
            record.cumplimientoPct,
            record.puntuacionTotal,
            record.puntuacionMaxima,
            record.puntuacionPromedio,
            record.itemsCumplidos,
            record.itemsTotal,
            JSON.stringify(record.factorScores),
            record.createdAt,
            record.updatedAt,
          ]
        );
        pgSaved = true;
      } catch (pgErr) {
        console.warn("Postgres save evaluacion aviso:", pgErr);
      }
    }

    try {
      const supabase = await createClient();
      const { error } = await supabase.from("evaluaciones").upsert({
        id: record.id,
        asesor: record.asesor,
        evaluador: record.evaluador,
        evaluador_rol: record.evaluadorRol,
        frecuencia: record.frecuencia,
        fecha: record.fecha,
        estado: record.estado,
        municipio: record.municipio,
        parroquia: record.parroquia,
        sector: record.sector,
        items: record.items,
        observaciones_generales: record.observacionesGenerales,
        cumplimiento_pct: record.cumplimientoPct,
        puntuacion_total: record.puntuacionTotal,
        puntuacion_maxima: record.puntuacionMaxima,
        puntuacion_promedio: record.puntuacionPromedio,
        items_cumplidos: record.itemsCumplidos,
        items_total: record.itemsTotal,
        factor_scores: record.factorScores,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
      if (!error) supaSaved = true;
    } catch (supaErr) {
      console.warn("Supabase save evaluacion aviso:", supaErr);
    }

    // 2. Guardar en JSON local para mirror
    const list = await readEvaluacionesLocal();
    const existingIndex = list.findIndex((e) => e.id === recordId);
    if (existingIndex >= 0) {
      record.createdAt = list[existingIndex].createdAt;
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    const localSaved = await writeEvaluacionesLocal(list);

    if (!pgSaved && !supaSaved && !localSaved) {
      return NextResponse.json(
        { success: false, error: "No se pudo guardar la evaluación" },
        { status: 500 }
      );
    }

    // 3. Sincronización opcional a Google Sheets (solo si hay conexión/credenciales)
    let sheetSynced = false;
    try {
      sheetSynced = await syncAllEvaluacionesToSheet(list);
    } catch (sheetErr) {
      // Ignorar en intranet si no hay salida a Google
    }

    return NextResponse.json({
      success: true,
      evaluacion: record,
      sheetSynced,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error procesando la evaluación" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de evaluación requerido" },
        { status: 400 }
      );
    }

    // 1. Eliminar de PostgreSQL y Supabase
    if (!isCloudflareWorkers()) {
      try {
        await query("DELETE FROM public.evaluaciones WHERE id = $1", [id]);
      } catch (pgErr) {}
    }

    try {
      const supabase = await createClient();
      await supabase.from("evaluaciones").delete().eq("id", id);
    } catch (supaErr) {}

    // 2. Eliminar de copia local
    let list = await readEvaluacionesLocal();
    const filtered = list.filter((e) => e.id !== id);
    await writeEvaluacionesLocal(filtered);

    // 3. Google Sheets (opcional)
    try {
      await syncAllEvaluacionesToSheet(filtered);
    } catch (sheetErr) {}

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al eliminar evaluación" },
      { status: 500 }
    );
  }
}
