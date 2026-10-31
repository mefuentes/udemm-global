# R-07 — Decisiones de Implementación y Limitaciones

## Información del documento

| Campo | Valor |
|---|---|
| **Proyecto** | UDEMM Global |
| **Módulo** | MOD-AUT — Motor de autoevaluación CONEAU |
| **Indicador** | R-07 — Docentes sobre-asignados |
| **Fecha** | 2026-10-15 |
| **Versión** | 1.0 |

Este documento registra las decisiones de diseño con impacto en la fidelidad funcional del indicador R-07, las limitaciones del modelo de datos que condicionan esas decisiones, y las observaciones técnicas identificadas y resueltas durante el ciclo de implementación. Su propósito es preservar el contexto de las elecciones realizadas para facilitar revisiones futuras.

---

## Decisiones de implementación

### DP-1 — Vigencia individual de cargos no implementada

**Estado:** DIFERIDO — advertencia incorporada en el resultado

**Regla del FSD:**
El FSD §3.3 define "docente vigente" como aquel cuyo cargo está vigente al momento de la evaluación. R-07 solo debe considerar docentes con cargo activo.

**Limitación del modelo de datos:**
El modelo `Cargo` es un catálogo de tipos de cargo institucionales (e.g., "Profesor Titular", "Jefe de Trabajos Prácticos"). Contiene los campos `id`, `nombre`, `activo` (flag global del tipo de cargo), `fechaCreacion` y `fechaActualizacion`. No registra nombramientos individuales de docentes con fechas de inicio y fin.

La tabla `VinculacionCatedra` registra `anioInicio Int?` (año de inicio del vínculo, opcional) pero no tiene campo de fecha de finalización del cargo. El campo `fechaAprobacion DateTime?` registra cuándo se aprobó la vinculación, no su vigencia.

**Decisión adoptada:**
Se usa el estado `APROBADA` de la vinculación como aproximación de cargo vigente. En el sistema UDEMM Global, el estado `APROBADA` representa la aprobación institucional de la asignación docente. Vinculaciones en estado `PENDIENTE_DE_APROBACION`, `RECHAZADA` y `DESVINCULADA` no participan en el cálculo.

**Limitación residual:**
Esta aproximación puede incluir cargos finalizado si la vinculación no fue explícitamente desvinculada en el sistema. También puede excluir asignaciones pendientes de aprobación que ya están operativamente activas.

**Advertencia incorporada:**
```json
{
  "campo": "cargoVigente",
  "entidad": "Cargo",
  "descripcion": "DP-1: La tabla Cargo es un catálogo de roles sin fechas de nombramiento individuales. La vigencia del cargo se aproxima por estado APROBADA de la vinculación; puede incluir cargos finalizados o excluir asignaciones pendientes de aprobación."
}
```
Esta advertencia aparece en `datosFaltantes` para los estados `CALCULADO`, `PARCIAL` y `NO_DETERMINABLE`.

**Condición para resolver:**
Requiere un modelo de nombramientos individuales en el esquema: `fechaInicio` y `fechaFin` por vínculo docente-cargo, o una tabla `NombramientoDocente` separada. La decisión de agregar este dato al modelo de datos es institucional.

---

### DP-2 — Docentes con asignaciones en múltiples facultades: clasificación provisional

**Estado:** IMPLEMENTADO PROVISIONALMENTE — criterio institucional pendiente de aprobación

**Situación:**
R-07 evalúa el exceso de asignaciones de un docente dentro del plantel de una facultad. Si el mismo docente tiene vinculaciones `APROBADA` en otras facultades, el cálculo de `nMaterias` estaría incompleto: se contarían solo las asignaciones de la facultad del solicitante, no el total real.

**Alternativas consideradas:**
1. Incluir igualmente al docente en el resultado con los datos disponibles (subestimación conocida).
2. Excluir al docente del cálculo (omisión sin advertencia).
3. Clasificar al docente como `NO_DETERMINABLE` con causa `CROSS_FACULTAD` e informar que no es posible calcular con certeza.

**Decisión adoptada:**
Alternativa 3: el docente queda clasificado como `NO_DETERMINABLE / CROSS_FACULTAD`. Su información se separa del resultado principal y se informa con la advertencia correspondiente en `noDeterminables`. El indicador queda en estado `PARCIAL` cuando hay al menos un docente en esta situación.

No se exponen datos de vinculaciones de otras facultades en el resultado del solicitante.

**Base de la decisión:**
Decisión de diseño del proyecto (Fase 2B.3.6.1-B). No existe una regla institucional aprobada que indique cómo tratar este caso.

**Condición para resolver:**
Requiere una decisión institucional sobre el alcance de R-07 para docentes con asignaciones en múltiples facultades: si el indicador debe evaluarlos en términos globales o limitados por facultad.

---

### DP-3 — DIRECTOR_CARRERA: resultado PARCIAL sin ampliación de scope

**Estado:** IMPLEMENTADO — comportamiento establecido

**Situación:**
El rol `DIRECTOR_CARRERA` tiene un scope institucional limitado a su carrera. Sin embargo, R-07 evalúa el plantel de toda la facultad: un docente puede tener asignaciones en múltiples carreras, y desde el scope de una sola carrera el cálculo de `nMaterias` estará incompleto.

**Decisión adoptada:**
No se amplía el scope del `DIRECTOR_CARRERA` para esta consulta. La consulta se restringe a la `carreraId` del solicitante. El resultado queda clasificado como `PARCIAL` de forma incondicional para este rol.

**Fundamento:**
Ampliar el scope violaría los controles RBAC establecidos para el módulo. El `DIRECTOR_CARRERA` solo tiene acceso institucional a los datos de su carrera.

**Implicación para el usuario:**
Un `DIRECTOR_CARRERA` puede obtener resultados conservadores: docentes que parecen no sobre-asignados dentro de su carrera pueden estarlo si se suman las asignaciones en otras carreras. El estado `PARCIAL` comunica esta limitación.

**Condición para resolver:**
Si se requiere que un `DIRECTOR_CARRERA` pueda ver el indicador R-07 con alcance completo de facultad, debe redefinirse institucionalmente su nivel de acceso en el módulo MOD-AUT.

---

### DP-4 — Plan evaluado: sin filtro por estado del plan

**Estado:** DIFERIDO — advertencia incorporada en el resultado

**Regla del FSD:**
El FSD §3.3 indica que las materias deben corresponder a planes de estudio evaluados o en proceso de evaluación CONEAU.

**Limitación del modelo de datos:**
El campo `PlanEstudio.estado` (`String @default('ACTIVO')`) no ha sido confirmado institucionalmente como equivalente a "plan evaluado" en el sentido del FSD. No se tiene documentación que defina qué valores de `estado` corresponden a planes dentro del alcance CONEAU y cuáles no.

**Decisión adoptada:**
No se aplica ningún filtro por estado del plan. Se incluyen todas las vinculaciones `APROBADA` de docentes activos, independientemente del estado del `PlanEstudio` al que pertenecen.

**Limitación residual:**
Pueden incluirse asignaciones de planes históricamente cerrados o en estado fuera del alcance del FSD si esos planes tienen vinculaciones `APROBADA` sin desvinculación explícita.

**Advertencia incorporada:**
```json
{
  "campo": "planEvaluado",
  "entidad": "PlanEstudio",
  "descripcion": "DP-4: La equivalencia entre PlanEstudio.estado = 'ACTIVO' y plan evaluado (FSD §3.3) no está confirmada institucionalmente. Se incluyen todas las vinculaciones APROBADAS sin filtrar por estado del plan hasta que se valide este criterio."
}
```
Esta advertencia aparece en `datosFaltantes` para los estados `CALCULADO`, `PARCIAL` y `NO_DETERMINABLE`.

**Condición para resolver:**
Requiere confirmación institucional de la semántica de los valores posibles de `PlanEstudio.estado` en relación con el ciclo CONEAU. Una vez definida la equivalencia, el filtro puede implementarse sin cambiar el esquema.

---

## Observaciones técnicas identificadas y resueltas

### OBS-SEG-01 — Método de detección multi-facultad con acceso externo

**Identificada en:** Fase 2B.3.6.1-C (auditoría integral)

**Riesgo:**
El método `detectarDocentesMultiFacultad` en `ConsultasAcademicasService` era `public async`. Cualquier componente con acceso a la instancia del servicio podía invocarlo con una lista arbitraria de `docenteIds` y un `facultadIdAutorizado` de su elección, potencialmente obteniendo información sobre vinculaciones de docentes fuera del scope autorizado del solicitante original.

**Corrección aplicada (Fase 2B.3.6.1-D):**
El método fue declarado `private` y su invocación fue integrada internamente dentro de `obtenerVinculacionesParaR07`. De esta forma, los `docenteIds` pasados a la detección provienen exclusivamente de la consulta autorizada previa, y el método no puede ser invocado desde el exterior.

**Archivo:** `backend/src/modules/autoevaluacion/consultas-academicas/consultas-academicas.service.ts`

**Verificación:** TypeScript rechaza cualquier llamada externa a `detectarDocentesMultiFacultad` en tiempo de compilación. El comportamiento se prueba indirectamente a través de `obtenerVinculacionesParaR07` en `consultas-academicas.spec.ts` (sección J.2).

---

### OBS-FUN-01 — Docentes con baja lógica incluidos en el cálculo

**Identificada en:** Fase 2B.3.6.1-C (auditoría integral)

**Riesgo:**
El campo `Docente.activo` es un indicador de baja lógica: cuando un docente es dado de baja en MOD-DOC, el campo pasa a `false` y el servicio `DocentesService` cierra automáticamente sus vinculaciones `APROBADA` y `PENDIENTE_DE_APROBACION`. Sin embargo, si por alguna razón excepcional una vinculación `APROBADA` persiste para un docente con `activo = false` (datos importados, operación directa sobre la base de datos, condición de carrera en procesos concurrentes), ese docente quedaba incluido en el cálculo de R-07.

**Corrección aplicada (Fase 2B.3.6.1-D):**
Se agregó el filtro `v.docente.activo === true` en el paso de preparación del universo de cálculo dentro de `R07EvaluadorService`, antes de construir el mapa de asignaciones por docente.

**Archivo:** `backend/src/modules/autoevaluacion/indicadores/r07.evaluador.ts`

**Fundamento de la ubicación del filtro:**
El filtro fue aplicado en el evaluador (no en la consulta de la base de datos) para mantener la corrección R-07 específica sin afectar a otros indicadores que puedan tener una lógica distinta respecto a docentes inactivos.

**Distinción importante:** `Docente.activo = false` indica baja de la ficha del docente en el sistema. No equivale a "cargo no vigente" en el sentido del FSD (DP-1). Un docente activo puede tener un cargo finalizado si el sistema no registra fechas individuales de nombramiento.

**Verificación:** `r07.evaluador.spec.ts`, sección P (5 pruebas de exclusión de docentes inactivos).

---

### OBS-PRES-01 — Asignaturas no ordenadas alfabéticamente

**Identificada en:** Fase 2B.3.6.1-C (auditoría integral)

**Riesgo:**
El FSD §5.3 establece que las materias vigentes del docente sobre-asignado deben presentarse en orden alfabético. La implementación anterior usaba un `Set<string>` de claves de deduplicación, cuyo orden de iteración en JavaScript es de inserción. El orden de las asignaciones en el resultado era no determinista desde la perspectiva del FSD.

**Corrección aplicada (Fase 2B.3.6.1-D):**
La estructura de deduplicación fue cambiada de `Set<string>` a `Map<string, string>`, donde la clave es el dedup key `${planEstudioId}|${materiaId}|${catedraId}` y el valor es el nombre de la materia recuperado desde `VinculacionCatedra.materia.nombre`. Las asignaciones de cada docente se ordenan con `Array.prototype.sort` usando `String.prototype.localeCompare` con locale `'es'`. El criterio de ordenamiento secundario es `catedraId` para garantizar determinismo cuando dos asignaciones tienen el mismo nombre de materia.

**Archivos modificados:**
- `backend/src/modules/autoevaluacion/consultas-academicas/consultas-academicas.service.ts` — agrega `materia: { select: { nombre: true } }` al Prisma select y popula `materiaNombre` en el mapeo.
- `backend/src/modules/autoevaluacion/indicadores/r07.evaluador.ts` — cambia la estructura de deduplicación y agrega el paso de ordenamiento.
- `backend/src/modules/autoevaluacion/consultas-academicas/consultas-academicas.types.ts` — agrega `materiaNombre?: string` a la interfaz `VinculacionAut`.

**Verificación:** `r07.evaluador.spec.ts`, sección N (4 pruebas de ordenamiento alfabético).
