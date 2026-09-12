-- Renombra el valor de modalidadDictado MIXTA → HÍBRIDA en todas las asignaturas existentes.
-- El campo es TEXT libre (no enum), por lo que solo se requiere un UPDATE.
UPDATE "Materia" SET "modalidadDictado" = 'HÍBRIDA' WHERE "modalidadDictado" = 'MIXTA';
