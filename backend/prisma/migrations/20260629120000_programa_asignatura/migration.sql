CREATE TABLE IF NOT EXISTS "ProgramaAsignatura" (
  "id"                         TEXT NOT NULL,
  "materiaId"                  TEXT NOT NULL,
  "equipoDocente"              TEXT,
  "elaboradoPor"               TEXT,
  "anioVigencia"               INTEGER,
  "fundamentacion"             TEXT,
  "objetivosGenerales"         TEXT,
  "objetivosEspecificos"       TEXT,
  "contenidosTematicos"        TEXT,
  "bibliografiaBasica"         TEXT,
  "bibliografiaComplementaria" TEXT,
  "recursosDidacticos"         TEXT,
  "metodologiaEnsenanza"       TEXT,
  "actividadesPracticas"       TEXT,
  "cronograma"                 TEXT,
  "criteriosEvaluacion"        TEXT,
  "instrumentosEvaluacion"     TEXT,
  "condicionesAprobacion"      TEXT,
  "estadoPrograma"             TEXT NOT NULL DEFAULT 'BORRADOR',
  "fechaAprobacion"            TIMESTAMP(3),
  "resolucionAprobacion"       TEXT,
  "observacionesGenerales"     TEXT,
  "vigenciaDesde"              INTEGER,
  "vigenciaHasta"              INTEGER,
  "estadoS1"                   TEXT NOT NULL DEFAULT 'PENDIENTE',
  "estadoS2"                   TEXT NOT NULL DEFAULT 'PENDIENTE',
  "estadoS3"                   TEXT NOT NULL DEFAULT 'PENDIENTE',
  "estadoS4"                   TEXT NOT NULL DEFAULT 'PENDIENTE',
  "estadoS5"                   TEXT NOT NULL DEFAULT 'PENDIENTE',
  "estadoS6"                   TEXT NOT NULL DEFAULT 'PENDIENTE',
  "fechaCreacion"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramaAsignatura_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramaAsignatura_materiaId_fkey"
    FOREIGN KEY ("materiaId") REFERENCES "Materia"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramaAsignatura_materiaId_key"
  ON "ProgramaAsignatura"("materiaId");

CREATE TABLE IF NOT EXISTS "HistorialPrograma" (
  "id"          TEXT NOT NULL,
  "programaId"  TEXT NOT NULL,
  "accion"      TEXT NOT NULL,
  "seccion"     TEXT,
  "descripcion" TEXT,
  "usuarioId"   TEXT NOT NULL,
  "fecha"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistorialPrograma_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HistorialPrograma_programaId_fkey"
    FOREIGN KEY ("programaId") REFERENCES "ProgramaAsignatura"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HistorialPrograma_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
