/**
 * lib/geo_normalization.ts
 *
 * Motor Canónico de Normalización Territorial y Homologación Geográfica.
 * Fuente de la verdad absoluta (Master Data): CUADRO DIARIO (11.990 registros operativos de red).
 * 
 * Resuelve y homologa textos libres o variantes de:
 * 1. Planificación Comercial (rutas de asesores)
 * 2. Solicitudes de Clientes (formularios de prospectos y WhatsApp)
 * hacia los ~235 sectores canónicos oficiales agrupados en las 7 Zonas operativas.
 */

export interface CanonicalLocationResult {
  sector: string;        // Sector canónico oficial del Cuadro Diario
  subsector: string;     // Nombre original detallado (calle, edificio, barrio específico)
  zona: string;          // Zona operativa canónica (Los Teques, San Antonio, Carrizal, San Diego, Distrito Capital, Tejerías, El Consejo)
  parroquia: string;     // Parroquia canónica
  municipio: string;     // Municipio canónico
  estado: string;        // Estado canónico (Miranda, Distrito Capital, Aragua)
  isRecognized: boolean; // Si fue homologado con éxito contra el padrón oficial
}

export interface GeoLocationInput {
  sector?: string | null;
  ubicacion?: string | null;
  zona?: string | null;
  parroquia?: string | null;
  municipio?: string | null;
  estado?: string | null;
}

/**
 * Normaliza una cadena para comparaciones geográficas insensibles a mayúsculas, tildes y caracteres especiales.
 */
export const normGeoKey = (str: string | null | undefined): string => {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

/**
 * Valida si un texto es un nombre geográfico legítimo y descarta etiquetas administrativas o vacías.
 */
export const isValidGeoName = (val: string | null | undefined): boolean => {
  if (!val) return false;
  const clean = val.trim().toUpperCase();
  return (
    clean !== "" &&
    clean !== "N/A" &&
    clean !== "NA" &&
    clean !== "OTROS" &&
    clean !== "OTRO" &&
    clean !== "SIN SECTOR" &&
    clean !== "SIN ASESOR" &&
    clean !== "DESCONOCIDO" &&
    clean !== "CALL CENTER" &&
    clean !== "COMERCIALIZACION" &&
    clean !== "COMERCIALIZACION / EX-COLABORADOR" &&
    clean !== "ALI PRIMERA" &&
    clean !== "SEDE" &&
    clean !== "OFICINA" &&
    clean !== "SIN MUNICIPIO" &&
    clean !== "DIVISAS DE INSTALACIONES" &&
    clean !== "PAGO MOVIL. DE INSTALACIONES" &&
    clean !== "EFECTIVO BS DE INSTALACIONES" &&
    clean !== "TRANSF. DE INSTALACIONES"
  );
};

// ============================================================================
// 1. ESTRUCTURA CANÓNICA DE LAS 7 ZONAS OPERATIVAS (CUADRO DIARIO)
// ============================================================================

export const CANONICAL_ZONES_CONFIG: Record<
  string,
  {
    estado: string;
    municipio: string;
    parroquiaDefault: string;
    sectorDefault: string;
    parroquiasMap?: Record<string, string>; // sector canónico -> parroquia específica
  }
> = {
  "SAN ANTONIO": {
    estado: "Miranda",
    municipio: "Los Salias",
    parroquiaDefault: "San Antonio de los Altos",
    sectorDefault: "El Pueblo",
  },
  "CARRIZAL": {
    estado: "Miranda",
    municipio: "Carrizal",
    parroquiaDefault: "Carrizal",
    sectorDefault: "Casco Central",
  },
  "SAN DIEGO": {
    estado: "Miranda",
    municipio: "Guaicaipuro",
    parroquiaDefault: "Cecilio Acosta",
    sectorDefault: "Casco Central",
  },
  "LOS TEQUES": {
    estado: "Miranda",
    municipio: "Guaicaipuro",
    parroquiaDefault: "Los Teques",
    sectorDefault: "Centro Los Teques",
    parroquiasMap: {
      "San Pedro": "San Pedro de los Altos",
      "Pozo de Rosas": "San Pedro de los Altos",
    },
  },
  "DISTRITO CAPITAL": {
    estado: "Distrito Capital",
    municipio: "Libertador",
    parroquiaDefault: "Sucre",
    sectorDefault: "Propatria",
    parroquiasMap: {
      "Propatria": "Sucre",
      "El Valle": "El Valle",
      "Coche": "Coche",
      "Las Mayas": "Coche",
      "La Vega": "La Vega",
    },
  },
  "TEJERIAS": {
    estado: "Aragua",
    municipio: "Santos Michelena",
    parroquiaDefault: "Las Tejerías",
    sectorDefault: "Casco Central",
  },
  "EL CONSEJO": {
    estado: "Aragua",
    municipio: "José Rafael Revenga",
    parroquiaDefault: "El Consejo",
    sectorDefault: "Corosito",
  },
};

// ============================================================================
// 2. PADRÓN DE SECTORES OFICIALES POR ZONA (EXTRAÍDO DEL CUADRO DIARIO)
// ============================================================================

export const CANONICAL_SECTORS_BY_ZONE: Record<string, string[]> = {
  "SAN ANTONIO": [
    "Bosque Alegre",
    "C.C. Coliseo",
    "C.C. Galería Las Américas",
    "C.C. La Colina",
    "C.C. Ops",
    "C.C. Cepan",
    "C.C. Club de Campo",
    "C.C. Don Blas",
    "C.C. La Casona 2",
    "Club de Campo",
    "Edif. Santa Rosa",
    "El Amarillo",
    "El Limón",
    "El Páramo",
    "El Pueblo",
    "El Retiro",
    "El Sitio",
    "Km 8",
    "La Gonzalera",
    "La Morita",
    "La Oveja Negra",
    "La Rosaleda",
    "Las Cumbres",
    "Las Minas",
    "Las Polonias",
    "Los Castores",
    "Los Helechos",
    "Los Llaneros",
    "Res. El Rocío",
    "Res. Las Churuatas",
    "Res. Nazareth",
    "Res. Ops",
    "Res. San Antonio",
    "Rosaleda Norte",
    "Sierra Brava",
    "Urb. Pomarrosa",
    "Zona Industrial Las Minas",
  ],
  "CARRIZAL": [
    "Barola",
    "Barrio Bolívar",
    "Brisas de Oriente",
    "C.C. Coliseo",
    "C.C. La Cascada",
    "C.C. Sorrento",
    "C.C. Tibisay",
    "C.C. Las Américas",
    "Casco Central",
    "Corralito",
    "El Guamal",
    "Francisco de Miranda",
    "José Manuel Álvarez",
    "Km 18",
    "La Guadalupe",
    "La Ladera",
    "Llano Alto",
    "Loma Mágica",
    "Lomas de Urquía",
    "Montaña Alta",
    "Monte Bello",
    "Potrerito I",
    "Potrerito II",
    "Potrero del Medio",
    "Res. Alta Vista",
    "Res. Los Eucaliptos",
    "Res. Portofino",
    "San José",
    "Santa Eduviges",
    "Urb. Loma Mágica",
    "Yerba Buena",
  ],
  "SAN DIEGO": [
    "Agua Fría",
    "Cachapal",
    "Cantarrana",
    "Casco Central",
    "Cocorote",
    "Cortada del Guayabo",
    "El Aguacatal",
    "El Guamal",
    "El Ingenio",
    "El Limón",
    "El Naranjal",
    "El Peñón",
    "El Prado",
    "Guaicoco",
    "Guareguare",
    "La Crucesita",
    "La Culebrilla",
    "La Oci",
    "Los Amistosos",
    "Los Colorados",
    "Los Helechos",
    "San José",
    "San Rafael",
    "Vista Hermosa",
  ],
  "LOS TEQUES": [
    "23 de Enero",
    "Alberto Ravell",
    "Alto Verde",
    "Aquiles Nazoa",
    "Barrio La Cruz",
    "Barrio Miranda I",
    "Barrio Miranda II",
    "Brisas de Palo Alto",
    "Buenos Aires",
    "C.C. Vasconia",
    "Carretera Vieja Caracas Los Teques",
    "Centro Los Teques",
    "Club Hípico",
    "Colinas del Ángel",
    "Colinas del Paso",
    "Cumbre Azul",
    "Cumbre Rojas",
    "Edif. 105",
    "Edif. Araguaney",
    "Edif. Campo Alegre",
    "Edif. Capresde",
    "Edif. Conteca",
    "Edif. Don Luis",
    "Edif. Mallorca",
    "Edif. María",
    "Edif. Orotava",
    "Edif. Parayauta",
    "Edif. Radio Miranda",
    "Edif. Taurina",
    "El Ayacucho",
    "El Barbecho",
    "El Bosque",
    "El Cabotaje",
    "El Encanto",
    "El Nacional",
    "El Panadero",
    "El Paso",
    "El Pueblo",
    "El Puinky",
    "El Retén",
    "El Rincón",
    "El Savil",
    "El Tambor",
    "El Trabuco",
    "El Trigo",
    "El Vigía",
    "Guaremal",
    "Hospital Victorino Santaella",
    "José Gregorio",
    "La Estrella",
    "La Fontanera",
    "La Matica",
    "La Quinta",
    "Lagunetica",
    "Las Cadenas",
    "Los Alpes",
    "Los Amarillos",
    "Los Barriales",
    "Los Cerritos",
    "Los Lagos",
    "Los Mangos",
    "Los Nuevos Teques",
    "Los Panamericanos",
    "Macarena Norte",
    "Macarena Sur",
    "Mal Paso",
    "Manuela Sáenz",
    "Montes Verdes",
    "Palo Alto",
    "Pozo de Rosas",
    "Punta Brava",
    "Quebrada La Virgen",
    "Ramo Verde",
    "Res. Aldebarán",
    "Res. Caracas",
    "Res. El Chorrito",
    "Res. Escorpio",
    "Res. Eyproca",
    "Res. Guaicaipuro",
    "Res. Imola",
    "Res. Knoop",
    "Res. La Cima",
    "Res. La Navera",
    "Res. Lagunetica",
    "Res. Lilipina",
    "Res. Médicos Hospital Victorino Santaella",
    "Res. Miracielos",
    "Res. Miraflores",
    "Res. Parque Las Américas",
    "Res. Parque Los Coquitos",
    "Res. Río Arriba",
    "Res. Santa María",
    "Res. Tamari",
    "Res. Tinantonia",
    "Res. Tiuna",
    "Res. Trigo Dorado",
    "Res. Yati",
    "Retamal",
    "Rómulo Gallegos",
    "San Omero",
    "San Pedro",
    "Santa Eduviges",
    "Santa Eulalia",
    "Santa Rosa",
    "Solar de La Quinta",
    "Torre de Construcción",
    "Urb. Simón Bolívar",
    "Valle Alto",
    "Zona Industrial El Tambor",
  ],
  "DISTRITO CAPITAL": [
    "Coche",
    "El Valle",
    "La Vega",
    "Las Mayas",
    "Propatria",
  ],
  "TEJERIAS": [
    "Araiza",
    "Bella Vista",
    "Brisas de Aragua",
    "Brisas de Bucaral",
    "Cañaote",
    "Casco Central",
    "Ciudad Guayas",
    "Colinas de Bucaral",
    "Curiepe",
    "El Beisbol",
    "Jabillal",
    "Jerusalén",
    "La Concepción",
    "La Esperanza",
    "Las Lomitas",
    "Llano Grande",
    "Los Límites",
    "Santo Domingo",
    "Tabacal",
    "Tinapuey",
    "Trapiche del Medio",
    "Variantes de Guaya",
  ],
  "EL CONSEJO": [
    "Corosito",
    "El Ingenio",
    "La Casona",
    "La Gruta",
    "La Hoya",
  ],
};

// ============================================================================
// 3. DICCIONARIO DE ALIAS Y HOMOLOGACIÓN DE VARIANTES
// ============================================================================

export interface GeoAliasTarget {
  canonicalSector: string;
  canonicalZone: string;
  parroquiaOverride?: string;
}

/**
 * Tabla predeterminada de alias y subsectores de Planificación y Solicitudes
 * hacia los sectores oficiales del Cuadro Diario.
 */
export const DEFAULT_GEO_ALIASES: Record<string, GeoAliasTarget> = {
  // --- CARRIZAL & LOS SALIAS ---
  "POTRERITO1": { canonicalSector: "Potrerito I", canonicalZone: "CARRIZAL" },
  "POTRERITO2": { canonicalSector: "Potrerito II", canonicalZone: "CARRIZAL" },
  "CCDONPEDRO": { canonicalSector: "C.C. Coliseo", canonicalZone: "CARRIZAL" },
  "CCLACASCADA": { canonicalSector: "C.C. La Cascada", canonicalZone: "CARRIZAL" },
  "LACASCADA": { canonicalSector: "C.C. La Cascada", canonicalZone: "CARRIZAL" },
  "OPS": { canonicalSector: "Res. Ops", canonicalZone: "SAN ANTONIO" },
  "RESOPS": { canonicalSector: "Res. Ops", canonicalZone: "SAN ANTONIO" },
  "CCOPS": { canonicalSector: "C.C. Ops", canonicalZone: "SAN ANTONIO" },
  "SANANTONIODELOSALTOS": { canonicalSector: "El Pueblo", canonicalZone: "SAN ANTONIO" },
  "SANANTONIO": { canonicalSector: "El Pueblo", canonicalZone: "SAN ANTONIO" },
  "CARRIZAL": { canonicalSector: "Casco Central", canonicalZone: "CARRIZAL" },

  // --- LOS TEQUES & GUAICAIPURO ---
  "ELRICON": { canonicalSector: "El Rincón", canonicalZone: "LOS TEQUES" },
  "ELRINCON": { canonicalSector: "El Rincón", canonicalZone: "LOS TEQUES" },
  "BARRIOMIRANDA1": { canonicalSector: "Barrio Miranda I", canonicalZone: "LOS TEQUES" },
  "BARRIOMIRANDA2": { canonicalSector: "Barrio Miranda II", canonicalZone: "LOS TEQUES" },
  "TRIGODORADO": { canonicalSector: "Res. Trigo Dorado", canonicalZone: "LOS TEQUES" },
  "SIMONBOLIVAR": { canonicalSector: "Urb. Simón Bolívar", canonicalZone: "LOS TEQUES" },
  "COOPERATIVAGUAICAIPURO": { canonicalSector: "23 de Enero", canonicalZone: "LOS TEQUES" },
  "LOSTEQUES": { canonicalSector: "Centro Los Teques", canonicalZone: "LOS TEQUES" },

  // --- LAS TEJERÍAS & ARAGUA ---
  "CASCOCENTRALLASTEJERIAS": { canonicalSector: "Casco Central", canonicalZone: "TEJERIAS" },
  "LASTEJERIAS": { canonicalSector: "Casco Central", canonicalZone: "TEJERIAS" },
  "TEJERIAS": { canonicalSector: "Casco Central", canonicalZone: "TEJERIAS" },
  "LACONCEPCIONPARTEALTA": { canonicalSector: "La Concepción", canonicalZone: "TEJERIAS" },
  "LAESTACIONPARTEALTA": { canonicalSector: "Casco Central", canonicalZone: "TEJERIAS" },
  "LOSBAGRES": { canonicalSector: "Casco Central", canonicalZone: "TEJERIAS" },
  "LACANADA": { canonicalSector: "Curiepe", canonicalZone: "TEJERIAS" },
  "LACONSTITUYENTE": { canonicalSector: "El Beisbol", canonicalZone: "TEJERIAS" },
  "PUEBLODECHAGUARAMA": { canonicalSector: "Tinapuey", canonicalZone: "TEJERIAS" },
  "CASERIOLASDOLORESDELARAGUA": { canonicalSector: "Tabacal", canonicalZone: "TEJERIAS" },
  "ELLORO": { canonicalSector: "Curiepe", canonicalZone: "TEJERIAS" },
  "ELCONSEJO": { canonicalSector: "Corosito", canonicalZone: "EL CONSEJO" },

  // --- DISTRITO CAPITAL: PROPATRIA (PARROQUIA SUCRE / CATIA) ---
  "CATIA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "ISAIASMEDINAANGARITA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LASILSA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOSMAGALLANESDECATIA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOSMAGALLANES": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CALLEARGENTINA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "GRAMOVEN": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "ELCUARTEL": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CASABLANCA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CIUDADTABLITAS": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "ALTAVISTA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CALLECHILE": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LASLOMAS": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "VISTAALMAR": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "GUAICAIPURO2": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CALLECOLOMBIA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "MORAN": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "ELAMPARO": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "PEREZBONALDE": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "BLANDIN": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "BOQUERON": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "ELNAZARENO": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOSMANQUITOS": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOSPINOS": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOSFRAILESDECATIA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOSFLORESDECATIA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "LOMASDEURDANETA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "MARIOBRICENOIRAGORRY": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CALLEMEXICO": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "GATONEGRO": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CALLEECUADOR": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CASALTAI": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CASALTAII": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CASALTAIII": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },
  "CUTIRA": { canonicalSector: "Propatria", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Sucre" },

  // --- DISTRITO CAPITAL: LA VEGA ---
  "LASTORRES": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "ELCARMEN": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LOSPARAPAROS": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LASCASITAS": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LOSCUJICITOS": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LAVEGUITA": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LALUZ": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LOSCANGILONES": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "ELMILAGRO": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LOSNARANJOS": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "ELPETROLEO": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LAAMAPOLA": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LASDOSROSAS": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "TERRAZASDELAVEGA": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LAVEGACASCOCENTRAL": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "SINAI": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LAPEDRERA": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "LAHOYADA": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },
  "SECTORUNIDO": { canonicalSector: "La Vega", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "La Vega" },

  // --- DISTRITO CAPITAL: EL VALLE ---
  "CALLE18": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CCELVALLE": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLEELLORO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CAJIGAL": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "ELSETENTA": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "ELSETENTAEL70": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "EL70": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE1": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "ELTRIANGULO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LOSROSALES": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LOSJARDINES": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LOSJARDINESDEELVALLE": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "ELTAMARINDO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "BRUZUAL": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CERROGRANDE": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE19DEABRIL": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "19DEABRIL": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "24DEJULIO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "GALLOROJO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "RESSANANDRES": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LOSCARDONES": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LASMALVINAS": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LASMARIAS": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "5DEJULIO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE9": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLECAJIGAL": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE13": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLEAPURE": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE10": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE17": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE12": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "PRIMERODEMAYO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "SECTORZAMORA": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE14": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "VENGASKM0": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLESANLUIS": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE8": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "ELCALVARIO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CANISITO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "LAMATANZA": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "DAVILA": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "CALLE15": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },
  "VUELTAFELICIANO": { canonicalSector: "El Valle", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "El Valle" },

  // --- DISTRITO CAPITAL: COCHE & LAS MAYAS ---
  "COCHECITO": { canonicalSector: "Coche", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Coche" },
  "VEREDASDECOCHE": { canonicalSector: "Coche", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Coche" },
  "MERCADOMAYORDECOCHE": { canonicalSector: "Coche", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Coche" },
  "TURMERITO": { canonicalSector: "Coche", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Coche" },
  "CARRETERALASMAYAS": { canonicalSector: "Las Mayas", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Coche" },
  "LAMARIPOSA": { canonicalSector: "Las Mayas", canonicalZone: "DISTRITO CAPITAL", parroquiaOverride: "Coche" },
};

// ============================================================================
// 4. MAPAS INTERNOS EN MEMORIA PARA BÚSQUEDA O(1)
// ============================================================================

// Map de normalizedSectorKey -> { canonicalSector, canonicalZone }
const canonicalLookup = new Map<string, { sector: string; zone: string }>();

// Populate canonical lookup
Object.entries(CANONICAL_SECTORS_BY_ZONE).forEach(([zone, sectors]) => {
  sectors.forEach((sec) => {
    canonicalLookup.set(normGeoKey(sec), { sector: sec, zone });
  });
});

/**
 * Limpia prefijos comunes para búsqueda difusa (ej. "Urb.", "Res.", "C.C.", "Sector")
 */
function stripPrefixes(str: string): string {
  return str
    .replace(/\b(RESIDENCIAS|RESIDENCIA|RES\.|RES|URBANIZACION|URB\.|URB|EDIFICIO|EDIF\.|EDIF|SECTOR|BARRIO|AVENIDA|AV\.|AV|CALLE|C\.C\.|C\.C|CC)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza cualquier entrada territorial (Planificación o Solicitudes)
 * hacia el Padrón Canónico del Cuadro Diario.
 */
export function normalizeLocation(
  input: GeoLocationInput,
  customAliases?: Record<string, GeoAliasTarget>
): CanonicalLocationResult {
  const rawSec = (input.sector || "").trim();
  const rawUbi = (input.ubicacion || "").trim();
  const rawCandidate = rawSec || rawUbi;
  const rawZone = (input.zona || "").trim().toUpperCase();
  const rawPar = (input.parroquia || "").trim();
  const rawMun = (input.municipio || "").trim();
  const rawEst = (input.estado || "").trim();

  const activeAliases = { ...DEFAULT_GEO_ALIASES, ...(customAliases || {}) };

  // 1. Intentar matching exacto por clave normalizada
  const nkCandidate = normGeoKey(rawCandidate);
  if (nkCandidate) {
    // A) En alias directos
    if (activeAliases[nkCandidate]) {
      const target = activeAliases[nkCandidate];
      const zConfig = CANONICAL_ZONES_CONFIG[target.canonicalZone];
      return {
        sector: target.canonicalSector,
        subsector: rawCandidate,
        zona: target.canonicalZone,
        parroquia: target.parroquiaOverride || zConfig?.parroquiasMap?.[target.canonicalSector] || zConfig?.parroquiaDefault || rawPar,
        municipio: zConfig?.municipio || rawMun,
        estado: zConfig?.estado || rawEst,
        isRecognized: true,
      };
    }

    // B) En padrón canónico de sectores
    if (canonicalLookup.has(nkCandidate)) {
      const match = canonicalLookup.get(nkCandidate)!;
      const zConfig = CANONICAL_ZONES_CONFIG[match.zone];
      return {
        sector: match.sector,
        subsector: rawCandidate,
        zona: match.zone,
        parroquia: zConfig?.parroquiasMap?.[match.sector] || zConfig?.parroquiaDefault || rawPar,
        municipio: zConfig?.municipio || rawMun,
        estado: zConfig?.estado || rawEst,
        isRecognized: true,
      };
    }

    // C) Sin prefijos ("Res. Ops" -> "Ops")
    const stripped = stripPrefixes(rawCandidate);
    const nkStripped = normGeoKey(stripped);
    if (nkStripped && nkStripped !== nkCandidate) {
      if (activeAliases[nkStripped]) {
        const target = activeAliases[nkStripped];
        const zConfig = CANONICAL_ZONES_CONFIG[target.canonicalZone];
        return {
          sector: target.canonicalSector,
          subsector: rawCandidate,
          zona: target.canonicalZone,
          parroquia: target.parroquiaOverride || zConfig?.parroquiasMap?.[target.canonicalSector] || zConfig?.parroquiaDefault || rawPar,
          municipio: zConfig?.municipio || rawMun,
          estado: zConfig?.estado || rawEst,
          isRecognized: true,
        };
      }
      if (canonicalLookup.has(nkStripped)) {
        const match = canonicalLookup.get(nkStripped)!;
        const zConfig = CANONICAL_ZONES_CONFIG[match.zone];
        return {
          sector: match.sector,
          subsector: rawCandidate,
          zona: match.zone,
          parroquia: zConfig?.parroquiasMap?.[match.sector] || zConfig?.parroquiaDefault || rawPar,
          municipio: zConfig?.municipio || rawMun,
          estado: zConfig?.estado || rawEst,
          isRecognized: true,
        };
      }
    }
  }

  // 2. Si la ubicación es un texto extenso (ej. Solicitudes: "El Valle, calle 19 de Abril..."):
  if (rawUbi) {
    const ubiUpper = rawUbi.toUpperCase();
    for (const [aliasKey, target] of Object.entries(activeAliases)) {
      if (aliasKey.length >= 4 && normGeoKey(ubiUpper).includes(aliasKey)) {
        const zConfig = CANONICAL_ZONES_CONFIG[target.canonicalZone];
        return {
          sector: target.canonicalSector,
          subsector: rawCandidate,
          zona: target.canonicalZone,
          parroquia: target.parroquiaOverride || zConfig?.parroquiasMap?.[target.canonicalSector] || zConfig?.parroquiaDefault || rawPar,
          municipio: zConfig?.municipio || rawMun,
          estado: zConfig?.estado || rawEst,
          isRecognized: true,
        };
      }
    }

    // Probar si contiene algún sector canónico directamente
    for (const [secNorm, match] of canonicalLookup.entries()) {
      if (secNorm.length >= 5 && normGeoKey(ubiUpper).includes(secNorm)) {
        const zConfig = CANONICAL_ZONES_CONFIG[match.zone];
        return {
          sector: match.sector,
          subsector: rawCandidate,
          zona: match.zone,
          parroquia: zConfig?.parroquiasMap?.[match.sector] || zConfig?.parroquiaDefault || rawPar,
          municipio: zConfig?.municipio || rawMun,
          estado: zConfig?.estado || rawEst,
          isRecognized: true,
        };
      }
    }
  }

  // 3. Fallback Contextual: resolución estricta hacia el sector canónico del Cuadro Diario
  let resolvedZone = rawZone;
  let resolvedSector = "";
  let resolvedParroquia = rawPar;

  const normP = normGeoKey(rawPar);
  const normM = normGeoKey(rawMun);

  if (normP.includes("SUCRE") || normP.includes("CATIA")) {
    resolvedZone = "DISTRITO CAPITAL";
    resolvedSector = "Propatria";
    resolvedParroquia = "Sucre";
  } else if (normP.includes("VALLE")) {
    resolvedZone = "DISTRITO CAPITAL";
    resolvedSector = "El Valle";
    resolvedParroquia = "El Valle";
  } else if (normP.includes("VEGA")) {
    resolvedZone = "DISTRITO CAPITAL";
    resolvedSector = "La Vega";
    resolvedParroquia = "La Vega";
  } else if (normP.includes("MAYA")) {
    resolvedZone = "DISTRITO CAPITAL";
    resolvedSector = "Las Mayas";
    resolvedParroquia = "Coche";
  } else if (normP.includes("COCHE")) {
    resolvedZone = "DISTRITO CAPITAL";
    resolvedSector = "Coche";
    resolvedParroquia = "Coche";
  } else if (normM.includes("CARRIZAL") || normP.includes("CARRIZAL")) {
    resolvedZone = "CARRIZAL";
    resolvedSector = "Casco Central";
    resolvedParroquia = "Carrizal";
  } else if (normM.includes("SALIAS") || normP.includes("ANTONIO")) {
    resolvedZone = "SAN ANTONIO";
    resolvedSector = "El Pueblo";
    resolvedParroquia = "San Antonio de los Altos";
  } else if (normP.includes("DIEGO") || normP.includes("CECILIO")) {
    resolvedZone = "SAN DIEGO";
    resolvedSector = "Casco Central";
    resolvedParroquia = "Cecilio Acosta";
  } else if (normP.includes("TEQUES") || normM.includes("GUAICAIPURO")) {
    resolvedZone = "LOS TEQUES";
    resolvedSector = "Centro Los Teques";
    resolvedParroquia = "Los Teques";
  } else if (normP.includes("TEJERIA") || normM.includes("MICHELENA")) {
    resolvedZone = "TEJERIAS";
    resolvedSector = "Casco Central";
    resolvedParroquia = "Las Tejerías";
  } else if (normP.includes("CONSEJO") || normM.includes("REVENGA")) {
    resolvedZone = "EL CONSEJO";
    resolvedSector = "Corosito";
    resolvedParroquia = "El Consejo";
  }

  if (!resolvedZone || !CANONICAL_ZONES_CONFIG[resolvedZone]) {
    resolvedZone = "LOS TEQUES";
  }
  const zConfig = CANONICAL_ZONES_CONFIG[resolvedZone];
  if (!resolvedSector) {
    resolvedSector = zConfig.sectorDefault;
  }

  return {
    sector: resolvedSector,
    subsector: rawCandidate || resolvedSector,
    zona: resolvedZone,
    parroquia: resolvedParroquia || zConfig.parroquiaDefault,
    municipio: zConfig.municipio,
    estado: zConfig.estado,
    isRecognized: false,
  };
}

