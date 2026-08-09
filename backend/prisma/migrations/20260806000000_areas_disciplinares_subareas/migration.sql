-- CreateTable
CREATE TABLE "AreaDisciplinar" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaDisciplinar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subarea" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "areaDisciplinarId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subarea_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Docente" ADD COLUMN "areaDisciplinarId" TEXT,
                      ADD COLUMN "subareaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AreaDisciplinar_nombre_key" ON "AreaDisciplinar"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Subarea_nombre_areaDisciplinarId_key" ON "Subarea"("nombre", "areaDisciplinarId");

-- AddForeignKey
ALTER TABLE "Subarea" ADD CONSTRAINT "Subarea_areaDisciplinarId_fkey"
    FOREIGN KEY ("areaDisciplinarId") REFERENCES "AreaDisciplinar"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docente" ADD CONSTRAINT "Docente_areaDisciplinarId_fkey"
    FOREIGN KEY ("areaDisciplinarId") REFERENCES "AreaDisciplinar"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docente" ADD CONSTRAINT "Docente_subareaId_fkey"
    FOREIGN KEY ("subareaId") REFERENCES "Subarea"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed
INSERT INTO "AreaDisciplinar" ("id", "nombre", "activo", "fechaCreacion", "fechaActualizacion")
VALUES (gen_random_uuid(), 'INGENIERÍA', true, NOW(), NOW());

INSERT INTO "Subarea" ("id", "nombre", "areaDisciplinarId", "activo", "fechaCreacion", "fechaActualizacion")
SELECT gen_random_uuid(), 'INGENIERÍA INDUSTRIAL', "id", true, NOW(), NOW()
FROM "AreaDisciplinar" WHERE "nombre" = 'INGENIERÍA';
