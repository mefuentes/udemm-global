-- MOD-AUT R-13: Configuración de formación práctica (FSD §6.3)
-- Permite declarar si PPS/PI son obligatorios para un plan y el porcentaje mínimo de formación práctica.
--
-- SEMÁNTICA NULLABLE:
--   NULL  = no configurado (R-13 no puede verificar cumplimiento, reporta D-13)
--   TRUE  = explícitamente requerido (ausencia → incumplimiento)
--   FALSE = explícitamente no requerido (ausencia → normal)
--
-- Sin DEFAULT: los planes existentes quedan NULL (no configurados), no FALSE (no requeridos).
-- Compatible con PostgreSQL 17 y 18.

ALTER TABLE "PlanEstudio"
  ADD COLUMN "requierePPS"            BOOLEAN,
  ADD COLUMN "requierePI"             BOOLEAN,
  ADD COLUMN "porcentajeMinFormacion" INTEGER;

-- Rango válido para el porcentaje (0–100).
ALTER TABLE "PlanEstudio"
  ADD CONSTRAINT "PlanEstudio_porcentajeMinFormacion_range"
    CHECK (
      "porcentajeMinFormacion" IS NULL
      OR ("porcentajeMinFormacion" >= 0 AND "porcentajeMinFormacion" <= 100)
    );
