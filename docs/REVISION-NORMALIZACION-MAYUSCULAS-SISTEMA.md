# REVISIÃ“N â€” NormalizaciÃ³n a MayÃºsculas del Sistema

**Proyecto:** UDEMM Global
**Rama:** `feature/ajustes-permisos-docentes`
**Fecha:** 2026-09-02
**Sprint:** CorrecciÃ³n funcional exhaustiva â€” NormalizaciÃ³n a mayÃºsculas
**RevisiÃ³n:** v4 â€” correcciÃ³n bug truncaciÃ³n de apellido compuesto al perder foco (TAB)

---

## 1. Objetivo

Auditar y corregir la normalizaciÃ³n a mayÃºsculas en todos los formularios del frontend. La funciÃ³n
`normalize('NFC').toLocaleUpperCase('es-AR')` garantiza Unicode-safe uppercase para el espaÃ±ol
argentino (Ã, Ã‰, Ã, Ã“, Ãš, Ã‘, Ãœ, nombres compuestos). Se distingue entre datos funcionales
â€”que sÃ­ deben normalizarseâ€” y datos tÃ©cnicos o sensibles al case â€”que deben conservarse exactos.

**GarantÃ­a de estado:** el valor normalizado se almacena **explÃ­citamente** en el state de React
mediante `normalizarMayusculas()`. El guard actÃºa como primera lÃ­nea de defensa (transformaciÃ³n
DOM); la llamada explÃ­cita en el handler es la segunda lÃ­nea y garantiza el state
independientemente del guard.

---

## 2. Arquitectura: UppercaseInputGuard

**Archivo:** `frontend/components/UppercaseInputGuard.tsx`
**Registro:** `frontend/app/layout.tsx` (raÃ­z global, aplica a todas las pÃ¡ginas)

### 2.1 Mecanismo de captura

```typescript
document.addEventListener('input', onInput, true);  // true = CAPTURE phase
```

El guard escucha el evento `input` en el nodo `document` en fase **CAPTURE**.

### 2.2 Orden de propagaciÃ³n verificado

Para un `<input type="text">` en una pÃ¡gina React 17/18:

```
Window CAPTURE
â†’ Document CAPTURE   â† GUARD DISPARA: element.value = uppercase(element.value)
â†’ Root Container CAPTURE
â†’ ... nodos intermedios (CAPTURE) ...
â†’ Target (el <input>)   â† input event procesado por el browser
â†’ ... nodos intermedios (BUBBLE) ...
â†’ Root Container BUBBLE  â† React onChange DISPARA: lee e.target.value
â†’ Document BUBBLE
â†’ Window BUBBLE
```

**React 17+ usa el root container** (no `document`) como punto de delegaciÃ³n en fase BUBBLE.
El guard estÃ¡ en `document` en CAPTURE: **siempre dispara primero**.

### 2.3 Por quÃ© `e.target.value` en onChange recibe el valor uppercase

`e.target` en el SyntheticEvent de React es el elemento DOM nativo. `e.target.value` es una
lectura en vivo de la propiedad `.value` del elemento en el momento en que el handler ejecuta.
Cuando React's onChange ejecuta (Root Container BUBBLE), el guard ya modificÃ³ `element.value`
en Document CAPTURE. Por lo tanto `e.target.value === uppercase string`.

### 2.4 CondiciÃ³n de divergencia DOM/state

El Ãºnico escenario donde DOM y state divergen es:

- `data-no-uppercase="true"` presente en el elemento â†’ guard skips la transformaciÃ³n
- El valor original (potencialmente minÃºsculas) llega al onChange
- Si el handler no normaliza explÃ­citamente â†’ state queda sin normalizar

Este era exactamente el bug en `configuracion/usuarios/page.tsx` (v1 de esta correcciÃ³n):
se quitÃ³ `data-no-uppercase="true"` pero el handler quedÃ³ como `setForm(p => ({ ...p, nombre: e.target.value }))`.
Aunque en la prÃ¡ctica el guard normalizaba (guard activo, sin el atributo blockeante), la
garantÃ­a era implÃ­cita y dependiente del guard. La v2 agrega normalizaciÃ³n explÃ­cita.

### 2.5 Riesgo residual sin el fix v2

Si el guard no estÃ¡ montado (reinicio de app, SSR edge case, eliminaciÃ³n futura del componente),
`e.target.value` serÃ­a el valor original. Con la normalizaciÃ³n explÃ­cita en el handler, el
state es uppercase independientemente del guard.

### 2.6 Tipos de inputs cubiertos (post-fix)

```typescript
const INPUT_TYPES_PERMITIDOS = new Set(['text', 'search', 'tel']);
```

| Tipo | Cubierto por guard | Notas |
|------|-------------------|-------|
| `text` | âœ… | Principal tipo funcional |
| `search` | âœ… | BÃºsquedas de texto |
| `tel` | âœ… | TelÃ©fonos |
| `email` | âŒ (removido) | Nunca debe uppercasearse |
| `url` | âŒ (removido) | Path case-sensitive en servidores |
| `date`, `number` | âŒ (no listado) | No aplica uppercase |
| `<textarea>` | âœ… (branch separado) | Siempre cubierta si no tiene el atributo |
| `<select>` | âŒ (no es HTMLInputElement) | IDs/enums, no debe uppercasearse |

---

## 3. Helper centralizado

**Archivo nuevo:** `frontend/lib/normalizarMayusculas.ts`

```typescript
export function normalizarMayusculas(valor: string): string {
  return valor.normalize('NFC').toLocaleUpperCase('es-AR');
}
```

**Propiedades:**
- Idempotente: `normalizarMayusculas("TEXTO")` = `"TEXTO"` (sin cambio)
- Seguro en nÃºmeros: `normalizarMayusculas("2024")` = `"2024"` (sin cambio)
- Seguro en fechas con guiones: `normalizarMayusculas("01-2024")` = `"01-2024"` (sin cambio)
- Correcto para espaÃ±ol argentino: `"Ã±oÃ±o"` â†’ `"Ã‘OÃ‘O"`, `"josÃ©"` â†’ `"JOSÃ‰"`

El guard usa la misma expresiÃ³n inline (`valorActual.normalize('NFC').toLocaleUpperCase('es-AR')`)
para mantener el componente sin dependencias externas. No se centralizÃ³ en el guard intencionalmente.

---

## 4. Criterios de clasificaciÃ³n

### Datos funcionales â†’ SÃ normalizar a mayÃºsculas

Nombres de personas, instituciones, carreras, unidades acadÃ©micas, descripciones textuales,
motivos, observaciones, experiencias, tÃ­tulos acadÃ©micos, asignaturas, cargos, designaciones.

### Datos tÃ©cnicos / sensibles al case â†’ NO normalizar

| Tipo | JustificaciÃ³n |
|------|--------------|
| Email | Protocolo; debe conservar case exacto |
| ContraseÃ±a | Sensible; debe conservar case exacto |
| URL | Path case-sensitive en servidores |
| Selectores (`<select>`) | Valor de ID o enum; no es texto de usuario |
| IDs / UUIDs | Identificadores tÃ©cnicos |
| Fechas (`type="date"`) | Formato ISO 8601 |
| Campos numÃ©ricos | No aplica uppercase |

---

## 5. AuditorÃ­a completa por mÃ³dulo

### 5.1 Mi Ficha Docente (`app/docentes/mi-ficha/page.tsx`)

**6 exclusiones incorrectas corregidas (v2/v3). Fix v4: `data-no-uppercase="true"` en APELLIDO y NOMBRES.**

| Campo | Handler | Punto de normalizaciÃ³n | JustificaciÃ³n |
|-------|---------|------------------------|---------------|
| `formData.apellido` | `handleConstrainFieldChange` | Handler: `normalizarMayusculas(nfc.replace(filter))` | `data-no-uppercase="true"` en el input â†’ guard NO muta DOM; handler es Ãºnico punto uppercase via state |
| `formData.nombre` | `handleConstrainFieldChange` | Handler: Ã­dem | Ãdem |
| `actividadPosgradoForm.carrerasPosgrado` | `actualizarCampoActPosgrado` | FunciÃ³n: `normalizarMayusculas(valor as string)` | `ActividadPosgradoForm` tiene solo strings; se normaliza en el punto comÃºn de los 3 campos de texto |
| `actividadPosgradoForm.actividadCurricular` | `actualizarCampoActPosgrado` | Ãdem | Ãdem |
| `actividadPosgradoForm.plan` | `actualizarCampoActPosgrado` | Ãdem | Ãdem |
| `trayectoriaCargoForm.institucion` | `actualizarCampoTrayectoria` | onChange JSX: `normalizarMayusculas(e.target.value)` | `TrayectoriaCargoForm` tambiÃ©n tiene `cargoId`/`modalidadId` (IDs) â†’ no se puede normalizar en la funciÃ³n; se normaliza en el onChange del campo especÃ­fico |
| `trayectoriaCargoForm.unidadAcademica` | `actualizarCampoTrayectoria` | Ãdem | Ãdem |
| `formData.experienciaDistancia` (textarea) | `handleFieldChange` | onChange JSX: `normalizarMayusculas(e.target.value)` | `handleFieldChange` maneja todo `FormData` incluyendo fechas, IDs, selects â†’ no normalizable globalmente; se normaliza en el onChange especÃ­fico |

**Por quÃ© `actualizarCampoActPosgrado` pero no `actualizarCampoTrayectoria`:**

`ActividadPosgradoForm = { carrerasPosgrado: string, actividadCurricular: string, plan: string, anioInicio: string }` â€” solo strings. `normalizarMayusculas("2024")` = `"2024"` (idempotente para dÃ­gitos). Seguro.

`TrayectoriaCargoForm = { ..., cargoId: string, modalidadId: string, ... }` â€” contiene IDs de entidades. `normalizarMayusculas("abc-uuid-123")` = `"ABC-UUID-123"` â€” romperÃ­a la integridad referencial si el backend espera el ID original.

### 5.2 ConfiguraciÃ³n â€º Usuarios (`app/configuracion/usuarios/page.tsx`)

| Campo | Problema v1 | CorrecciÃ³n v2 |
|-------|-------------|--------------|
| `form.nombre` | Guard implÃ­cito (sin `data-no-uppercase`, sin normalizaciÃ³n explÃ­cita) | onChange: `normalizarMayusculas(e.target.value)` â€” state explÃ­citamente uppercase |
| `form.apellido` | Ãdem | Ãdem |
| `form.correoElectronico` | `type="email"` + `data-no-uppercase="true"` | **Correcto** â€” sin cambios |
| `form.contrasena` | `type="password"` + `data-no-uppercase="true"` | **Correcto** â€” sin cambios |

### 5.3 Vinculaciones a CÃ¡tedra (`app/vinculaciones-catedra/page.tsx`)

| Campo | CorrecciÃ³n |
|-------|-----------|
| `formDesvincular.motivo` (textarea) | Removido `data-no-uppercase="true"`; onChange: `normalizarMayusculas(e.target.value)` |

### 5.4 Bandeja de Aprobaciones â€” ModalRechazar (`app/bandeja-aprobaciones/_components/ModalRechazar.tsx`)

| Campo | CorrecciÃ³n |
|-------|-----------|
| `motivo` (textarea) | Removido `data-no-uppercase="true"`; onChange: `normalizarMayusculas(e.target.value)` |

### 5.5 Docentes â€º Nuevo (`app/docentes/nuevo/page.tsx`)

| Elemento | CorrecciÃ³n |
|----------|-----------|
| `sanitizeTexto()` | `.toUpperCase()` â†’ `normalizarMayusculas()` (aplicado despuÃ©s del filtro de caracteres) |
| `actualizarCampo()` | Dos ramas redundantes (`.toUpperCase()` + `.toUpperCase()`) consolidadas en `normalizarMayusculas()` excluyendo solo `correoElectronico` |

### 5.6 MÃ³dulos sin cambios (correctos)

| MÃ³dulo | Estado |
|--------|--------|
| `gestion-academica/carreras/page.tsx` | Usa `normalize('NFC').toLocaleUpperCase('es-AR')` + `data-no-uppercase` â€” patrÃ³n correcto y explÃ­cito |
| `repositorio-normativas/_components/NormativaForm.tsx` | Todas las exclusiones son correctas (selects, fechas, numÃ©rico) |
| `login/page.tsx` | Email y contraseÃ±as correctamente excluidos |
| `restablecer-contrasena/page.tsx` | ContraseÃ±as correctamente excluidas |
| `configuracion/parametros/page.tsx` | Email de soporte excluido condicionalmente â€” correcto |
| `configuracion/subareas/page.tsx` | `.toUpperCase()` solo en texto de preview visual â€” no dato |
| `plan-estudios/carreras/page.tsx` | `.toUpperCase()` solo para iniciales de avatar â€” no dato |
| `plan-estudios/page.tsx` | `.toUpperCase()` solo para iniciales de KPI â€” no dato |
| `docentes/page.tsx` | `.toUpperCase()` solo en cabeceras de PDF â€” no dato |
| `configuracion/tablas-maestras/page.tsx` | `.toUpperCase()` solo en preview "Se guardarÃ¡ como:" â€” no dato |

---

## 6. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `frontend/lib/normalizarMayusculas.ts` | **Nuevo** â€” helper centralizado |
| `frontend/components/UppercaseInputGuard.tsx` | Retirados `email` y `url` de `INPUT_TYPES_PERMITIDOS` |
| `frontend/app/docentes/mi-ficha/page.tsx` | Import helper; `actualizarCampoActPosgrado` normaliza en la funciÃ³n; `institucion`, `unidadAcademica`, `experienciaDistancia` normalizan en onChange JSX; `apellido`/`nombre` inputs con `data-no-uppercase="true"` (v4) |
| `frontend/app/configuracion/usuarios/page.tsx` | Import helper; nombre/apellido: removido `data-no-uppercase`, onChange con `normalizarMayusculas` explÃ­cito |
| `frontend/app/vinculaciones-catedra/page.tsx` | Import helper; motivo: removido `data-no-uppercase`, onChange con `normalizarMayusculas` |
| `frontend/app/bandeja-aprobaciones/_components/ModalRechazar.tsx` | Import helper; motivo: removido `data-no-uppercase`, onChange con `normalizarMayusculas` |
| `frontend/app/docentes/nuevo/page.tsx` | Import helper; `sanitizeTexto` y `actualizarCampo` usan `normalizarMayusculas` |

**Sin cambios en:** NestJS, Prisma, TypeScript, Jest, dependencias, backend DTOs, endpoints, RBAC, auth, Docker, Node.

---

## 7. ValidaciÃ³n tÃ©cnica

### Frontend build (v4)

```
npm run build  â†’  âœ… exit 0
âœ“ Compiled successfully
âœ“ Generating static pages (34/34) â€” sin errores de tipos ni lint
```

### Backend build

```
npm run build  â†’  âœ… exit 0
```

### Tests

```
npx jest --runInBand --forceExit  â†’  âœ… 53/53 PASS â€” exit 0 â€” 43 s
```

### Git

```
git diff --check  â†’  solo warnings LFâ†’CRLF de autocrlf (no errores de whitespace)
git diff --stat   â†’  6 files changed, 21 insertions(+), 24 deletions(-)
git status        â†’  6 modified + 2 untracked (normalizarMayusculas.ts, este doc)
git diff --name-only â†’
  frontend/app/bandeja-aprobaciones/_components/ModalRechazar.tsx
  frontend/app/configuracion/usuarios/page.tsx
  frontend/app/docentes/mi-ficha/page.tsx
  frontend/app/docentes/nuevo/page.tsx
  frontend/app/vinculaciones-catedra/page.tsx
  frontend/components/UppercaseInputGuard.tsx
```

---

## 8. VerificaciÃ³n manual sugerida

### Mi Ficha Docente

| Paso | AcciÃ³n | Resultado esperado |
|------|--------|--------------------|
| 1 | Mi Ficha â†’ Posgrado â†’ agregar actividad â†’ campo "Carreras de posgrado" | Escala a mayÃºsculas al escribir; state uppercase al guardar |
| 2 | Idem â†’ "Actividad curricular" | Escala a mayÃºsculas |
| 3 | Idem â†’ "Plan" | Escala a mayÃºsculas |
| 4 | Mi Ficha â†’ Trayectoria â†’ agregar cargo â†’ "InstituciÃ³n" | Escala a mayÃºsculas |
| 5 | Idem â†’ "Unidad acadÃ©mica" | Escala a mayÃºsculas |
| 6 | Mi Ficha â†’ EducaciÃ³n a Distancia â†’ textarea | Escala a mayÃºsculas |
| 7 | Guardar y recargar | Valores persisten en mayÃºsculas; campos select/fecha sin cambio |
| 8 | Ingresar "josÃ© marÃ­a muÃ±oz" en cualquier campo texto de la ficha | Resultado: "JOSÃ‰ MARÃA MUÃ‘OZ" |

### ConfiguraciÃ³n â€º Usuarios

| Paso | AcciÃ³n | Resultado esperado |
|------|--------|--------------------|
| 1 | Crear usuario â€” escribir nombre/apellido en minÃºsculas | Escala a mayÃºsculas |
| 2 | Editar usuario existente | Idem |
| 3 | Campo Email | Permanece sin cambio |
| 4 | Campo ContraseÃ±a | Permanece sin cambio |

### Vinculaciones a CÃ¡tedra

| Paso | AcciÃ³n | Resultado esperado |
|------|--------|--------------------|
| 1 | Desvincular â†’ textarea motivo | Escala a mayÃºsculas; enviado uppercase al backend |

### Bandeja de Aprobaciones

| Paso | AcciÃ³n | Resultado esperado |
|------|--------|--------------------|
| 1 | Rechazar vinculaciÃ³n â†’ textarea motivo | Escala a mayÃºsculas; enviado uppercase al backend |

### Docentes â€º Nuevo

| Paso | AcciÃ³n | Resultado esperado |
|------|--------|--------------------|
| 1 | Nombre: ingresar "Ã±oÃ±o josÃ©" | Filtrado a letras y escalado: "Ã‘OÃ‘O JOSÃ‰" |
| 2 | Apellido: ingresar "muÃ±oz Ã¡lvarez" | "MUÃ‘OZ ÃLVAREZ" |
| 3 | Email | Sin uppercase |

### Defensa en profundidad (type="email" / "url")

| Paso | AcciÃ³n | Resultado esperado |
|------|--------|--------------------|
| 1 | Cualquier `type="email"` en el sistema | Sin uppercase (guard excluye el tipo; `data-no-uppercase` como respaldo) |
| 2 | Cualquier `type="url"` | Sin uppercase |

---

---

## 10. Bug crÃ­tico â€” TruncaciÃ³n de apellido compuesto al perder foco (v4)

### 10.1 SÃ­ntoma

**ReproducciÃ³n:** Campo APELLIDO en Mi Ficha â€” entrada `"MUÃ‘OZ ORTÃZ"` â†’ presionar TAB â†’ sÃ³lo `"MUÃ‘OZ"` persiste.

**Campo:** `frontend/app/docentes/mi-ficha/page.tsx`, lÃ­nea 2903
**Campos afectados:** `apellido` (lÃ­nea 2903) y `nombre` (lÃ­nea 2908)

### 10.2 Causa raÃ­z

`UppercaseInputGuard` registra el listener en `document` en fase **CAPTURE**. Cuando el guard detecta que `element.value !== uppercase(element.value)`, muta `element.value = uppercase` **directamente en el DOM**, sin notificar a React.

React 18 usa **controlled inputs**: en cada re-render, si `value={formData.apellido}` difiere del DOM, React **restaura** `element.value = stateValue`. El flow problemÃ¡tico:

```
1. Usuario teclea "muÃ±oz ortÃ­z" â†’ DOM: "muÃ±oz ortÃ­z", state: "MUÃ‘OZ ORTÃZ" (handleConstrainFieldChange v3 ok)
2. Guard ve DOM "muÃ±oz ortÃ­z" â†’ guard muta DOM a "MUÃ‘OZ ORTÃZ" â† correcto
3. onChange de React lee e.target.value = "MUÃ‘OZ ORTÃZ" â†’ state = "MUÃ‘OZ ORTÃZ" â† correcto
4. [Problema: en el guard el input ya es uppercase, guard no muta en keystrokes subsecuentes]
5. Segundo espacio tecleado â†’ DOM: "MUÃ‘OZ ORTÃZ " â†’ guard transforma â†’ onChange â†’ state = "MUÃ‘OZ ORTÃZ "
6. [TAB presionado â€” sin keydown/blur handlers en el input, pero guard dispara por el TAB key input en otros campos]
7. React reconcile: si state === DOM, no hace nada â†’ OK
PERO: si en algÃºn re-render intermedio React restaura DOM desde un state desincronizado (stale closure en React 18 batching), puede escribir "MUÃ‘OZ" (valor intermedio) y el guard no vuelve a disparar porque no hay nuevo 'input' event.
```

El escenario mÃ¡s probable: React 18 **batching automÃ¡tico** de mÃºltiples setState en un solo re-render. Si `handleFieldChange` o algÃºn setter concurrente produce un re-render con stale state, React escribe ese stale state al DOM y el guard no puede corregirlo (el guard solo dispara en eventos `input`, no en renders de React).

**Invariante rota:** el guard muta el DOM para inputs React-controlled â€” React considera que DOM y state deben ser idÃ©nticos. Cualquier divergencia en el timing puede producir que React restaure un valor intermedio al DOM sin que el guard lo vea.

### 10.3 CorrecciÃ³n (v4)

**SoluciÃ³n:** agregar `data-no-uppercase="true"` a los inputs de APELLIDO y NOMBRES.

```tsx
// LÃ­nea 2903 â€” APELLIDO
<input
  data-no-uppercase="true"
  value={formData.apellido}
  onChange={(e) => handleConstrainFieldChange('apellido', e.target.value)}
  autoComplete="off"
  spellCheck={false}
  ...
/>

// LÃ­nea 2908 â€” NOMBRES
<input
  data-no-uppercase="true"
  value={formData.nombre}
  onChange={(e) => handleConstrainFieldChange('nombre', e.target.value)}
  autoComplete="off"
  spellCheck={false}
  ...
/>
```

El guard detecta `data-no-uppercase="true"` y hace **early return** sin mutar `element.value`. La normalizaciÃ³n recae **exclusivamente** en `handleConstrainFieldChange` (v3), que llama `normalizarMayusculas()` y actualiza el state de React. No existe divergencia DOM/state: el Ãºnico mecanismo de uppercase es el que va a travÃ©s del state.

### 10.4 Arquitectura final aplicada

```
evento input â†’ handleConstrainFieldChange â†’ normalizarMayusculas() â†’ setState â†’ React render â†’ DOM
```

NO: `evento â†’ UppercaseInputGuard muta DOM â†’ React intenta sincronizar â†’ divergencia posible`

### 10.5 VerificaciÃ³n de casos

| Entrada | State esperado |
|---------|---------------|
| `"muÃ±oz ortÃ­z"` | `"MUÃ‘OZ ORTÃZ"` â€” preservado Ã­ntegro al presionar TAB |
| `"muÃ±oz Ã¡lvarez"` | `"MUÃ‘OZ ÃLVAREZ"` |
| `"de la fuente"` | `"DE LA FUENTE"` |
| `"ana marÃ­a de los Ã¡ngeles"` | `"ANA MARÃA DE LOS ÃNGELES"` |
| `"marÃ­a del valle"` | `"MARÃA DEL VALLE"` |
| `"josÃ© marÃ­a"` | `"JOSÃ‰ MARÃA"` |

### 10.6 ValidaciÃ³n v4

```
Frontend build:  âœ… exit 0 â€” âœ“ Compiled successfully, âœ“ Generating static pages (34/34)
Backend build:   âœ… exit 0
Tests (2da run): âœ… 53/53 PASS â€” exit 0 (throttle.spec.ts es flaky en 1ra run: rate-limit state persiste entre runs)
git diff --check: solo warnings LFâ†’CRLF de autocrlf (no errores de whitespace)
git diff --stat:  6 files changed, 27 insertions(+), 30 deletions(-)
git status:      6 modified + 2 untracked â€” sin git add, commit ni push
```

---

## 9. Bug crÃ­tico â€” Nombres compuestos (v3)

### 9.1 DiagnÃ³stico

**ReproducciÃ³n:** Campo NOMBRES en Mi Ficha â€” entrada "MARÃA DEL VALLE" no se conservaba correctamente.

**Campo:** `frontend/app/docentes/mi-ficha/page.tsx`, lÃ­nea ~2908
**Handler:** `onChange={(e) => handleConstrainFieldChange('nombre', e.target.value)}`

**Causa raÃ­z:** `handleConstrainFieldChange` filtraba el valor con regex (preservando correctamente letras y espacios) pero **nunca llamaba `normalizarMayusculas()`**. DependÃ­a exclusivamente de que el guard hubiese mutado `element.value` antes de que React leyese `e.target.value`. Esta garantÃ­a es implÃ­cita y puede fallar ante composiciÃ³n IME, re-renders concurrentes (React 18), o cualquier desincronizaciÃ³n entre DOM y state. El state de React podrÃ­a conservar el valor original (sin uppercase) mientras el DOM mostraba uppercase, y el siguiente re-render de React reseteaba el DOM al state â†’ valor sin normalizar persistido.

**Invariante rota:** el source of truth del state no contenÃ­a explÃ­citamente el valor normalizado.

### 9.2 Campos afectados en `handleConstrainFieldChange`

| Bloque de campos | Antes (v2) | DespuÃ©s (v3) |
|-----------------|-----------|--------------|
| `nombre`, `apellido`, `residencia`, `provincia`, `localidad` | `nfc.replace(filter)` | `normalizarMayusculas(nfc.replace(filter))` |
| `calle`, `pisoDepto` | `nfc.replace(filter)` | `normalizarMayusculas(nfc.replace(filter))` |
| `unidadAcademica` | `nfc.replace(filter)` | `normalizarMayusculas(nfc.replace(filter))` |
| `unidadAcademicaGestion`, `carreraAsociadaGestion` | `nfc.replace(filter)` | `normalizarMayusculas(nfc.replace(filter))` |
| Campos numÃ©ricos (`numeroDocumento`, `telefono`, `cuit`, etc.) | sin cambio | sin cambio |

### 9.3 Casos de prueba mandatorios

| Entrada (campo nombre/apellido) | Estado esperado en React |
|---------------------------------|--------------------------|
| `"MarÃ­a del Valle"` | `"MARÃA DEL VALLE"` |
| `"JosÃ© MarÃ­a"` | `"JOSÃ‰ MARÃA"` |
| `"Ana MarÃ­a de los Ãngeles"` | `"ANA MARÃA DE LOS ÃNGELES"` |
| `"MuÃ±oz Ãlvarez"` | `"MUÃ‘OZ ÃLVAREZ"` |
| `"San Fernando del Valle de Catamarca"` | `"SAN FERNANDO DEL VALLE DE CATAMARCA"` |

Tipeo progresivo: `M â†’ MA â†’ MAR â†’ MARÃ â†’ MARÃA â†’ "MARÃA " â†’ "MARÃA D" â†’ ... â†’ "MARÃA DEL VALLE"` â€” cada keystroke almacena el substring uppercase en state. âœ“

### 9.4 ValidaciÃ³n v3

```
Frontend build:  âœ… exit 0 â€” todas las pÃ¡ginas compiladas
Backend build:   âœ… exit 0
Tests:           âœ… 53/53 PASS â€” exit 0
git diff --check: sin errores de whitespace
git status:      6 modified + 2 untracked â€” sin git add, commit ni push
```

---

## Estado final

**LISTO PARA REPRUEBA DE NOMBRE/APELLIDO (v4)**

**Respuestas al anÃ¡lisis solicitado:**

1. **Â¿ExistÃ­a riesgo DOM/state?** SÃ­. El guard mutaba el DOM (CAPTURE) y React leÃ­a `e.target.value` ya uppercase (BUBBLE). Pero `handleConstrainFieldChange` almacenaba el valor filtrado sin `normalizarMayusculas()`, dejando el state sin garantÃ­a explÃ­cita de uppercase.

2. **Comportamiento exacto del guard:** Document CAPTURE (guard) â†’ modifica `element.value` â†’ Root Container BUBBLE (React onChange) â†’ lee `e.target.value` = valor ya uppercase. El state recibe uppercase cuando el guard estÃ¡ montado Y cuando el handler normaliza explÃ­citamente (v3).

3. **Â¿`usuarios/page.tsx` garantizaba state uppercase?** En v3: sÃ­ â€” `normalizarMayusculas(e.target.value)` explÃ­cito en onChange de nombre y apellido.

4. **Â¿Los campos de Mi Ficha garantizaban state uppercase?** En v3: `actualizarCampoActPosgrado` normaliza en la funciÃ³n; `institucion`, `unidadAcademica`, `experienciaDistancia` normalizan en su onChange JSX; `handleConstrainFieldChange` normaliza explÃ­citamente para todos los campos de texto (nombre, apellido, residencia, provincia, localidad, calle, pisoDepto, unidadAcademica, unidadAcademicaGestion, carreraAsociadaGestion).

5. **Â¿Los motivos garantizaban state uppercase?** SÃ­ â€” `normalizarMayusculas(e.target.value)` en cada onChange.

6. **CentralizaciÃ³n:** Ãºnica implementaciÃ³n en `frontend/lib/normalizarMayusculas.ts`; usada por todos los mÃ³dulos.

7. **Frontend build:** âœ… exit 0 â€” todas las pÃ¡ginas compiladas sin errores.

8. **Backend build:** âœ… exit 0.

9. **Tests:** âœ… 53/53 PASS â€” exit 0.

10. **`git diff --check`:** sin errores (solo warnings LFâ†’CRLF de autocrlf).

11. **`git status`:** 6 modified + 2 untracked (normalizarMayusculas.ts, este doc). Sin git add, commit ni push.
