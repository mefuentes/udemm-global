-- Recalcular estadoPrograma en registros existentes:
-- Si todas las secciones están COMPLETO → EN_REVISION (listo para aprobación)
-- De lo contrario → PENDIENTE
UPDATE "ProgramaAsignatura"
SET "estadoPrograma" = CASE
  WHEN "estadoS1" = 'COMPLETO'
   AND "estadoS2" = 'COMPLETO'
   AND "estadoS3" = 'COMPLETO'
   AND "estadoS4" = 'COMPLETO'
   AND "estadoS5" = 'COMPLETO'
   AND "estadoS6" = 'COMPLETO'
  THEN 'EN_REVISION'
  ELSE 'PENDIENTE'
END
WHERE "estadoPrograma" NOT IN ('APROBADO');

-- Actualizar el valor por defecto de la columna
ALTER TABLE "ProgramaAsignatura"
  ALTER COLUMN "estadoPrograma" SET DEFAULT 'PENDIENTE';
