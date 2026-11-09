-- ==============================================================================
-- MIGRACIÓN SUPABASE: Tabla de Configuración de Módulos y Paneles del Sistema
-- Ejecutar en el SQL Editor de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/cvjafgnzrydzxwqolguw/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.configuracion_modulos (
  id TEXT PRIMARY KEY,
  enabled_for_users BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

COMMENT ON TABLE public.configuracion_modulos IS 'Configuración de disponibilidad de paneles y módulos para usuarios no administradores';

-- Insertar configuración inicial
INSERT INTO public.configuracion_modulos (id, enabled_for_users, updated_at, updated_by)
VALUES 
  ('planificacion', false, NOW(), 'sistema'),
  ('planificador', true, NOW(), 'sistema'),
  ('competencia', false, NOW(), 'sistema'),
  ('evaluaciones', true, NOW(), 'sistema'),
  ('actividades', true, NOW(), 'sistema'),
  ('solicitudes', true, NOW(), 'sistema'),
  ('factibilidad', true, NOW(), 'sistema')
ON CONFLICT (id) DO NOTHING;
