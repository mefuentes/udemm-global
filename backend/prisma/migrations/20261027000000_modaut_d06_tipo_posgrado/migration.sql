-- D-06: Activar relación Docente ↔ TipoPosgrado (CIERRE-03 Fase B)
-- Migración ADITIVA — no elimina ni modifica columnas existentes.
-- Precondición: tabla "TipoPosgrado" ya existe con registros DOCTORADO, MAESTRIA, ESPECIALIZACION.
-- Postcondición: columna "tipoPosgradoId" activa en "Docente", FK y índice creados.

ALTER TABLE "Docente"
  ADD COLUMN IF NOT EXISTS "tipoPosgradoId" TEXT;

ALTER TABLE "Docente"
  ADD CONSTRAINT "Docente_tipoPosgradoId_fkey"
  FOREIGN KEY ("tipoPosgradoId")
  REFERENCES "TipoPosgrado"(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Docente_tipoPosgradoId_idx"
  ON "Docente"("tipoPosgradoId");
