# FASE S3 â€” Hardening HTTP, API, CORS, CSRF, Rate Limiting y Frontend

**Fecha de implementaciÃ³n:** 2026-08-27
**Rama:** `feature/security-hardening`
**Estado:** IMPLEMENTADA â€” S3.1 cerrado â€” 29/29 tests â€” builds OK

---

## 1. Resumen de Controles Implementados

| Control | Archivo(s) | Estado |
|---------|-----------|--------|
| Helmet 7.x (security headers) | `backend/src/main.ts` | IMPLEMENTADO |
| CORS hardening | `backend/src/main.ts` | IMPLEMENTADO |
| LÃ­mites de payload JSON (1 MB) | `backend/src/main.ts` | IMPLEMENTADO |
| Filtro global de excepciones (sanitizaciÃ³n de errores) | `src/common/filters/http-exception.filter.ts` | IMPLEMENTADO |
| Middleware CSRF (Origin + X-Requested-With) | `src/common/middleware/csrf.middleware.ts` | IMPLEMENTADO |
| Rate limiting global (100 req/min/IP) | `src/app.module.ts` | IMPLEMENTADO |
| Brute force login (5/min/IP) | `src/modules/auth/auth.controller.ts` | IMPLEMENTADO |
| Rate limit refresh (20/min/IP) | `src/modules/auth/auth.controller.ts` | IMPLEMENTADO S3.1 |
| Brute force recuperaciÃ³n (3/15min/IP) | `src/modules/auth/auth.controller.ts` | IMPLEMENTADO |
| Rate limit restablecer-contrasena (5/15min/IP) | `src/modules/auth/auth.controller.ts` | IMPLEMENTADO S3.1 |
| Cache-Control en endpoints de auth | `src/modules/auth/auth.controller.ts` | IMPLEMENTADO |
| ValidaciÃ³n FRONTEND_URL y STORAGE_NORMATIVAS_PATH | `src/config/env.validation.ts` | IMPLEMENTADO |
| Middleware de navegaciÃ³n Next.js | `frontend/middleware.ts` | IMPLEMENTADO |
| `X-Requested-With` en `apiFetch` | `frontend/lib/api.ts` | IMPLEMENTADO |
| Security headers en Next.js | `frontend/next.config.mjs` | IMPLEMENTADO |
| X-Powered-By removal | Helmet (automÃ¡tico) | IMPLEMENTADO |
| DocumentaciÃ³n confianza proxy (trust proxy) | `backend/src/main.ts` (comentario) | DOCUMENTADO |
| Upload security (magic bytes, path traversal) | `normativas.service.ts`, `storage.service.ts` | YA EXISTÃA (S2/previo) |
| Download security (`nosniff`, `no-store`) | `normativas.controller.ts` | YA EXISTÃA (S2/previo) |

---

## 2. Paquetes Instalados

```
helmet@^7.x
@nestjs/throttler@^6.5.0
```

Sin actualizaciones masivas de dependencias â€” se instalaron Ãºnicamente estos dos paquetes.

---

## 3. Helmet â€” Cabeceras de Seguridad HTTP

### ConfiguraciÃ³n en `main.ts`

```typescript
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    hsts: isProd
      ? { maxAge: 63_072_000, includeSubDomains: true }
      : false,
  }),
);
```

### Cabeceras que aplica Helmet (valores efectivos)

| Cabecera | Valor | PropÃ³sito |
|----------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Previene clickjacking |
| `X-XSS-Protection` | `0` | Desactiva el filtro XSS obsoleto |
| `Referrer-Policy` | `no-referrer` | No envÃ­a referrer en navegaciones |
| `X-DNS-Prefetch-Control` | `off` | Deshabilita prefetch DNS |
| `X-Download-Options` | `noopen` | IE: previene apertura directa |
| `X-Permitted-Cross-Domain-Policies` | `none` | Bloquea Adobe Flash cross-domain |
| `Origin-Agent-Cluster` | `?1` | Aislamiento de agentes de origen |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | HSTS â€” **solo en producciÃ³n** |
| `X-Powered-By` | *(eliminado)* | No revela que el backend usa Express/NestJS |

### Por quÃ© `crossOriginEmbedderPolicy: false`

`Cross-Origin-Embedder-Policy: require-corp` (el valor por defecto de Helmet) fuerza a que todos los recursos embebidos declaren `Cross-Origin-Resource-Policy`. Como el frontend (distinto origen en desarrollo) hace `fetch()` al API con CORS, activar COEP podrÃ­a generar incompatibilidades en escenarios de subida/descarga de archivos cross-origin. Sin COEP, el `Cross-Origin-Resource-Policy` del servidor no es aplicado por los navegadores.

### Por quÃ© HSTS solo en producciÃ³n

En desarrollo el backend corre sobre HTTP (`http://localhost:5000`). HSTS sobre HTTP es ignorado por los navegadores, pero su emisiÃ³n es tÃ©cnicamente incorrecta. En producciÃ³n (HTTPS) se activa con `max-age=63072000` (2 aÃ±os) e `includeSubDomains`.

**Nota sobre `includeSubDomains`:** esta directiva exige que *todos* los subdominios del dominio institucional tambiÃ©n sirvan exclusivamente HTTPS. Debe habilitarse en producciÃ³n Ãºnicamente despuÃ©s de confirmar institucionalmente que no existe ningÃºn subdominio sin TLS. Si hay subdominios HTTP-only activos, `includeSubDomains` los romperÃ¡ para los usuarios que hayan recibido el header HSTS. **No agregar `preload`** hasta que el dominio estÃ© registrado en la lista de precarga de navegadores (proceso separado, irreversible a corto plazo).

---

## 4. CORS â€” Hardening

### ConfiguraciÃ³n anterior (S2)

```typescript
app.enableCors({ origin: frontendUrl, credentials: true });
```

### ConfiguraciÃ³n S3

```typescript
app.enableCors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86_400,
});
```

**Cambios:**
- `methods`: lista explÃ­cita â€” no se aceptan mÃ©todos no usados (e.g., TRACE, CONNECT).
- `allowedHeaders`: `Content-Type` (JSON y FormData) + `X-Requested-With` (CSRF defense). Sin `Authorization` â€” los tokens van en cookies HttpOnly (S2).
- `exposedHeaders: ['Content-Disposition']`: necesario para que el frontend lea el nombre del archivo en descargas de Excel/PDF.
- `maxAge: 86_400`: el navegador cachea las respuestas de preflight por 24 horas, reduciendo requests OPTIONS repetidos.

---

## 5. CSRF â€” ProtecciÃ³n en profundidad

### Estrategia implementada (capas combinadas)

| Capa | Mecanismo | DÃ³nde |
|------|-----------|-------|
| 1 | `SameSite=Lax` en cookies | Ya existÃ­a (S2) |
| 2 | CORS con origen explÃ­cito | Ya existÃ­a (S2), hardened en S3 |
| 3 | ValidaciÃ³n de cabecera `Origin` | `CsrfMiddleware` (nuevo en S3) |
| 4 | Cabecera personalizada `X-Requested-With` | `CsrfMiddleware` + `apiFetch` (nuevo en S3) |

### `CsrfMiddleware` â€” lÃ³gica (S3.1: Origin obligatorio)

```typescript
// Solo aplica a mÃ©todos mutantes: POST, PUT, PATCH, DELETE
// Excluye: /auth/login, /auth/solicitar-recuperacion, /auth/restablecer-contrasena
// (no dependen de sesiÃ³n de cookie para autorizar)

if (!origin)                        â†’ 403 "Origin requerido"        // S3.1: antes permitÃ­a pasar
if (origin !== frontendOrigin)      â†’ 403 "Origin no permitido"
if (x-requested-with !== 'XMLHttpRequest') â†’ 403 "Header de seguridad requerido"
```

**Cambio en S3.1:** la versiÃ³n inicial de S3 permitÃ­a requests sin cabecera `Origin` (curl, Postman, clientes no-browser). A partir de S3.1, `Origin` es **obligatorio** en todos los endpoints mutantes no excluidos. No existe un caso de uso legÃ­timo en UDEMM Global donde un cliente no-browser realice operaciones con cookies de sesiÃ³n sin enviar `Origin`. La ausencia de `Origin` en un endpoint protegido ahora devuelve HTTP 403.

### Frontend â€” `apiFetch` actualizado

```typescript
const esMutante = !['GET', 'HEAD', 'OPTIONS'].includes(method);
const headersBase = {
  ...(esMutante ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
  ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
};
```

`X-Requested-With` se envÃ­a solo en mÃ©todos mutantes para evitar preflights CORS en requests GET (que no lo necesitan).

### `tentarRenovar()` actualizado

```typescript
fetch(`${API_URL}/auth/refresh`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
})
```

El refresh automÃ¡tico incluye la cabecera para que pase el `CsrfMiddleware`.

### Endpoints excluidos del check CSRF y por quÃ©

| Endpoint | Motivo |
|----------|--------|
| `POST /auth/login` | No autoriza por cookie de sesiÃ³n â€” establece la sesiÃ³n |
| `POST /auth/solicitar-recuperacion` | No autoriza por cookie; rate limited; sin efecto de CSRF real |
| `POST /auth/restablecer-contrasena` | Token en el cuerpo del request (no en cookie); CSRF no aplica |

---

## 6. Rate Limiting

### Arquitectura

- `ThrottlerModule.forRoot()` con lÃ­mite global: **100 req/IP/min** (API general)
- `ThrottlerGuard` registrado globalmente como `APP_GUARD`
- Endpoints crÃ­ticos tienen lÃ­mites especÃ­ficos vÃ­a `@Throttle()`

### LÃ­mites por endpoint

| Endpoint | LÃ­mite | Ventana | RazÃ³n |
|----------|--------|---------|-------|
| `POST /auth/login` | 5 req | 1 min | ProtecciÃ³n brute force de credenciales |
| `POST /auth/refresh` | 20 req | 1 min | Permite renovaciÃ³n activa en mÃºltiples pestaÃ±as sin abrir a abuso |
| `POST /auth/solicitar-recuperacion` | 3 req | 15 min | Prevenir spam de emails de recuperaciÃ³n |
| `POST /auth/restablecer-contrasena` | 5 req | 15 min | El token tiene una sola vida Ãºtil; limitar spray de tokens |
| Todos los demÃ¡s | 100 req | 1 min | LÃ­mite general de API |

### IP tracking

El `ThrottlerGuard` usa `req.ip` por defecto. En producciÃ³n detrÃ¡s de un proxy, activar Trust Proxy (ver Â§10) es necesario para que `req.ip` refleje la IP real del cliente.

### ConfiguraciÃ³n en cÃ³digo

```typescript
// app.module.ts â€” throttler nombrado 'default' para coincidir con la clave del decorador @Throttle()
ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])

// auth.controller.ts
@Throttle({ default: { limit: 5,  ttl:     60_000 } })  // login
@Throttle({ default: { limit: 20, ttl:     60_000 } })  // refresh (S3.1)
@Throttle({ default: { limit: 3,  ttl: 900_000   } })   // solicitar-recuperacion
@Throttle({ default: { limit: 5,  ttl: 900_000   } })   // restablecer-contrasena (S3.1)
```

**Nota tÃ©cnica â€” nombre del throttler (S3.1):** `@Throttle({ default: { ... } })` almacena los metadatos bajo la clave `THROTTLER_LIMIT + 'default'`. El guard los recupera usando `THROTTLER_LIMIT + namedThrottler.name`. Si el throttler se llama `'global'` (como estaba en S3), la clave no coincide y los lÃ­mites especÃ­ficos son ignorados silenciosamente, cayendo todos al lÃ­mite global de 100/min. El fix de S3.1 renombra el throttler a `name: 'default'` en `ThrottlerModule.forRoot()`.

---

## 7. LÃ­mites de Payload

```typescript
// main.ts â€” antes de cookieParser y Helmet
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
```

El backend se crea con `{ bodyParser: false }` para que NestJS no registre su propio parser, y luego se aplican los lÃ­mites explÃ­citos.

**ExcepciÃ³n:** las subidas de archivos usan `multer` con `memoryStorage()`, configurado en `normativas.controller.ts` con su propio lÃ­mite de `20 MB`. Multer no pasa por los body parsers JSON/URL-encoded.

---

## 8. Upload Security â€” Estado Preexistente (No Modificado)

Los siguientes controles ya estaban implementados antes de S3 y no requirieron cambios:

| Control | UbicaciÃ³n | DescripciÃ³n |
|---------|-----------|-------------|
| Magic bytes check | `normativas.service.ts` | `esPdf()` verifica `%PDF-` (bytes 0x25 0x50 0x44 0x46) |
| LÃ­mite de tamaÃ±o | Multer (controller): 20 MB; Service: 15 MB | Rechazo de archivos grandes |
| Nombre de archivo seguro | `normativas.service.ts` | `randomUUID()` â€” nunca usa el nombre original |
| Path traversal prevention | `storage.service.ts` `resolverRuta()` | Verifica que la ruta resuelta comience con `basePath + sep` |
| Tipo MIME no confiable | â€” | No se usa el Content-Type del cliente para determinar el tipo; solo magic bytes |

**Inconsistencia documentada:** el controller permite hasta 20 MB (multer) pero el service rechaza sobre 15 MB. El limite efectivo es 15 MB (el service rechaza antes de escribir a disco). No es un problema de seguridad, pero sÃ­ de coherencia.

---

## 9. Seguridad en Descarga de Archivos â€” Estado Preexistente (No Modificado)

El endpoint `GET /normativas/:id/archivo` ya tenÃ­a:
- `Cache-Control: private, no-store` â€” no se cachea en proxies ni navegador
- `X-Content-Type-Options: nosniff` â€” el navegador no infiere el tipo
- VerificaciÃ³n de autorizaciÃ³n (JwtAuthGuard + RolesGuard) antes de servir
- Path traversal prevention en `StorageService.resolverRuta()`

---

## 10. Cache-Control en Endpoints de AutenticaciÃ³n

Agregado `@Header('Cache-Control', 'no-store, private')` en:

| Endpoint | Motivo |
|----------|--------|
| `POST /auth/login` | La respuesta contiene datos del usuario; no debe cachearse |
| `POST /auth/refresh` | Rota tokens; cachear una respuesta vieja romperÃ­a la sesiÃ³n |
| `GET /auth/me` | Datos de sesiÃ³n activa del usuario; no deben quedar en cachÃ© |

---

## 11. Filtro Global de Excepciones (SanitizaciÃ³n de Errores)

### Archivo: `src/common/filters/http-exception.filter.ts`

**En producciÃ³n:**
- Errores HTTP conocidos (`HttpException`): expone `statusCode`, `message` (del tipo de excepciÃ³n), `timestamp`, `path`. No expone stack trace.
- Errores no manejados (`500`): expone solo `"Error interno del servidor"`. El stack trace se loguea en el servidor.

**En desarrollo:**
- Los errores `500` exponen el mensaje del error para facilitar el debugging.

### Prisma y errores internos

Sin este filtro, NestJS por defecto expone los mensajes de Prisma en algunos errores (ej: constraint violations, unique violations). Con el filtro, solo se expone el mensaje de la `HttpException` que el controlador lanza, no el error interno de Prisma.

---

## 12. ValidaciÃ³n de Variables de Entorno (env.validation.ts)

### Variables aÃ±adidas a la validaciÃ³n

**FRONTEND_URL (obligatoria):**
- Debe estar definida y no vacÃ­a
- Debe ser una URL vÃ¡lida con protocolo `http://` o `https://`
- El backend no arranca si estÃ¡ ausente o es invÃ¡lida (FAIL FAST)

**STORAGE_NORMATIVAS_PATH (opcional, validaciÃ³n de formato):**
- Si estÃ¡ definida, debe ser una ruta absoluta (Unix: `/...`; Windows: `C:\...`)
- No es obligatoria â€” tiene un valor por defecto en `StorageService`

---

## 13. Middleware de NavegaciÃ³n Next.js

### Archivo: `frontend/middleware.ts`

**PropÃ³sito:** guardia de navegaciÃ³n UX â€” redirige al login si no hay cookie `auth_token`. **No es un control de seguridad**: el backend siempre valida el token JWT en cada request.

**Rutas pÃºblicas (no redirigen):**
- `/login`
- `/solicitar-recuperacion`
- `/restablecer-contrasena`

**Comportamiento:**
- Usuario sin `auth_token` accediendo a ruta protegida â†’ redirect a `/login?next=<ruta>`
- Archivos estÃ¡ticos (`_next/static`, imÃ¡genes, favicon) â†’ siempre pasan sin verificar

**Nota sobre HttpOnly:** el middleware de Next.js corre en Edge Runtime (server-side) y puede leer todas las cookies del request, incluyendo las HttpOnly. La restricciÃ³n HttpOnly solo aplica a JavaScript del lado del cliente (browser).

---

## 14. Security Headers en Next.js Frontend

Configurados en `frontend/next.config.mjs`, aplicados a todas las rutas (`/(.*)`):

| Cabecera | Valor | PropÃ³sito |
|----------|-------|-----------|
| `X-DNS-Prefetch-Control` | `on` | Permite prefetch DNS para performance |
| `X-Frame-Options` | `DENY` | Previene que la app sea embebida en iframes |
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing en respuestas del frontend |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controla informaciÃ³n de referrer en links externos |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Restringe APIs de navegador no usadas |

**Content-Security-Policy (Next.js):** no implementada en S3. Next.js 14 App Router requiere nonces para CSP estricta (debido a scripts inline de hidrataciÃ³n de React). Implementar CSP con nonces requiere cambios en `layout.tsx` y la generaciÃ³n de nonces en el middleware. Queda como mejora futura.

---

## 15. Trust Proxy â€” DocumentaciÃ³n de ConfiguraciÃ³n

En producciÃ³n detrÃ¡s de un reverse proxy (nginx, load balancer), el backend recibe todos los requests con la IP del proxy (`req.ip = IP_del_proxy`). Esto afecta:
- Rate limiting (todos los usuarios comparten el mismo "bucket" de lÃ­mite)
- Logging de IPs en `Sesion.ip`
- `extraerIp()` en normativas.controller.ts

**CÃ³mo activar en producciÃ³n (solo si el proxy es de confianza):**

```typescript
// En main.ts, despuÃ©s de crear la app:
app.getHttpAdapter().getInstance().set('trust proxy', 1);
```

`trust proxy: 1` confÃ­a en el primer salto del header `X-Forwarded-For`. Si hay mÃºltiples proxies, ajustar el nÃºmero segÃºn la topologÃ­a.

**âš ï¸ Advertencia:** activar `trust proxy` sin un proxy confiable permite que clientes externos falsifiquen su IP enviando un header `X-Forwarded-For` arbitrario, eludiendo el rate limiting. No activar en desarrollo local.

---

## 16. Controles Fuera del Alcance de S3

Los siguientes Ã­tems **no se implementaron** en S3 por instrucciÃ³n explÃ­cita:

- ActualizaciÃ³n masiva de dependencias
- Cambio general del modelo RBAC
- RevisiÃ³n completa IDOR/BOLA
- TLS PostgreSQL / hardening de base de datos
- Backups y cifrado
- Antivirus institucional / SIEM
- MFA / SSO institucional
- Infraestructura productiva especÃ­fica (TLS certs, nginx config, etc.)

---

## 17. ValidaciÃ³n y Build (S3.1)

### Tests

```
npm test --runInBand --forceExit
```

| Suite | Tests | Resultado |
|-------|-------|-----------|
| `csrf.middleware.spec.ts` | 22 | PASS |
| `throttle.spec.ts` | 8 | PASS |
| **Total** | **29** | **0 fallos** |

Escenarios verificados:
- POST autenticado correcto (Origin + X-Requested-With vÃ¡lidos) â†’ 200
- POST sin Origin â†’ 403
- POST con Origin incorrecto â†’ 403
- POST sin X-Requested-With â†’ 403
- `POST /auth/refresh` sin Origin â†’ 403
- `POST /auth/logout` sin Origin â†’ 403
- `POST /auth/login` sin headers (skip CSRF) â†’ pasa
- `POST /auth/solicitar-recuperacion` sin headers (skip CSRF) â†’ pasa
- `POST /auth/restablecer-contrasena` sin headers (skip CSRF) â†’ pasa
- LÃ­mite refresh excedido (req 21/60s) â†’ 429
- LÃ­mite restablecer-contrasena excedido (req 6/15min) â†’ 429

### Build

- `cd backend && npm run build` â†’ **0 errores TypeScript**
- `cd frontend && npm run build` â†’ **0 errores â€” 34 pÃ¡ginas â€” Middleware compilado (27.5 kB)**
- Backend: `dist/src/common/filters/http-exception.filter.js` âœ“
- Backend: `dist/src/common/middleware/csrf.middleware.js` âœ“
- Frontend: `Æ’ Middleware` en la tabla de rutas del build âœ“

---

## 18. Archivos Modificados en S3

### Backend

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `package.json` | Dependencia | +`helmet`, +`@nestjs/throttler` |
| `src/main.ts` | Modificado | Helmet, CORS hardening, body limits, exception filter, trust proxy doc |
| `src/app.module.ts` | Modificado | ThrottlerModule, ThrottlerGuard global, CsrfMiddleware |
| `src/common/filters/http-exception.filter.ts` | NUEVO | SanitizaciÃ³n de errores en producciÃ³n |
| `src/common/middleware/csrf.middleware.ts` | NUEVO | ValidaciÃ³n Origin + X-Requested-With; S3.1: Origin obligatorio |
| `src/common/middleware/csrf.middleware.spec.ts` | NUEVO (S3.1) | 22 tests unitarios de CsrfMiddleware |
| `src/modules/auth/auth.controller.ts` | Modificado | Rate limiting, Cache-Control; S3.1: refresh 20/min, restablecer 5/15min |
| `src/modules/auth/throttle.spec.ts` | NUEVO (S3.1) | 8 tests de integraciÃ³n de rate limiting |
| `src/config/env.validation.ts` | Modificado | FRONTEND_URL (obligatoria), STORAGE_NORMATIVAS_PATH (opcional) |
| `.env.example` | Modificado | DocumentaciÃ³n STORAGE_NORMATIVAS_PATH |
| `tsconfig.json` | Modificado (S3.1) | Agregado `"jest"` a `types[]` para que ts-jest resuelva globals de Jest |

### Frontend

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `middleware.ts` | NUEVO | Guardia de navegaciÃ³n Next.js |
| `lib/api.ts` | Modificado | X-Requested-With en mutantes; tentarRenovar con header |
| `next.config.mjs` | Modificado | Security headers para todas las rutas |

### DocumentaciÃ³n

| Archivo | Tipo |
|---------|------|
| `docs/seguridad/FASE-S3-HARDENING-HTTP-API.md` | NUEVO |
