# UDEMM Global

Proyecto de tesis - Fase 3: Módulo Docentes.

## Objetivo
Crear una plataforma institucional académica/documental para la Universidad UDEMM, orientada a procesos de acreditación CONEAU.

## Fase 3: Módulo Docentes
Completado en Fase 3:
- **Backend**: Endpoints CRUD para docentes con validación, búsqueda, paginación y baja lógica
- **Frontend**: Interfaz completa para gestión de docentes (listado, crear, editar, ver detalle)
- **RBAC**: Protección de endpoints por rol (ADMINISTRADOR_SISTEMA, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO, DECANO, RECTORADO)
- **Prisma**: Modelo Docente completo con todas las propiedades requeridas

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
- **Administrador:** `admin@udemm.edu.ar` / `Admin1234!`
- **Decano:** `decano@udemm.edu.ar` / `Decano123!`
- **Rectorado:** `rectorado@udemm.edu.ar` / `Rectorado123!`

## Módulo Docentes (Fase 3)

### Endpoints disponibles
Todos requieren autenticación JWT y están protegidos por roles.

#### POST /docentes
Crear un nuevo docente. Requiere rol: ADMINISTRADOR_SISTEMA, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO.

Body:
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "tipoDocumento": "DNI",
  "numeroDocumento": "25123456",
  "correoElectronico": "juan@example.com",
  "telefono": "011123456",
  "domicilio": "Calle Principal 123",
  "tituloGrado": "Licenciado en Informática",
  "tituloPosgrado": "Máster en Sistemas",
  "cargoDeclarado": "Profesor Titular",
  "justificacionPertinencia": "Especialista en el tema",
  "actividadesProfesionales": "Investigación en IA",
  "antecedentesAcademicos": "20 años de experiencia docente"
}
```

#### GET /docentes
Listar docentes con búsqueda y paginación. Requiere rol: ADMINISTRADOR_SISTEMA, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO.

Query parameters:
- `buscar` o `busqueda`: texto de búsqueda (nombre, apellido, email, documento)
- `page` o `pagina`: número de página (default: 1)
- `limit` o `limite`: cantidad por página (default: 10)
- `activo`: filtro por estado (true/false)

Ejemplo: `GET /docentes?buscar=juan&page=1&limit=10&activo=true`

#### GET /docentes/:id
Obtener detalle de un docente. Requiere rol: ADMINISTRADOR_SISTEMA, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO.

#### PATCH /docentes/:id
Actualizar un docente. Requiere rol: ADMINISTRADOR_SISTEMA, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO.

Body: los mismos campos que POST (todos opcionales).

#### DELETE /docentes/:id
Baja lógica de docente (no elimina el registro, solo establece `activo=false`). Requiere rol: ADMINISTRADOR_SISTEMA, DECANO, RECTORADO, SECRETARIA_ACADEMICA.

### Rutas del Frontend
- `/docentes` — Listado de docentes con búsqueda y paginación
- `/docentes/nuevo` — Formulario para crear nuevo docente
- `/docentes/[id]` — Ficha detallada del docente
- `/docentes/[id]/editar` — Formulario para editar docente

### Características del módulo
- ✓ Búsqueda por nombre, apellido, correo o documento
- ✓ Paginación configurable
- ✓ Baja lógica (activo = false)
- ✓ Validación de unicidad de email y documento
- ✓ Protección por roles RBAC
- ✓ Mensajes de error/éxito en UI
- ✓ Interfaz responsive con diseño institucional UDEMM

### Probar el módulo Docentes
1. **Login**: Acceder a http://localhost:3000 con admin@udemm.edu.ar / Admin1234!
2. **Token**: Copiar el JWT del localStorage a `accessToken`
3. **Listado**: Navegar a http://localhost:3000/docentes
4. **Crear**: Hacer clic en "Nuevo docente" y completar el formulario
5. **Ver detalle**: Hacer clic en un docente de la tabla
6. **Editar**: Hacer clic en "Editar" desde la ficha
7. **Baja lógica**: Hacer clic en "Dar de baja" (requiere confirmación)

### Respuesta típica GET /docentes
```json
{
  "data": [
    {
      "id": "uuid...",
      "nombre": "Juan",
      "apellido": "Pérez",
      "tipoDocumento": "DNI",
      "numeroDocumento": "25123456",
      "correoElectronico": "juan@example.com",
      "telefono": "011123456",
      "domicilio": "Calle Principal 123",
      "tituloGrado": "Licenciado en Informática",
      "tituloPosgrado": "Máster en Sistemas",
      "cargoDeclarado": "Profesor Titular",
      "justificacionPertinencia": "Especialista en el tema",
      "actividadesProfesionales": "Investigación en IA",
      "antecedentesAcademicos": "20 años de experiencia",
      "activo": true,
      "fechaCreacion": "2026-05-27T...",
      "fechaActualizacion": "2026-05-27T...",
      "usuario": {
        "id": "uuid...",
        "correoElectronico": "admin@udemm.edu.ar",
        "rol": {
          "id": "uuid...",
          "nombre": "ADMINISTRADOR_SISTEMA"
        }
      }
    }
  ],
  "total": 1,
  "pagina": 1,
  "limite": 10
}
```
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

<<<<<<< ours
## Notas de implementación
- Fase 3 completada: Módulo Docentes con CRUD completo
- Auth y RBAC funcionales
- PostgreSQL local con Prisma
- Frontend con Next.js 14 app router
- Backend NestJS modular
- No se implementan módulos futuros aún (materias, carga horaria, reportes, etc.)
- Las futuras extensiones pueden usar la estructura base como referencia
=======
## Notas de la Fase 1
- Se ha preparado arquitectura base con health checks.
- No se implementan aún funcionalidades como login, JWT, CRUDs, formularios, carga de archivos, reportes ni lógica de negocio.
- Se define esquema inicial de Prisma con la jerarquía institucional.

## Solución de errores de Fast Refresh o conflictos
Si Next.js muestra `Merge conflict marker encountered` en `frontend/app/page.tsx`, abrir ese archivo y eliminar cualquier línea `<<<<<<<`, `=======` o `>>>>>>>` que haya quedado de un merge. La versión esperada de la home debe comenzar con `export default function Home()`.

Si después de corregir el archivo aparece un error de caché como `webpack.cache.PackFileCacheStrategy` o un `hot-update.json` con estado 500, limpiar la caché local de Next.js y reiniciar el servidor:

```bash
cd frontend
npm run dev:clean
```
>>>>>>> theirs
