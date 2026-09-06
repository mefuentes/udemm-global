-- Seed idempotente: categorías iniciales de TipoNormativa
-- ON CONFLICT (nombre): si la categoría ya existe, se reactiva sin duplicar.
-- No altera ni elimina otras categorías existentes.

INSERT INTO "TipoNormativa" ("id", "nombre", "activo", "fechaCreacion", "fechaActualizacion")
VALUES
  (gen_random_uuid(), 'ESTATUTO Y ORGANIGRAMA',  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NORMATIVA INSTITUCIONAL',  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CONVENIOS',                true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'REQUISITOS DE ADMISIÓN',   true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BECAS',                    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NORMATIVAS DE CARRERA',    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO UPDATE
  SET "activo"             = true,
      "fechaActualizacion" = CURRENT_TIMESTAMP;
