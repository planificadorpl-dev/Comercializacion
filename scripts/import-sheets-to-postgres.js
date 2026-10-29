/**
 * Script de Importación de Google Sheets a PostgreSQL
 * ==============================================================================
 * Extrae todo el histórico de "DATA LIMPIA" (Cuadro Diario de Instalaciones)
 * y "SOLICITUDES" desde Google Sheets y los inserta en las tablas de PostgreSQL
 * 'instalaciones' y 'solicitudes'.
 * 
 * Una vez ejecutado este script, el sistema ya NO necesita Google Sheets ni internet
 * para operar en la intranet corporativa.
 * ==============================================================================
 * Uso:
 *   node scripts/import-sheets-to-postgres.js
 * ==============================================================================
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const f of envFiles) {
    const fullPath = path.join(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/ventas_intranet";
const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || "1UZvhPyYhw8NV-_wwPESWQiGfqnwkASABr4JSBPRJoUw";

const isLocalhost = DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function getSheetsClient() {
  const credentialsPath = path.join(process.cwd(), "credentials.json");
  const dataplPath = path.join(process.cwd(), "credentials-datapl.json");
  let credPath = fs.existsSync(credentialsPath)
    ? credentialsPath
    : fs.existsSync(dataplPath)
    ? dataplPath
    : null;

  if (credPath) {
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey && apiKey !== "TU_API_KEY_AQUI") {
    return google.sheets({ version: "v4", auth: apiKey });
  }

  throw new Error("No se encontraron credenciales válidas de Google Sheets (credentials.json o GOOGLE_API_KEY).");
}

function formatToIsoDate(fechaStr) {
  if (!fechaStr) return null;
  const str = String(fechaStr).trim();
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    let d = parts[0].padStart(2, "0");
    let m = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) y = "20" + y;
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    return `${y}-${m}-${d}`;
  }
  return null;
}

async function runImport() {
  let client;
  try {
    client = await pool.connect();
    console.log("==================================================================");
    console.log("📊 IMPORTANDO DATOS HISTÓRICOS DE GOOGLE SHEETS A POSTGRESQL");
    console.log("==================================================================");

    const sheets = await getSheetsClient();
    const PLAN_SPREADSHEET_ID = "1_PzDJLZ8jnPTZq9PgQMLfomwBwles8XOd8RD5Ksko2Y";
    console.log(`📡 Conectado a Google Sheets ID: ${PLAN_SPREADSHEET_ID}`);

    // ── 1. IMPORTAR CUADRO DIARIO / DATA LIMPIA ────────────────────────────────
    console.log("\n📦 1. Leyendo hoja 'DATA LIMPIA' de Planificación...");
    let dataResponse;

    try {
      dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: PLAN_SPREADSHEET_ID,
        range: "'DATA LIMPIA'",
      });
    } catch (e1) {
      console.warn("No se pudo leer DATA LIMPIA de Planificación, intentando INSTALACION:", e1.message);
      dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'INSTALACION'",
      });
    }

    const rows = dataResponse.data.values || [];
    if (rows.length > 1) {
      console.log(`📥 ${rows.length - 1} filas encontradas en DATA LIMPIA. Insertando en tabla 'instalaciones'...`);
      const rawData = rows.slice(1);
      let insCount = 0;

      await client.query("BEGIN");

      for (const row of rawData) {
        const rawFecha = row[0] !== undefined ? String(row[0]).trim() : "";
        if (!rawFecha || rawFecha.toUpperCase() === "FECHA") continue;

        const fecha = formatToIsoDate(rawFecha);
        if (!fecha) continue;

        const mes = row[1] ? String(row[1]).trim().toUpperCase() : "";
        const tec1 = row[2] ? String(row[2]).trim() : null;
        const tec2 = row[3] ? String(row[3]).trim() : null;
        const router = row[4] ? String(row[4]).trim() : null;
        const nombreCliente = row[5] ? String(row[5]).trim() : "Cliente";
        const cedula = row[6] ? String(row[6]).trim() : "";
        const zona = row[7] ? String(row[7]).trim() : "";
        const sector = row[8] ? String(row[8]).trim() : "";
        const asesor = row[9] ? String(row[9]).trim() : "Sin Asesor";
        const estatus = row[10] ? String(row[10]).trim().toUpperCase() : "INSTALADO";
        const plan = row[11] ? String(row[11]).trim() : "";
        const powerGo = row[12] && String(row[12]).trim().toUpperCase().includes("S") ? "SI" : "NO";
        const tipoAsesor = row[13] ? String(row[13]).trim() : "comercial";
        const servicio = row[14] ? String(row[14]).trim() : "Internet Fibra";
        const oficina = row[15] ? String(row[15]).trim() : "";
        const estado = row[16] ? String(row[16]).trim() : "";

        await client.query(
          `INSERT INTO public.instalaciones (
             fecha, mes, tecnico_1, tecnico_2, router, nombre_cliente, cedula,
             zona, sector, asesor, tipo_asesor, estatus, plan, power_go, servicio,
             oficina, estado
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            fecha,
            mes,
            tec1,
            tec2,
            router,
            nombreCliente,
            cedula,
            zona,
            sector,
            asesor,
            tipoAsesor,
            estatus,
            plan,
            powerGo,
            servicio,
            oficina,
            estado,
          ]
        );
        insCount++;
      }

      await client.query("COMMIT");
      console.log(`✅ ${insCount} instalaciones técnicas importadas exitosamente.`);
    }

    // ── 2. IMPORTAR HOJA DE SOLICITUDES ───────────────────────────────────────
    console.log("\n📋 2. Leyendo hoja 'SOLICITUDES'...");
    try {
      const solResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "SOLICITUDES",
      });

      const solRows = solResponse.data.values || [];
      if (solRows.length > 1) {
        console.log(`📥 ${solRows.length - 1} filas encontradas en SOLICITUDES. Insertando...`);
        const headers = solRows[0].map((h) => String(h || "").trim().toUpperCase());
        const idxFecha = headers.findIndex((h) => h.includes("FECHA"));
        const idxAsesor = headers.findIndex((h) => h.includes("ASESOR"));
        const idxNombre = headers.findIndex((h) => h.includes("NOMBRE"));
        const idxEstatus = headers.findIndex((h) => h === "ESTATUS");
        const idxCedula = headers.findIndex((h) => h.includes("CEDULA") || h.includes("CÉDULA"));
        const idxPlan = headers.findIndex((h) => h.includes("PLAN"));
        const idxOperacion = headers.findIndex((h) => h.includes("OPERACION") || h.includes("OPERACIÓN"));
        const idxPowerGo = headers.findIndex((h) => h.includes("POWERGO") || h.includes("POWER GO"));
        const idxEstado = headers.findIndex((h) => h === "ESTADO");
        const idxMunicipio = headers.findIndex((h) => h === "MUNICIPIO");
        const idxParroquia = headers.findIndex((h) => h === "PARROQUIA");
        const idxSector = headers.findIndex((h) => h === "SECTOR");
        const idxCanal = headers.findIndex((h) => h.includes("CANAL"));
        const idxSede = headers.findIndex((h) => h.includes("SEDE"));
        const idxFuente = headers.findIndex((h) => h === "FUENTE");

        await client.query("BEGIN");
        let solCount = 0;

        for (let i = 1; i < solRows.length; i++) {
          const r = solRows[i];
          const rawFecha = idxFecha >= 0 && r[idxFecha] ? String(r[idxFecha]).trim() : "";
          const fechaIso = formatToIsoDate(rawFecha) || new Date().toISOString().split("T")[0];

          const asesor = idxAsesor >= 0 && r[idxAsesor] ? String(r[idxAsesor]).trim() : "Sin Asesor";
          const nombre = idxNombre >= 0 && r[idxNombre] ? String(r[idxNombre]).trim() : "";
          const estatus = idxEstatus >= 0 && r[idxEstatus] ? String(r[idxEstatus]).trim() : "Pendiente";
          const cedula = idxCedula >= 0 && r[idxCedula] ? String(r[idxCedula]).trim() : "";
          const plan = idxPlan >= 0 && r[idxPlan] ? String(r[idxPlan]).trim() : "";
          const operacion = idxOperacion >= 0 && r[idxOperacion] ? String(r[idxOperacion]).trim() : "Instalación";
          const powerGo = idxPowerGo >= 0 && r[idxPowerGo] && String(r[idxPowerGo]).toUpperCase().includes("S") ? "SI" : "NO";
          const estado = idxEstado >= 0 && r[idxEstado] ? String(r[idxEstado]).trim() : "";
          const municipio = idxMunicipio >= 0 && r[idxMunicipio] ? String(r[idxMunicipio]).trim() : "";
          const parroquia = idxParroquia >= 0 && r[idxParroquia] ? String(r[idxParroquia]).trim() : "";
          const sector = idxSector >= 0 && r[idxSector] ? String(r[idxSector]).trim() : "";
          const canal = idxCanal >= 0 && r[idxCanal] ? String(r[idxCanal]).trim() : "";
          const sede = idxSede >= 0 && r[idxSede] ? String(r[idxSede]).trim() : "";
          const fuente = idxFuente >= 0 && r[idxFuente] ? String(r[idxFuente]).trim() : "";

          await client.query(
            `INSERT INTO public.solicitudes (
               fecha_solicitud, promotor, asesor_normalizado, nombre_cliente,
               cedula, plan, estatus, tipo_operacion, power_go, estado,
               municipio, parroquia, sector, canal, sede_taquilla, fuente
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              fechaIso,
              asesor,
              asesor,
              nombre,
              cedula,
              plan,
              estatus,
              operacion,
              powerGo,
              estado,
              municipio,
              parroquia,
              sector,
              canal,
              sede,
              fuente,
            ]
          );
          solCount++;
        }

        await client.query("COMMIT");
        console.log(`✅ ${solCount} solicitudes importadas exitosamente.`);
      }
    } catch (solErr) {
      console.warn("ℹ️ Aviso al importar SOLICITUDES:", solErr.message);
    }

    console.log("\n==================================================================");
    console.log("🎉 ¡IMPORTACIÓN COMPLETADA! Ahora PostgreSQL contiene todo el histórico.");
    console.log("==================================================================");
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Error en la importación de Google Sheets a PostgreSQL:", err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runImport();
