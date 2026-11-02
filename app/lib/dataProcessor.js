/**
 * Google Sheets API Utility
 * Handles all interactions with the Google Sheets API
 */

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

function formatToIsoDate(fechaStr) {
  if (!fechaStr) return "";
  const str = String(fechaStr).trim();
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    let d = parts[0].padStart(2, '0');
    let m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = "20" + y;
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return `${y}-${m}-${d}`;
  }
  return str;
}

function parseSheetData(values, sheetName) {
  if (!values || values.length === 0) return [];

  // Custom parser for SOLICITUDES
  if (sheetName && sheetName.toUpperCase().includes("SOLICITUDES")) {
    if (values.length <= 1) return [];
    const headers = values[0].map(h => String(h || "").trim().toUpperCase());
    
    const idxFecha = headers.findIndex(h => h.includes("FECHA TIMESTAMP") || h.includes("FECHA DE SOLICITUD") || h === "FECHA");
    const idxAsesor = headers.findIndex(h => h.includes("ASESOR NORMALIZADO") || h.includes("ASESOR"));
    const idxNombre = headers.findIndex(h => h.includes("NOMBRE Y APELLIDO") || h.includes("NOMBRE"));
    const idxEstatus = headers.findIndex(h => h === "ESTATUS");
    const idxCedula = headers.findIndex(h => h.includes("CEDULA") || h.includes("CÉDULA"));
    const idxPlan = headers.findIndex(h => h.includes("TIPO DE SERVICIO") || h.includes("PLAN"));
    const idxOperacion = headers.findIndex(h => h.includes("TIPO DE OPERACIÓN") || h.includes("OPERACION"));
    const idxPowerGo = headers.findIndex(h => h.includes("POWERGO") || h.includes("POWER GO"));
    const idxEstado = headers.findIndex(h => h === "ESTADO");
    const idxMunicipio = headers.findIndex(h => h === "MUNICIPIO");
    const idxParroquia = headers.findIndex(h => h === "PARROQUIA");
    const idxSector = headers.findIndex(h => h === "SECTOR");
    const idxUbicacion = headers.findIndex(h => h.includes("UBICACIÓN") || h.includes("UBICACION"));

    const idxCanal = headers.findIndex(h => h.includes("CANAL / GRUPO") || h.includes("CANAL"));
    const idxSede = headers.findIndex(h => h.includes("SEDE / TAQUILLA") || h.includes("SEDE"));
    const idxFuente = headers.findIndex(h => h === "FUENTE");

    const rawData = values.slice(1);
    return rawData.map((row, i) => {
      const rawFecha = idxFecha >= 0 && row[idxFecha] !== undefined ? String(row[idxFecha]).trim() : "";
      if (!rawFecha) return null;

      const fecha = formatToIsoDate(rawFecha);
      
      let mes = "UNKNOWN";
      if (fecha) {
        const parts = fecha.split('-');
        if (parts.length === 3) {
          const monthNum = parseInt(parts[1], 10);
          if (monthNum >= 1 && monthNum <= 12) {
            mes = MESES[monthNum - 1];
          }
        }
      }

      const asesor = idxAsesor >= 0 && row[idxAsesor] !== undefined ? String(row[idxAsesor]).trim() : "Sin Asesor";
      const estatus = idxEstatus >= 0 && row[idxEstatus] !== undefined ? String(row[idxEstatus]).trim() : "Pendiente";
      const nombre_cliente = idxNombre >= 0 && row[idxNombre] !== undefined ? String(row[idxNombre]).trim() : "";
      const cedula = idxCedula >= 0 && row[idxCedula] !== undefined ? String(row[idxCedula]).trim() : "";
      const plan = idxPlan >= 0 && row[idxPlan] !== undefined ? String(row[idxPlan]).trim() : "";
      const tipo_operacion = idxOperacion >= 0 && row[idxOperacion] !== undefined ? String(row[idxOperacion]).trim() : "Instalación";
      const power_go = idxPowerGo >= 0 && row[idxPowerGo] !== undefined && String(row[idxPowerGo]).trim().toUpperCase().includes("S") ? "SI" : "NO";
      const estado = idxEstado >= 0 && row[idxEstado] !== undefined ? String(row[idxEstado]).trim() : "";
      const municipio = idxMunicipio >= 0 && row[idxMunicipio] !== undefined ? String(row[idxMunicipio]).trim() : "";
      const zona = idxParroquia >= 0 && row[idxParroquia] !== undefined ? String(row[idxParroquia]).trim() : (estado || "N/A");
      const sector = idxSector >= 0 && row[idxSector] !== undefined ? String(row[idxSector]).trim() : "";
      const ubicacion = idxUbicacion >= 0 && row[idxUbicacion] !== undefined ? String(row[idxUbicacion]).trim() : "";
      const canal = idxCanal >= 0 && row[idxCanal] !== undefined ? String(row[idxCanal]).trim() : "";
      const sede_taquilla = idxSede >= 0 && row[idxSede] !== undefined ? String(row[idxSede]).trim() : "";
      const fuente = idxFuente >= 0 && row[idxFuente] !== undefined ? String(row[idxFuente]).trim() : "";

      return {
        id: i,
        created_at: new Date().toISOString(),
        fecha,
        mes,
        asesor,
        estatus,
        nombre_cliente,
        cedula,
        plan,
        tipo_operacion,
        power_go,
        estado,
        municipio,
        zona,
        sector,
        ubicacion,
        canal,
        sede_taquilla,
        fuente,
      };
    }).filter(Boolean);
  }

// Exact OFICINA mapping from Power BI
const OFICINA_MAP = {
  "CINDY INFANTE": "COMERCIALIZACION",
  "YAISEN HERRERA": "COMERCIALIZACION",
  "LORENA ESQUEDA": "COMERCIALIZACION",
  "ROXANA YEPEZ": "COMERCIALIZACION / EX-COLABORADOR",
  "CARLOS RUIZ": "COMERCIALIZACION",
  "MARIANGEL SOTO": "COMERCIALIZACION / EX-COLABORADOR",
  "GABRIELA TERMOTTO": "COMERCIALIZACION / EX-COLABORADOR",
  "HECTOR MENDOZA": "EL VALLE",
  "NEISBETH PRAZUELA": "EL VALLE",
  "DADIUSKA RINCONES": "PROPRATIA",
  "IVOON VIANA": "ALI PRIMERA",
  "VIVIANA CARREÑO": "ALI PRIMERA",
  "LISBRAY SUAREZ": "LA COLINA",
  "ESMERALDA DELGADO": "LA COLINA",
  "YENIFFER TORRES": "LA COLINA",
  "PLANIFICACION": "PLANIFICACION",
  "RODGER INFANTE": "INDEPENDENCIA",
  "ALEJANDRO SANCHEZ": "INDEPENDENCIA",
  "MARIA QUINTERO": "COMERCIALIZACION / EX-COLABORADOR",
  "HAYMAR BARROS": "COMERCIALIZACION",
  "PATRICIA MENDOZA": "COMERCIALIZACION",
  "YAIRLIN ROJAS": "COMERCIALIZACION / EX-COLABORADOR",
  "GENESIS OCHOA": "COMERCIALIZACION",
  "YESENIA TERAN": "COMERCIALIZACION",
  "YANELY DAVILA": "COMERCIALIZACION / EX-COLABORADOR",
  "SALEM CALDERA": "COMERCIALIZACION / EX-COLABORADOR",
  "MICHEL OCHOA": "COMERCIALIZACION / EX-COLABORADOR",
  "DIEGO RODRIGUEZ": "COMERCIALIZACION / EX-COLABORADOR",
  "BRAYERLYN RODRIGUEZ": "COMERCIALIZACION / EX-COLABORADOR",
  "DANIEL FIGUERA": "COMERCIALIZACION / EX-COLABORADOR",
  "DEVI ALAYON": "COMERCIALIZACION / EX-COLABORADOR",
  "ACCEL MORENO": "COMERCIALIZACION / EX-COLABORADOR",
  "BRANIN BERROTERAN": "COMERCIALIZACION",
  "ROSNY REYNA": "COMERCIALIZACION / EX-COLABORADOR",
  "YULEISY CAMPOMAS": "TEJERIAS",
  "BARBARA MARQUEZ": "ALI PRIMERA",
  "JOHANIR CAÑIZALES": "EL VALLE",
  "STEPHANY MANRIQUE": "COMERCIALIZACION",
  "DAIANA TORRES": "COMERCIALIZACION",
  "SHEREZADE GIL": "LA COLINA",
  "CARLA FIGUEROA": "COMERCIALIZACION / EX-COLABORADOR",
  "GREACIE CRUZADO": "COMERCIALIZACION / EX-COLABORADOR",
  "GABRIELA MARRERO": "COMERCIALIZACION",
  "YILDA GONZALEZ": "COMERCIALIZACION",
  "JOHANA PARRA": "COMERCIALIZACION / EX-COLABORADOR",
  "XAHORY GOMEZ": "COMERCIALIZACION / EX-COLABORADOR",
  "YOSMERY HERNANDEZ": "COMERCIALIZACION / EX-COLABORADOR",
  "YULIANA CARVAJAL": "COMERCIALIZACION",
  "YINNEIDY RIVAS": "COMERCIALIZACION",
  "MARIA AZUAJE": "COMERCIALIZACION",
  "ARIANNA MONTAÑA": "COMERCIALIZACION",
  "DIARNELIS MENDOZA": "COMERCIALIZACION",
  "YAMERY RODRIGUEZ": "COMERCIALIZACION",
  "YEYLIS PUENTE": "COMERCIALIZACION",
  "ANDREA PLAZA": "COMERCIALIZACION",
  "ARIADNE MANRIQUE": "CALL CENTER",
  "SEBASTIAN RODRIGUEZ": "CALL CENTER",
  "JAFET MAURO": "CALL CENTER",
  "STEPHANIE CONTRERAS": "EL VALLE"
};

function getEstadoFromZona(zonaStr) {
  const z = String(zonaStr || "").toUpperCase().trim();
  if (z.startsWith("LOS TEQUES")) return "MIRANDA";
  if (z.startsWith("SAN DIEGO")) return "MIRANDA";
  if (z.startsWith("SAN ANTONIO")) return "MIRANDA";
  if (z.startsWith("CARRIZAL")) return "MIRANDA";
  if (z.startsWith("TEJERIAS")) return "ARAGUA";
  if (z.startsWith("DISTRITO CAPITAL")) return "DISTRITO CAPITAL";
  if (z.startsWith("EL CONSEJO")) return "ARAGUA";
  return null;
}

function parseCurrencyVal(val) {
  if (val === undefined || val === null || val === "") return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
  return isNaN(num) ? 0 : num;
}

  // Custom parser for CUADRO DIARIO (matching Power BI Power Query cleaning pipeline)
  if (sheetName && sheetName.toUpperCase().includes("CUADRO DIARIO")) {

    if (values.length <= 2) return [];
    const rawData = values.slice(2); // Skip first 2 header rows
    return rawData.map((row, i) => {
      // 1. FECHA: must not be empty or "FECHA" (Power BI: [FECHA] <> "" and [FECHA] <> "FECHA")
      const rawFecha = row[1] !== undefined ? String(row[1]).trim() : "";
      if (!rawFecha || rawFecha.toUpperCase() === "FECHA") return null;

      // 2. ESTATUS: must not be empty (Power BI: [ESTATUS] <> "")
      const rawEstatus = row[13] !== undefined ? String(row[13]).trim() : "";
      if (!rawEstatus || rawEstatus === "" || rawEstatus.toUpperCase() === "ESTATUS") return null;

      // 3. CLIENTE / CÉDULA: Debe tener al menos cliente o cédula para ser un registro válido (ignorar cupos vacíos en blanco)
      const nombre_cliente = row[8] !== undefined ? String(row[8]).trim() : "";
      const cedula = row[9] !== undefined ? String(row[9]).trim() : "";
      if (!nombre_cliente && !cedula) return null;

      const fecha = formatToIsoDate(rawFecha);
      const mes = row[2] !== undefined ? String(row[2]).trim().toUpperCase() : "UNKNOWN";
      
      // Equipo (col D=3) - e.g. "EQUIPO A"
      const equipo = row[3] !== undefined ? String(row[3]).trim().toUpperCase() : "";

      // Tecnico 1 (col E=4), Tecnico 2 (col F=5)
      const tecnico_1 = row[4] !== undefined ? String(row[4]).trim() : "";
      const tecnico_2 = row[5] !== undefined ? String(row[5]).trim() : null;
      
      // Router (col G=6) - Power BI replaces empty with "0"
      const router = (row[6] === "" || row[6] == null) ? "0" : String(row[6]).trim();
      
      // Zona (col K=10), Sector (col L=11)
      const zona = row[10] !== undefined ? String(row[10]).trim().toUpperCase() : "";
      const sector = row[11] !== undefined ? String(row[11]).trim().toUpperCase() : "";
      
      // Asesor (col M=12)
      const asesor = row[12] !== undefined ? String(row[12]).toUpperCase().trim() : "";
      
      // Estatus (col N=13) - Power BI: Replace "INSTALACION." with "INSTALACION"
      const estatus = rawEstatus.replace("INSTALACION.", "INSTALACION").toUpperCase();
      
      // Plan (col O=14) - Power BI: Replace MBM/MBC/MBE with MB, GBC with GB
      const plan = row[14] !== undefined 
        ? String(row[14]).toUpperCase().replace(/MB[MCE]/g, "MB").replace("GBC", "GB").trim() 
        : "";
      
      // Power Go (col P=15)
      const power_go = row[15] !== undefined && String(row[15]).trim().toUpperCase() === "SI" ? "SI" : "NO";
      
      // SERVICIO - Power BI: if Text.StartsWith([CEDULA], "G") or "J" then "CORPORATIVO" else "RESIDENCIAL"
      const cleanCedula = cedula.toUpperCase().trim();
      const servicio = (cleanCedula.startsWith("G") || cleanCedula.startsWith("J")) ? "CORPORATIVO" : "RESIDENCIAL";
      
      // OFICINA - Power BI mapping
      const oficina = OFICINA_MAP[asesor] || "OTROS";
      
      // ESTADO (Personalizado) - Power BI conditional mapping based on ZONA
      const estado = getEstadoFromZona(zona);

      // Financials (Columns 17 to 23)
      const dolares = parseCurrencyVal(row[16]);
      const pago_movil = parseCurrencyVal(row[17]);
      const zelle = parseCurrencyVal(row[18]);
      const bolivares = parseCurrencyVal(row[19]);
      const transferencia = parseCurrencyVal(row[20]);
      const retenciones = parseCurrencyVal(row[22]);

      return {
        id: i,
        created_at: new Date().toISOString(),
        fecha: fecha,
        mes: mes,
        tecnico_1: tecnico_1,
        tecnico_2: tecnico_2,
        router: router,
        nombre_cliente: nombre_cliente,
        cedula: cedula,
        zona: zona,
        sector: sector,
        asesor: asesor,
        equipo: equipo,
        estatus: estatus,
        plan: plan,
        power_go: power_go,
        servicio: servicio,
        oficina: oficina,
        estado: estado,
        dolares: dolares,
        pago_movil: pago_movil,
        zelle: zelle,
        bolivares: bolivares,
        transferencia: transferencia,
        retenciones: retenciones,
      };
    }).filter(Boolean);
  }

  // Custom parser for PLANIFICACION (Sheet "Data")
  if (sheetName && (sheetName.toUpperCase() === "DATA" || sheetName.toUpperCase().includes("PLANIFICACION"))) {
    if (values.length < 2) return [];
    const headers = values[0].map(h => String(h || "").trim().toUpperCase());

    const idxMes = headers.findIndex(h => h === "MES");
    const idxFecha = headers.findIndex(h => h === "FECHA");
    const idxAsesor = headers.findIndex(h => h === "ASESOR");
    const idxEstado = headers.findIndex(h => h === "ESTADO");
    const idxMunicipio = headers.findIndex(h => h === "MUNICIPIO");
    const idxParroquia = headers.findIndex(h => h === "PARROQUIA");
    const idxSector = headers.findIndex(h => h === "SECTOR");
    const idxActividad = headers.findIndex(h => h.includes("ACTIVIDAD"));
    const idxEstatus = headers.findIndex(h => h === "ESTATUS");

    return values.slice(1).map((row, i) => {
      const rawFecha = idxFecha >= 0 && row[idxFecha] !== undefined ? String(row[idxFecha]).trim() : "";
      if (!rawFecha || rawFecha.toUpperCase() === "FECHA") return null;

      const mes = idxMes >= 0 && row[idxMes] !== undefined ? String(row[idxMes]).trim().toUpperCase() : "";
      const asesor = idxAsesor >= 0 && row[idxAsesor] !== undefined ? String(row[idxAsesor]).trim().toUpperCase() : "";
      const sector = idxSector >= 0 && row[idxSector] !== undefined ? String(row[idxSector]).trim() : "";
      const parroquia = idxParroquia >= 0 && row[idxParroquia] !== undefined ? String(row[idxParroquia]).trim() : "";
      const municipio = idxMunicipio >= 0 && row[idxMunicipio] !== undefined ? String(row[idxMunicipio]).trim() : "";
      const estado = idxEstado >= 0 && row[idxEstado] !== undefined ? String(row[idxEstado]).trim() : "";
      const estatus = idxEstatus >= 0 && row[idxEstatus] !== undefined ? String(row[idxEstatus]).trim() : "Planificado";
      const actividad = idxActividad >= 0 && row[idxActividad] !== undefined ? String(row[idxActividad]).trim() : "";

      return {
        id: i,
        created_at: new Date().toISOString(),
        fecha: formatToIsoDate(rawFecha),
        mes: mes,
        asesor: asesor,
        sector: sector,
        parroquia: parroquia,
        municipio: municipio,
        tipo_actividad: actividad,
        zona: parroquia, // Parroquia explícita de la hoja
        oficina: municipio, // Municipio explícito de la hoja
        estado: estado,
        estatus: estatus,
        plan: actividad,
        servicio: "RESIDENCIAL",
        power_go: "NO",
      };
    }).filter(Boolean);
  }

  // Generic parser for other sheets (e.g. DATA LIMPIA)
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim().toUpperCase());
  return values.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((header, j) => {
      obj[header] = row[j] !== undefined ? String(row[j]).trim() : "";
    });

    const rawFecha = obj["FECHA"] || obj["fecha"] || "";
    if (!rawFecha || rawFecha.toUpperCase() === "FECHA") return null;

    const zona = (obj["ZONA"] || obj["zona"] || "").toUpperCase();
    const asesor = (obj["ASESOR"] || obj["asesor"] || "").toUpperCase();
    const estatus = (obj["ESTATUS"] || obj["estatus"] || "").replace("INSTALACION.", "INSTALACION").toUpperCase();

    return {
      id: i,
      created_at: new Date().toISOString(),
      fecha: formatToIsoDate(rawFecha),
      mes: (obj["MES"] || obj["mes"] || "").toUpperCase(),
      tecnico_1: obj["TECNICO 1"] || obj["tecnico_1"] || "",
      tecnico_2: obj["TECNICO 2"] || obj["tecnico_2"] || null,
      router: obj["RAUTER"] || obj["ROUTER"] || obj["router"] || null,
      nombre_cliente: obj["NOMBRE"] || obj["nombre"] || obj["nombre_cliente"] || "",
      cedula: obj["CEDULA"] || obj["cedula"] || "",
      zona: zona,
      sector: (obj["SECTOR"] || obj["sector"] || "").toUpperCase(),
      asesor: asesor,
      estatus: estatus,
      plan: (obj["PLAN"] || obj["plan"] || "").toUpperCase().replace(/MB[MCE]/g, "MB").replace("GBC", "GB"),
      power_go: (obj["POWER GO"] || obj["power_go"] || "").toUpperCase() === "SI" ? "SI" : "NO",
      servicio: obj["SERVICIO"] || obj["servicio"] || "RESIDENCIAL",
      oficina: (obj["OFICINA"] || obj["oficina"] || (asesor === "TAQUILLA" ? "OFICINA PRINCIPAL" : "OTROS")).toUpperCase(),
      estado: obj["ESTADO"] || obj["estado"] || ((zona === "DISTRITO CAPITAL" || zona === "D.C.") ? "D.C." : (zona === "TEJERIAS" || zona === "EL CONSEJO") ? "ARAGUA" : "MIRANDA")
    };
  }).filter(Boolean);
}

/**
 * Process transactional data into a pivot table summary.
 * Groups by (ASESOR, ZONA, SECTOR) with MES as columns.
 */
function buildPivotTable(records, includeAllCombinations = false, confRecords = null) {
  const map = new Map();

  // Clean and count
  for (const row of records) {
    const asesor = (row.ASESOR || "").toUpperCase().trim();
    const zona = (row.ZONA || "").toUpperCase().trim();
    const sector = (row.SECTOR || "").toUpperCase().trim();
    const mes = (row.MES || "").toUpperCase().trim();

    if (!asesor || !zona || !sector) continue;

    const key = `${asesor}__${zona}__${sector}`;

    if (!map.has(key)) {
      const entry = { ASESOR: asesor, ZONA: zona, SECTOR: sector, TOTAL: 0 };
      MESES.forEach(m => entry[m] = 0);
      map.set(key, entry);
    }

    const item = map.get(key);
    if (MESES.includes(mes)) {
      item[mes] += 1;
      item.TOTAL += 1;
    }
  }

  // If full matrix requested with CONF data, generate cartesian product
  if (includeAllCombinations && confRecords && confRecords.length > 0) {
    const uniqueAsesores = [...new Set(records.map(r => (r.ASESOR || "").toUpperCase().trim()).filter(Boolean))];
    const uniqueSectores = [...new Set(confRecords.map(r => {
      const sector = (r.SECTOR || r.NOMBRE || "").toUpperCase().trim();
      const zona = (r.ZONA || "").toUpperCase().trim();
      return { sector, zona };
    }).filter(s => s.sector))];

    for (const asesor of uniqueAsesores) {
      for (const { sector, zona } of uniqueSectores) {
        const key = `${asesor}__${zona}__${sector}`;
        if (!map.has(key)) {
          const entry = { ASESOR: asesor, ZONA: zona, SECTOR: sector, TOTAL: 0 };
          MESES.forEach(m => entry[m] = 0);
          map.set(key, entry);
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.ASESOR.localeCompare(b.ASESOR) || a.ZONA.localeCompare(b.ZONA) || a.SECTOR.localeCompare(b.SECTOR)
  );
}

/**
 * Compute summary statistics from pivot data
 */
function computeStats(pivotData) {
  const totalInstalaciones = pivotData.reduce((sum, r) => sum + r.TOTAL, 0);
  const asesores = new Set(pivotData.map(r => r.ASESOR));
  const zonas = new Set(pivotData.map(r => r.ZONA));
  const sectores = new Set(pivotData.map(r => r.SECTOR));

  // Monthly totals
  const monthlyTotals = {};
  MESES.forEach(m => {
    monthlyTotals[m] = pivotData.reduce((sum, r) => sum + r[m], 0);
  });

  // Top asesores
  const asesorTotals = {};
  pivotData.forEach(r => {
    asesorTotals[r.ASESOR] = (asesorTotals[r.ASESOR] || 0) + r.TOTAL;
  });
  const topAsesores = Object.entries(asesorTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, total]) => ({ name, total }));

  // Zone totals
  const zonaTotals = {};
  pivotData.forEach(r => {
    zonaTotals[r.ZONA] = (zonaTotals[r.ZONA] || 0) + r.TOTAL;
  });
  const zonaBreakdown = Object.entries(zonaTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({ name, total }));

  // Best month
  const bestMonth = Object.entries(monthlyTotals)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalInstalaciones,
    totalAsesores: asesores.size,
    totalZonas: zonas.size,
    totalSectores: sectores.size,
    monthlyTotals,
    topAsesores,
    zonaBreakdown,
    bestMonth: bestMonth ? { name: bestMonth[0], value: bestMonth[1] } : null,
    meses: MESES
  };
}

export { parseSheetData, buildPivotTable, computeStats, MESES };
