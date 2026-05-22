-- CreateTable
CREATE TABLE "Universidad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Universidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facultad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "universidadId" TEXT NOT NULL,

    CONSTRAINT "Facultad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrera" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "facultadId" TEXT NOT NULL,

    CONSTRAINT "Carrera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEstudio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "carreraId" TEXT NOT NULL,

    CONSTRAINT "PlanEstudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materia" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,
    "planEstudioId" TEXT NOT NULL,

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Materia_codigo_key" ON "Materia"("codigo");

-- AddForeignKey
ALTER TABLE "Facultad" ADD CONSTRAINT "Facultad_universidadId_fkey" FOREIGN KEY ("universidadId") REFERENCES "Universidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrera" ADD CONSTRAINT "Carrera_facultadId_fkey" FOREIGN KEY ("facultadId") REFERENCES "Facultad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEstudio" ADD CONSTRAINT "PlanEstudio_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materia" ADD CONSTRAINT "Materia_planEstudioId_fkey" FOREIGN KEY ("planEstudioId") REFERENCES "PlanEstudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
