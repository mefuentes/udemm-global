ALTER TABLE "ProgramaAsignatura" ALTER COLUMN "fechaVigenciaPrograma" TYPE INTEGER USING NULLIF("fechaVigenciaPrograma", '')::INTEGER;
