/*
  Warnings:

  - A unique constraint covering the columns `[codigo]` on the table `PlanEstudio` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fechaActualizacion` to the `Materia` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fechaActualizacion` to the `PlanEstudio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Materia" ADD COLUMN     "anio" INTEGER,
ADD COLUMN     "correlativasJson" TEXT,
ADD COLUMN     "cuatrimestre" INTEGER,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "fechaActualizacion" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "horasSemanales" INTEGER,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'OBLIGATORIA';

-- AlterTable
ALTER TABLE "PlanEstudio" ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "duracionCuatrimestres" INTEGER,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "fechaActualizacion" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fechaAprobacion" TIMESTAMP(3),
ADD COLUMN     "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resolucionAprobacion" TEXT,
ADD COLUMN     "totalCreditos" INTEGER,
ADD COLUMN     "version" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlanEstudio_codigo_key" ON "PlanEstudio"("codigo");
