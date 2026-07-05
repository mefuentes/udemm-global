CREATE TABLE IF NOT EXISTS "HistorialMateria" (
  "id"          TEXT NOT NULL,
  "materiaId"   TEXT NOT NULL,
  "accion"      TEXT NOT NULL,
  "descripcion" TEXT,
  "usuarioId"   TEXT NOT NULL,
  "fecha"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistorialMateria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HistorialMateria_materiaId_fkey"
    FOREIGN KEY ("materiaId") REFERENCES "Materia"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HistorialMateria_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
