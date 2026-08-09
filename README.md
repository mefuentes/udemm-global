# UDEMM Global

Plataforma institucional académica y documental para la Universidad del Mar del Plata (UDEMM), orientada a procesos de acreditación CONEAU.

## Descripción

Sistema de gestión integral que permite administrar la información docente, configurar roles y usuarios, y gestionar parámetros institucionales. Desarrollado como Proyecto Integrador de Sistemas.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Autenticación | JWT + Refresh Token |
| Email | Nodemailer (SMTP) |

---

## Estructura del proyecto

```
UDEMM-GLOBAL/
├── frontend/          # Aplicación Next.js
│   ├── app/           # Páginas y rutas (App Router)
│   ├── components/    # Componentes reutilizables (Sidebar, etc.)
│   └── lib/           # Contextos y utilidades (auth, sidebar)
├── backend/           # Aplicación NestJS
│   ├── src/
│   │   └── modules/   # auth, docentes, users, roles, parametros
│   └── prisma/        # Schema y migraciones
└── docker-compose.yml
```

---

## Módulos implementados

### Autenticación
- Login con JWT y Refresh Token
- Recuperación de contraseña por correo electrónico (enlace seguro, 1 hora de validez)
- Guards de roles (RBAC) en todos los endpoints protegidos

### Mi Ficha Docente
Formulario completo de 10 tabs para la carga del legajo docente:

| Tab | Contenido |
|---|---|
| 1 | Datos personales e identificación |
| 2 | Títulos de grado, posgrado y formación docente |
| 3 | Situación de revista (cargo actual en la UDEMM) |
| 4 | Función de gestión académica |
| 5 | Investigación y proyectos |
| 6 | Extensión y vinculación |
| 7 | Investigación — desempeño y producción |
| 8 | Reuniones científicas y comités |
| 9 | Comités y jurados |
| 10 | Otra información (carrera docente, distinciones, estancias) |

Cada tab incluye CRUD por sección, validaciones de campos obligatorios y exportación a PDF.

### Gestión de Docentes
- Listado con búsqueda, filtros y paginación
- Alta, edición y baja lógica
- Exportación a PDF de la ficha completa

### Configuración del sistema
- **Usuarios**: CRUD completo, filtros por nombre, rol y estado
- **Roles**: Listado con cantidad de usuarios asignados, activación/desactivación
- **Parámetros Generales**: Configuración institucional centralizada (nombre, sigla, correo, colores)

---

## Roles del sistema

| Rol | Accesos principales |
|---|---|
| `ADMINISTRADOR_SISTEMA` | Todo el sistema + Configuración |
| `DOCENTE` | Mi Ficha Docente + Bandeja de Aprobaciones |
| `ADMINISTRATIVO` | Gestión de docentes + Bandeja de Aprobaciones |
| `DECANO` | Listado y ficha de docentes |
| `RECTORADO` | Listado y ficha de docentes |
| `DIRECTOR_CARRERA` | Listado de docentes |
| `SECRETARIA_ACADEMICA` | Listado de docentes |

---

## Configuración local (sin Docker)

### Requisitos previos
- Node.js 18+
- PostgreSQL 14+

### 1. Base de datos

Crear usuario y base de datos en PostgreSQL:

```sql
CREATE USER udemm_user WITH PASSWORD 'udemm_pass';
CREATE DATABASE udemm_global OWNER udemm_user;
GRANT ALL PRIVILEGES ON DATABASE udemm_global TO udemm_user;
```

### 2. Variables de entorno

Editar `backend/.env`:

```env
BACKEND_PORT=5000
DATABASE_URL="postgresql://udemm_user:udemm_pass@localhost:5433/udemm_global?schema=public"

# SMTP — para recuperación de contraseña
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_contrasena_de_aplicacion
SMTP_FROM="UDEMM Global <no-reply@udemm.edu.ar>"
FRONTEND_URL=http://localhost:3000

FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> **Gmail**: Activar verificación en 2 pasos → Contraseñas de aplicación → generar una para "Correo".

### 3. Backend

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Credenciales de demo

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@udemm.edu.ar` | `Admin1234!` |
| Decano | `decano@udemm.edu.ar` | `Decano123!` |
| Rectorado | `rectorado@udemm.edu.ar` | `Rectorado123!` |

---

## Endpoints principales

Base URL: `http://localhost:5000`

### Autenticación (pública)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/refresh` | Renovar token |
| POST | `/auth/solicitar-recuperacion` | Enviar email de recuperación |
| POST | `/auth/restablecer-contrasena` | Establecer nueva contraseña |

### Docentes (requiere JWT + rol)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/docentes` | Listado con filtros y paginación |
| POST | `/docentes` | Crear docente |
| GET | `/docentes/:id` | Detalle de docente |
| PATCH | `/docentes/:id` | Actualizar docente |
| DELETE | `/docentes/:id` | Baja lógica |
| GET | `/docentes/mi-ficha` | Ficha del docente autenticado |
| PATCH | `/docentes/mi-ficha` | Guardar ficha propia |

### Configuración (requiere ADMINISTRADOR_SISTEMA)
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PATCH/DELETE | `/configuracion/usuarios` | Gestión de usuarios |
| GET/PATCH | `/configuracion/roles` | Gestión de roles |
| GET/PATCH | `/configuracion/parametros` | Parámetros generales |

---

## Rutas del frontend

| Ruta | Descripción |
|---|---|
| `/` | Dashboard principal (por rol) |
| `/login` | Inicio de sesión |
| `/restablecer-contrasena` | Nueva contraseña (desde email) |
| `/docentes` | Listado de docentes |
| `/docentes/nuevo` | Alta de docente |
| `/docentes/[id]` | Ficha detallada |
| `/docentes/[id]/editar` | Edición de datos básicos |
| `/docentes/mi-ficha` | Legajo propio (rol DOCENTE) |
| `/docentes/aprobaciones` | Bandeja de aprobaciones |
| `/configuracion` | Panel de configuración |
| `/configuracion/usuarios` | Gestión de usuarios |
| `/configuracion/roles` | Gestión de roles |
| `/configuracion/parametros` | Parámetros institucionales |

---

## Docker

```bash
docker compose up --build
```

- Backend: `http://localhost:5000/health`
- Frontend: `http://localhost:3000`
