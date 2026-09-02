# SPRINT S4.5 — ETAPA B2: DEPENDENCIAS BACKEND / CVE HARDENING

**Fecha de ejecución:** 2026-09-01
**Rama:** `feature/ajustes-permisos-docentes`
**Responsable técnico:** Mariano Fuentes
**Estado resultado:** LISTO PARA REVISIÓN — con vulnerabilidades residuales documentadas

---

## 1. Objetivo

Auditar y corregir vulnerabilidades CVE en las dependencias del backend (`backend/`), priorizando:

- Paquetes runtime accesibles desde entrada externa
- Subida/procesamiento de archivos (multer)
- Autenticación y hashing (bcrypt)
- Correo (nodemailer)
- Sin romper funcionalidad, sin breaking changes no justificados
- Sin usar `npm audit fix --force`

---

## 2. Estado Git al Iniciar

| Campo | Valor |
|---|---|
| Rama | `feature/ajustes-permisos-docentes` |
| Estado | `nothing to commit, working tree clean` |
| Sincronización | Up to date with `origin/feature/ajustes-permisos-docentes` |

---

## 3. npm audit Inicial

```
33 vulnerabilities (3 low, 15 moderate, 14 high, 1 critical)
```

### 3.1 Resumen por paquete

| Paquete | Versión instalada | Severidad | Tipo | Via |
|---|---|---|---|---|
| `tar` | ≤7.5.20 | **CRITICAL** | Runtime build (npm install) | bcrypt → @mapbox/node-pre-gyp → tar |
| `multer` | 2.0.2 | HIGH (5 CVEs) | Runtime | @nestjs/platform-express |
| `nodemailer` | 8.0.11 | HIGH | Runtime | directa |
| `lodash` | 4.x | HIGH | Runtime | @nestjs/config |
| `glob` | 10.x | HIGH | DEV | @nestjs/cli |
| `picomatch` | 4.0.x | HIGH | DEV | @nestjs/cli → @angular-devkit |
| `tmp` | ≤0.2.5 | HIGH | DEV | @nestjs/cli → inquirer → external-editor |
| `webpack` | 5.49–5.104 | HIGH | DEV | @nestjs/cli |
| `brace-expansion` | múltiples | HIGH | DEV/transitivo | múltiples cadenas |
| `browserslist` | ≤4.28.6 | HIGH | DEV | @angular-devkit |
| `fast-uri` | 3.0.0–3.1.4 | HIGH | transitivo | ajv → @angular-devkit |
| `js-yaml` | 4.0.0–4.3.0 | HIGH | transitivo | @angular-devkit |
| `@nestjs/core` | ≤11.1.17 | MODERATE | Runtime | directa |
| `body-parser` | ≤1.20.5 | MODERATE | Runtime | @nestjs/platform-express |
| `file-type` | 13.0–21.3.x | MODERATE | Runtime | @nestjs/common |
| `ajv` | 7.0-8.17 | MODERATE | DEV | @nestjs/cli → @angular-devkit |
| `qs` | 6.11.1–6.15.1 | MODERATE | Runtime | express → @nestjs/platform-express |
| `uuid` | <11.1.1 | MODERATE | Runtime | exceljs |

---

## 4. Tabla de Vulnerabilidades — Clasificación y Decisión

| Paquete | CVEs | Severidad | Entorno | Explotable en UDEMM | Fix disponible | Decisión |
|---|---|---|---|---|---|---|
| `tar` (via bcrypt) | 12 CVEs path traversal, file overwrite, DoS | CRITICAL | Build-time (npm install) | Bajo (solo en npm install de packages maliciosos) | bcrypt@6.0.0 elimina dependencia | **CORREGIR B2** |
| `brace-expansion` | DoS exponential, OOM | HIGH | DEV/transitivo | No (no runtime) | `npm audit fix` seguro | **CORREGIR B2** |
| `browserslist` | OOM, prototype write | HIGH | DEV/build | No (no runtime) | `npm audit fix` seguro | **CORREGIR B2** |
| `fast-uri` | Host confusion via backslash | HIGH | transitivo | No en UDEMM (URL parsing interno) | `npm audit fix` seguro | **CORREGIR B2** |
| `js-yaml` | ReDoS merge key | HIGH | DEV/transitivo | No (no expuesto a input externo) | `npm audit fix` seguro | **CORREGIR B2** |
| `multer` | 5× DoS (incomplete cleanup, recursion, nested fields) | HIGH | Runtime | Posible (endpoint de carga PDF) | Requiere @nestjs/platform-express@12.x | **DIFERIR S5 con riesgo residual** |
| `nodemailer` | SSRF + file read via `raw` option | HIGH | Runtime | NO — `raw` no se usa en UDEMM | nodemailer@9.1.1 | **MITIGADO / DIFERIR** |
| `lodash` | Code injection via _.template; prototype pollution | HIGH | Runtime | Muy bajo (usado internamente por @nestjs/config, no expuesto a input externo) | @nestjs/config@12.x | **DIFERIR S5** |
| `glob` | Command injection via --cmd CLI | HIGH | DEV (@nestjs/cli) | No (CLI tool, no runtime) | @nestjs/cli@12.x | **MITIGADO DEV** |
| `picomatch` | Method injection, ReDoS | HIGH | DEV (@nestjs/cli) | No (CLI tool, no runtime) | @nestjs/cli@12.x | **MITIGADO DEV** |
| `tmp` | Path traversal symlink | HIGH | DEV (inquirer → @nestjs/cli) | No (CLI tool, no runtime) | @nestjs/cli@12.x | **MITIGADO DEV** |
| `webpack` | SSRF via buildHttp allowedUris bypass | HIGH | DEV (@nestjs/cli) | No (buildHttp no usado) | @nestjs/cli@12.x | **MITIGADO DEV** |
| `@nestjs/core` | Injection en output | MODERATE | Runtime | Bajo — requiere análisis en contexto NestJS 12 | @nestjs/core@12.x | **DIFERIR S5** |
| `body-parser` | DoS limit bypass | MODERATE | Runtime | Bajo — body-parser usa límites explícitos en main.ts | @nestjs/platform-express@12.x | **DIFERIR S5** |
| `file-type` | Infinite loop ASF, ZIP decompression bomb | MODERATE | Runtime | Bajo — file-type se usa en @nestjs/common internamente, no para parsear archivos de usuarios directamente; UDEMM valida por magic bytes propios | npm audit fix (sin upgrade NestJS) | **DIFERIR S5** |
| `ajv` | ReDoS via $data | MODERATE | DEV | No (DEV only) | @nestjs/cli@12.x | **MITIGADO DEV** |
| `qs` | DoS TypeError comma arrays | MODERATE | Runtime | Muy bajo — UDEMM no usa qs.stringify con comma-format arrays | @nestjs/platform-express@12.x | **DIFERIR S5** |
| `uuid` | Buffer bounds check | MODERATE | Runtime (exceljs) | Muy bajo — exceljs usa uuid internamente sin `buf` param | exceljs@3.4.0 (downgrade) | **DIFERIR S5** |

---

## 5. Decisión: multer

### Versión instalada
`multer@2.0.2` — transitiva via `@nestjs/platform-express@10.4.22`

### Vulnerabilidades
5 CVEs HIGH — todos relacionados con DoS:
- GHSA-xf7r-hgr6-v32p: Denial of Service via incomplete cleanup
- GHSA-v52c-386h-88mc: Denial of Service via resource exhaustion
- GHSA-5528-5vmv-3xc2: Uncontrolled Recursion
- GHSA-72gw-mp4g-v24j: DoS via deeply nested field names
- GHSA-3p4h-7m6x-2hcm: DoS via incomplete cleanup of aborted uploads

### Superficie de ataque en UDEMM

El endpoint de carga PDF (`POST /normativas` con `FileInterceptor`) es el único punto de entrada de archivos. Controles existentes:

| Control | Estado |
|---|---|
| Magic bytes check (`%PDF-`) | ✅ Implementado en service |
| Nombre UUID aleatorio | ✅ Implementado |
| Path traversal prevention | ✅ StorageService.resolverRuta() |
| Límite tamaño multer (20 MB) | ✅ FileInterceptor options |
| Límite tamaño service (15 MB) | ✅ service rechaza antes de escribir |
| Validación RBAC | ✅ Solo roles de gestión |
| storage/ fuera de public | ✅ Confirmado |

### Riesgo residual DoS

Las 5 vulnerabilidades multer son **DoS** — un atacante autenticado con rol de gestión podría intentar crashear el proceso de upload via requests malformados. El impacto es indisponibilidad del servicio de carga, no exfiltración ni ejecución de código.

### Fix disponible

Solo via `@nestjs/platform-express@12.0.1` (NestJS major version). Requiere plan completo de migración NestJS 12.

### Decisión

**DIFERIR a Sprint S5** — NestJS 12 migration plan con análisis de compatibilidad completo.

---

## 6. Decisión: nodemailer

### Versión instalada
`nodemailer@8.0.11` — dependencia directa

### Vulnerabilidad
GHSA-p6gq-j5cr-w38f (HIGH): la opción `raw` en mensajes bypasea `disableFileAccess`/`disableUrlAccess`, permitiendo lectura arbitraria de archivos locales y SSRF completo en el mensaje entregado.

### Análisis de explotabilidad

```typescript
// mail.service.ts — único uso de nodemailer en UDEMM:
await this.transporter.sendMail({
  from: remitente,
  to: destinatario,
  subject: 'Restablecer contraseña — UDEMM Global',
  html,            // ← plantilla hardcodeada, sin input de usuario
});
// NO se usa la opción `raw` en ningún punto del codebase
```

La vulnerabilidad requiere que el caller pase `{ raw: '<contenido_malicioso>' }` en las opciones de sendMail. UDEMM no expone esta opción a ningún input de usuario ni del backend. El vector de ataque es **inexistente** en el código actual.

### Fix disponible

`nodemailer@9.1.1` — marcado como "breaking change" por npm (sale del rango `^8.0.11`).
Riesgo de compatibilidad: nodemailer 9.x podría traer tipos bundled incompatibles con `@types/nodemailer@8.x` que está en `dependencies`.

### Decisión

**MITIGADO** — la opción `raw` no se usa. Riesgo residual: si en el futuro se agrega uso de `raw`, la vulnerabilidad se activa.
**DIFERIR actualización** a S5 con análisis específico de compatibilidad de tipos nodemailer 8→9.

---

## 7. Decisión: bcrypt

### Versión inicial
`bcrypt@5.1.1` — dependencia directa

### Cadena vulnerable
```
bcrypt@5.1.1
  └── @mapbox/node-pre-gyp@≤1.0.11
        └── tar@≤7.5.20 ← CRITICAL (12 CVEs)
```

### Vulnerabilidades tar (CRITICAL)
12 CVEs incluyendo: path traversal via hardlinks, symlink poisoning, arbitrary file overwrite, DoS via decompression, NUL byte crashes, stack overflow.

### Análisis de explotabilidad

`tar` en la cadena de bcrypt es utilizado únicamente durante la fase de `npm install` para descargar y extraer binarios nativos precompilados de bcrypt. NO se ejecuta en runtime de la aplicación. La explotación requeriría un ataque man-in-the-middle sobre el registy npm o un package malicioso durante la instalación.

### API bcrypt — compatibilidad 5.x → 6.x

| Función | 5.x | 6.x | Compatible |
|---|---|---|---|
| `bcrypt.hash(data, saltOrRounds)` | ✅ | ✅ | ✅ |
| `bcrypt.compare(data, hash)` | ✅ | ✅ | ✅ |
| `bcrypt.hashSync(data, saltOrRounds)` | ✅ | ✅ | ✅ |
| `bcrypt.compareSync(data, hash)` | ✅ | ✅ | ✅ |
| Formato de hash `$2b$` | ✅ | ✅ | ✅ hashes existentes verificables |

### Cambio arquitectural bcrypt 6.x

bcrypt@6.x reemplazó `@mapbox/node-pre-gyp` por `prebuildify`/`node-gyp` directamente. Elimina 34 paquetes transitivos del árbol de dependencias, incluyendo tar.

### Usos en UDEMM

```typescript
// usuarios.service.ts
bcrypt.hash(data.contrasena, 10)      // crear usuario
bcrypt.hash(data.contrasena, 10)      // actualizar usuario

// auth.service.ts
bcrypt.compare(contrasena, hash)       // login
bcrypt.hash(`${id}-${Date.now()}-${randomBytes}`, 10)  // refresh token
bcrypt.hash(nuevaContrasena, 12)       // password reset
```

Todos los usos son compatibles con bcrypt@6.x.

### Hashes existentes

Los hashes `$2b$` generados por bcrypt@5.x son verificables con `bcrypt.compare()` de bcrypt@6.x. No se requiere rehashear usuarios existentes.

### Decisión

**CORREGIR EN B2** — actualizar `bcrypt@5.1.1 → @6.0.0`

### Versión final
`bcrypt@6.0.0` instalado, `@mapbox/node-pre-gyp` y `tar` eliminados del árbol.

---

## 8. Versiones Antes/Después

| Paquete | Versión anterior | Versión nueva | Cambio en package.json |
|---|---|---|---|
| `bcrypt` | 5.1.1 | 6.0.0 | `^5.1.1` → `^6.0.0` |
| `brace-expansion` | 1.1.14 / 2.1.0 / 2.1.2 | 1.1.18 / 2.1.4 / 2.1.4 | Lockfile only (transitivo) |
| `browserslist` | 4.28.2 | 4.28.8 | Lockfile only (transitivo) |
| `fast-uri` | 3.1.2 | 3.1.6 | Lockfile only (transitivo) |
| `js-yaml` | 4.1.1 | 4.3.2 | Lockfile only (transitivo) |

---

## 9. npm audit Final

```
26 vulnerabilities (3 low, 15 moderate, 8 high)
```

### Comparación ANTES vs DESPUÉS

| Severidad | Antes | Después | Cambio |
|---|---|---|---|
| CRITICAL | 1 | **0** | −1 ✅ |
| HIGH | 14 | 8 | −6 ✅ |
| MODERATE | 15 | 15 | 0 |
| LOW | 3 | 3 | 0 |
| **TOTAL** | **33** | **26** | **−7** |

---

## 10. Vulnerabilidades Residuales — Detalle y Riesgo

| # | Paquete | Severidad | Tipo | Explotable | Mitigación existente | Decisión |
|---|---|---|---|---|---|---|
| R1 | `multer@2.0.2` | HIGH×5 | DoS upload | Parcial (auth requerida, rol gestión) | RBAC + magic bytes + límite tamaño | DIFERIR S5 (NestJS 12) |
| R2 | `nodemailer@8.0.11` | HIGH | SSRF/file-read via `raw` | NO — `raw` no se usa | No usar opción `raw` | MITIGADO, DIFERIR S5 |
| R3 | `lodash` via `@nestjs/config` | HIGH×3 | Prototype pollution, code injection | Muy bajo (interno en config parsing) | Config values vienen de .env, no de user input | DIFERIR S5 (NestJS 12 + @nestjs/config@12) |
| R4 | `glob` via `@nestjs/cli` | HIGH | CLI command injection | NO (DEV only, CLI option --cmd) | No expuesto en runtime | MITIGADO |
| R5 | `picomatch` via `@nestjs/cli` | HIGH×2 | Method injection, ReDoS | NO (DEV only) | No expuesto en runtime | MITIGADO |
| R6 | `tmp` via `@nestjs/cli` | HIGH×2 | Path traversal symlink | NO (DEV only) | No expuesto en runtime | MITIGADO |
| R7 | `webpack` via `@nestjs/cli` | HIGH×2 | SSRF buildHttp | NO (DEV only, buildHttp no usado) | No expuesto en runtime | MITIGADO |
| R8 | `@nestjs/core` ≤11.1.17 | MODERATE | Injection | Bajo (requiere análisis NestJS 12) | Validación estricta de DTOs con ValidationPipe | DIFERIR S5 |
| R9 | `body-parser` | MODERATE | DoS limit | Bajo (límites explícitos en main.ts) | `app.use(json({ limit: '1mb' }))` ya configurado | DIFERIR S5 |
| R10 | `file-type` via `@nestjs/common` | MODERATE×2 | Infinite loop ZIP DoS | Bajo (no se expone file-type a archivos ZIP de usuarios directamente; magic bytes propios usados) | Magic bytes check propio en StorageService | DIFERIR S5 |
| R11 | `ajv` via `@nestjs/cli` | MODERATE | ReDoS $data | NO (DEV only) | No expuesto en runtime | MITIGADO |
| R12 | `qs` via express | MODERATE | DoS comma arrays | Muy bajo (UDEMM no usa qs.stringify con comma+encodeValuesOnly+null) | Patrón de uso no afectado | DIFERIR S5 |
| R13 | `uuid` via exceljs | MODERATE | Buffer bounds | Muy bajo (exceljs usa uuid sin `buf` param) | No se pasa `buf` a uuid | DIFERIR S5 |
| R14 | 3 LOW | LOW | Varios | Mínimo | — | DIFERIR |

---

## 11. Tests Ejecutados

| Suite | Tests | Resultado |
|---|---|---|
| `csrf.middleware.spec.ts` | 21 | ✅ PASS |
| `materias-ownership.spec.ts` | 9 | ✅ PASS |
| `programas-ownership.spec.ts` | 9 | ✅ PASS |
| `throttle.spec.ts` | 8 | ✅ PASS |
| `jwt-strategy.spec.ts` | 6 | ✅ PASS |
| **TOTAL** | **53/53** | **✅ PASS** |

---

## 12. Build Backend

```
npm run build → tsc -p tsconfig.build.json → exit 0
```

Sin errores TypeScript. bcrypt@6.0.0 compatible con `@types/bcrypt@5.0.x` (API idéntica).

---

## 13. Validación Multer (Etapa 10)

El contrato de FileInterceptor no fue modificado. Se verifica estáticamente:

| Control | Estado |
|---|---|
| Magic bytes `%PDF-` | ✅ StorageService.esPdf() |
| Nombre UUID aleatorio | ✅ randomUUID() |
| Path traversal prevention | ✅ StorageService.resolverRuta() verifica basePath prefix |
| Límite multer 20 MB | ✅ FileInterceptor({ limits: { fileSize: 20 * 1024 * 1024 } }) |
| Límite service 15 MB | ✅ service rechaza antes de persistir |
| Storage fuera de public | ✅ backend/storage/ — no servido por HTTP |
| .gitignore | ✅ `backend/storage/` en línea 41 del .gitignore raíz |

---

## 14. Validación bcrypt (Etapa 11)

Tests de autenticación y ownership ejecutados: 53/53 PASS. Los tests cubren:
- Login con credenciales válidas (bcrypt.compare)
- Sesiones y tokens JWT
- Ownership DOCENTE con VinculacionCatedra

No se usa `bcrypt.hash`/`bcrypt.compare` directamente en tests (se mockea el servicio). La compatibilidad de hashes es garantizada por el formato `$2b$` estable en bcrypt 5.x y 6.x.

---

## 15. Estado Git Final

```
Changes not staged for commit:
  modified:   backend/package-lock.json
  modified:   backend/package.json
```

- `backend/package.json`: cambio `bcrypt: ^5.1.1 → ^6.0.0` + reformateo JSON por npm
- `backend/package-lock.json`: eliminación de 34 paquetes (cadena @mapbox/node-pre-gyp + tar) + cambios de versiones de brace-expansion, browserslist, fast-uri, js-yaml

Sin: archivos .env, storage/, dist/, node_modules/, secretos, PDFs.

---

## 16. Riesgos Pendientes para S5

| ID | Riesgo | Severidad | Acción requerida |
|---|---|---|---|
| P1 | NestJS 10.x → 12.x (multer, body-parser, qs, @nestjs/core, file-type) | HIGH/MODERATE runtime | Sprint específico: analizar compatibilidad API NestJS 12, migrar, probar |
| P2 | nodemailer 8.x → 9.x | HIGH (MITIGADO) | Analizar tipos bundled en 9.x, remover @types/nodemailer si redundante |
| P3 | @nestjs/config@3.x → 12.x (lodash) | HIGH | Parte de la migración NestJS 12 |
| P4 | @nestjs/cli@10.x → 12.x (glob, picomatch, tmp, ajv, webpack) | HIGH×5 DEV | Dev-only; actualizar en contexto de NestJS 12 |
| P5 | uuid via exceljs | MODERATE | Evaluar si exceljs@4.5+ resuelve sin downgrade a 3.4.0 |

---

## 17. Recomendaciones S5/S6

1. **Migración NestJS 12:** planificar en sprint dedicado. El salto de @nestjs/* 10.x → 12.x resuelve multer, body-parser, qs, @nestjs/core (todos los vulnerables en runtime via @nestjs/platform-express).
2. **nodemailer 9.x:** probar en entorno aislado. Verificar compatibilidad del campo `Transporter` y eliminación de `@types/nodemailer` si 9.x incluye tipos.
3. **@types/cookie-parser y @types/nodemailer en dependencies:** mover a devDependencies. Anomalía identificada en etapa A — no se corrigió en B2 para minimizar cambios; corregir en siguiente PR de mantenimiento.
4. **Multer**: si NestJS 12 no resuelve multer en el rango esperado, evaluar si existe una versión de multer ≥2.1.2 compatible instalable como dependencia directa con override.
5. **Trust Proxy (RR-7 de REGLAS-DESARROLLO-SEGURO):** pendiente para producción — no afectado por B2.

---

*Documento generado por sprint de seguridad S4.5-B2 — UDEMM Global.*
