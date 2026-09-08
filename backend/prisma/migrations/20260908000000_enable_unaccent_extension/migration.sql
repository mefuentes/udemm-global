-- Habilitar la extensión unaccent de PostgreSQL para búsquedas sin distinción de acentos.
-- Esta extensión es parte del paquete contrib de PostgreSQL y está disponible en
-- instalaciones estándar (incluyendo Render PostgreSQL y Neon).
-- CREATE EXTENSION IF NOT EXISTS es idempotente: no falla si ya estaba habilitada.
CREATE EXTENSION IF NOT EXISTS "unaccent";
