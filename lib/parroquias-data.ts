/**
 * Diccionario canónico de Parroquias y Municipios para Sectores
 * Cobertura: Distrito Capital (Libertador), Miranda (Altos Mirandinos), Aragua (Santos Michelena/Revenga)
 */

export interface ParroquiaInfo {
  parroquia: string;
  municipio: string;
  estado: string;
}

// Mapeo directo por nombre normalizado de sector (sin acentos, mayúsculas)
const SECTOR_TO_PARROQUIA: Record<string, ParroquiaInfo> = {
  // DISTRITO CAPITAL - Municipio Libertador
  // Parroquia Sucre (Catia)
  "PROPATRIA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CATIA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CASALTA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "PEREZ BONALDE": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "GRAMOVEN": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "ISAIAS MEDINA ANGARITA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS MAGALLANES": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "VISTA AL MAR": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CASA BLANCA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE COLOMBIA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE ARGENTINA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE MEXICO": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE CHILE": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LA SILSA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "EL CUARTEL": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LOMAS DE URDANETA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LA CORTADA DE CATIA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "CIUDAD TABLITAS": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LAS CASITAS": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LAS DOS ROSAS": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "LA AMAPOLA": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },
  "5 DE JULIO": { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" },

  // Parroquia El Valle
  "EL VALLE": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "C.C. EL VALLE": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "SAN ANTONIO DEL VALLE": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "RES. SAN ANTONIO": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS JARDINES": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS JARDINES DEL VALLE": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CERRO GRANDE": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "BRUZUAL": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CAJIGAL": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "RES. SAN ANDRES": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "RES. SAN ANDRÉS": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "SAN ANDRES": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "SAN ANDRÉS": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "GALLO ROJO": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "LAS MALVINAS": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "LA PEDRERA": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "EL SETENTA (EL 70)": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "EL 70": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE 1": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE 2": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE 10": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE 15": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "CALLE 18": { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS ROSALES": { parroquia: "San Pedro", municipio: "Libertador", estado: "Distrito Capital" },

  // Parroquia Coche
  "COCHE": { parroquia: "Coche", municipio: "Libertador", estado: "Distrito Capital" },
  "DELICIAS": { parroquia: "Coche", municipio: "Libertador", estado: "Distrito Capital" },
  "LAS MAYAS": { parroquia: "Coche", municipio: "Libertador", estado: "Distrito Capital" },
  "TURMERITO": { parroquia: "Coche", municipio: "Libertador", estado: "Distrito Capital" },

  // Parroquia La Vega
  "LA VEGA": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LA VEGA (CASCO CENTRAL)": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS MANGOS": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS CANGILONES": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LAS MARIAS": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LAS TORRES": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LOS PARAPAROS": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "EL CARMEN": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "EL PETROLEO": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "EL PETRÓLEO": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "EL MILAGRO": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },
  "LA VEGUITA": { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" },

  // Otras Parroquias de Libertador
  "ALTAGRACIA": { parroquia: "Altagracia", municipio: "Libertador", estado: "Distrito Capital" },
  "SAN AGUSTIN": { parroquia: "San Agustín", municipio: "Libertador", estado: "Distrito Capital" },
  "SAN PEDRO": { parroquia: "San Pedro", municipio: "Libertador", estado: "Distrito Capital" },
  "SANTA ROSALIA": { parroquia: "Santa Rosalía", municipio: "Libertador", estado: "Distrito Capital" },
  "EL RECREO": { parroquia: "El Recreo", municipio: "Libertador", estado: "Distrito Capital" },
  "CARICUAO": { parroquia: "Caricuao", municipio: "Libertador", estado: "Distrito Capital" },
  "ANTIMANO": { parroquia: "Antímano", municipio: "Libertador", estado: "Distrito Capital" },
  "MACARAO": { parroquia: "Macarao", municipio: "Libertador", estado: "Distrito Capital" },
  "EL PARAISO": { parroquia: "El Paraíso", municipio: "Libertador", estado: "Distrito Capital" },
  "SAN JUAN": { parroquia: "San Juan", municipio: "Libertador", estado: "Distrito Capital" },
  "LA PASTORA": { parroquia: "La Pastora", municipio: "Libertador", estado: "Distrito Capital" },
  "23 DE ENERO": { parroquia: "23 de Enero", municipio: "Libertador", estado: "Distrito Capital" },

  // MIRANDA - Municipio Guaicaipuro (Los Teques)
  "LOS TEQUES": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "CENTRO LOS TEQUES": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "CASCO CENTRAL": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "LA MATICA": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "EL NACIONAL": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "EL CABOTAJE": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "EL VIGIA": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "EL PASO": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "EL BARBECHO": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "EL ENCANTO": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "RES. EL CHORRITO": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "URB. SIMON BOLIVAR": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "LAGUNETICA": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "GUAREMAL": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "PALO ALTO": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "CUMBRE ROJAS": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "LA HOYADA": { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" },
  "SAN PEDRO DE LOS ALTOS": { parroquia: "San Pedro de los Altos", municipio: "Guaicaipuro", estado: "Miranda" },
  "CECILIO ACOSTA": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },
  "SAN DIEGO": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },
  "SAN JOSE DE LOS ALTOS": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },
  "CORTADA DEL GUAYABO": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },
  "CORTADA DE PAPELON": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },
  "AGUA FRIA": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },
  "AGUA FRÍA": { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" },

  // MIRANDA - Municipio Los Salias (San Antonio)
  "SAN ANTONIO": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "SAN ANTONIO DE LOS ALTOS": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "KM 8": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "LOS HELECHOS": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "RES. OPS": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "LA ROSALEDA": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "LOS CASTORES": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "EL LIMON": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "POTRERO DEL MEDIO": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "LOS AMARILLOS": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },
  "C.C. LA CASCADA": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "C.C. CLUB DE CAMPO": { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" },

  // MIRANDA - Municipio Carrizal
  "CARRIZAL": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "KM 18": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "KM. 18": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "MONTAÑA ALTA": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "LLANO ALTO": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "BRISAS DE ORIENTE": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "BARRIO BOLIVAR": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "YERBA BUENA": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },
  "COLINAS DE CARRIZAL": { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" },

  // ARAGUA - Santos Michelena (Las Tejerías)
  "LAS TEJERIAS": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "TEJERIAS": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "EL PUEBLO": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "EL BEISBOL": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "LA MORITA": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "JABILLAL": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "CURIEPE": { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" },
  "TIARA": { parroquia: "Tiara", municipio: "Santos Michelena", estado: "Aragua" },

  // ARAGUA - José Rafael Revenga (El Consejo)
  "EL CONSEJO": { parroquia: "El Consejo", municipio: "José Rafael Revenga", estado: "Aragua" },
  "SABANETA": { parroquia: "El Consejo", municipio: "José Rafael Revenga", estado: "Aragua" },
};

function cleanStr(s?: string): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\?A/g, "NA")
    .replace(/\?/g, "")
    .trim();
}

const resolveCache = new Map<string, ParroquiaInfo>();

/**
 * Resuelve la Parroquia y Municipio de un sector dado su nombre y opcionalmente su Estado (con memoización rápida)
 */
export function resolveParroquia(sectorRaw?: string, estadoRaw?: string): ParroquiaInfo {
  const cacheKey = `${sectorRaw || ""}_${estadoRaw || ""}`;
  const cached = resolveCache.get(cacheKey);
  if (cached) return cached;

  const result = _resolveParroquiaInternal(sectorRaw, estadoRaw);
  resolveCache.set(cacheKey, result);
  return result;
}

function _resolveParroquiaInternal(sectorRaw?: string, estadoRaw?: string): ParroquiaInfo {
  const s = cleanStr(sectorRaw);
  const e = cleanStr(estadoRaw);

  // 1. Coincidencia directa validando si el estado concuerda cuando está disponible
  if (SECTOR_TO_PARROQUIA[s]) {
    const match = SECTOR_TO_PARROQUIA[s];
    const matchE = cleanStr(match.estado);
    if (!e || !matchE || e.includes(matchE) || matchE.includes(e)) {
      return match;
    }
  }

  // Miranda specific disambiguations
  if (e.includes("MIRANDA")) {
    if (s.includes("SAN PEDRO")) return { parroquia: "San Pedro de los Altos", municipio: "Guaicaipuro", estado: "Miranda" };
    if (s.includes("RES. SAN ANTONIO") || s.includes("SAN ANTONIO")) return { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" };
  }

  // 2. Coincidencia por sub-cadena conocida
  for (const [key, info] of Object.entries(SECTOR_TO_PARROQUIA)) {
    if (s.includes(key) || key.includes(s)) {
      const infoE = cleanStr(info.estado);
      if (!e || !infoE || e.includes(infoE) || infoE.includes(e)) {
        return info;
      }
    }
  }

  // 3. Fallbacks inteligentes según Estado
  if (e.includes("DISTRITO") || e.includes("CAPITAL") || e === "D.C.") {
    if (s.includes("VALLE")) return { parroquia: "El Valle", municipio: "Libertador", estado: "Distrito Capital" };
    if (s.includes("COCHE") || s.includes("MAYA")) return { parroquia: "Coche", municipio: "Libertador", estado: "Distrito Capital" };
    if (s.includes("VEGA")) return { parroquia: "La Vega", municipio: "Libertador", estado: "Distrito Capital" };
    return { parroquia: "Sucre (Catia)", municipio: "Libertador", estado: "Distrito Capital" };
  }

  if (e.includes("ARAGUA")) {
    if (s.includes("CONSEJO") || s.includes("SABANETA")) {
      return { parroquia: "El Consejo", municipio: "José Rafael Revenga", estado: "Aragua" };
    }
    return { parroquia: "Las Tejerías", municipio: "Santos Michelena", estado: "Aragua" };
  }

  if (e.includes("MIRANDA")) {
    if (s.includes("ANTONIO") || s.includes("ROSALEDA") || s.includes("CASTORES")) {
      return { parroquia: "San Antonio de los Altos", municipio: "Los Salias", estado: "Miranda" };
    }
    if (s.includes("CARRIZAL") || s.includes("MONTA")) {
      return { parroquia: "Carrizal", municipio: "Carrizal", estado: "Miranda" };
    }
    if (s.includes("DIEGO") || s.includes("GUAYABO") || s.includes("JOSE")) {
      return { parroquia: "Cecilio Acosta", municipio: "Guaicaipuro", estado: "Miranda" };
    }
    return { parroquia: "Los Teques", municipio: "Guaicaipuro", estado: "Miranda" };
  }

  return {
    parroquia: s || "Sin Parroquia",
    municipio: "No Especificado",
    estado: estadoRaw || "N/A"
  };
}

/**
 * Normaliza y homologa el nombre canónico de un Municipio venezolano
 */
export function normalizeMunicipio(mun?: string | null): string {
  if (!mun) return "";
  const clean = mun.trim();
  const upper = clean
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (upper.includes("SANTOS") && upper.includes("MICHELENA")) return "Santos Michelena";
  if (upper.includes("SALIAS")) return "Los Salias";
  if (upper.includes("CARRIZAL")) return "Carrizal";
  if (upper.includes("GUAICAIPURO")) return "Guaicaipuro";
  if (upper.includes("LIBERTADOR")) return "Libertador";
  if (upper.includes("REVENGA") || upper.includes("CONSEJO")) return "José Rafael Revenga";
  if (upper.includes("NO ESPECIFICADO") || upper.includes("SIN MUNICIPIO") || upper === "N/A") return "";

  return clean;
}

/**
 * Normaliza y homologa el nombre canónico de una Parroquia venezolana
 * Resuelve discrepancias entre "San Antonio" / "San Antonio de los Altos", "San Diego" / "Cecilio Acosta",
 * "Distrito Capital" (que es Estado) -> Parroquia real por sector (Sucre, El Valle, Coche, La Vega),
 * "Tejerías" / "Las Tejerías", etc.
 */
export function normalizeParroquia(
  rawParroquia?: string | null,
  sector?: string | null,
  estado?: string | null
): string {
  const p = (rawParroquia || "").trim();
  const upperP = p
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Si la zona es "DISTRITO CAPITAL" o similar (como en Cuadro Diario), es un Estado, no una Parroquia.
  // Resolvemos la Parroquia real mediante el sector (Propatria -> Sucre, El Valle -> El Valle, etc.)
  if (upperP.includes("DISTRITO") || upperP.includes("CAPITAL") || upperP === "D.C.") {
    const geo = resolveParroquia(sector || "", estado || "Distrito Capital");
    return geo.parroquia || "Sucre (Catia)";
  }

  // Canonical mapping por coincidencias de nombre de parroquia
  if (upperP.includes("CECILIO") || upperP.includes("SAN DIEGO") || upperP.includes("SAN JOSE")) {
    return "Cecilio Acosta";
  }
  if (upperP.includes("SAN PEDRO")) {
    return "San Pedro de los Altos";
  }
  if (upperP.includes("ANTONIO")) {
    return "San Antonio de los Altos";
  }
  if (upperP.includes("TEJERIA")) {
    return "Las Tejerías";
  }
  if (upperP.includes("CONSEJO")) {
    return "El Consejo";
  }
  if (upperP.includes("CARRIZAL")) {
    return "Carrizal";
  }
  if (upperP.includes("LOS TEQUES") || upperP === "TEQUES") {
    return "Los Teques";
  }
  if (upperP.includes("VALLE")) {
    return "El Valle";
  }
  if (upperP.includes("COCHE")) {
    return "Coche";
  }
  if (upperP.includes("VEGA")) {
    return "La Vega";
  }
  if (upperP.includes("CATIA") || upperP.includes("SUCRE") || upperP.includes("PROPATRIA")) {
    return "Sucre (Catia)";
  }

  // Si no coincidió y hay sector disponible, resolver mediante el sector
  if (sector && sector.trim() !== "") {
    const geo = resolveParroquia(sector, estado || undefined);
    if (geo.parroquia && geo.parroquia !== "Sin Parroquia" && !geo.parroquia.toUpperCase().includes("ESPECIFICADO")) {
      return geo.parroquia;
    }
  }

  if (p && !upperP.includes("ESPECIFICADO") && !upperP.includes("SIN PARROQUIA") && upperP !== "N/A") {
    return p;
  }

  return "";
}

