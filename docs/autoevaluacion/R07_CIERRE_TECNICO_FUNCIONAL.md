# R-07 — Cierre Técnico y Funcional

## 3.1 Identificación

| Campo | Valor |
|---|---|
| **Proyecto** | UDEMM Global |
| **Módulo** | MOD-AUT — Motor de autoevaluación CONEAU |
| **Indicador** | R-07 — Docentes sobre-asignados |
| **Fecha** | 2026-10-15 |
| **Versión del documento** | 1.0 |
| **Estado del indicador** | ESTABILIZADO CON OBSERVACIONES — NO VALIDADO INSTITUCIONALMENTE |
| **Alcance del cierre** | Evaluación técnica del motor de cálculo y de las pruebas unitarias e integradas asociadas. No incluye validación institucional ni despliegue en producción. |

---

## 3.2 Especificación funcional

### Fuentes documentales

- `docs/autoevaluacion/FSD_MODAUT_v1_1.docx`
- `docs/autoevaluacion/Modulo_Autoevaluacion_v5_1.html` (prototipo HTML v5.1)

### Reglas del FSD

| Elemento | Definición (FSD) |
|---|---|
| **Condición de alerta** | Docente vigente cuyas materias (§3.3) son **estrictamente más** que P-03. |
| **Comparación** | `nMat(d) > P-03`. Igualdad exacta no genera alerta. |
| **Docente vigente** | Docente cuyo cargo está vigente al momento de la evaluación. Requiere seguimiento individual de nombramientos. |
| **Materias del docente** | Cantidad de combinaciones distintas `(planEstudioId, materiaId, catedraId)` entre las vinculaciones válidas del docente. La misma asignatura en dos cátedras distintas cuenta dos veces. Dos cargos sobre la misma combinación cuentan una vez (FSD §3.3). |
| **P-03** | Parámetro institucional por facultad: `AutoevaluacionConfigFacultad.p03MaxMat`. |
| **Alcance** | Plantel docente de la facultad (todas las carreras). |
| **Granularidad** | Una alerta por docente. |
| **Detalle requerido** | "Tiene {n} materias vigentes (máximo definido: {P-03}): {Asignatura 1}, {Asignatura 2}, …" en orden alfabético (FSD §5.3). |

---

## 3.3 Implementación actual

### Cálculo cross-carrera dentro de la facultad

Cuando el rol del solicitante pertenece al conjunto `{ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, RECTORADO, DECANO}` (`alcanceFacultad = true`), el servicio consulta **todas** las vinculaciones de la facultad filtrando por `facultadId`. Para `DIRECTOR_CARRERA` (`alcanceFacultad = false`), la consulta se restringe a la `carreraId` indicada y el resultado queda clasificado como `PARCIAL`.

Archivo: `backend/src/modules/autoevaluacion/consultas-academicas/consultas-academicas.service.ts`, método `obtenerVinculacionesParaR07`.

### Deduplicación

Se usa la clave `${planEstudioId}|${materiaId}|${catedraId}` como identificador único de combinación (FSD §3.3). La implementación usa un `Map<string, string>` donde la clave es el dedup key y el valor es el nombre de la materia, lo que permite el ordenamiento posterior.

Archivo: `backend/src/modules/autoevaluacion/indicadores/r07.evaluador.ts`.

### Vinculaciones APROBADAS

Solo se consideran vinculaciones con `estado === 'APROBADA'`. Los estados `PENDIENTE_DE_APROBACION`, `RECHAZADA` y `DESVINCULADA` no participan en el cálculo.

**Advertencia (DP-1):** el estado `APROBADA` se usa como aproximación de cargo vigente. El modelo `Cargo` es un catálogo de tipos de cargo sin fechas de nombramiento individual (`fechaInicio`, `fechaFin`). La vigencia real de cada cargo no puede verificarse con el esquema actual. Ver §R07_DECISIONES_Y_LIMITACIONES.md, decisión DP-1.

### Exclusión de docentes inactivos

Se aplica el filtro `v.docente.activo === true` sobre las vinculaciones APROBADAS antes de construir el universo de cálculo. `Docente.activo = false` indica baja lógica en MOD-DOC: cuando se activa la baja, el servicio `DocentesService` también cierra automáticamente las vinculaciones APROBADA y PENDIENTE. El filtro por `activo` proporciona una capa adicional de consistencia frente a casos excepcionales.

**Distinción importante:** `Docente.activo` representa el estado de la ficha del docente, **no** la vigencia de su cargo. Un docente puede tener `activo = true` y tener un cargo finalizado si el sistema no registra fechas de nombramiento individual (DP-1).

### Comparación con P-03

`nMaterias > p03MaxMat` (comparación estricta). Si `p03MaxMat` no está configurado para la facultad, el estado es `NO_DETERMINABLE`.

### Detección de docentes multi-facultad

Cuando `alcanceFacultad = true`, el servicio ejecuta internamente una consulta para detectar si algún docente del scope tiene vinculaciones `APROBADA` en otras facultades (`facultadId != authorized AND docente.activo = true`). Este proceso es **privado** (`private detectarDocentesMultiFacultad`): los docenteIds provienen exclusivamente de la consulta autorizada previa; no pueden suministrarse desde el exterior.

Los docentes detectados quedan clasificados como `NO_DETERMINABLE` con `causa: 'CROSS_FACULTAD'`. No se exponen datos de otras facultades. Esta clasificación es una **decisión provisional** del proyecto; el criterio institucional no está aprobado (DP-2).

### Clasificación de resultados

| Estado | Condición |
|---|---|
| `NO_APLICA` | Sin vinculaciones APROBADAS de docentes activos en el alcance. |
| `NO_DETERMINABLE` | `p03MaxMat` no configurado para la facultad. |
| `PARCIAL` | `alcanceFacultad = false` (DIRECTOR_CARRERA) o hay docentes `NO_DETERMINABLE` por causa `CROSS_FACULTAD`. |
| `CALCULADO` | `alcanceFacultad = true` y ningún docente `NO_DETERMINABLE`. |

Un resultado `CALCULADO` puede estar condicionado por las limitaciones DP-1 y DP-4. Las advertencias correspondientes están incorporadas en `datosFaltantes` pero **no modifican `estadoCalculo`**.

### Ordenamiento de asignaturas

Las asignaciones de cada docente sobre-asignado se ordenan alfabéticamente por nombre de materia (`String.prototype.localeCompare` con locale `'es'`). En caso de empate de nombre, el orden secundario es `catedraId` para garantizar determinismo. Este ordenamiento corresponde al requerimiento del FSD §5.3.

### Advertencias funcionales en el resultado

Para todos los estados con datos reales (CALCULADO, PARCIAL, NO_DETERMINABLE), el campo `datosFaltantes` incluye:

| Campo | Entidad | Descripción |
|---|---|---|
| `cargoVigente` | `Cargo` | DP-1: vigencia individual de cargos no verificable con el esquema actual. |
| `planEvaluado` | `PlanEstudio` | DP-4: equivalencia entre `PlanEstudio.estado = 'ACTIVO'` y plan evaluado no confirmada. |

El estado `NO_APLICA` no incluye estas advertencias (no hay vinculaciones evaluables).

Para estados PARCIAL, se añade previamente la advertencia de scope correspondiente (`vinculacionesOtrasCarreras` o `vinculacionesOtrasFacultades`).

Para estado NO_DETERMINABLE, se añade previamente `p03MaxMat` (configuración ausente).

### Controles RBAC y scopes

**Primera capa — IndicadoresService:**
- `ROLES_MODAUT = {ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, RECTORADO, DECANO, DIRECTOR_CARRERA}`.
- Roles fuera de este conjunto (incluido `ADMINISTRATIVO`) reciben `ForbiddenException` antes de llegar al evaluador.

**Segunda capa — ConsultasAcademicasService:**
- `checkRol` rechaza `DOCENTE` y `ADMINISTRATIVO` con `ForbiddenException`.
- `tieneScopeCarrera` verifica el scope institucional del solicitante sobre la carrera.

**IndicadoresService** no expone endpoints HTTP. No existe controlador que enrute solicitudes hacia `R07EvaluadorService`.

---

## 3.4 Matriz de trazabilidad

| ID | Fuente | Regla | Archivo implementador | Suite de prueba | Estado | Observaciones |
|---|---|---|---|---|---|---|
| RT-01 | FSD §5.3 | Condición `nMat > P-03` (estricto) | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §E | IMPLEMENTADO | |
| RT-02 | FSD §3.3 | Unidad de conteo `(planEstudioId, materiaId, catedraId)` | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §H | IMPLEMENTADO | |
| RT-03 | FSD §5.3 | Una alerta por docente | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §F, §G | IMPLEMENTADO | |
| RT-04 | FSD §5.3 | Orden alfabético de asignaturas | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §N | IMPLEMENTADO | |
| RT-05 | FSD §5.3, G-14 | P-03 por facultad (`p03MaxMat`) | `r07.evaluador.ts`, `consultas-academicas.service.ts` | `r07.evaluador.spec.ts` §C, §D | IMPLEMENTADO | |
| RT-06 | FSD §3.3 | Docente vigente (cargo vigente) | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §I, §P | IMPLEMENTADO PROVISIONALMENTE | Aproximado por `estado = APROBADA AND docente.activo = true`. Vigencia individual de cargos no verificada (DP-1). |
| RT-07 | FSD §3.3 | Plan evaluado (solo asignaturas de planes vigentes en MOD-PDE) | — | — | DIFERIDO | Sin filtro por estado del plan. Equivalencia entre `estado = 'ACTIVO'` y plan evaluable no confirmada (DP-4). |
| RT-08 | Decisión 2B.3.6.1-B | Alcance cross-carrera (misma facultad) | `consultas-academicas.service.ts` | `r07.evaluador.spec.ts` §K | IMPLEMENTADO | |
| RT-09 | Decisión 2B.3.6.1-B | Docentes con asignaciones en múltiples facultades: `NO_DETERMINABLE` | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §L | IMPLEMENTADO PROVISIONALMENTE | Criterio institucional no aprobado (DP-2). |
| RT-10 | Arquitectura | DIRECTOR_CARRERA: resultado `PARCIAL` | `r07.evaluador.ts`, `consultas-academicas.service.ts` | `r07.evaluador.spec.ts` §M | IMPLEMENTADO | Sin ampliación de permisos (DP-3). |
| RT-11 | Fase 2B.3.6.1-D (OBS-FUN-01) | Exclusión de docentes inactivos (`Docente.activo = false`) | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §P | IMPLEMENTADO | |
| RT-12 | Fase 2B.3.6.1-D (DP-1, DP-4) | Advertencias estructurales en `datosFaltantes` | `r07.evaluador.ts` | `r07.evaluador.spec.ts` §O | IMPLEMENTADO | |
| RT-13 | Fase 2B.3.6.1-D (OBS-SEG-01) | Detección multi-facultad encapsulada sin acceso externo | `consultas-academicas.service.ts` | `consultas-academicas.spec.ts` §J.2 | IMPLEMENTADO | Método `private`; verificado indirectamente. |

---

## 3.5 Historial de fases

### Fase 2B.3.6 — Implementación inicial

**Motivo:** primera implementación del indicador R-07 en el motor MOD-AUT.

**Alcance:** consulta por carreraId. Deduplicación básica `(materiaId, catedraId)`.

**Resultado:** evaluador funcional limitado al scope de una carrera.

### Fase 2B.3.6.1-A — Corrección de deduplicación

**Motivo:** la clave de deduplicación original no incluía `planEstudioId`, lo que podía sobrecontar materias en planes distintos.

**Corrección:** clave extendida a `${planEstudioId}|${materiaId}|${catedraId}` conforme a FSD §3.3.

**Resultado:** conteo correcto de combinaciones distintas.

### Fase 2B.3.6.1-B — Cálculo cross-carrera y detección multi-facultad

**Motivo:** el FSD define el alcance como el plantel docente de la facultad, no de una sola carrera.

**Correcciones:**
- Introducción de `alcanceFacultad`: consulta por `facultadId` para roles con acceso completo, por `carreraId` para DIRECTOR_CARRERA.
- Detección de docentes con asignaciones en otras facultades: clasificados como `NO_DETERMINABLE / CROSS_FACULTAD`.
- Tipos `VinculacionesParaR07`, `DocenteNoDeterminableR07`, campo `alcanceFacultad` en `ResultadoR07`.
- Cobertura de pruebas ampliada (secciones K, L, M).

**Resultado:** evaluador con alcance cross-carrera y manejo de casos multi-facultad.

### Fase 2B.3.6.1-C — Auditoría integral

**Motivo:** revisión de seguridad, consistencia funcional y trazabilidad antes de estabilización.

**Resultado:** dictamen B — APROBADO CON OBSERVACIONES. Observaciones registradas:

- **OBS-SEG-01:** `detectarDocentesMultiFacultad` era un método público sin autorización propia.
- **OBS-FUN-01:** docentes con `Docente.activo = false` no estaban excluidos del cálculo.
- **OBS-PRES-01:** asignaturas no ordenadas alfabéticamente (FSD §5.3 incumplido).
- **DP-1:** vigencia individual de cargos no implementada.
- **DP-4:** equivalencia plan evaluado / `estado = 'ACTIVO'` no confirmada.

### Fase 2B.3.6.1-D — Estabilización

**Motivo:** corrección de las observaciones identificadas en la auditoría.

**Correcciones:**
- OBS-SEG-01: `detectarDocentesMultiFacultad` movido a `private`; integrado dentro de `obtenerVinculacionesParaR07`. Los docentes candidatos provienen exclusivamente de la consulta autorizada.
- OBS-FUN-01: filtro `v.docente.activo` aplicado antes de construir el universo de cálculo.
- OBS-PRES-01: nombre de materia recuperado desde `VinculacionCatedra.materia.nombre`; asignaciones ordenadas con `localeCompare('es')`.
- DP-1 / DP-4: advertencias estructurales incorporadas en `datosFaltantes` para todos los estados con datos reales.

**Resultado:** correcciones aplicadas, pruebas actualizadas y extendidas.

---

## 3.6 Evidencias de validación

Las siguientes validaciones corresponden a la ejecución del **2026-10-15**, tras la implementación de la Fase 2B.3.6.1-D:

| Comando | Resultado |
|---|---|
| `npx prisma validate` | ✅ schema válido |
| `npx tsc --noEmit` | ✅ exit 0, sin errores de tipos |
| `npx jest --runInBand` | ✅ 748 aprobadas / 1 omitida (pre-existente) / 0 fallidas |
| `npm run build` | ✅ compilación de producción sin errores |

**Nota sobre el conteo de pruebas:** las 748 pruebas corresponden a la suite completa del backend (28 suites ejecutadas, 1 omitida). Las pruebas específicas de R-07 se encuentran distribuidas en tres suites:
- `r07.evaluador.spec.ts` — pruebas unitarias del evaluador (secciones A–Q).
- `indicadores.spec.ts` — integración de R-07 con `IndicadoresService` (sección H).
- `consultas-academicas.spec.ts` — pruebas de `ConsultasAcademicasService` (sección J).

---

## 3.7 Riesgos residuales

### RR-01 — Vigencia de cargos no verificada (DP-1)

Un resultado `CALCULADO` puede incluir asignaciones de docentes cuyo cargo haya finalizado, si el cargo no fue cerrado mediante una desvinculación en el sistema. El modelo `Cargo` no registra nombramientos individuales con fechas; el campo `VinculacionCatedra.anioInicio Int?` solo contiene el año de inicio sin fecha de finalización.

**Advertencia incorporada:** `datosFaltantes[].campo = 'cargoVigente'` en todos los estados con datos reales.

**Impacto potencial:** sobreestimación del número de docentes sobre-asignados si existen vinculaciones históricas no desvinculadas.

### RR-02 — Planes históricos no filtrados (DP-4)

El cálculo incluye vinculaciones de todos los planes de estudio sin filtrar por su estado. No se sabe con certeza qué valores de `PlanEstudio.estado` corresponden a planes evaluables según el FSD. Los valores posibles del campo se inicializan como `'ACTIVO'` por defecto, pero no existe confirmación institucional de qué otros estados existen ni cuál es su semántica.

**Advertencia incorporada:** `datosFaltantes[].campo = 'planEvaluado'` en todos los estados con datos reales.

**Impacto potencial:** inclusión de asignaciones de planes fuera del alcance del FSD.

### RR-03 — Docentes multi-facultad: criterio no aprobado (DP-2)

La clasificación de docentes cross-facultad como `NO_DETERMINABLE` es una decisión provisional del proyecto. No existe una regla institucional aprobada para este caso. El indicador queda `PARCIAL` cuando hay docentes en esta situación.

### RR-04 — DIRECTOR_CARRERA: evaluación incompleta (DP-3)

Un `DIRECTOR_CARRERA` obtiene siempre un resultado `PARCIAL` porque su scope está limitado a su carrera. Los valores de `nMaterias` pueden estar subestimados si el docente tiene asignaciones en otras carreras.

### RR-05 — Resultado CALCULADO con limitaciones funcionales

Un estado `estadoCalculo = CALCULADO` no implica cumplimiento integral del FSD. Pueden existir limitaciones por DP-1 o DP-4. Las advertencias en `datosFaltantes` señalan estas limitaciones, pero no elevan el estado a `PARCIAL` ni a `NO_DETERMINABLE`.

---

## 3.8 Condiciones de uso

R-07 en su estado actual:

1. **Puede utilizarse** para desarrollo, pruebas y validación interna controlada.

2. **No debe presentarse** como evaluación institucional definitiva ni como resultado CONEAU.

3. **No debe exponerse** a usuarios finales sin revisión adicional del circuito completo de permisos, del contrato de respuesta hacia el frontend, y de la comunicación de limitaciones al usuario.

4. **No debe utilizarse** como fundamento único de decisiones académicas o administrativas mientras existan los requisitos funcionales diferidos descritos en este documento (RT-06 provisional, RT-07 diferido).

5. El estado `CALCULADO` con `datosFaltantes` no vacío indica que el resultado es técnicamente correcto dentro del modelo de datos disponible, pero puede diferir del criterio definitivo del FSD si los datos históricos no fueron correctamente cerrados en el sistema.
