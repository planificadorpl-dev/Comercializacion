-- ==============================================================================
-- SISTEMA DE GESTIÓN COMERCIAL POWER LINK - ESQUEMA NATIVO POSTGRESQL (INTRANET)
-- ==============================================================================
-- Este script crea todas las tablas, índices, restricciones y valores por defecto
-- para ejecutar el sistema 100% en una base de datos PostgreSQL local/on-premise.
-- ==============================================================================

-- 1. TABLA: usuarios (Autenticación y Roles del Sistema)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id VARCHAR(100) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'supervisor', 'impulsador', 'asesor')),
  colaborador_id VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);

-- 2. TABLA: configuracion_modulos (Control de acceso a paneles y módulos)
CREATE TABLE IF NOT EXISTS public.configuracion_modulos (
  id VARCHAR(100) PRIMARY KEY,
  enabled_for_users BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100)
);

-- 3. TABLA: asesores_config (Lista maestra de asesores de campo)
CREATE TABLE IF NOT EXISTS public.asesores_config (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) UNIQUE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asesores_nombre ON public.asesores_config(nombre);

-- 4. TABLA: personal_config (Overrides, alias, técnicos y clasificaciones)
CREATE TABLE IF NOT EXISTS public.personal_config (
  key VARCHAR(50) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100)
);

COMMENT ON TABLE public.personal_config IS 'Almacena configuraciones avanzadas de personal: overrides, aliases, técnicos y departamentos';

-- 5. TABLAS: Entidades Administrativas
CREATE TABLE IF NOT EXISTS public.departamentos (
  id VARCHAR(100) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  color VARCHAR(50),
  responsable VARCHAR(255),
  orden INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sedes_taquilla (
  id VARCHAR(100) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  direccion TEXT,
  ciudad VARCHAR(100),
  telefono VARCHAR(50),
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.canales_comerciales (
  id VARCHAR(100) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  descripcion TEXT,
  comision_pct NUMERIC(5,2) DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- 6. TABLA: evaluaciones (Rúbricas continuas de 30 factores para asesores)
CREATE TABLE IF NOT EXISTS public.evaluaciones (
  id VARCHAR(100) PRIMARY KEY,
  asesor VARCHAR(255) NOT NULL,
  evaluador VARCHAR(255) NOT NULL,
  evaluador_rol VARCHAR(100),
  frecuencia VARCHAR(100),
  fecha DATE NOT NULL,
  estado VARCHAR(100),
  municipio VARCHAR(100),
  parroquia VARCHAR(100),
  sector VARCHAR(255),
  items JSONB NOT NULL DEFAULT '{}'::jsonb,
  observaciones_generales TEXT,
  cumplimiento_pct INT DEFAULT 0,
  puntuacion_total INT DEFAULT 0,
  puntuacion_maxima INT DEFAULT 150,
  puntuacion_promedio NUMERIC(4,2) DEFAULT 0,
  items_cumplidos INT DEFAULT 0,
  items_total INT DEFAULT 30,
  factor_scores JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_asesor ON public.evaluaciones(asesor);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_fecha ON public.evaluaciones(fecha DESC);

-- 7. TABLA: actividades (Registro diario de campo y recorrido de ventas)
CREATE TABLE IF NOT EXISTS public.actividades (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  hora VARCHAR(20),
  asesor VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  solicitudes INT DEFAULT 0,
  clientes_captados INT DEFAULT 0,
  volantes INT DEFAULT 0,
  llamadas_info INT DEFAULT 0,
  llamadas_agenda INT DEFAULT 0,
  estado VARCHAR(100),
  municipio VARCHAR(100),
  parroquia VARCHAR(100),
  sector VARCHAR(255),
  condominio VARCHAR(255),
  notas TEXT,
  reporte_wa TEXT,
  uid VARCHAR(100),
  cerrada BOOLEAN NOT NULL DEFAULT false,
  checklist JSONB,
  checklist_cumplimiento_pct INT DEFAULT 0,
  checklist_cumplidos INT DEFAULT 0,
  checklist_total INT DEFAULT 30,
  checklist_factor_scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actividades_fecha ON public.actividades(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_actividades_asesor ON public.actividades(asesor);
CREATE INDEX IF NOT EXISTS idx_actividades_cerrada ON public.actividades(cerrada);

-- 8. TABLA: advisor_checklists (Guía operativa diaria del asesor de 30 ítems)
CREATE TABLE IF NOT EXISTS public.advisor_checklists (
  id VARCHAR(100) PRIMARY KEY,
  asesor VARCHAR(255) NOT NULL,
  fecha DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '{}'::jsonb,
  cumplimiento_pct INT DEFAULT 0,
  items_cumplidos INT DEFAULT 0,
  items_total INT DEFAULT 30,
  factor_scores JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asesor, fecha)
);

CREATE INDEX IF NOT EXISTS idx_advisor_checklists_asesor ON public.advisor_checklists(asesor);
CREATE INDEX IF NOT EXISTS idx_advisor_checklists_fecha ON public.advisor_checklists(fecha DESC);

-- 9. TABLA: solicitudes (Clientes potenciales y solicitudes captadas en campo/taquilla)
CREATE TABLE IF NOT EXISTS public.solicitudes (
  id SERIAL PRIMARY KEY,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  promotor VARCHAR(255),
  asesor_normalizado VARCHAR(255),
  fuente VARCHAR(100),
  nombres VARCHAR(255),
  apellidos VARCHAR(255),
  nombre_cliente VARCHAR(255),
  cedula VARCHAR(50),
  telefono VARCHAR(50),
  plan VARCHAR(100),
  estado VARCHAR(100),
  municipio VARCHAR(100),
  parroquia VARCHAR(100),
  sector VARCHAR(255),
  ubicacion TEXT,
  canal VARCHAR(100),
  sede_taquilla VARCHAR(100),
  estatus VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
  tipo_operacion VARCHAR(100) DEFAULT 'Instalación',
  power_go VARCHAR(10) DEFAULT 'NO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON public.solicitudes(fecha_solicitud DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_asesor ON public.solicitudes(promotor);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula ON public.solicitudes(cedula);

-- 10. TABLA: instalaciones (Cuadro Diario de Instalaciones Técnicas)
CREATE TABLE IF NOT EXISTS public.instalaciones (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  mes VARCHAR(50),
  tecnico_1 VARCHAR(255),
  tecnico_2 VARCHAR(255),
  router VARCHAR(100),
  nombre_cliente VARCHAR(255) NOT NULL,
  cedula VARCHAR(50),
  zona VARCHAR(100),
  sector VARCHAR(255),
  asesor VARCHAR(255),
  tipo_asesor VARCHAR(50),
  estatus VARCHAR(50) NOT NULL DEFAULT 'INSTALADO',
  plan VARCHAR(100),
  power_go VARCHAR(10) DEFAULT 'NO',
  servicio VARCHAR(100),
  oficina VARCHAR(100),
  estado VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instalaciones_fecha ON public.instalaciones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_instalaciones_asesor ON public.instalaciones(asesor);
CREATE INDEX IF NOT EXISTS idx_instalaciones_tecnico1 ON public.instalaciones(tecnico_1);
CREATE INDEX IF NOT EXISTS idx_instalaciones_estatus ON public.instalaciones(estatus);

-- 11. TABLA: geodata_config (Catálogo territorial: estados, municipios, parroquias, sectores)
CREATE TABLE IF NOT EXISTS public.geodata_config (
  id SERIAL PRIMARY KEY,
  estado VARCHAR(100) NOT NULL,
  municipio VARCHAR(100) NOT NULL,
  parroquia VARCHAR(100) NOT NULL,
  sector VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_geodata UNIQUE (estado, municipio, parroquia, sector)
);

CREATE INDEX IF NOT EXISTS idx_geodata_hierarchy ON public.geodata_config(estado, municipio, parroquia);

-- 12. TABLA: planes_config (Planes comerciales y residenciales de internet)
CREATE TABLE IF NOT EXISTS public.planes_config (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  has_tv BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_planes UNIQUE (nombre, tipo)
);

-- 13. TABLA: operadores_competencia (Relevamiento de la competencia y mercado)
CREATE TABLE IF NOT EXISTS public.operadores_competencia (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL UNIQUE,
  color_hex VARCHAR(20) NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. TABLA: ofertas_competencia (Precios, tarifas y promociones del mercado)
CREATE TABLE IF NOT EXISTS public.ofertas_competencia (
  id SERIAL PRIMARY KEY,
  operador_id INT REFERENCES public.operadores_competencia(id) ON DELETE CASCADE,
  plan_nombre VARCHAR(255),
  tecnologia VARCHAR(100),
  velocidad_mbps INT,
  tarifa_usd NUMERIC(10,2),
  costo_instalacion_usd NUMERIC(10,2),
  promocion TEXT,
  estado VARCHAR(100),
  municipio VARCHAR(100),
  parroquia VARCHAR(100),
  sector VARCHAR(255),
  fecha_reporte DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofertas_operador ON public.ofertas_competencia(operador_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_fecha ON public.ofertas_competencia(fecha_reporte DESC);

-- 15. VALORES INICIALES: Módulos del Sistema
INSERT INTO public.configuracion_modulos (id, enabled_for_users, updated_at, updated_by)
VALUES 
  ('planificacion', false, NOW(), 'sistema'),
  ('competencia', false, NOW(), 'sistema'),
  ('evaluaciones', true, NOW(), 'sistema'),
  ('actividades', true, NOW(), 'sistema'),
  ('solicitudes', true, NOW(), 'sistema')
ON CONFLICT (id) DO NOTHING;

-- 16. VALORES INICIALES: Planes comerciales reales
INSERT INTO public.planes_config (nombre, tipo, activo, has_tv)
VALUES 
  ('400MB', 'Domiciliario', true, false),
  ('600MB', 'Domiciliario', true, true),
  ('800 MB', 'Domiciliario', true, true),
  ('1GB', 'Domiciliario', true, true),
  ('400 MB', 'Empresarial', true, false),
  ('600 MB', 'Empresarial', true, false),
  ('800 MB', 'Empresarial', true, false),
  ('1 GB', 'Empresarial', true, false)
ON CONFLICT (nombre, tipo) DO UPDATE SET
  activo = EXCLUDED.activo,
  has_tv = EXCLUDED.has_tv;
