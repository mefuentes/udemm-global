/*
  Warnings:

  - You are about to drop the column `correlativasJson` on the `Materia` table. All the data in the column will be lost.
  - You are about to drop the column `horasSemanales` on the `Materia` table. All the data in the column will be lost.
  - You are about to drop the column `tipo` on the `Materia` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Materia" DROP COLUMN "correlativasJson",
DROP COLUMN "horasSemanales",
DROP COLUMN "tipo",
ADD COLUMN     "bloqueConocimiento" TEXT,
ADD COLUMN     "cargaHorariaSemanal" INTEGER,
ADD COLUMN     "cargaHorariaTotal" INTEGER,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "regimenCursado" TEXT,
ADD COLUMN     "tipoAsignatura" TEXT NOT NULL DEFAULT 'OBLIGATORIA',
ALTER COLUMN "creditos" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "PlanEstudio" ADD COLUMN     "anio" INTEGER;

-- CreateTable
CREATE TABLE "Correlatividad" (
    "id" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,
    "correlativaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CURSADO',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correlatividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Correlatividad_materiaId_correlativaId_key" ON "Correlatividad"("materiaId", "correlativaId");

-- AddForeignKey
ALTER TABLE "Correlatividad" ADD CONSTRAINT "Correlatividad_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correlatividad" ADD CONSTRAINT "Correlatividad_correlativaId_fkey" FOREIGN KEY ("correlativaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
