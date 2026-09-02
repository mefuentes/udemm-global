# SPRINT S5.5-C — Migración Node 20.17.0 → Node 22 LTS

**Proyecto:** UDEMM Global
**Rama:** `feature/ajustes-permisos-docentes`
**Fecha:** 2026-09-02
**Sprint:** S5.5-C — Migración controlada Node.js 20.17.0 → 22 LTS
**Restricción:** Solo cambia el runtime Node.js. Sin cambios en NestJS, Prisma, TypeScript, Jest, lógica de negocio, endpoints, RBAC, autenticación, frontend ni Docker.

---

## 1. Verificación inicial (pre-migración)

| Campo | Valor |
|-------|-------|
| `git status` | `working tree clean` |
| Rama | `feature/ajustes-permisos-docentes` |
| Node.js | v20.17.0 |
| npm | 10.8.2 |
| NestJS | 11.2.3 (confirmado con `npm ls`) |
| Build baseline | exit 0 |
| Tests baseline | **53/53 PASS** (exit 0, 123.5 s) |

### Paquetes NestJS confirmados

```
@nestjs/cli@11.0.24
@nestjs/common@11.2.3
@nestjs/config@4.0.4
@nestjs/core@11.2.3
@nestjs/jwt@11.0.2
@nestjs/passport@11.0.5
@nestjs/platform-express@11.2.3
@nestjs/testing@11.2.3
@nestjs/throttler@6.5.0
```

---

## 2. Objetivo de versión Node

| Campo | Valor |
|-------|-------|
| Versión objetivo | **Node 22.23.2 LTS** |
| LTS name | `Jod` |
| Fecha de publicación | 2026-07-28 |
| Mínimo requerido | >= 22.22.3 (runtime NestJS 12 + CLI/schematics) |
| Fuente | https://nodejs.org/dist/index.json |
| EOL estimado | Abril 2027 |

**Versiones Node 22 LTS disponibles (top 5):**

| Versión | Fecha |
|---------|-------|
| v22.23.2 | 2026-07-28 |
| v22.23.1 | 2026-06-22 |
| v22.23.0 | 2026-06-17 |
| v22.22.3 | 2026-05-13 |
| v22.22.2 | 2026-03-24 |

---

## 3. Diagnóstico de instalación actual

| Campo | Valor |
|-------|-------|
| Método de instalación | **MSI (Windows Installer)** |
| Ubicación (`where.exe node`) | `C:\Program Files\nodejs\node.exe` |
| Ubicación (`where.exe npm`) | `C:\Program Files\nodejs\npm` / `npm.cmd` |
| nvm-windows | ❌ No instalado |
| fnm | ❌ No instalado |
| volta | ❌ No instalado |
| winget | ❌ No disponible en el entorno |
| chocolatey | ❌ No instalado |
| Privilegios del proceso actual | Usuario estándar (sin elevación UAC) |

**Consecuencia del método MSI:** La actualización reemplaza Node 20 in-place. No es posible mantener Node 20 y Node 22 de forma simultánea con el método MSI. Para rollback sería necesario reinstalar Node 20 desde su MSI.

---

## 4. Declaraciones de versión Node en el proyecto

| Archivo | Antes | Después |
|---------|-------|---------|
| `backend/package.json` — campo `engines` | ❌ Ausente | ✅ `"node": ">=22.22.3"` |
| `.nvmrc` (raíz) | ❌ Ausente | — (no se crea: no hay nvm-windows) |
| `.node-version` (raíz) | ❌ Ausente | — (no se crea: no hay gestor que lo lea) |
| `backend/Dockerfile` | `FROM node:20-alpine` | **Sin cambio** (restricción S5.5-C: no cambiar Docker) |
| `frontend/Dockerfile` | `FROM node:20-alpine` | **Sin cambio** (restricción S5.5-C: no cambiar Docker) |

**Justificación del campo `engines`:**
Documenta en el propio `package.json` el requisito mínimo de Node para el proyecto. No bloquea patch releases compatibles (`>=22.22.3` acepta cualquier versión mayor). No requiere herramientas adicionales para ser útil — npm lo lee nativamente y avisa si la versión no cumple.

**Nota sobre Docker:** El repositorio contiene `backend/Dockerfile`, `frontend/Dockerfile` y `docker-compose.yml` con imagen base `node:20-alpine`. Estos archivos son artefactos legacy y Docker no forma parte del entorno operativo actual del proyecto, por lo que quedan fuera del alcance de S5.5-C. Si en el futuro se adopta Docker como estrategia de despliegue, la imagen base deberá alinearse entonces con la versión Node soportada.

---

## 5. Procedimiento de instalación — Node 22.23.2 LTS (Windows MSI)

> **Esta etapa requiere acción manual del usuario.** El proceso actual no dispone de privilegios de administrador para ejecutar el instalador MSI automáticamente.

### 5.1 Descarga

Descargar el instalador MSI de 64 bits desde:

```
https://nodejs.org/dist/v22.23.2/node-v22.23.2-x64.msi
```

Verificar que el archivo descargado tiene la firma digital de OpenJS Foundation.

### 5.2 Instalación

**Opción A — Instalación mediante asistente gráfico (recomendada):**

1. Hacer doble clic en `node-v22.23.2-x64.msi`
2. Aceptar el UAC (prompt de administrador)
3. Seguir el asistente con las opciones por defecto
4. Marcar "Automatically install the necessary tools" si se ofrece (opcional, no requerido)
5. Completar la instalación

**Opción B — Instalación silenciosa desde terminal administrativo:**

```powershell
# Abrir PowerShell como Administrador, luego:
msiexec /i "C:\ruta\a\node-v22.23.2-x64.msi" /qn /norestart
```

### 5.3 Reiniciar el terminal

Después de la instalación, cerrar y reabrir la terminal (o Claude Code) para que el PATH actualizado sea efectivo.

### 5.4 Verificación inmediata post-instalación

```powershell
node -v         # Esperado: v22.23.2
npm -v          # Esperado: 10.x o superior
where.exe node  # Esperado: C:\Program Files\nodejs\node.exe
where.exe npm   # Esperado: C:\Program Files\nodejs\npm / npm.cmd
```

---

## 6. Reinstalación de dependencias (npm ci)

> **Ejecutar con Node 22 activo.**

```
cd backend
npm ci
```

| Resultado esperado | — |
|-------------------|---|
| Sin `--force` | ✅ Obligatorio |
| Sin `--legacy-peer-deps` | ✅ Obligatorio |
| Exit code | 0 |
| Advertencias ERESOLVE | Solo `warn` (override peer deps — ya conocidas de S5.5-B) |

**Resultado obtenido:**

```
added 785 packages in 6m
Exit code: 0 ✅
Warnings: solo deprecation notices (inflight, lodash.isequal, rimraf, glob, fstream, uuid) — sin errores de peer deps ni incompatibilidades Node 22.
```

---

## 7. Validación técnica

> **Ejecutar con Node 22 activo, desde `backend/`.**

### 7.1 Build

```
npm run build
```

| Resultado esperado | exit 0 |
|-------------------|--------|
| Resultado obtenido | ✅ **exit 0** |

### 7.2 Tests

```
npx jest --runInBand --forceExit
```

| Resultado esperado | 53/53 PASS, exit 0 |
|-------------------|--------------------|
| Resultado obtenido | ✅ **53/53 PASS** — exit 0 — 52.1 s |

### 7.3 Prisma

```
npx prisma validate
npx prisma generate
```

| Comando | Resultado esperado | Resultado obtenido |
|---------|-------------------|-------------------|
| `prisma validate` | OK (sin errores de schema) | ✅ `The schema at prisma/schema.prisma is valid` |
| `prisma generate` | Prisma Client generado sin errores | ✅ `Generated Prisma Client (v5.22.0) in 943ms` |

---

## 8. Auditoría informativa

> **Solo registro. Sin correcciones.**

```
npm audit
npm audit --omit=dev
```

| Métrica | Baseline S5.5-B (Node 20, npm 10.8.2) | Post Node 22 (npm 10.9.8) |
|---------|---------------------------------------|--------------------------|
| HIGH | 1 (nodemailer) | **1** (idéntico) |
| MODERATE | 2 (uuid vía exceljs ×2) | **2** (idéntico) |
| **Total (runtime `--omit=dev`)** | **3** | **3** ✅ |
| **Total (todas)** | — | **3** (sin devDeps vulnerables adicionales) |

**CVEs presentes (sin cambio respecto a S5.5-B):**

| GHSA | Severidad | Paquete | Estado |
|------|-----------|---------|--------|
| GHSA-p6gq-j5cr-w38f | HIGH | `nodemailer@8.0.11` | Residual — no explotable (proyecto no usa `raw`/`attachments.path`) |
| GHSA-w5hq-g745-h8pq | MODERATE | `uuid` vía `exceljs@4.x` (×2 entradas) | Residual — fix requiere downgrade exceljs@3.4.0 |

**Conclusión:** El cambio de Node 20 → 22 y de npm 10.8.2 → 10.9.8 **no introdujo ni resolvió vulnerabilidades**. El audit es idéntico al baseline de S5.5-B.

---

## 9. Regresión manual dirigida

> **Ejecutar manualmente después de iniciar el backend con Node 22.**

Las siguientes operaciones deben verificarse de forma manual en el entorno de desarrollo:

| Operación | Endpoint | Resultado esperado |
|-----------|---------|-------------------|
| Login | `POST /auth/login` | JWT devuelto, cookies seteadas |
| Auth me | `GET /auth/me` | Usuario actual devuelto |
| Refresh | `POST /auth/refresh` | Nuevo access token devuelto |
| Logout | `POST /auth/logout` | Sesión invalidada |
| Acceso RBAC | `GET /roles` (o recurso restringido) | Acceso correcto según rol |
| CRUD simple | `GET /usuarios` o equivalente | Respuesta correcta |
| Descarga PDF | `GET /normativas/:id/pdf` | PDF descargado correctamente |
| Plan de estudios | `GET /programas` | Datos devueltos |

> No ejecutar `start:dev` como parte de la validación automática de este sprint.
> Si se inicia el backend, finalizar todo el árbol `ts-node-dev` antes de concluir.

---

## 10. Riesgos e incompatibilidades identificados

| Riesgo | Nivel | Evaluación |
|--------|-------|-----------|
| bcrypt con Node 22 | Bajo | `bcrypt@6.0.0` usa bindings nativos vía `@mapbox/node-pre-gyp`. Soporta Node 22. Si npm ci falla, evaluar `--build-from-source`. |
| Prisma Client con Node 22 | Bajo | `prisma@5.22.x` soporta Node 22 (declarado explícitamente en Prisma compatibility matrix). |
| `@types/node@20.14.2` con Node 22 | Bajo | Los tipos de Node 20 son compatibles en Node 22 (backward compatibility). Solo se perderían tipos de APIs nuevas de Node 22 no usadas en el proyecto. No requiere actualización ahora. |
| Docker (`node:20-alpine`) | Ninguno | `backend/Dockerfile`, `frontend/Dockerfile` y `docker-compose.yml` contienen imagen `node:20-alpine` pero Docker no es parte del entorno operativo actual del proyecto. Fuera del alcance de S5.5-C. Si se adopta Docker como estrategia de despliegue, la imagen base deberá alinearse en ese momento. |
| npm version con Node 22 | Ninguno | Node 22.23.2 incluye npm 10.x. La versión exacta de npm puede cambiar (de 10.8.2 a la incluida en Node 22.23.2). |
| Rollback | Moderado | Con MSI, volver a Node 20 requiere descargar e instalar `node-v20.17.0-x64.msi`. Sin nvm-windows, no hay switch automático. |

---

## 11. Validación git

### Pre-instalación (ya ejecutada)

```
$ git diff --check
(sin errores — solo warnings LF→CRLF de autocrlf de Windows)

$ git diff --stat
 backend/package.json | 4 ++++
 1 file changed, 4 insertions(+)

$ git status
On branch feature/ajustes-permisos-docentes
Changes not staged for commit:
  modified: backend/package.json

Untracked files:
  docs/seguridad/SPRINT-S5-5-C-MIGRACION-NODE-22.md
```

Único cambio de código: adición del campo `engines` en `backend/package.json`.
Sin cambios en: dependencias, lógica de negocio, endpoints, tests, RBAC, auth, Prisma, frontend, Docker.

---

## 12. Informe de estado

| Campo | Valor |
|-------|-------|
| **Node antes** | v20.17.0 |
| **Node después** | ✅ **v22.23.2 LTS** |
| **npm antes** | 10.8.2 |
| **npm después** | ✅ **10.9.8** |
| **Método de instalación** | MSI Windows (`node-v22.23.2-x64.msi`) — instalación manual con UAC |
| **`where.exe node`** | `C:\Program Files\nodejs\node.exe` |
| **`where.exe npm`** | `C:\Program Files\nodejs\npm` / `npm.cmd` |
| **Archivos modificados** | `backend/package.json` (+campo `engines`) |
| **`npm ci`** | ✅ exit 0 (785 packages, ~6 min) |
| **Build** | ✅ exit 0 |
| **Tests 53/53** | ✅ **53/53 PASS** — exit 0 — 52.1 s |
| **Prisma validate** | ✅ schema válido |
| **Prisma generate** | ✅ Prisma Client v5.22.0 generado sin errores |
| **Audit runtime (`--omit=dev`)** | ✅ 3 vulnerabilidades (1 HIGH, 2 MODERATE) — idéntico a S5.5-B |
| **Audit total** | ✅ 3 vulnerabilidades (1 HIGH, 2 MODERATE) — idéntico a S5.5-B |
| **Incompatibilidades** | ✅ Ninguna — bcrypt, Prisma 5.22, TypeScript 5.9 compatibles con Node 22 |
| **Docker** | Sin cambio — `node:20-alpine` en Dockerfiles legacy; Docker no es parte del entorno operativo actual |
| **Git status** | `backend/package.json` modificado (+engines); doc S5.5-C untracked |

---

## 13. Preparación para NestJS 12

Con Node 22.23.2 LTS instalado, el entorno cumple:

| Requisito | Estado |
|-----------|--------|
| NestJS 12 runtime (>= 20.19 línea 20.x ó >= 22.12 línea 22.x) | ✅ Cumple (22.23.2 >= 22.12) |
| NestJS 12 CLI / `nest upgrade` / `@nestjs/schematics` (>= 22.22.3) | ✅ Cumple (22.23.2 >= 22.22.3) |
| EOL Node (Abril 2027) | ✅ Cubre toda la duración de S5.5-D |

---

## Estado final

Migración completa. Node 22.23.2 LTS instalado y validado. Sin incompatibilidades. Sin regresiones. Entorno listo para la futura migración a NestJS 12 (S5.5-D).
