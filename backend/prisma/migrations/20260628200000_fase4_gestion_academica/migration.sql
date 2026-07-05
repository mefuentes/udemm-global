-- AlterTable: Facultad — agregar nuevos campos
ALTER TABLE "Facultad"
  ADD COLUMN IF NOT EXISTS "codigo"             TEXT,
  ADD COLUMN IF NOT EXISTS "descripcion"        TEXT,
  ADD COLUMN IF NOT EXISTS "estado"             TEXT NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS "fechaCreacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- UniqueIndex: Facultad.codigo
CREATE UNIQUE INDEX IF NOT EXISTS "Facultad_codigo_key" ON "Facultad"("codigo");

-- AlterTable: Carrera — agregar nuevos campos
ALTER TABLE "Carrera"
  ADD COLUMN IF NOT EXISTS "codigo"             TEXT,
  ADD COLUMN IF NOT EXISTS "tituloOtorgado"     TEXT,
  ADD COLUMN IF NOT EXISTS "duracionAnios"      INTEGER,
  ADD COLUMN IF NOT EXISTS "modalidad"          TEXT,
  ADD COLUMN IF NOT EXISTS "estado"             TEXT NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS "fechaCreacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- UniqueIndex: Carrera.codigo
CREATE UNIQUE INDEX IF NOT EXISTS "Carrera_codigo_key" ON "Carrera"("codigo");
