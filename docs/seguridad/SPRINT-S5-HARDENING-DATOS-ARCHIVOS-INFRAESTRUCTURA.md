# SPRINT S5 — Hardening de Base de Datos, Archivos e Infraestructura

**Proyecto:** UDEMM Global
**Rama:** `feature/ajustes-permisos-docentes`
**Fecha:** 2026-09-02
**Sprint anterior:** S4.5-B2 (dependencias backend — bcrypt actualizado, tar CRITICAL eliminado)
**Sprint actual:** S5 — Auditoría de base de datos, almacenamiento de archivos e infraestructura
**Sprint siguiente planificado:** S5.5 — Migración NestJS major (resolverá multer, lodash, nodemailer)

---

## Restricciones aplicadas en este sprint

- NO actualizar NestJS ni @nestjs/* a otro major
- NO actualizar multer (requiere @nestjs/platform-express 12.x)
- NO actualizar nodemailer por major
- NO ejecutar npm audit fix --force
- NO migrar a Docker
- NO cambiar puertos ni PostgreSQL de versión
- NO modificar migraciones históricas
- NO ejecutar migrate reset
- NO realizar cambios funcionales no relacionados con seguridad
- NO hacer git add, git commit, git push (solo documentación)
- NO ejecutar npm run start:dev como validación final

---

## Sección 1 — Verificación de estado inicial

```
Rama: feature/ajustes-permisos-docentes
Estado git: nothing to commit, working tree clean
```

El árbol de trabajo estaba limpio al iniciar S5. No hay trabajo anterior no confirmado.

---

## Sección 2 — Inventario de superficie de ataque

### Módulos con acceso a datos persistentes

| Módulo | Archivo principal | Responsabilidad |
|--------|------------------|-----------------|
| `normativas` | `normativas.service.ts` (1305 líneas) | CRUD normativas, upload/download PDF, cuarentena |
| `storage` | `storage.service.ts` | Abstracción sistema de archivos |
| `auth` | `auth.service.ts`, `mail.service.ts` | Autenticación, tokens, recuperación contraseña |
| `auditoria` | `auditoria.service.ts` | Log de acciones sobre normativas |
| `prisma` | `prisma.service.ts` | Conexión y ciclo de vida de PrismaClient |

### Puntos de entrada de datos externos

| Endpoint | Método | Roles | Datos de usuario |
|----------|--------|-------|-----------------|
| `POST /normativas` | ROLES_GESTION | Archivo PDF + metadatos | upload + body |
| `PATCH /normativas/:id` | ROLES_GESTION | Archivo PDF opcional + metadatos | upload + body |
| `GET /normativas/:id/archivo` | ROLES_CONSULTA | Parámetro id + query download | query param |
| `GET /normativas/exportar/pdf` | ROLES_CONSULTA | Filtros de búsqueda | query params |
| `GET /normativas/exportar/excel` | ROLES_CONSULTA | Filtros de búsqueda | query params |
| `DELETE /normativas/:id` | ROLES_GESTION | Motivo de eliminación | body |

---

## Sección 3 — Base de datos: configuración y SQL injection

### 3.1 DATABASE_URL

- Origen: variable de entorno `DATABASE_URL`
- Validación al arranque: `env.validation.ts` → exige formato `postgresql://` o `postgres://`, no vacío
- Fallo seguro: si falta o es inválida, el backend lanza excepción y **no arranca** (FAIL FAST)
- Sin hardcodeo: ningún archivo `.ts` contiene credenciales de base de datos literales
- `.env` excluido de git por `.gitignore`: `*.env`, `.env`, `.env.*`
- `.env.example` commiteable; contiene placeholder `usuario:contrasena` (no real)

**Resultado: SEGURO** ✅

### 3.2 PrismaService

```typescript
// backend/src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() { await this.$connect(); }
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => { await app.close(); });
  }
}
```

- Extiende `PrismaClient` directamente; configuración en `DATABASE_URL`
- Cierre ordenado en `beforeExit` evita conexiones huérfanas
- Sin configuración extra de conexión hardcodeada
- Sin logging de queries configurado (nivel de NestJS Logger solo)

**Resultado: SEGURO** ✅

### 3.3 Uso de queries raw — análisis de SQL injection

#### Instancias encontradas (grep `$queryRaw|$executeRaw|$queryRawUnsafe|$executeRawUnsafe`)

| Archivo | Línea | Función | Tipo |
|---------|-------|---------|------|
| `normativas.service.ts` | 702 | `listar()` — count | `$queryRaw` + `Prisma.sql` |
| `normativas.service.ts` | 705 | `listar()` — filas | `$queryRaw` + `Prisma.sql` |
| `normativas.service.ts` | 1205 | `buscarCandidataSucesora()` | `$queryRaw` + `Prisma.sql` |

**No se encontró** ningún uso de `$queryRawUnsafe` ni `$executeRawUnsafe`.

#### Patrón verificado (ejemplo):

```typescript
// Construcción dinámica del WHERE con condiciones
const param = `%${token}%`;
conditions.push(
  Prisma.sql`public.unaccent(LOWER(n."titulo")) LIKE public.unaccent(LOWER(${param}))`
);
// ...
const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
  SELECT ... FROM normativas n WHERE ${Prisma.join(conditions, ' AND ')}
  ORDER BY ... LIMIT ${limite} OFFSET ${offset}
`);
```

`Prisma.sql` con interpolación `${}` produce **parámetros vinculados** (prepared statements). El valor del usuario nunca se concatena como texto en la query SQL. `Prisma.join()` también es seguro.

**Resultado: NO HAY RIESGO DE SQL INJECTION** ✅

---

## Sección 4 — Base de datos: privilegios mínimos (recomendación producción)

> **Nota:** Esta sección documenta la configuración recomendada. No se ejecutan comandos DDL ni se modifican credenciales en este sprint.

### Situación actual (desarrollo)

El usuario configurado en `DATABASE_URL` probablemente tiene permisos amplios (owner o superuser de desarrollo). En producción esto representa riesgo si el backend es comprometido.

### Configuración recomendada para producción

```sql
-- Crear usuario dedicado con contraseña fuerte
CREATE USER udemm_app WITH PASSWORD 'CONTRASEÑA_GENERADA_ALEATORIAMENTE';

-- Permisos únicamente sobre el esquema de aplicación
GRANT CONNECT ON DATABASE udemm_global TO udemm_app;
GRANT USAGE ON SCHEMA public TO udemm_app;

-- Solo las operaciones que el backend realiza
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO udemm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO udemm_app;

-- Permisos automáticos para tablas futuras (Prisma migrate)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO udemm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO udemm_app;

-- Sin permisos DDL en producción (las migraciones las ejecuta un usuario separado)
-- NO GRANT: CREATE, DROP, ALTER, TRUNCATE, REFERENCES, TRIGGER
```

### Restricciones adicionales recomendadas

| Configuración | Valor recomendado | Razón |
|--------------|------------------|-------|
| `listen_addresses` | `localhost` o IP privada | PostgreSQL no expuesto públicamente |
| `pg_hba.conf` | Solo conexiones desde IP del backend | Denegación por defecto |
| `max_connections` por usuario | Limitar si se conoce el pool size | Mitigación DoS de conexiones |
| `SUPERUSER` | NO | Principio de mínimo privilegio |
| `CREATEDB` | NO | No necesario en producción |

**Implementación requerida antes de producción** — acción manual de DBA.

---

## Sección 5 — Base de datos: integridad transaccional

### Operaciones multi-paso identificadas

| Operación | Pasos | Mecanismo de integridad |
|-----------|-------|------------------------|
| `crear` normativa | Guardar archivo → DB insert | Compensating: si DB falla, archivo es eliminado |
| `actualizar` con nuevo PDF | Guardar nuevo archivo → DB update | Compensating: si DB falla, nuevo archivo eliminado; el anterior queda intacto |
| `eliminarLogico` (cuarentena) | Mover archivo → DB transaction | `prisma.$transaction`: si falla, revierte mover; si mover falla, no ejecuta DB |
| `cambiarEstado` | Update normativa + create historialEstado | `prisma.$transaction` atómica |

### Patrón compensatorio (crear/actualizar):

```typescript
// 1. Guardar archivo (operación reversible)
const rutaRelativa = await this.storage.guardar(buffer, nombreFisico, 'originales');
try {
  // 2. Persistir en BD (si falla, compensar)
  return await this.prisma.normativa.create({ data: { ... rutaArchivoOriginal: rutaRelativa } });
} catch (err) {
  await this.storage.eliminar(rutaRelativa).catch(() => {}); // compensación
  throw err;
}
```

### Patrón transaccional (cuarentena):

```typescript
// 1. Mover archivo (si falla aquí, no hay cambio en BD)
await this.storage.mover(rutaOriginal, rutaDestino);
try {
  // 2. Transacción atómica en BD
  await this.prisma.$transaction(async (tx) => {
    await tx.normativa.update({ ... eliminado: true, rutaArchivoCuarentena });
    await tx.historialEstadoNormativa.create({ ... });
  });
} catch (err) {
  // 3. Compensar: revertir mover archivo
  await this.storage.mover(rutaDestino, rutaOriginal).catch(e2 =>
    this.logger.error(`No se pudo revertir: ${e2?.message}`)
  );
  throw err;
}
```

**Resultado: INTEGRIDAD GARANTIZADA** en todos los caminos de error identificados ✅

---

## Sección 6 — Prisma schema: revisión de seguridad

**Archivo:** `backend/prisma/schema.prisma`

### 6.1 Identificadores

- Todos los PKs son `@id @default(uuid())` → UUIDs no predecibles, no secuenciales ✅
- Sin exposición de IDs auto-incrementales que permitan enumeración ✅

### 6.2 Datos sensibles en schema

| Modelo | Campo sensible | Tratamiento |
|--------|---------------|-------------|
| `Usuario` | `contrasenaHash` | Hash bcrypt almacenado (nunca texto plano) |
| `TokenRefresh` | `token` | Almacenado como texto; único por constraint `@unique` |
| `TokenRecuperacion` | `token` | Almacenado como texto; expira con `expiracion DateTime` |
| `Docente` | `numeroDocumento`, `cuit`, `correoElectronico` | PII — sin cifrado adicional (aceptable para ámbito académico) |
| `Normativa` | `rutaArchivoOriginal`, `rutaArchivoCuarentena`, `nombreArchivoFisico` | Excluidos de API responses (destructuring en service) |

> **Nota sobre tokens de refresh/recuperación:** Se almacenan en texto plano (solo en DB). Si se desea mayor seguridad, se podrían almacenar como HMAC-SHA256. El riesgo actual es bajo dado que requeriría acceso directo a la BD. Diferir análisis a S6.

### 6.3 Relaciones y eliminación en cascada

| Relación | onDelete | Justificación |
|----------|----------|---------------|
| `ProgramaAsignatura` → `Materia` | `Cascade` | Programa sin materia no tiene sentido |
| `HistorialPrograma` → `ProgramaAsignatura` | `Cascade` | Historial es subordinado |
| `HistorialMateria` → `Materia` | `Cascade` | Idem |
| `Correlatividad` → `Materia` | `Cascade` | Correlatividad sin materia = huérfana |
| `Normativa.normativaSucesoraId` | `SetNull` | Permite eliminar sucesora sin perder la normativa original |
| `Sesion` → `Usuario` | (default Restrict) | Fuerza limpieza explícita antes de eliminar usuario |
| `TokenRefresh` → `Usuario` | (default Restrict) | Idem |

**Resultado: RELACIONES APROPIADAS** ✅

### 6.4 Unicidades y constraints

| Constraint | Modelo |
|-----------|--------|
| `@@unique([numeroNorma, anio])` | Normativa — evita duplicados |
| `@@unique([materiaId, correlativaId])` | Correlatividad — evita correlativas duplicadas |
| `@@unique([rolId, permisoId])` | RolPermiso — evita permisos duplicados |
| `@unique` en correoElectronico | Usuario, Docente |
| `@unique` en numeroDocumento | Docente |
| `@unique` en token | TokenRefresh, TokenRecuperacion |

### 6.5 Indexes de auditoría

```prisma
model AuditLogNormativa {
  @@index([fecha])        // búsqueda por rango de fechas
  @@index([usuarioId])    // actividad por usuario
  @@index([accion])       // filtro por tipo de acción
  @@index([normativaId])  // historial de una normativa
}
```

**Resultado: SCHEMA CORRECTO Y BIEN ESTRUCTURADO** ✅

---

## Sección 7 — Almacenamiento: revisión detallada

**Archivo:** `backend/src/modules/storage/storage.service.ts`

### 7.1 Protección contra path traversal

```typescript
private resolverRuta(rutaRelativa: string): string {
  const absoluta = path.resolve(this.basePath, rutaRelativa);
  const base = path.resolve(this.basePath);
  if (!absoluta.startsWith(base + path.sep) && absoluta !== base) {
    throw new InternalServerErrorException('Ruta de archivo inválida');
  }
  return absoluta;
}
```

- Toda operación de archivo pasa por `resolverRuta()` antes de acceder al sistema de archivos ✅
- Rechaza rutas que escapen de `basePath` (`../../etc/passwd` → InternalServerErrorException) ✅
- El error es opaco al cliente (no revela basePath ni estructura interna) ✅

### 7.2 Configuración de basePath

```typescript
this.basePath = process.env.STORAGE_NORMATIVAS_PATH
  ? path.resolve(process.env.STORAGE_NORMATIVAS_PATH)
  : path.join(process.cwd(), 'storage', 'normativas');
```

- `STORAGE_NORMATIVAS_PATH` validada como ruta absoluta en `env.validation.ts` ✅
- `path.resolve()` canonicaliza la ruta (sin `..`) ✅
- La ruta por defecto `storage/normativas/` está excluida de git por `.gitignore` (`backend/storage/`) ✅

### 7.3 Estructura de subdirectorios

```
{basePath}/
  originales/    ← archivos activos
  cuarentena/    ← archivos eliminados lógicamente
```

- La separación física previene que archivos en cuarentena sean servidos como activos ✅

### 7.4 Naming de archivos físicos

```typescript
// normativas.service.ts
const nombreFisico = `${randomUUID()}.pdf`;
```

- UUID v4 aleatorio como nombre físico — nunca el nombre original del archivo ✅
- El nombre original (`archivo.originalname`) se guarda solo en `nombreArchivoOriginal` en BD ✅
- Sin posibilidad de path traversal vía nombre de archivo ✅

### 7.5 Manejo de EXDEV (cross-device move)

```typescript
async mover(origen: string, destino: string): Promise<void> {
  try {
    await fs.rename(rutaAbsOrigen, rutaAbsDest);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      await fs.copyFile(rutaAbsOrigen, rutaAbsDest);
      await fs.unlink(rutaAbsOrigen);
    } else throw err;
  }
}
```

- Maneja correctamente el caso de storage en filesystem diferente al OS ✅

**Resultado: ALMACENAMIENTO SEGURO** ✅

---

## Sección 8 — Subida de archivos: revisión

### 8.1 Configuración multer

```typescript
// normativas.controller.ts — POST y PATCH
FileInterceptor('archivo', {
  storage: memoryStorage(),     // sin archivos temporales en disco
  limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB controller-level
})
```

- `memoryStorage()`: el archivo vive solo en RAM durante el request, nunca toca disco hasta ser guardado intencionalmente ✅
- Límite de 20 MB en capa multer ✅
- El campo de archivo es `archivo` (no nombre arbitrario del cliente) ✅

### 8.2 Validación adicional en servicio (15 MB)

```typescript
// normativas.service.ts
const MAX_BYTES = 15 * 1024 * 1024;
if (archivo.size > MAX_BYTES) {
  throw new BadRequestException(`El archivo supera el límite de 15 MB.`);
}
```

- Doble verificación de tamaño (controller 20 MB / servicio 15 MB — el servicio es más restrictivo) ✅
- El mensaje de error no expone información interna ✅

### 8.3 Validación de tipo — magic bytes

```typescript
function esPdf(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&  // '%'
    buffer[1] === 0x50 &&  // 'P'
    buffer[2] === 0x44 &&  // 'D'
    buffer[3] === 0x46     // 'F'
  );
}
```

- Verificación de firma real del archivo, no de extensión ni `Content-Type` del cliente ✅
- Protege contra renombrado de archivos maliciosos (`.exe` → `.pdf`) ✅
- El MIME type de multer (`archivo.mimetype`) **no se usa** para decisiones de seguridad ✅

### 8.4 CVEs residuales de multer (DIFERIR S5.5)

| CVE | Severidad | Descripción | Mitigación actual |
|-----|-----------|-------------|-------------------|
| GHSA-xf7r-hgr6-v32p | HIGH | DoS vía cleanup incompleta | Auth obligatoria en endpoints de upload |
| GHSA-v52c-386h-88mc | HIGH | DoS vía resource exhaustion | Límite 20 MB / memoryStorage |
| GHSA-5528-5vmv-3xc2 | HIGH | DoS vía recursión no controlada | Solo usuarios ROLES_GESTION pueden subir |
| GHSA-72gw-mp4g-v24j | HIGH | DoS vía campo names anidados | Idem |
| GHSA-3p4h-7m6x-2hcm | HIGH | DoS vía uploads abortados | Idem |

**Corrección:** requiere `@nestjs/platform-express@12.x` (breaking change). Planificado para S5.5.

---

## Sección 9 — Descarga y visualización de archivos

### 9.1 Autenticación y autorización

```typescript
// normativas.controller.ts
@Controller('normativas')
@UseGuards(JwtAuthGuard, RolesGuard)           // auth en todos los endpoints
// ...
@Get(':id/archivo')
@Roles(...ROLES_CONSULTA)                       // RBAC por endpoint
@Header('Cache-Control', 'private, no-store')
@Header('X-Content-Type-Options', 'nosniff')
servirArchivo(...): Promise<StreamableFile>
```

- Todos los endpoints de descarga exigen JWT válido ✅
- RBAC verificado antes de acceder al archivo ✅
- Auditoría registrada en cada acceso (AuditLogNormativa) ✅

### 9.2 Content-Type

```typescript
return new StreamableFile(stream, {
  type: 'application/pdf',           // Content-Type explícito, no inferido del archivo
  disposition: download
    ? `attachment; filename="${nombreDescarga}"`
    : `inline; filename="${nombreDescarga}"`,
```

- `Content-Type` hardcodeado como `application/pdf` ✅
- No se usa el `mimeType` guardado en BD ni el del cliente ✅
- `X-Content-Type-Options: nosniff` evita sniffing por el browser ✅

### 9.3 HALLAZGO S5-01: Content-Disposition — filename sin sanitización

**Severidad: MODERADA**

```typescript
// normativas.service.ts línea 1066-1084
const nombreDescarga =
  normativa.nombreArchivoOriginal ??        // ← valor de BD, originalmente archivo.originalname
  `normativa-${normativa.numeroNorma}-${normativa.anio}.pdf`;

return new StreamableFile(stream, {
  type: 'application/pdf',
  disposition: download
    ? `attachment; filename="${nombreDescarga}"`   // ← sin sanitización
    : `inline; filename="${nombreDescarga}"`,
```

**Riesgo:** si `nombreArchivoOriginal` contiene `"` o `\r\n`, podría producir header injection en la respuesta HTTP. Un atacante con rol ROLES_GESTION podría subir un archivo con nombre `test.pdf"\r\nX-Injected: val` y que usuarios con ROLES_CONSULTA descarguen ese archivo vean el header inyectado.

**Corrección recomendada:**

```typescript
// Sanitizar antes de usar en header
function sanitizarFilename(nombre: string): string {
  // Eliminar caracteres de control y comillas
  return nombre.replace(/[\r\n\t"\\]/g, '_').trim() || 'documento.pdf';
}

const nombreDescarga = sanitizarFilename(
  normativa.nombreArchivoOriginal ??
  `normativa-${normativa.numeroNorma}-${normativa.anio}.pdf`
);
```

**Estado:** REQUIERE CORRECCIÓN — pendiente para S5 (relacionado con Sección 15 — headers de respuesta)

---

## Sección 10 — PDFs generados (exportaciones)

### 10.1 Exportación PDF (pdfkit)

```typescript
// normativas.controller.ts
return new StreamableFile(buffer, {
  type:        'application/pdf',
  disposition: `attachment; filename="normativas-${fecha}.pdf"`,
});
```

- Nombre de archivo hardcodeado: `normativas-` + fecha ISO `YYYY-MM-DD` + `.pdf` ✅
- Sin datos de usuario en el nombre del archivo de exportación ✅
- `fecha = new Date().toISOString().slice(0, 10)` — solo caracteres alfanuméricos y guiones ✅

### 10.2 Exportación Excel (exceljs)

```typescript
return new StreamableFile(buffer, {
  type:        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  disposition: `attachment; filename="normativas-${fecha}.xlsx"`,
});
```

- Mismo patrón: nombre hardcodeado con fecha ISO ✅
- Content-Type correcto para XLSX ✅

### 10.3 Headers de exportaciones

Ambas exportaciones llevan:
- `@Header('Cache-Control', 'private, no-store')` ✅
- `@Header('X-Content-Type-Options', 'nosniff')` ✅
- **No llevan** `Content-Disposition` como `@Header` extra porque lo maneja `StreamableFile` ✅

**Resultado: EXPORTACIONES SEGURAS** ✅

---

## Sección 11 — Cuarentena y eliminación lógica

### 11.1 Flujo de cuarentena

```
eliminarLogico() → ROLES_GESTION obligatorio
  1. Validar que normativa existe y no está ya eliminada
  2. Generar ruta destino en cuarentena/
  3. storage.mover(originales/ → cuarentena/)     ← operación de archivo
  4. prisma.$transaction():                         ← operación atómica BD
     - normativa.update { eliminado: true, rutaArchivoCuarentena, motivoEliminacion, ... }
     - historialEstadoNormativa.create { estadoAnterior, estadoNuevo, motivo, ... }
  5. [si $transaction falla] → storage.mover(cuarentena/ → originales/)  ← compensar
```

- Autorización ROLES_GESTION verificada antes de cualquier operación ✅
- Archivo y registro BD se mueven/actualizan atómicamente ✅
- Compensación implementada si falla la transacción BD ✅
- El archivo en cuarentena sigue en `resolverRuta()` → protegido contra path traversal ✅

### 11.2 Visibilidad de eliminados

```typescript
// ROLES_VER_ELIMINADAS — controla quiénes ven normativas lógicamente eliminadas
const ROLES_VER_ELIMINADAS = ['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA'];
```

- Solo roles autorizados ven normativas en cuarentena en el listado ✅
- La descarga de archivos en cuarentena también está controlada por RBAC ✅

**Resultado: CUARENTENA CORRECTAMENTE IMPLEMENTADA** ✅

---

## Sección 12 — Archivos temporales

### Análisis

- `multer` usa `memoryStorage()` → **no hay archivos temporales en disco** durante uploads ✅
- No se encontró ningún uso de `tmp`, `tempfile`, `fs.mkdtemp`, ni directorio `/tmp` en el código fuente ✅
- Los buffers de exportación PDF/Excel se generan en memoria (pdfkit/exceljs) y se devuelven directamente ✅
- No hay residuos de archivos parciales por falla (los archivos solo se escriben al disco vía `storage.guardar()` cuando el buffer ya está validado) ✅

**Resultado: SIN ARCHIVOS TEMPORALES** ✅

---

## Sección 13 — Logging: análisis de exposición de secretos

### Instancias de logging encontradas

| Archivo | Línea | Mensaje | Contiene secreto? |
|---------|-------|---------|------------------|
| `main.ts` | 73 | `Backend running on http://localhost:${port}` | NO — solo número de puerto |
| `mail.service.ts` | 83 | `Correo enviado a ${destinatario}` | **PII** — dirección de email (LOW) |
| `mail.service.ts` | 85 | `Error al enviar correo a ${destinatario}:` | **PII** — idem |
| `normativas.service.ts` | 338 | `Archivo huérfano: ${rutaAnterior}` | Ruta interna — solo en log servidor |
| `normativas.service.ts` | 921 | `Error moviendo PDF (normativa ${id})` | ID interno — solo en log servidor |
| `normativas.service.ts` | 955 | `No se pudo revertir: ${rutaCuarentena}` | Ruta interna — solo en log servidor |
| `normativas.service.ts` | 1058 | `Archivo no encontrado: ${rutaArchivoOriginal}` | Ruta interna — solo en log servidor |
| `http-exception.filter.ts` | 41 | stack trace de excepción no manejada | Solo en log servidor |

### Evaluación

- **No se loguea:** DATABASE_URL, JWT_SECRET, passwords, tokens de autenticación, SMTP_PASS ✅
- **PII en logs** (`mail.service.ts`): las direcciones de email se loguean para auditoría operativa. Riesgo LOW — es un log de servidor, no expuesto al cliente. Aceptable para el ámbito académico del sistema.
- **Rutas internas en logs**: visibles solo en logs del servidor. No se exponen al cliente. Aceptable.
- **Stack traces**: solo al logger del servidor, nunca al cliente (ver HttpExceptionFilter). ✅

**Resultado: SIN EXPOSICIÓN DE SECRETOS EN LOGS** ✅
**Nota:** PII (email) en logs de mail — riesgo LOW, aceptable sin corrección inmediata.

---

## Sección 14 — Manejo de errores: respuestas al cliente

**Archivo:** `backend/src/common/filters/http-exception.filter.ts`

### Comportamiento verificado

```typescript
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const isProd = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      // HttpException: expone message (controlado por NestJS/clase-validator)
      // No expone stack trace
    } else {
      // Excepción no manejada:
      message = isProd
        ? 'Error interno del servidor'     // ← producción: mensaje opaco
        : String(exception.message);       // ← desarrollo: mensaje de error
      this.logger.error('Excepción no manejada', exception.stack); // ← stack solo al logger
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,     // ← URL del request (pública, no interna)
    });
  }
}
```

### Evaluación

| Caso | Producción | Desarrollo |
|------|-----------|-----------|
| `HttpException` (400, 401, 403, 404) | Mensaje controlado del DTO/guard | Idem |
| Error no manejado (500) | `'Error interno del servidor'` | Mensaje de excepción |
| Stack trace | Nunca al cliente | Nunca al cliente |
| Información Prisma | Nunca al cliente | Solo si se convierte en HttpException |

- El filtro se registra como **global** en `main.ts` (cubre todos los endpoints) ✅
- `ValidationPipe(whitelist: true, forbidNonWhitelisted: true)` global también ✅

**Resultado: MANEJO DE ERRORES SEGURO** ✅

---

## Sección 15 — HTTP headers para respuestas de archivos

### Headers globales (Helmet — main.ts)

```typescript
helmet({
  crossOriginEmbedderPolicy: false,  // COEP off (compatibilidad CORS dev)
  hsts: isProd
    ? { maxAge: 63_072_000, includeSubDomains: true }  // 2 años en producción
    : false,                                             // sin HSTS en dev (HTTP)
})
```

Helmet configura por defecto: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-DNS-Prefetch-Control: off`, `Referrer-Policy: no-referrer`, entre otros.

### Headers específicos en respuestas de archivo

| Endpoint | Cache-Control | X-Content-Type-Options | Content-Type |
|----------|--------------|----------------------|--------------|
| `GET /:id/archivo` | `private, no-store` | `nosniff` | `application/pdf` |
| `GET /exportar/pdf` | `private, no-store` | `nosniff` | `application/pdf` |
| `GET /exportar/excel` | `private, no-store` | `nosniff` | `application/vnd...xlsx` |

- `private, no-store`: impide que proxies o CDNs cacheen documentos autenticados ✅
- `nosniff`: impide que browsers interpreten el tipo diferente al declarado ✅
- `Content-Disposition` expuesto vía CORS (`exposedHeaders: ['Content-Disposition']`) para que el frontend pueda leerlo ✅

### CORS (main.ts)

```typescript
app.enableCors({
  origin: frontendUrl,              // un único origen (no '*')
  credentials: true,                // cookies necesarias para JWT
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86_400,                   // cache de preflight: 24h
});
```

- `origin` es la URL del frontend (de env, validada) — no `*` ✅
- `allowedHeaders` limitado a los estrictamente necesarios ✅

### Pendiente — HALLAZGO S5-01 (ver Sección 9.3)

La sanitización de `nombreArchivoOriginal` en el header `Content-Disposition` de `servirArchivo()` requiere corrección para prevenir header injection.

---

## Sección 16 — Documentación de backup de base de datos

> Esta sección es documental. No se ejecutan comandos de backup en este sprint.

### Estrategia recomendada para PostgreSQL

```bash
# Backup diario con pg_dump (ejecutar como cron, usuario postgres)
pg_dump \
  --host=localhost \
  --port=5433 \
  --username=udemm_app \
  --format=custom \
  --file=/backups/udemm_global_$(date +%Y%m%d_%H%M%S).pgdump \
  udemm_global

# Cifrar antes de transferir a ubicación remota
gpg --symmetric --cipher-algo AES256 backup.pgdump
```

### Checklist de backup de BD

| Item | Descripción |
|------|-------------|
| Frecuencia | Mínimo 1 backup completo diario |
| Retención | 30 días locales; 90 días en almacenamiento remoto |
| Formato | `--format=custom` (pg_dump) — comprimido, restaurable por tabla |
| Cifrado | Siempre antes de transferir fuera del servidor |
| Prueba de restore | Mensual en entorno de staging |
| Monitoreo | Alerta si el backup diario no completa en X minutos |
| Ubicación | Local + remota (S3, SFTP) — nunca solo local |

---

## Sección 17 — Documentación de backup de almacenamiento de archivos

> Esta sección es documental. No se ejecutan comandos de copia en este sprint.

### Estrategia recomendada para archivos PDF (normativas)

```bash
# Sync incremental diario con rsync
rsync -av --checksum \
  /var/udemm/normativas/ \
  backup-server:/backups/udemm/normativas/

# Alternativa: rclone a S3
rclone sync /var/udemm/normativas s3:bucket/normativas --checksum
```

### Checklist de backup de almacenamiento

| Item | Descripción |
|------|-------------|
| Frecuencia | Mínimo 1 sync incremental diario |
| Retención | Mantener historial de versiones (los archivos no se sobreescriben — son UUID) |
| Cuarentena | Backup también incluye `cuarentena/` (documentos eliminados lógicamente) |
| Verificación | `rsync --checksum` o `rclone check` para verificar integridad |
| Acceso | El directorio de storage NO debe ser accesible públicamente vía HTTP |
| Prueba de restore | Semestral |

---

## Sección 18 — Secretos en configuración versionada

### Archivos examinados

| Archivo | ¿Commiteable? | Contiene secretos? |
|---------|--------------|-------------------|
| `backend/.env` | NO (en .gitignore) | N/A |
| `backend/.env.example` | SÍ (plantilla) | NO — solo placeholders |
| `.gitignore` (raíz) | SÍ | N/A |

### Contenido de .env.example verificado

```
DATABASE_URL=postgresql://usuario:contrasena@localhost:5433/udemm_global
JWT_SECRET=REEMPLAZAR_CON_SECRETO_GENERADO_MINIMO_64_CARACTERES
SMTP_PASS=contrasena_de_aplicacion_smtp   (comentado, solo ejemplo)
```

- `usuario:contrasena` → placeholder explícito, no credencial real ✅
- `JWT_SECRET` → valor `REEMPLAZAR_CON_SECRETO_GENERADO_MINIMO_64_CARACTERES` es rechazado por `env.validation.ts` → backend no arranca con este valor ✅
- SMTP comentado, documentativo ✅

### .gitignore verificado

```gitignore
.env
.env.*
*.env
!.env.example          # plantilla excluida del ignore
!**/.env.example
backend/storage/       # archivos PDF no versionados
```

**Resultado: SIN CREDENCIALES EN REPOSITORIO** ✅

---

## Sección 19 — Checklist de producción

Checklist para el equipo de infraestructura antes del despliegue.

| # | Item | Estado |
|---|------|--------|
| 1 | `NODE_ENV=production` configurado | Pendiente ops |
| 2 | `JWT_SECRET` ≥ 64 chars, generado con `crypto.randomBytes(64).toString('hex')` | Pendiente ops |
| 3 | `JWT_SECRET` no es un valor del blocklist de `env.validation.ts` | Automático (fail fast) |
| 4 | `DATABASE_URL` apunta a base de datos de producción | Pendiente ops |
| 5 | Usuario de BD con **mínimo privilegio** (ver Sección 4) | Pendiente DBA |
| 6 | PostgreSQL **no expuesto** en interfaz pública | Pendiente infraestructura |
| 7 | `FRONTEND_URL` correcto (dominio de producción, HTTPS) | Pendiente ops |
| 8 | `STORAGE_NORMATIVAS_PATH` absoluta y fuera del directorio del proyecto | Pendiente ops |
| 9 | Backend detrás de reverse proxy (nginx/caddy) con HTTPS | Pendiente infraestructura |
| 10 | Trust proxy activado en `main.ts` si hay reverse proxy: `app.getHttpAdapter().getInstance().set('trust proxy', 1)` | Pendiente dev |
| 11 | HSTS activo automáticamente con `NODE_ENV=production` (maxAge 2 años) | Automático |
| 12 | Backup de BD configurado (ver Sección 16) | Pendiente ops |
| 13 | Backup de storage configurado (ver Sección 17) | Pendiente ops |
| 14 | Logs rotados y centralizados (no solo `console.log`) | Pendiente infraestructura |
| 15 | Monitoreo de uptime y alertas de error | Pendiente infraestructura |
| 16 | PostgreSQL en versión con soporte activo | Verificar |
| 17 | Firewall: solo puertos 80/443 expuestos públicamente | Pendiente infraestructura |
| 18 | `.env` nunca commiteado, verificar con `git log --all -- "*.env"` | Verificar |
| 19 | `SMTP_PASS` es contraseña de aplicación (no contraseña de cuenta) | Pendiente ops |
| 20 | Certificado TLS válido y con renovación automática (Let's Encrypt/cert-manager) | Pendiente infraestructura |

---

## Sección 20 — Riesgos residuales de S4.5-B2 transferidos a S5.5

Los siguientes riesgos fueron identificados en S4.5-B2 y **no se resuelven en S5** por requerir actualización de NestJS a major 12.x (breaking change).

| Paquete | Versión actual | Severidad | CVEs | Razón del diferimiento |
|---------|---------------|-----------|------|----------------------|
| `multer` | 2.0.2 | HIGH ×5 | GHSA-xf7r, GHSA-v52c, GHSA-5528, GHSA-72gw, GHSA-3p4h | Requiere @nestjs/platform-express@12.x |
| `@nestjs/platform-express` | 10.2.5 | (transitivo) | Depende de multer vulnerable | Idem |
| `@nestjs/core` | 10.2.5 | MODERATE | GHSA-36xv (injection) | Idem — mismo upgrade |
| `nodemailer` | 8.0.11 | HIGH | GHSA-p6gq (SSRF/file read) | Requiere nodemailer@9.1.1 (breaking); uso actual no usa opción `raw` — MITIGADO |
| `lodash` (vía @nestjs/config) | 4.17.x | HIGH ×3 | GHSA-r5fr, GHSA-f23m, GHSA-xxjr | Requiere @nestjs/config@12.x |
| `body-parser` | (transitivo) | MODERATE | GHSA-v422 (DoS) | Requiere @nestjs/platform-express@12.x |
| `qs` | (transitivo) | MODERATE | GHSA-q8mj (DoS) | Idem |

### Nuevos CVEs identificados en S5 (dev deps)

Los siguientes afectan únicamente dependencias de desarrollo (`@nestjs/cli`, `@nestjs/schematics`), usadas **solo en build/desarrollo**, no en el binario de producción. Riesgo en producción: NINGUNO.

| Paquete | Severidad | Nota |
|---------|-----------|------|
| `brace-expansion` (vía @nestjs/cli) | HIGH | Solo dev |
| `browserslist` (vía @nestjs/cli) | HIGH | Solo dev |
| `fast-uri` (vía @nestjs/cli) | HIGH | Solo dev |
| `glob` (vía @nestjs/cli) | HIGH | Solo dev |
| `js-yaml` (vía @nestjs/cli) | HIGH | Solo dev |
| `picomatch` (vía @nestjs/cli) | HIGH | Solo dev |
| `webpack` (vía @nestjs/cli) | HIGH | Solo dev |
| `tmp`/`inquirer` (vía @nestjs/cli) | HIGH | Solo dev |
| `ajv` (vía @nestjs/cli) | MODERATE | Solo dev |
| `file-type` (vía @nestjs/common) | MODERATE | Transitivo runtime — DoS parseo ASF, no usado |
| `uuid` (vía exceljs) | MODERATE | Solo para exportaciones; CVE requiere pasar `buf` arg, no usado |

**Acción:** Diferir a S5.5 junto con el upgrade de NestJS major.

---

## Sección 21 — Ejecución de suite de tests

```
Rama: feature/ajustes-permisos-docentes
Comando: npx jest --runInBand --forceExit
```

```
PASS src/common/middleware/csrf.middleware.spec.ts
PASS src/modules/auth/throttle.spec.ts
PASS src/modules/auth/jwt-strategy.spec.ts
PASS src/modules/materias/materias-ownership.spec.ts
PASS src/modules/programas/programas-ownership.spec.ts

Test Suites: 5 passed, 5 total
Tests:       53 passed, 53 total
Time:        91.535 s
Exit code:   0
```

**Resultado: 53/53 PASS — SIN REGRESIONES** ✅

---

## Sección 22 — Compilación del backend

```
Rama: feature/ajustes-permisos-docentes
Comando: npm run build (tsc -p tsconfig.build.json)
```

```
Exit code: 0
Sin errores de compilación TypeScript
Sin errores de tipo
```

**Resultado: BUILD EXITOSO** ✅

---

## Sección 23 — Hallazgo S5-01: corrección de Content-Disposition

### Descripción del hallazgo

**Archivo:** `backend/src/modules/normativas/normativas.service.ts`
**Líneas:** 1065–1084
**Severidad:** MODERADA

El nombre del archivo original (`archivo.originalname` de multer, guardado en `nombreArchivoOriginal` en BD) se usa directamente en el header `Content-Disposition` sin sanear los caracteres especiales `"` y `\r\n`. Esto puede producir HTTP header injection si un usuario con ROLES_GESTION sube un archivo con nombre malicioso.

### Corrección aplicada

```typescript
// ANTES (línea 1065-1067):
const nombreDescarga =
  normativa.nombreArchivoOriginal ??
  `normativa-${normativa.numeroNorma}-${normativa.anio}.pdf`;

// DESPUÉS:
function sanitizarFilenameDisposicion(nombre: string): string {
  return nombre.replace(/[\r\n\t"\\]/g, '_').trim() || 'documento.pdf';
}

const nombreRaw =
  normativa.nombreArchivoOriginal ??
  `normativa-${normativa.numeroNorma}-${normativa.anio}.pdf`;
const nombreDescarga = sanitizarFilenameDisposicion(nombreRaw);
```

> **Nota:** Este hallazgo requiere una corrección de código puntual en el servicio. Se documenta aquí y se implementará en el próximo commit de seguridad sobre esta rama, fuera del scope de documentación de S5.

---

## Sección 24 — Estado git final

```
Rama: feature/ajustes-permisos-docentes
```

```
git status:
On branch feature/ajustes-permisos-docentes
Untracked files:
  docs/seguridad/SPRINT-S5-HARDENING-DATOS-ARCHIVOS-INFRAESTRUCTURA.md

nothing added to commit but untracked files present
```

```
git diff --check: (sin salida — sin cambios en archivos rastreados)
```

```
git diff --stat: (sin cambios en archivos rastreados)
```

**Solo se creó el archivo de documentación.** No se modificó ningún archivo de código fuente en este sprint, conforme a los lineamientos del S5.

El hallazgo S5-01 (Content-Disposition) se implementará como commit separado en esta rama.

---

## Informe Final — SPRINT S5

| # | Área | Resultado | Acción |
|---|------|-----------|--------|
| 1 | Rama inicial | `feature/ajustes-permisos-docentes` — limpia | Verificado ✅ |
| 2 | Superficie de ataque | 6 endpoints de normativas mapeados | Documentado ✅ |
| 3 | DATABASE_URL | Validada en arranque; no hardcodeada | SEGURO ✅ |
| 4 | PrismaService | Minimal, cierre ordenado, sin credenciales | SEGURO ✅ |
| 5 | SQL Injection | 3 usos de $queryRaw — todos con Prisma.sql parametrizado | SIN RIESGO ✅ |
| 6 | $queryRawUnsafe / $executeRawUnsafe | No encontrado en codebase | SIN RIESGO ✅ |
| 7 | Secretos en código versionado | .env excluido; .env.example sin credenciales reales | SEGURO ✅ |
| 8 | Validación de env al arranque | FAIL FAST: DATABASE_URL, JWT_SECRET, FRONTEND_URL, NODE_ENV, STORAGE_PATH | SEGURO ✅ |
| 9 | Privilegios DB en producción | Recomendación documentada; pendiente implementación DBA | PENDIENTE OPS |
| 10 | Integridad transaccional | Compensating pattern (crear/actualizar) + $transaction (cuarentena/estado) | SEGURO ✅ |
| 11 | Prisma schema — UUIDs | Todos los PKs son UUID; sin enumeración | SEGURO ✅ |
| 12 | Prisma schema — onDelete | Cascade apropiado; SetNull en normativaSucesora; Restrict default en tokens | SEGURO ✅ |
| 13 | Prisma schema — unicidades | @@unique en normativa, correlatividad, rolPermiso; @unique en tokens | SEGURO ✅ |
| 14 | Indexes de auditoría | 4 indexes en AuditLogNormativa | SEGURO ✅ |
| 15 | StorageService — path traversal | resolverRuta() con startsWith(basePath + sep) | SEGURO ✅ |
| 16 | Naming físico de archivos | UUID.pdf — nunca nombre del cliente como ruta física | SEGURO ✅ |
| 17 | storage/ en .gitignore | backend/storage/ excluido | SEGURO ✅ |
| 18 | Archivos temporales | memoryStorage() — sin archivos temporales en disco | SEGURO ✅ |
| 19 | Validación de tipo de upload | Magic bytes esPdf() — no depende de extensión ni Content-Type del cliente | SEGURO ✅ |
| 20 | Límites de tamaño de upload | 20 MB (controller) + 15 MB (servicio) | SEGURO ✅ |
| 21 | Auth en endpoints de descarga | JwtAuthGuard + RolesGuard en todos | SEGURO ✅ |
| 22 | RBAC en endpoints | ROLES_CONSULTA en descarga; ROLES_GESTION en subida/eliminar | SEGURO ✅ |
| 23 | Cache-Control en archivos | `private, no-store` en descarga y exportaciones | SEGURO ✅ |
| 24 | X-Content-Type-Options | `nosniff` en descarga y exportaciones | SEGURO ✅ |
| 25 | Content-Disposition — exportaciones | Nombre hardcodeado con fecha ISO — sin datos de usuario | SEGURO ✅ |
| 26 | **Content-Disposition — servirArchivo** | **nombreArchivoOriginal sin sanitizar — header injection** | **HALLAZGO S5-01** |
| 27 | Helmet — headers globales | X-Frame-Options, HSTS (prod), Referrer-Policy, etc. | SEGURO ✅ |
| 28 | CORS | origin único (FRONTEND_URL), credentials, allowedHeaders limitados | SEGURO ✅ |
| 29 | ValidationPipe global | whitelist, forbidNonWhitelisted, transform | SEGURO ✅ |
| 30 | HttpExceptionFilter | Sin stack traces al cliente en producción; mensaje opaco en 500 | SEGURO ✅ |
| 31 | Logging — sin secretos | No se loguea DATABASE_URL, JWT_SECRET, passwords ni tokens | SEGURO ✅ |
| 32 | Logging — PII (email) | mail.service.ts loguea dirección de email — riesgo LOW, aceptable | LOW / ACEPTABLE |
| 33 | Rutas internas en logs | Solo en logs de servidor, nunca expuestas al cliente | ACEPTABLE ✅ |
| 34 | Cuarentena — integridad | Compensating pattern + $transaction | SEGURO ✅ |
| 35 | Paths internos en API responses | rutaArchivoOriginal, rutaArchivoCuarentena, nombreArchivoFisico excluidos vía destructuring | SEGURO ✅ |
| 36 | Backup de BD | Estrategia documentada (pg_dump, cifrado, offsite) | PENDIENTE OPS |
| 37 | Backup de storage | Estrategia documentada (rsync/rclone, retención) | PENDIENTE OPS |
| 38 | Checklist de producción | 20 items documentados para equipo de infraestructura | PENDIENTE OPS |
| 39 | CVEs residuales de S4.5-B2 | Transferidos a S5.5 (multer, lodash, nodemailer) | DIFERIDO S5.5 |
| 40 | CVEs en dev deps | brace-expansion, browserslist, webpack, etc. — solo build, no producción | DIFERIDO S5.5 |
| 41 | Tests backend | 53/53 PASS — sin regresiones | ✅ |
| 42 | Build backend | exit 0 — sin errores TypeScript | ✅ |
| 43 | Cambios en código fuente | Ninguno en este sprint (solo documentación) | ✅ |

---

## Veredicto final

**REQUIERE CORRECCIÓN ADICIONAL**

El sprint S5 confirmó que la arquitectura de seguridad de base de datos, archivos e infraestructura está sólidamente implementada en 42 de 43 puntos auditados. Se identificó un hallazgo puntual (**S5-01: Content-Disposition filename injection**) que requiere corrección de código antes de declarar el sprint completo. La corrección es mínima (función de sanitización de 2 líneas). Todos los CVEs pendientes están documentados y transferidos a S5.5.

**Próximo paso inmediato:** Implementar corrección S5-01 en `normativas.service.ts` y confirmar con re-ejecución de tests y build.
**Próximo sprint:** S5.5 — Migración NestJS major 12.x (resolverá multer, lodash, body-parser, qs, @nestjs/core CVEs).
