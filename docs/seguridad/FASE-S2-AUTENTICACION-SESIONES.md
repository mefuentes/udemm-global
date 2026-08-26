# FASE S2 — Autenticación, Sesiones y Cookies HttpOnly

**Fecha de implementación:** 2026-08-25 / 2026-08-26  
**Rama:** `feature/security-hardening`  
**Estado:** APROBADA

---

## 1. Resumen de Hallazgos Corregidos

| ID | Hallazgo | Severidad | Estado |
|----|----------|-----------|--------|
| A-04 | Access token en localStorage | Alta | CORREGIDO |
| A-05 | Logout sin invalidación server-side del access token | Alta | CORREGIDO |
| M-03 | Refresh token sin rotación | Alta | CORREGIDO |
| B-04 | Tokens activos no invalidados al restablecer contraseña | Media | CORREGIDO |
| A-02 | CORS sin restricción de origen | Alta | PARCIALMENTE CORREGIDO (ver §5) |

---

## 2. Mecanismo de Revocación del Access Token

### Problema original
`JwtStrategy.validate()` solo verificaba firma y expiración. Un JWT emitido durante el login seguía siendo válido después de logout hasta agotar su tiempo de vida (`JWT_EXPIRES_IN`), independientemente de que la sesión hubiera sido cerrada en el servidor.

### Solución implementada: `sesionId` en el payload JWT

#### Modelo `Sesion` (existente en schema.prisma)
```
Sesion { id, usuarioId, ip, userAgent, activo, fechaCreacion, fechaActualizacion }
```

#### Migración aplicada
`20260826000001_add_sesion_id_to_token_refresh` — agrega `sesionId String?` (FK nullable) a `TokenRefresh`, relacionando cada token con la sesión que lo originó.

#### Flujo de login
1. Se crea un registro `Sesion` en la BD con `activo = true`, IP y UserAgent del cliente.
2. El `id` de ese registro se incrusta en el payload del access JWT como `sesionId`.
3. Se crea un `TokenRefresh` vinculado al mismo `sesionId`.

#### JwtStrategy.validate() — verificación en cada request protegido
```typescript
if (payload.sesionId) {
  const sesion = await this.prisma.sesion.findUnique({ where: { id: payload.sesionId } });
  if (!sesion || !sesion.activo) {
    throw new UnauthorizedException('Sesión inválida o revocada');
  }
}
```
Cada request autenticado realiza una consulta a la BD. Si la sesión fue revocada, el request retorna `401` inmediatamente, aunque el JWT no haya expirado.

---

## 3. Comportamiento por Operación

### Logout (`POST /auth/logout`)
1. Se localiza el `TokenRefresh` por la cookie `refresh_token` (igualdad exacta del hash almacenado).
2. Se obtiene su `sesionId` (FK al registro `Sesion`).
3. En paralelo: `TokenRefresh.activo = false` + `Sesion.activo = false`.
4. El controller limpia ambas cookies (`auth_token`, `refresh_token`).

**Resultado:** El siguiente request con el JWT que identifica esa sesión falla en `JwtStrategy.validate()` → 401. **Revocación inmediata**, sin esperar expiración del JWT.

**Sesiones múltiples:** Cada sesión tiene su propio `Sesion.id` en el payload. Cerrar sesión desde un dispositivo no afecta las sesiones activas del mismo usuario en otros dispositivos.

### Restablecimiento de contraseña (`POST /auth/restablecer-contrasena`)
Dentro de la transacción Prisma existente, se agregan dos operaciones:
```typescript
this.prisma.tokenRefresh.updateMany({ where: { usuarioId, activo: true }, data: { activo: false } }),
this.prisma.sesion.updateMany({ where: { usuarioId, activo: true }, data: { activo: false } }),
```
**Resultado:** Todos los access tokens emitidos para ese usuario dejan de funcionar inmediatamente. No hay ventana entre la invalidación de tokens y la revocación de sesiones.

### Refresh token (`POST /auth/refresh`)
1. Se localiza el `TokenRefresh` actual por igualdad exacta del hash.
2. Se invalida el anterior (`activo = false`).
3. Se emite un nuevo access JWT con el **mismo `sesionId`** (la sesión continúa activa).
4. Se crea un nuevo `TokenRefresh` vinculado al mismo `sesionId`.

La sesión (`Sesion.activo = true`) no se modifica durante el refresh — solo rotan los tokens.

---

## 4. Funcionamiento del Refresh Token con bcrypt

### Cómo se genera
```typescript
const token = await bcrypt.hash(
  `${usuarioId}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`,
  10
);
```
El resultado del hash bcrypt (cadena `$2b$10$...`) es el valor almacenado en `TokenRefresh.token` **y también** el valor enviado como cookie al cliente.

### Cómo se localiza (consulta Prisma)
```typescript
await this.prisma.tokenRefresh.findUnique({ where: { token: refreshTokenCookie } });
```
Es una búsqueda por **igualdad exacta** (`=`) sobre el campo `token`. No se utiliza `bcrypt.compare()`.

### Implicación técnica
El hash bcrypt funciona aquí como generador de cadenas pseudoaleatorias de formato uniforme, no como función de verificación de contraseñas. La seguridad proviene de:
- El input contiene `crypto.randomBytes(16)` (128 bits de entropía real).
- El output (hash bcrypt) es único y no predecible sin el input.

**Desventaja:** bcrypt agrega latencia por las iteraciones de costo (factor 10), que es inapropiada para generación de tokens. Este punto queda registrado como candidato de mejora en S3 (reemplazar por `crypto.randomBytes(32).toString('hex')` almacenado directamente).

### Comportamiento con múltiples sesiones
Cada login crea un `TokenRefresh` independiente. En la BD conviven N registros activos con tokens distintos (uno por sesión del usuario). La búsqueda por `findUnique` sobre el campo `token` (índice único) es O(1) independientemente del número de sesiones.

### Detección de token rotado/revocado
- `registro.activo === false` → token ya fue usado o fue revocado por logout/password-reset → 401.
- `registro.expiracion < new Date()` → token expirado → 401 + deactivación.
- Reuso de token revocado (escenario de robo): el registro existe pero está inactivo → 401 inmediato.

---

## 5. CORS — Configuración Real

```typescript
// backend/src/main.ts
app.enableCors({
  origin: frontendUrl,   // valor de FRONTEND_URL env var
  credentials: true,
});
```

- `origin: frontendUrl` — origen explícito, jamás wildcard (`*`).
- `credentials: true` — permite envío de cookies HttpOnly.
- No se usa `origin: (origin, callback) => callback(null, true)` ni reflection de origen.

**Estado A-02:** Parcialmente corregido. Se eliminó el wildcard y se fijó el origen. Hardening adicional (lista de orígenes múltiples, validación de subdominio, preflight caching) está fuera del alcance de S2.

---

## 6. Decisión CSRF: SameSite=Lax

### Por qué Lax y no Strict
- `SameSite=Strict` bloquea las cookies en **todas** las navegaciones cross-site, incluyendo cuando el usuario llega desde un enlace externo a una URL protegida. Esto rompería flujos normales de UX (link desde email, deep-link desde otro sistema).
- `SameSite=Lax` permite el envío en top-level navigations (GET) pero bloquea en subresource requests cross-site (fetch, XHR, form POST). Protege contra CSRF sin degradar la experiencia de navegación.

### Arquitectura de desarrollo (actual)
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Son orígenes distintos (puertos diferentes) → cross-origin. Las cookies con `SameSite=Lax` se envían en navegaciones top-level pero **no** en fetch cross-origin → `credentials: 'include'` es necesario y está configurado en `apiFetch`.
- En este escenario, `SameSite=Lax` es efectivo porque el atacante no puede hacer un request `fetch` cross-origin que lleve las cookies (el navegador bloquea la credencial).

### Arquitectura esperada en producción
Frontend y API bajo el mismo dominio (`udemm.edu.ar` / `api.udemm.edu.ar` o path `/api`). Al ser same-site, `SameSite=Lax` provee protección CSRF real: los requests cross-site no llevan las cookies.

### Riesgo residual
- En desarrollo con orígenes distintos, la protección CORS + credenciales actúa como barrera adicional.
- En producción same-site, `SameSite=Lax` protege contra CSRF de terceros. El único vector residual es un ataque desde el mismo site (XSS), que está fuera del alcance de S2.

### Controles pendientes para S3
- Implementación de token CSRF doble submit o header personalizado (`X-Requested-With`) para eliminar el riesgo residual.
- Revisar si `SameSite=Strict` es viable para endpoints de escritura críticos.
- `Helmet` + CSP para mitigar XSS (que habilitaría CSRF desde mismo origen).

---

## 7. Cambios en el Backend

### `backend/prisma/schema.prisma`
- `TokenRefresh`: nuevo campo `sesionId String?` (FK nullable a `Sesion`).
- `Sesion`: nueva relación inversa `tokensRefresh TokenRefresh[]`.

### `backend/prisma/migrations/20260826000001_add_sesion_id_to_token_refresh/migration.sql`
```sql
ALTER TABLE "TokenRefresh" ADD COLUMN "sesionId" TEXT;
ALTER TABLE "TokenRefresh" ADD CONSTRAINT "TokenRefresh_sesionId_fkey"
  FOREIGN KEY ("sesionId") REFERENCES "Sesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### `backend/src/main.ts`
- `cookieParser` con `import cookieParser from 'cookie-parser'` (esModuleInterop).
- CORS: `origin: frontendUrl`, `credentials: true` — sin wildcard.

### `backend/src/modules/auth/strategies/jwt.strategy.ts`
- Inyecta `PrismaService`.
- `validate()` verifica `Sesion.activo` cuando el payload contiene `sesionId`.

### `backend/src/modules/auth/auth.service.ts`
- `generarTokenAcceso()`: incluye `sesionId` en el payload JWT.
- `generarTokenRefresh()`: almacena `sesionId` en `TokenRefresh`.
- `login()`: crea `Sesion` (con IP y UserAgent), obtiene `sesionId`, lo pasa a ambos generadores.
- `refreshToken()`: propaga el mismo `sesionId` al nuevo par de tokens.
- `logout()`: cierra `Sesion` + invalida `TokenRefresh` en paralelo.
- `restablecerContrasena()`: en la transacción, invalida todos los `TokenRefresh` Y todas las `Sesion` del usuario.

### `backend/src/modules/auth/auth.controller.ts`
- `login()`: recibe `req.ip` y `req.headers['user-agent']` y los pasa a `authService.login()`.

---

## 8. Cambios en el Frontend

### `frontend/lib/api.ts` (NUEVO)
Wrapper centralizado `apiFetch` con:
- `credentials: 'include'` — todas las peticiones envían cookies.
- Sin `Authorization: Bearer` headers — tokens solo en cookies HttpOnly.
- Auto-refresh en 401 con singleton (`renovandoToken`) para evitar múltiples llamadas concurrentes.
- Evento `auth:sesion-expirada` cuando el refresh falla.
- Manejo correcto de `FormData` (no sobreescribe `Content-Type`).

### `frontend/lib/auth-context.tsx`
- Eliminado `token` y `obtenerTokenActual` del contexto.
- Restauración de sesión vía `GET /auth/me` (no desde localStorage).
- `logout()` llama a `POST /auth/logout` en el backend.
- Escucha evento `auth:sesion-expirada` para redirigir al login.

### Migración de 30+ archivos frontend
Todos los archivos que usaban `Authorization: Bearer ${token}` o `obtenerTokenActual()` fueron migrados a `apiFetch`. Archivos migrados:

**Contextos:**
- `frontend/lib/notificaciones-context.tsx`

**Configuración:**
- `app/configuracion/roles/page.tsx`
- `app/configuracion/parametros/page.tsx`
- `app/configuracion/subareas/page.tsx`
- `app/configuracion/usuarios/page.tsx`
- `app/configuracion/tablas-maestras/page.tsx`
- `app/configuracion/tablas-maestras/_components/TablaMaestraView.tsx`

**Gestión académica / plan de estudios:**
- `app/gestion-academica/facultades/page.tsx`
- `app/gestion-academica/carreras/page.tsx`
- `app/plan-estudios/carreras/page.tsx`
- `app/plan-estudios/programas-asignatura/page.tsx`
- `app/plan-estudios/malla-curricular/page.tsx`
- `app/plan-estudios/informacion-planes/page.tsx`
- `app/plan-estudios/ficha-asignatura/page.tsx`
- `app/plan-estudios/[carreraId]/planes/page.tsx`
- `app/plan-estudios/[carreraId]/planes/[planId]/estructura/page.tsx`

**Bandeja / vinculaciones:**
- `app/bandeja-aprobaciones/page.tsx`
- `app/vinculaciones-catedra/page.tsx`
- `app/vinculaciones-catedra/_components/FormularioVinculacion.tsx`

**Docentes:**
- `app/docentes/page.tsx`
- `app/docentes/nuevo/page.tsx`
- `app/docentes/[id]/page.tsx`
- `app/docentes/[id]/editar/page.tsx`
- `app/docentes/mi-ficha/page.tsx`

**Repositorio de Normativas:**
- `app/repositorio-normativas/page.tsx`
- `app/repositorio-normativas/nueva/page.tsx`
- `app/repositorio-normativas/editar/[normativaId]/page.tsx`
- `app/repositorio-normativas/[categoriaId]/page.tsx`
- `app/repositorio-normativas/[categoriaId]/[normativaId]/page.tsx`
- `app/repositorio-normativas/_components/NormativaForm.tsx`
- `app/repositorio-normativas/_components/CambiarEstadoModal.tsx`
- `app/repositorio-normativas/_components/EliminarNormativaModal.tsx`

---

## 9. Aspectos de Seguridad Implementados

### HttpOnly Cookies
- `auth_token`: access token JWT, `httpOnly: true`, `secure: isProd`, `sameSite: 'lax'`, sin `maxAge` (sesión de navegador).
- `refresh_token`: hash bcrypt (opaco para el cliente), `httpOnly: true`, `secure: isProd`, `sameSite: 'lax'`, `maxAge: 30 días`.
- Ningún token accesible por JavaScript (`document.cookie`).

### Revocación de Access Token (nuevo en S2 revisión)
- El JWT contiene `sesionId` → JwtStrategy verifica `Sesion.activo` en cada request.
- Logout cierra la sesión → revocación inmediata del access token.
- Password reset cierra todas las sesiones del usuario → revocación masiva.
- Sesiones de otros dispositivos del mismo usuario no se afectan en logout (sí en password reset).

### CSRF Mitigation
- `SameSite: Lax` en cookies — bloquea envío cross-site en requests que no son top-level navigation.
- CORS restrictivo con origen explícito desde `FRONTEND_URL`.

### Refresh Token Rotation
- Cada uso del refresh token invalida el anterior y genera un nuevo par.
- Reuso de token invalidado → 401.
- Logout invalida el token en la BD antes de limpiar cookies.

### Password Reset (B-04)
- `restablecerContrasena()` invalida todos los `TokenRefresh` Y todas las `Sesion` activas del usuario en una sola transacción.

---

## 10. Validación y Build

- `cd backend && npm run build` → **0 errores TypeScript**
- `cd frontend && npm run build` → **0 errores — 34 páginas generadas exitosamente**
- Búsqueda de `obtenerTokenActual` en frontend → **0 ocurrencias**
- Búsqueda de `Authorization: Bearer` en frontend → **0 ocurrencias**
- Migración Prisma aplicada: `20260826000001_add_sesion_id_to_token_refresh` → **OK**

---

## 11. Fuera del Alcance de esta Fase

Los siguientes ítems **no se implementaron** en S2 por instrucción explícita:
- Rate limiting
- Helmet / CSP / Security Headers
- CORS hardening completo (múltiples orígenes, validación de subdominio)
- Middleware Next.js para protección de rutas
- Actualización masiva de dependencias
- Cambios RBAC/IDOR
- TLS PostgreSQL
- Cambios de infraestructura
- S3 hardening (token CSRF explícito, reemplazo de bcrypt por randomBytes en refresh token)
