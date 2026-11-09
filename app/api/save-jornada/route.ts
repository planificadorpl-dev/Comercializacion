import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getSheetsClient } from "@/app/lib/googleAuth";
import { appendActividadesLocal } from "@/lib/actividades-store";

export async function POST(req: Request) {
  try {
    const jornada = await req.json();

    if (!jornada || !jornada.activitiesDetail || !Array.isArray(jornada.activitiesDetail)) {
      return NextResponse.json({ error: "Payload de jornada inválido." }, { status: 400 });
    }

    const { calculateChecklistScores } = await import("@/lib/evaluaciones-data");
    const scores = jornada.checklist ? calculateChecklistScores(jornada.checklist) : null;

    let fechaFormatted = jornada.date;
    if (fechaFormatted && fechaFormatted.includes("/")) {
      fechaFormatted = fechaFormatted.split("/").reverse().join("-");
    }

    // ── 1. Native PostgreSQL Persistence (actividades) ───────────────────────
    let postgresSuccess = false;
    let pgErrorMsg = null;

    try {
      for (const act of jornada.activitiesDetail) {
        const u = act.ubicaciones || {};
        const rawTime = act.time || act.hora || "08:00";
        const cleanTime = rawTime.includes(" ") ? rawTime.split(" ")[0] : rawTime;

        await query(
          `INSERT INTO public.actividades (
             fecha, hora, asesor, tipo, solicitudes, clientes_captados, volantes,
             llamadas_info, llamadas_agenda, estado, municipio, parroquia, sector,
             condominio, notas, reporte_wa, uid, checklist, checklist_cumplimiento_pct,
             checklist_cumplidos, checklist_total, checklist_factor_scores, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())`,
          [
            fechaFormatted,
            cleanTime,
            jornada.asesor,
            act.activityType || act.tipo || "Actividad",
            parseInt(act.solicitudes || 0, 10),
            parseInt(act.clientesCaptados || act.clientes_captados || 0, 10),
            parseInt(act.volantes || 0, 10),
            parseInt(act.llamadasInfo || act.llamadas_info || 0, 10),
            parseInt(act.llamadasAgenda || act.llamadas_agenda || 0, 10),
            u.estado || act.estado || null,
            u.municipio || act.municipio || null,
            u.parroquia || act.parroquia || null,
            u.sector || act.sector || null,
            act.condominio || null,
            act.notes || act.notas || null,
            jornada.reporteWhatsapp || null,
            act.uid || null,
            jornada.checklist ? JSON.stringify(jornada.checklist) : null,
            scores?.cumplimientoPct ?? 0,
            scores?.totalCumplidos ?? 0,
            scores?.totalItems ?? 30,
            scores?.factorScores ? JSON.stringify(scores.factorScores) : null,
          ]
        );
      }
      postgresSuccess = true;
    } catch (pgErr: any) {
      pgErrorMsg = pgErr.message;
      console.warn("Postgres save-jornada aviso:", pgErr.message);
    }

    // ── 2. Advisor Checklist Persistence ─────────────────────────────────────
    let checklistSaved = false;
    if (jornada.checklist && jornada.asesor) {
      try {
        const { saveAdvisorChecklist } = await import("@/lib/advisor-checklists-store");
        let isoFecha = new Date().toISOString().split("T")[0];
        if (jornada.date) {
          if (jornada.date.includes("/")) {
            isoFecha = jornada.date.split("/").reverse().join("-");
          } else if (jornada.date.includes("-")) {
            isoFecha = jornada.date;
          }
        }

        await saveAdvisorChecklist({
          id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          asesor: jornada.asesor,
          fecha: isoFecha,
          items: jornada.checklist,
          cumplimientoPct: scores?.cumplimientoPct || 0,
          itemsCumplidos: scores?.totalCumplidos || 0,
          itemsTotal: scores?.totalItems || 30,
          factorScores: scores?.factorScores || {},
          createdAt: new Date().toISOString(),
        });
        checklistSaved = true;
      } catch (chkErr: any) {
        console.warn("Aviso: No se pudo persistir el checklist del asesor:", chkErr.message);
      }
    }

    // ── 3. Supabase Logic (Fallback) ─────────────────────────────────────────
    let supabaseSuccess = false;
    let supErrorMsg = null;

    try {
      const supabase = await createClient();
      const baseRows = jornada.activitiesDetail.map((act: any) => {
        const u = act.ubicaciones || {};
        const rawTime = act.time || act.hora || "08:00";
        const cleanTime = rawTime.includes(" ") ? rawTime.split(" ")[0] : rawTime;

        return {
          fecha: fechaFormatted,
          hora: cleanTime,
          asesor: jornada.asesor,
          tipo: act.activityType || act.tipo,
          solicitudes: parseInt(act.solicitudes || 0, 10),
          clientes_captados: parseInt(act.clientesCaptados || act.clientes_captados || 0, 10),
          volantes: parseInt(act.volantes || 0, 10),
          llamadas_info: parseInt(act.llamadasInfo || act.llamadas_info || 0, 10),
          llamadas_agenda: parseInt(act.llamadasAgenda || act.llamadas_agenda || 0, 10),
          estado: u.estado || act.estado || null,
          municipio: u.municipio || act.municipio || null,
          parroquia: u.parroquia || act.parroquia || null,
          sector: u.sector || act.sector || null,
          condominio: act.condominio || null,
          notas: act.notes || act.notas || null,
          reporte_wa: jornada.reporteWhatsapp || null,
          uid: act.uid || null,
        };
      });

      const { error: supError } = await supabase.from("actividades").insert(baseRows);
      if (!supError) {
        supabaseSuccess = true;
      } else {
        supErrorMsg = supError.message;
      }
    } catch (e: any) {
      supErrorMsg = e.message;
    }

    // ── 3.1. Local JSON Mirror Persistence ──────────────────────────────────
    try {
      const localRows = jornada.activitiesDetail.map((act: any) => {
        const u = act.ubicaciones || {};
        const rawTime = act.time || act.hora || "08:00";
        const cleanTime = rawTime.includes(" ") ? rawTime.split(" ")[0] : rawTime;
        return {
          fecha: fechaFormatted,
          hora: cleanTime,
          asesor: jornada.asesor,
          tipo: act.activityType || act.tipo || "Actividad",
          solicitudes: parseInt(act.solicitudes || 0, 10),
          clientes_captados: parseInt(act.clientesCaptados || act.clientes_captados || 0, 10),
          volantes: parseInt(act.volantes || 0, 10),
          llamadas_info: parseInt(act.llamadasInfo || act.llamadas_info || 0, 10),
          llamadas_agenda: parseInt(act.llamadasAgenda || act.llamadas_agenda || 0, 10),
          estado: u.estado || act.estado || null,
          municipio: u.municipio || act.municipio || null,
          parroquia: u.parroquia || act.parroquia || null,
          sector: u.sector || act.sector || null,
          condominio: act.condominio || null,
          notas: act.notes || act.notas || null,
          reporte_wa: jornada.reporteWhatsapp || null,
          uid: act.uid || null,
          checklist: jornada.checklist || null,
          checklist_cumplimiento_pct: scores?.cumplimientoPct ?? 0,
          checklist_cumplidos: scores?.totalCumplidos ?? 0,
          checklist_total: scores?.totalItems ?? 30,
          checklist_factor_scores: scores?.factorScores || null,
          created_at: new Date().toISOString(),
        };
      });
      await appendActividadesLocal(localRows);
    } catch (localErr: any) {
      console.warn("Aviso local actividades mirror:", localErr.message);
    }

    // ── 4. Google Sheets (Opcional, si hay internet y credenciales) ───────────
    let sheetsSuccess = false;
    let sheetsError = null;

    try {
      const sheets = await getSheetsClient(true);
      const spreadsheetId = process.env.SPREADSHEET_ID;

      if (spreadsheetId) {
        const { ensureActividadesSheetHeaders, formatActivitySheetRow } = await import("@/lib/actividades-sheets");
        await ensureActividadesSheetHeaders(sheets, spreadsheetId);

        const rows = jornada.activitiesDetail.map((act: any) => {
          return formatActivitySheetRow(act, jornada, scores);
        });

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "'REPORTES DE ASESORES'!A:BB",
          valueInputOption: "USER_ENTERED",
          requestBody: { values: rows },
        });
        sheetsSuccess = true;
      }
    } catch (e: any) {
      sheetsError = e.message;
    }

    return NextResponse.json({
      success: postgresSuccess || supabaseSuccess || checklistSaved,
      message: "Jornada procesada exitosamente",
      details: {
        postgresSuccess,
        supabaseSuccess,
        checklistSaved,
        sheetsSuccess,
        pgErrorMsg,
        supErrorMsg,
        sheetsError,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error del servidor al guardar reporte.", details: error.message },
      { status: 500 }
    );
  }
}
