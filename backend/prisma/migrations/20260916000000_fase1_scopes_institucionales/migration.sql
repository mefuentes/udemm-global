-- FASE 1: Scopes institucionales
-- Crea las tablas UsuarioCarrera y UsuarioFacultad que delimitan el alcance
-- territorial/académico de DIRECTOR_CARRERA y DECANO respectivamente.
--
-- SCOPE != PERMISO. Estas tablas delimitan el universo de Carreras/Facultades
-- accesibles para cada rol, pero no conceden permisos de operación por sí solas.
-- El RBAC del controlador siempre valida el permiso específico de la operación.
--
-- Usuarios DIRECTOR_CARRERA y DECANO existentes quedan sin asociación (sin scope
-- restringido de gestión) hasta que se configure manualmente su Carrera/Facultad.

CREATE TABLE "UsuarioCarrera" (
  "id"                 TEXT NOT NULL,
  "usuarioId"          TEXT NOT NULL,
  "carreraId"          TEXT NOT NULL,
  "fechaCreacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsuarioCarrera_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsuarioFacultad" (
  "id"                 TEXT NOT NULL,
  "usuarioId"          TEXT NOT NULL,
  "facultadId"         TEXT NOT NULL,
  "fechaCreacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsuarioFacultad_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UsuarioCarrera"
  ADD CONSTRAINT "UsuarioCarrera_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UsuarioCarrera"
  ADD CONSTRAINT "UsuarioCarrera_carreraId_fkey"
  FOREIGN KEY ("carreraId") REFERENCES "Carrera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UsuarioFacultad"
  ADD CONSTRAINT "UsuarioFacultad_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UsuarioFacultad"
  ADD CONSTRAINT "UsuarioFacultad_facultadId_fkey"
  FOREIGN KEY ("facultadId") REFERENCES "Facultad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UsuarioCarrera_usuarioId_carreraId_key"
  ON "UsuarioCarrera"("usuarioId", "carreraId");

CREATE UNIQUE INDEX "UsuarioFacultad_usuarioId_facultadId_key"
  ON "UsuarioFacultad"("usuarioId", "facultadId");
