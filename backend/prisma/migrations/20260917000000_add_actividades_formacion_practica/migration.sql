-- AlterTable: agregar campo de texto libre para "Actividades de Formación Práctica"
-- El campo formacionPracticaJson pasa a almacenar filas de intensidad { intensidad, horasClase }
ALTER TABLE "ProgramaAsignatura" ADD COLUMN "actividadesFormacionPractica" TEXT;
