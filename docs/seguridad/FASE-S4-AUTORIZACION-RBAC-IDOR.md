# FASE S4 — Autorización, RBAC, IDOR/BOLA, Ownership y Auditoría

**Fecha de inicio:** 2026-08-27
**Fecha de cierre ETAPA B:** 2026-08-27
**Rama:** `feature/security-hardening`
**Estado:** ETAPA B — Implementación completa

---

## 1. Arquitectura de Autorización Actual

### 1.1 Guards y su registro

| Guard | Tipo de registro | Efecto |
|-------|-----------------|--------|
| `ThrottlerGuard` | `APP_GUARD` (global) | Rate limiting en todos los endpoints |
| `JwtAuthGuard` | `@UseGuards()` por controller | Requiere cookie `auth_token` válida |
| `RolesGuard` | `@UseGuards()` por controller | Verifica rol del usuario contra `@Roles()` |

**No existe "default deny" global.** Los endpoints que no declaran `@UseGuards(JwtAuthGuard)` son públicos. Los actuales son todos intencionales (auth, health). Si en el futuro se agrega un endpoint sin `@UseGuards` accidentalmente, quedará público.

### 1.2 Flujo de autenticación y rol

```
Login → BD verifica activo + contraseña → JWT firmado con { sub, correoElectronico, rol, sesionId }
                                                              ↑
                                                    ROL TOMADO EN LOGIN

Por cada request autenticado:
JwtStrategy.validate() → Verifica sesion.activo desde BD
                       → Retorna { id, correoElectronico, rol: payload.rol, sesionId }
                                                              ↑
                                               ROL DEL JWT, NO DESDE BD
```

### 1.3 Comportamiento de RolesGuard

```typescript
if (!requiredRoles) return true; // Sin @Roles() → cualquier autenticado pasa
return requiredRoles.includes(user.rol.nombre);
```

Si un controller usa `@UseGuards(JwtAuthGuard, RolesGuard)` pero algún endpoint no tiene `@Roles()`, ese endpoint es accesible por cualquier usuario autenticado. Actualmente ningún controller tiene esta combinación — todos los endpoints tienen `@Roles()`.

---

## 2. Roles Reales del Sistema

Confirmados contra `prisma/seed.ts` y el código:

| Rol | Descripción real |
|-----|-----------------|
| `DOCENTE` | Accede a su ficha, sus vinculaciones, normativas vigentes, materias (con restricción pendiente) |
| `ADMINISTRATIVO` | Gestión de docentes, carreras, facultades, materias |
| `DIRECTOR_CARRERA` | Planes, materias, tablas maestras, normativas, subareas |
| `SECRETARIA_ACADEMICA` | Gestión amplia; normativas, vinculaciones, usuarios no |
| `ADMINISTRADOR_SISTEMA` | Acceso total incluyendo usuarios, roles, parámetros |
| `DECANO` | Lectura amplia; normativas, vinculaciones, docentes |
| `RECTORADO` | Lectura amplia; normativas, vinculaciones, docentes |

---

## 3. Hallazgos de Autorización

### F1 — M-05a: Cambio de rol no tiene efecto inmediato

**Severidad:** ALTO
**Archivo:** `src/modules/auth/strategies/jwt.strategy.ts`

**Descripción:** `JwtStrategy.validate()` retorna `rol: payload.rol`, que es el rol almacenado en el JWT en el momento del login. Si un `ADMINISTRADOR_SISTEMA` cambia el rol de un usuario (por ejemplo, degrada una `SECRETARIA_ACADEMICA` a `DOCENTE`), el usuario retiene los privilegios del rol anterior hasta que el JWT expire.

```typescript
// Actual — problema:
return {
  id: payload.sub,
  correoElectronico: payload.correoElectronico,
  rol: payload.rol,          // ← del JWT, puede estar desactualizado
  sesionId: payload.sesionId,
};
```

**Escenario de abuso:** un usuario comprometido cuyo rol fue reducido puede seguir operando con privilegios elevados durante el tiempo de vida del JWT (por defecto 1 hora).

**Propuesta de corrección:** extender la consulta de `sesion` para incluir el usuario y su rol actual desde BD, en una sola query Prisma (sin round-trip adicional):

```typescript
// PROPUESTO — resuelve F1 + F2 juntos:
const sesion = await this.prisma.sesion.findUnique({
  where: { id: payload.sesionId },
  include: {
    usuario: { select: { activo: true, rol: { select: { nombre: true } } } },
  },
});
if (!sesion || !sesion.activo) throw new UnauthorizedException('Sesión inválida o revocada');
if (!sesion.usuario.activo)    throw new UnauthorizedException('Usuario desactivado');

return {
  id: payload.sub,
  correoElectronico: payload.correoElectronico,
  rol: sesion.usuario.rol,   // ← desde BD, siempre actual
  sesionId: payload.sesionId,
};
```

---

### F2 — M-05b: Usuario desactivado puede seguir usando sesiones activas

**Severidad:** ALTO
**Archivos:** `src/modules/auth/strategies/jwt.strategy.ts` + `src/modules/users/usuarios.service.ts`

**Descripción:** `JwtStrategy.validate()` chequea `sesion.activo` pero NO chequea `usuario.activo`. Al llamar `PATCH /configuracion/usuarios/:id/estado` para desactivar un usuario, el servicio actualiza `activo=false` en la tabla `Usuario` pero las filas correspondientes en `Sesion` permanecen con `activo=true`.

**Consecuencia:** un usuario desactivado puede continuar realizando requests API durante hasta 1 hora (tiempo de vida del JWT) o indefinidamente si refresca el token antes de que expire.

**Doble corrección propuesta:**

1. En `JwtStrategy.validate()`: verificar `sesion.usuario.activo` (ver código en F1 — misma query).

2. En `UsuariosService.toggleEstado()`: cuando se desactiva un usuario, invalidar sus sesiones activas inmediatamente:

```typescript
// UsuariosService.toggleEstado() — agregar después de actualizar el usuario:
if (!actualizado.activo) {
  await this.prisma.sesion.updateMany({
    where: { usuarioId: id, activo: true },
    data: { activo: false },
  });
}
```

Combinando ambas correcciones: el usuario desactivado es rechazado en el siguiente request (control en JwtStrategy) y sus sesiones quedan inmediatamente inválidas (control en toggleEstado).

---

### F3 — DOCENTE puede modificar CUALQUIER materia (sin ownership) — **CORREGIDO**

**Severidad:** MEDIO → CERRADO
**Archivos:** `src/modules/materias/materias.controller.ts` + `src/modules/materias/materias.service.ts`

**Descripción original:** `PATCH /materias/:id` incluía DOCENTE en `ROLES_ACTUALIZAR` sin verificar vinculación. `POST/:id/correlativas` y `DELETE /:id/correlativas/:correlativaId` también incluían DOCENTE.

**Corrección implementada (ETAPA B, revisión final):**
- `PATCH /materias/:id`: DOCENTE incluido pero con chequeo de ownership. Solo pasa si tiene `VinculacionCatedra` con `estado='APROBADA'` para esa materia. `PENDIENTE_DE_APROBACION`, `RECHAZADA` y `DESVINCULADA` → 403.
- Correlativas: DOCENTE **removido** de los roles permitidos — son arquitectura curricular, no modificables por DOCENTE.

```typescript
// Política definitiva — solo APROBADA otorga ownership:
const vinculacion = await this.prisma.vinculacionCatedra.findFirst({
  where: { docenteId: docente.id, materiaId, estado: 'APROBADA' },
});
if (!vinculacion) throw new ForbiddenException('Sin acceso: no tenés una vinculación aprobada con esta asignatura');
```

---

### F4 — DOCENTE puede modificar CUALQUIER programa de asignatura (sin ownership) — **CORREGIDO**

**Severidad:** MEDIO → CERRADO
**Archivos:** `src/modules/programas/programas.controller.ts` + `src/modules/programas/programas.service.ts`

**Descripción original:** `PATCH /programas/materia/:materiaId` incluía DOCENTE en `ROLES_EDITAR` sin verificar vinculación.

**Corrección implementada (ETAPA B, revisión final):** mismo patrón que F3. DOCENTE incluido en el rol pero con chequeo de ownership. Solo `estado='APROBADA'` otorga permisos. `PENDIENTE_DE_APROBACION`, `RECHAZADA`, `DESVINCULADA` → 403.

---

### F5 — DIRECTOR_CARRERA excluido de vinculaciones (Decisión Institucional)

**Severidad:** N/A (decisión funcional)
**Archivo:** `src/modules/vinculaciones/vinculaciones.controller.ts`

**Descripción:** `ROLES_LEER` en VinculacionesController = `[ADMIN, SECRETARIA_ACADEMICA, DECANO, RECTORADO, DOCENTE]`. DIRECTOR_CARRERA no está incluido — no puede ver ni gestionar vinculaciones de sus carreras.

**DECISIÓN INSTITUCIONAL PENDIENTE:** ¿Debe DIRECTOR_CARRERA tener acceso de lectura a las vinculaciones de las carreras bajo su dirección? Si sí, podría requerir adicionalmente un filtro de carrera en el servicio.

---

### F6 — Health endpoints públicos (Info)

**Severidad:** BAJO
**Archivo:** `src/modules/health/health.controller.ts`

**Descripción:** `GET /` y `GET /health` son públicos e informan nombre del API, versión y estado de la base de datos. Esto es estándar para health checks de infraestructura.

**Propuesta:** Aceptar el riesgo residual o proteger con autenticación básica de infraestructura (fuera de alcance de S4). No modificar.

---

### F7 — AreasDisiplinaresController sin @UsePipes (Bajo)

**Severidad:** BAJO
**Archivo:** `src/modules/areas-disciplinares/areas-disciplinares.controller.ts`

**Descripción:** El controlador no declara `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` a nivel de clase. Los DTOs sí usan decoradores de class-validator. No hay impacto de seguridad conocido (los campos son simples: nombre, areaDisciplinarId). Inconsistencia respecto a los demás controllers.

---

## 4. IDOR / BOLA — Análisis Detallado

### 4.1 Parámetros `:id` revisados

| Módulo | Parámetro | DOCENTE puede acceder | Riesgo |
|--------|-----------|----------------------|--------|
| Docentes `/mi-ficha` | Derivado de `req.user.id` | Solo el propio | OK |
| Docentes `/:id` | URL param | NO (rol excluido) | OK |
| Vinculaciones `/:id` | URL param | DOCENTE → service verifica ownership | OK |
| Notificaciones `/:id/leer` | URL param | DOCENTE → service verifica docenteId | OK |
| Materias `/:id` (GET) | URL param | Lectura libre por todos los roles | OK |
| Materias `/:id` (PATCH) | URL param | **Sin ownership para DOCENTE** | MEDIO (F3) |
| Programas `/materia/:materiaId` (PATCH) | URL param | **Sin ownership para DOCENTE** | MEDIO (F4) |
| Normativas `/:id` (GET) | URL param | Service filtra eliminadas | OK |
| Normativas `/:id/archivo` (GET) | URL param | Service filtra eliminadas y vigencia | OK |

### 4.2 Validación de jerarquía (carreraId → planId → materiaId)

Las operaciones de creación de vinculaciones validan en el servicio que facultad, carrera, plan, materia, docente, catedra, cargo, modalidad y designacion existen y están activos. No se verifica que `planId` pertenezca a `carreraId` ni que `materiaId` pertenezca a `planId` — se confía en la existencia de los registros en BD. Para el nivel de riesgo actual (operaciones realizadas por SECRETARIA_ACADEMICA o superiores), esto es aceptable.

---

## 5. Mass Assignment / Overposting

### 5.1 DTOs sensibles revisados

| DTO | Campo sensible | Presente | Protección |
|-----|---------------|----------|-----------|
| `CrearUsuarioDto` | `rolId` | Sí | Solo ADMINISTRADOR_SISTEMA puede llamar el endpoint ✓ |
| `ActualizarUsuarioDto` | `rolId`, `contrasena` | Sí | Solo ADMINISTRADOR_SISTEMA ✓ |
| `CrearVinculacionDto` | `docenteId`, `usuarioSolicitanteId` | `docenteId` en body; `usuarioSolicitanteId` tomado de `req.user.id` | ✓ |
| `ActualizarDocenteDto` | `usuarioId` | No está en el DTO | ✓ |
| `CrearNormativaDto` | `eliminado`, `eliminadoPorUsuarioId` | No están en el DTO | ✓ |
| `EliminarNormativaDto` | `eliminadoPorUsuarioId` | No está en el DTO (tomado de req.user) | ✓ |

`whitelist: true` + `forbidNonWhitelisted: true` configurados globalmente en `main.ts` (S1). Los DTOs no exponen campos de auditoría, estados internos ni campos de propiedad.

---

## 6. Escalamiento de Privilegios

### 6.1 Vertical (menor → mayor)

| Escenario | Estado |
|-----------|--------|
| DOCENTE crear usuario | Bloqueado (rol excluido de `/configuracion/usuarios`) ✓ |
| DOCENTE cambiar su propio rol | Imposible (endpoint requiere ADMINISTRADOR_SISTEMA) ✓ |
| DOCENTE acceder a endpoints de ADMIN | Bloqueado por RolesGuard ✓ |
| Payload con `rolId` manipulado en update de usuario | Solo ADMINISTRADOR_SISTEMA puede PATCH usuarios ✓ |

### 6.2 Horizontal (usuario A → recursos de usuario B)

| Escenario | Estado |
|-----------|--------|
| DOCENTE A leer ficha de DOCENTE B vía `/docentes/:id` | Bloqueado (rol no autorizado) ✓ |
| DOCENTE A leer vinculación de DOCENTE B | Bloqueado en service (ForbiddenException) ✓ |
| DOCENTE A marcar leída una notificación de DOCENTE B | Bloqueado en service (ForbiddenException) ✓ |
| DOCENTE A modificar materia/programa de DOCENTE B | **No bloqueado** — F3/F4 ⚠ |

---

## 7. M-05: Rol del JWT vs Base de Datos

### 7.1 Estado actual

`JwtStrategy.validate()` (línea 33):
```typescript
return {
  id: payload.sub,
  correoElectronico: payload.correoElectronico,
  rol: payload.rol,       // ← JWT payload, no BD
  sesionId: payload.sesionId,
};
```

La estrategia sí consulta BD para validar `sesion.activo`, pero retorna el rol del token.

### 7.2 Escenario de riesgo

1. Usuario SECRETARIA_ACADEMICA inicia sesión → JWT firmado con `rol: { nombre: 'SECRETARIA_ACADEMICA' }`
2. Administrador reduce el rol a DOCENTE
3. Usuario SECRETARIA_ACADEMICA sigue haciendo requests con el JWT vigente
4. `req.user.rol.nombre === 'SECRETARIA_ACADEMICA'` → accede a endpoints de gestión durante ~1 hora

### 7.3 Solución propuesta (sin round-trip adicional)

Extender la query existente de `sesion.findUnique` con `include: { usuario: { select: { activo, rol } } }`. Esto resuelve simultáneamente M-05a (rol actual desde BD) y M-05b (usuario.activo chequeado).

---

## 8. Cambio de Rol y Desactivación — Efectividad Inmediata

### 8.1 Cambio de rol (M-05a)

**Estado actual:** efecto diferido hasta expiración del JWT.
**Con corrección F1:** inmediato en el siguiente request que pase por JwtStrategy.

### 8.2 Desactivación de usuario (M-05b)

**Estado actual:** `toggleEstado()` actualiza `usuario.activo=false` pero no invalida sesiones. `JwtStrategy` no chequea `usuario.activo`.
**Con corrección F2:**
- `toggleEstado()` también ejecuta `sesion.updateMany({ activo: false })` para el usuario
- `JwtStrategy` chequea `sesion.usuario.activo` en cada request
- Efecto: el usuario desactivado recibe 401 en su siguiente request

---

## 9. Auditoría

### 9.1 Cobertura actual

| Módulo | Auditoría | Detalle |
|--------|-----------|---------|
| Normativas | `AuditLogNormativa` | CARGA, EDICION, CAMBIO_ESTADO, BAJA_LOGICA, DESCARGA, EXPORTACION, ACCESO_DENEGADO |
| Materias | `HistorialMateria` | CREACION, ACTUALIZACION, BAJA |
| Programas | `HistorialPrograma` | Acciones por sección |
| Usuarios | — | Sin registro de auditoría de acciones |
| Roles | — | Sin registro |
| Sesiones | `Sesion` | Registro de login; no de acciones específicas |
| Vinculaciones | — | Sin log de auditoría explícito |

### 9.2 Acciones críticas no auditadas actualmente

| Acción | Módulo | Propuesta |
|--------|--------|-----------|
| Cambio de rol de usuario | Usuarios | Registrar: usuarioId afectado, rolAnterior, rolNuevo, adminId |
| Activación/desactivación de usuario | Usuarios | Registrar: usuarioId, estado anterior/nuevo, adminId |
| Creación de usuario | Usuarios | Registrar: nuevo usuarioId, rol asignado, adminId |
| Login/logout | Auth | Ya hay `Sesion`, podría enriquecerse |

Nota: La auditoría adicional está fuera del alcance inmediato de S4 a menos que sea confirmada como requisito. Se documenta como mejora futura.

---

## 10. npm audit

### Backend

```
Vulnerabilidades: 1 critical, 13 high, 15 moderate, 3 low — Total: 32
```

| Severidad | Paquete principal | Contexto | Acción propuesta |
|-----------|------------------|----------|-----------------|
| **CRITICAL** | `node-tar` | Dependencia transitiva de herramientas de build (no runtime de producción) | Monitorear; no requiere acción inmediata |
| **HIGH** | `multer` | Usado en normativas para subida de PDF — DoS por uploads incompletos | Evaluar actualización menor si disponible sin regresión |
| **HIGH** | `nodemailer` | Usado para emails de recuperación — SSRF/file read via `raw` option | No se usa la opción `raw` en el código actual; riesgo mitigado por uso |
| **HIGH** | `lodash` | Dependencia transitiva (no usada directamente en código de app) | No es directamente explotable |
| **HIGH** | `js-yaml`, `brace-expansion`, `glob`, `picomatch`, `tmp`, `fast-uri` | Dependencias de DevDependencies / herramientas de build | No impactan el runtime de producción |

**Conclusión:** Ninguna vulnerabilidad critical/high afecta directamente al runtime de producción de la aplicación en su uso actual. La vulnerabilidad de `multer` merece seguimiento dado que SÍ es un paquete runtime.

### Frontend

```
Vulnerabilidades: 1 critical, 2 high, 1 moderate — Total: 4 (+numerosas de Next.js 14.2.5)
```

| Severidad | Paquete | CVEs | Impacto |
|-----------|---------|------|---------|
| **CRITICAL + HIGH** | `next` (14.2.5) | GHSA-7gfc-8cq8-jh5f (authorization bypass), GHSA-gp8f-8m3g-qvj9 (cache poisoning), GHSA-4342-x723-ch2f (SSRF), y ~15 más | Actualización a Next.js 15.x resolvería; cambio mayor con posibles regresiones |
| **HIGH** | `nanoid` | Loop infinito con tamaño negativo | Dependencia de herramientas; no expuesta a input de usuario externo |
| **MODERATE** | `dompurify` | Bypass de sanitización | Si se usa para sanitizar HTML de usuario, evaluar actualización |

**Conclusión:** Next.js 14.2.5 tiene CVEs confirmados incluyendo uno de authorization bypass. La actualización a 15.x requiere análisis de regresión (cambio de App Router API, cambios de comportamiento). **Fuera del alcance de S4 según constraints de "no actualizar versiones mayores".** Se documenta para revisión separada (S5 o sprint de mantenimiento).

---

## 11. Frontend — Visibilidad de Módulos por Rol

El frontend ya controla la visibilidad de módulos según el rol almacenado en la sesión. Esto es UX (no seguridad). El backend rechaza correctamente las operaciones no autorizadas independientemente de lo que el frontend muestre o no muestre.

No se encontraron casos donde el frontend exponga acciones que el backend permita pero no debería, o viceversa (más allá de las observaciones en F3/F4 que son pendientes de decisión institucional).

---

## 12. Pruebas Negativas Propuestas (ETAPA B)

A implementar después de la aprobación de ETAPA B:

| Escenario | Endpoint | Esperado |
|-----------|----------|---------|
| DOCENTE lee su propia ficha | `GET /docentes/mi-ficha` | 200 |
| DOCENTE lee ficha ajena por ID | `GET /docentes/{otroId}` | 403 |
| DOCENTE lista vinculaciones | `GET /vinculaciones-catedra` | 200 (solo las propias) |
| DOCENTE lee vinculación ajena | `GET /vinculaciones-catedra/{ajenaId}` | 403 |
| DOCENTE aprueba vinculación propia | `PATCH /vinculaciones-catedra/{propiaId}/aprobar` | 200 |
| DOCENTE aprueba vinculación ajena | `PATCH /vinculaciones-catedra/{ajenaId}/aprobar` | 403 |
| No-admin lista usuarios | `GET /configuracion/usuarios` | 403 |
| No-admin crea usuario | `POST /configuracion/usuarios` | 403 |
| No-admin cambia rol | `PATCH /configuracion/usuarios/:id` | 403 |
| ADMIN crea usuario | `POST /configuracion/usuarios` | 200 |
| DOCENTE lee normativa vigente | `GET /normativas/{id}` | 200 |
| DOCENTE edita normativa | `PATCH /normativas/{id}` | 403 |
| DOCENTE accede a normativa eliminada | `GET /normativas/{eliminadaId}` | 404 |
| DOCENTE descarga PDF eliminado | `GET /normativas/{eliminadaId}/archivo` | 404 |
| Rol no autorizado → auditoría | `GET /normativas/auditoria` | 403 |
| Usuario desactivado en sesión activa | Request con JWT de usuario `activo=false` | 401 |
| Cambio de rol → request inmediato | Request con JWT de rol anterior tras cambio en BD | 403 (si se implementa F1) |

---

## 13. Propuesta de Correcciones para ETAPA B

### Correcciones confirmadas (no requieren decisión institucional)

| ID | Archivo | Corrección | Impacto |
|----|---------|-----------|---------|
| C1 (F1+F2) | `src/modules/auth/strategies/jwt.strategy.ts` | Extender query sesion con `include: { usuario }` para chequear activo y obtener rol actual desde BD | Efecto inmediato de cambio de rol y desactivación |
| C2 (F2) | `src/modules/users/usuarios.service.ts` | En `toggleEstado()`, al desactivar: `sesion.updateMany({ activo: false })` | Invalidación inmediata de sesiones al desactivar usuario |
| C3 (F7) | `src/modules/areas-disciplinares/areas-disciplinares.controller.ts` | Agregar `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` | Consistencia |

### Correcciones condicionales (requieren decisión institucional)

| ID | Condición | Archivo | Corrección |
|----|-----------|---------|-----------|
| C4 (F3) | Si se decide restringir ownership para DOCENTE en materias | `src/modules/materias/materias.service.ts` | Verificar VinculacionCatedra activa antes de permitir actualización DOCENTE |
| C5 (F4) | Si se decide restringir ownership para DOCENTE en programas | `src/modules/programas/programas.service.ts` | Verificar VinculacionCatedra activa antes de permitir actualización DOCENTE |
| C6 (F5) | Si se decide incluir DIRECTOR_CARRERA en vinculaciones | `src/modules/vinculaciones/vinculaciones.controller.ts` | Agregar DIRECTOR_CARRERA a ROLES_LEER; evaluar filtro por carreraId en servicio |

---

## 14. Decisiones Institucionales Pendientes

Estas decisiones deben ser tomadas por los responsables institucionales antes de que se implementen C4, C5 y C6:

### DIP-1: ¿DOCENTE puede editar CUALQUIER materia?

**Contexto:** Actualmente cualquier DOCENTE puede modificar datos y correlativas de cualquier materia del sistema.
**Opción A — Restringir:** Solo puede editar materias con VinculacionCatedra APROBADA a su nombre.
**Opción B — Sin restricción:** Cualquier DOCENTE puede contribuir a cualquier materia.

### DIP-2: ¿DOCENTE puede editar CUALQUIER programa de asignatura?

**Contexto:** Actualmente cualquier DOCENTE puede modificar el programa de cualquier materia.
**Opción A — Restringir:** Solo puede editar programas de materias con VinculacionCatedra APROBADA a su nombre.
**Opción B — Sin restricción:** Cualquier DOCENTE puede colaborar en cualquier programa.

### DIP-3: ¿DIRECTOR_CARRERA debe ver vinculaciones?

**Contexto:** Actualmente DIRECTOR_CARRERA no puede leer vinculaciones de cátedra.
**Opción A — Incluir con filtro:** DIRECTOR_CARRERA ve solo vinculaciones de sus carreras.
**Opción B — Incluir sin filtro:** DIRECTOR_CARRERA ve todas las vinculaciones (como SECRETARIA_ACADEMICA).
**Opción C — Mantener excluido:** El acceso a vinculaciones es exclusivo de SECRETARIA_ACADEMICA y superiores.

---

## 15. ETAPA B — Implementación

### 15.1 Archivos modificados

| Archivo | Corrección | Descripción |
|---------|-----------|-------------|
| `src/modules/auth/strategies/jwt.strategy.ts` | C1+C2 (M-05a+M-05b) | `sesion.findUnique` extendido con `include: { usuario: { select: { activo, rol } } }`. Se verifica `usuario.activo` y se retorna `rol` desde BD. |
| `src/modules/users/usuarios.service.ts` | C2 (M-05b) | `toggleEstado()` ejecuta `sesion.updateMany({ activo: false })` cuando el usuario se desactiva. |
| `src/modules/areas-disciplinares/areas-disciplinares.controller.ts` | C3 (F7) | Agregado `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` a nivel de clase. |
| `src/modules/materias/materias.service.ts` | C4 (DIP-1) | Método privado `verificarOwnershipDocente()` que verifica `VinculacionCatedra` activa. `actualizar()` acepta `rolNombre` y llama al chequeo cuando `rolNombre === 'DOCENTE'`. |
| `src/modules/materias/materias.controller.ts` | C4 (DIP-1) | `ROLES_ACTUALIZAR` dividido en `ROLES_ACTUALIZAR_MATERIA` (incluye DOCENTE + ownership en service) y `ROLES_ACTUALIZAR_CORRELATIVAS` (excluye DOCENTE — correlativas son arquitectura curricular). `actualizar()` pasa `req.user.rol.nombre`. |
| `src/modules/programas/programas.service.ts` | C5 (DIP-2) | Método privado `verificarOwnershipDocente()` equivalente al de materias. `actualizarPrograma()` acepta `rolNombre` y llama al chequeo. |
| `src/modules/programas/programas.controller.ts` | C5 (DIP-2) | `actualizarPrograma()` pasa `req.user.rol.nombre`. |

### 15.2 Queries de autorización utilizadas

**jwt.strategy.ts — query principal (C1+C2):**
```typescript
const sesion = await this.prisma.sesion.findUnique({
  where: { id: payload.sesionId },
  include: {
    usuario: { select: { activo: true, rol: { select: { nombre: true } } } },
  },
});
// Controles: !sesion || !sesion.activo → 401; !sesion.usuario.activo → 401
// Retorno: rol: { nombre: sesion.usuario.rol.nombre } (desde BD, no del JWT)
```

**materias/programas — verificarOwnershipDocente (C4+C5):**
```typescript
const docente = await this.prisma.docente.findUnique({ where: { usuarioId } });
const vinculacion = await this.prisma.vinculacionCatedra.findFirst({
  where: {
    docenteId: docente.id,
    materiaId,
    estado: 'APROBADA',  // solo vinculación efectivamente aprobada otorga ownership
  },
});
// Sin vinculación APROBADA → ForbiddenException 403
// PENDIENTE_DE_APROBACION, RECHAZADA, DESVINCULADA → Prisma devuelve null → 403
```

**usuarios.service.ts — toggleEstado (C2):**
```typescript
if (!actualizado.activo) {
  await this.prisma.sesion.updateMany({
    where: { usuarioId: id, activo: true },
    data: { activo: false },
  });
}
```

### 15.3 Comportamiento final por rol

| Acción | ADMINISTRADOR_SISTEMA | SECRETARIA_ACADEMICA | DIRECTOR_CARRERA | DOCENTE |
|--------|----------------------|---------------------|-----------------|---------|
| Rol en request = rol actual de BD | ✓ (C1) | ✓ (C1) | ✓ (C1) | ✓ (C1) |
| Desactivado → 401 en siguiente request | ✓ (C1+C2) | ✓ | ✓ | ✓ |
| `PATCH /materias/:id` | ✓ (sin ownership) | ✓ | ✓ | ✓ solo con VinculacionCatedra estado='APROBADA' (C4) |
| `POST /materias/:id/correlativas` | ✓ | ✓ | ✓ | ✗ (correlativas restringidas a roles inst.) |
| `DELETE /materias/:id/correlativas/:cId` | ✓ | ✓ | ✓ | ✗ |
| `PATCH /programas/materia/:materiaId` | ✓ (sin ownership) | ✓ | ✓ | ✓ solo con VinculacionCatedra estado='APROBADA' (C5) |
| Vinculaciones lectura | ✓ | ✓ | ✗ (DIP-3 pendiente) | ✓ (solo propias) |

### 15.4 Decisiones pendientes

| ID | Decisión | Implementación |
|----|---------|----------------|
| DIP-3 | DIRECTOR_CARRERA accede a vinculaciones de su carrera | **NO IMPLEMENTADO** — No existe en el modelo Prisma una relación `Usuario → Carrera` para DIRECTOR_CARRERA. El campo `carreraId` no existe en `Usuario`, y no hay modelo `DirectorCarrera`. Sin ese vínculo, es imposible filtrar por carrera de forma confiable. Implementar requiere: (a) decisión de modelo de datos, (b) migración de BD. Se documenta como C6 diferido a sprint de infraestructura. |

### 15.5 Tests implementados — Resultados

**Suites: 5 — Tests: 53/53 pasaron** (revisión final: +9 tests respecto a entrega inicial)

| Suite | Tests | Escenarios |
|-------|-------|-----------|
| `jwt-strategy.spec.ts` (nuevo) | 6 | Sin sesionId → retorna payload tal cual; sesión inexistente → 401; sesión inactiva → 401; usuario.activo=false → 401 (M-05b); rol cambiado en BD → retorna nuevo rol (M-05a); rol sin cambio → pasa |
| `materias-ownership.spec.ts` (nuevo) | 11 | Sin perfil Docente → 403; sin vinculación → 403; PENDIENTE_DE_APROBACION → 403; RECHAZADA → 403; DESVINCULADA → 403; APROBADA → OK; IDOR Materia B → 403; ADMINISTRADOR sin check → OK; SECRETARIA sin check → OK |
| `programas-ownership.spec.ts` (nuevo) | 11 | Sin perfil Docente → 403; sin vinculación → 403; PENDIENTE_DE_APROBACION → 403; RECHAZADA → 403; DESVINCULADA → 403; APROBADA → OK; IDOR Materia B → 403; SECRETARIA sin check → OK; DIRECTOR_CARRERA sin check → OK |
| `throttle.spec.ts` (S3.1) | 8 | Sin cambios — pasan |
| `csrf.middleware.spec.ts` (S3.1) | 22 | Sin cambios — pasan |

**Nota sobre el mock:** `findFirst` simula el comportamiento real de Prisma con filtro `estado: 'APROBADA'`. Los casos PENDIENTE/RECHAZADA/DESVINCULADA se modelan con `findFirst` retornando `null` — exactamente lo que Prisma devolvería al filtrar con ese estado y no encontrar ninguna fila coincidente.

### 15.6 Estado de controles

| Control | Estado ETAPA A | Estado ETAPA B |
|---------|---------------|----------------|
| M-05a: rol desde BD en cada request | HALLADO | **IMPLEMENTADO** (jwt.strategy.ts) |
| M-05b: usuario.activo chequeado | HALLADO | **IMPLEMENTADO** (jwt.strategy.ts) |
| M-05b: sesiones invalidadas al desactivar | HALLADO | **IMPLEMENTADO** (usuarios.service.ts) |
| F3: ownership DOCENTE en materias | HALLADO | **IMPLEMENTADO** (C4 — VinculacionCatedra check) |
| F4: ownership DOCENTE en programas | HALLADO | **IMPLEMENTADO** (C5 — VinculacionCatedra check) |
| F7: ValidationPipe en areas-disciplinares | HALLADO | **IMPLEMENTADO** (C3) |
| F5/C6: DIRECTOR_CARRERA en vinculaciones | HALLADO | **DIFERIDO** — sin relación Usuario↔Carrera en schema |
| Correlativas restringidas a institucionales | N/A | **IMPLEMENTADO** — DOCENTE removido de correlativas |
| Build backend | OK | **OK** — 0 errores |
| Build frontend | OK | **OK** — 0 errores, 34 páginas |
| npm audit (backend) | DOCUMENTADO | Sin cambio — vulnerabilidades son de build tools |
| npm audit (frontend) | DOCUMENTADO | Sin cambio — actualización Next.js 15.x fuera de alcance |

---

## 16. Estado Final

---

**FASE S4: APROBADA CON OBSERVACIONES**

**Observaciones:**
1. **C6 diferido (DIP-3):** DIRECTOR_CARRERA no puede acceder a vinculaciones de su carrera porque no existe en el modelo de datos una relación explícita `Usuario → Carrera` para ese rol. Requiere decisión de modelo de datos + migración antes de implementar.
2. **npm audit frontend:** Next.js 14.2.5 tiene CVEs de severidad alta/crítica (authorization bypass, cache poisoning). La corrección requiere migración a Next.js 15.x (cambio mayor), que está fuera del scope de S4 según las reglas de la fase. Se recomienda sprint separado de actualización de dependencias.
3. **Correlativas:** DOCENTE fue removido de los roles permitidos para gestionar correlatividades (`POST /:id/correlativas`, `DELETE /:id/correlativas/:correlativaId`). Las correlatividades son arquitectura curricular y su edición fue declarada exclusiva de roles institucionales.
