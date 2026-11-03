-- D07: Campos estructurados de Formación Práctica
-- Migración aditiva — sin modificar columnas existentes ni datos históricos

ALTER TABLE "ProgramaAsignatura"
  ADD COLUMN IF NOT EXISTS "hsSincronicas"       INTEGER,
  ADD COLUMN IF NOT EXISTS "hsAsincronicas"      INTEGER,
  ADD COLUMN IF NOT EXISTS "hsPresenciales"      INTEGER,
  ADD COLUMN IF NOT EXISTS "hsFormacionPractica" INTEGER;
