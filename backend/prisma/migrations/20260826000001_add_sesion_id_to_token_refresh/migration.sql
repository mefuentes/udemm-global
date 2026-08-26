-- AlterTable: add sesionId (optional FK) to TokenRefresh for session-based access token revocation
ALTER TABLE "TokenRefresh" ADD COLUMN "sesionId" TEXT;

-- AddForeignKey
ALTER TABLE "TokenRefresh" ADD CONSTRAINT "TokenRefresh_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "Sesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
