# UDEMM GLOBAL
## Manual Funcional de Usuario
**Versión de pruebas**
**Fecha: septiembre de 2026**

---

## ÍNDICE

1. Introducción
2. Ingreso al sistema
3. Gestión de usuarios
4. Repositorio de normativas
5. Vinculación de una materia a un docente
6. Circuito del docente — aprobar materias asignadas
7. Mi Ficha Docente
8. Docencia universitaria y materias aprobadas
9. Ejemplo completo de principio a fin
10. Guía rápida para pruebas
11. Cómo reportar un error

---

## 1. INTRODUCCIÓN

UDEMM Global es el sistema de gestión académica institucional de la UDEMM. Permite administrar docentes, normativas, planes de estudio, vinculaciones a cátedra y fichas académicas de cada docente.

Las opciones visibles en el menú lateral dependen del rol asignado al usuario. Un docente verá su propia ficha y su bandeja de aprobaciones. Un administrador tendrá acceso a toda la configuración del sistema.

---

## 2. INGRESO AL SISTEMA

### INICIAR SESIÓN

**Rol:** Cualquier usuario registrado
**Ruta:** Página de inicio de la aplicación
**Objetivo:** Autenticarse en el sistema

**Pasos:**
1. Ingresar la dirección de la aplicación en el navegador.
2. En el campo **Correo electrónico** escribir el correo institucional (ej: `usuario@udemm.edu.ar`).
3. En el campo **Contraseña** escribir la contraseña asignada.
4. Presionar el botón **Iniciar sesión**.
5. El sistema redirige automáticamente al inicio una vez que las credenciales son válidas.

**Resultado esperado:** El usuario ingresa al sistema y ve el menú lateral con las opciones habilitadas para su rol.

**Observaciones:**
- Si las credenciales no son válidas, el sistema muestra un mensaje de error en rojo bajo los campos. Verificar correo y contraseña, y volver a intentar.
- Para entornos de prueba: usar `admin@udemm.edu.ar` con contraseña `Admin1234!`.

---

### RECUPERAR CONTRASEÑA

**Pasos:**
1. En la pantalla de login, hacer clic en **¿Olvidaste tu contraseña?**
2. Ingresar el correo electrónico registrado.
3. Presionar **Enviar enlace de recuperación**.
4. El sistema confirma el envío con el mensaje: *"Revisá tu correo"*.

**Resultado esperado:** Si el correo está registrado, se recibe un enlace de recuperación válido por 1 hora. Revisar también la carpeta de spam.

---

### CERRAR SESIÓN

**Pasos:**
1. En el menú lateral o encabezado, buscar el ícono o botón de cierre de sesión.
2. Hacer clic en **Cerrar sesión**.
3. El sistema regresa a la pantalla de login.

---

## 3. GESTIÓN DE USUARIOS

**Rol:** Administrador del sistema
**Ruta:** Menú lateral → Configuración → Usuarios

---

### 3.1 Crear usuario

**Objetivo:** Registrar un nuevo usuario en el sistema

**Pasos:**
1. Ingresar a **Configuración → Usuarios**.
2. Presionar el botón **Nuevo usuario** (esquina superior derecha).
3. Se abre un modal con el formulario.
4. Completar los campos:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Nombre | Nombre del usuario | Sí |
| Apellido | Apellido del usuario | Sí |
| Email | Correo electrónico institucional | Sí |
| Contraseña | Contraseña de acceso | Sí (en creación) |
| Rol | Seleccionar el rol desde la lista desplegable | Sí |

5. Presionar el botón **Guardar**.

**Resultado esperado:** El sistema muestra el mensaje *"Usuario creado."* y el nuevo usuario aparece en la tabla.

**Observaciones:**
- El campo Contraseña es obligatorio únicamente al crear. Al editar, dejarlo vacío preserva la contraseña existente.
- El Rol se elige de una lista de opciones ya configuradas.

---

### 3.2 Editar usuario

**Objetivo:** Modificar los datos de un usuario existente

**Pasos:**
1. Ingresar a **Configuración → Usuarios**.
2. Localizar el usuario en la tabla.
3. En la columna **Acciones**, presionar el botón **Editar**.
4. Se abre el mismo modal con los datos actuales cargados.
5. Modificar los campos necesarios (Nombre, Apellido, Email, Rol). La Contraseña puede dejarse vacía para no cambiarla.
6. Presionar **Guardar**.

**Resultado esperado:** El sistema muestra el mensaje *"Usuario actualizado."* y los datos se reflejan en la tabla.

---

### 3.3 Activar o desactivar usuario

**Objetivo:** Habilitar o inhabilitar el acceso de un usuario al sistema

**Pasos:**
1. Ingresar a **Configuración → Usuarios**.
2. Localizar el usuario en la tabla.
3. En la columna **Acciones**, presionar:
   - **Desactivar**: si el usuario está activo (aparece en rojo/naranja).
   - **Activar**: si el usuario está inactivo (aparece en verde).
4. El sistema actualiza el estado inmediatamente.

**Resultado esperado:** La columna **Estado** cambia entre **Activo** (verde) e **Inactivo** (rojo).

**Observaciones:**
- Un usuario inactivo no puede iniciar sesión en el sistema.
- Esta acción no elimina al usuario ni sus datos.

---

### Filtros disponibles en Usuarios

La pantalla de usuarios incluye tres filtros combinables:

- **Buscar:** texto libre para buscar por nombre, apellido o email.
- **Todos los roles:** desplegable para filtrar por rol.
- **Todos los estados:** desplegable para ver solo Activos o Inactivos.

---

## 4. REPOSITORIO DE NORMATIVAS

**Rol:** Administrador del sistema (para cargar y editar). Cualquier usuario con acceso puede consultar.
**Ruta:** Menú lateral → Repositorio de Normativas

---

### 4.1 Cargar una nueva normativa

**Objetivo:** Registrar un nuevo documento normativo en el sistema

**Pasos:**
1. Ingresar a **Repositorio de Normativas**.
2. Presionar el botón **Nueva normativa** o equivalente de ingreso al formulario de creación.
3. Completar los campos de la sección **INFORMACIÓN PRINCIPAL**:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Título | Nombre completo de la normativa (máx. 200 caracteres) | Sí |
| Tipo de normativa | Seleccionar de la lista (ej: Resolución, Ordenanza) | Sí |

4. Completar los campos de la sección **IDENTIFICACIÓN**:

| Campo | Descripción | Obligatorio |
|---|---|---|
| N° de norma | Número de la norma (solo dígitos, ej: 002, 31, 4702) | Sí |
| Año (2 dígitos) | Últimos dos dígitos del año (ej: 26 para 2026) | Sí |
| Fecha de emisión | Fecha de emisión del documento (no puede ser futura) | Sí |
| Área emisora | Seleccionar el área que emitió la normativa | Sí |
| Vigencia | Estado de vigencia: VIGENTE, DEROGADA, SUSPENDIDA o REEMPLAZADA | Sí |

5. Opcionalmente, en la sección **PALABRAS CLAVE**: escribir etiquetas y presionar Enter o coma para agregarlas. Backspace elimina la última etiqueta.

6. En la sección **ARCHIVO PDF**: hacer clic en la zona de carga o arrastrar el archivo PDF sobre ella.

**IMPORTANTE:** Solo se admiten archivos en formato `.pdf`, con un tamaño máximo de **15 MB**. El archivo PDF es **obligatorio** al crear una normativa.

7. Presionar el botón **REGISTRAR NORMATIVA**.

**Resultado esperado:** El sistema muestra el mensaje *"NORMATIVA REGISTRADA CORRECTAMENTE."* y redirige a la vista del tipo de normativa correspondiente.

---

### 4.2 Consultar una normativa

**Objetivo:** Buscar y visualizar normativas registradas

**Pasos:**
1. Ingresar a **Repositorio de Normativas**.
2. Explorar por categoría/tipo de normativa o usar los filtros disponibles para buscar por título, número, año u otros criterios.
3. Hacer clic en la normativa de interés.

**Resultado esperado:** Se accede a la vista de detalle con todos los datos registrados.

---

### 4.3 Visualizar el PDF

**Objetivo:** Abrir el documento PDF adjunto a una normativa

**Pasos:**
1. Ingresar al detalle de una normativa.
2. Presionar el botón **VER DOCUMENTO**.
3. El PDF se abre en una nueva pestaña del navegador.

**Resultado esperado:** El documento PDF se muestra en el navegador.

---

### 4.4 Editar una normativa

**Objetivo:** Modificar los datos de una normativa existente

**Pasos:**
1. Ingresar al detalle de la normativa a modificar.
2. Buscar y presionar el botón de edición disponible en la vista.
3. El formulario se carga con los datos actuales.
4. Modificar los campos necesarios.
5. Si se desea reemplazar el archivo PDF: hacer clic en **+ Reemplazar archivo PDF** y seleccionar el nuevo documento.

**ATENCIÓN:** El PDF es opcional al editar. Si no se selecciona un nuevo archivo, el documento anterior se conserva.

6. Presionar el botón **GUARDAR CAMBIOS**.

**Resultado esperado:** El sistema muestra el mensaje *"CAMBIOS GUARDADOS CORRECTAMENTE."*

---

### 4.5 Estados de vigencia de una normativa

La normativa puede tener uno de los siguientes estados de vigencia, seleccionable al cargar o editar:

| Estado | Significado |
|---|---|
| VIGENTE | Normativa en plena vigencia |
| DEROGADA | Normativa sin efecto |
| SUSPENDIDA | Vigencia temporalmente suspendida |
| REEMPLAZADA | Fue reemplazada por otra normativa posterior |

---

## 5. VINCULACIÓN DE UNA MATERIA A UN DOCENTE

**Rol:** Administrador del sistema o rol autorizado
**Ruta:** Menú lateral → Vinculación a Cátedra

Una vinculación registra la asignación de un docente a una asignatura dentro de un plan de estudio. Al guardarla, queda en estado **Pendiente de aprobación** hasta que el docente la confirme.

---

### 5.1 Acceder a Vinculación a Cátedra

**Pasos:**
1. En el menú lateral, hacer clic en **Vinculación a Cátedra**.
2. Se muestra la tabla con todas las vinculaciones registradas.

---

### 5.2 Crear nueva vinculación

**Pasos:**
1. Presionar el botón **Nueva Vinculación** (esquina superior derecha).
2. Se abre un formulario lateral (drawer) con los campos a completar.

---

### 5.3 Completar Facultad

Seleccionar la **Facultad** de la lista desplegable.

**Observación:** Al seleccionar una facultad, la lista de Carreras se actualiza automáticamente mostrando solo las carreras de esa facultad.

---

### 5.4 Carrera

Seleccionar la **Carrera** de la lista desplegable.

**Observación:** Al seleccionar una carrera, la lista de Planes de Estudio se actualiza automáticamente.

---

### 5.5 Plan de Estudio

Seleccionar el **Plan de Estudio** activo de la lista desplegable.

**Observación:** Al seleccionar un plan, la lista de Asignaturas se actualiza automáticamente.

---

### 5.6 Asignatura

Seleccionar la **Asignatura** (materia) activa de la lista desplegable.

**Observación:** Al seleccionar la asignatura, las **Horas semanales** se completan automáticamente con el valor registrado en la estructura curricular. Si la asignatura no tiene carga horaria definida, el sistema mostrará un error y no permitirá guardar hasta que se actualice ese dato.

---

### 5.7 Docente

Seleccionar el **Docente** de la lista desplegable. La lista muestra los docentes activos registrados en el sistema.

---

### 5.8 Cátedra

Seleccionar la **Cátedra** de la lista desplegable. Las opciones provienen de las tablas maestras configuradas.

---

### 5.9 Cargo

Seleccionar el **Cargo** de la lista desplegable (ej: Titular, Adjunto, JTP, Auxiliar).

---

### 5.10 Modalidad

Seleccionar la **Modalidad** de la lista desplegable (ej: Presencial, Virtual, Híbrida).

---

### 5.11 Designación

Seleccionar el tipo de **Designación** de la lista desplegable (ej: Ordinario, Interino, Ad honorem).

---

### 5.12 Año de inicio

Ingresar el **Año de inicio** con 4 dígitos (ej: 2026). Debe estar entre 1900 y 2100.

---

### 5.13 Observaciones

Campo de texto libre opcional. Permite registrar cualquier aclaración sobre la vinculación.

---

### 5.14 Guardar

1. Verificar que todos los campos obligatorios estén completos.
2. Presionar el botón **Guardar**.

**Resultado esperado:** El sistema confirma con el mensaje *"Vinculación creada correctamente. Quedó en estado Pendiente de Aprobación."* La vinculación aparece en la tabla con el estado **Pendiente**.

**IMPORTANTE:** La vinculación no tiene efecto inmediato. El docente debe recibirla y aprobarla desde su Bandeja de Aprobaciones.

---

### Estados posibles de una vinculación

| Estado | Descripción |
|---|---|
| Pendiente | Creada, esperando acción del docente |
| Aprobada | El docente la aceptó |
| Rechazada | El docente la rechazó con un motivo |
| Desvinculada | La vinculación fue finalizada por un administrador |

---

## 6. CIRCUITO DEL DOCENTE — APROBAR MATERIAS ASIGNADAS

**Rol:** Docente
**Ruta:** Menú lateral → Bandeja de Aprobaciones

---

### 6.1 Ingresar con usuario Docente

**Pasos:**
1. En la pantalla de login, ingresar el correo y contraseña del usuario con rol DOCENTE.
2. Presionar **Iniciar sesión**.

---

### 6.2 Abrir Bandeja de Aprobaciones

**Pasos:**
1. En el menú lateral, hacer clic en **Bandeja de Aprobaciones**.
2. Si hay novedades pendientes, el sistema muestra un indicador numérico (ej: *"2 novedades"*) junto al título.

---

### 6.3 Ver materias pendientes

La sección **Pendientes de acción** muestra todas las vinculaciones que aún requieren una decisión del docente.

Para cada vinculación pendiente se visualiza:
- Nombre de la asignatura (y código si corresponde).
- Carrera y Plan de Estudio.
- Cátedra y Cargo.
- Horas semanales y Año de inicio.
- Fecha de creación de la solicitud.

---

### 6.4 Abrir el detalle

**Pasos:**
1. Hacer clic en el botón **Ver** (ícono de ojo) de la vinculación que se desea revisar.
2. Se abre un modal con todos los datos de la vinculación: Facultad, Carrera, Plan, Asignatura, Docente, Cátedra, Cargo, Modalidad, Designación, Horas semanales y Año de inicio.
3. Revisar la información.
4. Cerrar el modal con el botón **Volver**.

---

### 6.5 Aprobar una materia

**Pasos:**
1. En la sección Pendientes de acción, localizar la vinculación.
2. Presionar el botón **Aprobar** (verde).
3. El sistema solicita confirmación con un cuadro de diálogo: *"¿Aprobar la vinculación de [Apellido, Nombre] para '[Asignatura]'?"*
4. Confirmar la acción.

**Resultado esperado:** El sistema muestra el mensaje *"Vinculación aprobada correctamente."* La vinculación desaparece de la sección Pendientes y su estado pasa a **Aprobada**.

---

### 6.6 Rechazar una materia

**Pasos:**
1. En la sección Pendientes de acción, localizar la vinculación.
2. Presionar el botón **Rechazar** (rojo).
3. Se abre un modal para ingresar el motivo del rechazo.
4. Escribir el motivo.
5. Confirmar el rechazo.

**Resultado esperado:** La vinculación pasa al estado **Rechazada**. El sistema confirma la acción con un mensaje de éxito.

---

### 6.7 Visualizar notificaciones

La sección **Notificaciones** muestra el historial de novedades recibidas (aprobaciones, rechazos, desvinculaciones).

**Pasos:**
1. En la sección Notificaciones, hacer clic en **Ver** junto a cualquier notificación.
2. Se abre un modal con el detalle completo: tipo de novedad, datos académicos, fecha y hora.
3. Las notificaciones no leídas muestran un punto azul y la etiqueta **No leída**. Al abrirlas se marcan como leídas.

**Observación:** Las notificaciones son solo informativas. No requieren ninguna acción adicional.

---

## 7. MI FICHA DOCENTE

**Rol:** Docente
**Ruta:** Menú lateral → Mi Ficha Docente

Mi Ficha Docente es el CV académico del docente dentro del sistema. Concentra toda la información personal, formativa y académica en diez pestañas.

---

### Cómo acceder y editar

**Pasos:**
1. En el menú lateral, hacer clic en **Mi Ficha Docente**.
2. La ficha se muestra en modo lectura por defecto.
3. Para editar, presionar el botón **Editar ficha** (esquina superior).
4. La ficha pasa a modo edición. Aparecen campos modificables y los botones **Guardar Cambios** y **Cancelar**.
5. Navegar entre las pestañas usando los botones numerados (1 al 10) en la parte superior.
6. En cada pestaña, completar o modificar los campos.
7. Presionar **Guardar Cambios** para guardar la pestaña activa. Cada pestaña se guarda de forma independiente.
8. Presionar **Cancelar** para descartar cambios en la pestaña actual y volver al modo lectura.

Para exportar la ficha completa en PDF, presionar el botón **Exportar ficha** disponible en la parte superior de la pantalla.

---

### Pestaña 1 — Datos personales

**Propósito:** Información de identificación del docente.

**Campos principales:**
- Nombre y Apellido
- Sexo
- Fecha de nacimiento
- Tipo de documento (DNI, CUIL, etc.)
- Número de documento
- CUIT
- Correo electrónico
- Teléfono
- Domicilio: Calle, Número, Piso/Depto
- Residencia, Provincia, Localidad, Código postal

**Cómo guardar:** Presionar **Guardar Cambios** (o **Guardar Pestaña 1** según el modo).

---

### Pestaña 2 — Formación

**Propósito:** Títulos y formación académica del docente.

**Secciones:**

**Títulos de grado** (tabla con botón **+ Agregar**):
- Denominación, Año, País, Institución

**Títulos de posgrado** (tabla con botón **+ Agregar**):
- Denominación, Tipo (Especialización, Maestría, Doctorado, etc.), Año, Institución

**Otros títulos** (tabla con botón **+ Agregar**):
- Denominación, Año, Institución

**Carrera de formación docente** (tabla con botón **+ Agregar**):
- Denominación, Institución, Unidad académica, Año

Cada tabla permite **Editar** y **Eliminar** registros existentes.

**Cómo guardar:** Presionar **Guardar Cambios** luego de todas las modificaciones en esta pestaña.

---

### Pestaña 3 — Área de desempeño

**Propósito:** Clasificación disciplinar del docente.

**Campos:**
- Área disciplinar (seleccionar de lista)
- Subárea (se actualiza al elegir el área)
- Observaciones del área (texto libre)

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 4 — Docencia universitaria

**Propósito:** Registro de la actividad docente actual y actividades de posgrado.

**4.1 Situación actual** — completado automáticamente:

Muestra las vinculaciones a cátedra que fueron aprobadas en la Bandeja de Aprobaciones. **No admite edición manual.** Las columnas que se visualizan son:

| Columna | Descripción |
|---|---|
| Facultad | Facultad a la que pertenece la asignatura |
| Carrera | Carrera donde se dicta |
| Plan | Plan de estudios |
| Asignatura | Nombre de la materia |
| Cátedra | Cátedra asignada |
| Cargo | Cargo docente (Titular, Adjunto, etc.) |
| Modalidad | Modalidad de dictado |
| Designación | Tipo de designación |
| H/SEM | Horas semanales de la asignatura |
| Año inicio | Año de inicio de la vinculación |
| Aprobada | Fecha en que fue aprobada |

**4.2 Actividades curriculares de posgrado** (tabla con botón **+ Agregar**):
- Carreras de posgrado, Actividad curricular, Plan, Año inicio.

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 5 — Gestión Académica

**Propósito:** Registro de cargos y funciones de gestión académica.

**Campos:**
- Función de gestión
- Unidad académica de gestión
- Carrera asociada a la gestión
- Tiempo de dedicación semanal a la gestión
- Fecha de inicio / Fecha fin
- Normativa de designación

**Secciones adicionales en tabla:**

**Trayectoria — Cargos pasados** (botón **+ Agregar**):
- Período desde/hasta, Institución, Unidad académica, Cargo, Modalidad

**Cargos académicos** (botón **+ Agregar**):
- Cargo, Institución, Modalidad, Período desde/hasta, Dedicación semanal

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 6 — Desempeño No Académico

**Propósito:** Registro de la actividad profesional no académica del docente.

**Campos de texto libre:**
- Cargo declarado
- Justificación de pertinencia
- Actividades profesionales
- Antecedentes académicos

**Secciones en tabla:**

**Desempeño actual** (botón **+ Agregar**):
- Período desde/hasta, Institución, Cargo, Modalidad, Dedicación semanal

**Desempeño pasado** (botón **+ Agregar**):
- Período desde/hasta, Institución, Cargo

**Otras dedicaciones** (botón **+ Agregar**):
- Concepto, Horas semanales

**Experiencia en educación a distancia:**
- Campo de texto libre

**Dirección de tesis** (botón **+ Agregar**):
- Datos de dirección de trabajos de grado o posgrado

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 7 — Investigación

**Propósito:** Registro de la actividad de investigación del docente.

**Secciones:**

**Proyectos de investigación** (tabla con botón **+ Agregar**):
- Código, Título, Rol, Horas semanales

**Sistemas de promoción en investigación** (tabla con botón **+ Agregar**):
- Sistema, Categoría, Detalle, Período desde/hasta

**Participación en vinculación** (tabla con botón **+ Agregar**):
- Código, Actividad, Rol, Horas semanales

**Producción científica** (tabla con botón **+ Agregar**):
- Tipo, Referencia bibliográfica, Año

**Premios y distinciones** (texto libre)

**Estancias y cursos en el exterior** (texto libre)

**Membresías en instituciones** (texto libre)

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 8 — Reuniones Científicas

**Propósito:** Registro de participación en congresos, jornadas y eventos científicos.

**Sección en tabla** (botón **+ Agregar**):
- Título del evento, Lugar, Forma de participación, Tipo, Fecha

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 9 — Comités y Jurados

**Propósito:** Registro de participación en comités evaluadores y jurados.

**Sección en tabla** (botón **+ Agregar**):
- Organismo convocante, Lugar, Tipo de evaluación, Fecha

**Cómo guardar:** Presionar **Guardar Cambios**.

---

### Pestaña 10 — Otra Información

**Propósito:** Campos adicionales y de cierre de la ficha.

**Campos:**
- Carrera docente de posgrado (texto libre)
- Actividades de transferencia y extensión (texto libre)
- Registros de promoción (tabla con botón **+ Agregar**): Sistema, Categoría, Fecha de alta

**Cómo guardar:** Presionar **Guardar Cambios**.

---

## 8. DOCENCIA UNIVERSITARIA Y MATERIAS APROBADAS

**Rol:** Docente
**Ruta:** Mi Ficha Docente → Pestaña 4 (Docencia universitaria) → Sección 4.1 Situación actual

---

La sección **4.1 Situación actual** se completa **automáticamente** a partir de las vinculaciones a cátedra que el docente aprobó en la Bandeja de Aprobaciones. El docente **no puede editar** esta sección manualmente.

**Flujo completo:**

```
El administrador (o rol autorizado) crea la vinculación
  → La vinculación queda en estado: Pendiente de aprobación
  → El docente ingresa a su Bandeja de Aprobaciones
  → El docente revisa la vinculación y presiona Aprobar
  → El estado pasa a: Aprobada
  → La vinculación aparece automáticamente en:
     Mi Ficha Docente → Pestaña 4 → 4.1 Situación actual
```

**Columnas que se muestran en Situación actual:**

| Columna | Descripción |
|---|---|
| Facultad | Facultad a la que pertenece la asignatura |
| Carrera | Carrera donde se dicta |
| Plan | Plan de estudios activo |
| Asignatura | Nombre de la materia |
| Cátedra | Cátedra asignada |
| Cargo | Cargo docente (Titular, Adjunto, JTP, etc.) |
| Modalidad | Modalidad de dictado (Presencial, Virtual, etc.) |
| Designación | Tipo de designación (Ordinario, Interino, etc.) |
| H/SEM | Horas semanales de la asignatura |
| Año inicio | Año en que comenzó la vinculación |
| Aprobada | Fecha en que el docente aprobó la vinculación |

**IMPORTANTE:** Si el docente no tiene vinculaciones aprobadas, la sección mostrará el mensaje: *"No posee vinculaciones a cátedra aprobadas."*

---

## 9. EJEMPLO COMPLETO DE PRINCIPIO A FIN

Este ejemplo muestra el recorrido completo desde la creación de un usuario hasta verificar que la materia aparece en la ficha del docente.

---

**Escenario:** El administrador quiere asignar a la profesora María González la asignatura "Metodología de la Investigación" de la Facultad de Ciencias Sociales, Carrera Trabajo Social.

---

**Paso 1 — Crear usuario docente**

1. Ingresar con usuario administrador.
2. Ir a **Configuración → Usuarios**.
3. Presionar **Nuevo usuario**.
4. Completar: Nombre = MARÍA, Apellido = GONZÁLEZ, Email = `m.gonzalez@udemm.edu.ar`, Contraseña = (temporal), Rol = DOCENTE.
5. Presionar **Guardar**.
6. El sistema confirma: *"Usuario creado."*

---

**Paso 2 — Crear la vinculación**

1. Ir a **Vinculación a Cátedra**.
2. Presionar **Nueva Vinculación**.
3. Seleccionar: Facultad → Ciencias Sociales.
4. Seleccionar: Carrera → Trabajo Social.
5. Seleccionar: Plan de Estudio → (el plan activo disponible).
6. Seleccionar: Asignatura → Metodología de la Investigación.
7. Seleccionar: Docente → GONZÁLEZ, MARÍA.
8. Seleccionar: Cátedra, Cargo, Modalidad, Designación según corresponda.
9. Completar: Año de inicio = 2026.
10. Presionar **Guardar**.
11. El sistema confirma: *"Vinculación creada correctamente. Quedó en estado Pendiente de Aprobación."*

---

**Paso 3 — Ingresar como docente y aprobar la asignación**

1. Cerrar sesión del administrador.
2. Ingresar con el usuario de María González (`m.gonzalez@udemm.edu.ar`).
3. Ir a **Bandeja de Aprobaciones**.
4. En la sección **Pendientes de acción**, localizar la vinculación de "Metodología de la Investigación".
5. Hacer clic en **Ver** para revisar los datos.
6. Presionar **Aprobar** y confirmar en el cuadro de diálogo.
7. El sistema confirma: *"Vinculación aprobada correctamente."*

---

**Paso 4 — Verificar en Mi Ficha Docente**

1. En el menú lateral, ir a **Mi Ficha Docente**.
2. Abrir la pestaña **4 — Docencia universitaria**.
3. En la sección **4.1 Situación actual**, comprobar que aparece la fila con:
   - Facultad: Ciencias Sociales
   - Asignatura: Metodología de la Investigación
   - Cargo, Modalidad, Designación y Horas/sem correspondientes
   - Fecha de aprobación: la fecha del día en que se realizó el paso 3.

**Resultado esperado:** La materia aparece listada en la tabla de Situación actual. El circuito está completo.

---

## 10. GUÍA RÁPIDA PARA PRUEBAS

Utilizar esta lista para verificar que el sistema funciona correctamente en el entorno de pruebas:

```
□ Puedo iniciar sesión con el usuario administrador
□ Puedo crear un nuevo usuario con rol DOCENTE
□ Puedo editar los datos de un usuario existente
□ Puedo activar y desactivar un usuario
□ Puedo filtrar usuarios por nombre, rol y estado
□ Puedo cargar una nueva normativa con PDF
□ Puedo visualizar el PDF de una normativa existente
□ Puedo editar una normativa y reemplazar el PDF
□ Puedo crear una vinculación a cátedra
□ La vinculación queda en estado Pendiente al guardar
□ Ingresando como docente, recibo la vinculación en la Bandeja
□ Puedo aprobar la vinculación desde la Bandeja
□ Puedo rechazar una vinculación con motivo
□ Tras aprobar, la materia aparece en Mi Ficha Docente (pestaña 4)
□ Puedo editar y guardar datos en cada pestaña de Mi Ficha Docente
□ Puedo exportar la ficha en PDF
□ Los datos persisten al recargar la página
□ Los filtros de búsqueda funcionan en Vinculación a Cátedra
```

---

## 11. CÓMO REPORTAR UN ERROR

Al encontrar un comportamiento inesperado, informarlo con el siguiente formato:

---

**REPORTE DE ERROR**

**Usuario/Rol:** *(ej: ADMINISTRADOR / DOCENTE)*

**Pantalla:** *(ej: Bandeja de Aprobaciones / Repositorio de Normativas / Mi Ficha Docente - Pestaña 2)*

**Pasos para reproducir:**
1.
2.
3.

**Resultado esperado:** *(qué debería haber ocurrido)*

**Resultado obtenido:** *(qué ocurrió realmente)*

**Captura de pantalla:** *(adjuntar imagen si es posible)*

**Fecha y hora del error:** *(ej: 04/09/2026 - 14:35 hs)*

---

**ATENCIÓN:** Incluir siempre la captura de pantalla si el error produce un mensaje visible en pantalla. Cuanta más información se provea, más rápido se puede identificar y corregir el problema.

---

*UDEMM Global — Sistema de Gestión Institucional — Versión de pruebas — Septiembre 2026*
