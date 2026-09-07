-- Seed idempotente: valores iniciales de TipoAreaEmisora
-- ON CONFLICT (nombre): si el valor ya existe, se reactiva sin duplicar.
-- No altera ni elimina otros valores existentes.

INSERT INTO "TipoAreaEmisora" ("id", "nombre", "activo", "fechaCreacion", "fechaActualizacion")
VALUES
  (gen_random_uuid(), 'CONSEJO DIRECTIVO',   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CONSEJO SUPERIOR',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DECANATO',            true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RECTORADO',           true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SECRETARÍA ACADÉMICA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SECRETARÍA GENERAL',  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO UPDATE
  SET "activo"             = true,
      "fechaActualizacion" = CURRENT_TIMESTAMP;
