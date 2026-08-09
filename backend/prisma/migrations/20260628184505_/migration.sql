-- Ensure columns exist before altering (shadow DB safe: these come before fase4_gestion_academica in timestamp order)
ALTER TABLE "Carrera" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Facultad" ADD COLUMN IF NOT EXISTS "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop the database-level DEFAULT (Prisma manages updates via @updatedAt at the ORM layer)
ALTER TABLE "Carrera" ALTER COLUMN "fechaActualizacion" DROP DEFAULT;
ALTER TABLE "Facultad" ALTER COLUMN "fechaActualizacion" DROP DEFAULT;
