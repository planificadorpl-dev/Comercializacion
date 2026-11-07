-- ==============================================================================
-- MIGRACIÓN SUPABASE / POSTGRESQL: Tabla de Cajas y Factibilidad de Fibra Óptica
-- ==============================================================================
-- Ejecutar en el SQL Editor de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/cvjafgnzrydzxwqolguw/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.factibilidad_cajas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  box_type TEXT,
  box_type_name TEXT,
  is_nap BOOLEAN NOT NULL DEFAULT true,
  total_ports INT NOT NULL DEFAULT 0,
  available_ports INT NOT NULL DEFAULT 0,
  used_ports INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponible',
  potencia TEXT,
  pon TEXT,
  sector TEXT,
  observation TEXT,
  project TEXT,
  cables_count INT DEFAULT 0,
  implanted BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de alto rendimiento para consultas espaciales y de disponibilidad
CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_status ON public.factibilidad_cajas(status);
CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_is_nap ON public.factibilidad_cajas(is_nap);
CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_coords ON public.factibilidad_cajas(lat, lng);
CREATE INDEX IF NOT EXISTS idx_factibilidad_cajas_synced_at ON public.factibilidad_cajas(synced_at);

COMMENT ON TABLE public.factibilidad_cajas IS 'Caché persistente de cajas y NAPs de fibra óptica sincronizadas desde OZmap para consultas ultrarrápidas de factibilidad';

