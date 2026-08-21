-- CreateTable
CREATE TABLE "TipoNormativa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TipoNormativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Normativa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "areaEmisora" TEXT NOT NULL,
    "vigencia" TEXT NOT NULL DEFAULT 'VIGENTE',
    "numeroNorma" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "palabrasClave" TEXT,
    "tipoNormativaId" TEXT NOT NULL,
    "rutaArchivoOriginal" TEXT,
    "rutaArchivoCuarentena" TEXT,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Normativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoNormativa_nombre_key" ON "TipoNormativa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Normativa_numeroNorma_anio_key" ON "Normativa"("numeroNorma", "anio");

-- AddForeignKey
ALTER TABLE "Normativa" ADD CONSTRAINT "Normativa_tipoNormativaId_fkey"
    FOREIGN KEY ("tipoNormativaId") REFERENCES "TipoNormativa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
