import { NextResponse } from "next/server";
import { readAllActividades } from "@/lib/actividades-store";

export async function GET() {
  try {
    const activities = await readAllActividades();

    if (!activities || activities.length === 0) {
      return NextResponse.json([]);
    }

    const jornadasMap: Record<string, any> = {};

    activities.forEach((act) => {
      let displayDate = act.fecha;
      if (act.fecha && String(act.fecha).includes("-")) {
        displayDate = String(act.fecha).split("T")[0].split("-").reverse().join("/");
      }

      const asesor = act.asesor;
      const key = `${displayDate}_${asesor}`;

      if (!jornadasMap[key]) {
        jornadasMap[key] = {
          date: displayDate,
          asesor: asesor,
          activitiesCount: 0,
          totals: {
            solicitudes: 0,
            captados: 0,
            volantes: 0,
            llamadasInfo: 0,
            llamadasAgenda: 0,
          },
          details: [],
          reporteWhatsapp: act.reporte_wa || null,
          checklist: act.checklist || null,
          checklistCumplimientoPct: act.checklist_cumplimiento_pct || 0,
          checklistCumplidos: act.checklist_cumplidos || 0,
          checklistTotal: act.checklist_total || 30,
        };
      }

      jornadasMap[key].activitiesCount++;
      jornadasMap[key].totals.solicitudes += Number(act.solicitudes || 0);
      jornadasMap[key].totals.captados += Number(act.clientes_captados || 0);
      jornadasMap[key].totals.volantes += Number(act.volantes || 0);
      jornadasMap[key].totals.llamadasInfo += Number(act.llamadas_info || 0);
      jornadasMap[key].totals.llamadasAgenda += Number(act.llamadas_agenda || 0);

      if (!jornadasMap[key].reporteWhatsapp && act.reporte_wa) {
        jornadasMap[key].reporteWhatsapp = act.reporte_wa;
      }
      if (!jornadasMap[key].checklist && act.checklist) {
        jornadasMap[key].checklist = act.checklist;
        jornadasMap[key].checklistCumplimientoPct = act.checklist_cumplimiento_pct || 0;
        jornadasMap[key].checklistCumplidos = act.checklist_cumplidos || 0;
        jornadasMap[key].checklistTotal = act.checklist_total || 30;
      }

      let locLabel = "";
      if (act.estado || act.municipio || act.parroquia || act.sector) {
        const parts = [act.estado, act.municipio, act.parroquia, act.sector].filter(Boolean);
        locLabel = parts.join(", ");
      }

      jornadasMap[key].details.push({
        time: act.hora || "",
        type: act.tipo || "Actividad",
        location: locLabel,
        solicitudes: Number(act.solicitudes || 0),
        captados: Number(act.clientes_captados || 0),
        volantes: Number(act.volantes || 0),
        llamadasInfo: Number(act.llamadas_info || 0),
        llamadasAgenda: Number(act.llamadas_agenda || 0),
        condominio: act.condominio || null,
        notes: act.notas || null,
      });
    });

    const historyArray = Object.values(jornadasMap);
    return NextResponse.json(historyArray);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener historial.", details: error.message },
      { status: 500 }
    );
  }
}
