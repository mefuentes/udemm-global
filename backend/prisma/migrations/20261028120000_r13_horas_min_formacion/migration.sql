-- R-13: reemplazar porcentaje mínimo por horas mínimas de formación práctica
-- Migración aditiva — porcentajeMinFormacion se conserva, no se reinterpreta

ALTER TABLE "PlanEstudio"
  ADD COLUMN IF NOT EXISTS "horasMinFormacionPractica" INTEGER;
