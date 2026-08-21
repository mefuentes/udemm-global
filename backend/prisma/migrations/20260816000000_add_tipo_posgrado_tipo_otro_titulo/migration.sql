-- CreateTable
CREATE TABLE "TipoPosgrado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoPosgrado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoOtroTitulo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoOtroTitulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoPosgrado_nombre_key" ON "TipoPosgrado"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TipoOtroTitulo_nombre_key" ON "TipoOtroTitulo"("nombre");
