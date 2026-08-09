-- AlterTable: agregar campos de aprobación/rechazo
ALTER TABLE "VinculacionCatedra"
  ADD COLUMN "aprobadorId"      TEXT,
  ADD COLUMN "fechaAprobacion"  TIMESTAMP(3),
  ADD COLUMN "motivoRechazo"    TEXT;

-- AddForeignKey
ALTER TABLE "VinculacionCatedra" ADD CONSTRAINT "VinculacionCatedra_aprobadorId_fkey"
    FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
