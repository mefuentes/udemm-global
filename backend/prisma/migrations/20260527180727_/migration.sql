/*
  Warnings:

  - A unique constraint covering the columns `[numeroDocumento]` on the table `Docente` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Docente_numeroDocumento_key" ON "Docente"("numeroDocumento");
