DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relname = 'ProgramaAsignatura'
      AND a.attname = 'fechaVigenciaPrograma'
      AND t.typname = 'text'
  ) THEN
    UPDATE "ProgramaAsignatura"
      SET "fechaVigenciaPrograma" = NULL
      WHERE "fechaVigenciaPrograma" IS NULL OR "fechaVigenciaPrograma" = '';
    ALTER TABLE "ProgramaAsignatura"
      ALTER COLUMN "fechaVigenciaPrograma" TYPE INTEGER
      USING "fechaVigenciaPrograma"::INTEGER;
  END IF;
END $$;
