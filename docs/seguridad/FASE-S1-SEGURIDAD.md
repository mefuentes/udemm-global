# FASE S1 — Seguridad: Secretos, Configuración Segura, Validación Global y Credenciales Iniciales

**Sistema:** UDEMM Global  
**Fecha de implementación:** 2026-08-26  
**Branch:** feature/repositorio-normativas  
**Responsable:** Mariano Fuentes

---

## 1. Objetivo

Eliminar configuraciones inseguras que permitan que el sistema funcione con secretos débiles,
variables críticas inexistentes o payloads sin validar.

Principio aplicado: **FAIL SECURE / FAIL FAST** — si falta una variable crítica o tiene un
valor inseguro conocido, el backend no arranca utilizando valores por defecto.

---

## 2. Hallazgos corregidos

### C-01 (CRÍTICO) — JWT_SECRET con fallback hardcodeado

| | |
|---|---|
| **Estado anterior** | `configService.get<string>('JWT_SECRET') \|\| 'supersecretjwtkey'` en dos archivos |
| **Estado nuevo** | `configService.getOrThrow<string>('JWT_SECRET')` sin ningún fallback |
| **Complemento** | Validación centralizada que rechaza arranque si JWT_SECRET está ausente, vacío, es inseguro o es muy corto |

### M-01 (MEDIO) — Credenciales de seed conocidas

| | |
|---|---|
| **Estado anterior** | Contraseñas hardcodeadas directamente en el código del seed |
| **Estado nuevo** | Credenciales leídas de `SEED_ADMIN_PASS`, `SEED_DECANO_PASS`, `SEED_RECTORADO_PASS` |
| **Producción** | Si `NODE_ENV=production` y alguna variable falta, el seed aborta con error |
| **Desarrollo** | Si las variables no están definidas, se usan valores de desarrollo con advertencia visible |
| **Protección adicional** | La contraseña ya no se actualiza en el bloque `update` del upsert — se preserva la contraseña establecida en producción ante re-ejecuciones del seed |

### M-02 / I-01 (MEDIO/INFORMATIVO) — ValidationPipe no global, auth sin validación

| | |
|---|---|
| **Estado anterior** | `@UsePipes` por controlador; `AuthController` y `UsuariosController` sin ningún pipe |
| **Estado nuevo** | `ValidationPipe` global en `main.ts` con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| **Efecto** | Todo request con campos no declarados en el DTO es rechazado con HTTP 400 |

### .env.example — malformación detectada

| | |
|---|---|
| **Estado anterior** | `DATABASE_URL=postgresql://...udemm_globalJWT_SECRET=supersecretjwtkey` (una sola línea) |
| **Estado nuevo** | Variables en líneas separadas, valores son placeholders claros, sin secretos reales |

### Configuración de entorno — validación centralizada

| | |
|---|---|
| **Estado anterior** | `ConfigModule.forRoot({ isGlobal: true })` sin validación alguna |
| **Estado nuevo** | `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })` |

---

## 3. Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `backend/src/config/env.validation.ts` | **NUEVO** — función de validación centralizada |
| `backend/src/config/env.validation.test.ts` | **NUEVO** — script de pruebas (16 casos) |
| `backend/src/app.module.ts` | Agregado import y `validate: validateEnv` en ConfigModule |
| `backend/src/main.ts` | Agregado `useGlobalPipes(new ValidationPipe(...))` |
| `backend/src/modules/auth/auth.module.ts` | Eliminado fallback `\|\| 'supersecretjwtkey'`; `getOrThrow` |
| `backend/src/modules/auth/strategies/jwt.strategy.ts` | Eliminado fallback `\|\| 'supersecretjwtkey'`; `getOrThrow` |
| `backend/src/modules/auth/dto/login.dto.ts` | Agregado `@IsNotEmpty`, `@MaxLength(320/128)` |
| `backend/src/modules/auth/dto/solicitar-recuperacion.dto.ts` | Agregado `@IsNotEmpty`, `@MaxLength(320)` |
| `backend/src/modules/auth/dto/restablecer-contrasena.dto.ts` | Agregado `@MaxLength(256/128)` |
| `backend/src/modules/auth/dto/refresh-token.dto.ts` | Agregado `@MaxLength(512)` |
| `backend/src/modules/users/dto/crear-usuario.dto.ts` | `rolId` cambiado a `@IsUUID`; `@MaxLength` en todos los campos |
| `backend/src/modules/users/dto/actualizar-usuario.dto.ts` | Agregado `@MaxLength` en todos los campos |
| `backend/prisma/seed.ts` | Credenciales desde env vars; separación dev/prod; hash no actualizado en `update` |
| `backend/.env.example` | Corregida malformación; reemplazados valores inseguros por placeholders; agregados NODE_ENV y SMTP comentados |
| `.gitignore` | Agregada negación `!.env.example` y `!**/.env.example` para indicar que son plantillas intencionales |
| `docs/seguridad/FASE-S1-SEGURIDAD.md` | **NUEVO** — este documento |

---

## 4. Comportamiento anterior vs. nuevo

### JWT_SECRET

```
ANTES:  El backend arrancaba aunque JWT_SECRET no estuviera definida.
        En ese caso firmaba tokens con 'supersecretjwtkey', secreto conocido públicamente.

AHORA:  Si JWT_SECRET no está definida  → el backend no arranca.
        Si JWT_SECRET está vacía        → el backend no arranca.
        Si JWT_SECRET es un valor inseguro conocido → el backend no arranca.
        Si JWT_SECRET tiene menos de 32 chars → el backend no arranca.
        En todos los casos se imprime un mensaje claro SIN revelar el valor del secreto.
```

### Seed en producción

```
ANTES:  El seed usaba contraseñas hardcodeadas. Ejecutar el seed en producción
        dejaba contraseñas conocidas en los usuarios institucionales.

AHORA:  NODE_ENV=production + sin SEED_ADMIN_PASS → seed aborta.
        Las contraseñas de los usuarios en producción deben venir de
        variables de entorno externas al repositorio.
        Re-ejecutar el seed no sobreescribe contraseñas ya establecidas.
```

### Validación de payloads

```
ANTES:  AuthController y UsuariosController no tenían ValidationPipe.
        Un request con { correoElectronico, contrasena, rolId: 'admin', adminOverride: true }
        era aceptado silenciosamente; los campos extra se descartaban en el servicio
        pero no se rechazaban en el controlador.

AHORA:  El ValidationPipe global rechaza cualquier campo no declarado en el DTO.
        Respuesta: HTTP 400 con mensaje descriptivo de qué campo no está permitido.
```

---

## 5. Pruebas realizadas

### 5.1 Pruebas de validación de entorno

Script: `backend/src/config/env.validation.test.ts`

Ejecutar:
```bash
cd backend
npx ts-node --transpile-only src/config/env.validation.test.ts
```

**Resultado obtenido (2026-08-26):**

| Caso | Descripción | Resultado |
|---|---|---|
| CASO 1 | JWT_SECRET válido + todas las vars obligatorias | ✓ Pasa |
| CASO 2 | JWT_SECRET inexistente | ✓ Rechazado correctamente |
| CASO 3 | JWT_SECRET vacío | ✓ Rechazado correctamente |
| CASO 4 | JWT_SECRET inseguro conocido `'supersecretjwtkey'` | ✓ Rechazado correctamente |
| CASO 4b | JWT_SECRET inseguro conocido `'secret'` | ✓ Rechazado correctamente |
| CASO 4c | JWT_SECRET con 31 caracteres (bajo el mínimo) | ✓ Rechazado correctamente |
| CASO 4d | JWT_SECRET con exactamente 32 caracteres (mínimo) | ✓ Pasa |
| CASO 5 | DATABASE_URL inexistente | ✓ Rechazado correctamente |
| CASO 5b | DATABASE_URL vacío | ✓ Rechazado correctamente |
| CASO 5c | DATABASE_URL con formato MySQL inválido | ✓ Rechazado correctamente |
| CASO 5d | DATABASE_URL con prefijo `postgres://` | ✓ Pasa |
| CASO 6 | NODE_ENV inválido `'produccion'` | ✓ Rechazado correctamente |
| CASO 6b | NODE_ENV `'production'` | ✓ Pasa |
| CASO 6c | NODE_ENV `'test'` | ✓ Pasa |
| CASO 6d | NODE_ENV ausente (variable opcional) | ✓ Pasa |
| CASO 7 | Múltiples errores simultáneos | ✓ Rechazado correctamente |

**Total: 16/16 pasaron.**

### 5.2 Build TypeScript

```bash
cd backend && npm run build
```

**Resultado:** Compilación exitosa, 0 errores de TypeScript.

---

## 6. Variables obligatorias y recomendadas

| Variable | Obligatoria | Descripción | Validación |
|---|---|---|---|
| `DATABASE_URL` | ✓ Sí | URL de conexión a PostgreSQL | Debe comenzar con `postgresql://` o `postgres://` |
| `JWT_SECRET` | ✓ Sí | Secreto para firmar tokens JWT | Mín. 32 chars, no puede ser valor inseguro conocido |
| `JWT_EXPIRES_IN` | No | Expiración del access token | Valor por defecto: `3600s` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | No | Expiración del refresh token | Valor por defecto: 30 días |
| `BACKEND_PORT` | No | Puerto del servidor | Valor por defecto: `5000` |
| `NODE_ENV` | No | Entorno de ejecución | Si se define: `development`, `production` o `test` |
| `SMTP_HOST` | No* | Host SMTP para emails | *Requerido para funcionalidad de recuperación de contraseña |
| `SMTP_USER` | No* | Usuario SMTP | *Requerido para envío de emails |
| `SMTP_PASS` | No* | Contraseña SMTP | *Requerido para envío de emails |
| `SMTP_FROM` | No | Dirección de remitente | Valor por defecto en el servicio |

### Variables exclusivas del seed

| Variable | Obligatoria en producción | Descripción |
|---|---|---|
| `SEED_ADMIN_PASS` | ✓ Sí (si NODE_ENV=production) | Contraseña inicial para admin@udemm.edu.ar |
| `SEED_DECANO_PASS` | ✓ Sí (si NODE_ENV=production) | Contraseña inicial para decano@udemm.edu.ar |
| `SEED_RECTORADO_PASS` | ✓ Sí (si NODE_ENV=production) | Contraseña inicial para rectorado@udemm.edu.ar |

---

## 7. Configuración para desarrollo

1. Copiar la plantilla:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Editar `backend/.env`:
   - `DATABASE_URL`: ajustar al servidor PostgreSQL local (host, puerto, credenciales)
   - `JWT_SECRET`: generar un secreto seguro (ver sección siguiente)
   - `NODE_ENV=development`

3. Generar un JWT_SECRET seguro:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   El resultado (128 caracteres hex) se coloca como valor de `JWT_SECRET` en `.env`.

4. El seed de desarrollo puede ejecutarse sin las variables `SEED_*_PASS` — usará valores
   de desarrollo con una advertencia visible. Para verificar comportamiento con variables:
   ```bash
   SEED_ADMIN_PASS="MiContraseñaDev!" npx prisma db seed
   ```

---

## 8. Configuración para producción

1. Definir todas las variables de entorno en el sistema operativo o gestor de secretos.
   **NUNCA** copiar el `.env` de desarrollo ni el `.env.example` como configuración de producción.

2. Variables mínimas obligatorias:
   ```
   DATABASE_URL=postgresql://usuario_prod:contraseña_segura@host_prod:5433/udemm_global_prod
   JWT_SECRET=<secreto de al menos 64 caracteres generado con crypto.randomBytes>
   NODE_ENV=production
   ```

3. Para el seed de producción (solo ejecutar la primera vez):
   ```
   SEED_ADMIN_PASS=<contraseña institucional segura>
   SEED_DECANO_PASS=<contraseña institucional segura>
   SEED_RECTORADO_PASS=<contraseña institucional segura>
   NODE_ENV=production npx prisma db seed
   ```

4. Una vez ejecutado el seed, cambiar las contraseñas desde la aplicación si es posible,
   ya que las variables de entorno son la única protección contra exposición accidental.

5. Re-ejecutar el seed en producción es seguro (no sobreescribe contraseñas existentes)
   pero no es necesario salvo para agregar datos maestros nuevos (tablas, roles, etc.).

---

## 9. Procedimiento de rollback

Para revertir esta fase:

1. `auth.module.ts`: reemplazar `getOrThrow` por `get<string>(...) || 'valor_temp'`
   (requiere definir un secreto temporal fuerte).
2. `jwt.strategy.ts`: ídem.
3. `app.module.ts`: eliminar `import { validateEnv }` y `validate: validateEnv`.
4. `main.ts`: eliminar las líneas de `useGlobalPipes`.
5. `backend/.env.example`: restaurar desde historial de git.
6. `prisma/seed.ts`: restaurar desde historial de git.

**Importante:** el rollback eliminaría las protecciones de seguridad implementadas.
Solo realizarlo si hay un problema de compatibilidad crítico.

---

## 10. Riesgos pendientes por fase

### Resuelto en S1
- [x] C-01: JWT_SECRET con fallback hardcodeado
- [x] M-01: Credenciales de seed conocidas sin estrategia de producción
- [x] M-02: AuthController y UsuariosController sin ValidationPipe
- [x] I-01: forbidNonWhitelisted no habilitado globalmente
- [x] .env.example malformado
- [x] Sin validación centralizada de variables al arrancar

### Pendiente S2 — Tokens y sesiones
- [ ] A-04: Access token en localStorage (migrar a cookies HttpOnly)
- [ ] A-05: Logout sin invalidación server-side del refresh token
- [ ] M-03: Refresh token sin rotación al ser usado
- [ ] B-04: Refresh tokens no invalidados al restablecer contraseña

### Pendiente S3 — Headers, rate limiting, CORS
- [ ] A-01: Sin rate limiting en endpoints de autenticación
- [ ] A-02: CORS sin restricción de origen
- [ ] A-03: Sin headers HTTP de seguridad (Helmet)
- [ ] I-02: next.config.mjs sin headers de seguridad HTTP
- [ ] M-06: Sin middleware server-side de Next.js

### Pendiente S4+ — Auditoría, dependencias, infraestructura
- [ ] A-06: Vulnerabilidades en dependencias (35 total, 2 críticas)
- [ ] M-05: Rol no re-validado desde BD en cada request
- [ ] B-01: Refresh token generado con bcrypt (misuse semántico)
- [ ] B-02: AuditLogNormativa.usuarioId nullable
- [ ] B-03: Sin auditoría en módulos fuera de normativas
- [ ] TLS a PostgreSQL en producción
- [ ] Middleware Next.js para protección server-side

### Decisión institucional pendiente
- [ ] Política de contraseñas (complejidad, expiración, historial) — M-04
- [ ] Política de sesiones múltiples simultáneas
- [ ] Gestión de secretos en producción (gestor vs. variables de entorno del OS)
- [ ] Retención de datos de auditoría
- [ ] Plan de respuesta ante incidentes de seguridad
- [ ] Estrategia de backups de base de datos

---

## 11. Verificación de regresión funcional

Los siguientes flujos no fueron modificados y siguen funcionando:

| Módulo | Estado | Observación |
|---|---|---|
| Login (`/auth/login`) | ✓ Sin cambios funcionales | ValidationPipe global valida DTO normalmente |
| Refresh token (`/auth/refresh`) | ✓ Sin cambios funcionales | — |
| Recuperación de contraseña | ✓ Sin cambios funcionales | — |
| Gestión de usuarios (CRUD) | ✓ Sin cambios funcionales | `@IsUUID` en rolId es más estricto que `@IsString` |
| Ficha docente | ✓ Sin cambios funcionales | — |
| Vinculaciones | ✓ Sin cambios funcionales | — |
| Plan de estudios | ✓ Sin cambios funcionales | — |
| Repositorio de normativas | ✓ Sin cambios funcionales | — |
| Bandeja de aprobaciones | ✓ Sin cambios funcionales | — |

**Nota sobre `rolId` en usuarios:** el DTO ahora valida que el valor sea un UUID v4.
La interfaz del frontend envía siempre el ID del rol obtenido de la API, que es un UUID
válido. No hay riesgo de regresión en este punto.

---

*Documento generado como parte del proceso de hardening de seguridad previo al despliegue institucional de UDEMM Global.*
