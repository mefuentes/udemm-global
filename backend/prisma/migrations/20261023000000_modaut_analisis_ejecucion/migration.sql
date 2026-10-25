-- ============================================================
-- MOD-AUT IMPL-5B — Tabla AnalisisEjecucion
-- Implementa: persistencia real de ejecuciones de análisis,
--             historial por ámbito/entidad, snapshot de resultados.
-- Cambios: nueva tabla autoevaluacion_ejecucion.
-- ESTADO: PREPARADA — Migración local únicamente. No ejecutar en Render.
-- Sin DROP TABLE, DROP COLUMN ni UPDATE masivo.
-- Compatible con PostgreSQL. Segura para datos existentes.
-- Revisada contra schema.prisma (prisma validate: OK).
-- ============================================================

-- ── 1. Tabla autoevaluacion_ejecucion ────────────────────────────────────────
-- Registra cada ejecución explícita de análisis MOD-AUT.
-- ambito: 'FACULTAD' | 'CARRERA' | 'PLAN'
-- entidadId: id de la facultad, carrera o plan según el ámbito
-- estado: 'EN_CURSO' durante el cálculo, 'COMPLETADO' o 'ERROR' al terminar
-- snapshot: resultado completo serializado (JSONB), nullable hasta COMPLETADO
-- versionFormato: '1' para evolución futura del schema del snapshot

CREATE TABLE IF NOT EXISTS "autoevaluacion_ejecucion" (
    "id"                 TEXT         NOT NULL,
    "ambito"             TEXT         NOT NULL,
    "entidadId"          TEXT         NOT NULL,
    "facultadId"         TEXT         NOT NULL,
    "usuarioId"          TEXT         NOT NULL,
    "versionFormato"     TEXT         NOT NULL DEFAULT '1',
    "fechaInicio"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin"           TIMESTAMP(3),
    "estado"             TEXT         NOT NULL,
    "snapshot"           JSONB,
    "errores"            TEXT,
    "fechaCreacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoevaluacion_ejecucion_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "autoevaluacion_ejecucion_usuarioId_fkey"
        FOREIGN KEY ("usuarioId")
        REFERENCES "Usuario"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "autoevaluacion_ejecucion_facultadId_fkey"
        FOREIGN KEY ("facultadId")
        REFERENCES "Facultad"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ── 2. Índices ───────────────────────────────────────────────────────────────

-- Consulta principal de historial: ejecuciones de una entidad en orden descendente
CREATE INDEX IF NOT EXISTS "autoevaluacion_ejecucion_ambito_entidadId_fechaInicio_idx"
    ON "autoevaluacion_ejecucion" ("ambito", "entidadId", "fechaInicio" DESC);

-- Consulta de alcance por facultad (para restricción de acceso DIRECTOR_FACULTAD)
CREATE INDEX IF NOT EXISTS "autoevaluacion_ejecucion_facultadId_fechaInicio_idx"
    ON "autoevaluacion_ejecucion" ("facultadId", "fechaInicio" DESC);

-- ── 3. Verificación post-aplicación ─────────────────────────────────────────
--
--   SELECT COUNT(*) FROM "autoevaluacion_ejecucion";
--   -- Esperado: 0 (la tabla nace vacía)
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'autoevaluacion_ejecucion'
--    ORDER BY ordinal_position;
--   -- Debe mostrar las 13 columnas definidas arriba.
