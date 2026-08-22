-- AlterTable: agregar FK opcional a normativa sucesora (relación auto-referencial)
ALTER TABLE "Normativa" ADD COLUMN "normativaSucesoraId" TEXT;

-- AddForeignKey: auto-referencial — SET NULL si la sucesora fuera eliminada físicamente
ALTER TABLE "Normativa" ADD CONSTRAINT "Normativa_normativaSucesoraId_fkey"
    FOREIGN KEY ("normativaSucesoraId") REFERENCES "Normativa"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: historial de cambios de estado (punto de integración para auditoría futura)
CREATE TABLE "HistorialEstadoNormativa" (
    "id"                  TEXT NOT NULL,
    "normativaId"         TEXT NOT NULL,
    "estadoAnterior"      TEXT NOT NULL,
    "estadoNuevo"         TEXT NOT NULL,
    "motivo"              TEXT NOT NULL,
    "normativaSucesoraId" TEXT,
    "usuarioId"           TEXT,
    "fechaCambio"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialEstadoNormativa_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: historial → normativa (RESTRICT: el historial preserva trazabilidad)
ALTER TABLE "HistorialEstadoNormativa" ADD CONSTRAINT "HistorialEstadoNormativa_normativaId_fkey"
    FOREIGN KEY ("normativaId") REFERENCES "Normativa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
