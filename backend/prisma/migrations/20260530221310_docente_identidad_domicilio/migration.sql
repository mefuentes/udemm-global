-- AlterTable
ALTER TABLE "Docente" ADD COLUMN     "calle" TEXT,
ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "pisoDepto" TEXT,
ADD COLUMN     "provincia" TEXT,
ADD COLUMN     "residencia" TEXT,
ADD COLUMN     "sexo" TEXT;
