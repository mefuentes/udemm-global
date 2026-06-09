-- AlterTable
ALTER TABLE "Rol" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ParametroGeneral" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametroGeneral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParametroGeneral_clave_key" ON "ParametroGeneral"("clave");
