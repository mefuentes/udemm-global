-- Migracion: renombrar codigo de bloque de conocimiento CX -> CTC
--
-- El bloque "Ciencias y Tecnologias Complementarias" usaba el codigo "CX" en registros
-- existentes. A partir de esta migracion el codigo canonico es "CTC", alineado con el FSD.
-- La capa de normalizacion de MOD-AUT continua aceptando "CX" como entrada valida
-- (backward compatibility), pero los nuevos registros se almacenan como "CTC".
--
-- Sin restricciones FK sobre el campo bloqueConocimiento (String? libre en Materia).
-- Operacion: UPDATE idempotente (no falla si ya fue aplicada).

UPDATE "Materia"
SET "bloqueConocimiento" = 'CTC'
WHERE "bloqueConocimiento" = 'CX';
