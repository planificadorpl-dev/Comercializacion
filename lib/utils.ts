import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number | string | undefined | null): string {
  if (n === null || n === undefined || n === "") return "0";
  const num = typeof n === "string" ? parseFloat(String(n)) : n;
  if (isNaN(num)) return String(n);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const PHRASE_DICTIONARY: Record<string, string> = {
  "DISTRITO CAPITAL": "Distrito Capital",
  "LOS TEQUES": "Los Teques",
  "SAN ANTONIO": "San Antonio",
  "TEJERIAS": "Tejerías",
  "LAS TEJERIAS": "Las Tejerías",
  "EL CONSEJO": "El Consejo",
  "CARRIZAL": "Carrizal",
  "GUARENAS": "Guarenas",
  "GUATIRE": "Guatire",
  "VALLES DEL TUY": "Valles del Tuy",
  "LA VICTORIA": "La Victoria",
  "23 DE ENERO": "23 de Enero",
  "AGUA FRIA": "Agua Fría",
  "EL VIGIA": "El Vigía",
  "LA MATICA": "La Matica",
  "LOS NUEVOS TEQUES": "Los Nuevos Teques",
  "SAN PEDRO": "San Pedro",
  "SAN JOSE": "San José",
  "CASCO CENTRAL": "Casco Central",
  "ZONA INDUSTRIAL": "Zona Industrial",
  "PLANIFICACION": "Planificación",
  "INSTALACION": "Instalación",
  "MIGRACION": "Migración",
  "CONVENIO": "Convenio",
  "EMPLEADO": "Empleado",
  "EXONERADO": "Exonerado",
  "MUDANZA": "Mudanza",
  "CAMBIO DE PLAN": "Cambio de Plan",
  "CALL CENTER": "Call Center",
  "TAQUILLA": "Taquilla",
  "ENERO": "Enero",
  "FEBRERO": "Febrero",
  "MARZO": "Marzo",
  "ABRIL": "Abril",
  "MAYO": "Mayo",
  "JUNIO": "Junio",
  "JULIO": "Julio",
  "AGOSTO": "Agosto",
  "SEPTIEMBRE": "Septiembre",
  "OCTUBRE": "Octubre",
  "NOVIEMBRE": "Noviembre",
  "DICIEMBRE": "Diciembre",
  "UNK": "Otros",
  "UNKNOWN": "Otros",
};

const ACCENT_WORD_MAP: Record<string, string> = {
  "PLANIFICACION": "Planificación",
  "INSTALACION": "Instalación",
  "MIGRACION": "Migración",
  "TEJERIAS": "Tejerías",
  "FRIA": "Fría",
  "VIGIA": "Vigía",
  "JOSE": "José",
  "MARIA": "María",
  "RODRIGUEZ": "Rodríguez",
  "GONZALEZ": "González",
  "PEREZ": "Pérez",
  "HERNANDEZ": "Hernández",
  "GARCIA": "García",
  "MARTINEZ": "Martínez",
  "SANCHEZ": "Sánchez",
  "LOPEZ": "López",
  "RAMIREZ": "Ramírez",
  "GOMEZ": "Gómez",
  "DIAZ": "Díaz",
  "VALDES": "Valdés",
  "MENDEZ": "Méndez",
  "RIOS": "Ríos",
  "JESUS": "Jesús",
  "ANDRES": "Andrés",
  "RAMON": "Ramón",
  "ANGEL": "Ángel",
  "SEBASTIAN": "Sebastián",
  "LEON": "León",
  "GUZMAN": "Guzmán",
  "BOLIVAR": "Bolívar",
  "AVILA": "Ávila",
};

const LOWER_CONNECTORS = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "e", "o", "u", "a", "al"]);

/**
 * Parses all-uppercase strings (zones, advisors, sectors, months)
 * into standard, correctly accented Spanish Title Case.
 */
export function formatProperCase(text: string | undefined | null): string {
  if (!text) return "";
  const trimmed = String(text).trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();
  if (PHRASE_DICTIONARY[upper]) {
    return PHRASE_DICTIONARY[upper];
  }

  // Handle strings like "400 MB" or "1 GB"
  if (/^\d+\s*(MB|GB|MBPS|GBPS)$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const words = trimmed.split(/\s+/);
  return words
    .map((w, index) => {
      const wUpper = w.toUpperCase();
      if (ACCENT_WORD_MAP[wUpper]) {
        return ACCENT_WORD_MAP[wUpper];
      }

      const wLower = w.toLowerCase();
      // Keep connectors lowercase unless it's the first word
      if (index > 0 && LOWER_CONNECTORS.has(wLower)) {
        return wLower;
      }

      // If word contains special characters (like 23, or punctuation), keep structure
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Normalizes text removing diacritics/accents for robust case- and accent-insensitive matching
 */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Robust check if a status string corresponds to an installation
 */
export function isInstalacionStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return normalizeText(status).includes("INSTALAC");
}

const VALID_NEW_SERVICES = ["CONVENIO", "EMPLEADO", "INSTALACION", "MIGRACION", "EXONERADO"];
export function isNuevoServicioStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  const norm = normalizeText(status);
  return VALID_NEW_SERVICES.some((s) => norm.includes(s));
}

