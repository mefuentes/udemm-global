-- AlterTable: agregar campos de metadatos de archivo a Normativa
ALTER TABLE "Normativa" ADD COLUMN "nombreArchivoOriginal" TEXT;
ALTER TABLE "Normativa" ADD COLUMN "nombreArchivoFisico"   TEXT;
ALTER TABLE "Normativa" ADD COLUMN "tamanioArchivo"        INTEGER;
ALTER TABLE "Normativa" ADD COLUMN "mimeType"              TEXT;
