-- CreateTable
CREATE TABLE "VinculacionCatedra" (
    "id"                    TEXT NOT NULL,
    "facultadId"            TEXT NOT NULL,
    "carreraId"             TEXT NOT NULL,
    "planEstudioId"         TEXT NOT NULL,
    "materiaId"             TEXT NOT NULL,
    "docenteId"             TEXT NOT NULL,
    "catedraId"             TEXT NOT NULL,
    "cargoId"               TEXT NOT NULL,
    "modalidadId"           TEXT NOT NULL,
    "designacionId"         TEXT NOT NULL,
    "estado"                TEXT NOT NULL DEFAULT 'PENDIENTE_DE_APROBACION',
    "observaciones"         TEXT,
    "usuarioSolicitanteId"  TEXT NOT NULL,
    "fechaCreacion"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VinculacionCatedra_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_facultadId_fkey"
    FOREIGN KEY ("facultadId") REFERENCES "Facultad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_carreraId_fkey"
    FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_planEstudioId_fkey"
    FOREIGN KEY ("planEstudioId") REFERENCES "PlanEstudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_materiaId_fkey"
    FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_docenteId_fkey"
    FOREIGN KEY ("docenteId") REFERENCES "Docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_catedraId_fkey"
    FOREIGN KEY ("catedraId") REFERENCES "Catedra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_cargoId_fkey"
    FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_modalidadId_fkey"
    FOREIGN KEY ("modalidadId") REFERENCES "Modalidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_designacionId_fkey"
    FOREIGN KEY ("designacionId") REFERENCES "Designacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_usuarioSolicitanteId_fkey"
    FOREIGN KEY ("usuarioSolicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
