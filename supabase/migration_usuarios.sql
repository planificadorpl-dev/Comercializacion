-- ==============================================================================
-- MIGRACIÓN SUPABASE: Tabla de Usuarios y Roles del Sistema de Ventas
-- Opcional: Ejecutar este script en el SQL Editor de tu proyecto Supabase:
-- https://supabase.com/dashboard/project/cvjafgnzrydzxwqolguw/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.usuarios (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'supervisor', 'impulsador', 'asesor')),
  colaborador_id TEXT,
  activo BOOLEAN DEFAULT true,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

COMMENT ON TABLE public.usuarios IS 'Usuarios del sistema de comercialización con roles y asignación a colaboradores';
