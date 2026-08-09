-- Normalización: convertir todos los registros en estado BORRADOR a EN_REVISION
UPDATE "ProgramaAsignatura"
SET "estadoPrograma" = 'EN_REVISION'
WHERE "estadoPrograma" = 'BORRADOR';

-- Actualizar el valor por defecto de la columna
ALTER TABLE "ProgramaAsignatura"
  ALTER COLUMN "estadoPrograma" SET DEFAULT 'EN_REVISION';
