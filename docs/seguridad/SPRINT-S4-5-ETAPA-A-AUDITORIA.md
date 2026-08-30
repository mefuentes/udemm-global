# SPRINT S4.5 — ETAPA A: AUDITORÍA DE DEPENDENCIAS Y CVEs

> **Naturaleza:** Solo diagnóstico. Cero modificaciones al código fuente,
> dependencias ni configuración. La Etapa A termina SIN MODIFICACIONES.

---

## Sección 1 — Estado Git

| Campo | Valor |
|---|---|
| Rama activa | `feature/security-hardening` |
| Estado working tree | Limpio (`nothing to commit, working tree clean`) |
| Sincronización remota | Up to date with `origin/feature/security-hardening` |
| Archivos modificados | Ninguno (verificado con `git status`) |

---

## Sección 2 — Inventario Backend: Dependencias Directas Runtime

| Paquete | Versión instalada | Rango declarado | Propósito | CVEs |
|---|---|---|---|---|
| `@nestjs/common` | 10.4.22 | ^10.2.5 | Core framework | ✅ (file-type transitivo) |
| `@nestjs/core` | 10.4.22 | ^10.2.5 | Core framework | ⚠️ MODERATE injection |
| `@nestjs/config` | 3.3.0 | ^3.1.0 | Configuración | ⚠️ (lodash transitivo HIGH) |
| `@nestjs/jwt` | 10.2.0 | ^10.2.0 | JWT auth | ✅ |
| `@nestjs/passport` | 10.0.3 | ^10.0.3 | Passport integration | ✅ |
| `@nestjs/platform-express` | 10.4.22 | ^10.2.5 | HTTP adapter Express | 🔴 (multer HIGH transitivo) |
| `@nestjs/throttler` | 6.5.0 | ^6.5.0 | Rate limiting | ✅ |
| `@prisma/client` | 5.22.0 | ^5.13.0 | ORM | ✅ |
| `bcrypt` | 5.1.1 | ^5.1.1 | Password hashing | 🔴 CRITICAL (tar transitivo) |
| `class-transformer` | 0.5.1 | ^0.5.1 | DTO transformación | ✅ |
| `class-validator` | 0.14.4 | ^0.14.1 | Validación DTOs | ✅ |
| `cookie-parser` | (instalado) | ^1.4.7 | Cookies | ✅ |
| `exceljs` | (instalado) | ^4.4.0 | Exportación Excel | ⚠️ (uuid MODERATE) |
| `helmet` | (instalado) | ^8.3.0 | HTTP headers seguridad | ✅ |
| `nodemailer` | 8.0.11 | ^8.0.11 | Envío correos | 🔴 HIGH SSRF + file read |
| `passport` | 0.6.0 | ^0.6.0 | Auth middleware | ✅ |
| `passport-jwt` | (instalado) | ^4.0.1 | JWT strategy | ✅ |
| `pdfkit` | 0.19.1 | ^0.19.1 | Generación PDF | ✅ |
| `reflect-metadata` | 0.1.14 | ^0.1.14 | Decoradores | ✅ |
| `rxjs` | (instalado) | ^7.8.2 | Observables | ✅ |

> **Nota:** `@types/cookie-parser` y `@types/nodemailer` aparecen en `dependencies`
> en lugar de `devDependencies` — anomalía a corregir en ETAPA B.

---

## Sección 3 — Inventario Backend: Dependencias Directas Desarrollo

| Paquete | Versión instalada | Propósito | CVEs dev |
|---|---|---|---|
| `@nestjs/cli` | 10.4.9 | CLI generación código | 🟡 (glob HIGH, picomatch HIGH, tmp HIGH, webpack SSRF, ajv MODERATE — dev only) |
| `@nestjs/schematics` | (transitivo de CLI) | Code scaffolding | 🟡 (transitivo ajv) |
| `@nestjs/testing` | 10.4.22 | Test utilities | ✅ |
| `@types/bcrypt` | 5.0.2 | Tipos TypeScript | ✅ |
| `@types/jest` | 29.5.14 | Tipos TypeScript | ✅ |
| `@types/multer` | (instalado) | Tipos TypeScript | ✅ |
| `@types/node` | 20.19.41 | Tipos TypeScript | ✅ |
| `@types/passport-jwt` | 3.0.13 | Tipos TypeScript | ✅ |
| `jest` | 29.7.0 | Test runner | ✅ |
| `prisma` | 5.22.0 | CLI migraciones | ✅ |
| `ts-jest` | 29.4.x | Jest TypeScript | ✅ |
| `ts-node` | 10.9.x | Ejecución TypeScript | ✅ |
| `typescript` | 5.9.3 | Compilador | ✅ |

---

## Sección 4 — Inventario Backend: Dependencias Transitivas Relevantes

### Cadena multer (RR-2)

```
backend (root project)
└── @nestjs/platform-express@10.4.22   [runtime — rango: ^10.2.5]
    └── multer@2.0.2                   ← VULNERABLE (5 CVEs HIGH)
```

**Verificado con:** `npm ls multer` y `npm explain multer`

multer es una dependencia **transitiva** de `@nestjs/platform-express`. No hay
endpoints de subida de archivos implementados en el backend actual. Sin embargo,
multer se instala y carga como parte de la plataforma Express de NestJS.

### Cadena tar → bcrypt (CRÍTICO)

```
backend (root project)
└── bcrypt@5.1.1                       [runtime — rango: ^5.1.1]
    └── @mapbox/node-pre-gyp@<=1.0.11
        └── tar@<=7.5.20               ← VULNERABLE (12 CVEs CRITICAL)
```

tar es utilizado por `@mapbox/node-pre-gyp` durante la compilación/instalación del
addon nativo de bcrypt. En entornos donde el binario `.node` es precompilado
(Docker con layer cacheado), la exposición runtime es reducida, pero todo
pipeline CI/CD que ejecute `npm install` queda expuesto.

---

## Sección 5 — Inventario Frontend: Dependencias Directas Runtime

| Paquete | Versión instalada | Rango declarado | Propósito | CVEs |
|---|---|---|---|---|
| `next` | 14.2.5 | `14.2.5` (pinned, sin ^) | Framework React SSR | 🔴 CRITICAL (33 CVEs) |
| `react` | 18.3.1 | `18.3.1` | UI framework | ✅ |
| `react-dom` | 18.3.1 | `18.3.1` | DOM rendering | ✅ |
| `jspdf` | (instalado) | `^4.2.1` | Generación PDF client | ✅ |

---

## Sección 6 — Inventario Frontend: Dependencias Directas Desarrollo

| Paquete | Versión instalada | Propósito | CVEs dev |
|---|---|---|---|
| `@types/node` | 20.14.2 | Tipos TypeScript | ✅ |
| `@types/react` | 18.3.3 | Tipos TypeScript | ✅ |
| `@types/react-dom` | 18.3.0 | Tipos TypeScript | ✅ |
| `autoprefixer` | 10.4.19 | Prefijos CSS | ✅ |
| `postcss` | 8.4.37 | Procesador CSS | 🟡 HIGH (vía next) |
| `tailwindcss` | 3.4.4 | Framework CSS | ✅ |
| `typescript` | 5.6.2 | Compilador | ✅ |

---

## Sección 7 — npm audit Backend: Resumen Ejecutivo

```
32 vulnerabilities
  3 low
 15 moderate
 13 high
  1 critical
```

**Vulnerabilidades runtime vs. dev:**

| Categoría | Runtime | Dev-only |
|---|---|---|
| Critical | 1 (tar/bcrypt) | 0 |
| High | 7 (multer, nodemailer, lodash, brace-exp, fast-uri, js-yaml, file-type) | 5 (glob, picomatch, tmp, webpack, + picomatch) |
| Moderate | 8 (nestjs/core, body-parser, qs, express, file-type, uuid, etc.) | 2 (ajv, nestjs/cli chain) |
| Low | ~3 | — |

**Paquetes con fix sin breaking changes** (`npm audit fix` suficiente): 3 grupos
**Paquetes que requieren `npm audit fix --force`** (breaking changes): 9 paquetes

---

## Sección 8 — npm audit Backend: Vulnerabilidades Runtime (detalle)

### CRITICAL

| Paquete vulnerable | Versión | GHSA | Descripción | Cadena |
|---|---|---|---|---|
| `tar` | ≤7.5.20 | GHSA-34x7-hfp2-rc4v | Arbitrary File Creation via Hardlink Path Traversal | bcrypt → @mapbox/node-pre-gyp → tar |
| `tar` | ≤7.5.20 | GHSA-8qq5-rm4j-mr97 | Arbitrary File Overwrite via Symlink Poisoning | ← idem |
| `tar` | ≤7.5.20 | GHSA-83g3-92jg-28cx | Arbitrary File Read/Write via Hardlink/Symlink Chain | ← idem |
| `tar` | ≤7.5.20 | GHSA-qffp-2rhf-9h96 | Hardlink Path Traversal via Drive-Relative Linkpath | ← idem |
| `tar` | ≤7.5.20 | GHSA-9ppj-qmqm-q256 | Symlink Path Traversal via Drive-Relative Linkpath | ← idem |
| `tar` | ≤7.5.20 | GHSA-vmf3-w455-68vh | PAX size override → file smuggling | ← idem |
| `tar` | ≤7.5.20 | GHSA-w8wr-v893-vjvp | Process crash via PAX numeric path confusion | ← idem |
| `tar` | ≤7.5.20 | GHSA-23hp-3jrh-7fpw | Decompression/parse DoS via unlimited input | ← idem |
| `tar` | ≤7.5.20 | GHSA-8x88-c5mf-7j5w | Negative entry size → infinite loop | ← idem |
| `tar` | ≤7.5.20 | GHSA-gvwx-54wh-qm9j | NUL byte in PAX path → uncaught exception DoS | ← idem |
| `tar` | ≤7.5.20 | GHSA-r292-9mhp-454m | Stack-overflow DoS via long-path tar | ← idem |
| `tar` | ≤7.5.20 | GHSA-r6q2-hw4h-h46w | Race Condition via Unicode Ligature (macOS) | ← idem |

**Fix disponible:** `npm audit fix --force` → instala `bcrypt@6.0.0` (breaking — major version change)

### HIGH — Runtime

| Paquete | Versión inst. | GHSA | Descripción | Cadena |
|---|---|---|---|---|
| `multer` | 2.0.2 | GHSA-xf7r-hgr6-v32p | DoS via incomplete cleanup | @nestjs/platform-express → multer |
| `multer` | 2.0.2 | GHSA-v52c-386h-88mc | DoS via resource exhaustion | ← idem |
| `multer` | 2.0.2 | GHSA-5528-5vmv-3xc2 | DoS via uncontrolled recursion | ← idem |
| `multer` | 2.0.2 | GHSA-72gw-mp4g-v24j | DoS via deeply nested field names | ← idem |
| `multer` | 2.0.2 | GHSA-3p4h-7m6x-2hcm | DoS via incomplete cleanup of aborted uploads | ← idem |
| `nodemailer` | 8.0.11 | GHSA-p6gq-j5cr-w38f | SSRF + arbitrary file read via `raw` message option | directo |
| `lodash` | ≤4.17.23 | GHSA-r5fr-rjxr-66jc | Code Injection via `_.template` imports | @nestjs/config → lodash |
| `lodash` | ≤4.17.23 | GHSA-f23m-r3pf-42rh | Prototype Pollution via `_.unset`/`_.omit` | ← idem |
| `lodash` | ≤4.17.23 | GHSA-xxjr-mmjv-4gpg | Prototype Pollution (variante adicional) | ← idem |
| `file-type` | 13.0.0–21.3.1 | GHSA-5v7r-6r5c-r473 | Infinite loop in ASF parser | @nestjs/common → file-type |
| `file-type` | 13.0.0–21.3.1 | GHSA-j47w-4g3g-c36v | ZIP Decompression Bomb DoS | ← idem |
| `brace-expansion` | ≤1.1.17/2.x | GHSA-3jxr-9vmj-r5cp | DoS via exponential expansion | transitivo múltiple |
| `brace-expansion` | ≤1.1.17/2.x | GHSA-mh99-v99m-4gvg | DoS via OOM (unbounded expansion) | ← idem |
| `brace-expansion` | ≤1.1.17/2.x | GHSA-rgw5-rvv9-x895 | DoS bypass CVE-2026-14257 mitigation | ← idem |
| `fast-uri` | 3.0.0–3.1.4 | GHSA-v2hh-gcrm-f6hx | Host confusion via backslash delimiter | transitivo |
| `fast-uri` | 3.0.0–3.1.4 | GHSA-7p8r-x3mc-p8w7 | Host confusion via backslash authority | ← idem |
| `fast-uri` | 3.0.0–3.1.4 | GHSA-4c8g-83qw-93j6 | Host confusion via failed IDN canonicalization | ← idem |
| `js-yaml` | 4.0.0–4.3.0 | GHSA-h67p-54hq-rp68 | Quadratic DoS in merge key handling | transitivo |
| `js-yaml` | 4.0.0–4.3.0 | GHSA-52cp-r559-cp3m | Quadratic CPU via merge-key chains | ← idem |
| `js-yaml` | 4.0.0–4.3.0 | GHSA-5p4m-2wfm-xmqj | Quadratic CPU in !!omap resolution | ← idem |

### MODERATE — Runtime

| Paquete | GHSA | Descripción |
|---|---|---|
| `@nestjs/core` ≤11.1.17 | GHSA-36xv-jgw5-4q75 | Improper Neutralization / Injection |
| `body-parser` ≤1.20.5 | GHSA-v422-hmwv-36x6 | DoS when invalid limit value disables size enforcement |
| `express` 4.21.x | (vía qs) | Dependencia de qs vulnerable |
| `qs` 6.11.1–6.15.1 | GHSA-q8mj-m7cp-5q26 | DoS — qs.stringify crashes con null en comma-format arrays |
| `uuid` <11.1.1 | GHSA-w5hq-g745-h8pq | Missing buffer bounds check en v3/v5/v6 |

---

## Sección 9 — npm audit Backend: Vulnerabilidades Dev-Only (detalle)

Estas vulnerabilidades residen en paquetes de desarrollo (`@nestjs/cli` y su árbol).
**No afectan el runtime de producción.** Se documentan para completitud.

| Paquete | Severidad | GHSA | Descripción | Ruta |
|---|---|---|---|---|
| `glob` 10.2.0–10.4.5 | HIGH | GHSA-5j98-mcp5-4vw2 | Command injection via `-c/--cmd` (CLI) | @nestjs/cli → glob |
| `picomatch` 4.0.0–4.0.3 | HIGH | GHSA-3v7f-55p6-f55p | Method Injection en POSIX Character Classes | @nestjs/cli → @angular-devkit/core → picomatch |
| `picomatch` 4.0.0–4.0.3 | HIGH | GHSA-c2c7-rcm5-vvqj | ReDoS via extglob quantifiers | ← idem |
| `tmp` ≤0.2.5 | HIGH | GHSA-52f5-9888-hmc6 | Arbitrary file/dir write via symlink `dir` param | @nestjs/cli → inquirer → external-editor → tmp |
| `tmp` ≤0.2.5 | HIGH | GHSA-ph9p-34f9-6g65 | Path traversal via unsanitized prefix/postfix | ← idem |
| `webpack` 5.49.0–5.104.0 | — | GHSA-8fgc-7cc6-rx7x | SSRF via buildHttp allowedUris bypass | @nestjs/cli → webpack |
| `webpack` 5.49.0–5.104.0 | — | GHSA-38r7-794h-5758 | SSRF + cache persistence via HTTP redirects | ← idem |
| `ajv` 7.x–8.17.1 | MODERATE | GHSA-2g4f-4pwh-qvx6 | ReDoS con opción `$data` | @nestjs/cli → @angular-devkit/core → ajv |

**Fix:** todos requieren `npm audit fix --force` → `@nestjs/cli@12.0.0` (breaking change)

---

## Sección 10 — npm audit Frontend: Resumen Ejecutivo

```
4 vulnerabilities
  0 low
  1 moderate
  2 high
  1 critical
```

Todos los 4 paquetes vulnerables son **transitivos de `next`** o directamente `next`.
El upgrade de next resuelve la mayoría.

---

## Sección 11 — npm audit Frontend: Vulnerabilidades (detalle)

### CRITICAL

| Paquete | Versión inst. | GHSA | Descripción |
|---|---|---|---|
| `next` | 14.2.5 | GHSA-7gfc-8cq8-jh5f | **Authorization Bypass** en Middleware |
| `next` | 14.2.5 | GHSA-f82v-jwr5-mffw | Authorization Bypass en Middleware (variante) |
| `next` | 14.2.5 | GHSA-4342-x723-ch2f | **SSRF** via Middleware Redirect |
| `next` | 14.2.5 | GHSA-89xv-2m56-2m9x | **SSRF** en Server Actions con custom servers |
| `next` | 14.2.5 | GHSA-p9j2-gv94-2wf4 | **SSRF** en rewrites via hostname controlado por atacante |
| `next` | 14.2.5 | GHSA-c4j6-fc7j-m34r | **SSRF** via WebSocket upgrades |
| `next` | 14.2.5 | GHSA-ffhc-5mcf-pf4q | **XSS** en App Router con CSP nonces |
| `next` | 14.2.5 | GHSA-gx5p-jg67-6x7h | **XSS** en beforeInteractive scripts |
| `next` | 14.2.5 | GHSA-ggv3-7p47-pfv8 | HTTP request smuggling en rewrites |
| `next` | 14.2.5 | GHSA-955p-x3mx-jcvp | Unauthenticated disclosure de Server Function endpoints |
| `next` | 14.2.5 | GHSA-gp8f-8m3g-qvj9 | Cache Poisoning |
| `next` | 14.2.5 | GHSA-g5qg-72qw-gw5v | Cache Key Confusion — Image Optimization API |
| `next` | 14.2.5 | GHSA-qpjv-v59x-3qc4 | Race Condition → Cache Poisoning |
| `next` | 14.2.5 | GHSA-3g8h-86w9-wvmq | Middleware/Proxy redirects → cache poisoning |
| `next` | 14.2.5 | GHSA-vfv6-92ff-j949 | Cache poisoning via RSC cache-busting collisions |
| `next` | 14.2.5 | GHSA-wfc6-r584-vfw7 | Cache poisoning en RSC responses |
| `next` | 14.2.5 | GHSA-68g3-v927-f742 | Cache confusion — response bodies |
| `next` | 14.2.5 | GHSA-4633-3j49-mh5q | Cache confusion — response bodies con UTF-8 inválido |
| `next` | 14.2.5 | GHSA-g77x-44xx-532m | DoS — Image Optimization |
| `next` | 14.2.5 | GHSA-7m27-7ghc-44w9 | DoS con Server Actions |
| `next` | 14.2.5 | GHSA-mwv6-3258-q52c | DoS con Server Components |
| `next` | 14.2.5 | GHSA-5j59-xgg2-r9c4 | DoS con Server Components (fix incompleto follow-up) |
| `next` | 14.2.5 | GHSA-9g9p-9gw9-jx7f | DoS via Image Optimizer remotePatterns |
| `next` | 14.2.5 | GHSA-h25m-26qc-wcjf | DoS via HTTP request deserialization (RSC) |
| `next` | 14.2.5 | GHSA-q4gf-8mx6-v5v3 | DoS con Server Components (variante) |
| `next` | 14.2.5 | GHSA-8h8q-6873-q5fj | DoS con Server Components (variante adicional) |
| `next` | 14.2.5 | GHSA-h64f-5h5j-jqjh | DoS — Image Optimization API (variante) |
| `next` | 14.2.5 | GHSA-m99w-x7hq-7vfj | DoS via Server Actions (App Router) |
| `next` | 14.2.5 | GHSA-4c39-4ccg-62r3 | Unbounded Server Action payload en Edge runtime |
| `next` | 14.2.5 | GHSA-3h52-269p-cp9r | Info exposure — dev server sin origin verification |
| `next` | 14.2.5 | GHSA-xv57-4mr9-wg8v | Content Injection en Image Optimization |
| `next` | 14.2.5 | GHSA-3x4c-7xq6-9pq8 | Unbounded next/image disk cache growth |
| `next` | 14.2.5 | GHSA-36qx-fr4f-26g5 | Middleware bypass via i18n (Pages Router) |

**Total next CVEs: 33**
**Fix disponible:** `npm audit fix --force` → instala `next@14.2.35`
(Mismo major 14.x — **no es un major version jump**)

### HIGH

| Paquete | Versión | GHSA | Descripción | Cadena |
|---|---|---|---|---|
| `postcss` | 8.4.37 | GHSA-qx2v-qp2m-jg93 | XSS via `</style>` en CSS Stringify | next → postcss |
| `postcss` | 8.4.37 | GHSA-6g55-p6wh-862q | Arbitrary file read via sourceMappingURL | ← idem |
| `postcss` | 8.4.37 | GHSA-fxqj-rqcc-2cmp | Fix incompleto de GHSA-6g55-p6wh-862q | ← idem |
| `postcss` | 8.4.37 | GHSA-r28c-9q8g-f849 | Path traversal via sourceMappingURL | ← idem |
| `nanoid` | ≤3.3.17 | GHSA-28wg-ghj8-5hjv | Infinite loop — generators non-secure | transitivo |
| `nanoid` | ≤3.3.17 | GHSA-2v37-7h3g-55p8 | Infinite loop — custom generators size=0 | ← idem |

### MODERATE

| Paquete | Versión | GHSA | Descripción |
|---|---|---|---|
| `dompurify` | ≤3.4.12 | GHSA-c2j3-45gr-mqc4 | CUSTOM_ELEMENT_HANDLING bypass |
| `dompurify` | ≤3.4.12 | GHSA-cmwh-pvxp-8882 | ALLOWED_ATTR pollution via setConfig() |
| `dompurify` | ≤3.4.12 | GHSA-vxr8-fq34-vvx9 | Trusted Types policy survives clearConfig() |
| `dompurify` | ≤3.4.12 | GHSA-gvmj-g25r-r7wr | SAFE_FOR_TEMPLATES bypass |
| `dompurify` | ≤3.4.12 | GHSA-55q2-fjhq-7xh7 | IN_PLACE hook removal → XSS |

---

## Sección 12 — npm outdated Backend

| Paquete | Instalado | Querido | Último | Tipo |
|---|---|---|---|---|
| `@nestjs/cli` | 10.4.9 | 10.4.9 | **12.0.0** | dev |
| `@nestjs/common` | 10.4.22 | 10.4.22 | **12.0.1** | runtime |
| `@nestjs/config` | 3.3.0 | 3.3.0 | **12.0.0** | runtime |
| `@nestjs/core` | 10.4.22 | 10.4.22 | **12.0.1** | runtime |
| `@nestjs/jwt` | 10.2.0 | 10.2.0 | **12.0.1** | runtime |
| `@nestjs/passport` | 10.0.3 | 10.0.3 | **12.0.0** | runtime |
| `@nestjs/platform-express` | 10.4.22 | 10.4.22 | **12.0.1** | runtime |
| `@nestjs/testing` | 10.4.22 | 10.4.22 | **12.0.1** | dev |
| `@prisma/client` | 5.22.0 | 5.22.0 | **6.19.3** | runtime |
| `@types/bcrypt` | 5.0.2 | 5.0.2 | 6.0.0 | dev |
| `@types/jest` | 29.5.14 | 29.5.14 | 30.0.0 | dev |
| `@types/node` | 20.19.41 | 20.19.43 | 26.4.0 | dev |
| `@types/passport-jwt` | 3.0.13 | 3.0.13 | 4.0.1 | dev |
| `bcrypt` | 5.1.1 | 5.1.1 | **6.0.0** | runtime |
| `class-validator` | 0.14.4 | 0.14.4 | 0.15.1 | runtime |
| `jest` | 29.7.0 | 29.7.0 | 30.4.2 | dev |
| `nodemailer` | 8.0.11 | 8.0.11 | **9.0.6** | runtime |
| `passport` | 0.6.0 | 0.6.0 | 0.7.0 | runtime |
| `pdfkit` | 0.19.1 | 0.19.1 | 0.20.1 | runtime |
| `prisma` | 5.22.0 | 5.22.0 | **6.19.3** | dev |
| `reflect-metadata` | 0.1.14 | 0.1.14 | 0.2.2 | runtime |
| `typescript` | 5.9.3 | 5.9.3 | 7.0.2 | dev |

> **Observación:** El ecosistema NestJS completo migró a la versión 12.x.
> Ningún paquete del rango declarado cubre esta nueva versión major.
> Prisma también tiene una nueva major disponible (5 → 6).

---

## Sección 13 — npm outdated Frontend

| Paquete | Instalado | Querido | Último | Tipo |
|---|---|---|---|---|
| `@types/node` | 20.14.2 | 20.14.2 | 26.4.0 | dev |
| `@types/react` | 18.3.3 | 18.3.3 | 19.2.18 | dev |
| `@types/react-dom` | 18.3.0 | 18.3.0 | 19.2.5 | dev |
| `autoprefixer` | 10.4.19 | 10.4.19 | 10.5.4 | dev |
| `next` | 14.2.5 | 14.2.5 | **16.3.3** | runtime |
| `postcss` | 8.4.37 | 8.4.37 | 8.5.26 | dev |
| `react` | 18.3.1 | 18.3.1 | 19.2.8 | runtime |
| `react-dom` | 18.3.1 | 18.3.1 | 19.2.8 | runtime |
| `tailwindcss` | 3.4.4 | 3.4.4 | 4.3.3 | dev |
| `typescript` | 5.6.2 | 5.6.2 | 7.0.2 | dev |

> **Observación:** La versión remediadora de los CVEs de Next.js es `14.2.35`
> (fix sin cambio de major). La versión `16.3.3` es la última disponible pero
> implica una migración mayor no relacionada con la remediación de CVEs.
> El fix de seguridad urgente es `14.2.5 → 14.2.35`, no `14.x → 16.x`.

---

## Sección 14 — Clasificación por Prioridad (A–E)

### Categoría A — CRÍTICO / Runtime / Remediación urgente

| # | Paquete | Actual | Target | CVEs | Complejidad fix |
|---|---|---|---|---|---|
| A-1 | `next` (frontend) | 14.2.5 | 14.2.35 | 33 (authz bypass, SSRF, XSS, cache poisoning, DoS) | Baja — mismo major 14.x |
| A-2 | `tar` vía `bcrypt` (backend) | tar ≤7.5.20 | bcrypt@6.0.0 | 12 (path traversal, file write, symlink, DoS) | Media — major version bcrypt |

### Categoría B — ALTO / Runtime / Planificación inmediata

| # | Paquete | Actual | Fix | CVEs | Complejidad |
|---|---|---|---|---|---|
| B-1 | `nodemailer` (backend) | 8.0.11 | 9.0.6 | 1 (SSRF + arbitrary file read) | Alta — major version jump, revisar API |
| B-2 | `lodash` vía `@nestjs/config` | ≤4.17.23 | @nestjs/config@12 | 3 (code injection, prototype pollution) | Muy alta — requiere NestJS 12 |
| B-3 | `multer` vía `@nestjs/platform-express` | 2.0.2 | plat-express@12 | 5 (DoS múltiple) | Muy alta — requiere NestJS 12 |
| B-4 | `file-type` vía `@nestjs/common` | 13.x–21.x | nestjs/common@12 | 2 (DoS, decompression bomb) | Muy alta — requiere NestJS 12 |
| B-5 | `body-parser`+`qs`+`express` | varios | plat-express@12 | 2 (DoS) | Muy alta — requiere NestJS 12 |
| B-6 | `brace-expansion` (backend) | ≤1.1.17/2.x | fix automático | 3 (DoS exponencial) | Baja — npm audit fix |
| B-7 | `fast-uri` (backend) | 3.0.0–3.1.4 | fix automático | 3 (host confusion) | Baja — npm audit fix |
| B-8 | `js-yaml` (backend) | 4.0.0–4.3.0 | fix automático | 3 (quadratic DoS) | Baja — npm audit fix |
| B-9 | `postcss` vía `next` (frontend) | 8.4.37 | 8.5.26 (vía next@14.2.35) | 4 (XSS, file read) | Baja — se resuelve con A-1 |
| B-10 | `nanoid` (frontend) | ≤3.3.17 | fix automático | 2 (infinite loop DoS) | Baja — npm audit fix |

### Categoría C — ALTO / Dev-only / Bajo riesgo producción

| # | Paquete | CVEs | Nota |
|---|---|---|---|
| C-1 | `glob` vía `@nestjs/cli` | 1 (cmd injection CLI) | Solo afecta desarrollo |
| C-2 | `picomatch` vía `@nestjs/cli` | 2 (method injection, ReDoS) | Solo afecta desarrollo |
| C-3 | `tmp` vía `@nestjs/cli` | 2 (symlink, path traversal) | Solo afecta desarrollo |
| C-4 | `webpack` vía `@nestjs/cli` | 2 (SSRF build-time) | Solo afecta desarrollo |
| C-5 | `ajv` vía `@nestjs/cli` | 1 (ReDoS) | Solo afecta desarrollo |

**Fix:** todos requieren `@nestjs/cli@12.0.0` (breaking change, abordable junto con NestJS 12)

### Categoría D — MODERADO / Runtime / Planificación normal

| # | Paquete | CVEs | Fix |
|---|---|---|---|
| D-1 | `@nestjs/core` injection | 1 | Requiere NestJS 12 |
| D-2 | `uuid` vía `exceljs` | 1 | Requiere exceljs@3.4.0 (downgrade — evaluar) |
| D-3 | `dompurify` (frontend) | 5 (XSS bypasses) | fix automático posible |

### Categoría E — BAJO / Análisis posterior

| # | Descripción |
|---|---|
| E-1 | 3 vulnerabilidades low en backend (no detalladas en salida npm audit human-readable) |

---

## Sección 15 — Análisis de Estrategias de Remediación

> **Ninguna estrategia es ejecutada en esta Etapa. Solo análisis.**

### Estrategia 1: Fixes sin breaking changes (`npm audit fix`)

**Paquetes cubiertos:** brace-expansion, fast-uri, js-yaml, nanoid, dompurify
**Backend impacto:** ~9 CVEs HIGH/MODERATE
**Frontend impacto:** ~2 CVEs HIGH (nanoid + dompurify parcial)
**Riesgo introducido:** Mínimo (cambios de minor/patch version)
**Requisitos previos:** Ninguno
**Validación:** Ejecutar test suite completo post-fix, `git diff --check`
**Recomendación:** Primera acción de ETAPA B

### Estrategia 2: Upgrade next 14.2.5 → 14.2.35

**CVEs resueltos:** 33 (todos los CVEs de next + postcss transitivos)
**Tipo de cambio:** Patch/minor dentro de 14.x — la versión 14.2.35 es la
versión remediada en el mismo major. No implica cambio de API.
**Nota crítica:** `next` está pinned en `14.2.5` (sin caret). El fix requiere
modificar `package.json` para cambiar `"next": "14.2.5"` → `"next": "14.2.35"`.
**Riesgo:** Bajo — mismo major, pero como la versión es exacta (pinned), toda
nueva funcionalidad debe ser probada en el frontend.
**Validación:** `npm run build` + revisión visual de la aplicación

### Estrategia 3: Upgrade nodemailer 8.0.11 → 9.0.6

**CVEs resueltos:** 1 (SSRF + arbitrary file read — GHSA-p6gq-j5cr-w38f)
**Tipo de cambio:** Major version jump (8 → 9)
**Riesgo:** La opción `raw` de nodemailer afectada no se usa actualmente en el
código base, pero el cambio de major puede introducir cambios en la API de
transporte, configuración de autenticación o manejo de attachments.
**Prerequisito:** Revisar CHANGELOG de nodemailer 9.x, verificar que las llamadas
actuales a `transporter.sendMail()` son compatibles.
**Validación:** Test de integración de envío de correos (recuperación de contraseña)

### Estrategia 4: Upgrade bcrypt 5.1.1 → 6.0.0

**CVEs resueltos:** 12 (todos los CVEs de tar a través de la cadena
bcrypt → @mapbox/node-pre-gyp → tar)
**Tipo de cambio:** Major version jump (5 → 6)
**Riesgo:** La API de bcrypt (`hash`, `compare`, `hashSync`, `compareSync`)
suele ser estable entre versiones. Verificar breaking changes en CHANGELOG.
**Nota:** Los hashes generados con bcrypt v5 son compatibles con bcrypt v6
(mismo algoritmo subyacente).
**Validación:** Tests de login (bcrypt.compare con hash existente)

### Estrategia 5: Migración NestJS 10 → 12 (mayor esfuerzo)

**CVEs resueltos:** multer (5), lodash (3), file-type (2), body-parser (1),
qs (1), express (1), @nestjs/core injection (1), + todos los de @nestjs/cli dev
**Tipo de cambio:** Major version de todo el ecosistema NestJS
**Riesgo:** Alto — breaking changes potenciales en:
- Decoradores y metadata reflection
- Módulos de plataforma (Express adapter)
- Módulos de testing
- CLI y schematics
- Comportamiento de pipes, guards, interceptors
**Prerequisito:** Leer NestJS v12 Migration Guide, auditar código base contra
breaking changes, preparar rama dedicada `feature/nestjs-12-migration`.
**Validación:** Suite completa de tests (53 tests actuales), smoke testing
de todos los endpoints, revisión de los 22 módulos de seguridad documentados.
**Nota:** Esta migración NO debe bloquearse por los CVEs de dev-only (C1-C5)
pero sí priorizarse por los CVEs runtime B-2 a B-5 y D-1.

### Estrategia 6: Actualización Prisma 5 → 6 (evaluación separada)

No hay CVEs asociados directamente a Prisma 5. El upgrade a v6 es una decisión
de mantenimiento/funcionalidad, no de seguridad. Evaluar en sprint dedicado.

---

## Sección 16 — Revisión RR-1 (Next.js) y RR-2 (multer)

### RR-1: Next.js 14.2.5 — Revisión de vigencia

**Registro previo (REGLAS-DESARROLLO-SEGURO.md §21):**
> RR-1: `next@14.2.5` tiene CVEs conocidos. Se evalúa upgrade a versión parcheada.
> Mientras tanto, evitar uso de Middleware para control de autorización crítico.

**Nuevos hallazgos de ETAPA A:**
- Se identificaron **33 CVEs** en next@14.2.5, incluyendo:
  - **CRITICAL authorization bypass** en Middleware (GHSA-7gfc-8cq8-jh5f, GHSA-f82v-jwr5-mffw)
  - **SSRF** via Middleware redirect, rewrites y Server Actions
  - **XSS** en App Router con CSP nonces y beforeInteractive scripts
  - **Cache poisoning** en múltiples vectores (RSC, Image Optimization, rewrites)
  - **HTTP request smuggling** en rewrites
  - **Disclosure** de Server Function endpoints no autenticado
- La versión remediadora es `next@14.2.35` (mismo major 14.x — no requiere migración de API).
- El fix está disponible con `npm audit fix --force` (fuera del rango declarado porque
  la versión está pinned con `"next": "14.2.5"` sin caret).

**Estado de RR-1:** 🔴 **VIGENTE — AGRAVADO**
- La cantidad y criticidad de CVEs supera lo estimado al crear el registro.
- La mitigación documental ("evitar Middleware para autorización crítica") sigue siendo
  válida pero **insuficiente** — hay CVEs que no dependen del uso de Middleware.
- La remediación (RR-1) tiene **prioridad A-1**: upgrade `next@14.2.35`.

### RR-2: multer transitivo — Revisión de vigencia

**Registro previo (REGLAS-DESARROLLO-SEGURO.md §21):**
> RR-2: `multer` es dependencia transitiva de `@nestjs/platform-express`. No hay
> endpoints de file upload implementados. Impacto actual: bajo.

**Nuevos hallazgos de ETAPA A:**
- Se confirmó la cadena: `@nestjs/platform-express@10.4.22 → multer@2.0.2`
- Se identificaron **5 CVEs HIGH** en multer@2.0.2:
  - DoS via incomplete cleanup (GHSA-xf7r-hgr6-v32p)
  - DoS via resource exhaustion (GHSA-v52c-386h-88mc)
  - DoS via uncontrolled recursion (GHSA-5528-5vmv-3xc2)
  - DoS via deeply nested field names (GHSA-72gw-mp4g-v24j)
  - DoS via incomplete cleanup of aborted uploads (GHSA-3p4h-7m6x-2hcm)
- La mitigación de "no file upload endpoints" sigue siendo válida para exploitabilidad.
- La remediación requiere `@nestjs/platform-express@12.0.1` → migración NestJS 12.

**Estado de RR-2:** 🟡 **VIGENTE — SIN CAMBIO DE CRITICIDAD**
- La evaluación de bajo impacto actual es correcta (sin endpoints de file upload).
- La remediación sigue acoplada a la migración NestJS 12 (Estrategia 5).
- El registro debe actualizarse con los 5 CVEs identificados.

---

## Sección 17 — Nuevos Riesgos Detectados (no documentados en RR actual)

Los siguientes riesgos no están en el registro RR-1 a RR-8 actual y deben
ser incorporados en ETAPA B:

| # | Paquete | Severidad | Descripción | Prioridad fix |
|---|---|---|---|---|
| NR-1 | `nodemailer@8.0.11` | HIGH | SSRF + arbitrary file read via `raw` option (GHSA-p6gq-j5cr-w38f) | B-1 |
| NR-2 | `lodash` vía `@nestjs/config` | HIGH | Code Injection + Prototype Pollution (3 CVEs) | B-2 |
| NR-3 | `tar` vía `bcrypt` | CRITICAL | 12 CVEs: path traversal, file write, symlink poisoning, DoS | A-2 |
| NR-4 | `file-type` vía `@nestjs/common` | MODERATE | DoS + decompression bomb (2 CVEs) | B-4 |
| NR-5 | `dompurify` (frontend) | MODERATE | XSS bypasses (5 CVEs) | D-3 |
| NR-6 | `postcss` vía `next` | HIGH | XSS + arbitrary file read (4 CVEs) | B-9 |
| NR-7 | `nanoid` (frontend) | HIGH | Infinite loop DoS (2 CVEs) | B-10 |
| NR-8 | `@nestjs/core` injection | MODERATE | Injection via downstream (GHSA-36xv-jgw5-4q75) | D-1 |
| NR-9 | `uuid` vía `exceljs` | MODERATE | Buffer bounds check en v3/v5/v6 (GHSA-w5hq-g745-h8pq) | D-2 |
| NR-10 | `brace-expansion` | HIGH | 3x DoS exponencial (GHSA-3jxr, GHSA-mh99, GHSA-rgw5) | B-6 |
| NR-11 | `fast-uri` | HIGH | 3x host confusion (GHSA-v2hh, GHSA-7p8r, GHSA-4c8g) | B-7 |
| NR-12 | `js-yaml` | HIGH | 3x quadratic DoS (GHSA-h67p, GHSA-52cp, GHSA-5p4m) | B-8 |

---

## Sección 18 — Propuesta ETAPA B: Plan de Remediación

> **ETAPA B no se ejecuta en esta auditoría.** La propuesta sirve como insumo
> para planificación.

### Sprint B-1: Fixes no disruptivos (estimado: 2–4 horas)

**Objetivo:** Resolver vulnerabilidades con `npm audit fix` (sin breaking changes)
y actualizar next@14.2.5 → 14.2.35.

```
Paso 1: frontend — next 14.2.5 → 14.2.35
  - Modificar package.json: "next": "14.2.35"
  - npm install
  - npm run build (verificar 0 errores)
  - npm audit (verificar 0 critical)

Paso 2: backend — npm audit fix (no --force)
  - Resuelve: brace-expansion, fast-uri, js-yaml
  - npm test (verificar 53/53 tests)
  - git diff --check

Paso 3: frontend — npm audit fix (no --force)
  - Resuelve: nanoid, dompurify (parcial)
  - npm run build
```

**Rama sugerida:** `feature/security-deps-b1`
**CVEs resueltos estimados:** 33 (next) + 9 (backend no-force) + 2 (frontend no-force) = ~44

### Sprint B-2: Upgrades de major version controlados (estimado: 1 día)

**Objetivo:** Actualizar nodemailer y bcrypt con revisión de breaking changes.

```
Paso 1: Leer CHANGELOG nodemailer 8→9, mapear cambios de API
Paso 2: Leer CHANGELOG bcrypt 5→6, confirmar compatibilidad de hashes
Paso 3: backend — actualizar nodemailer@9.0.6, bcrypt@6.0.0
Paso 4: npm test (verificar que auth tests siguen pasando)
Paso 5: smoke test flujo login + recuperación de contraseña
```

**Rama sugerida:** `feature/security-deps-b2`
**CVEs resueltos:** 1 (nodemailer) + 12 (tar/bcrypt) = 13

### Sprint B-3: Migración NestJS 10 → 12 (estimado: 1–2 semanas)

**Objetivo:** Resolver los CVEs de runtime acoplados al ecosistema NestJS.

```
Paso 0: Leer NestJS v12 Migration Guide oficial
Paso 1: Crear rama feature/nestjs-12-migration
Paso 2: Actualizar @nestjs/* en package.json (todos a ^12.x)
Paso 3: npm install — verificar conflictos de peer deps
Paso 4: Corregir breaking changes en módulos (revisar cada módulo)
Paso 5: npm test — objetivo 53/53 tests
Paso 6: Actualizar @nestjs/cli@12 (resuelve C-1 a C-5)
Paso 7: npm audit — verificar reducción de vulnerabilidades
Paso 8: Code review de seguridad en módulos de auth y autorización
```

**CVEs resueltos:** multer (5) + lodash (3) + file-type (2) + body-parser/qs/express (2)
+ @nestjs/core injection (1) + dev vulns C-1 a C-5 (~15) = ~28

### Sprint B-4: Evaluación y remediaciones restantes (estimado: 4 horas)

```
Paso 1: Evaluar exceljs@3.4.0 (downgrade para uuid fix) — verificar funcionalidad Excel
Paso 2: Si factible: actualizar exceljs → resuelve uuid CVE
Paso 3: Verificar dompurify — actualizar si fix disponible sin breaking changes
Paso 4: Mover @types/cookie-parser y @types/nodemailer a devDependencies
Paso 5: npm audit final — objetivo: 0 critical, 0 high runtime
```

### Resumen de CVEs por sprint

| Sprint | CVEs resueltos (aprox.) | Complejidad |
|---|---|---|
| B-1 | ~44 | Baja |
| B-2 | ~13 | Media |
| B-3 | ~28 | Alta |
| B-4 | ~5 | Baja |
| **Total** | **~90** | — |

---

## Verificación final de estado Git

```
git branch --show-current  →  feature/security-hardening
git status                 →  nothing to commit, working tree clean
```

Sin modificaciones en código fuente, dependencias ni configuración.

---

## ETAPA A COMPLETADA — SOLO DIAGNÓSTICO
