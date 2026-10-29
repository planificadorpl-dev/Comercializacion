import { NextResponse } from "next/server";
import { getSheetsClient } from "@/app/lib/googleAuth";
import { ensureActividadesSheetHeaders, REPORTES_SHEET_HEADERS } from "@/lib/actividades-sheets";

export async function GET() {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: "SPREADSHEET_ID no configurado" }, { status: 400 });
    }

    const sheets = await getSheetsClient(true);
    await ensureActividadesSheetHeaders(sheets, spreadsheetId);

    return NextResponse.json({
      success: true,
      message: "Encabezados de Google Sheets verificados y sincronizados",
      headersCount: REPORTES_SHEET_HEADERS.length,
      headers: REPORTES_SHEET_HEADERS,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
