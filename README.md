# UDEMM Global

Proyecto de tesis - Fase 1: Arquitectura Base & Setup Inicial.

## Objetivo
Crear una plataforma institucional académica/documental para la Universidad UDEMM, orientada a procesos de acreditación CONEAU.

## Arquitectura
- Frontend: Next.js + TypeScript + TailwindCSS
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL
- ORM: Prisma
- Contenedores: Docker + Docker Compose

## Estructura de carpetas
- `frontend/` — aplicación Next.js con diseño base y TailwindCSS
- `backend/` — aplicación NestJS modular y configuración Prisma
- `docker-compose.yml` — orquestación de servicios
- `.env.example` — variables de entorno base

## Scripts principales
Desde `frontend/`:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`

Desde `backend/`:
- `npm install`
- `npm run start:dev`
- `npm run build`
- `npm run prisma:generate`

## Docker
Levantar la plataforma completa:

```bash
docker compose up --build
```

## Variables de entorno
- Copiar `backend/.env.example` a `backend/.env` para desarrollo local usando PostgreSQL instalado en Windows.
- Copiar `.env.example` a `.env` solo cuando se use Docker Compose con el servicio `postgres`.

## Modo local sin Docker
Este proyecto conserva PostgreSQL como base de datos principal.
- No se migró a SQLite.
- Prisma mantiene `provider = "postgresql"`.
- Docker y Docker Compose quedan como opción futura.

### Configuración de PostgreSQL local en Windows
1. Abrir un terminal de PostgreSQL o PowerShell con `psql`.
2. Crear el usuario y la base de datos:
   ```sql
   CREATE USER udemm_user WITH PASSWORD 'udemm_pass';
   CREATE DATABASE udemm_global OWNER udemm_user;
   GRANT ALL PRIVILEGES ON DATABASE udemm_global TO udemm_user;
   ```
3. Si su instalación usa un usuario distinto, ajuste `backend/.env` en `DATABASE_URL`.

### Ejecución local
1. Backend:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init
   npm run prisma:seed
   npm run start:dev
   ```
2. Frontend (en otra terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Verificación de servicios
### Backend (NestJS)
- **URL base:** `http://localhost:5000`
- **GET /**: Devuelve información de la API
- **GET /health**: Devuelve el estado del servicio
- **POST /auth/login**: Autenticación con `correoElectronico` y `contrasena`
- **POST /auth/refresh**: Renovación de token con `refreshToken`
- **GET /usuarios**: Lista usuarios (puede protegerse con roles)
- **GET /roles**: Lista roles disponibles

### Credenciales iniciales
- **Correo:** `admin@udemm.edu.ar`
- **Contraseña:** `Administrador123`

Ejemplo de respuesta en `/health`:
```json
{
  "status": "ok",
  "service": "udemm-global-backend",
  "timestamp": "2026-05-21T20:00:00.000Z",
  "version": "0.1.0"
}
```

### Frontend (Next.js)
- **URL:** `http://localhost:3000`
- Muestra página de bienvenida con identidad visual UDEMM

## Docker Compose
Para levantar todos los servicios con Docker en el futuro:
```bash
docker compose up --build
```

Verificar:
- Backend: `http://localhost:5000/health`
- Frontend: `http://localhost:3000`

## Notas de la Fase 1
- Se ha preparado arquitectura base con health checks.
- No se implementan aún funcionalidades como login, JWT, CRUDs, formularios, carga de archivos, reportes ni lógica de negocio.
- Se define esquema inicial de Prisma con la jerarquía institucional.
