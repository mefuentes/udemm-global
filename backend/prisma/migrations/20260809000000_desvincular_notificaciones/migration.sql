-- Campos de desvinculación en VinculacionCatedra
ALTER TABLE "VinculacionCatedra" ADD COLUMN "desvinculadorId" TEXT;
ALTER TABLE "VinculacionCatedra" ADD COLUMN "fechaDesvinculacion" TIMESTAMP(3);
ALTER TABLE "VinculacionCatedra" ADD COLUMN "motivoDesvinculacion" TEXT;
ALTER TABLE "VinculacionCatedra" ADD COLUMN "fechaRegistroDesvinculacion" TIMESTAMP(3);

ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_desvinculadorId_fkey"
    FOREIGN KEY ("desvinculadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla de notificaciones
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fechaLectura" TIMESTAMP(3),
    "docenteId" TEXT NOT NULL,
    "vinculacionId" TEXT,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_docenteId_fkey"
    FOREIGN KEY ("docenteId") REFERENCES "Docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
