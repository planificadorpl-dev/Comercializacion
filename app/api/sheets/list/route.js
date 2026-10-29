import { NextResponse } from "next/server";
import { getSheetsClient } from "@/app/lib/googleAuth";

/**
 * GET /api/sheets/list
 * 
 * Lists all sheet tabs within a spreadsheet.
 * Query params:
 *   - spreadsheetId: Google Sheets spreadsheet ID (required)
 *   - apiKey: Google API Key (optional, overrides env)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const apiKey = searchParams.get("apiKey") || process.env.GOOGLE_API_KEY;

    if (!spreadsheetId) {
      return NextResponse.json({ error: "Se requiere 'spreadsheetId'" }, { status: 400 });
    }

    let sheets = [];
    let spreadsheetTitle = "Sin título";

    try {
      const googleSheets = await getSheetsClient();
      const response = await googleSheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties.title,sheets.properties',
      });

      const data = response.data;
      spreadsheetTitle = data.properties?.title || "Sin título";
      sheets = (data.sheets || []).map(s => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
        rowCount: s.properties.gridProperties?.rowCount,
        columnCount: s.properties.gridProperties?.columnCount,
      }));
    } catch (e) {
      console.error("Error fetching list via credentials.json:", e);
      // Fallback a API Key
      if (apiKey) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=properties.title,sheets.properties`;
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          return NextResponse.json(
            { error: `Error al acceder al spreadsheet: ${response.status}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        spreadsheetTitle = data.properties?.title || "Sin título";
        sheets = (data.sheets || []).map(s => ({
          title: s.properties.title,
          sheetId: s.properties.sheetId,
          rowCount: s.properties.gridProperties?.rowCount,
          columnCount: s.properties.gridProperties?.columnCount,
        }));
      } else {
        return NextResponse.json({ error: "Se requiere API Key o credentials.json" }, { status: 401 });
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheetTitle,
      sheets
    });

  } catch (error) {
    return NextResponse.json(
      { error: `Error: ${error.message}` },
      { status: 500 }
    );
  }
}
