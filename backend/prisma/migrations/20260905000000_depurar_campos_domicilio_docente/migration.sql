-- AlterTable: eliminar campos de domicilio obsoletos del modelo Docente
ALTER TABLE "Docente" DROP COLUMN IF EXISTS "telefono",
DROP COLUMN IF EXISTS "calle",
DROP COLUMN IF EXISTS "numero",
DROP COLUMN IF EXISTS "domicilio";
