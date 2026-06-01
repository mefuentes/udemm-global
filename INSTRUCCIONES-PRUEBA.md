# Instrucciones de Prueba - Módulo Docentes

## Paso 1: Iniciar Backend

```bash
cd backend
npm run start:dev
```

**Esperado:**
```
[Nest] 27-05-2026 15:30:00 LOG [NestFactory] Starting Nest application...
[Nest] 27-05-2026 15:30:02 LOG [InstanceLoader] PrismaModule dependencies initialized
...
[Nest] 27-05-2026 15:30:05 LOG [NestApplication] Nest application successfully started on port 5000
```

## Paso 2: Iniciar Frontend (nueva terminal)

```bash
cd frontend
npm run dev
```

**Esperado:**
```
> udemm-global-frontend@0.1.0 dev
> next dev
...
 ▲ Next.js 14.2.5
 
 ▲ Local:        http://localhost:3000
```

## Paso 3: Acceder a la aplicación

1. Abrir navegador: `http://localhost:3000`
2. Verá página de bienvenida

## Paso 4: Autenticarse

Si hay un formulario de login (no hay en esta versión), usar:
- **Email**: `admin@udemm.edu.ar`
- **Contraseña**: `Admin1234!`

O si no hay login visible, continúe con el Paso 5.

## Paso 5: Acceder a Docentes

1. Navegar a: `http://localhost:3000/docentes`
2. Verá un mensaje pidiendo token JWT
3. Haga clic en "Agregar token" o use el botón en la interfaz

## Paso 6: Obtener Token JWT (Opción A - Postman)

```bash
POST http://localhost:5000/auth/login
Content-Type: application/json

{
  "correoElectronico": "admin@udemm.edu.ar",
  "contrasena": "Admin1234!"
}
```

**Respuesta:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "usuario": { ... }
}
```

## Paso 7: Obtener Token JWT (Opción B - Script Node)

```bash
cd backend
node -e "
const fetch = require('node-fetch');
fetch('http://localhost:5000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    correoElectronico: 'admin@udemm.edu.ar',
    contrasena: 'Admin1234!'
  })
})
.then(r => r.json())
.then(d => console.log(d.accessToken))
"
```

Copiar el token que aparece.

## Paso 8: Pegar Token en Frontend

1. En `http://localhost:3000/docentes`, hacer clic en "Agregar token"
2. En el prompt, pegar el JWT obtenido
3. Presionar Enter
4. Se recargará la página y mostrará docentes si hay

## Paso 9: Probar Crear Docente

1. Hacer clic en botón "Nuevo docente"
2. Llenar formulario:
   - Nombre: `Carlos`
   - Apellido: `González`
   - Tipo Documento: `DNI`
   - Número: `32445678`
   - Correo: `carlos.gonzalez@test.edu.ar`
   - (campos opcionales pueden dejarse vacíos)
3. Hacer clic en "Guardar docente"
4. Se debe ver mensaje de éxito
5. Redirige a la ficha del docente creado

## Paso 10: Probar Búsqueda

1. Volver a `/docentes`
2. En la caja de búsqueda, escribir: `carlos`
3. Ver que filtra en tiempo real
4. Tabla mostrará solo docentes con "carlos" en nombre, apellido, email o documento

## Paso 11: Probar Paginación

1. En `/docentes`, cambiar "Anterior/Siguiente"
2. Ver que cambia la página
3. Verificar que muestra "Página X de Y"

## Paso 12: Ver Detalle de Docente

1. En listado de docentes, hacer clic en una fila
2. Abre `/docentes/[id]`
3. Ver todos los datos del docente
4. Ver botón "Editar" y "Dar de baja"

## Paso 13: Editar Docente

1. Desde la ficha, hacer clic en "Editar"
2. Se abre `/docentes/[id]/editar`
3. Cambiar un campo, ej: Teléfono
4. Hacer clic en "Guardar cambios"
5. Ver mensaje de éxito
6. Redirección a la ficha actualizada

## Paso 14: Dar de Baja Docente

1. Desde la ficha, hacer clic en "Dar de baja"
2. Aparece confirmación: "¿Dar de baja este docente?"
3. Hacer clic en "Aceptar"
4. Se actualiza el estado a "Inactivo"
5. La página redirecciona a `/docentes`

## Paso 15: Verificar Baja Lógica en Backend

```bash
cd backend
sqlite> SELECT * FROM "Docente" WHERE id = '...';
```

O en Prisma Studio:
```bash
npx prisma studio
```

Verificar que `activo = false` (no fue eliminado)

## Paso 16: Pruebas Automatizadas (Terminal 3)

```bash
cd backend
node test_docentes_complete.mjs
```

**Esperado:**
```
▶ Obteniendo token JWT...
✓ Token obtenido
▶ POST /docentes - Creando docente...
✓ Docente creado con ID: ...
▶ GET /docentes - Listando docentes...
✓ Docentes listados (total: X)
...
✓ Todas las pruebas completadas exitosamente
```

## Paso 17: Probar Error de Duplicado

### En Postman o script:

```bash
POST http://localhost:5000/docentes
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "Test",
  "apellido": "User",
  "tipoDocumento": "DNI",
  "numeroDocumento": "32445678",  # Ya existe
  "correoElectronico": "unique@test.edu.ar"
}
```

**Esperado:**
```json
{
  "statusCode": 400,
  "message": "El número de documento ya está registrado para otro docente",
  "error": "Bad Request"
}
```

## Paso 18: Probar Búsqueda por Email

```
GET /docentes?buscar=carlos.gonzalez
```

Debe encontrar el docente por email

## Paso 19: Probar Filtro por Activo

```
GET /docentes?activo=false
```

Debe mostrar solo docentes dados de baja

## Paso 20: Verificar Roles (ADMINISTRATIVO no puede eliminar)

1. Crear un usuario con rol ADMINISTRATIVO
2. Obtener su token
3. Intentar DELETE /docentes/:id

**Esperado:**
```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "Forbidden"
}
```

---

## Checklist Final

- [ ] Backend inicia sin errores
- [ ] Frontend inicia sin errores
- [ ] Puedo acceder a `/docentes` con token
- [ ] Puedo crear un docente
- [ ] Puedo listar docentes
- [ ] Puedo buscar docentes
- [ ] Puedo ver detalle de docente
- [ ] Puedo editar docente
- [ ] Puedo dar de baja docente
- [ ] Los datos actualizados se ven reflejados
- [ ] Las pruebas automatizadas pasan
- [ ] No hay errores TypeScript
- [ ] Los builds funcionan correctamente

---

## Troubleshooting

### "Error: EADDRINUSE: address already in use :::5000"
```bash
# Encontrar qué usa el puerto 5000
lsof -i :5000
# Matar el proceso o usar otro puerto
BACKEND_PORT=5001 npm run start:dev
```

### "Error: connect ECONNREFUSED"
Verificar que PostgreSQL está corriendo:
```bash
psql -U udemm_user -d udemm_global
```

### Token inválido en frontend
Verificar en DevTools:
- Application -> localStorage -> accessToken
- Si está vacío, pedir nuevamente
- Si está corrupto, limpiar localStorage

### Docente no se crea
Verificar:
- El email no esté ya registrado
- El documento no esté ya registrado
- El token sea válido
- El usuario tenga permiso (rol)

---

## Base de Datos

Ubicación de datos:
- Host: localhost
- Port: 5433 (PostgreSQL)
- Database: udemm_global
- User: udemm_user

Para inspeccionar:
```bash
npx prisma studio
```

Acceder a: http://localhost:5555

---

## Contacto/Soporte

En caso de errores:
1. Ver logs del backend en terminal
2. Ver logs del frontend en terminal
3. Ver DevTools del navegador (F12)
4. Ejecutar test_docentes_complete.mjs para diagnóstico

---
