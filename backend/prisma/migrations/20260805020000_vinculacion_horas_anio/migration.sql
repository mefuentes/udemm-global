-- Agregar horasSemana y anioInicio a VinculacionCatedra
ALTER TABLE "VinculacionCatedra"
  ADD COLUMN "horasSemana" INTEGER,
  ADD COLUMN "anioInicio"  INTEGER;
