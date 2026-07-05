ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "fechaVigenciaPrograma" TEXT;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "anioAprobacionRevision" INTEGER;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "profesorACargo" TEXT;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "competenciasVinculadas" TEXT;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "fechaUltimaActualizacion" TEXT;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "observacionesGestion" TEXT;
