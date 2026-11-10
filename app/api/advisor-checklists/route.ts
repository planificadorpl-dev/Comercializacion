import { NextResponse } from "next/server";
import {
  readAdvisorChecklists,
  saveAdvisorChecklist,
  getLatestChecklistForAdvisor,
} from "@/lib/advisor-checklists-store";
import { calculateChecklistScores, AdvisorChecklistRecord } from "@/lib/evaluaciones-data";
import { areSameAdvisorName, normalizeDateToIso } from "@/lib/match-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const asesor = searchParams.get("asesor");
    const fecha = searchParams.get("fecha");
    const latestOnly = searchParams.get("latest") === "true";

    const all = await readAdvisorChecklists();
    let filtered = all;

    if (asesor) {
      const q = asesor.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.asesor.trim().toLowerCase() === q ||
          areSameAdvisorName(c.asesor, asesor)
      );
    }

    if (fecha) {
      const targetIso = normalizeDateToIso(fecha);
      const matchExactFecha = filtered.filter(
        (c) => normalizeDateToIso(c.fecha) === targetIso
      );
      if (matchExactFecha.length > 0) {
        return NextResponse.json({ success: true, checklist: matchExactFecha[0] });
      }
    }

    if (asesor && latestOnly) {
      const latest = filtered[0] || (await getLatestChecklistForAdvisor(asesor));
      return NextResponse.json({ success: true, checklist: latest });
    }

    return NextResponse.json({ success: true, checklists: filtered });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al obtener checklists" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { asesor, fecha, items = {} } = body;

    if (!asesor || !fecha) {
      return NextResponse.json(
        { success: false, error: "Asesor y fecha son obligatorios." },
        { status: 400 }
      );
    }

    const scores = calculateChecklistScores(items);

    const record: AdvisorChecklistRecord = {
      id: body.id || `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      asesor,
      fecha,
      items,
      cumplimientoPct: scores.cumplimientoPct,
      itemsCumplidos: scores.totalCumplidos,
      itemsTotal: scores.totalItems,
      factorScores: scores.factorScores,
      createdAt: body.createdAt || new Date().toISOString(),
    };

    const saved = await saveAdvisorChecklist(record);

    if (saved) {
      return NextResponse.json({ success: true, checklist: record });
    } else {
      return NextResponse.json(
        { success: false, error: "No se pudo guardar el checklist." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al guardar checklist." },
      { status: 500 }
    );
  }
}
