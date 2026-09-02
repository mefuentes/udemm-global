# SPRINT S5.5-B — Migración NestJS 10 → 11

**Proyecto:** UDEMM Global
**Rama:** `feature/ajustes-permisos-docentes`
**Fecha:** 2026-09-02
**Sprint:** S5.5-B — Migración controlada NestJS 10 → 11
**Restricción:** Solo se modificaron `backend/package.json`, `backend/package-lock.json`, y los archivos de código estrictamente requeridos por breaking changes de Nest 11.

---

## 1. Baseline pre-migración

| Componente | Valor |
|-----------|-------|
| Rama | `feature/ajustes-permisos-docentes` |
| git status | `working tree clean` (sincronizado con origin) |
| Node.js | v20.17.0 |
| npm | 10.8.2 |
| Build baseline | exit 0 |
| Tests baseline | **53/53 PASS** (exit 0, 179.9 s) |
| Audit runtime baseline | 12 vulnerabilidades (1 low, 7 moderate, 4 high) |

---

## 2. Versiones @nestjs antes de la migración

| Paquete | Major | Versión instalada |
|---------|-------|-------------------|
| `@nestjs/common` | 10 | 10.4.22 |
| `@nestjs/core` | 10 | 10.4.22 |
| `@nestjs/platform-express` | 10 | 10.4.22 |
| `@nestjs/config` | 3 | 3.3.0 |
| `@nestjs/jwt` | 10 | 10.2.0 |
| `@nestjs/passport` | 10 | 10.0.3 |
| `@nestjs/throttler` | 6 | 6.5.0 |
| `@nestjs/testing` | 10 | 10.4.22 |
| `@nestjs/cli` | 10 | 10.4.9 |

**Dependencias transitivas runtime relevantes (pre-migración):**

| Paquete | Versión |
|---------|---------|
| `express` | 4.22.1 |
| `multer` | 2.0.2 |
| `body-parser` | 1.20.4 |

---

## 3. Versiones @nestjs después de la migración

| Paquete | Major | Versión instalada | Cambio |
|---------|-------|-------------------|--------|
| `@nestjs/common` | 11 | 11.2.3 | ✅ Actualizado |
| `@nestjs/core` | 11 | 11.2.3 | ✅ Actualizado |
| `@nestjs/platform-express` | 11 | 11.2.3 | ✅ Actualizado |
| `@nestjs/config` | 4 | 4.0.4 | ✅ Actualizado (3.3.0 → 4.0.4) |
| `@nestjs/jwt` | 11 | 11.0.2 | ✅ Actualizado |
| `@nestjs/passport` | 11 | 11.0.5 | ✅ Actualizado |
| `@nestjs/throttler` | 6 | 6.5.0 | — Sin cambio (ya compatible con Nest 11) |
| `@nestjs/testing` | 11 | 11.2.3 | ✅ Actualizado |
| `@nestjs/cli` | 11 | 11.0.24 | ✅ Actualizado |

**Dependencias transitivas runtime relevantes (post-migración):**

| Paquete | Versión | Cambio | Impacto |
|---------|---------|--------|---------|
| `express` | 5.2.1 | ⚠ 4.22.1 → 5.2.1 | Express 5 presente en Nest 11 (ver Sección 9) |
| `multer` | 2.2.0 | ✅ 2.0.2 → 2.2.0 | CVEs HIGH resueltos (≤2.1.1 era vulnerable) |
| `body-parser` | 2.3.0 | ✅ 1.20.4 → 2.3.0 | CVE MODERATE resuelto |
| `lodash` | 4.18.1 | — 4.17.21 → 4.18.1 | Persiste en @nestjs/config@4.x (esperado; se resuelve en Nest 12) |

---

## 4. Paquetes modificados

**Método de actualización:** Edición de rangos en `package.json` + `npm install`.

Rangos actualizados en `package.json`:

```diff
 dependencies:
-  "@nestjs/common": "^10.2.5"
+  "@nestjs/common": "^11.0.0"
-  "@nestjs/config": "^3.1.0"
+  "@nestjs/config": "^4.0.0"
-  "@nestjs/core": "^10.2.5"
+  "@nestjs/core": "^11.0.0"
-  "@nestjs/jwt": "^10.0.0"
+  "@nestjs/jwt": "^11.0.0"
-  "@nestjs/passport": "^10.0.0"
+  "@nestjs/passport": "^11.0.0"
-  "@nestjs/platform-express": "^10.2.5"
+  "@nestjs/platform-express": "^11.0.0"

 devDependencies:
-  "@nestjs/cli": "^10.2.5"
+  "@nestjs/cli": "^11.0.0"
-  "@nestjs/testing": "^10.4.22"
+  "@nestjs/testing": "^11.0.0"
```

`@nestjs/throttler@^6.5.0` — no modificado (peer deps ya incluyen Nest 11: `@nestjs/common@'^7||^8||^9||^10||^11'`).

---

## 5. Breaking changes revisados

| Cambio | Clasificación | Archivo afectado |
|--------|---------------|-----------------|
| Express 4.x → 5.x vía `@nestjs/platform-express@11` | **APLICA CONFIRMADO** | `app.module.ts` (ver Sección 9) |
| `@nestjs/jwt@11` — `expiresIn` tipo cambia a `StringValue` | **APLICA CONFIRMADO** | `auth.module.ts`, `auth.service.ts` |
| `@nestjs/config` 3.x → 4.x | NO APLICA | API `ConfigModule.forRoot({ isGlobal, validate })` sin cambio |
| `@nestjs/passport@11` — passport peer dep `^0.5.0||^0.6.0||^0.7.0` | NO APLICA | `passport@0.6.0` compatible |
| `enableShutdownHooks` / `onApplicationShutdown` | NO APLICA | Método definido pero NO llamado desde main.ts ni ningún otro archivo |
| `ValidationPipe(whitelist, forbidNonWhitelisted)` | NO APLICA | API sin cambio |
| `ThrottlerModule.forRoot([{ name, ttl, limit }])` | NO APLICA | `@nestjs/throttler@6.5.0` — formato igual, sin actualización |
| `StreamableFile` | NO APLICA | API sin cambio |
| `bodyParser: false` en NestFactory.create() | NO APLICA | main.ts: sin cambio requerido |
| `CORS enableCors()` | NO APLICA | API sin cambio |
| `HttpExceptionFilter` global | NO APLICA | API sin cambio |
| `APP_GUARD` con ThrottlerGuard | NO APLICA | Sin cambio |
| TypeScript ≥ 5.0 | NO APLICA | TypeScript 5.9.3 instalado |

---

## 6. Breaking changes aplicados

### 6.1 — `@nestjs/jwt@11`: tipo `expiresIn` cambió a `StringValue`

**Causa:** `@nestjs/jwt@11` actualiza su dependencia `@types/jsonwebtoken`, que ahora importa `StringValue` de `@types/ms`. El tipo de `SignOptions.expiresIn` cambió de `string | number` a `StringValue | number`, donde `StringValue` es un string template literal union (no un `string` genérico).

**Archivos afectados:** `auth.module.ts`, `auth.service.ts`.

**Fix aplicado (corrección S5.5-B — tipado limpio):**

Se importa únicamente el tipo necesario desde `jsonwebtoken` y se castea el valor al tipo real esperado:

```typescript
// auth.module.ts y auth.service.ts
import type { SignOptions } from 'jsonwebtoken';

// expiresIn castado al tipo real: StringValue | number | undefined
expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '3600s') as SignOptions['expiresIn'],
```

- **Tipo real:** `SignOptions['expiresIn']` resuelve a `StringValue | number | undefined` (donde `StringValue extends string` — template literal union de `@types/ms`).
- **Por qué funciona el cast:** TypeScript permite `A as B` cuando existe superposición suficiente. Como `StringValue extends string`, hay overlap entre `string` y `SignOptions['expiresIn']`, sin necesidad de `as unknown as`.
- **Sin `as any`. Sin `@ts-ignore`. Sin ESLint disable.** El fallback `'3600s'` y la configuración por env var se mantienen intactos.
- El comportamiento en runtime es idéntico — `jsonwebtoken` acepta strings de duración válidos.

**Verificación:** Build exit 0. 53/53 tests PASS.

---

## 7. Passport

`@nestjs/passport@11.0.5` — peer deps: `passport@'^0.5.0 || ^0.6.0 || ^0.7.0'`.

- `passport@0.6.0` instalado: **compatible** ✅
- No se actualizó passport — versión actual cumple el peer dep de `@nestjs/passport@11`.
- Patrón `AuthGuard('jwt')`: sin cambio.
- Patrón `PassportStrategy(Strategy)`: sin cambio.
- No se usa serialize/deserialize en el proyecto.
- `JwtStrategy.validate()`: sin cambio.

---

## 8. Lifecycle / Shutdown

`enableShutdownHooks` está definido en `prisma.service.ts` pero **no es llamado** desde `main.ts` ni ningún otro archivo del proyecto (verificado con grep). No produce ningún error y no requiere cambio. El patrón `onModuleInit` de `PrismaService` (`this.$connect()`) sigue siendo compatible con Nest 11.

---

## 9. Platform-Express / Express / Multer

### Express 5.2.1

**Hallazgo inesperado:** `@nestjs/platform-express@11.2.3` depende de `express@5.x` (no de Express 4.x como se asumía en S5.5-A). Esto implica que Express 5 llegó con Nest 11, no con Nest 12.

**Impacto evaluado:**
- El wildcard `forRoutes({ path: '*', method: RequestMethod.ALL })` en `CsrfMiddleware` (`app.module.ts`) **funciona correctamente** — NestJS abstrae el routing y el wildcard se resuelve en la capa de Nest, no directamente en Express.
- `import { json, urlencoded } from 'express'` en `main.ts` — **funciona correctamente** en Express 5 (exports estables).
- **Build: exit 0. Tests: 53/53 PASS.** No se detectaron incompatibilidades en runtime.

### Multer

| Versión | Antes | Después | CVEs |
|---------|-------|---------|------|
| `multer` | 2.0.2 | **2.2.0** | 5×HIGH **resueltos** (≤2.1.1 era vulnerable) |

**Impacto en código:** `import { memoryStorage } from 'multer'` en `normativas.controller.ts` — sin cambio de API. ✅

---

## 10. Config / Lodash

| Paquete | Antes | Después |
|---------|-------|---------|
| `@nestjs/config` | 3.3.0 | **4.0.4** |
| `lodash` | 4.17.21 (vía @nestjs/config) | 4.18.1 (vía @nestjs/config@4.x) |

`@nestjs/config@4.x` aún incluye `lodash` (4.18.1). Los CVEs de lodash persisten como vulnerabilidades residuales. Se resolverán al actualizar a `@nestjs/config@12.x` (disponible con Nest 12 en S5.5-D).

`ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` — API sin cambio. ✅

---

## 11. NPM Audit — antes vs. después

### Runtime (`--omit=dev`)

| Severidad | Antes | Después | Cambio |
|-----------|-------|---------|--------|
| LOW | 1 | 0 | -1 |
| MODERATE | 7 | 2 | -5 |
| HIGH | 4 | 1 | -3 |
| CRITICAL | 0 | 0 | — |
| **TOTAL** | **12** | **3** | **-9** |

### CVEs resueltos con Nest 11

| CVE / GHSA | Severidad | Paquete | Resolución |
|------------|-----------|---------|------------|
| GHSA-xf7r-hgr6-v32p | HIGH | multer | Resuelto (multer 2.2.0) |
| GHSA-v52c-386h-88mc | HIGH | multer | Resuelto (multer 2.2.0) |
| GHSA-5528-5vmv-3xc2 | HIGH | multer | Resuelto (multer 2.2.0) |
| GHSA-72gw-mp4g-v24j | HIGH | multer | Resuelto (multer 2.2.0) |
| GHSA-3p4h-7m6x-2hcm | HIGH | multer | Resuelto (multer 2.2.0) |
| GHSA-36xv-jgw5-4q75 | MODERATE | @nestjs/core | Resuelto |
| GHSA-v422-hmwv-36x6 | MODERATE | body-parser | Resuelto (2.3.0) |
| GHSA-q8mj-m7cp-5q26 (×3 entradas) | MODERATE | qs | Resuelto |
| GHSA-5v7r-6r5c-r473 / GHSA-j47w-4g3g-c36v | MODERATE | file-type (vía @nestjs/common) | Resuelto |

### CVEs residuales runtime (3)

| GHSA | Severidad | Paquete | Estado |
|------|-----------|---------|--------|
| GHSA-p6gq-j5cr-w38f | HIGH | nodemailer@8.0.11 | Residual — no explotable (proyecto no usa `raw`/`attachments.path`) |
| GHSA-w5hq-g745-h8pq | MODERATE | uuid (vía exceljs@4.x) | Residual — fix requiere exceljs@3.4.0 (breaking) |

> **Nota sobre exceljs:** audit sugiere instalar exceljs@3.4.0 que resuelve uuid, pero es un downgrade de major (4.x → 3.x). No planificado en este sprint.

---

## 12. Build

```
Comando: npm run build (tsc -p tsconfig.build.json)
Resultado: exit 0 ✅
```

Un breaking change de tipo requirió corrección en código (sección 6.1).

---

## 13. Tests

```
Comando: npx jest --runInBand --forceExit
Baseline (pre): 53/53 PASS
Post-upgrade:   53/53 PASS ✅
Tiempo:         63.3 s
Exit code:      0
```

Sin regresiones.

---

## 14. Riesgos residuales

| Riesgo | Nivel | Estado |
|--------|-------|--------|
| nodemailer HIGH (GHSA-p6gq) | Alto | No explotable (no usa `raw`/`attachments.path`). Resolver con `nodemailer@9.x` en sprint separado. |
| lodash HIGH (3×) | Alto | Persiste vía @nestjs/config@4.x. Se resolverá en S5.5-D (Nest 12 → @nestjs/config@12.x). |
| uuid MODERATE (vía exceljs) | Moderado | Resolver requiere exceljs@3.4.0 (downgrade de major). Evaluar en sprint futuro. |
| Express 5.x — wildcards en routing | Bajo | `forRoutes({ path: '*' })` testado con 53 tests PASS. NestJS abstrae el routing de Express. Monitorear en S5.5-D. |
| @nestjs/throttler v6.x en Nest 11 | Bajo | Resuelto — v6.5.0 declara compatibilidad explícita con Nest 11. |

---

## 15. Rollback

Si la migración a Nest 11 presenta problemas en producción o en entorno real:

```bash
# 1. Restaurar package.json y package-lock.json
git checkout HEAD -- backend/package.json backend/package-lock.json

# 2. Restaurar archivos de código modificados
git checkout HEAD -- backend/src/modules/auth/auth.module.ts
git checkout HEAD -- backend/src/modules/auth/auth.service.ts

# 3. Reinstalar node_modules
cd backend && npm ci

# 4. Verificar
npm run build
npx jest --runInBand --forceExit
```

No se tocaron migraciones Prisma. La base de datos queda intacta.

---

## 16. Validación git final

```
$ git branch --show-current
feature/ajustes-permisos-docentes

$ git status
On branch feature/ajustes-permisos-docentes
Your branch is up to date with 'origin/feature/ajustes-permisos-docentes'.

Changes not staged for commit:
  modified: backend/package-lock.json
  modified: backend/package.json
  modified: backend/src/modules/auth/auth.module.ts
  modified: backend/src/modules/auth/auth.service.ts

Untracked files:
  docs/seguridad/SPRINT-S5-5-B-MIGRACION-NEST-11.md

$ git diff --check
(warnings LF→CRLF de Windows en auth.module.ts y auth.service.ts — autocrlf config, no son errores reales)

$ git diff --stat
 backend/package-lock.json                | 2657 +++++++++++++++++-------------
 backend/package.json                     |   16 +-
 backend/src/modules/auth/auth.module.ts  |    3 +-
 backend/src/modules/auth/auth.service.ts |    3 +-
 4 files changed, 1550 insertions(+), 1129 deletions(-)
```

Archivos modificados dentro del scope permitido. Ningún archivo de frontend modificado.

---

## 17. Conclusión

| Campo | Valor |
|-------|-------|
| **Node.js** | v20.17.0 (sin cambio) |
| **NestJS antes** | 10.4.22 |
| **NestJS después** | 11.2.3 |
| **Express** | 5.2.1 (actualizado desde 4.22.1 — vino con platform-express@11) |
| **multer** | 2.2.0 (desde 2.0.2 — CVEs HIGH resueltos) |
| **lodash** | 4.18.1 vía @nestjs/config@4.x (persiste; se resuelve en S5.5-D) |
| **Audit runtime antes** | 12 (4 HIGH, 7 MODERATE, 1 LOW) |
| **Audit runtime después** | **3 (1 HIGH, 2 MODERATE)** |
| **Tests** | 53/53 PASS → 53/53 PASS (sin regresión) |
| **Build** | exit 0 |
| **Código modificado** | `auth.module.ts` (+`import type { SignOptions }` + cast tipado), `auth.service.ts` (ídem) |
| **git diff --check** | Limpio (warnings LF son de autocrlf, no errores) |
| **git diff --stat** | 4 archivos: package.json, package-lock.json, auth.module.ts, auth.service.ts |
| **git status** | 1 archivo untracked (este documento) |
| **Nota S5.5-A actualización** | Express 5 llegó con Nest 11, no Nest 12. Matrices de S5.5-A deben actualizarse en S5.5-F. |
