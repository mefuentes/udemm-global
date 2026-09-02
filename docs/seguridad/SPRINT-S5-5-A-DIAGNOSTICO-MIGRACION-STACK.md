# SPRINT S5.5-A — Diagnóstico de Migración del Stack Backend

**Proyecto:** UDEMM Global
**Rama:** `feature/ajustes-permisos-docentes`
**Fecha:** 2026-09-02
**Sprint actual:** S5.5-A — Diagnóstico (solo lectura y documentación)
**Propósito:** Planificar la migración tecnológica del backend para resolver CVEs residuales de S4.5-B2 y S5 sin breaking changes no controlados
**Restricción:** Solo se crea este documento — ningún package.json, código fuente ni configuración fue modificado

---

## Sección 1 — Estado inicial

```
Rama:      feature/ajustes-permisos-docentes
Git:       nothing to commit, working tree clean
Sincronía: up to date with origin/feature/ajustes-permisos-docentes
```

Condición verificada antes de cualquier análisis. El árbol estaba limpio.

---

## Sección 2 — Versiones actuales del entorno y stack

### Entorno de ejecución

| Componente | Versión instalada |
|-----------|------------------|
| **Node.js** | **v20.17.0** (LTS "Iron") |
| **npm** | **10.8.2** |
| **Sistema operativo** | Windows 10 Pro 10.0.19045 x64 |
| **Arquitectura** | x64 |

### Backend — npm list --depth=0 (versiones exactas instaladas)

#### Runtime

| Paquete | Versión instalada |
|---------|------------------|
| `@nestjs/common` | 10.4.22 |
| `@nestjs/core` | 10.4.22 |
| `@nestjs/platform-express` | 10.4.22 |
| `@nestjs/config` | 3.3.0 |
| `@nestjs/jwt` | 10.2.0 |
| `@nestjs/passport` | 10.0.3 |
| `@nestjs/throttler` | 6.5.0 |
| `@prisma/client` | 5.22.0 |
| `bcrypt` | 6.0.0 |
| `class-transformer` | 0.5.1 |
| `class-validator` | 0.14.4 |
| `cookie-parser` | 1.4.7 |
| `exceljs` | 4.4.0 |
| `helmet` | 8.3.0 |
| `nodemailer` | 8.0.11 |
| `passport` | 0.6.0 |
| `passport-jwt` | 4.0.1 |
| `pdfkit` | 0.19.1 |
| `reflect-metadata` | 0.1.14 |
| `rxjs` | 7.8.2 |

#### Dependencias transitivas runtime relevantes

| Paquete | Versión | Origen |
|---------|---------|--------|
| `express` | 4.22.1 | @nestjs/platform-express |
| `multer` | 2.0.2 | @nestjs/platform-express |
| `body-parser` | 1.20.4 | @nestjs/platform-express |
| `qs` | 6.14.2 | body-parser + express |
| `lodash` | 4.17.21 | @nestjs/config |
| `uuid` | (ver exceljs) | exceljs |
| `file-type` | (ver @nestjs/common) | @nestjs/common |

#### Dev / build / test / tooling

| Paquete | Versión instalada |
|---------|------------------|
| `@nestjs/cli` | 10.4.9 |
| `@nestjs/testing` | 10.4.22 |
| `@types/bcrypt` | 5.0.2 |
| `@types/jest` | 29.5.14 |
| `@types/multer` | 2.2.0 |
| `@types/node` | 20.19.41 |
| `@types/nodemailer` | 8.0.1 |
| `@types/passport-jwt` | 3.0.13 |
| `@types/pdfkit` | 0.17.6 |
| `@types/supertest` | 7.2.1 |
| `jest` | 29.7.0 |
| `prisma` (CLI) | 5.22.0 |
| `supertest` | 7.2.2 |
| `ts-jest` | 29.4.12 |
| `ts-node` | 10.9.2 |
| `ts-node-dev` | 2.0.0 |
| `typescript` | 5.9.3 |

---

## Sección 3 — Árbol NestJS — inventario y alineación de majors

### Estado actual: todos en major 10

| Paquete @nestjs/* | Major actual | Versión exacta | Nota |
|------------------|--------------|---------------|------|
| `@nestjs/common` | 10 | 10.4.22 | Runtime core |
| `@nestjs/core` | 10 | 10.4.22 | Runtime core |
| `@nestjs/platform-express` | 10 | 10.4.22 | HTTP adapter |
| `@nestjs/config` | 3 | 3.3.0 | **Desalineado: major 3 ≠ 10** |
| `@nestjs/jwt` | 10 | 10.2.0 | Alineado |
| `@nestjs/passport` | 10 | 10.0.3 | Alineado |
| `@nestjs/throttler` | 6 | 6.5.0 | **Desalineado: major 6 ≠ 10** |
| `@nestjs/testing` | 10 | 10.4.22 | Dev |
| `@nestjs/cli` | 10 | 10.4.9 | Dev tooling |

> **Nota:** `@nestjs/config@3.x` y `@nestjs/throttler@6.x` tienen versionado semántico propio no alineado al major de Nest core. Esto es normal y esperado — en Nest 12 existen `@nestjs/config@4.x` y `@nestjs/throttler@7.x`.

### Features Nest utilizadas en el proyecto (archivos relevantes)

| Feature | Mecanismo | Archivos principales |
|---------|-----------|---------------------|
| `ConfigModule.forRoot({ isGlobal, validate })` | `@nestjs/config` | `app.module.ts` |
| `ThrottlerModule.forRoot([{ name, ttl, limit }])` | `@nestjs/throttler` | `app.module.ts` |
| `APP_GUARD` con `ThrottlerGuard` | `@nestjs/core` | `app.module.ts` |
| `CsrfMiddleware` vía `NestModule.configure()` | `@nestjs/common` | `app.module.ts`, `csrf.middleware.ts` |
| `JwtModule` / `JwtService` | `@nestjs/jwt` | `auth.module.ts`, `auth.service.ts` |
| `PassportModule` / `PassportStrategy` | `@nestjs/passport` | `auth.module.ts`, `jwt.strategy.ts` |
| `AuthGuard('jwt')` | `@nestjs/passport` | `jwt-auth.guard.ts` |
| `FileInterceptor` + `memoryStorage()` | `@nestjs/platform-express` | `normativas.controller.ts` |
| `StreamableFile` | `@nestjs/common` | `normativas.controller.ts`, `normativas.service.ts` |
| `ValidationPipe(whitelist, forbidNonWhitelisted)` | `@nestjs/common` | `main.ts` (global) |
| `HttpExceptionFilter` global | `@nestjs/common` | `main.ts`, `http-exception.filter.ts` |
| `enableCors()` | `@nestjs/core` | `main.ts` |
| Helmet | express-compatible | `main.ts` |
| `app.listen(port)` / `ConfigService` | `@nestjs/config` | `main.ts` |
| `PrismaService.enableShutdownHooks()` | `@nestjs/core` (INestApplication) | `prisma.service.ts` |
| `@Roles()`, `@UseGuards()` | `@nestjs/common` decorators | múltiples controllers |
| `@Body()`, `@Param()`, `@Query()`, `@Req()` | `@nestjs/common` decorators | múltiples controllers |
| `@Header()` | `@nestjs/common` | `normativas.controller.ts` |
| `ParseIntPipe` | `@nestjs/common` | `normativas.controller.ts` |
| Lifecycle `OnModuleInit` | `@nestjs/common` | `prisma.service.ts` |
| `bodyParser: false` en `NestFactory.create()` | `@nestjs/core` | `main.ts` |
| No usa Swagger | — | No encontrado en codebase |

---

## Sección 4 — Node.js: análisis de compatibilidad

### Versión actual: v20.17.0 (LTS "Iron")

### ⚠ CORRECCIÓN APLICADA — Error en diagnóstico original

El diagnóstico inicial afirmaba que Node 20.17.0 cumplía los requisitos de NestJS 12. Esto es **incorrecto**.

Según la documentación oficial de NestJS 12:

- **NestJS 11 runtime** requiere Node **>= 20.x** (cualquier versión 20.x). Node 20.17.0 cumple. ✅
- **NestJS 12 runtime** requiere Node **>= 20.19.0** en la línea 20.x, o **>= 22.12.0** en la línea 22.x.
- **NestJS 12 CLI / `nest upgrade` / `@nestjs/schematics`** requiere Node **>= 22.22.3** en la línea 22.x (o las versiones superiores indicadas por Nest).

### Tabla de compatibilidad corregida

| Versión Node | Estado | Nest 11 (runtime) | Nest 12 (runtime) | Nest 12 CLI/schematics | Resultado |
|-------------|--------|------------------|------------------|----------------------|-----------|
| v18.x LTS "Hydrogen" | EOL: Abril 2025 | ✅ mínimo | ❌ | ❌ | No usar |
| **v20.17.0 LTS "Iron"** | **Activo (hasta Abril 2026)** | **✅** | **❌ — requiere ≥ 20.19** | **❌ — < 22.22.3** | **Actual — INSUFICIENTE para Nest 12** |
| v20.19.x LTS "Iron" | Activo (hasta Abril 2026) | ✅ | ✅ | ❌ — < 22.22.3 | Mínimo solo para runtime; insuficiente para CLI |
| v22.x LTS "Jod" (>= 22.12, < 22.22.3) | Activo (hasta Abril 2027) | ✅ | ✅ | ❌ — < 22.22.3 | Suficiente para runtime; insuficiente para CLI |
| **v22 LTS "Jod" (>= 22.22.3)** | **Activo (hasta Abril 2027)** | **✅** | **✅** | **✅** | **Objetivo recomendado del proyecto** |

### Evaluación por etapa de migración

- **Nest 11 (S5.5-C):** Node 20.17.0 **cumple**. Node >= 20.x requerido. ✅ No se cambia Node en esta etapa.
- **Nest 12 runtime (S5.5-D):** Node 20.17.0 **NO cumple**. Se requiere >= 20.19 o >= 22.12. Actualización de Node es **OBLIGATORIA antes de S5.5-D**.
- **Nest 12 CLI / `nest upgrade` / `@nestjs/schematics`:** Requiere Node **>= 22.22.3** en línea 22.x. Node 20.17.0 **NO cumple**. Actualización de Node es **OBLIGATORIA antes de S5.5-D**.

### Versión de Node objetivo recomendada

**Node 22 LTS >= 22.22.3** — justificación:
1. Satisface el requisito de Nest 12 runtime (>= 22.12) y de Nest 12 CLI/schematics (>= 22.22.3) en un único objetivo.
2. EOL Abril 2027: mayor ventana de soporte que Node 20.x (EOL Abril 2026).
3. Evita trabajar sobre el mínimo 20.19.x, que cubre solo el runtime pero no el CLI.
4. Un único objetivo claro simplifica la verificación y el rollback.

**Nota sobre Node 20.19.x:** satisface el runtime de Nest 12 pero no el CLI/schematics (requiere 22.22.3). No es la ruta recomendada para este proyecto.

### Impacto en dependencias nativas (bcrypt)

- `bcrypt@6.0.0` fue compilado para Node 20.17.0 en este entorno (binario N-API v3).
- Al actualizar Node (cualquier escenario):  se debe ejecutar `npm rebuild bcrypt` o reinstalar con `npm ci` para recompilar el binding nativo.
- N-API v3 es portable entre Node 12+ — la recompilación es un procedimiento de rutina, no un riesgo funcional.

---

## Sección 5 — TypeScript: análisis de configuración y compatibilidad

### Versión actual: 5.9.3

**tsconfig.json (relevante para seguridad de migración):**

| Opción | Valor actual | Impacto en migración |
|--------|-------------|---------------------|
| `module` | `commonjs` | Sin cambio requerido para Nest 11/12 en modo CJS |
| `target` | `es2020` | Compatible; Nest 12 no requiere cambio |
| `moduleResolution` | `node` | Modo "legacy"; compatible con Nest 11/12 en CJS |
| `emitDecoratorMetadata` | `true` | Requerido por NestJS (DI, decoradores). Sin cambio |
| `experimentalDecorators` | `true` | Requerido. Sin cambio |
| `strict` | `true` | Habilitado; podría detectar nuevos errores en tipos al actualizar |
| `strictPropertyInitialization` | `false` | Excepción necesaria para clases NestJS. Sin cambio |
| `skipLibCheck` | `true` | Necesario para compatibilidad @types. Sin cambio |
| `esModuleInterop` | `true` | Necesario. Sin cambio |

**tsconfig.build.json:**
- Extiende tsconfig.json, agrega `sourceMap: false`, `declaration: false`
- Excluye `*.spec.ts` del build de producción. Correcto, sin cambio.

### Compatibilidad TypeScript con target NestJS

| TypeScript | Nest 10 | Nest 11 | Nest 12 |
|------------|---------|---------|---------|
| 5.0.x | ✅ | ✅ | ✅ |
| 5.4.x | ✅ | ✅ | ✅ (mínimo doc) |
| **5.9.3** | **✅** | **✅** | **✅** |

TypeScript 5.9.3 es compatible con todas las rutas de migración. No requiere cambio.

---

## Sección 6 — Prisma: versión y compatibilidad

### Versión actual: 5.22.0 (CLI y Client)

```
prisma                  : 5.22.0
@prisma/client          : 5.22.0
Query Engine (Node-API) : libquery-engine (windows.dll.node)
```

| Escenario | Compatibilidad |
|-----------|---------------|
| Nest 10 + Prisma 5.22 | ✅ actual |
| Nest 11 + Prisma 5.22 | ✅ compatible (Prisma no depende del major Nest) |
| Nest 12 + Prisma 5.22 | ✅ compatible |
| Prisma 6.x (futuro) | Verificar changelog Prisma 5→6 independientemente |

**Decisión:** Prisma 5.22.0 puede mantenerse durante toda la migración NestJS. La actualización de Prisma (si se requiere en el futuro) es independiente de la migración de Nest.

**Nota sobre `enableShutdownHooks`:**
La implementación actual en `prisma.service.ts` usa `this.$on('beforeExit', ...)`. En Prisma 5.x + NestJS 10/11/12, este patrón funciona. En Prisma 6.x, el mecanismo puede cambiar — evaluar en ese momento.

---

## Sección 7 — Jest / testing: versión y compatibilidad

### Versiones actuales

| Paquete | Versión | Nota |
|---------|---------|------|
| `jest` | 29.7.0 | Stable; sin EOL inminente |
| `ts-jest` | 29.4.12 | Compatible con jest 29 y TS 5.x |
| `@nestjs/testing` | 10.4.22 | Sigue a @nestjs/core major |

### Compatibilidad con targets

| Escenario | Jest 29 | ts-jest 29 |
|-----------|---------|------------|
| Node 20.17.0 | ✅ | ✅ |
| Node 22 LTS >= 22.22.3 (objetivo Nest 12, CLI/schematics) | ✅ | ✅ |
| TypeScript 5.9.3 | ✅ | ✅ |
| Nest 11 | ✅ (+ @nestjs/testing 11.x) | ✅ |
| Nest 12 | ✅ (+ @nestjs/testing 12.x) | ✅ |

**Nota importante:** Al migrar Nest major, `@nestjs/testing` debe actualizarse junto con los demás `@nestjs/*`. No requiere cambio de jest ni ts-jest en sí.

---

## Sección 8 — Multer: diagnóstico completo

### Árbol de dependencias

```
@nestjs/platform-express@10.4.22
  └── multer@2.0.2                ← instalado
```

multer es **dependencia transitiva** de `@nestjs/platform-express`. No es una dependencia directa declarada en `package.json`. No puede actualizarse independientemente sin modificar platform-express.

### CVEs activos (5 HIGH — solo en modo runtime)

| GHSA | Severidad | Descripción |
|------|-----------|-------------|
| GHSA-xf7r-hgr6-v32p | HIGH | DoS vía cleanup incompleta de uploads |
| GHSA-v52c-386h-88mc | HIGH | DoS vía resource exhaustion |
| GHSA-5528-5vmv-3xc2 | HIGH | DoS vía recursión no controlada |
| GHSA-72gw-mp4g-v24j | HIGH | DoS vía campos con nombres anidados |
| GHSA-3p4h-7m6x-2hcm | HIGH | DoS vía uploads abortados (incomplete cleanup) |

### Versión corregida y ruta

- Versión con corrección: `multer >= 2.2.0` (o la versión que `@nestjs/platform-express@12.x` instale)
- Corrección vía: `@nestjs/platform-express@12.0.1` (disponible, non-alpha)
- Requiere: `@nestjs/core@12.x` (co-dependencia entre core y platform-express)
- **No puede actualizarse multer de forma independiente** sin romper la integración NestJS

### Mitigación actual (en vigor durante S5)

- `memoryStorage()`: sin archivos temporales en disco → algunos vectores de DoS reducidos
- Auth obligatoria en todos los endpoints de upload (ROLES_GESTION) → la explotación requiere usuario autenticado
- Límite de tamaño: 20 MB controller + 15 MB servicio

---

## Sección 9 — Nodemailer: diagnóstico y evaluación de explotabilidad

### Versión actual: 8.0.11

### Árbol

```
nodemailer@8.0.11   ← dependencia directa en package.json
```

### CVE activo

| GHSA | Severidad | Descripción |
|------|-----------|-------------|
| GHSA-p6gq-j5cr-w38f | HIGH | Opción `raw` a nivel de mensaje bypasea `disableFileAccess`/`disableUrlAccess`, habilitando lectura arbitraria de archivos y SSRF |

### Análisis de explotabilidad en este proyecto

**Revisión de `mail.service.ts`:**

```typescript
await this.transporter.sendMail({
  from: remitente,
  to: destinatario,
  subject: 'Restablecer contraseña — UDEMM Global',
  html,                    // solo cuerpo HTML generado internamente
});
```

- La opción `raw` **no se utiliza** en el proyecto ✅
- No se usan `attachments` con `path` ni `href` ✅
- No se usa `disableFileAccess` ni `disableUrlAccess` (porque no se accede a archivos/URLs externos) ✅
- El cuerpo del email es HTML generado internamente con plantilla hardcodeada ✅
- El único dato de usuario en el email es: nombre del usuario (String), enlace de recuperación (URL interna generada por el sistema) ✅

**Conclusión CVE GHSA-p6gq:** **NO EXPLOTABLE en la implementación actual**. El vector de ataque requiere que el llamador pase la opción `raw` en el mensaje, lo que no ocurre en ningún lugar del codebase.

### Ruta de actualización

- Versión corregida disponible: `nodemailer@9.1.1`
- npm describe el salto como "breaking change"
- Cambios reales entre 8.x → 9.x: refactoring interno de tipos, API `createTransport()` / `sendMail()` estable
- El código actual usa únicamente la API estable (ver arriba) → migración de bajo riesgo
- **Puede actualizarse de forma independiente** de la migración NestJS

---

## Sección 10 — Lodash / @nestjs/config: diagnóstico

### Árbol completo

```
@nestjs/config@3.3.0
  └── lodash@4.17.21        ← runtime

@nestjs/cli@10.4.9 (dev)
  ├── inquirer@8.2.6
  │   └── lodash@4.17.21    ← dev
  ├── @angular-devkit/schematics-cli@17.3.11
  │   └── inquirer@9.2.15
  │       └── lodash@4.17.21 ← dev
  └── node-emoji@1.11.0
      └── lodash@4.17.21    ← dev
```

### CVEs activos (3 HIGH)

| GHSA | Severidad | Descripción |
|------|-----------|-------------|
| GHSA-r5fr-rjxr-66jc | HIGH | Code injection vía `_.template` con nombres de clave de `imports` |
| GHSA-f23m-r3pf-42rh | HIGH | Prototype Pollution vía bypass de rutas de array en `_.unset` y `_.omit` |
| GHSA-xxjr-mmjv-4gpg | HIGH | Prototype Pollution en `_.unset` y `_.omit` |

### Análisis de explotabilidad

- **lodash vía @nestjs/config (runtime):** `@nestjs/config` usa lodash internamente para merge de configuraciones. El proyecto no llama directamente a `_.template`, `_.unset`, ni `_.omit`. Sin embargo, como dependencia runtime, la vulnerabilidad de prototype pollution podría ser explotable vía entradas de configuración maliciosas bajo condiciones extremas.
- **lodash vía @nestjs/cli (dev):** Solo se ejecuta durante build/scaffolding local. No está presente en el binario de producción. Riesgo en producción: NINGUNO.

### Ruta de actualización

- Versión corregida: `@nestjs/config@4.x` (disponible en Nest 12)
- **No puede actualizarse `@nestjs/config@4.x` en Nest 10** (peer dep de `@nestjs/core` impide la instalación)
- Requiere: `@nestjs/core@12.x` y demás paquetes Nest major 12

---

## Sección 11 — npm audit: runtime vs dev

### Runtime únicamente (`npm audit --omit=dev`)

```
12 vulnerabilities (1 low, 7 moderate, 4 high)
```

| Paquete | Severidad | CVEs | Ruta de corrección |
|---------|-----------|------|--------------------|
| `multer` | HIGH ×5 | GHSA-xf7r, GHSA-v52c, GHSA-5528, GHSA-72gw, GHSA-3p4h | @nestjs/platform-express@12.x |
| `lodash` (vía @nestjs/config) | HIGH ×3 | GHSA-r5fr, GHSA-f23m, GHSA-xxjr | @nestjs/config@12.x |
| `nodemailer` | HIGH | GHSA-p6gq | nodemailer@9.1.1 (independiente) |
| `@nestjs/core` | MODERATE | GHSA-36xv | @nestjs/core@12.x |
| `@nestjs/platform-express` | (transitivo) | — | ver multer |
| `body-parser` | MODERATE | GHSA-v422 | @nestjs/platform-express@12.x |
| `file-type` (vía @nestjs/common) | MODERATE ×2 | GHSA-5v7r, GHSA-j47w | @nestjs/common@12.x |
| `qs` (vía express + body-parser) | MODERATE ×3 | GHSA-q8mj, GHSA-x5fp, GHSA-4mjr | `npm audit fix` (sin breaking change) |
| `uuid` (vía exceljs) | MODERATE | GHSA-w5hq | exceljs@3.4.0 (breaking) |
| 1 LOW | LOW | — | — |

> **qs:** Puede corregirse con `npm audit fix` (sin `--force`). Requiere verificar si `qs` tiene versión directa en package.json (no la tiene — es transitiva de express/body-parser en @nestjs/platform-express). La corrección solo es efectiva si platform-express actualiza sus sub-dependencias.

### Dev + runtime (`npm audit` completo)

Según el análisis acumulado de S4.5-B2 + S5:

```
~26 vulnerabilities (3 low, 15 moderate, 8 high, 0 critical)
```

Vulnerabilidades adicionales dev-only (impacto en producción: NINGUNO):

| Paquete | Severidad | Origen | Impacto producción |
|---------|-----------|--------|-------------------|
| `brace-expansion` | HIGH | @nestjs/cli → glob | NINGUNO |
| `browserslist` | HIGH | @nestjs/cli → @angular-devkit | NINGUNO |
| `fast-uri` | HIGH | @nestjs/cli → ajv | NINGUNO |
| `glob` | HIGH | @nestjs/cli | NINGUNO |
| `js-yaml` | HIGH | @nestjs/cli → @angular-devkit | NINGUNO |
| `picomatch` | HIGH | @nestjs/cli → @angular-devkit | NINGUNO |
| `webpack` | HIGH | @nestjs/cli | NINGUNO |
| `tmp`/`inquirer` | HIGH | @nestjs/cli | NINGUNO |
| `ajv` | MODERATE | @nestjs/cli | NINGUNO |

> **Importante:** Ser "dev-only" no significa riesgo cero para el desarrollador (un `npm install` o `nest generate` podría ser afectado), pero **no representa riesgo en el proceso de producción** del backend. En una pipeline CI de producción que no instala devDependencies (`npm ci --omit=dev`), estos paquetes no están presentes.

---

## Sección 12 — Breaking changes NestJS 10 → 11

Para cada ítem se cita el código real del proyecto y se clasifica:

| Cambio | Clasificación | Código afectado |
|--------|---------------|----------------|
| **Node mínimo >= 20** | NO APLICA | Node 20.17.0 instalado — cumple el requisito de Nest 11 (>= 20.x) |
| **`@nestjs/config` cambia a major 3** (ya estamos en 3.3.0) | NO APLICA | app.module.ts: ConfigModule.forRoot() sin cambio de API |
| **`ThrottlerModule.forRoot([...])` — array de configuración** | NO APLICA | Ya implementado en formato v6/v11: `[{ name: 'default', ttl, limit }]` |
| **`APP_GUARD` con ThrottlerGuard** | NO APLICA | app.module.ts: patrón idéntico |
| **`StreamableFile` — sin cambios de API** | NO APLICA | normativas.controller.ts: API igual |
| **`bodyParser: false` en NestFactory.create()** | NO APLICA | main.ts: ya configurado |
| **`CacheModule` removido en Nest 11** | NO APLICA | No se usa CacheModule en el proyecto |
| **`@nestjs/platform-express` actualiza body-parser** | APLICA POTENCIALMENTE | main.ts: `import { json, urlencoded } from 'express'` — verificar si express 4.x → 5.x cambia estas APIs |
| **`passport` peer dep puede pasar a 0.7.x** | REQUIERE VERIFICACIÓN EXTERNA | `jwt-auth.guard.ts`: `AuthGuard('jwt')` — patrón estándar, bajo riesgo |
| **`PrismaService.enableShutdownHooks()` deprecado** | APLICA POTENCIALMENTE | `prisma.service.ts`: `this.$on('beforeExit', ...)` — puede requerir migrar a `onApplicationShutdown()` |
| **TypeScript >= 5.0 requerido** | NO APLICA | TypeScript 5.9.3 instalado |
| **`@nestjs/common` exporta nuevos tipos** | NO APLICA | Sin conflictos esperados |

### Detalle: enableShutdownHooks

```typescript
// Patrón actual (prisma.service.ts):
async enableShutdownHooks(app: INestApplication) {
  this.$on('beforeExit', async () => { await app.close(); });
}
```

En Nest 11, Prisma recomienda usar `onApplicationShutdown()` en lugar del patrón `$on('beforeExit')`. Sin embargo, el método `enableShutdownHooks` **no se encontró llamado explícitamente en main.ts**. Si no se llama, no produce error. Si se llama en algún módulo no inspeccionado, puede requerir ajuste.

**Acción en S5.5-B:** Verificar si `enableShutdownHooks` se llama y ajustar al patrón de Prisma 5.x + Nest 11.

---

## Sección 13 — Breaking changes NestJS 11 → 12

| Cambio | Clasificación | Código afectado |
|--------|---------------|----------------|
| **Node mínimo >= 20.19 (línea 20.x) o >= 22.12 (línea 22.x) — runtime** | **APLICA CONFIRMADO** | **Node 20.17.0 < 20.19 — NO cumple. Actualización obligatoria antes de esta etapa.** Ver Sección 4. |
| **Node mínimo >= 22.22.3 (línea 22.x) — CLI / `nest upgrade` / schematics** | **APLICA CONFIRMADO** | **Node 20.17.0 NO cumple. Objetivo recomendado: Node 22 LTS >= 22.22.3 (cubre runtime y CLI en un único objetivo).** Ver Sección 4. |
| **TypeScript >= 5.4 requerido** | NO APLICA | TypeScript 5.9.3 |
| **`@nestjs/platform-express@12.x` — multer actualizado** | APLICA CONFIRMADO | `normativas.controller.ts`: `import { memoryStorage } from 'multer'` — API multer stable, sin cambio esperado |
| **`body-parser` 2.x** (si aplica) | APLICA POTENCIALMENTE | `main.ts`: `import { json, urlencoded } from 'express'` — en express 5.x estas APIs persisten |
| **`express` puede pasar a 5.x** | APLICA POTENCIALMENTE | Los pattern de path en routers express 5 cambian (`*` → `:wildcard` o `(.*)`). Los controllers NestJS no definen paths express directamente — Nest abstrae esto. Bajo riesgo. |
| **`@nestjs/config@4.x`** — lodash eliminado | NO APLICA (cambio interno) | `app.module.ts`: `ConfigModule.forRoot({ isGlobal, validate })` — API sin cambio |
| **`@nestjs/core@12.x`** — CVE GHSA-36xv corregido | NO APLICA (corrección) | — |
| **`@nestjs/throttler@7.x`** si se actualiza | APLICA POTENCIALMENTE | `app.module.ts`: verificar si el formato `name: 'default'` persiste en v7 |
| **`@nestjs/common` — file-type 22.x** | NO APLICA (interna) | No usamos file-type directamente |
| **`@nestjs/common` exporta `StreamableFile` — sin cambio** | NO APLICA | Confirmado estable |

---

## Sección 14 — NestJS 12 y ESM: análisis

### Estado actual del proyecto: CommonJS

```json
// tsconfig.json
"module": "commonjs",
"moduleResolution": "node"
```

### Búsqueda de patrones CJS incompatibles con ESM

```
Resultado: NINGÚN uso de require(), __dirname, __filename, module.exports
en archivos TypeScript del proyecto (solo una aparición en una cadena de texto
en env.validation.ts como documentación, no como código funcional).
```

### NestJS 12 y ESM

- NestJS 12 **sigue soportando CommonJS**. No hay requisito de migrar a ESM.
- `@nestjs/platform-express@12.x` usa express 4.x o 5.x según su dependencia interna — sin impacto en el module system.
- Las dependencias internas de Nest 12 que son ESM-only (como `file-type@22.x`) son usadas por Nest con wrappers compatibles CJS.

**Decisión:** El proyecto puede permanecer en CommonJS durante toda la migración Nest 10 → 11 → 12. No es necesario migrar a ESM.

---

## Sección 15 — Dependencias nativas (bcrypt)

### Versión actual: bcrypt@6.0.0

bcrypt incluye bindings nativos compilados para Node-API (`napi-v3/bcrypt_lib.node`).

| Escenario | Acción requerida |
|-----------|-----------------|
| Permanece Node 20.17.0 (sin cambio) | No requiere recompilación |
| Actualiza NestJS sin cambiar Node (S5.5-C — Nest 11 con Node 20.17.0) | No requiere recompilación |
| Migra a Node 22 LTS >= 22.22.3 (S5.5-C2 — objetivo recomendado) | `npm rebuild bcrypt` obligatorio como parte del proceso |
| Actualiza NestJS a Nest 12 (requiere Node 22 LTS >= 22.22.3 — S5.5-D) | Node ya actualizado en S5.5-C2; no requiere acción adicional sobre bcrypt |

**Conclusión:** La migración Nest 10 → 11 no requiere acción sobre bcrypt (Node 20.17.0 sigue igual). La migración Node en S5.5-C2 (20.17.0 → 22 LTS >= 22.22.3) requiere `npm rebuild bcrypt` o `npm ci` como parte del proceso. Al llegar a S5.5-D (Nest 12), bcrypt ya está compilado para el Node correcto.

---

## Sección 16 — Matriz de compatibilidad

| Componente | Versión actual | Versión objetivo S5.5 | ¿Cambio obligatorio? | Breaking risk | Dependencias relacionadas | Etapa |
|------------|---------------|----------------------|----------------------|---------------|--------------------------|-------|
| **Node.js** | 20.17.0 | **22 LTS >= 22.22.3** (runtime + CLI/schematics) | **Sí — obligatorio antes de Nest 12** | Bajo-Medio (N-API bcrypt rebuild) | `npm rebuild bcrypt` en S5.5-C2 | **S5.5-C2 (entre Nest 11 y Nest 12)** |
| **npm** | 10.8.2 | 10.x | No | Ninguno | — | No requerido |
| **@nestjs/common** | 10.4.22 | 12.x | Sí (para multer) | Medio | core, platform-express | S5.5-C o S5.5-D |
| **@nestjs/core** | 10.4.22 | 12.x | Sí (CVE GHSA-36xv) | Medio | common, platform-express | S5.5-C o S5.5-D |
| **@nestjs/platform-express** | 10.4.22 | 12.x | Sí (para multer) | Medio | express, multer, body-parser | S5.5-C o S5.5-D |
| **@nestjs/config** | 3.3.0 | 4.x (con Nest 12) | Sí (lodash CVE) | Bajo (API estable) | lodash eliminado | S5.5-D |
| **@nestjs/jwt** | 10.2.0 | 11.x o 12.x | Sí (peer dep) | Bajo | jose, passport | S5.5-C/D |
| **@nestjs/passport** | 10.0.3 | 11.x o 12.x | Sí (peer dep) | Bajo-Medio (passport 0.7) | passport | S5.5-C/D |
| **@nestjs/throttler** | 6.5.0 | 7.x (con Nest 12) | Sí (peer dep) | Bajo | — | S5.5-D |
| **@nestjs/testing** | 10.4.22 | 12.x | Sí (peer dep) | Bajo | — | S5.5-D |
| **@nestjs/cli** | 10.4.9 | 12.x | Sí (peer dep dev) | Bajo | @angular-devkit | S5.5-D |
| **TypeScript** | 5.9.3 | 5.9.x (sin cambio) | No | Ninguno | — | No requerido |
| **Prisma CLI** | 5.22.0 | 5.22.x (sin cambio) | No | Ninguno | — | No requerido |
| **@prisma/client** | 5.22.0 | 5.22.x (sin cambio) | No | Ninguno | — | No requerido |
| **Jest** | 29.7.0 | 29.x (sin cambio) | No | Ninguno | — | No requerido |
| **ts-jest** | 29.4.12 | 29.x (sin cambio) | No | Ninguno | — | No requerido |
| **multer** | 2.0.2 | 2.2.x (transitivo) | Sí (vía platform-express 12) | Ninguno extra (API misma) | @nestjs/platform-express | S5.5-D |
| **nodemailer** | 8.0.11 | 9.1.1 | Sí (CVE HIGH, API estable) | Bajo (API sendMail igual) | — | S5.5-B |
| **bcrypt** | 6.0.0 | 6.x (sin cambio) | No | Ninguno | — | No requerido |
| **lodash** | 4.17.21 | (eliminado vía @nestjs/config@4.x) | Transitivo | Ninguno directo | @nestjs/config | S5.5-D |
| **RxJS** | 7.8.2 | 7.x (sin cambio) | No | Ninguno | — | No requerido |
| **Express** | 4.22.1 | 4.x o 5.x (transitivo) | Transitivo | Bajo-Medio (paths en express 5) | @nestjs/platform-express | S5.5-D |
| **class-validator** | 0.14.4 | 0.14.x (sin cambio) | No | Ninguno | — | No requerido |
| **class-transformer** | 0.5.1 | 0.5.x (sin cambio) | No | Ninguno | — | No requerido |
| **passport** | 0.6.0 | 0.7.x (posible) | Transitivo | Bajo-Medio | @nestjs/passport | S5.5-C/D |

---

## Sección 17 — Alternativas de migración

### Opción A: Nest 10 → 12 directamente

**Ventajas:**
- Una sola etapa de migración NestJS
- Menos tiempo total de migración si todo va bien

**Riesgos:**
- Requiere actualización de Node a >=20.19 o >=22.12 antes de la migración
- Sin estado intermedio verificado en Nest 11: si algo falla, es más difícil identificar la causa
- Mayor cantidad de cambios simultáneos (Node + todos los @nestjs/* en un solo paso)
- No hay punto de bisección entre Nest 11 y Nest 12

**Cantidad aproximada de cambios:**
- Actualizar Node (20.17.0 → 22 LTS >= 22.22.3) + todos los `@nestjs/*` de 10.x a 12.x en un solo paso
- Riesgo de que breaking changes de Nest 11 y 12 se superpongan y sean difíciles de aislar

**CVEs que resolvería:**
- multer 5×HIGH, lodash 3×HIGH, @nestjs/core MODERATE, body-parser MODERATE, file-type MODERATE

**CVEs pendientes:**
- nodemailer HIGH (requiere paso separado), qs MODERATE, uuid MODERATE

**Facilidad de rollback:** Media (git stash / git reset + `nvm use 20.17.0`)

---

### Opción B: Nest 10 → 11 → 12 (incremental)

**Ventajas:**
- La migración Nest 10 → 11 puede hacerse con Node 20.17.0 actual (Nest 11 requiere >= 20.x).
- Cada etapa NestJS es verificable de forma independiente antes de proceder.
- El update de Node se introduce como paso controlado entre Nest 11 y Nest 12, no mezclado con el resto.
- Si Nest 11 tiene problemas, se resuelven con Node actual sin agregar la variable de Node update.
- Rollback más granular: se puede quedar en Nest 11 (con Node 20.17.0) si Nest 12 tiene problemas.
- La update de Node se hace en un estado estable (Nest 11 ya testado).

**Riesgos:**
- Más tiempo total de migración (tres etapas en lugar de una para NestJS).
- Dos conjuntos de breaking changes de NestJS a gestionar (parcialmente solapados).
- @nestjs/config pasa por v3.x en Nest 11 → v4.x en Nest 12.
- La update de Node (entre S5.5-C y S5.5-D) agrega una etapa explícita al plan.

**Cantidad aproximada de cambios:**
- S5.5-C: actualizar `@nestjs/*` de 10.x a 11.x (Node 20.17.0 sin cambio)
- S5.5-C2: actualizar Node a **22 LTS >= 22.22.3** (+ npm rebuild bcrypt) — cubre runtime y CLI/schematics
- S5.5-D: actualizar `@nestjs/*` de 11.x a 12.x (Node ya en 22.22.3+)

**CVEs que resolvería Nest 11:** Parcialmente (algunos transitivos; no multer).
**CVEs que resolvería Nest 12:** multer 5×HIGH, lodash 3×HIGH, @nestjs/core MODERATE, body-parser, qs.

**CVEs pendientes:** nodemailer HIGH (paso S5.5-B independiente), uuid MODERATE.

**Facilidad de rollback:** Alta (tres puntos de commit: Nest 11, Node updated, Nest 12; cada uno testado).

---

### Opción C: Mantener Nest 10 temporalmente

**Ventajas:**
- Sin riesgo inmediato de regresión en NestJS.
- Tiempo para investigar breaking changes con mayor detenimiento.

**Riesgos:**
- Los CVEs HIGH de multer y lodash permanecen indefinidamente.
- La deuda técnica crece con el tiempo.
- Node.js 20.x LTS Iron tiene EOL en Abril 2026 — sin migración, el entorno queda sin soporte de seguridad en menos de un año.
- La brecha de versiones entre Nest 10 y Nest 12 crecerá, haciendo la migración futura más costosa.
- **Nota:** Mantener Nest 10 no elimina la necesidad de actualizar Node; simplemente la posterga sin resolver los CVEs asociados a Nest major.

**CVEs que resolvería:** Ninguno.

**No recomendado.**

---

## Sección 18 — Recomendación

**Opción recomendada: B (migración incremental Nest 10 → 11 → [Node update] → 12)**

**Justificación:**
1. La migración incremental permite validar el estado del sistema en cada paso antes de proceder.
2. El proyecto tiene una suite de 53 tests que actúa como red de seguridad; ejecuciones independientes post-Nest-11, post-Node-update y post-Nest-12 dan mayor confianza que una única validación.
3. **Corrección crítica:** Node 20.17.0 NO es compatible con Nest 12. La actualización de Node es obligatoria, pero al hacerla en un paso intermedio (S5.5-C2, después de Nest 11 ya verificado), se aisla como variable de cambio independiente.
4. Nest 10 → 11 puede ejecutarse con Node 20.17.0 actual (Nest 11 requiere solo >= 20.x), reduciendo el número de cambios simultáneos en esa etapa.
5. nodemailer puede actualizarse de forma independiente en S5.5-B (antes de la migración NestJS) dado que no depende del major de Nest ni de la versión de Node.
6. La migración Nest 10 → 11 es de menor riesgo y puede ejecutarse hoy. La update de Node y Nest 12 se planifican como etapas posteriores controladas.
7. Cada etapa queda en un commit separado y testado, lo que hace el rollback predecible en cada punto.

**Versión de Node objetivo:** **22 LTS >= 22.22.3** — satisface runtime Nest 12 (>= 22.12) y CLI/schematics (>= 22.22.3) en un único objetivo; EOL Abril 2027. Evita trabajar sobre el mínimo 20.19.x, que no cubre el CLI.

---

## Sección 19 — Plan de rollback

### Ante cualquier etapa fallida

```bash
# 1. Identificar el commit previo estable
git log --oneline -5

# 2. Stash si hay cambios no commiteados
git stash -u

# 3. Revertir a commit estable (sin afectar historial)
git checkout <commit-hash-estable>

# O revertir solo package.json / package-lock.json
git checkout HEAD -- backend/package.json backend/package-lock.json

# 4. Reinstalar node_modules desde el package-lock revertido
cd backend && npm ci

# 5. Verificar
npm run build
npx jest --runInBand --forceExit
```

### Compromisos del plan de rollback

| Componente | Protegido por | Acción de rollback |
|-----------|--------------|-------------------|
| Código fuente | Git | `git checkout <tag/commit>` |
| package.json + package-lock.json | Git | `git checkout HEAD -- package.json package-lock.json` |
| node_modules | npm ci (desde package-lock) | Reinstalar |
| Versión de Node | nvm / nvmw | `nvm use 20.17.0` |
| Base de datos | Sin cambios en ninguna etapa S5.5 | No requiere rollback |
| Migraciones Prisma | Sin migraciones en S5.5 | No requiere rollback |
| Variables de entorno | .env no versionado | Permanece igual |

**La base de datos y las migraciones no se tocan en ninguna etapa de S5.5.** El rollback se limita al código y las dependencias npm.

---

## Sección 20 — Plan propuesto S5.5 (etapas B en adelante)

### S5.5-B: Actualización de nodemailer (independiente de Nest)

**Objetivo:** Resolver CVE GHSA-p6gq
**Acción:** `npm install nodemailer@9.1.1` (dentro del major semver 9, no breaking en API usada)
**Validación:** build + tests + verificar que `mail.service.ts` compile sin cambios
**Riesgo:** Bajo — API `sendMail()` y `createTransport()` estable en 8.x → 9.x
**CVEs resueltos:** nodemailer HIGH (1)

### S5.5-C: Migración NestJS 10 → 11

**Pre-requisito de Node:** Node 20.17.0 es suficiente para Nest 11 (requiere >= 20.x). No se actualiza Node en esta etapa.

**Objetivo:** Actualizar todos los paquetes `@nestjs/*` de major 10 a major 11
**Paquetes a actualizar:**
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/testing`, `@nestjs/cli`
- `@nestjs/config`: evaluar si pasa a 3.x.latest con Nest 11 o si existe una versión de transición
- `@nestjs/throttler`: evaluar si permanece en 6.x o si Nest 11 requiere 7.x

**Puntos de verificación:**
- Verificar `enableShutdownHooks` en PrismaService (puede requerir migración a `onApplicationShutdown`)
- Verificar que `passport@0.6.0` siga siendo compatible con `@nestjs/passport@11.x`
- Verificar `ThrottlerModule` con el nuevo `@nestjs/throttler` si cambia de major

**Validación:** build + 53 tests + verificación manual de endpoints críticos
**CVEs resueltos:** parciales (algunos transitivos)
**Commit:** Si todos los tests pasan, crear commit estable de Nest 11.

### S5.5-C2: Actualización de Node.js ⚠ OBLIGATORIO antes de Nest 12

**Pre-requisito:** Nest 11 ya migrado, build y 53 tests en verde, commit estable creado (S5.5-C completo).

**Objetivo:** Actualizar Node de 20.17.0 a **Node 22 LTS >= 22.22.3**

**Por qué 22.22.3 y no 22.12:**
- Nest 12 runtime requiere >= 22.12 en línea 22.x.
- Nest 12 CLI / `nest upgrade` / `@nestjs/schematics` requieren Node >= 22.22.3 en línea 22.x.
- Apuntar a 22.22.3 cubre ambos requisitos con un único objetivo, sin verificación extra.

**Acciones:**
```bash
# nvm for Windows (nvmw) o nvm en macOS/Linux
nvm install 22.22.3
nvm use 22.22.3

# Verificar versión exacta
node --version   # debe mostrar v22.22.3 o superior

# Recompilar binarios nativos
cd backend && npm rebuild bcrypt

# Verificar que la instalación sigue funcionando
npm run build
npx jest --runInBand --forceExit
```

**Validación esperada:** build exit 0 + 53 tests PASS.
**Rollback:** `nvm use 20.17.0` + `npm rebuild bcrypt` + verificar Nest 11 sigue funcionando en 20.17.0.
**Commit:** Si build y tests pasan, crear commit del cambio de Node (actualizar `.nvmrc` o `.node-version` si existe).

### S5.5-D: Migración NestJS 11 → 12

**Pre-requisito:** Node 22 LTS >= 22.22.3 ya instalado y verificado (S5.5-C2 completo). Este Node cubre tanto runtime como CLI/schematics de Nest 12.

**Objetivo:** Actualizar todos los paquetes `@nestjs/*` de major 11 a major 12
**Paquetes a actualizar:** todos los `@nestjs/*` incluyendo `@nestjs/config@4.x`, `@nestjs/throttler@7.x`
**Efecto en dependencias transitivas:** multer actualizado, body-parser actualizado, lodash eliminado de @nestjs/config, qs actualizado, file-type actualizado

**Puntos de verificación:**
- `import { memoryStorage } from 'multer'` en `normativas.controller.ts`: verificar compatibilidad con la versión de multer que trae @nestjs/platform-express@12.x
- `import { json, urlencoded } from 'express'` en `main.ts`: verificar si express 5.x (si lo introduce @nestjs/platform-express@12.x) mantiene estas exports
- `@nestjs/throttler@7.x`: verificar que el formato `[{ name: 'default', ttl, limit }]` siga siendo válido

**Validación:** build + 53 tests + verificación manual
**CVEs resueltos:** multer 5×HIGH, lodash 3×HIGH, @nestjs/core MODERATE, body-parser MODERATE, qs MODERATE, file-type MODERATE

### S5.5-E: Regresión integral

**Objetivo:** Verificar funcionalidad completa post-migración
**Acciones:**
- Suite de tests completa (53 tests)
- Build limpio desde cero (`dist/` eliminado)
- Verificación de endpoints en entorno de desarrollo (no `start:dev` como validación definitiva)
- Verificación de generación de PDF y Excel
- Verificación de subida de archivo PDF
- Verificación de autenticación JWT
- Audit final: `npm audit --omit=dev` debe mostrar 0 HIGH/CRITICAL

### S5.5-F: Documentación y cierre

**Objetivo:** Documentar el resultado de la migración
**Acciones:**
- Actualizar `docs/seguridad/SPRINT-S5-5-A-DIAGNOSTICO-MIGRACION-STACK.md` con resultados reales
- Crear `docs/seguridad/SPRINT-S5-5-RESULTADO-MIGRACION.md`
- Actualizar matriz de vulnerabilidades residuales

---

## Sección 21 — Validación: tests

```
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

**Resultado: 53/53 PASS** ✅ — Estado actual del stack es sano.

---

## Sección 22 — Validación: build

```
Comando: npm run build (tsc -p tsconfig.build.json)
Exit code: 0
```

**Resultado: BUILD EXITOSO** ✅ — Sin errores TypeScript en Nest 10.4.22.

---

## Sección 23 — Riesgos identificados

| Riesgo | Nivel | Etapa | Mitigación |
|--------|-------|-------|------------|
| **Node 20.17.0 incompatible con Nest 12 (runtime y CLI)** | **Alto** | **S5.5-C2** | **Actualizar a Node 22 LTS >= 22.22.3 antes de S5.5-D. Cubre runtime (>= 22.12) y CLI/schematics (>= 22.22.3) con un único objetivo. Ver Sección 4.** |
| `passport@0.6.x` incompatible con `@nestjs/passport@11.x` | Medio | S5.5-C | Verificar peer deps antes de instalar; probar AuthGuard('jwt') |
| `enableShutdownHooks` requiere refactor en Nest 11 | Bajo-Medio | S5.5-C | Migrar a `onApplicationShutdown()` si se confirma su uso |
| express 5.x cambia routing (paths) | Bajo | S5.5-D | NestJS abstrae routing; verificar solo si se usan paths express directamente |
| `memoryStorage()` import cambia en multer 2.2.x | Bajo | S5.5-D | API multer 2.x es estable; muy bajo riesgo real |
| `@nestjs/throttler@7.x` cambia configuración | Bajo | S5.5-D | Verificar `name: 'default'` sigue siendo válido |
| bcrypt rebuild al actualizar Node en S5.5-C2 | Bajo | S5.5-C2 | `npm rebuild bcrypt` como parte del proceso de update de Node |
| uuid via exceljs — corrección requiere exceljs@3.4.0 (breaking) | Bajo | No planificado | Evaluar en sprint futuro; impacto: solo exportaciones Excel |
| TypeScript strict puede detectar nuevos errores en tipos Nest 11/12 | Bajo | S5.5-C/D | Evaluar y corregir errores de tipo |

---

## Sección 24 — Validación git final

```
$ git status
On branch feature/ajustes-permisos-docentes
Your branch is up to date with 'origin/feature/ajustes-permisos-docentes'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/seguridad/SPRINT-S5-5-A-DIAGNOSTICO-MIGRACION-STACK.md

nothing added to commit but untracked files present (use "git add" to track)

$ git diff --check
(sin salida — ningún archivo rastreado modificado)

$ git diff --stat
(sin salida — ningún archivo rastreado modificado)
```

Solo se creó el archivo de diagnóstico. Ningún `package.json`, `package-lock.json`, código fuente ni configuración fue modificado. Las restricciones de la etapa S5.5-A se cumplieron en su totalidad.

**Nota sobre correcciones documentales:** El archivo fue actualizado en múltiples pasadas dentro de esta etapa para corregir los requisitos de Node para Nest 12 (runtime y CLI/schematics). Ninguna corrección implicó modificaciones a código fuente ni dependencias.

---

## Informe Final — SPRINT S5.5-A

| Campo | Valor |
|-------|-------|
| **Rama** | `feature/ajustes-permisos-docentes` |
| **Node actual** | v20.17.0 (LTS "Iron") |
| **npm actual** | 10.8.2 |
| **NestJS actual** | 10.4.22 (todos los @nestjs/*) |
| **Prisma actual** | 5.22.0 |
| **TypeScript actual** | 5.9.3 |
| **Jest actual** | 29.7.0 |
| **multer actual** | 2.0.2 (transitivo vía @nestjs/platform-express@10.4.22) |
| **nodemailer actual** | 8.0.11 |
| **Audit runtime (--omit=dev)** | 12 vulnerabilidades (1 low, 7 moderate, 4 high) |
| **Audit total (con dev)** | ~26 vulnerabilidades (3 low, 15 moderate, 8 high, 0 critical) |
| **Breaking changes confirmados** | enableShutdownHooks patrón (bajo), passport compat (verificar) |
| **Ruta recomendada** | **Opción B: Nest 10 → 11 → 12 (incremental)** |
| **Node recomendado** | **22 LTS >= 22.22.3** (cubre runtime Nest 12 >= 22.12 y CLI/schematics >= 22.22.3; EOL Abril 2027) |
| **Nest objetivo** | 12.x (con parada verificada en 11.x) |
| **Etapas propuestas** | S5.5-B (nodemailer) → S5.5-C (Nest 11) → **S5.5-C2 (Node update ⚠ obligatorio)** → S5.5-D (Nest 12) → S5.5-E (regresión) → S5.5-F (documentación) |
| **Tests** | 53/53 PASS (exit 0) |
| **Build** | exit 0 |
| **Archivo creado** | `docs/seguridad/SPRINT-S5-5-A-DIAGNOSTICO-MIGRACION-STACK.md` |
| **git diff --check** | Limpio |
| **git diff --stat** | 0 archivos modificados |
| **git status** | 1 archivo untracked (este documento) |

---

**LISTO PARA REVISIÓN**
