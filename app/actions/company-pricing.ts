"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";

export interface CompanyPlan {
  id: string;
  nombre: string;
  tipo: "Domiciliario" | "Empresarial";
  velocidad_mb: number;
  precio_promo: number;
  precio_regular: number;
  costo_instalacion_promo: number;
  costo_instalacion_regular: number;
  has_tv: boolean;
  nombre_tv?: string | null;
  es_simetrico: boolean;
  activo: boolean;
  notas?: string | null;
}

export interface CompanyService {
  id: string;
  nombre: string;
  tipo_cobro: "unico" | "mensual" | "por_metro";
  precio_usd: number;
  descripcion?: string | null;
  activo: boolean;
}

export interface CompanyPromotion {
  id: string;
  nombre: string;
  estado: string;                 // ej: "Aragua", "Miranda", "Todos"
  municipio?: string | null;      // ej: "Santos Michelena", "Guaicaipuro"
  parroquia?: string | null;      // ej: "Las Tejerías", "Los Teques"
  sector?: string | null;         // ej: "Toda la parroquia", "5 sectores seleccionados"
  sectores?: string[];            // lista oficial de sectores seleccionados de geoHierarchy
  tipo_descuento_mensual: "mitad_precio" | "porcentaje" | "monto_fijo";
  descuento_valor: number;        // 50 para mitad de precio (50%), o monto en $
  duracion_meses: number;         // ej: 3 meses
  costo_instalacion: number;      // 0 si gratis, 25 estándar
  instalacion_gratis: boolean;
  aplica_segmento: "Domiciliario" | "Empresarial" | "Todos";
  activo: boolean;
  notas?: string | null;
}

export interface CompanyPricingData {
  planes: CompanyPlan[];
  servicios: CompanyService[];
  promociones: CompanyPromotion[];
  updated_at: string;
}

const PRICING_DATA_PATH = path.join(process.cwd(), "data", "company-pricing.json");

let cachedPricing: { data: CompanyPricingData; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minuto en memoria

const DEFAULT_COMPANY_PRICING: CompanyPricingData = {
  planes: [
    {
      id: "res-400",
      nombre: "400 Megas",
      tipo: "Domiciliario",
      velocidad_mb: 400,
      precio_promo: 15.0,
      precio_regular: 29.0,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 25.0,
      has_tv: false,
      nombre_tv: null,
      es_simetrico: true,
      activo: true,
      notas: "Precio especial por los primeros 3 meses ($15) / Precio regular ($29)",
    },
    {
      id: "res-600",
      nombre: "600 Megas + TV",
      tipo: "Domiciliario",
      velocidad_mb: 600,
      precio_promo: 22.0,
      precio_regular: 36.0,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 25.0,
      has_tv: true,
      nombre_tv: "Power Link GO TV",
      es_simetrico: true,
      activo: true,
      notas: "Incluye televisión digital Power Link GO TV",
    },
    {
      id: "res-800",
      nombre: "800 Megas + TV",
      tipo: "Domiciliario",
      velocidad_mb: 800,
      precio_promo: 27.0,
      precio_regular: 40.0,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 25.0,
      has_tv: true,
      nombre_tv: "Power Link GO TV",
      es_simetrico: true,
      activo: true,
      notas: "Incluye televisión digital Power Link GO TV",
    },
    {
      id: "res-1000",
      nombre: "1 Giga + TV",
      tipo: "Domiciliario",
      velocidad_mb: 1000,
      precio_promo: 30.0,
      precio_regular: 46.0,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 25.0,
      has_tv: true,
      nombre_tv: "Power Link GO TV",
      es_simetrico: true,
      activo: true,
      notas: "Conexión simétrica ultra rápida 1 Gbps + TV",
    },
    {
      id: "corp-400",
      nombre: "400 Megas Corporativo",
      tipo: "Empresarial",
      velocidad_mb: 400,
      precio_promo: 29.0,
      precio_regular: 58.0,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 60.0,
      has_tv: false,
      nombre_tv: null,
      es_simetrico: true,
      activo: true,
      notas: "Enlace empresarial de alta velocidad",
    },
    {
      id: "corp-600",
      nombre: "600 Megas Corporativo",
      tipo: "Empresarial",
      velocidad_mb: 600,
      precio_promo: 40.6,
      precio_regular: 81.2,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 60.0,
      has_tv: false,
      nombre_tv: null,
      es_simetrico: true,
      activo: true,
      notas: "Enlace simétrico empresarial",
    },
    {
      id: "corp-800",
      nombre: "800 Megas Corporativo",
      tipo: "Empresarial",
      velocidad_mb: 800,
      precio_promo: 75.4,
      precio_regular: 150.8,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 60.0,
      has_tv: false,
      nombre_tv: null,
      es_simetrico: true,
      activo: true,
      notas: "Alta capacidad corporativa",
    },
    {
      id: "corp-1000",
      nombre: "1 Giga Corporativo",
      tipo: "Empresarial",
      velocidad_mb: 1000,
      precio_promo: 115.0,
      precio_regular: 230.0,
      costo_instalacion_promo: 0.0,
      costo_instalacion_regular: 60.0,
      has_tv: false,
      nombre_tv: null,
      es_simetrico: true,
      activo: true,
      notas: "Conexión troncal corporativa 1 Gbps",
    },
  ],
  servicios: [
    {
      id: "srv-router-vsol-promo",
      nombre: "Router AX 3000 V-SOL (PROMOCIÓN)",
      tipo_cobro: "unico",
      precio_usd: 35.0,
      descripcion: "Router Wi-Fi 6 AX 3000 V-SOL Gigabit en precio promocional.",
      activo: true,
    },
    {
      id: "srv-mudanza",
      nombre: "Servicio de Mudanza / Traslado",
      tipo_cobro: "unico",
      precio_usd: 15.0,
      descripcion: "Costo de traslado. Incluye nueva instalación con hasta 150 metros de fibra óptica.",
      activo: true,
    },
    {
      id: "srv-ip-publica",
      nombre: "IP Pública Fija",
      tipo_cobro: "mensual",
      precio_usd: 15.0,
      descripcion: "Dirección IP estática dedicada para servidores, cámaras o acceso remoto.",
      activo: true,
    },
    {
      id: "srv-metro-fibra",
      nombre: "Metro de Fibra Excedente",
      tipo_cobro: "por_metro",
      precio_usd: 0.6,
      descripcion: "Costo por metro lineal adicional tras superar los 150m incluidos en la instalación.",
      activo: true,
    },
    {
      id: "srv-router",
      nombre: "Router Adicional (Los Teques)",
      tipo_cobro: "unico",
      precio_usd: 87.0,
      descripcion: "Router Gigabit Dual Band para ampliación de cobertura WiFi.",
      activo: true,
    },
    {
      id: "srv-tv-powergo",
      nombre: "Power Link GO TV (Streaming)",
      tipo_cobro: "mensual",
      precio_usd: 0.0,
      descripcion: "Plataforma digital de TV y Streaming incluida sin costo adicional a partir de 600 Megas.",
      activo: true,
    },
  ],
  promociones: [
    {
      id: "promo-tejerias",
      nombre: "Promoción Las Tejerías",
      estado: "Aragua",
      municipio: "Santos Michelena",
      parroquia: "Las Tejerías",
      sector: "General / Toda la zona",
      tipo_descuento_mensual: "mitad_precio",
      descuento_valor: 50,
      duracion_meses: 3,
      costo_instalacion: 0,
      instalacion_gratis: true,
      aplica_segmento: "Domiciliario",
      activo: true,
      notas: "Plan a mitad de precio por 3 meses con costo de instalación $0 (completamente gratis).",
    },
    {
      id: "promo-los-teques",
      nombre: "Promoción Los Teques (Sectores)",
      estado: "Miranda",
      municipio: "Guaicaipuro",
      parroquia: "Los Teques",
      sector: "Sectores seleccionados",
      tipo_descuento_mensual: "mitad_precio",
      descuento_valor: 50,
      duracion_meses: 3,
      costo_instalacion: 25,
      instalacion_gratis: false,
      aplica_segmento: "Domiciliario",
      activo: true,
      notas: "Mensualidad a mitad de precio por 3 meses. Se cobra instalación estándar ($25).",
    },
  ],
  updated_at: new Date().toISOString(),
};

function sanitizePricingData(data: CompanyPricingData): CompanyPricingData {
  if (!data) return data;
  const strip = (s?: string | null) => {
    if (!s) return s;
    return s
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2B50}\u{200D}\u{FE0F}]/gu, "")
      .replace(/➡️|➡|📺|💼|⚡|🛠️|🛠/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  if (Array.isArray(data.planes)) {
    data.planes = data.planes.map((p) => ({
      ...p,
      nombre: strip(p.nombre) || p.nombre,
      notas: p.notas ? strip(p.notas) : p.notas,
    }));
  }
  if (Array.isArray(data.servicios)) {
    data.servicios = data.servicios.map((s) => ({
      ...s,
      nombre: strip(s.nombre) || s.nombre,
      descripcion: s.descripcion ? strip(s.descripcion) : s.descripcion,
    }));
  }
  if (Array.isArray(data.promociones)) {
    data.promociones = data.promociones.map((pr) => ({
      ...pr,
      nombre: strip(pr.nombre) || pr.nombre,
      notas: pr.notas ? strip(pr.notas) : pr.notas,
    }));
  }
  return data;
}

async function persistPricingData(data: CompanyPricingData): Promise<void> {
  const sanitized = sanitizePricingData(data);
  // 1. Persist to PostgreSQL (Supabase)
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS public.company_pricing_config (
         id VARCHAR(50) PRIMARY KEY,
         data JSONB NOT NULL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       );`
    );

    await query(
      `INSERT INTO public.company_pricing_config (id, data, updated_at)
       VALUES ('current', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`,
      [JSON.stringify(sanitized)]
    );
  } catch (pgErr: any) {
    console.warn("Postgres persistPricingData error:", pgErr.message);
  }

  // 2. Try updating local file if writable (e.g. local dev, gracefully catches EROFS on Vercel)
  try {
    await fs.writeFile(PRICING_DATA_PATH, JSON.stringify(sanitized, null, 2), "utf-8");
  } catch (fsErr) {
    // Read-only filesystem in Vercel serverless functions is expected
  }
}

export async function getCompanyPricing(): Promise<CompanyPricingData> {
  const now = Date.now();
  if (cachedPricing && now - cachedPricing.timestamp < CACHE_TTL_MS) {
    return cachedPricing.data;
  }

  // 1. Try PostgreSQL (Supabase)
  try {
    const rows = await query("SELECT data FROM public.company_pricing_config WHERE id = 'current'");
    if (rows && rows.length > 0 && rows[0].data) {
      let parsed = rows[0].data;
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      if (parsed && Array.isArray(parsed.planes)) {
        if (!Array.isArray(parsed.promociones)) {
          parsed.promociones = DEFAULT_COMPANY_PRICING.promociones;
        }
        parsed = sanitizePricingData(parsed);
        cachedPricing = { data: parsed, timestamp: now };
        return parsed;
      }
    }
  } catch (pgErr: any) {
    console.warn("Postgres getCompanyPricing error, fallback to file:", pgErr.message);
  }

  // 2. Fallback to packaged file (read-only safe)
  try {
    const raw = await fs.readFile(PRICING_DATA_PATH, "utf-8");
    let parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.planes)) {
      if (!Array.isArray(parsed.promociones)) {
        parsed.promociones = DEFAULT_COMPANY_PRICING.promociones;
      }
      parsed = sanitizePricingData(parsed);
      cachedPricing = { data: parsed, timestamp: now };
      return parsed;
    }
  } catch (err) {}

  return sanitizePricingData(DEFAULT_COMPANY_PRICING);
}

export async function saveCompanyPlan(plan: Partial<CompanyPlan> & { id?: string }): Promise<CompanyPlan> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const planes = [...current.planes];

  const planId = plan.id || `pln_${Date.now()}`;
  const sanitizedPlan: CompanyPlan = {
    id: planId,
    nombre: (plan.nombre || "Nuevo Plan").trim(),
    tipo: plan.tipo || "Domiciliario",
    velocidad_mb: Math.max(1, Number(plan.velocidad_mb) || 100),
    precio_promo: parseFloat(Number(plan.precio_promo ?? 0).toFixed(2)),
    precio_regular: parseFloat(Number(plan.precio_regular ?? 0).toFixed(2)),
    costo_instalacion_promo: parseFloat(Number(plan.costo_instalacion_promo ?? 0).toFixed(2)),
    costo_instalacion_regular: parseFloat(Number(plan.costo_instalacion_regular ?? 0).toFixed(2)),
    has_tv: Boolean(plan.has_tv),
    nombre_tv: plan.has_tv ? (plan.nombre_tv?.trim() || "Power Link GO TV") : null,
    es_simetrico: plan.es_simetrico !== false,
    activo: plan.activo !== false,
    notas: plan.notas?.trim() || null,
  };

  const existingIdx = planes.findIndex((p) => p.id === planId);
  if (existingIdx !== -1) {
    planes[existingIdx] = sanitizedPlan;
  } else {
    planes.push(sanitizedPlan);
  }

  const updatedData: CompanyPricingData = {
    ...current,
    planes,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  revalidatePath("/admin/planes");
  return sanitizedPlan;
}

export async function deleteCompanyPlan(planId: string): Promise<boolean> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const planes = current.planes.filter((p) => p.id !== planId);

  const updatedData: CompanyPricingData = {
    ...current,
    planes,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  revalidatePath("/admin/planes");
  return true;
}

export async function saveCompanyService(service: Partial<CompanyService> & { id?: string }): Promise<CompanyService> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const servicios = [...current.servicios];

  const serviceId = service.id || `srv_${Date.now()}`;
  const sanitizedService: CompanyService = {
    id: serviceId,
    nombre: (service.nombre || "Nuevo Servicio").trim(),
    tipo_cobro: service.tipo_cobro || "unico",
    precio_usd: parseFloat(Number(service.precio_usd ?? 0).toFixed(2)),
    descripcion: service.descripcion?.trim() || null,
    activo: service.activo !== false,
  };

  const existingIdx = servicios.findIndex((s) => s.id === serviceId);
  if (existingIdx !== -1) {
    servicios[existingIdx] = sanitizedService;
  } else {
    servicios.push(sanitizedService);
  }

  const updatedData: CompanyPricingData = {
    ...current,
    servicios,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  revalidatePath("/admin/planes");
  return sanitizedService;
}

export async function deleteCompanyService(serviceId: string): Promise<boolean> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const servicios = current.servicios.filter((s) => s.id !== serviceId);

  const updatedData: CompanyPricingData = {
    ...current,
    servicios,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  revalidatePath("/admin/planes");
  return true;
}

export async function saveCompanyPromotion(promo: Partial<CompanyPromotion> & { id?: string }): Promise<CompanyPromotion> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const promociones = [...(current.promociones || [])];

  const promoId = promo.id || `prm_${Date.now()}`;
  const instalacionGratis = promo.instalacion_gratis ?? (Number(promo.costo_instalacion ?? 0) === 0);
  const costoInstalacion = instalacionGratis ? 0 : parseFloat(Number(promo.costo_instalacion ?? 0).toFixed(2));

  const rawSectores = Array.isArray(promo.sectores) ? promo.sectores.filter(Boolean) : [];
  const sectorSummary = rawSectores.length > 0
    ? (rawSectores.length === 1 ? rawSectores[0] : `${rawSectores.length} sectores seleccionados`)
    : (promo.sector?.trim() || "Toda la parroquia");

  const sanitizedPromo: CompanyPromotion = {
    id: promoId,
    nombre: (promo.nombre || "Nueva Promoción").trim(),
    estado: (promo.estado || "Todos").trim(),
    municipio: promo.municipio?.trim() || null,
    parroquia: promo.parroquia?.trim() || null,
    sector: sectorSummary,
    sectores: rawSectores,
    tipo_descuento_mensual: promo.tipo_descuento_mensual || "mitad_precio",
    descuento_valor: parseFloat(Number(promo.descuento_valor ?? 50).toFixed(2)),
    duracion_meses: Math.max(1, Number(promo.duracion_meses) || 3),
    costo_instalacion: costoInstalacion,
    instalacion_gratis: instalacionGratis,
    aplica_segmento: promo.aplica_segmento || "Domiciliario",
    activo: promo.activo !== false,
    notas: promo.notas?.trim() || null,
  };

  const existingIdx = promociones.findIndex((p) => p.id === promoId);
  if (existingIdx !== -1) {
    promociones[existingIdx] = sanitizedPromo;
  } else {
    promociones.push(sanitizedPromo);
  }

  const updatedData: CompanyPricingData = {
    ...current,
    promociones,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  return sanitizedPromo;
}

export async function deleteCompanyPromotion(promoId: string): Promise<boolean> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const promociones = (current.promociones || []).filter((p) => p.id !== promoId);

  const updatedData: CompanyPricingData = {
    ...current,
    promociones,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  return true;
}

export async function toggleCompanyPromotion(promoId: string, activo: boolean): Promise<boolean> {
  cachedPricing = null;
  const current = await getCompanyPricing();
  const promociones = (current.promociones || []).map((p) =>
    p.id === promoId ? { ...p, activo } : p
  );

  const updatedData: CompanyPricingData = {
    ...current,
    promociones,
    updated_at: new Date().toISOString(),
  };

  await persistPricingData(updatedData);
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  return true;
}
