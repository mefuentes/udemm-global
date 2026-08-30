# S4.5 — ETAPA A.1: VALIDACIÓN DE VERSIONES CORREGIDAS Y PLAN DE REMEDIACIÓN

**Rama**: `feature/security-hardening`  
**Fecha**: 2026-08-28  
**Alcance**: SOLO DIAGNÓSTICO — sin modificación de paquetes ni código fuente  
**Referencia**: `docs/seguridad/SPRINT-S4-5-ETAPA-A-AUDITORIA.md`

---

## 1. METODOLOGÍA

Esta etapa valida técnicamente cada conclusión de ETAPA A mediante:

- Lectura directa de archivos fuente relevantes:
  - `backend/src/modules/normativas/normativas.controller.ts`
  - `backend/src/modules/auth/mail.service.ts`
  - `frontend/middleware.ts`
  - `frontend/next.config.mjs`
- Ejecución de `npm view` para verificar cadenas de dependencias y versiones disponibles
- Análisis advisory por advisory (GHSA) cruzado con el código fuente
- Verificación de versiones corregidas mínimas mediante el registry de npm
- Análisis de impacto en el código existente antes de cualquier modificación

**Restricción total en esta etapa**: ningún paquete fue modificado. No se ejecutó `npm audit fix`.

---

## 2. CORRECCIONES A ETAPA A

### 2.1 Error crítico: multer y endpoints de carga

ETAPA A afirmó:

> "No hay endpoints de subida de archivos implementados actualmente."

**ESTA AFIRMACIÓN ES INCORRECTA.**

Lectura directa de `backend/src/modules/normativas/normativas.controller.ts` confirma dos endpoints
que usan `FileInterceptor` con multer:

```typescript
// POST /normativas — crear normativa
@Post()
@Roles(...ROLES_GESTION)
@UseInterceptors(
  FileInterceptor('archivo', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB
  }),
)
crear(@Body() dto: CrearNormativaDto, @UploadedFile() archivo: Express.Multer.File, @Req() req: any) { ... }

// PATCH /normativas/:id — actualizar normativa
@Patch(':id')
@Roles(...ROLES_GESTION)
@UseInterceptors(
  FileInterceptor('archivo', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }),
)
actualizar(@Param('id') id, @Body() dto, @UploadedFile() archivo, @Req() req: any) { ... }
```

Ambos están protegidos por `@UseGuards(JwtAuthGuard, RolesGuard)` y requieren
`ROLES_GESTION = [ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, DECANO, RECTORADO]`.

Esto también estaba documentado en `REGLAS-DESARROLLO-SEGURO.md §13.3` y fue omitido en ETAPA A.

**Impacto de la corrección**: Los CVEs de multer son **runtime-explotables** en UDEMM Global
mediante un request multipart malformado enviado por un usuario autenticado con rol GESTION.
El riesgo no es teórico sino operativo real. La clasificación de ETAPA A subestimó el nivel de riesgo.

---

## 3. VALIDACIÓN: NEXT.JS

### 3.1 Versiones

| Concepto | Valor |
|---|---|
| Instalado | `next@14.2.5` (pin exacto, sin `^`) |
| Última versión estable 14.2.x | `next@14.2.35` (CONFIRMADO) |
| Última versión stable 14.x | `14.2.35` |
| Fix recomendado por npm audit | `npm audit fix --force` → `14.2.35` |
| Por qué "fuera del rango declarado" | `package.json` usa pin exacto `"14.2.5"` sin caret |
| Versiones estables 14.2.x disponibles | 14.2.0 → 14.2.35 (36 versiones estables) |

El salto `14.2.5 → 14.2.35` es una **actualización de parche** dentro del mismo major.minor.
No requiere migración a Next.js 15 ni 16.

### 3.2 Advisories aplicables (de npm audit frontend)

npm audit reporta **33 advisories** para el rango `next 0.9.9 - 16.3.0-preview.10`.
Los más relevantes para la versión `14.2.5` instalada:

| GHSA | Descripción | Severidad |
|---|---|---|
| GHSA-f82v-jwr5-mffw | **Authorization bypass in Middleware** (x-middleware-subrequest header) | CRITICAL |
| GHSA-7gfc-8cq8-jh5f | Authorization bypass — variante | CRITICAL |
| GHSA-4342-x723-ch2f | Middleware Redirect Handling → SSRF | HIGH |
| GHSA-qpjv-v59x-3qc4 | Race Condition → Cache Poisoning | HIGH |
| GHSA-gp8f-8m3g-qvj9 | Cache Poisoning | HIGH |
| GHSA-g77x-44xx-532m | DoS — Image Optimization API | HIGH |
| GHSA-7m27-7ghc-44w9 | DoS — Server Actions | HIGH |
| GHSA-ffhc-5mcf-pf4q | XSS via CSP nonces | HIGH |
| GHSA-ggv3-7p47-pfv8 | HTTP request smuggling in rewrites | HIGH |
| GHSA-c4j6-fc7j-m34r | SSRF via WebSocket upgrades | HIGH |
| GHSA-89xv-2m56-2m9x | SSRF en Server Actions (custom servers) | HIGH |
| GHSA-p9j2-gv94-2wf4 | SSRF en rewrites via hostname controlado | HIGH |
| GHSA-vfv6-92ff-j949 | Cache poisoning via RSC cache-busting | HIGH |
| GHSA-wfc6-r584-vfw7 | Cache poisoning en RSC responses | HIGH |
| GHSA-3g8h-86w9-wvmq | Middleware/Proxy redirects → cache poisoning | HIGH |
| GHSA-68g3-v927-f742 | Cache confusion — request bodies | HIGH |
| GHSA-4633-3j49-mh5q | Cache confusion — bodies con UTF-8 inválido | HIGH |
| GHSA-g5qg-72qw-gw5v | Cache Key Confusion — Image Optimization | HIGH |
| GHSA-3h52-269p-cp9r | Info exposure — dev server (origin verification) | MODERATE |
| GHSA-955p-x3mx-jcvp | Unauthenticated disclosure de endpoints Server Functions | MODERATE |
| (13 más) | DoS adicionales en Server Components/Image Optimizer | VAR |

Todos resueltos actualizando a **next@14.2.35** (mismo major.minor, patch transparente).

### 3.3 Análisis de impacto en código existente (upgrade a 14.2.35)

Se inspeccionaron los archivos clave del frontend:

**`frontend/middleware.ts`**  
Usa `NextRequest.cookies.get()`, `NextResponse.redirect()`, `NextResponse.next()`, y
exporta `config.matcher`. Esta API no cambió entre `14.2.5` y `14.2.35`.

El advisory **GHSA-f82v-jwr5-mffw** (auth bypass) afecta directamente este archivo.
La vulnerabilidad permite que un atacante remoto eluda la verificación del cookie
`auth_token` mediante un header especial `x-middleware-subrequest`. El upgrade a `14.2.25+`
corrige este comportamiento. Dado que UDEMM Global depende del middleware para proteger
todas las rutas no-públicas, este es el CVE de mayor prioridad del proyecto.

**`frontend/next.config.mjs`**  
Configura únicamente: `reactStrictMode: true`, `poweredByHeader: false`, y headers de
seguridad estáticos (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.).
Sin `rewrites()`, sin `redirects()`, sin opciones `experimental`. Ningún cambio de
comportamiento entre parches.

**App Router / React 18 / TypeScript**  
El upgrade es transparente. No se usan Server Actions avanzados ni WebSocket upgrades.
React permanece en `18.3.1` (sin cambio requerido). No hay cambios de tipos.

**Build**  
Compatible. El upgrade de `14.2.5` a `14.2.35` no agrega ni elimina features de build.

### 3.4 Conclusión Next.js

> **→ CONCLUSIÓN A: Se puede mantener Next.js 14.**

La corrección requerida es actualizar de `14.2.5` a **`14.2.35`** dentro del mismo
major.minor. No es necesario migrar a Next.js 15 ni 16. El upgrade no implica breaking
changes para el código existente de UDEMM Global. El CVE de authorization bypass
(GHSA-f82v-jwr5-mffw) afecta directamente el `middleware.ts` y debe corregirse con
**prioridad máxima**.

---

## 4. VALIDACIÓN: MULTER

### 4.1 Cadena de dependencias (confirmada mediante npm view)

```
backend
└── @nestjs/platform-express@10.4.22
    └── multer@2.0.2   ← pin exacto (no rango ^)
```

multer NO es dependencia directa del backend (`backend/package.json`).
Es forzado con pin exacto por `@nestjs/platform-express@10.4.22`.

### 4.2 Advisories

| GHSA | Descripción | Severidad |
|---|---|---|
| GHSA-xf7r-hgr6-v32p | DoS via incomplete cleanup | HIGH |
| GHSA-v52c-386h-88mc | DoS via resource exhaustion | HIGH |
| GHSA-5528-5vmv-3xc2 | DoS via uncontrolled recursion | HIGH |
| GHSA-72gw-mp4g-v24j | DoS via deeply nested field names | HIGH |
| GHSA-3p4h-7m6x-2hcm | DoS via incomplete cleanup of aborted uploads | HIGH |

**Rango vulnerable**: `≤ 2.1.1` — **Versión corregida mínima**: `2.2.0`

### 4.3 Exposición runtime en UDEMM Global

**CONFIRMADO: multer es runtime-explotable en UDEMM Global.**

`normativas.controller.ts` implementa dos endpoints multipart:
- `POST /normativas` — crear normativa con archivo PDF (max 20 MB)
- `PATCH /normativas/:id` — actualizar normativa con archivo opcional

Protección existente: `JwtAuthGuard + RolesGuard + @Roles(ROLES_GESTION)`.

El vector de ataque requiere un usuario autenticado con rol GESTION. Esto reduce la
superficie (no es un ataque anónimo), pero no elimina el riesgo: un atacante que comprometa
credenciales de un usuario con rol GESTION puede provocar un DoS al backend enviando
un payload multipart malformado (recursión descontrolada, cleanup incompleto, field names
muy profundos).

**Corrección de ETAPA A**: el riesgo debe reclasificarse de MEDIO a **ALTO**.

### 4.4 ¿Requiere NestJS 12 o se puede resolver antes?

**NestJS 12 NO es el único camino.** Versiones de @nestjs/platform-express verificadas:

| Versión | multer | express | Viable para fix multer |
|---|---|---|---|
| @10.4.22 | 2.0.2 (VULNERABLE) | 4.22.1 | ✗ |
| @11.1.29 | **2.2.0** (corregida) | 5.2.1 (Express 5) | ✓ (pero Express 5 = breaking) |
| @12.0.1 | **2.2.0** (corregida) | 5.2.1 (Express 5) | ✓ (pero Express 5 = breaking) |

El **mínimo necesario es `@nestjs/platform-express@11.x`**, no necesariamente `12.x`.
Sin embargo, ambas versiones (11.x y 12.x) incluyen Express@5, que es un cambio mayor
respecto a Express@4 (actual). Express@5 modifica `path-to-regexp@8.x`, el matching
de rutas, y el comportamiento de `req.params`.

### 4.5 Opciones de remediación (sin implementar aún)

**Opción A — Upgrade a @nestjs/platform-express@11.x**
- multer@2.2.0 ✓ | Express@5 (BREAKING) | NestJS core debe subir a 11.x coordinadamente

**Opción B — Upgrade a ecosistema @nestjs@12.x completo**
- multer@2.2.0 ✓ | Express@5 (BREAKING) | También resuelve lodash/@nestjs/config
- Mayor impacto, mayor coherencia

**Opción C — npm overrides (corrección quirúrgica transitoria)**  
Agregar en `backend/package.json`:
```json
"overrides": {
  "multer": "2.2.0"
}
```
- Fuerza multer@2.2.0 dentro del árbol de `@nestjs/platform-express@10.x`
- Express@4 se mantiene — **SIN breaking changes de Express@5**
- multer 2.0.2 y 2.2.0 son de la misma major (API-compatible)
- Riesgo: override no respaldado oficialmente por platform-express@10.x
- Útil como corrección transitoria mientras se planifica la migración a Express@5

### 4.6 Conclusión multer

- Riesgo real: **ALTO** (DoS runtime con usuario autenticado GESTION).
- Fix mínimo: multer@2.2.0 — alcanzable con `npm overrides` sin migrar a Express@5.
- La migración completa (Opción B) debe coordinarse con el fix de lodash/@nestjs/config.
- ETAPA A erró al calcular el riesgo por omitir la existencia de endpoints de carga.

---

## 5. VALIDACIÓN: NODEMAILER

### 5.1 Advisory

| GHSA | Descripción | Severidad | Rango vulnerable | Fix |
|---|---|---|---|---|
| GHSA-p6gq-j5cr-w38f | Opción `raw` bypasses `disableFileAccess`/`disableUrlAccess` → arbitrary file read + full-response SSRF | HIGH | `≤ 9.0.0` | `9.0.6` |

### 5.2 ¿Existe fix dentro de la serie 8.x?

**No.** La serie 8.x finaliza en `8.0.11`. No existe `8.0.12` ni una rama 8.x LTS.
El historial es: `8.0.0 → ... → 8.0.11 → 9.0.0 → 9.0.1 → ... → 9.0.6`.
Actualizar a `9.0.6` requiere cambiar la dependencia directa en `backend/package.json`.

### 5.3 Análisis de uso en UDEMM Global

Lectura completa de `backend/src/modules/auth/mail.service.ts`:

```typescript
this.transporter = nodemailer.createTransport({
  host: configService.get('SMTP_HOST') || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: ..., pass: ... },
});

await this.transporter.sendMail({
  from: remitente,
  to: destinatario,
  subject: 'Restablecer contraseña — UDEMM Global',
  html,         // plantilla HTML hardcodeada, ${nombre} y ${enlace} provienen del backend
});
```

Vectores del advisory **AUSENTES** en UDEMM Global:

| Vector vulnerable | Estado |
|---|---|
| Opción `raw` en sendMail | ❌ No se usa |
| `disableFileAccess: true` | ❌ No se configura |
| `disableUrlAccess: true` | ❌ No se configura |
| `attachment.path` con URLs remotas | ❌ No hay adjuntos |
| `jsonTransport` | ❌ No se usa |
| Contenido HTML controlado por usuario | ❌ HTML es una plantilla hardcodeada del backend |

### 5.4 Aplicabilidad real

**La vulnerabilidad GHSA-p6gq-j5cr-w38f NO es explotable en el código actual de UDEMM Global.**

La explotación requiere usar la opción `raw` junto con `disableFileAccess` o
`disableUrlAccess`. UDEMM Global usa solo transporte SMTP estándar para enviar
correos de recuperación de contraseña con una plantilla HTML fija.

Riesgo residual: si en el futuro se agregan adjuntos con rutas controladas por usuario,
o se activan las opciones de restricción de acceso, la vulnerabilidad se volvería relevante.
Actualizar a `9.0.6` es una corrección preventiva válida y de bajo riesgo.

### 5.5 Breaking changes nodemailer 8 → 9

Para el uso estándar de UDEMM (SMTP + sendMail):
- `createTransport({ host, port, secure, auth })` → API sin cambios
- `transporter.sendMail({ from, to, subject, html })` → API sin cambios
- Cambio relevante: `disableFileAccess` y `disableUrlAccess` pasan a ser `false` por
  defecto en 9.x (UDEMM no los usa → sin impacto)

**Impacto estimado en UDEMM**: MÍNIMO. `enviarRecuperacionContrasena()` debería funcionar
sin modificación de código tras el upgrade.

---

## 6. VALIDACIÓN: BCRYPT / TAR

### 6.1 Cadena exacta (confirmada mediante npm ls)

```
backend
└── bcrypt@5.1.1
    └── @mapbox/node-pre-gyp@1.0.11
        └── tar@6.2.1
```

### 6.2 Advisories de tar (12 total)

| GHSA | Tipo | Severidad |
|---|---|---|
| GHSA-34x7-hfp2-rc4v | Arbitrary File Create/Overwrite via Hardlink Path Traversal | CRITICAL |
| GHSA-8qq5-rm4j-mr97 | Arbitrary File Overwrite via Symlink Poisoning | CRITICAL |
| GHSA-83g3-92jg-28cx | Arbitrary File Read/Write via Hardlink Target Escape | CRITICAL |
| GHSA-qffp-2rhf-9h96 | Hardlink Path Traversal via Drive-Relative Linkpath | CRITICAL |
| GHSA-9ppj-qmqm-q256 | Symlink Path Traversal via Drive-Relative Linkpath | HIGH |
| GHSA-r6q2-hw4h-h46w | Race Condition via Unicode Ligature Collisions (macOS APFS) | HIGH |
| GHSA-vmf3-w455-68vh | PAX size override → tar parser differential (file smuggling) | HIGH |
| GHSA-w8wr-v893-vjvp | Process crash via PAX numeric path type confusion | HIGH |
| GHSA-23hp-3jrh-7fpw | Decompression/parse DoS via unlimited input | HIGH |
| GHSA-8x88-c5mf-7j5w | Negative tar entry size → infinite loop | HIGH |
| GHSA-gvwx-54wh-qm9j | Uncaught Exception DoS via NUL byte in PAX records | HIGH |
| GHSA-r292-9mhp-454m | Uncontrolled recursion via crafted long-path tar | HIGH |

Todos requieren que tar **extraiga** un archivo `.tar` malicioso controlado por el atacante.

### 6.3 ¿Es tar runtime o solo instalación?

**tar es exclusivamente instalación / build — NO es runtime.**

El rol de `@mapbox/node-pre-gyp` es compilar (o descargar pre-compilados) addons nativos
de Node.js durante `npm install`. En el caso de bcrypt, la secuencia es:

1. `npm install` → node-pre-gyp descarga o compila `bcrypt.node`
2. En runtime → `require('bcrypt')` carga `bcrypt.node` (addon nativo ya compilado)
3. **tar no se carga ni ejecuta en ningún momento durante la operación normal del backend**

Para explotar los CVEs de tar se requeriría que el servidor ejecute `npm install` en
producción contra una fuente controlada por el atacante (supply chain), o que se
comprometa el registro npm.

En un deployment estándar (imagen Docker pre-construida, o `npm install` solo en CI/CD),
los CVEs de tar son **NO explotables en producción**.

### 6.4 Upgrade bcrypt 5 → 6

`bcrypt@6.0.0` elimina la dependencia de `@mapbox/node-pre-gyp` (y por tanto de tar),
cambiando la estrategia de bindings nativos.

**Compatibilidad de API**: completa. Las funciones públicas no cambian:
- `bcrypt.hash(data, saltOrRounds)` — sin cambios
- `bcrypt.compare(data, encrypted)` — sin cambios
- `bcrypt.genSalt(rounds)` — sin cambios
- `bcrypt.hashSync / bcrypt.compareSync` — sin cambios

**Impacto en UDEMM**: MÍNIMO. El cambio es en las dependencias transitivas,
no en la API utilizada por el código fuente.

### 6.5 Conclusión bcrypt/tar

- tar@6.2.1: CRITICAL como severity, pero **NO explotable en runtime de producción**.
- El riesgo real es install-time (proceso de CI/CD, no la aplicación en ejecución).
- bcrypt@6.0.0 elimina la cadena con compatibilidad de API total.
- Prioridad: MEDIA (elimina ruido en auditorías y reduce superficie de supply chain).

---

## 7. VALIDACIÓN: LODASH / @NESTJS/CONFIG

### 7.1 Cadena de dependencias (confirmada)

```
@nestjs/config@3.3.0 → lodash@4.17.21   (runtime)
@nestjs/cli@10.4.9 → inquirer@8.2.6 → lodash@4.17.21   (dev-only)
```

### 7.2 Advisories de lodash

| GHSA | Descripción | Severidad |
|---|---|---|
| GHSA-r5fr-rjxr-66jc | Code Injection via `_.template` imports key names | HIGH |
| GHSA-f23m-r3pf-42rh | Prototype Pollution via `_.unset` y `_.omit` (array path bypass) | HIGH |
| GHSA-xxjr-mmjv-4gpg | Prototype Pollution en `_.unset` y `_.omit` | HIGH |

**Rango vulnerable**: `≤ 4.17.23`

Nota: `lodash@4.17.21` es la **última versión publicada** en la serie 4.x. No existe
`4.17.22` ni `4.17.23` en el registry npm. No hay ningún parche disponible en 4.x.

### 7.3 ¿Existe fix dentro de @nestjs/config 3.x o 4.x?

**No.** Historial de versiones relevante:

| Versión @nestjs/config | lodash | Estado |
|---|---|---|
| 1.1.6 — 4.0.2 | lodash@4.17.21 | VULNERABLE |
| **12.0.0** | **sin lodash** | CORREGIDA |

No existen versiones `5.x` a `11.x` de `@nestjs/config`. El salto es directo:
`4.0.2 → 12.0.0` (NestJS alineó su versioning con el core). El único fix
es migrar a `@nestjs/config@12.x`.

### 7.4 Aplicabilidad real en UDEMM Global

**La vulnerabilidad lodash NO es directamente explotable en el código actual de UDEMM Global.**

- **GHSA-r5fr-rjxr-66jc** (`_.template`): @nestjs/config puede usar template internamente
  para interpolación de variables de entorno en archivos `.env`. El input proviene de archivos
  del servidor controlados por el operador, NO de usuarios. Un atacante requeriría acceso
  previo al servidor para modificar el `.env`.

- **GHSA-f23m-r3pf-42rh / GHSA-xxjr-mmjv-4gpg** (`_.unset`, `_.omit`): @nestjs/config
  usa lodash para manipulación interna del objeto de configuración. El input no proviene
  de usuarios sino de variables de entorno del servidor.

- **@nestjs/cli → lodash**: herramienta de desarrollo exclusiva. No se ejecuta en producción.

- UDEMM Global no importa ni usa lodash directamente en ningún módulo de la aplicación.

### 7.5 Fix requerido

Para eliminar lodash de @nestjs/config:
- Actualizar a `@nestjs/config@12.0.0`
- Requiere alinear todo el ecosistema NestJS a la versión 12.x
  (core, common, platform-express, config, testing — simultáneamente)
- Es el cambio de mayor impacto en el proyecto

### 7.6 Conclusión lodash/@nestjs/config

- lodash@4.17.21: Vulnerable según GHSA, pero **NO directamente explotable** en el
  contexto de @nestjs/config de UDEMM Global (input no proviene de usuarios).
- La corrección requiere migración al ecosistema NestJS@12 (mayor impacto).
- @nestjs/cli: dev-only, sin impacto en producción.
- Prioridad de corrección: BAJA-MEDIA (sin exposición directa a usuario externo).

---

## 8. VALIDACIÓN: DEPENDENCIAS TRANSITIVAS

### 8.1 brace-expansion (backend)

| Campo | Detalle |
|---|---|
| Instalado | 1.x y 2.x (múltiples instancias) |
| Vulnerable | `≤ 1.1.17` y `2.0.0 - 2.1.3` |
| CVEs | GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 (DoS via expansión exponencial) |
| Severidad | HIGH |
| Fix | `npm audit fix` (compatible, sin breaking changes) |
| Nodos afectados | `brace-expansion`, `glob/brace-expansion`, `readdir-glob/brace-expansion` |
| Runtime | Indirecto (via herramientas CLI del build) |
| Aplicabilidad real | BAJA — solo si input externo llega a patrones glob |

### 8.2 fast-uri (backend)

| Campo | Detalle |
|---|---|
| Instalado | `3.x` |
| Vulnerable | `3.0.0 - 3.1.4` |
| CVEs | GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7, GHSA-4c8g-83qw-93j6 (host confusion via backslash) |
| Severidad | HIGH |
| Fix | `npm audit fix` (compatible → `3.2.0+`) |
| Runtime | Posible (ajv y otros utilizan fast-uri en parsing) |
| Aplicabilidad real | MEDIA — depende de si URIs con backslash llegan al validator |

### 8.3 js-yaml (backend)

| Campo | Detalle |
|---|---|
| Instalado | `4.x` |
| Vulnerable | `4.0.0 - 4.3.0` |
| CVEs | GHSA-h67p-54hq-rp68, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj (DoS cuadrático via merge-key) |
| Severidad | HIGH |
| Fix | `npm audit fix` (compatible → `4.3.1+`) |
| Runtime | Posible — @nestjs/config usa js-yaml si carga archivos `.yaml` |
| Aplicabilidad real | BAJA — UDEMM usa archivos `.env`, no YAML con input controlado por usuario |

### 8.4 nanoid (backend + frontend)

| Campo | Detalle |
|---|---|
| Instalado | `≤ 3.3.17` (ambos proyectos) |
| Vulnerable | `≤ 3.3.17` |
| CVEs | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 (loop infinito con `size ≤ 0`) |
| Severidad | HIGH |
| Fix | `npm audit fix` (compatible → `3.3.18+`) |
| Runtime | Sí — nanoid genera IDs en runtime |
| Aplicabilidad real | BAJA — explotación requiere llamar `nanoid(-1)` o `nanoid(0)`; UDEMM usa la API sin argumento (default 21 chars) |

### 8.5 postcss (frontend)

| Campo | Detalle |
|---|---|
| Instalado | `≤ 8.5.22` (interno en next) |
| Vulnerable | `≤ 8.5.22` |
| CVEs | GHSA-qx2v-qp2m-jg93 (XSS), GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 (path traversal via sourceMappingURL) |
| Severidad | HIGH |
| Fix | Se resuelve automáticamente actualizando `next@14.2.35` |
| Runtime | Build-time (PostCSS procesa CSS durante compilación) |
| Aplicabilidad real | BAJA en producción; MEDIA durante el proceso de build |

### 8.6 dompurify (frontend)

| Campo | Detalle |
|---|---|
| Instalado | `≤ 3.3.12` |
| Vulnerable | `≤ 3.4.12` |
| CVEs | GHSA-c2j3-45gr-mqc4, GHSA-cmwh-pvxp-8882, GHSA-vxr8-fq34-vvx9, GHSA-gvmj-g25r-r7wr, GHSA-55q2-fjhq-7xh7 (bypasses XSS en sanitización) |
| Severidad | MODERATE |
| Fix | `npm audit fix` (compatible → `3.4.13+`) |
| Runtime | Sí — sanitización de HTML en el cliente |
| Aplicabilidad real | MEDIA si hay HTML generado por usuarios; BAJA si todo el HTML es de fuentes internas |

### 8.7 file-type (backend, transitive via @nestjs/common)

| Campo | Detalle |
|---|---|
| Instalado | `13.0.0 - 21.3.1` |
| Dependiente | `@nestjs/common` |
| CVEs | GHSA-5v7r-6r5c-r473 (infinite loop ASF parser), GHSA-j47w-4g3g-c36v (ZIP decompression bomb) |
| Severidad | MODERATE |
| Fix | `npm audit fix` (compatible) |
| Runtime | Sí — @nestjs/common usa file-type internamente |
| Aplicabilidad real | BAJA — explotación requiere enviar archivos ASF o ZIP malformados al servidor |

---

## 9. MATRIZ DE REMEDIACIÓN DEFINITIVA

### GRUPO 1 — Corrección compatible de bajo riesgo (`npm audit fix`, sin breaking changes)

| ID | Paquete | Severidad | Fix mínimo | Runtime | Aplicabilidad real | Acción |
|---|---|---|---|---|---|---|
| G1-1 | brace-expansion | HIGH | Compatible | Indirecto | BAJA | `npm audit fix` en backend |
| G1-2 | fast-uri | HIGH | `3.2.0+` | Posible | MEDIA | `npm audit fix` en backend |
| G1-3 | js-yaml | HIGH | `4.3.1+` | Posible | BAJA | `npm audit fix` en backend |
| G1-4 | nanoid (backend) | HIGH | `3.3.18+` | Sí | BAJA | `npm audit fix` en backend |
| G1-5 | nanoid (frontend) | HIGH | `3.3.18+` | Sí | BAJA | `npm audit fix` en frontend |
| G1-6 | file-type | MODERATE | Compatible | Sí | BAJA | `npm audit fix` en backend |
| G1-7 | dompurify | MODERATE | `3.4.13+` | Sí | MEDIA | `npm audit fix` en frontend |

### GRUPO 2 — Corrección que requiere actualización controlada de dependencia directa

| ID | Paquete | Instalado | Severidad | Fix mínimo | Runtime | Aplicabilidad real | Acción |
|---|---|---|---|---|---|---|---|
| G2-1 | next | `14.2.5` | CRITICAL | `14.2.35` | Sí | **ALTA** — auth bypass en middleware | Actualizar next → `14.2.35` (mismo major.minor) |
| G2-2 | nodemailer | `8.0.11` | HIGH | `9.0.6` | Sí | **NO explotable** actualmente | Actualizar → `9.0.6` (precautorio; API compatible) |
| G2-3 | bcrypt | `5.1.1` | (tar CRITICAL) | `6.0.0` | NO (install-only) | BAJA en producción | Actualizar → `6.0.0` (elimina cadena tar; API compatible) |

### GRUPO 3 — Corrección que requiere salto major / migración significativa

| ID | Paquete | Instalado | Severidad | Fix | Runtime | Aplicabilidad real | Acción |
|---|---|---|---|---|---|---|---|
| G3-1 | multer (via platform-express) | `2.0.2` | HIGH | `2.2.0` | Sí | **ALTA** — DoS runtime con auth GESTION | Opción C (overrides) como transitorio; migración NestJS@12 como definitivo |
| G3-2 | lodash (via @nestjs/config) | `4.17.21` | HIGH | sin fix 4.x | Sí | **NO directo** — config del servidor | Migración `@nestjs/config@12.x` coordinada con G3-3 |
| G3-3 | Ecosistema NestJS | `10.x` | HIGH | `12.x` | Sí | Abarca G3-1 + G3-2 + body-parser + qs | Migración NestJS@12 (planificada en ETAPA B posterior) |

### GRUPO 4 — Dependencia build/dev sin exposición runtime real

| ID | Paquete | Severidad | Runtime | Acción |
|---|---|---|---|---|
| G4-1 | tar (via bcrypt → node-pre-gyp) | CRITICAL | NO (install-time only) | Aceptar o eliminar vía bcrypt@6.0.0 |
| G4-2 | ajv (via @nestjs/cli → @angular-devkit) | MODERATE | NO (dev-only) | Aceptar o actualizar @nestjs/cli |
| G4-3 | glob (via @nestjs/cli) | HIGH | NO (dev-only) | Idem G4-2 |
| G4-4 | picomatch (via @nestjs/cli) | HIGH | NO (dev-only) | Idem G4-2 |
| G4-5 | webpack (via @nestjs/cli) | HIGH | NO (dev-only) | Idem G4-2 |
| G4-6 | tmp / inquirer (via @nestjs/cli) | HIGH | NO (dev-only) | Idem G4-2 |
| G4-7 | postcss (via next — build) | HIGH | NO (build-time) | Se resuelve con next@14.2.35 |

### GRUPO 5 — Riesgo temporal aceptable con justificación documentada

| ID | Paquete | Justificación | Condición de reclasificación |
|---|---|---|---|
| G5-1 | body-parser, qs (via platform-express) | Misma causa raíz que G3-1; requiere Express@5 | Reclasificar cuando se ejecute migración NestJS@12 |
| G5-2 | express (via platform-express) | Ídem G5-1 | Ídem G5-1 |
| G5-3 | @nestjs/core (via platform-express) | Dependiente de G3-3 | Reclasificar con migración NestJS@12 |
| G5-4 | uuid (via exceljs) | MODERATE — parámetro `buf` interno a exceljs, no controlado por usuario | Reclasificar si exceljs expone `buf` a input externo |

---

## 10. PRIORIZACIÓN PARA ETAPA B

Las siguientes acciones deben ejecutarse en este orden:

| Prioridad | Acción | Paquetes | Impacto CVEs | Riesgo ejecución |
|---|---|---|---|---|
| **1 — URGENTE** | Actualizar `next@14.2.35` | next, postcss (bundled) | 33 advisories (1 CRITICAL auth bypass) | **MUY BAJO** — parche transparente, mismo major.minor |
| **2 — ALTA** | `npm audit fix` en frontend | dompurify, nanoid | 7 advisories (MODERATE/HIGH) | **MUY BAJO** — actualizaciones compatibles |
| **3 — ALTA** | `npm audit fix` en backend | brace-expansion, fast-uri, js-yaml, nanoid, file-type | ~10 advisories (HIGH) | **MUY BAJO** — actualizaciones compatibles |
| **4 — MEDIA** | multer fix via npm overrides | multer@2.2.0 | 5 advisories HIGH runtime | **BAJO** — misma API 2.x, fix quirúrgico |
| **5 — MEDIA** | Actualizar `nodemailer@9.0.6` | nodemailer | 1 advisory HIGH (baja aplicabilidad) | **BAJO** — API SMTP compatible |
| **6 — MEDIA** | Actualizar `bcrypt@6.0.0` | bcrypt, cadena tar | 12 advisories CRITICAL (install-only) | **BAJO** — API compatible |
| **7 — BAJA** | Planificar migración NestJS@12 | @nestjs/config, platform-express, core, común | Múltiples HIGH + G5 | **ALTO** — Express@5, breaking changes, requiere planificación separada |

### Impacto total estimado de las prioridades 1–6 (antes de migración NestJS)

- Frontend: de 4 vulnerabilidades a 0
- Backend (sin NestJS migration): ~14 vulnerabilidades resueltas, ~18 pendientes
  (las ~18 pendientes corresponden a las dependencias del ecosistema NestJS@10.x — G3 + G5)

---

## 11. ACTUALIZACIONES PROPUESTAS AL REGISTRO DE RIESGOS

Los siguientes registros de ETAPA A requieren corrección en ETAPA B:

**RR-2 (multer)**: Actualizar "Sin endpoints de carga activos" → "Endpoints de carga
confirmados en `normativas.controller.ts` (POST y PATCH)". Actualizar Probabilidad:
BAJA → **MEDIA**. Actualizar Impacto: MEDIO → **ALTO**.

**NR-1 (next.js)**: Confirmar que el fix es `14.2.35` dentro de `14.2.x`.
Agregar nota: el advisory GHSA-f82v-jwr5-mffw (auth bypass) afecta directamente
al `middleware.ts` de UDEMM Global — elevar a riesgo de prioridad CRÍTICA.

---

## 12. VERIFICACIÓN FINAL DE GIT

```bash
git status
```

Resultado esperado: único archivo modificado es el presente documento.
Ningún `package.json`, `package-lock.json`, ni archivo de código fue modificado en esta etapa.

---

## 13. RESUMEN EJECUTIVO

| Área | Conclusión A.1 | Corrección de ETAPA A |
|---|---|---|
| next@14.2.5 | Actualizar a 14.2.35 (mismo major.minor, sin migración a 15+) | CONFIRMADA |
| multer@2.0.2 | Riesgo ALTO real (endpoints de carga activos); fix vía overrides o migración | ETAPA A ERRÓ — riesgo subestimado |
| nodemailer@8.0.11 | No exploitable actualmente; upgrade precautorio a 9.0.6 | CONFIRMADA (upgrade path) |
| tar@6.2.1 | NO runtime — install-only; CRITICAL no aplica a producción | CONFIRMADA |
| lodash@4.17.21 | No directamente exploitable; fix requiere NestJS@12 | CONFIRMADA |
| Transitivas (6) | Resolubles con npm audit fix sin breaking changes | CONFIRMADA |
| NestJS@12 migration | Necesaria a largo plazo; no urgente por ausencia de explotación directa | NUEVA CONCLUSIÓN |

---

*S4.5 — ETAPA A.1 COMPLETADA / VALIDACIÓN DE DIAGNÓSTICO — SIN REMEDIACIÓN*
