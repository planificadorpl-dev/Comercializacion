import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    let activities: any[] = [];

    // 1. Try Native PostgreSQL First
    try {
      const rows = await query<any>(
        "SELECT * FROM public.actividades ORDER BY fecha DESC, hora DESC"
      );
      if (Array.isArray(rows) && rows.length > 0) {
        activities = rows;
      }
    } catch (pgErr) {}

    // 2. Supabase fallback
    if (activities.length === 0) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("actividades")
          .select("*")
          .order("fecha", { ascending: false })
          .order("hora", { ascending: false });

        if (!error && data) {
          activities = data;
        }
      } catch (supErr) {}
    }

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
        };
      }

      jornadasMap[key].activitiesCount++;
      jornadasMap[key].totals.solicitudes += act.solicitudes || 0;
      jornadasMap[key].totals.captados += act.clientes_captados || 0;
      jornadasMap[key].totals.volantes += act.volantes || 0;
      jornadasMap[key].totals.llamadasInfo += act.llamadas_info || 0;
      jornadasMap[key].totals.llamadasAgenda += act.llamadas_agenda || 0;

      if (!jornadasMap[key].reporteWhatsapp && act.reporte_wa) {
        jornadasMap[key].reporteWhatsapp = act.reporte_wa;
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
