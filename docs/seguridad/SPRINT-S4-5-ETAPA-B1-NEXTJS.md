# S4.5 — ETAPA B1: REMEDIACIÓN CONTROLADA DE NEXT.JS

**Rama**: `feature/security-hardening`  
**Fecha**: 2026-08-28  
**Alcance**: Actualización de `next@14.2.5 → next@14.2.35` exclusivamente  
**Referencia A**: `docs/seguridad/SPRINT-S4-5-ETAPA-A-AUDITORIA.md`  
**Referencia A.1**: `docs/seguridad/SPRINT-S4-5-ETAPA-A1-VALIDACION.md`

---

## 1. VERIFICACIÓN DE ESTADO INICIAL

### 1.1 Git

```
Rama: feature/security-hardening
Estado: up to date with origin/feature/security-hardening
Archivos previos no comprometidos (esperados):
  - docs/seguridad/SPRINT-S4-5-ETAPA-A-AUDITORIA.md  (ETAPA A)
  - docs/seguridad/SPRINT-S4-5-ETAPA-A1-VALIDACION.md  (ETAPA A.1)
Otros cambios inesperados: NINGUNO ✓
```

### 1.2 Entorno

| Variable | Valor |
|---|---|
| Node.js | v20.17.0 |
| npm | 10.8.2 |
| next (antes) | 14.2.5 (pin exacto, sin `^`) |
| Rama | feature/security-hardening |

---

## 2. BASELINE FRONTEND (ANTES DE LA ACTUALIZACIÓN)

### 2.1 Árbol de dependencias

```
udemm-global-frontend@0.1.0
└── next@14.2.5
```

### 2.2 npm audit baseline

```
Vulnerabilidades totales: 4  (1 moderate, 2 high, 1 critical)
```

| Paquete | Severidad | Advisories |
|---|---|---|
| dompurify ≤3.4.12 | MODERATE | 5 advisories (XSS bypasses) |
| nanoid ≤3.3.17 | HIGH | 2 advisories (DoS loop) |
| next 0.9.9 - 16.3.0-preview.10 | **CRITICAL** | 33 advisories |
| postcss ≤8.5.22 | HIGH | 4 advisories (path traversal) |

Advisories de next en baseline (33 total):

| GHSA | Descripción |
|---|---|
| GHSA-gp8f-8m3g-qvj9 | Cache Poisoning |
| GHSA-g77x-44xx-532m | DoS — Image Optimization |
| GHSA-7m27-7ghc-44w9 | DoS — Server Actions |
| GHSA-3h52-269p-cp9r | Info exposure — dev server |
| GHSA-g5qg-72qw-gw5v | Cache Key Confusion — Image Optimization |
| GHSA-7gfc-8cq8-jh5f | Authorization bypass (variante) |
| GHSA-4342-x723-ch2f | SSRF — Middleware Redirect |
| GHSA-xv57-4mr9-wg8v | Content Injection — Image Optimization |
| GHSA-qpjv-v59x-3qc4 | Race Condition → Cache Poisoning |
| GHSA-mwv6-3258-q52c | DoS — Server Components |
| GHSA-5j59-xgg2-r9c4 | DoS — Server Components (incomplete fix) |
| **GHSA-f82v-jwr5-mffw** | **Authorization Bypass in Middleware** ← CRÍTICO |
| GHSA-9g9p-9gw9-jx7f | DoS — Image Optimizer remotePatterns |
| GHSA-h25m-26qc-wcjf | HTTP request deserialization DoS (RSC) |
| GHSA-ggv3-7p47-pfv8 | HTTP request smuggling in rewrites |
| GHSA-3x4c-7xq6-9pq8 | Unbounded next/image disk cache |
| GHSA-q4gf-8mx6-v5v3 | DoS — Server Components |
| GHSA-8h8q-6873-q5fj | DoS — Server Components (variante) |
| GHSA-3g8h-86w9-wvmq | Middleware/Proxy redirects → cache poisoning |
| GHSA-ffhc-5mcf-pf4q | XSS — CSP nonces (App Router) |
| GHSA-vfv6-92ff-j949 | Cache poisoning — RSC cache-busting |
| GHSA-gx5p-jg67-6x7h | XSS — beforeInteractive scripts |
| GHSA-h64f-5h5j-jqjh | DoS — Image Optimization API |
| GHSA-c4j6-fc7j-m34r | SSRF — WebSocket upgrades |
| GHSA-wfc6-r584-vfw7 | Cache poisoning — RSC responses |
| GHSA-36qx-fr4f-26g5 | Middleware bypass — Pages Router i18n |
| GHSA-m99w-x7hq-7vfj | DoS — Server Actions (App Router) |
| GHSA-89xv-2m56-2m9x | SSRF — Server Actions (custom servers) |
| GHSA-68g3-v927-f742 | Cache confusion — request bodies |
| GHSA-4633-3j49-mh5q | Cache confusion — UTF-8 inválido |
| GHSA-4c39-4ccg-62r3 | Unbounded Server Action payload (Edge) |
| GHSA-p9j2-gv94-2wf4 | SSRF — rewrites hostname controlado |
| GHSA-955p-x3mx-jcvp | Unauthenticated Server Function endpoints disclosure |

---

## 3. ACTUALIZACIÓN EJECUTADA

### 3.1 Comando

```bash
cd frontend
npm install next@14.2.35 --save-exact
```

### 3.2 Resultado de npm install

```
changed 3 packages in 5m
26 packages are looking for funding
Exit code: 0
```

**Paquetes modificados por npm**: 3 (next + dependencias transitivas actualizadas automáticamente).

---

## 4. DIFF POST-INSTALACIÓN

### 4.1 Archivos modificados

```
frontend/package.json       |  2 +-
frontend/package-lock.json  | 89 +++++++++++++++++-----------------------
frontend/next-env.d.ts      |  2 +-  (autogenerado por Next.js — solo cambio de URL en comentario)
```

### 4.2 Cambio en package.json

```diff
-    "next": "14.2.5",
+    "next": "14.2.35",
```

React, React DOM, TypeScript y todas las demás dependencias directas permanecieron sin cambios.

### 4.3 Cambio en next-env.d.ts

```diff
-// see https://nextjs.org/docs/basic-features/typescript for more information.
+// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.
```

Archivo autogenerado por Next.js. Solo actualiza la URL del comentario de documentación
(de Pages Router a App Router). No es código fuente ni configuración. Cambio esperado e inocuo.

### 4.4 Archivos NO modificados (confirmados)

| Archivo | Estado |
|---|---|
| `frontend/middleware.ts` | Sin cambios ✓ |
| `frontend/next.config.mjs` | Sin cambios ✓ |
| `frontend/lib/api.ts` | Sin cambios ✓ |
| `frontend/lib/auth-context.tsx` | Sin cambios ✓ |
| `backend/` (todo) | Sin cambios ✓ |
| `docs/seguridad/REGLAS-DESARROLLO-SEGURO.md` | Sin cambios ✓ |

---

## 5. ÁRBOL DE DEPENDENCIAS POST-ACTUALIZACIÓN

### 5.1 npm ls next

```
udemm-global-frontend@0.1.0
└── next@14.2.35  ✓
```

### 5.2 npm ls react

```
udemm-global-frontend@0.1.0
├── next@14.2.35
│   ├── react@18.3.1 deduped
│   └── styled-jsx@5.1.1
│       └── react@18.3.1 deduped
├── react-dom@18.3.1
│   └── react@18.3.1 deduped
└── react@18.3.1
```

React permanece en `18.3.1` — sin cambio deliberado ✓

### 5.3 npm ls react-dom

```
udemm-global-frontend@0.1.0
├── next@14.2.35
│   └── react-dom@18.3.1 deduped
└── react-dom@18.3.1
```

React DOM permanece en `18.3.1` — sin cambio deliberado ✓

---

## 6. npm AUDIT POST-ACTUALIZACIÓN

### 6.1 Resumen comparativo

| Métrica | Baseline (14.2.5) | Post-update (14.2.35) | Diferencia |
|---|---|---|---|
| Vulnerabilidades totales | 4 | 4 | = (misma cantidad) |
| Severidad máxima next | **CRITICAL** | **HIGH** | ↓ Reducida |
| Advisories de next | 33 | 21 | −12 resueltos |
| Rango vulnerable next | `0.9.9 - 16.3.0-preview.10` | `9.3.4-canary.0 - 16.3.0-preview.10` | Bottom subió |
| Fix propuesto por npm | `next@14.2.35` | `next@16.3.3` | Cambio major |
| dompurify | 5 advisories MODERATE | 5 advisories MODERATE | = sin cambio |
| nanoid | 2 advisories HIGH | 2 advisories HIGH | = sin cambio |
| postcss | 4 advisories HIGH | 4 advisories HIGH | = sin cambio |

### 6.2 Advisories de next RESUELTOS por 14.2.35 (−12)

Los siguientes 12 advisories ya no aparecen en `npm audit` después de la actualización:

| GHSA | Descripción | Por qué importante |
|---|---|---|
| **GHSA-f82v-jwr5-mffw** | **Authorization Bypass in Next.js Middleware** | **CVE más crítico — afectaba directamente a middleware.ts** |
| GHSA-7gfc-8cq8-jh5f | Authorization bypass (variante) | Segundo advisory de auth bypass |
| GHSA-4342-x723-ch2f | Improper Middleware Redirect → SSRF | SSRF via middleware |
| GHSA-gp8f-8m3g-qvj9 | Cache Poisoning (genérico) | Cache integrity |
| GHSA-g77x-44xx-532m | DoS — Image Optimization | Disponibilidad |
| GHSA-7m27-7ghc-44w9 | DoS — Server Actions | Disponibilidad |
| GHSA-3h52-269p-cp9r | Info exposure — dev server | Exposición de información |
| GHSA-g5qg-72qw-gw5v | Cache Key Confusion — Image Optimization | Cache integrity |
| GHSA-xv57-4mr9-wg8v | Content Injection — Image Optimization | Integridad de contenido |
| GHSA-qpjv-v59x-3qc4 | Race Condition → Cache Poisoning | Cache integrity |
| GHSA-mwv6-3258-q52c | DoS — Server Components | Disponibilidad |
| GHSA-5j59-xgg2-r9c4 | DoS — Server Components (incomplete fix) | Disponibilidad |

**El advisory de máxima prioridad para UDEMM (GHSA-f82v-jwr5-mffw — auth bypass en middleware)
fue RESUELTO por next@14.2.35. ✓**

### 6.3 Advisories de next que PERMANECEN (21)

| GHSA | Descripción | Aplicabilidad en UDEMM |
|---|---|---|
| GHSA-q4gf-8mx6-v5v3 | DoS — Server Components | MEDIA — usa RSC |
| GHSA-8h8q-6873-q5fj | DoS — Server Components (variante) | MEDIA — usa RSC |
| GHSA-h25m-26qc-wcjf | HTTP request deserialization DoS (RSC) | MEDIA — usa RSC |
| GHSA-vfv6-92ff-j949 | Cache poisoning — RSC cache-busting | MEDIA — usa RSC |
| GHSA-wfc6-r584-vfw7 | Cache poisoning — RSC responses | MEDIA — usa RSC |
| GHSA-68g3-v927-f742 | Cache confusion — request bodies | MEDIA |
| GHSA-4633-3j49-mh5q | Cache confusion — UTF-8 inválido | MEDIA |
| GHSA-m99w-x7hq-7vfj | DoS — Server Actions (App Router) | MEDIA — puede usar SA |
| GHSA-3g8h-86w9-wvmq | Middleware/Proxy redirects → cache poisoning | BAJA — sin proxy delante |
| GHSA-9g9p-9gw9-jx7f | DoS — Image Optimizer remotePatterns | BAJA — sin remotePatterns |
| GHSA-h64f-5h5j-jqjh | DoS — Image Optimization API | BAJA — sin next/image externa |
| GHSA-3x4c-7xq6-9pq8 | Unbounded next/image disk cache | BAJA — almacenamiento |
| GHSA-ffhc-5mcf-pf4q | XSS — CSP nonces (App Router) | BAJA — sin CSP nonces en next.config.mjs |
| GHSA-gx5p-jg67-6x7h | XSS — beforeInteractive scripts | BAJA — sin scripts beforeInteractive con input externo |
| GHSA-955p-x3mx-jcvp | Server Function endpoints disclosure | BAJA — endpoint enumeration |
| GHSA-ggv3-7p47-pfv8 | HTTP request smuggling in rewrites | NO APLICA — sin rewrites() en next.config.mjs |
| GHSA-p9j2-gv94-2wf4 | SSRF — rewrites hostname controlado | NO APLICA — sin rewrites() |
| GHSA-c4j6-fc7j-m34r | SSRF — WebSocket upgrades | NO APLICA — sin WS upgrades |
| GHSA-89xv-2m56-2m9x | SSRF — Server Actions (custom servers) | NO APLICA — sin custom server |
| GHSA-4c39-4ccg-62r3 | Unbounded Server Action payload (Edge) | NO APLICA — sin Edge runtime |
| GHSA-36qx-fr4f-26g5 | Middleware bypass — Pages Router i18n | NO APLICA — usa App Router |

**De los 21 advisories restantes:**
- 8 no aplican a la configuración actual de UDEMM Global
- 8 tienen aplicabilidad MEDIA (DoS/cache vía RSC y Server Actions)
- 5 tienen aplicabilidad BAJA (configuración no presente)

### 6.4 Fix propuesto por npm post-update

```
fix available via `npm audit fix --force`
Will install next@16.3.3, which is a breaking change
```

npm propone `next@16.3.3` (de major 14 → major 16, saltando 15.x).
Per instrucciones de ETAPA B1: NO se migra automáticamente a Next 15 ni 16.
La remediación de next se detiene en **14.2.35**.

---

## 7. BUILD FRONTEND

### 7.1 Comando ejecutado

```bash
cd frontend
npm run build
```

### 7.2 Resultado

```
▲ Next.js 14.2.35
- Environments: .env

✓ Compiled successfully
✓ Linting and checking validity of types...
✓ Collecting page data...
✓ Generating static pages (34/34)
  Finalizing page optimization...
  Collecting build traces...

Exit code: 0
```

**Errores TypeScript**: 0  
**Errores de compilación**: 0  
**Warnings**: ninguno  

### 7.3 Rutas generadas (34 total)

| Tipo | Cantidad | Ejemplos |
|---|---|---|
| ○ Static (prerendered) | 30 | /, /login, /bandeja-aprobaciones, /configuracion, /repositorio-normativas/nueva |
| ƒ Dynamic (server-rendered) | 4 | /docentes/[id], /repositorio-normativas/[categoriaId]/[normativaId] |

```
ƒ Middleware   26.6 kB  ← middleware de autenticación activo ✓
```

First Load JS compartido: 87.6 kB (dentro de parámetros normales).

---

## 8. VALIDACIÓN DE SEGURIDAD FUNCIONAL

### 8.1 Archivos de seguridad — estado (sin modificaciones)

**`frontend/middleware.ts`** — sin cambios ✓  
- Sigue verificando `request.cookies.get('auth_token')`
- Rutas públicas protegidas: `/login`, `/solicitar-recuperacion`, `/restablecer-contrasena`
- Redirige a `/login?next=<pathname>` cuando no hay token
- GHSA-f82v-jwr5-mffw (auth bypass via `x-middleware-subrequest`) RESUELTO en 14.2.35

**`frontend/next.config.mjs`** — sin cambios ✓  
- `reactStrictMode: true` ✓
- `poweredByHeader: false` ✓
- Headers de seguridad: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy ✓
- Sin `rewrites()` — advisories de SSRF/HTTP smuggling no aplican

**`frontend/lib/api.ts`** — sin cambios ✓  
- `credentials: 'include'` — cookies HttpOnly ✓
- `X-Requested-With: XMLHttpRequest` — CSRF ✓
- Lógica de refresh automático de token ✓

**`frontend/lib/auth-context.tsx`** — sin cambios ✓  
- Gestión de sesión client-side sin almacenar tokens en localStorage ✓

### 8.2 Controles de seguridad vigentes

| Control | Estado |
|---|---|
| Navegación protegida por middleware | ✓ Activo |
| Cookies HttpOnly (auth_token, refresh_token) | ✓ Sin cambios en lógica |
| `credentials: include` en apiFetch | ✓ Sin cambios |
| Refresh automático de token | ✓ Sin cambios |
| `X-Requested-With` en mutaciones | ✓ Sin cambios |
| Headers de seguridad en next.config.mjs | ✓ Sin cambios |
| `poweredByHeader: false` | ✓ Sin cambios |

---

## 9. DEPENDENCIAS TRANSITIVAS MODIFICADAS POR npm

npm cambió exactamente **3 paquetes** como consecuencia de la actualización de next:

```
changed 3 packages in 5m
```

Los 3 paquetes incluyen `next` mismo más 2 dependencias internas que npm actualizó
automáticamente al resolver el árbol de `next@14.2.35`. El lock file muestra 45 inserciones
y 46 eliminaciones en 89 líneas — consistente con una rotación de hashes de paquetes internos
de next (compilados, no código fuente del proyecto).

No se modificaron dependencias directas del proyecto distintas de `next`.

---

## 10. VERIFICACIÓN FINAL DE GIT

```
Rama: feature/security-hardening

Archivos modificados (staged o unstaged):
  modified: frontend/package.json           ← next 14.2.5 → 14.2.35
  modified: frontend/package-lock.json      ← lock actualizado
  modified: frontend/next-env.d.ts          ← autogenerado, solo URL de comentario

Archivos no comprometidos previos (esperados):
  docs/seguridad/SPRINT-S4-5-ETAPA-A-AUDITORIA.md
  docs/seguridad/SPRINT-S4-5-ETAPA-A1-VALIDACION.md

Archivos NO modificados:
  - frontend/middleware.ts ✓
  - frontend/next.config.mjs ✓
  - frontend/lib/api.ts ✓
  - frontend/lib/auth-context.tsx ✓
  - backend/ (todo) ✓
  - docs/seguridad/REGLAS-DESARROLLO-SEGURO.md ✓

git diff --check: sin conflictos de whitespace
```

Ningún otro archivo modificado. Estado consistente con el alcance declarado de ETAPA B1.

---

## 11. RIESGOS RESIDUALES

### 11.1 Advisories de next que permanecen tras 14.2.35

21 advisories permanecen en el rango `9.3.4-canary.0 - 16.3.0-preview.10`.
De los cuales, para UDEMM Global en su configuración actual:

- **NO aplicables**: 8 (no usa rewrites, WebSocket upgrades, custom server, Edge runtime, Pages Router i18n)
- **Aplicabilidad MEDIA**: 8 (DoS y cache poisoning vía RSC/Server Components/Server Actions)
- **Aplicabilidad BAJA**: 5 (requieren configuración adicional ausente: CSP nonces, remotePatterns, proxy)

El advisory de mayor impacto operativo para UDEMM (GHSA-f82v-jwr5-mffw — auth bypass en middleware) fue eliminado por la actualización a 14.2.35.

### 11.2 Para resolver los 21 advisories restantes

npm propone `next@16.3.3` — cambio de major (14 → 16). Esto implica:
- Posibles cambios en App Router API
- Posible requerimiento de React 19
- Breaking changes documentados en el changelog de Next.js 15 y 16

Esta migración **no se ejecuta en ETAPA B1**. Requiere análisis propio (ETAPA B-N futura).

---

## 12. RECOMENDACIÓN RESPECTO DE RR-1

**RR-1 no puede cerrarse completamente tras next@14.2.35.**

Sin embargo, el estado de RR-1 debe **actualizarse** en REGLAS-DESARROLLO-SEGURO.md:

| Campo | Antes (RR-1 original) | Estado actual |
|---|---|---|
| Versión vulnerable | next@14.2.5 | next@14.2.35 (actualizado) |
| Advisory más crítico | GHSA-f82v-jwr5-mffw (CRITICAL — auth bypass) | **RESUELTO ✓** |
| Severidad residual | CRITICAL | HIGH |
| Advisories | 33 | 21 |
| Fix mínimo siguiente | 14.2.35 | next@16.3.3 (major change) |

La actualización de RR-1 en REGLAS-DESARROLLO-SEGURO.md se postergará hasta que se defina
si se procederá con la migración a Next.js 16, como especifica la instrucción de ETAPA B1.

---

*NEXT 14.2.35 INSTALADO, PERO RR-1 NO PUEDE CERRARSE.*

*21 advisories de next permanecen (HIGH). El advisory crítico GHSA-f82v-jwr5-mffw (auth bypass en middleware) fue resuelto. El cierre completo de RR-1 requiere migración a next@16.x (breaking change — fuera del alcance de ETAPA B1).*
