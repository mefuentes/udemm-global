-- AlterTable: add grid JSON field for s3 Unidades didácticas
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "unidadesDidacticasJson" TEXT;
