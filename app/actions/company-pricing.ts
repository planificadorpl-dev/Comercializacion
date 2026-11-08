"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

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

export interface CompanyPricingData {
  planes: CompanyPlan[];
  servicios: CompanyService[];
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
      notas: "Precio especial por los primeros 3 meses ($15) ➡️ Precio Regular ($29)",
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
      notas: "Incluye televisión digital Power Link GO TV 📺",
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
      notas: "Incluye televisión digital Power Link GO TV 📺",
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
      notas: "Conexión simétrica ultra rápida 1 Gbps + TV 📺",
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
      notas: "Enlace empresarial de alta velocidad 💼",
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
      notas: "Enlace simétrico empresarial 💼",
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
      notas: "Alta capacidad corporativa 💼",
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
      notas: "Conexión troncal corporativa 1 Gbps 💼",
    },
  ],
  servicios: [
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
  updated_at: new Date().toISOString(),
};

export async function getCompanyPricing(): Promise<CompanyPricingData> {
  const now = Date.now();
  if (cachedPricing && now - cachedPricing.timestamp < CACHE_TTL_MS) {
    return cachedPricing.data;
  }

  try {
    const raw = await fs.readFile(PRICING_DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.planes)) {
      cachedPricing = { data: parsed, timestamp: now };
      return parsed;
    }
  } catch (err) {
    // Si no existe, inicializar con los datos por defecto
    try {
      await fs.writeFile(PRICING_DATA_PATH, JSON.stringify(DEFAULT_COMPANY_PRICING, null, 2), "utf-8");
      cachedPricing = { data: DEFAULT_COMPANY_PRICING, timestamp: now };
      return DEFAULT_COMPANY_PRICING;
    } catch {}
  }

  return DEFAULT_COMPANY_PRICING;
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

  await fs.writeFile(PRICING_DATA_PATH, JSON.stringify(updatedData, null, 2), "utf-8");
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

  await fs.writeFile(PRICING_DATA_PATH, JSON.stringify(updatedData, null, 2), "utf-8");
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

  await fs.writeFile(PRICING_DATA_PATH, JSON.stringify(updatedData, null, 2), "utf-8");
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

  await fs.writeFile(PRICING_DATA_PATH, JSON.stringify(updatedData, null, 2), "utf-8");
  cachedPricing = { data: updatedData, timestamp: Date.now() };

  revalidatePath("/competencia");
  revalidatePath("/admin/planes");
  return true;
}
