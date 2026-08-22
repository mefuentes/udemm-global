-- CreateTable
CREATE TABLE "AuditLogNormativa" (
    "id"              TEXT NOT NULL,
    "fecha"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId"       TEXT,
    "usuarioNombre"   TEXT,
    "accion"          TEXT NOT NULL,
    "normativaId"     TEXT,
    "normativaTitulo" TEXT,
    "normativaNumero" TEXT,
    "normativaAnio"   INTEGER,
    "detalle"         JSONB,
    "ipOrigen"        TEXT,

    CONSTRAINT "AuditLogNormativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLogNormativa_fecha_idx"       ON "AuditLogNormativa"("fecha");
CREATE INDEX "AuditLogNormativa_usuarioId_idx"   ON "AuditLogNormativa"("usuarioId");
CREATE INDEX "AuditLogNormativa_accion_idx"      ON "AuditLogNormativa"("accion");
CREATE INDEX "AuditLogNormativa_normativaId_idx" ON "AuditLogNormativa"("normativaId");
