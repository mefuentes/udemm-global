-- CIERRE-03 Fase B — D-05: Catálogo controlado de dedicación CONEAU
-- Migración exclusiva D-05. D-06 (tipoPosgradoId) queda pendiente en esquema preparatorio.
-- Generado manualmente a partir del diff de schema.prisma v1.1.0.
-- Revisado y aprobado antes de aplicar. Solo operaciones aditivas.

-- CreateTable: catálogo CONEAU de dedicación docente
CREATE TABLE "TipoDedicacionConeau" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoDedicacionConeau_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unicidad de nombre
CREATE UNIQUE INDEX "TipoDedicacionConeau_nombre_key" ON "TipoDedicacionConeau"("nombre");

-- CreateIndex: unicidad de código canónico
CREATE UNIQUE INDEX "TipoDedicacionConeau_codigo_key" ON "TipoDedicacionConeau"("codigo");

-- AlterTable: columna FK opcional en Docente (D-05 únicamente; D-06 tipoPosgradoId excluida)
ALTER TABLE "Docente" ADD COLUMN "tipoDedicacionConeauId" TEXT;

-- CreateIndex: índice para FK de dedicación CONEAU
CREATE INDEX "Docente_tipoDedicacionConeauId_idx" ON "Docente"("tipoDedicacionConeauId");

-- AddForeignKey: relación Docente → TipoDedicacionConeau (ON DELETE SET NULL)
ALTER TABLE "Docente" ADD CONSTRAINT "Docente_tipoDedicacionConeauId_fkey"
    FOREIGN KEY ("tipoDedicacionConeauId")
    REFERENCES "TipoDedicacionConeau"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
