-- AlterTable: add grid JSON fields for s2 Competencias y contenidos
ALTER TABLE "ProgramaAsignatura" ADD COLUMN "competenciasResultadosJson" TEXT;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN "contenidosGridJson" TEXT;
