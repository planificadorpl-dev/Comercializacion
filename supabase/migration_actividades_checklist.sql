-- ==============================================================================
-- MIGRACIÓN SUPABASE: Agregar columnas de Checklist Operativo a 'actividades'
-- Ejecutar este script en el SQL Editor de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/cvjafgnzrydzxwqolguw/sql
-- ==============================================================================

ALTER TABLE public.actividades
  -- 1. Columna JSONB principal para el objeto completo de respuestas y métricas
  ADD COLUMN IF NOT EXISTS checklist JSONB,
  ADD COLUMN IF NOT EXISTS checklist_cumplimiento_pct INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checklist_cumplidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checklist_total INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS checklist_factor_scores JSONB,

  -- 2. Columnas individuales para el Factor Territorial
  ADD COLUMN IF NOT EXISTS chk_afluencia BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_barridos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_competencia BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_ubicacion BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_lideres BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_prospectos BOOLEAN,

  -- 3. Columnas individuales para el Factor Tecnológico
  ADD COLUMN IF NOT EXISTS chk_lectura BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_mangas BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_conceptos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_routers BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_dispositivos BOOLEAN,

  -- 4. Columnas individuales para el Factor Táctico
  ADD COLUMN IF NOT EXISTS chk_modelaje BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_conexion BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_abordaje BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_obstaculos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_adaptabilidad BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_postventa BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_metodologia BOOLEAN,

  -- 5. Columnas individuales para el Factor Argumentativo
  ADD COLUMN IF NOT EXISTS chk_beneficios BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_costo_beneficio BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_justificacion BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_tiempos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_requerimientos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_factibilidad BOOLEAN,

  -- 6. Columnas individuales para el Factor Organizacional
  ADD COLUMN IF NOT EXISTS chk_formatos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_reporte BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_informe BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_servicios BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_contactos BOOLEAN,
  ADD COLUMN IF NOT EXISTS chk_canales BOOLEAN;

-- Comentario descriptivo
COMMENT ON COLUMN public.actividades.checklist IS 'Respuestas declaradas por el asesor en la guía operativa diaria (30 ítems Sí/No)';
COMMENT ON COLUMN public.actividades.checklist_cumplimiento_pct IS 'Porcentaje de cumplimiento operativo declarado por el asesor al cerrar el día';
