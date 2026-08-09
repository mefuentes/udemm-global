-- AlterTable: add aportesPerfilTitulo and recomendacionesCursado to ProgramaAsignatura
ALTER TABLE "ProgramaAsignatura" ADD COLUMN "aportesPerfilTitulo" TEXT;
ALTER TABLE "ProgramaAsignatura" ADD COLUMN "recomendacionesCursado" TEXT;
