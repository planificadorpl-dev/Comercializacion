-- Migration: Crear tabla de planificacion_jornadas sincronizada con Supabase
CREATE TABLE IF NOT EXISTS planificacion_jornadas (
    id BIGSERIAL PRIMARY KEY,
    sheet_row_index INTEGER,
    fecha DATE NOT NULL,
    mes VARCHAR(50) NOT NULL,
    asesor VARCHAR(150) NOT NULL,
    estado VARCHAR(100) DEFAULT 'Miranda',
    municipio VARCHAR(100) DEFAULT 'Carrizal',
    parroquia VARCHAR(100) NOT NULL,
    sector VARCHAR(150) NOT NULL,
    tipo_actividad VARCHAR(150) DEFAULT 'Recorrido con Instaladores',
    estatus VARCHAR(50) DEFAULT 'Planificado',
    formula_final TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint único para evitar registros duplicados de un mismo asesor en el mismo día
CREATE UNIQUE INDEX IF NOT EXISTS idx_planificacion_fecha_asesor 
ON planificacion_jornadas (fecha, LOWER(TRIM(asesor)));

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_planificacion_fecha ON planificacion_jornadas (fecha);
CREATE INDEX IF NOT EXISTS idx_planificacion_mes ON planificacion_jornadas (mes);
CREATE INDEX IF NOT EXISTS idx_planificacion_asesor ON planificacion_jornadas (LOWER(TRIM(asesor)));
CREATE INDEX IF NOT EXISTS idx_planificacion_parroquia ON planificacion_jornadas (LOWER(TRIM(parroquia)));
CREATE INDEX IF NOT EXISTS idx_planificacion_sector ON planificacion_jornadas (LOWER(TRIM(sector)));

-- RLS y permisos
ALTER TABLE planificacion_jornadas ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'planificacion_jornadas' AND policyname = 'Allow all access to planificacion_jornadas'
    ) THEN
        CREATE POLICY "Allow all access to planificacion_jornadas" 
        ON planificacion_jornadas 
        FOR ALL 
        TO anon, authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

GRANT ALL ON planificacion_jornadas TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

