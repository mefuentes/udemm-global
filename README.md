# UDEMM Global

Plataforma integrada de gestión académica, documental e institucional desarrollada para la Universidad de la Marina Mercante, en el marco del Proyecto Integrador de la carrera Ingeniería en Sistemas.

---

## Descripción del proyecto

Las instituciones universitarias requieren centralizar, organizar y gestionar grandes volúmenes de información académica y docente, especialmente en contextos de evaluación y acreditación institucional. UDEMM Global responde a esa necesidad mediante un sistema web que integra en una sola plataforma la gestión del cuerpo docente, la administración de planes de estudio y programas de asignatura, el seguimiento de vinculaciones a cátedra, y el repositorio de normativas institucionales.

El sistema permite a los actores institucionales —docentes, personal administrativo, directivos y autoridades— acceder a la información que les compete, con control de acceso basado en roles, flujos de aprobación, trazabilidad de cambios y generación de documentación exportable.

---

## Objetivos

### Objetivo general

Desarrollar una plataforma web integral que permita gestionar y centralizar la información académica e institucional de la Universidad de la Marina Mercante, facilitando los procesos de administración docente, gestión curricular y organización documental.

### Objetivos específicos

- Implementar un sistema de gestión del legajo docente con soporte para múltiples secciones de información y exportación a PDF.
- Administrar planes de estudio, asignaturas, correlatividades y programas de asignatura con ciclo de vida completo.
- Gestionar la vinculación de docentes a cátedras con flujo de aprobación y trazabilidad.
- Proveer un repositorio de normativas institucionales con control de vigencia, historial de estados y auditoría.
- Implementar un sistema de roles y permisos (RBAC) que garantice el acceso diferenciado por perfil de usuario.
- Centralizar la administración de usuarios, roles, tablas maestras y parámetros institucionales.

---

## Arquitectura del sistema

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js (App Router) | 14.2.5 |
| Framework UI | React | 18.3.1 |
| Lenguaje | TypeScript | 5.6.2 |
| Estilos | Tailwind CSS | 3.4.4 |
| Generación PDF (cliente) | jsPDF | 4.2.1 |
| Backend | NestJS | 10.x |
| ORM | Prisma | 5.13.0 |
| Base de datos | PostgreSQL | 14+ |
| Autenticación | Passport.js + JWT | — |
| Hashing contraseñas | bcrypt | 5.x |
| Generación PDF (servidor) | pdfkit | 0.19.x |
| Exportación Excel | ExcelJS | 4.4.x |
| Envío de correo | Nodemailer | 8.x |
| Almacenamiento de archivos | Sistema de archivos local | — |

El frontend y el backend se desarrollan como aplicaciones independientes dentro del mismo repositorio. Se comunican mediante una API REST sobre HTTP.

---

## Diagrama de arquitectura

```mermaid
graph LR
    subgraph Cliente
        B[Navegador Web\nNext.js 14]
    end

    subgraph Servidor
        A[API REST\nNestJS + Passport]
        C[Prisma ORM]
        D[(PostgreSQL)]
        E[Storage local\nbackend/storage/]
    end

    B -->|HTTP + JWT| A
    A --> C
    C --> D
    A -->|archivos PDF| E
    A -->|correo| F[SMTP externo]
```

---

## Módulos del sistema

### Gestión de Docentes

Administración del padrón de docentes institucionales. Permite registrar docentes, buscarlos mediante filtros por nombre, apellido, tipo de documento y estado, editarlos y darlos de baja en forma lógica. Incluye paginación de resultados. Los usuarios con rol `DOCENTE` se sincronizan automáticamente con su registro en la tabla de docentes.

### Mi Ficha Docente

Legajo personal del docente organizado en diez secciones:

| Sección | Contenido |
|---|---|
| 1 | Datos personales, identificación y domicilio |
| 2 | Títulos de grado, posgrado y formación docente |
| 3 | Situación de revista — cargo actual en la institución |
| 4 | Área de desempeño y función de gestión académica |
| 5 | Docencia universitaria — situación actual y vinculaciones aprobadas |
| 6 | Extensión y vinculación institucional |
| 7 | Investigación y producción científica |
| 8 | Reuniones científicas y comités |
| 9 | Comités, jurados y evaluaciones |
| 10 | Otra información — carrera docente, distinciones, estancias |

Cada sección permite carga, edición y persistencia independiente. La ficha completa puede exportarse en formato PDF.

### Vinculación a Cátedra

Registro y seguimiento de la vinculación de docentes a asignaturas y cátedras dentro de un plan de estudios. Cada vinculación incluye: facultad, carrera, plan de estudio, asignatura, cátedra, cargo docente, modalidad, designación, horas semanales y año de inicio. El ciclo de vida abarca los estados `PENDIENTE_DE_APROBACION`, `APROBADA` y `RECHAZADA`, con soporte para desvinculación registrada. Las vinculaciones aprobadas se reflejan en la sección de docencia universitaria de la Ficha Docente.

### Bandeja de Aprobaciones

Centro de novedades y gestión de solicitudes. Los docentes visualizan y responden solicitudes de aprobación de sus vinculaciones. Los usuarios administrativos y de gestión acceden a las solicitudes pendientes de revisión. Incluye sistema de notificaciones por tipo de evento (vinculación, aprobación, rechazo, desvinculación).

### Plan de Estudios

Administración de planes curriculares con la siguiente jerarquía: Facultad → Carrera → Plan de Estudio → Asignatura. Incluye gestión de correlatividades entre asignaturas (tipo cursado/aprobado), información de planes y malla curricular.

### Programas de Asignatura

Ciclo de vida completo del programa de cada asignatura: fundamentación, objetivos generales y específicos, contenidos temáticos, contenidos sintéticos, unidades didácticas, formación práctica, metodología de enseñanza, bibliografía básica y complementaria, criterios e instrumentos de evaluación, requisitos de aprobación, y competencias vinculadas al perfil del titulado. El programa tiene estados propios (PENDIENTE, EN_REVISION, APROBADO) por sección y globalmente. Se registra historial de cambios por usuario.

### Gestión Académica

Administración de las unidades académicas: creación y edición de facultades y carreras con sus atributos (código, modalidad, título otorgado, duración, estado).

### Repositorio de Normativas

Repositorio institucional de normativas, resoluciones, reglamentos y disposiciones, organizado por tipo de normativa (categoría). Funcionalidades implementadas:

- Alta de normativas con número de norma, año, área emisora, fecha de emisión, palabras clave y estado de vigencia inicial.
- Adjunto de archivo PDF por normativa (almacenamiento local, límite de 20 MB).
- Edición de datos de la normativa.
- Visualización y descarga del archivo adjunto.
- Cambio de estado de vigencia: VIGENTE, DEROGADA, SUSPENDIDA, REEMPLAZADA.
- Sucesión de normativas: una normativa puede designar a otra como su sucesora al ser reemplazada.
- Historial de estados con motivo, normativa sucesora y usuario responsable.
- Eliminación lógica con registro de motivo y cuarentena del archivo en directorio separado.
- Exportación del listado a PDF y Excel.
- Filtros por tipo, vigencia, número de norma, año, área emisora y texto libre.
- Auditoría completa de operaciones: acción, usuario, IP de origen y detalle del cambio.
- Control de acceso diferenciado: todos los roles autenticados pueden consultar; los roles de gestión (ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, DECANO, RECTORADO) pueden crear, editar, cambiar estado y eliminar.

### Configuración del Sistema

- **Usuarios**: creación, edición, activación y desactivación de usuarios del sistema con asignación de rol.
- **Roles**: listado de roles con cantidad de usuarios asignados y opción de activar/desactivar.
- **Parámetros Generales**: configuración institucional centralizada (nombre de la institución, sigla, correo oficial, datos de contacto).
- **Tablas Maestras**: administración de los catálogos utilizados en vinculaciones: cátedras, cargos docentes, designaciones y modalidades.
- **Áreas Disciplinares y Subáreas**: clasificación disciplinar del cuerpo docente.

### Autenticación

- Inicio de sesión con email y contraseña.
- Recuperación de contraseña mediante enlace enviado por correo electrónico (validez de 1 hora, uso único).

---

## Roles y control de acceso

El sistema implementa RBAC (Control de Acceso Basado en Roles) con siete perfiles predefinidos:

| Rol | Responsabilidad principal |
|---|---|
| `ADMINISTRADOR_SISTEMA` | Acceso completo: gestión de usuarios, roles, tablas maestras, parámetros, todos los módulos académicos y el repositorio de normativas. |
| `SECRETARIA_ACADEMICA` | Gestión docente, vinculaciones, normativas (gestión completa), tablas maestras, plan de estudios y gestión académica. |
| `DECANO` | Consulta y gestión del cuerpo docente, vinculaciones, normativas, plan de estudios y gestión académica. |
| `RECTORADO` | Mismas capacidades que Decano. |
| `DIRECTOR_CARRERA` | Consulta de docentes, plan de estudios, gestión académica, tablas maestras y repositorio de normativas. |
| `ADMINISTRATIVO` | Alta y gestión de docentes, bandeja de aprobaciones, plan de estudios, gestión académica y repositorio de normativas. |
| `DOCENTE` | Gestión de su propia ficha, respuesta a solicitudes de vinculación en la bandeja, plan de estudios y consulta del repositorio de normativas. |

### Matriz de acceso por módulo

| Módulo | DOCENTE | ADMINISTRATIVO | DIRECTOR_CARRERA | SECRETARIA_ACADEMICA | DECANO | RECTORADO | ADMINISTRADOR_SISTEMA |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Mi Ficha Docente | ✓ | | | | | | |
| Listado de Docentes | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alta y edición de Docentes | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vinculación a Cátedra (consulta) | ✓ | | | ✓ | ✓ | ✓ | ✓ |
| Vinculación a Cátedra (gestión) | | | | ✓ | ✓ | ✓ | ✓ |
| Bandeja de Aprobaciones | ✓ | ✓ | | | | | ✓ |
| Plan de Estudios | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gestión Académica | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Repositorio de Normativas (consulta) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Repositorio de Normativas (gestión) | | | | ✓ | ✓ | ✓ | ✓ |
| Configuración — Usuarios y Roles | | | | | | | ✓ |
| Configuración — Tablas Maestras | | | ✓ | ✓ | | | ✓ |
| Configuración — Parámetros | | | | | | | ✓ |

---

## Autenticación y seguridad

- **JWT**: el acceso a la API requiere un token de acceso firmado con `JWT_SECRET`. Los tokens tienen expiración configurable mediante `JWT_EXPIRES_IN`.
- **Refresh token**: al iniciar sesión se emite un token de renovación de larga duración (`REFRESH_TOKEN_EXPIRES_DAYS`), almacenado en base de datos y asociado al usuario.
- **Guards NestJS**: todos los endpoints de la API (excepto login y recuperación de contraseña) están protegidos por `JwtAuthGuard` y `RolesGuard`. El guard de roles verifica el nombre del rol del usuario autenticado contra los roles permitidos por cada endpoint.
- **Hashing de contraseñas**: las contraseñas se almacenan con bcrypt (factor de costo 10). Nunca se persiste la contraseña en texto plano.
- **Recuperación de contraseña**: se genera un token único de un solo uso, almacenado en la base de datos con expiración de una hora, y se envía al correo del usuario mediante enlace HTTPS. El token se invalida tras su uso.
- **Validación de entrada**: se aplica `ValidationPipe` con `whitelist: true` en todos los controladores, descartando campos no declarados en los DTOs.
- **Variables sensibles**: los secretos (`JWT_SECRET`, `DATABASE_URL`, credenciales SMTP) se gestionan exclusivamente mediante variables de entorno y nunca se incluyen en el repositorio.

---

## Modelo de datos

Las principales entidades del sistema y sus relaciones:

```mermaid
erDiagram
    Universidad ||--o{ Facultad : "tiene"
    Facultad ||--o{ Carrera : "ofrece"
    Carrera ||--o{ PlanEstudio : "tiene"
    PlanEstudio ||--o{ Materia : "contiene"
    Materia ||--o| ProgramaAsignatura : "tiene"
    Materia ||--o{ Correlatividad : "referencia"

    Rol ||--o{ Usuario : "asignado a"
    Usuario ||--o| Docente : "vinculado a"

    Docente ||--o{ VinculacionCatedra : "participa en"
    Facultad ||--o{ VinculacionCatedra : "referenciada en"
    Carrera ||--o{ VinculacionCatedra : "referenciada en"
    PlanEstudio ||--o{ VinculacionCatedra : "referenciada en"
    Materia ||--o{ VinculacionCatedra : "referenciada en"
    Catedra ||--o{ VinculacionCatedra : "referenciada en"
    Cargo ||--o{ VinculacionCatedra : "referenciada en"
    Designacion ||--o{ VinculacionCatedra : "referenciada en"
    Modalidad ||--o{ VinculacionCatedra : "referenciada en"

    TipoNormativa ||--o{ Normativa : "clasifica"
    Normativa ||--o{ HistorialEstadoNormativa : "registra"
    Normativa ||--o{ AuditLogNormativa : "audita"

    AreaDisciplinar ||--o{ Subarea : "contiene"
    AreaDisciplinar ||--o{ Docente : "clasifica"
```

**Entidades principales:**

- `Usuario` — cuenta de acceso al sistema con email, contraseña hash y rol.
- `Rol` — perfil de acceso (ADMINISTRADOR_SISTEMA, DOCENTE, etc.).
- `Docente` — legajo del docente con datos personales, académicos y profesionales. Puede vincularse a un `Usuario`.
- `Facultad`, `Carrera`, `PlanEstudio`, `Materia` — jerarquía curricular.
- `ProgramaAsignatura` — programa académico asociado a una asignatura.
- `VinculacionCatedra` — vinculación de un docente a una asignatura en un plan de estudios, con estados de aprobación.
- `Normativa` — documento normativo institucional con control de vigencia, historial y archivo.
- `Catedra`, `Cargo`, `Designacion`, `Modalidad` — tablas maestras para la vinculación.
- `AreaDisciplinar`, `Subarea` — clasificación disciplinar del cuerpo docente.
- `AuditLogNormativa` — registro de auditoría de operaciones sobre normativas.

---

## Estructura del proyecto

```
UDEMM-GLOBAL/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/            # Login, refresh token, recuperación de contraseña
│   │   │   ├── users/           # Gestión de usuarios
│   │   │   ├── roles/           # Gestión de roles
│   │   │   ├── docentes/        # Legajo docente
│   │   │   ├── vinculaciones/   # Vinculación a cátedra
│   │   │   ├── normativas/      # Repositorio de normativas
│   │   │   ├── auditoria/       # Auditoría de normativas
│   │   │   ├── planes/          # Planes de estudio
│   │   │   ├── materias/        # Asignaturas
│   │   │   ├── programas/       # Programas de asignatura
│   │   │   ├── carreras/        # Carreras
│   │   │   ├── facultades/      # Facultades
│   │   │   ├── tablas-maestras/ # Cátedras, cargos, designaciones, modalidades
│   │   │   ├── areas-disciplinares/
│   │   │   ├── parametros/      # Parámetros generales
│   │   │   ├── notificaciones/  # Notificaciones a docentes
│   │   │   ├── storage/         # Gestión de archivos
│   │   │   └── health/          # Health check
│   │   └── common/              # Guards, decoradores, utilidades compartidas
│   ├── prisma/
│   │   ├── schema.prisma        # Modelo de datos
│   │   ├── migrations/          # Historial de migraciones
│   │   └── seed.ts              # Datos iniciales
│   ├── storage/
│   │   └── normativas/          # Archivos PDF de normativas
│   └── scripts/
│       └── free-port.js         # Libera el puerto 5000 antes de iniciar
├── frontend/
│   ├── app/                     # Rutas y páginas (Next.js App Router)
│   │   ├── page.tsx             # Panel de inicio (por rol)
│   │   ├── login/
│   │   ├── docentes/
│   │   │   └── mi-ficha/        # Ficha docente propia
│   │   ├── bandeja-aprobaciones/
│   │   ├── vinculaciones-catedra/
│   │   ├── repositorio-normativas/
│   │   ├── plan-estudios/
│   │   ├── gestion-academica/
│   │   └── configuracion/
│   ├── components/              # Componentes reutilizables (Sidebar, etc.)
│   └── lib/                     # Contextos (auth, sidebar, notificaciones)
└── scripts/                     # Scripts de utilidad del repositorio
```

---

## Requisitos previos

- **Node.js** 18 o superior
- **npm** 9 o superior
- **PostgreSQL** 14 o superior
- **Git**

---

## Configuración local

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd UDEMM-GLOBAL
```

### 2. Base de datos PostgreSQL

Crear la base de datos y el usuario:

```sql
CREATE USER udemm_user WITH PASSWORD 'udemm_pass';
CREATE DATABASE udemm_global OWNER udemm_user;
GRANT ALL PRIVILEGES ON DATABASE udemm_global TO udemm_user;
```

### 3. Variables de entorno del backend

Crear el archivo `backend/.env` con el siguiente contenido (ajustar valores según el entorno):

```env
BACKEND_PORT=5000
DATABASE_URL=postgresql://udemm_user:udemm_pass@localhost:5432/udemm_global

JWT_SECRET=cambiar_por_un_secreto_seguro
JWT_EXPIRES_IN=3600s
REFRESH_TOKEN_EXPIRES_DAYS=30

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=correo@dominio.com
SMTP_PASS=contrasena_de_aplicacion
SMTP_FROM="UDEMM Global <no-reply@udemm.edu.ar>"

FRONTEND_URL=http://localhost:3000
```

> Para Gmail: activar la verificación en dos pasos y generar una contraseña de aplicación desde la configuración de seguridad de la cuenta.

### 4. Variables de entorno del frontend

Crear el archivo `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 5. Instalar dependencias e inicializar el backend

```bash
cd backend
npm install
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
```

### 6. Instalar dependencias del frontend

```bash
cd ../frontend
npm install
```

### 7. Iniciar los servicios

En terminales separadas:

```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

El sistema estará disponible en:

- Frontend: `http://localhost:3000`
- API backend: `http://localhost:5000`

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `BACKEND_PORT` | Puerto del servidor NestJS | `5000` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://usuario:clave@host:puerto/db` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | Cadena aleatoria larga |
| `JWT_EXPIRES_IN` | Expiración del access token | `3600s` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Días de validez del refresh token | `30` |
| `SMTP_HOST` | Servidor SMTP para correos | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Cuenta de correo SMTP | `correo@dominio.com` |
| `SMTP_PASS` | Contraseña de aplicación SMTP | — |
| `SMTP_FROM` | Remitente en los correos enviados | `"Sistema <no-reply@dominio>"` |
| `FRONTEND_URL` | URL base del frontend (para enlaces en emails) | `http://localhost:3000` |

### Frontend (`frontend/.env.local`)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API backend | `http://localhost:5000` |

---

## Puertos

| Servicio | Puerto por defecto |
|---|---|
| Frontend (Next.js) | 3000 |
| Backend (NestJS) | 5000 |
| PostgreSQL | 5432 |

---

## Comandos útiles

### Backend

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Inicia el backend en modo desarrollo con recarga automática |
| `npm run build` | Compila el proyecto TypeScript a JavaScript |
| `npm run start` | Inicia el servidor compilado (producción) |
| `npm run port:free` | Libera el puerto 5000 si está ocupado |
| `npm run prisma:generate` | Genera el cliente Prisma a partir del schema |
| `npm run prisma:seed` | Ejecuta el seed de datos iniciales |

### Frontend

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el frontend en modo desarrollo |
| `npm run build` | Compila el frontend para producción |
| `npm run start` | Inicia el frontend compilado (producción) |
| `npm run clean` | Elimina el caché de compilación `.next` |
| `npm run dev:clean` | Limpia el caché y reinicia en modo desarrollo |

---

## Migraciones y Prisma

Prisma y el schema de base de datos se encuentran en `backend/prisma/`. Todos los comandos de Prisma deben ejecutarse desde el directorio `backend`.

```bash
cd backend

# Aplicar migraciones existentes al esquema de base de datos
npx prisma migrate deploy

# Regenerar el cliente Prisma (necesario tras cambios en el schema)
npm run prisma:generate

# Cargar datos iniciales
npm run prisma:seed
```

> `prisma migrate deploy` aplica las migraciones pendientes sin generar nuevas. Es el comando adecuado para entornos de desarrollo y producción cuando las migraciones ya están creadas. No ejecutar `prisma migrate reset` en entornos con datos reales.

---

## Desarrollo

### Backend

El backend usa `ts-node-dev` con la opción `--respawn`, por lo que recarga automáticamente ante cambios en el código fuente. El script `prestart:dev` libera el puerto 5000 antes de iniciar para evitar conflictos.

```bash
cd backend
npm run start:dev
```

Para compilar y verificar errores de TypeScript sin iniciar el servidor:

```bash
npm run build
```

### Frontend

El frontend usa el servidor de desarrollo integrado de Next.js:

```bash
cd frontend
npm run dev
```

Si el servidor no levanta correctamente, limpiar el caché:

```bash
npm run dev:clean
```

### Rutas principales del frontend

| Ruta | Descripción |
|---|---|
| `/` | Panel de inicio, módulos según rol |
| `/login` | Inicio de sesión |
| `/restablecer-contrasena` | Restablecimiento de contraseña (desde enlace de email) |
| `/docentes` | Listado de docentes |
| `/docentes/nuevo` | Alta de docente |
| `/docentes/[id]` | Ficha detallada del docente |
| `/docentes/mi-ficha` | Legajo propio (rol DOCENTE) |
| `/bandeja-aprobaciones` | Bandeja de aprobaciones |
| `/vinculaciones-catedra` | Gestión de vinculaciones a cátedra |
| `/repositorio-normativas` | Repositorio de normativas institucionales |
| `/plan-estudios/carreras` | Planes de estudio por carrera |
| `/plan-estudios/programas-asignatura` | Programas de asignatura |
| `/plan-estudios/informacion-planes` | Información de planes |
| `/gestion-academica/facultades` | Gestión de facultades |
| `/gestion-academica/carreras` | Gestión de carreras |
| `/configuracion/usuarios` | Gestión de usuarios |
| `/configuracion/roles` | Gestión de roles |
| `/configuracion/parametros` | Parámetros institucionales |
| `/configuracion/tablas-maestras` | Tablas maestras |

---

## Estado del proyecto

El sistema se encuentra en desarrollo activo. Los módulos principales están implementados y funcionales: gestión de docentes y legajo docente, plan de estudios y programas de asignatura, vinculación a cátedra con flujo de aprobación, repositorio de normativas, y el sistema de roles y configuración. Se continúa incorporando mejoras, refinamientos de interfaz y funcionalidades adicionales según el alcance del Proyecto Integrador.

---

## Equipo de desarrollo

**Proyecto Integrador — Ingeniería en Sistemas**
Universidad de la Marina Mercante

| Integrantes |
|---|
| Huilen Leporis |
| Kevin Libora |
| Mariano Fuentes |

