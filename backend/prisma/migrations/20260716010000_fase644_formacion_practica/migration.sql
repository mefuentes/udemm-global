-- AlterTable: add grid JSON field for s4 Formación práctica
ALTER TABLE "ProgramaAsignatura" ADD COLUMN IF NOT EXISTS "formacionPracticaJson" TEXT;
