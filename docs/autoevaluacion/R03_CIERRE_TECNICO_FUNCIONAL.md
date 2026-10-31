# R-03 — Cierre Técnico-Funcional

## 1. Identificación

| Campo | Valor |
|---|---|
| **Proyecto** | UDEMM Global |
| **Módulo** | MOD-AUT — Motor de autoevaluación CONEAU |
| **Indicador** | R-03 — Docente supera el tope semanal de horas |
| **FSD de referencia** | `docs/autoevaluacion/FSD_MODAUT_v1_1.docx` — versión 1.0, octubre 2026 |
| **Fecha de cierre** | 2026-10-15 |
| **Fase** | 2B.3.7-B — Cierre documental R-03 |
| **Estado del indicador** | `NO_IMPLEMENTADO` |
| **Dictamen** | **C — DIFERIR** |

Este documento registra el análisis técnico-funcional completo de R-03 basado en la lectura directa del FSD original (`FSD_MODAUT_v1_1.docx`). Toda afirmación sobre los campos del modelo está respaldada por inspección del archivo `backend/prisma/schema.prisma`. Toda afirmación sobre la estructura de los JSON se basa en la lectura del frontend `frontend/app/docentes/mi-ficha/page.tsx`. Toda afirmación sobre los servicios está respaldada por lectura directa del código.

---

## 2. Fuentes y jerarquía documental

| Fuente | Rol | Confiabilidad |
|---|---|---|
| `FSD_MODAUT_v1_1.docx` (§1.3, §3.1, §3.3, §4.1, §5.2, §5.3, §6.1, §6.5) | Especificación normativa — fuente primaria | Alta |
| `backend/prisma/schema.prisma` | Estado real del modelo de datos | Alta |
| `backend/src/modules/autoevaluacion/indicadores/indicadores.registry.ts` | Estado de implementación en MOD-AUT | Alta |
| `backend/src/modules/autoevaluacion/indicadores/indicadores.service.ts` | Motor de evaluación | Alta |
| `backend/src/modules/autoevaluacion/consultas-academicas/consultas-academicas.types.ts` | Contratos de datos de MOD-AUT | Alta |
| `backend/src/modules/docentes/dto/actualizar-docente.dto.ts` | Validaciones de entrada MOD-DOC | Alta |
| `frontend/app/docentes/mi-ficha/page.tsx` | Única fuente del contrato de estructura de los campos JSON | Media (no hay contrato backend equivalente) |
| `docs/autoevaluacion/Modulo_Autoevaluacion_v5_1.html` | Prototipo de referencia — fuente secundaria | Media |

**Jerarquía de conflicto:** el FSD prevalece sobre el prototipo. El código prevalece sobre inferencias del informe de la Fase 2B.3.7-A.

---

## 3. Definición normativa de R-03 (FSD §5.3 Tabla 11)

### 3.1 Fórmula

```
uso_del_tope = horas_docencia + horas_gestion + horas_no_academico
R-03 se activa si: uso_del_tope > P-01 (estrictamente mayor)
```

El FSD (§3.3 Tabla 4) diferencia explícitamente:
- **Uso del tope** = docencia + gestión + desempeño no académico → aplica a R-03
- **Dedicación total** = docencia + gestión + investigación + vinculación + otras dedicaciones → aplica a R-10
- El desempeño no académico **NO** suma en dedicación total. Investigación, vinculación y otras dedicaciones **NO** suman en el uso del tope.

### 3.2 Universo

- Una alerta por docente vigente (FSD §5.3 Tabla 11).
- Alcance: toda la Facultad. Un docente que dicta en varias carreras se evalúa una sola vez (FSD §1.3).
- **Docente vigente** = `ficha_activa = true` AND al menos un cargo docente vigente (FSD §3.3 Tabla 4).
- **Cargo docente vigente** = cargo cuya fecha de fin está vacía o es posterior a la fecha de cálculo. Los cargos de gestión no son cargos docentes (FSD §3.3 Tabla 4).

### 3.3 Componente — Horas de docencia

FSD §3.3 Tabla 4, literal exacto:

> "Suma de las horas semanales de las asignaciones válidas del docente. **Cada asignación aporta las horas completas de la asignatura leídas de MOD-PDE** (regla A de MOD-DOC, sin reparto entre cátedras)."

- Fuente prescrita: `Materia.cargaHorariaSemanal` (MOD-PDE), **no** `VinculacionCatedra.horasSemana`.
- **Asignación válida** = estado `APROBADA` + cargo docente vigente + asignatura de un plan evaluado (FSD §3.3 Tabla 4).
- **Plan evaluado** = plan en estado vigente en MOD-PDE (FSD §3.3 Tabla 4).

### 3.4 Componente — Horas de gestión

FSD §3.3 Tabla 4:

> "Suma de la dedicación semanal de los **cargos de gestión vigentes** (sección 5.1; vigente = fecha de fin vacía o posterior a la fecha de cálculo)."

- Fuente: sección 5.1 de la ficha docente (MOD-DOC) → lista estructurada de cargos con función, dedicación semanal y fechas.
- Vigencia individual por cargo: solo los cargos con fecha de fin vacía o posterior a hoy.
- Los cargos de gestión no son cargos docentes (excluidos de la definición de "docente vigente").

### 3.5 Componente — Horas de desempeño no académico

FSD §3.3 Tabla 4:

> "Suma de la dedicación semanal del desempeño no académico **actual** (sección 6.1)."

- Fuente: sección 6.1 de la ficha docente (MOD-DOC).
- Solo sección 6.1 (actual). Sección 6.2 (pasado) **no** suma.

### 3.6 Parámetro P-01

FSD §4.1 Tabla 5: valor inicial 60 h, configurado por Facultad, fuente Instructivo Ficha Docente CONEAU Global. El FSD lo define como configurable; 60 es el valor de referencia, no un valor obligatorio fijo.

### 3.7 Detalle de la alerta

FSD §5.3 Tabla 11:
> "Docencia ({x} h) + gestión ({y} h) + desempeño no académico ({z} h) suman {total} h semanales; el tope es {P-01} h."

Efecto: resta M-01 (25 puntos) a la consistencia del docente (FSD §6.1).

### 3.8 Ejemplo del FSD (§6.5 Tabla 23)

| Caso | Componentes | Resultado |
|---|---|---|
| Docente sobre el tope | Docencia 8 h + gestión 40 h + no académico 15 h = 63 h > 60 h | Completitud 100. Consistencia 75. Semáforo amarillo. |

---

## 4. Matriz de trazabilidad FSD ↔ Prisma ↔ servicios

| Requisito FSD | Entidad Prisma | Campo | Tipo | Estado | Brecha |
|---|---|---|---|---|---|
| Horas semanales de docencia — fuente MOD-PDE | `Materia` | `cargaHorariaSemanal` | `Int?` | **DISPONIBLE CON LIMITACIONES** | Nullable; si es null para alguna materia, el cálculo es incompleto |
| Horas semanales de docencia — copia en vinculación | `VinculacionCatedra` | `horasSemana` | `Int?` | **DISPONIBLE PERO SEMÁNTICAMENTE NO EQUIVALENTE** | Copia al momento de creación; puede divergir si `Materia.cargaHorariaSemanal` cambia después |
| Lista de cargos de gestión con dedicación semanal (secc. 5.1) | `Docente` | `cargosAcademicosJson` | `String?` | **DISPONIBLE CON LIMITACIONES** | String JSON sin contrato backend; `dedicacionSemanal` es string; fechas en formato "mm-aaaa"; sin validación de estructura en backend |
| Valor agregado de gestión | `Docente` | `tiempoGestionAcademica` | `String?` | **DISPONIBLE PERO SEMÁNTICAMENTE NO EQUIVALENTE** | No es una lista; no permite verificar vigencia individual; no equivale a la suma de cargos vigentes |
| Dedicación semanal por cargo de gestión individual | `Docente` | `tiempoDedicacionGestionSemanal` | `String?` | **DISPONIBLE CON LIMITACIONES** | Un solo cargo; string; no se puede usar para múltiples cargos |
| Fecha de inicio/fin de cargo de gestión individual | `Docente` | `fechaInicioGestion`, `fechaFinGestion` | `String?` | **DISPONIBLE CON LIMITACIONES** | Un solo cargo; no sirve para múltiples cargos de gestión |
| Lista de desempeño no académico actual (secc. 6.1) | `Docente` | `desempenoActualJson` | `String?` | **DISPONIBLE CON LIMITACIONES** | String JSON sin contrato backend; `dedicacionSeman` es string; fechas en "mm-aaaa"; campo no requerido en formulario |
| Desempeño pasado excluido (secc. 6.2) | `Docente` | `desempenoPasadoJson` | `String?` | **DISPONIBLE Y CONFORME** | Los datos pasados están correctamente separados en un campo diferente |
| Parámetro P-01 | `AutoevaluacionConfigFacultad` | `p01TopeH` | `Int` | **DISPONIBLE CON LIMITACIONES** | Sin `@default`; la configuración debe crearse explícitamente para cada facultad; si no existe, el indicador no puede ejecutarse |
| `Docente.activo` = ficha activa | `Docente` | `activo` | `Boolean` | **DISPONIBLE Y CONFORME** | Bien tipado; inicializado en `true` |
| Cargo docente vigente con fechas individuales | `Docente` | `fechaFinCargo` | `String?` | **DISPONIBLE CON LIMITACIONES** | Solo un cargo por docente; YYYY-MM-DD o '' (empty = vigente); múltiples cargos concurrentes no representables |
| Estado `APROBADA` de asignación válida | `VinculacionCatedra` | `estado` | `String` | **DISPONIBLE Y CONFORME** | Bien usado en R-07; mismo criterio aplicaría aquí |
| Plan evaluado (estado vigente) | `PlanEstudio` | `estado` | `String` | **DISPONIBLE CON LIMITACIONES** | Equivalencia entre `'ACTIVO'` y "plan evaluado" (FSD §3.3) no confirmada institucionalmente (DP-4 de R-07, aplica igual a R-03) |
| Consulta docente-céntrica (toda la facultad) | — | — | — | **NO DISPONIBLE** | `ConsultasAcademicasService` opera por plan/carrera, no por docente; no existe query para agregar todas las vinculaciones de un docente en la facultad |

### 4.1 Estructura real de `cargosAcademicosJson`

Contrato implícito (frontend `mi-ficha/page.tsx`, interfaces `CargoAcademicoItem` / `CargoAcademicoForm`):

```typescript
interface CargoAcademicoItem {
  id: string;           // generado en frontend: "cargo-${Date.now()}"
  cargo: string;        // nombre del rol de gestión
  institucion: string;
  modalidad: string;
  periodoDesde: string; // formato "mm-aaaa" (e.g., "03-2024")
  periodoHasta: string; // formato "mm-aaaa" o "" si está en curso
  dedicacionSemanal: string; // solo dígitos (validación frontend); puede ser ""
}
```

No existe contrato equivalente en el backend. El DTO solo valida `@IsString() @IsOptional()`.

### 4.2 Estructura real de `desempenoActualJson`

Contrato implícito (frontend `mi-ficha/page.tsx`, interfaces `DesempenoActualItem` / `DesempenoActualForm`):

```typescript
interface DesempenoActualItem {
  id: string;           // generado en frontend: "desact-${Date.now()}"
  periodoDesde: string; // formato "mm-aaaa"
  periodoHasta: string; // formato "mm-aaaa" o ""
  institucion: string;  // requerido en formulario
  cargo: string;        // requerido en formulario
  modalidad: string;    // requerido en formulario
  dedicacionSeman: string; // solo dígitos (validación frontend); NO requerido
}
```

No existe contrato equivalente en el backend.

---

## 5. Diferencias entre FSD y prototipo (`Modulo_Autoevaluacion_v5_1.html`)

| Dimensión | FSD | Prototipo | Clasificación |
|---|---|---|---|
| Fórmula `doc + ges + noac > P-01` | Sí (§5.3 Tabla 11) | `tope60 = f.doc + f.ges + f.noac > CFG.tope` | COINCIDENTE |
| P-01 valor inicial = 60 | Sí (§4.1 Tabla 5) | `CFG.tope = 60` | COINCIDENTE |
| Investigación y vinculación excluidas del tope | Sí, explícito (§3.3 Tabla 4) | `dedTot` ≠ `tope60` | COINCIDENTE |
| Alerta por docente, prioridad Alta | Sí (§5.2 Tabla 9) | Sí | COINCIDENTE |
| Detalle con desglose x + y + z = total | Sí (§5.3 Tabla 11) | Sí | COINCIDENTE |
| Alcance: toda la facultad | Sí (§1.3) | Sí (itera `DOC[]` una vez por docente) | COINCIDENTE |
| Horas de docencia: fuente MOD-PDE | FSD explícito: "leídas de MOD-PDE" (§3.3 Tabla 4) | `c.hs` en la simulación, sin distinción de fuente | NO VERIFICABLE en prototipo; solo FSD establece la fuente |
| Vigencia de cargo de gestión por fechas | FSD: "fecha de fin vacía o posterior" (§3.3 Tabla 4) | `hsGes(d) = d.gestion.reduce(...)` sin verificación de fechas | CONTRADICCIÓN: prototipo suma todos los cargos de gestión sin verificar vigencia |
| Sección 6.1 (actual) vs. 6.2 (pasado) | FSD: solo sección 6.1 suma (§3.3 Tabla 4) | `d.noac || 0` como valor único, sin distinción | SOLO FSD define la separación actual/pasado |
| Cargo docente vigente por fechas | FSD: "fecha de fin vacía o posterior" (§3.3 Tabla 4) | `vig(d) = d.cargos.filter(c => c.vigente !== false)` booleano | CONTRADICCIÓN: prototipo usa booleano; FSD requiere comparación de fechas |
| "Docente vigente" requiere cargo vigente | FSD: definición formal (§3.3 Tabla 4) | No verifica; datos ya pre-filtrados en simulación | SOLO FSD tiene definición formal |

---

## 6. Diferencias entre FSD y modelo actual

| Requisito FSD | Expectativa del FSD | Modelo actual | Brecha |
|---|---|---|---|
| Horas de docencia desde MOD-PDE | `Materia.cargaHorariaSemanal` por asignación válida | Campo existe (`Int?`); `VinculacionCatedra.horasSemana` es copia al crear, puede ser obsoleta | Fuente correcta existe pero nullable; copia en vinculación puede diferir |
| Lista de cargos de gestión con dedicación y fechas | Lista estructurada con `dedicación_semanal` y `fechas` per cargo | `cargosAcademicosJson String?` con estructura implícita; `dedicacionSemanal` es string | Estructura existe pero sin contrato ni validación backend; tipo incorrecto para suma numérica directa |
| Vigencia individual de cargo de gestión | Comparar `periodoHasta` de cada cargo con fecha de cálculo | `periodoHasta` en formato "mm-aaaa"; no hay comparación implementada | Formato "mm-aaaa" es comparable mes-a-mes pero no día-a-día; no implementado |
| Lista de desempeño no académico actual (secc. 6.1) | Lista con `dedicación_semanal` y separada de desempeño pasado | `desempenoActualJson String?`; `dedicacionSeman` es string; separado de `desempenoPasadoJson` | Separación actual/pasado correcta; `dedicacionSeman` como string sin validación backend |
| Cargo docente vigente por fechas | Una fecha de inicio y fin por cargo docente individual | `Docente.fechaFinCargo String?`; un solo cargo posible; inicializado a `''` (vigente) | Solo un cargo por docente; `''` como sustituto de null-vigente es un patrón frágil |
| Consulta docente-céntrica de toda la facultad | Todos los datos del docente en todas las carreras | `ConsultasAcademicasService` opera por plan | Infraestructura de consulta inexistente para R-03 |
| P-01 configurable por facultad sin default | Valor institucional, no inferido | `p01TopeH Int` sin `@default`; el comentario del schema lo confirma | Correcto en diseño; pero si no se crea la config, el indicador no puede ejecutarse |

### 6.1 Corrección a la Fase 2B.3.7-A

La auditoría de la Fase 2B.3.7-A identificó las siguientes limitaciones:
- **R-03a**: `tiempoGestionAcademica String?` → workaround: `parseInt/parseFloat`.
- **R-03b**: "No existe campo para desempeño no académico."

Ambas afirmaciones requieren corrección tras leer el FSD:

**Corrección de R-03a:** La fuente normativa para horas de gestión NO es `tiempoGestionAcademica`. Según el FSD §3.3 y §3.1 Tabla 2, la fuente es la sección 5.1 de la ficha (lista de cargos con función, dedicación semanal y fechas), que en el modelo actual corresponde a `cargosAcademicosJson`. El campo `tiempoGestionAcademica` es un valor agregado único, sin estructura de lista ni fechas, y es semánticamente NO equivalente al requisito del FSD. No puede usarse como aproximación válida porque no permite verificar vigencia individual de cada cargo.

**Corrección de R-03b:** El campo para desempeño no académico SÍ existe: `desempenoActualJson String?`. La limitación real no es ausencia del campo sino ausencia de contrato numérico backend: `dedicacionSeman` dentro del JSON es una cadena de texto, sin validación backend de tipo numérico, y el campo no es requerido en el formulario.

---

## 7. Auditoría de viabilidad actualizada

### A. Implementación completa

**Dictamen: NO VIABLE con el modelo actual.**

Requisitos no satisfechos:
1. No existe consulta docente-céntrica en `ConsultasAcademicasService` (bloqueante).
2. `dedicacionSemanal` en `cargosAcademicosJson` y `dedicacionSeman` en `desempenoActualJson` son strings sin validación backend (bloqueante para suma numérica confiable).
3. `Materia.cargaHorariaSemanal Int?` es nullable; si es null no se puede calcular la componente de docencia.
4. La vigencia individual de cargos de gestión requiere comparación por "mm-aaaa" que no está implementada en ningún servicio.
5. `Docente.fechaFinCargo String?` solo soporta un cargo docente; múltiples cargos concurrentes no son representables.
6. `AutoevaluacionConfigFacultad.p01TopeH` puede no existir para la facultad solicitada.

### B. Implementación parcial

**Dictamen: NO RECOMENDADA — produciría falsos negativos sistemáticos.**

Sería posible implementar solo la componente de docencia sumando `Materia.cargaHorariaSemanal` de las asignaciones APROBADAS del docente. Sin embargo:
- Si el docente tiene horas de gestión o desempeño no académico no cargadas, la suma parcial sería menor que el tope → sin alerta → **falso negativo**.
- Un docente con 55 h de gestión y 0 h declaradas de docencia no recibiría alerta, cuando debería.
- Presentar la ausencia de alerta como cumplimiento sería funcionalmente incorrecto.
- El FSD establece que R-03 no se puede calcular sin los tres componentes.

El FSD no contempla un modo de cálculo parcial para R-03. La fórmula requiere los tres sumandos. Calcular con uno o dos implica sistemáticamente subestimar el uso del tope.

### C. Diferimiento documentado

**Dictamen: RECOMENDADO.**

El diferimiento preserva la integridad del indicador y evita el riesgo de falsos negativos. El estado `NO_IMPLEMENTADO` en el motor es exacto y comunica correctamente la situación.

El diferimiento no implica que los datos no existan: la estructura de datos es mayoritariamente correcta. Lo que falta es:
1. Una consulta docente-céntrica nueva.
2. Contratos numéricos en el backend para los JSON de gestión y desempeño.
3. Validación de que los campos críticos no sean null antes de calcular.

---

## 8. Riesgos técnicos y funcionales

| ID | Riesgo | Probabilidad | Impacto |
|---|---|---|---|
| RT-01 | Falsos negativos si se implementa R-03 sin los tres componentes completos | Alta | Crítico — docentes sobre el tope no recibirían alerta |
| RT-02 | `dedicacionSemanal`/`dedicacionSeman` vacíos producen NaN al parsear | Alta | Alta — la mayoría de docentes existentes no tienen estos datos cargados |
| RT-03 | `Materia.cargaHorariaSemanal` null para algunas materias omite horas reales | Media | Alta — la componente de docencia quedaría subestimada |
| RT-04 | `cargosAcademicosJson` sin contrato backend permite estructuras inválidas | Media | Alta — un JSON malformado o con campos faltantes causaría error en tiempo de ejecución |
| RT-05 | Stale data en `VinculacionCatedra.horasSemana` si se usa en lugar de `Materia.cargaHorariaSemanal` | Media | Media — puede producir resultados inconsistentes si el plan fue modificado |
| RT-06 | Cargos de gestión sin fecha de fin (`periodoHasta = ''`) asumidos como vigentes cuando podrían estar cerrados | Media | Media — sobreestimación de horas de gestión |
| RT-07 | Cargos de gestión con `periodoHasta` en el pasado no excluidos si no se implementa el filtro de vigencia | Alta | Media — contabilización de cargos inactivos |
| RT-08 | Consulta cross-carrera sin control RBAC adecuado podría exponer vinculaciones de otras facultades | Baja | Alta — requiere diseño cuidadoso del scope |
| RT-09 | Doble cómputo de horas si un docente tiene dos cargos sobre la misma (materia, cátedra) | Baja | Media — el FSD no es explícito sobre deduplicación para horas (solo para count de materias) |
| RT-10 | `p01TopeH` no configurado para la facultad → error en tiempo de ejecución o comportamiento indefinido | Media | Alta — el motor debe manejar el caso `config = null` |

---

## 9. Estado de implementación actual

### 9.1 Registro de indicadores (`indicadores.registry.ts`)

R-03 está registrado con los siguientes metadatos (líneas 118-129):

```typescript
{
  codigo: 'R-03',
  nombre: 'Tope semanal de horas docentes',
  descripcion: 'Docencia + gestión + desempeño no académico superan el tope semanal configurado (p01TopeH, ref. CONEAU Global).',
  tipo: 'ALERTA',
  severidad: 'ALTA',
  alcance: 'DOCENTE',
  estadoImplementacion: 'NO_IMPLEMENTADO',
  motivoPendiente: 'R-03: tiempoGestionAcademica y dedicacionDeclaradaSemanal son String? — no existe campo numérico para desempeño no académico (R-03b). Riesgo de duplicación de horas (R-03d).',
}
```

Observación: el `motivoPendiente` registrado en el código cita `tiempoGestionAcademica` como fuente de gestión y sostiene que "no existe campo numérico para desempeño no académico". Ambas afirmaciones deben actualizarse cuando se reabra R-03, a la luz del análisis del FSD (ver §6.1 de este documento).

### 9.2 Motor de indicadores (`indicadores.service.ts`)

`IndicadoresService` asigna evaluadores para R-02, R-06, R-07, R-08, R-09 en su constructor (líneas 63-67). **No asigna evaluador para R-03.**

Comportamiento para R-03: cuando el motor recibe una solicitud para R-03, ejecuta `resultadoNoImplementado(...)` (líneas 81-86). No se devuelve ningún cálculo ficticio ni parcial. Este comportamiento es correcto.

### 9.3 Evaluador

No existe archivo `r03.evaluador.ts` ni ningún servicio que calcule R-03. La infraestructura de evaluación (interfaces `IndicadorEvaluador<T>`, `ResultadoIndicador<T>`, `ContextoEvaluacion`) está disponible y es reutilizable.

### 9.4 Tests

No existen tests específicos para R-03 dado que no hay implementación.

### 9.5 Independencia de otros indicadores

R-07 está implementado (`estadoImplementacion: 'IMPLEMENTADO'`). R-03 comparte con R-07 las definiciones de "docente vigente", "asignación válida" y "cargo vigente" (FSD §3.3 Tabla 4), así como la limitación DP-1 sobre la representación de cargos. Este cierre no modifica R-07.

---

## 10. Condiciones para reabrir R-03

Las siguientes condiciones deben satisfacerse antes de iniciar la implementación:

| Condición | Prioridad | Responsable |
|---|---|---|
| C-01: Definición de contrato numérico para `dedicacionSemanal` en `cargosAcademicosJson` — validación en el backend que garantice que el campo es un número ≥ 0 cuando existe | **Bloqueante** | Desarrollo MOD-DOC |
| C-02: Definición de contrato numérico para `dedicacionSeman` en `desempenoActualJson` — mismo requisito | **Bloqueante** | Desarrollo MOD-DOC |
| C-03: Implementación de consulta docente-céntrica en `ConsultasAcademicasService` — capaz de recuperar todas las asignaciones APROBADAS de un docente en toda la facultad con sus `materiaId`, `catedraId`, `planEstudioId` y las horas desde `Materia.cargaHorariaSemanal` | **Bloqueante** | Desarrollo MOD-AUT |
| C-04: Decisión institucional sobre la equivalencia entre `PlanEstudio.estado = 'ACTIVO'` y "plan evaluado" (FSD §3.3) | **Bloqueante** | Dirección académica + Desarrollo |
| C-05: Definición de la regla de conteo de horas cuando un docente tiene dos cargos sobre la misma (materia, cátedra) — ¿contribuyen individualmente o se deduplicaban las horas? | Importante | Dirección académica |
| C-06: Decisión sobre cómo tratar `Materia.cargaHorariaSemanal = null` — ¿genera estado `PARCIAL`, `NO_DETERMINABLE` o bloquea el cálculo? | Importante | Desarrollo MOD-AUT |
| C-07: Configuración de `AutoevaluacionConfigFacultad.p01TopeH` para la facultad — si la config no existe, definir comportamiento del motor | Importante | Administración + Desarrollo |
| C-08: Decisión sobre el uso de `Materia.cargaHorariaSemanal` (autorizado por FSD) vs. `VinculacionCatedra.horasSemana` (copia denormalizada) | Recomendado | Desarrollo |

---

## 11. Dictamen final

**C — DIFERIR.**

R-03 no es implementable de manera completa ni parcial conforme al FSD con el modelo de datos actual, por las siguientes razones verificadas en el código:

1. Los campos `dedicacionSemanal` y `dedicacionSeman` en los JSON de gestión y desempeño son cadenas de texto sin validación numérica en el backend. Una suma sobre estos campos produce NaN para la mayoría de los docentes existentes (campos vacíos inicializados como `''`).

2. No existe una consulta docente-céntrica. `ConsultasAcademicasService` opera por plan/carrera; agregar las asignaciones de un docente en toda la facultad requiere una nueva consulta con controles RBAC adecuados.

3. Una implementación parcial (solo componente de docencia) produciría falsos negativos sistemáticos: docentes con exceso de horas de gestión no recibirían alerta.

4. `cargosAcademicosJson` y `desempenoActualJson` tienen la estructura de datos correcta (listas con fechas y dedicación), pero carecen de contratos backend que garanticen la integridad de los valores numéricos.

El diferimiento es la única opción que preserva la integridad funcional del indicador. La infraestructura de MOD-AUT (motor, registro, evaluadores) está diseñada para incorporar R-03 en una fase futura sin cambios estructurales, una vez que se resuelvan las condiciones C-01 a C-04.
