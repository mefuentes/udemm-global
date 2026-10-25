-- ============================================================
-- MOD-AUT Fase 2B.18-D2 — Modelo CargoDocente
-- Implementa: R-04 (Cargo sin actividad curricular)
-- Cambios: nuevo modelo CargoDocente, campo cargoDocenteId en
--          VinculacionCatedra, campo relevamientoCargosCompleto
--          en Docente.
-- ESTADO: PREPARADA — NO EJECUTAR sin autorización expresa.
-- Sin DROP TABLE, DROP COLUMN ni UPDATE masivo.
-- Compatible con PostgreSQL. Segura para datos existentes.
-- Revisada contra schema.prisma (prisma validate: OK).
-- ============================================================

-- ── 1. Tabla CargoDocente ────────────────────────────────────────────────────
-- Representa una designación institucional concreta de un docente UDEMM.
-- La vigencia se deriva de las fechas: vigente = (fechaFin IS NULL OR fechaFin > $fechaCalculo).
-- No tiene DEFAULT vigente redundante (FSD §3.3).
-- Campos legacy de Docente (cargoDeclarado, fechaInicioCargo, fechaFinCargo) permanecen
-- intactos — esta tabla convive con ellos durante la transición.

CREATE TABLE IF NOT EXISTS "CargoDocente" (
  "id"                 TEXT         NOT NULL,
  "docenteId"          TEXT         NOT NULL,
  "cargoId"            TEXT         NOT NULL,
  "designacion"        TEXT,
  "fechaInicio"        TIMESTAMP(3) NOT NULL,
  "fechaFin"           TIMESTAMP(3),
  "verificado"         BOOLEAN      NOT NULL DEFAULT false,
  "fuente"             TEXT         NOT NULL DEFAULT 'SECRETARIA',
  "observaciones"      TEXT,
  "creadoPorId"        TEXT,
  "fechaCreacion"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CargoDocente_pkey" PRIMARY KEY ("id"),

  -- FK 1: Docente debe existir. RESTRICT impide eliminar un Docente con cargos registrados.
  -- (En la práctica el sistema usa baja lógica: Docente.activo = false, nunca DELETE físico.)
  CONSTRAINT "CargoDocente_docenteId_fkey"
    FOREIGN KEY ("docenteId")
    REFERENCES "Docente"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  -- FK 2: Cargo catálogo debe existir y no puede eliminarse si hay designaciones activas.
  CONSTRAINT "CargoDocente_cargoId_fkey"
    FOREIGN KEY ("cargoId")
    REFERENCES "Cargo"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  -- FK 3: El operador que registró el cargo. Nullable: SetNull preserva el registro
  --        si el usuario es eliminado en el futuro.
  CONSTRAINT "CargoDocente_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId")
    REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,

  -- INVARIANTE 1: La fecha de fin, si existe, debe ser estrictamente posterior a la de inicio.
  -- No expresable en Prisma — enforced aquí.
  CONSTRAINT "CargoDocente_fecha_fin_posterior_ck"
    CHECK ("fechaFin" IS NULL OR "fechaFin" > "fechaInicio")
);

-- ── 1a. Índices de CargoDocente ──────────────────────────────────────────────

-- Índice primario de consulta: todos los cargos de un docente
CREATE INDEX IF NOT EXISTS "CargoDocente_docenteId_idx"
  ON "CargoDocente" ("docenteId");

-- Índice de vigencia: cargos vigentes de un docente (docenteId + fechaFin)
-- La query de R-04 filtra por: docenteId AND (fechaFin IS NULL OR fechaFin > $hoy)
CREATE INDEX IF NOT EXISTS "CargoDocente_docenteId_fechaFin_idx"
  ON "CargoDocente" ("docenteId", "fechaFin");

-- ── 1b. Trigger: actualización automática de fechaActualizacion ──────────────
-- Prisma gestiona @updatedAt en el ORM. Este trigger es una salvaguarda para
-- actualizaciones directas fuera del ORM (scripts de administración, etc.).

CREATE OR REPLACE FUNCTION fn_update_cargo_docente_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."fechaActualizacion" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cargo_docente_updated_at ON "CargoDocente";
CREATE TRIGGER trg_cargo_docente_updated_at
  BEFORE UPDATE ON "CargoDocente"
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_cargo_docente_timestamp();

-- ── 2. Campo cargoDocenteId en VinculacionCatedra ───────────────────────────
-- Nullable: los registros históricos no tienen cargo institucional asociado.
-- Nuevas vinculaciones deben especificar cargoDocenteId (aplicado en servicio, no aquí).
-- onDelete: SET NULL → si el CargoDocente es eliminado, la vinculación se conserva sin asociación.

ALTER TABLE "VinculacionCatedra"
  ADD COLUMN IF NOT EXISTS "cargoDocenteId" TEXT;

-- FK opcional: si cargoDocenteId no es null, debe referenciar un CargoDocente válido.
-- SET NULL garantiza que la vinculación sobrevive si el cargo es eliminado.
-- DROP + ADD para idempotencia (PostgreSQL no soporta ADD CONSTRAINT IF NOT EXISTS).
ALTER TABLE "VinculacionCatedra"
  DROP CONSTRAINT IF EXISTS "VinculacionCatedra_cargoDocenteId_fkey";
ALTER TABLE "VinculacionCatedra"
  ADD CONSTRAINT "VinculacionCatedra_cargoDocenteId_fkey"
    FOREIGN KEY ("cargoDocenteId")
    REFERENCES "CargoDocente"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice de consulta: asociaciones activas por cargo institucional
CREATE INDEX IF NOT EXISTS "VinculacionCatedra_cargoDocenteId_idx"
  ON "VinculacionCatedra" ("cargoDocenteId");

-- ── 2a. Trigger de integridad referencial cruzada (INVARIANTE 2) ─────────────
-- INVARIANTE 2: cuando VinculacionCatedra.cargoDocenteId no es null,
--   el CargoDocente al que apunta debe pertenecer al mismo docente.
--   Es decir: CargoDocente.docenteId = VinculacionCatedra.docenteId.
-- No expresable como CHECK (requiere subconsulta) ni como FK simple (FK ya existe sobre id).
-- Se implementa como trigger BEFORE INSERT OR UPDATE.

CREATE OR REPLACE FUNCTION fn_check_cargo_docente_docente()
RETURNS TRIGGER AS $$
DECLARE
  v_cargo_docente_id TEXT := NEW."cargoDocenteId";
  v_docente_id       TEXT := NEW."docenteId";
  v_cargo_owner      TEXT;
BEGIN
  IF v_cargo_docente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "docenteId" INTO v_cargo_owner
    FROM "CargoDocente"
   WHERE "id" = v_cargo_docente_id;

  IF v_cargo_owner IS NULL THEN
    RAISE EXCEPTION
      'CargoDocente % no existe', v_cargo_docente_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_cargo_owner <> v_docente_id THEN
    RAISE EXCEPTION
      'Integridad referencial: CargoDocente (docenteId=%) no pertenece al docente de la vinculacion (docenteId=%)',
      v_cargo_owner, v_docente_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vinculacion_cargo_docente_owner ON "VinculacionCatedra";
CREATE TRIGGER trg_vinculacion_cargo_docente_owner
  BEFORE INSERT OR UPDATE OF "cargoDocenteId", "docenteId"
  ON "VinculacionCatedra"
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_cargo_docente_docente();

-- ── 2b. Trigger: inmutabilidad de CargoDocente.docenteId (INVARIANTE 2 — lado cargo) ─
-- Si CargoDocente.docenteId pudiera modificarse post-creación, todas las VinculacionCatedra
-- asociadas quedarían en violación del INVARIANTE 2 sin que trg_vinculacion_cargo_docente_owner
-- lo detecte (ese trigger corre en el lado VinculacionCatedra, no en CargoDocente).
-- Solución: prohibir cualquier actualización de docenteId en CargoDocente.
-- Para cambiar la titularidad de una designación, se debe crear un nuevo CargoDocente.

CREATE OR REPLACE FUNCTION fn_prevent_cargo_docente_docente_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."docenteId" <> OLD."docenteId" THEN
    RAISE EXCEPTION
      'No se puede modificar docenteId de CargoDocente (id=%). Registre un nuevo cargo.',
      OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cargo_docente_immutable_docente_id ON "CargoDocente";
CREATE TRIGGER trg_cargo_docente_immutable_docente_id
  BEFORE UPDATE OF "docenteId"
  ON "CargoDocente"
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_cargo_docente_docente_id_change();

-- ── 3. Campo relevamientoCargosCompleto en Docente ───────────────────────────
-- Distingue (C) docente no relevado aún de (D) docente confirmado sin cargos (K-D4).
-- false (default): el relevamiento de CargoDocente no se completó todavía.
-- true: secretaría confirmó que los registros en CargoDocente son exhaustivos.
-- Los docentes existentes arrancan en false: no se asume ningún relevamiento previo.

ALTER TABLE "Docente"
  ADD COLUMN IF NOT EXISTS "relevamientoCargosCompleto" BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Verificación de integridad post-aplicación (ejecutar como consulta) ───
-- Ejecutar DESPUÉS de aplicar la migración para confirmar ausencia de violaciones:
--
--   SELECT COUNT(*) FROM "VinculacionCatedra" WHERE "cargoDocenteId" IS NOT NULL;
--   -- Esperado: 0 (ningún registro histórico tiene asociación)
--
--   SELECT COUNT(*) FROM "CargoDocente";
--   -- Esperado: 0 (la tabla nace vacía; los cargos se cargan manualmente luego)
--
--   SELECT COUNT(*) FROM "Docente" WHERE "relevamientoCargosCompleto" = true;
--   -- Esperado: 0 (todos arrancan en false)
