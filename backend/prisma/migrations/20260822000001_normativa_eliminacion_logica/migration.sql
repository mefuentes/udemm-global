-- FASE 7.9: campos de auditoría para baja lógica de normativas
ALTER TABLE "Normativa" ADD COLUMN "fechaEliminacion"       TIMESTAMP(3);
ALTER TABLE "Normativa" ADD COLUMN "eliminadoPorUsuarioId"  TEXT;
ALTER TABLE "Normativa" ADD COLUMN "motivoEliminacion"      TEXT;
