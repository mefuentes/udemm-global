# R-03 — Decisiones de Implementación y Limitaciones

## 1. Propósito

Este documento registra las decisiones de diseño pendientes (R03-DP-xx) que condicionan la implementación del indicador R-03, las brechas técnicas identificadas entre la especificación normativa (FSD) y el modelo de datos actual, y los riesgos de una implementación prematura.

Su propósito es:
1. Preservar el contexto técnico para que una fase futura pueda reabrir R-03 sin rederivarlo desde cero.
2. Documentar las decisiones que requieren aval institucional vs. las que son puramente técnicas.
3. Ser autosuficiente: no requiere leer el historial de fases para entender el estado actual.

**Las decisiones técnicas de diferimiento registradas aquí no equivalen a aprobación institucional de ningún criterio, semántica de campo, ni interpretación del FSD.**

---

## 2. Fuentes verificadas

| Fuente | Verificación |
|---|---|
| `docs/autoevaluacion/FSD_MODAUT_v1_1.docx` | Extraído y leído (Fase 2B.3.7 Paso 1); 215 párrafos, 31 tablas |
| `backend/prisma/schema.prisma` | Leído directamente (2026-10-15) |
| `backend/src/modules/autoevaluacion/indicadores/indicadores.registry.ts` | Leído directamente |
| `backend/src/modules/autoevaluacion/consultas-academicas/consultas-academicas.types.ts` | Leído directamente |
| `backend/src/modules/docentes/dto/actualizar-docente.dto.ts` | Leído directamente |
| `frontend/app/docentes/mi-ficha/page.tsx` | Leído directamente (interfaces y parse functions) |

Ninguna afirmación en este documento se basa en inferencias no verificadas del código.

---

## 3. Criterios de decisión

Para cada brecha identificada, la decisión provisional sigue el siguiente criterio:

- **DIFERIR**: la brecha no puede resolverse sin cambios en el modelo de datos, en el contrato del DTO, o sin una decisión institucional.
- **DIFERIR hasta verificación**: la brecha podría resolverse si se confirma empíricamente que los datos están disponibles y tienen el formato correcto.
- **IMPLEMENTAR CON ADVERTENCIA**: la brecha puede aproximarse con una advertencia en el resultado, similar al patrón usado en R-07 (DP-1 y DP-4).

Ninguna decisión de este documento implementa R-03. Las decisiones son únicamente sobre el alcance y las condiciones de una implementación futura.

---

## 4. R03-DP-01 — Cargos de gestión vigentes

**Identificador:** R03-DP-01  
**Estado:** DIFERIR

### 4.1 Requisito FSD

FSD §3.3 Tabla 4:
> "Horas de gestión = Suma de la dedicación semanal de los **cargos de gestión vigentes** (sección 5.1; vigente = fecha de fin vacía o posterior a la fecha de cálculo)."

FSD §3.1 Tabla 2:
> "Cargos de gestión | Sección 5.1: función, dedicación semanal, fechas | Horas de gestión."

### 4.2 Evidencia técnica

**Campo principal disponible:** `Docente.cargosAcademicosJson String?`

Estructura real del JSON (inferida de las interfaces del frontend `mi-ficha/page.tsx`, `CargoAcademicoItem`):

```typescript
{
  id: string;           // generado en frontend
  cargo: string;        // nombre del cargo/función
  institucion: string;
  modalidad: string;
  periodoDesde: string; // formato "mm-aaaa" (e.g., "03-2024")
  periodoHasta: string; // formato "mm-aaaa" o "" si está en curso
  dedicacionSemanal: string; // solo dígitos desde frontend; puede ser ""
}
```

**Otros campos relacionados con gestión (NO equivalentes al FSD):**

| Campo | Tipo | Uso real | Equivalencia FSD |
|---|---|---|---|
| `tiempoGestionAcademica String?` | `@Matches(SOLO_NUMEROS_REGEX)` — dígitos como string | Valor agregado único | NO equivalente — no hay lista ni fechas individuales |
| `tiempoDedicacionGestionSemanal String?` | `String?` sin validación numérica | Un cargo de gestión | NO equivalente — solo un cargo |
| `fechaInicioGestion String?` | `String?` | Fecha de inicio del cargo único | Parcialmente equivalente para un solo cargo |
| `fechaFinGestion String?` | `String?` | Fecha de fin del cargo único | Parcialmente equivalente para un solo cargo |
| `funcionGestion String?` | `String?` | Función del cargo único | Parcialmente equivalente para un solo cargo |

### 4.3 Brecha

1. **Tipo incorrecto para suma numérica**: `dedicacionSemanal` en el JSON es una cadena de texto. `parseInt('', 10)` = NaN; `parseInt('20', 10)` = 20. Sin validación backend, el campo puede contener cualquier string o estar ausente.

2. **Formato de fecha impreciso**: `periodoHasta` usa formato "mm-aaaa" (mes-año), no "YYYY-MM-DD". La comparación de vigencia es posible con precisión mensual (un cargo que finaliza en "10-2026" es vigente en octubre 2026), pero no puede determinarse a nivel de día.

3. **Sin contrato backend**: el DTO solo valida `@IsString() @IsOptional()`. No hay validación de estructura JSON ni de tipos de los campos internos.

4. **Docentes existentes con datos vacíos**: `cargosAcademicosJson` se inicializa como `''` (string vacío) al crear un docente. La mayoría de docentes no tienen datos cargados en este campo; `parseCargosAcademicos('')` devuelve `[]`.

5. **Ambigüedad entre `cargosAcademicosJson` y los campos simples de gestión**: existen dos representaciones paralelas de información de gestión (el JSON con lista y los campos simples individuales). No está documentado institucionalmente cuál es la fuente canónica ni qué sucede cuando ambas contienen datos.

### 4.4 Alternativas

| Alternativa | Descripción | Riesgo |
|---|---|---|
| A1 | Usar `tiempoGestionAcademica` como aproximación única | No permite verificar vigencia; subestima o sobreestima según cargos activos/inactivos; semánticamente NO equivalente al FSD |
| A2 | Usar `cargosAcademicosJson` con validación de vigencia por "mm-aaaa" | Requiere agregar validación numérica al DTO; sin datos en la mayoría de docentes actuales |
| A3 | Diseñar una entidad `CargosGestion` relacional | Requiere migración de esquema; fuera del alcance actual |
| A4 | DIFERIR hasta que exista contrato numérico backend | Opción seleccionada |

### 4.5 Decisión técnica provisional

**DIFERIR.** No se puede garantizar la corrección de la componente de gestión con el modelo actual. La estructura de datos existe y tiene la forma correcta, pero la ausencia de validación numérica en el backend hace que la suma sea potencialmente NaN para la mayoría de los registros.

### 4.6 Condición de resolución

Agregar al DTO `ActualizarDocenteDto` la validación de estructura JSON para `cargosAcademicosJson` que garantice:
- `dedicacionSemanal` es un número entero ≥ 0 cuando el campo existe.
- El formato de `periodoDesde`/`periodoHasta` cumple "mm-aaaa" o es vacío.

**Esta modificación del DTO requiere análisis de impacto sobre datos existentes antes de activarse.**

### 4.7 Dependencias

Comparte con R-07-DP-1 la limitación sobre la ausencia de fechas individuales de nombramiento de cargos docentes. R03-DP-01 es independiente de esa limitación porque trata sobre cargos de **gestión** (no docentes) y su fuente es `cargosAcademicosJson`, no el modelo `Cargo`.

---

## 5. R03-DP-02 — Desempeño no académico actual

**Identificador:** R03-DP-02  
**Estado:** DIFERIR

### 5.1 Requisito FSD

FSD §3.3 Tabla 4:
> "Horas de desempeño no académico = Suma de la dedicación semanal del desempeño no académico actual (sección 6.1)."

FSD §3.1 Tabla 2:
> "Desempeño no académico | Sección 6.1 (actual, con dedicación semanal) y 6.2 (pasado) | Uso del tope de 60 h."

### 5.2 Evidencia técnica

**Corrección a la Fase 2B.3.7-A (R-03b):** El informe de la Fase A afirmó "no existe campo para desempeño no académico". Esta afirmación es incorrecta. El campo `Docente.desempenoActualJson String?` sí existe y corresponde a la sección 6.1 de la ficha.

**Campo disponible:** `Docente.desempenoActualJson String?`

Estructura real del JSON (inferida de `DesempenoActualItem` en `mi-ficha/page.tsx`):

```typescript
{
  id: string;
  periodoDesde: string; // formato "mm-aaaa"
  periodoHasta: string; // formato "mm-aaaa" o ""
  institucion: string;  // requerido en formulario
  cargo: string;        // requerido en formulario
  modalidad: string;    // requerido en formulario
  dedicacionSeman: string; // solo dígitos desde frontend; NOT requerido en formulario
}
```

**Separación actual/pasado:** `desempenoActualJson` (sección 6.1) está correctamente separado de `desempenoPasadoJson` (sección 6.2). La distinción que el FSD requiere existe en el modelo.

### 5.3 Brecha

1. **`dedicacionSeman` no es requerido en el formulario**: la validación (`validarDesempenoActual`) solo requiere `institucion`, `cargo` y `modalidad`. `dedicacionSeman` puede ser `''`. Sin horas, la entrada existe pero no contribuye al cálculo.

2. **Tipo string sin validación backend**: igual que R03-DP-01, el DTO solo valida `@IsString() @IsOptional()` para `desempenoActualJson`. No hay validación de estructura ni del tipo numérico de `dedicacionSeman`.

3. **Formato de fecha "mm-aaaa"**: igual que en gestión. Comparación con fecha de cálculo es posible a nivel mensual pero no diario.

4. **Docentes existentes con datos vacíos**: `desempenoActualJson` inicializado a `''`.

### 5.4 Diferencia con la Fase 2B.3.7-A

La Fase A identificó esta limitación como "no existe campo". La situación real es más favorable: el campo existe con la estructura correcta. La brecha es de calidad de datos (tipo string, campo no requerido) y de ausencia de contrato backend, no de ausencia de estructura.

### 5.5 Decisión técnica provisional

**DIFERIR.** El campo existe con la estructura adecuada, pero la ausencia de validación numérica y la no-obligatoriedad de `dedicacionSeman` implican que la suma produciría NaN o 0 para la mayoría de los registros actuales.

### 5.6 Condición de resolución

Agregar al DTO la validación de estructura JSON para `desempenoActualJson` que garantice que `dedicacionSeman` es un número entero ≥ 0 cuando existe la entrada. Evaluar si `dedicacionSeman` debe ser obligatorio en el formulario.

---

## 6. R03-DP-03 — Consulta docente-céntrica y alcance

**Identificador:** R03-DP-03  
**Estado:** DIFERIR

### 6.1 Requisito FSD

FSD §1.3: "El plantel es el de toda la Facultad de Ingeniería: un docente que dicta en varias carreras se evalúa una sola vez."

FSD §5.3 Tabla 11: "Una alerta por Docente."

### 6.2 Evidencia técnica

`ConsultasAcademicasService` opera recuperando vinculaciones filtradas por `planEstudioId` o `carreraId`. La consulta `obtenerVinculacionesParaR07` (implementada para R-07) agrega por facultad cuando el rol lo permite, pero devuelve `VinculacionAut[]` estructurado por vinculación, no por docente.

No existe ninguna función en `ConsultasAcademicasService` que dado un `docenteId` devuelva todas sus vinculaciones APROBADAS en toda la facultad con las horas de las materias correspondientes desde MOD-PDE.

La limitación R-03c en `consultas-academicas.types.ts` documenta esto:
> "ConsultasAcademicasService recupera vinculaciones por plan, no por docente. Para calcular la carga total de un docente en toda la institución se deben agregar sus vinculaciones APROBADAS a través de múltiples planes/carreras."

### 6.3 Brecha

1. **Consulta nueva requerida**: necesita una función que dada una `facultadId` devuelva todos los docentes activos con sus asignaciones APROBADAS, agrupadas por docente, incluyendo `Materia.cargaHorariaSemanal` para cada asignación.

2. **Control RBAC**: `DIRECTOR_CARRERA` tiene scope limitado a su carrera. Un docente puede tener asignaciones en múltiples carreras. Para R-03 se evalúa la facultad completa; un `DIRECTOR_CARRERA` solo podría ver su carrera (resultado `PARCIAL`, mismo patrón que en R-07 DP-3).

3. **Docentes multi-facultad**: si un docente tiene vinculaciones en otras facultades, esas horas no son visibles desde el scope de la facultad solicitante. El resultado sería `NO_DETERMINABLE / CROSS_FACULTAD` para ese docente (mismo patrón que R-07 DP-2).

4. **Interdependencia de datos**: la consulta debe combinar datos de tres entidades: `Docente` (activo, fechaFinCargo), `VinculacionCatedra` (estado, materiaId, catedraId), `Materia` (cargaHorariaSemanal). Además debe acceder a `AutoevaluacionConfigFacultad` (p01TopeH) y a los campos JSON del docente.

### 6.4 Decisión técnica provisional

**DIFERIR.** La implementación de esta consulta es técnicamente factible pero requiere diseño cuidadoso del scope, la agrupación por docente y los controles RBAC. No implementar hasta que las demás dependencias de datos (DP-01, DP-02) estén resueltas.

### 6.5 Condición de resolución

Diseñar y aprobar la firma de una nueva función en `ConsultasAcademicasService`:

```typescript
// Firma propuesta — solo documentar, no implementar
obtenerDatosParaR03(contexto: ContextoEvaluacion): Promise<DatosR03>
```

Donde `DatosR03` incluiría para cada docente vigente de la facultad:
- Suma de `Materia.cargaHorariaSemanal` por asignaciones APROBADAS.
- Lista de entradas de gestión de `cargosAcademicosJson` con vigencia verificada.
- Lista de entradas de desempeño no académico de `desempenoActualJson`.
- Valor de `p01TopeH` para la facultad.

---

## 7. R03-DP-04 — Horas por asignación y doble cómputo

**Identificador:** R03-DP-04  
**Estado:** DIFERIR

### 7.1 Requisito FSD

FSD §3.3 Tabla 4:
> "Horas de docencia = Suma de las horas semanales de las asignaciones válidas del docente. Cada asignación aporta las horas **completas** de la asignatura leídas de MOD-PDE (regla A de MOD-DOC, sin reparto entre cátedras)."

Definición de "Materias de un docente" (FSD §3.3 Tabla 4):
> "Cantidad de combinaciones distintas (plan, asignatura, cátedra). Dos cargos sobre la misma asignatura y cátedra cuentan **una sola vez**."

### 7.2 Evidencia técnica

El FSD distingue explícitamente:
- **Materias de un docente** (para R-07): deduplicadas por combinación `(plan, asignatura, cátedra)`.
- **Horas de docencia** (para R-03): suma de asignaciones válidas, sin reparto entre cátedras.

El FSD no establece explícitamente que la misma asignación (misma combinación plan-asignatura-cátedra) deba deduplicarse para el cálculo de horas. La fórmula dice "suma de las asignaciones válidas" — si un docente tiene dos cargos APROBADOS sobre la misma (plan, materia, cátedra), el FSD podría interpretarse como que ambas contribuyen horas o como que solo una contribuye.

En la práctica, la regla de integridad del sistema debería impedir dos asignaciones APROBADAS del mismo docente para la misma (materia, cátedra), pero no existe una restricción explícita en el esquema que lo garantice.

### 7.3 Brecha

1. **Ambigüedad en deduplicación de horas**: la definición de "horas de docencia" no es explícita sobre qué sucede cuando el mismo docente tiene múltiples asignaciones APROBADAS para la misma (materia, cátedra).

2. **Riesgo de doble cómputo**: si no se deduplica, y existen registros duplicados (por error de carga o por múltiples cargos), las horas se contarían más de una vez.

3. **"Sin reparto entre cátedras"** (FSD §3.3): si el mismo docente tiene asignaciones en "Cátedra 1" y "Cátedra 2" para la misma materia, cada cátedra aporta las horas completas (no se reparten). Esto es legítimo y no es doble cómputo.

### 7.4 Alternativas

| Alternativa | Descripción | Conforme al FSD |
|---|---|---|
| A1 | Sumar todas las asignaciones APROBADAS sin deduplicar | Conforme a "suma de asignaciones válidas"; riesgo con datos duplicados | Sí, si los datos son correctos |
| A2 | Deduplicar por `(materiaId, catedraId, planEstudioId)` antes de sumar | Previene el doble cómputo de datos erróneos; puede omitir horas legítimas si hay dos cargos distintos | Parcialmente |
| A3 | Deduplicar por `(materiaId, catedraId)` únicamente | Eliminaría la contribución de la misma materia en dos planes distintos | No conforme — diferente plan = diferente universo |
| A4 | Definición institucional del criterio | Requerida antes de implementar | Necesario |

### 7.5 Decisión técnica provisional

**DIFERIR** hasta que la institución defina el criterio de deduplicación para la componente de docencia. La pregunta concreta es: si un docente tiene dos cargos APROBADOS sobre la misma (materia, cátedra, plan), ¿contribuyen ambos a las horas de docencia o solo uno?

### 7.6 Condición de resolución

Decisión institucional documentada sobre el tratamiento de múltiples cargos sobre la misma (materia, cátedra) en el cálculo de horas de docencia.

---

## 8. R03-DP-05 — Fuente normativa MOD-PDE para horas de docencia

**Identificador:** R03-DP-05  
**Estado:** DIFERIR

### 8.1 Requisito FSD

FSD §3.3 Tabla 4 (literal):
> "Cada asignación aporta las horas completas de la asignatura **leídas de MOD-PDE** (regla A de MOD-DOC, sin reparto entre cátedras)."

La fuente es explícita: `Materia.cargaHorariaSemanal` (campo de MOD-PDE), no `VinculacionCatedra.horasSemana` (campo de MOD-DOC).

### 8.2 Evidencia técnica

El esquema tiene dos campos que representan las horas semanales de una asignación:

| Campo | Entidad | Tipo | Fuente | Actualización |
|---|---|---|---|---|
| `cargaHorariaSemanal` | `Materia` | `Int?` | MOD-PDE (fuente normativa FSD) | Al modificar la materia en MOD-PDE |
| `horasSemana` | `VinculacionCatedra` | `Int?` | Copia de `materia.cargaHorariaSemanal` al crear la vinculación | **No se sincroniza automáticamente** |

El comentario en `consultas-academicas.types.ts` para `VinculacionAut.horasSemana`:
> "null preservado — **copia de materia.cargaHorariaSemanal al crear**"

Esto confirma que `horasSemana` es un snapshot del momento de creación de la vinculación. Si `Materia.cargaHorariaSemanal` se actualiza después, `VinculacionCatedra.horasSemana` no refleja el cambio.

También existe `Materia.cargaHorariaTotal Int?` (horas totales del período), que es diferente de las horas semanales. No puede usarse para R-03.

### 8.3 Brecha

1. **Stale data en `VinculacionCatedra.horasSemana`**: si se usa esta copia en lugar de la fuente MOD-PDE, el cálculo puede diferir del valor actual de la materia.

2. **Fuente normativa requiere un JOIN adicional**: para leer `Materia.cargaHorariaSemanal` se necesita `VinculacionCatedra → Materia`, que `ConsultasAcademicasService` ya realiza en otras consultas (incluyendo `obtenerVinculacionesParaR07` que accede a `materia: { select: { nombre: true } }`).

3. **Ambos campos son `Int?` (nullable)**: tanto `horasSemana` como `cargaHorariaSemanal` pueden ser null. Si `cargaHorariaSemanal` es null para una materia, las horas de esa asignación son indeterminadas.

4. **`cargaHorariaTotal` no es equivalente**: MOD-PDE tiene `Materia.cargaHorariaTotal Int?` como campo distinto. Las horas totales del período no son equivalentes a horas semanales sin conocer la duración del período.

### 8.4 Decisión técnica provisional

**DIFERIR.** Cuando se implemente R-03, debe usarse `Materia.cargaHorariaSemanal` (fuente normativa del FSD) y no `VinculacionCatedra.horasSemana`. El JOIN adicional es técnicamente trivial.

Para materias con `cargaHorariaSemanal = null`, el cálculo de R-03 para ese docente debería producir estado `PARCIAL` o `NO_DETERMINABLE`, no asumir 0.

### 8.5 Condición de resolución

Definir en el contrato de `obtenerDatosParaR03` que las horas de cada asignación se leen de `Materia.cargaHorariaSemanal`, y establecer el comportamiento cuando el campo es null.

---

## 9. R03-DP-06 — Vigencia de cargo docente

**Identificador:** R03-DP-06  
**Estado:** DIFERIR

### 9.1 Requisito FSD

FSD §3.3 Tabla 4:
> "Cargo vigente = Cargo docente cuya fecha de fin está vacía o es posterior a la fecha de cálculo. Los cargos de gestión no son cargos docentes."
>
> "Docente vigente = Docente con ficha activa (Actividad del usuario = verdadero) y **al menos un cargo vigente**."

### 9.2 Evidencia técnica

El modelo `Docente` tiene los siguientes campos para el cargo docente:

| Campo | Tipo | Valor inicial | Formato validado |
|---|---|---|---|
| `fechaFinCargo` | `String?` | `''` (string vacío) | `@Matches(FECHA_YYYY_MM_DD_REGEX)` — YYYY-MM-DD cuando se provee |
| `fechaInicioCargo` | `String?` | `''` | YYYY-MM-DD cuando se provee |
| `cargoDeclarado` | `String?` | `null` | Texto libre |
| `categoriaDocente` | `String?` | `null` | Texto libre |
| `designacion` | `String?` | `''` | Texto libre |

El modelo `Cargo` en el esquema:
```
model Cargo {
  id        String
  nombre    String @unique
  activo    Boolean @default(true)
  // Sin fechas de nombramiento individual
}
```

`Cargo` es un catálogo de tipos de cargo (análogo a R-07 DP-1). Las vinculaciones referencian `VinculacionCatedra.cargoId → Cargo`, pero este enlace es al tipo de cargo, no a un nombramiento individual con fechas.

### 9.3 Brecha

1. **Solo un cargo docente por docente**: el modelo tiene campos `fechaInicioCargo`/`fechaFinCargo` directamente en `Docente`. Un docente puede tener simultáneamente múltiples cargos (Profesor Titular de la materia A y JTP de la materia B). Esta situación no es representable: solo existe un par de fechas.

2. **String vacío como "vigente"**: `fechaFinCargo` se inicializa como `''` (string vacío), que semánticamente equivale a "cargo sin fecha de fin" (vigente). Sin embargo, `''` y `null` tienen el mismo significado funcional pero diferente representación. Una implementación debe tratar `'' | null` como "sin fecha de fin = vigente".

3. **Comparación de strings YYYY-MM-DD**: la comparación lexicográfica de strings YYYY-MM-DD es correcta para fechas (el orden lexicográfico coincide con el cronológico para este formato). Es un patrón válido aunque no ideal.

4. **Diferencia con R-07 DP-1**: R-07 DP-1 trató el problema de fechas de nombramiento en el contexto de las vinculaciones a cátedra. R03-DP-06 trata el problema de la vigencia del cargo docente del propio docente (la condición de "docente vigente"). Son limitaciones relacionadas pero distintas.

### 9.4 Decisión técnica provisional

**DIFERIR.** La limitación de un único cargo es una restricción del modelo de datos que afecta también a R-04. La implementación de "docente vigente" como `Docente.activo = true AND (fechaFinCargo is null OR fechaFinCargo = '' OR fechaFinCargo > today)` es técnicamente implementable con el modelo actual, con la caveat de que docentes con múltiples cargos solo tendrán su cargo principal representado.

Si se decide implementar R-03 con esta limitación, debe incluirse una advertencia en `datosFaltantes` análoga a R-07 DP-1.

### 9.5 Condición de resolución

Decisión institucional sobre si la vigencia del docente para MOD-AUT se determina por `fechaFinCargo` (único campo), por la existencia de alguna vinculación APROBADA, o por una entidad futura de nombramientos.

---

## 10. Riesgos de implementación prematura

Una implementación de R-03 que no resuelva las dependencias anteriores produciría los siguientes riesgos funcionales verificados:

### 10.1 Falsos negativos sistemáticos (RT-01)

**El más grave.** Si R-03 se implementa calculando solo la componente de docencia (la única con dato numérico confiable), un docente con:
- 0 h de docencia
- 50 h de gestión
- 20 h de no académico

...no recibiría alerta, aunque su uso del tope es 70 h > 60 h. La ausencia de alerta sería presentada como cumplimiento cuando en realidad el dato falta.

### 10.2 NaN en suma de gestión (RT-02)

La mayoría de los docentes existentes tienen `cargosAcademicosJson = ''` o `dedicacionSemanal = ''` dentro del JSON. `parseInt('') = NaN`. Una suma que incluya NaN produce NaN como resultado. Una comparación `NaN > 60` es `false`. El indicador nunca se activaría para estos docentes.

### 10.3 Doble cómputo por `tiempoGestionAcademica` y `cargosAcademicosJson` (RT-03)

Si una implementación combina `tiempoGestionAcademica` (agregado) con `cargosAcademicosJson` (lista), las horas de gestión se contarían dos veces para los docentes que tengan datos en ambos campos.

### 10.4 Stale docencia (RT-05)

Si se usa `VinculacionCatedra.horasSemana` en lugar de `Materia.cargaHorariaSemanal`, y el plan fue modificado después de crear las vinculaciones, las horas calculadas diferirán de las horas reales del plan.

### 10.5 Riesgo RBAC en consulta cross-carrera (RT-08)

Una consulta que agrega datos de un docente a través de múltiples carreras podría, si no se implementa correctamente el filtro de facultad, exponer vinculaciones de docentes de otras facultades al solicitante.

---

## 11. Condiciones de reapertura

R-03 puede reabrirse para implementación cuando se cumplan todas las condiciones bloqueantes:

| ID | Condición | Tipo |
|---|---|---|
| C-01 | Validación numérica backend para `cargosAcademicosJson.dedicacionSemanal` | Técnica — Desarrollo MOD-DOC |
| C-02 | Validación numérica backend para `desempenoActualJson.dedicacionSeman` | Técnica — Desarrollo MOD-DOC |
| C-03 | Implementación de consulta docente-céntrica en `ConsultasAcademicasService` | Técnica — Desarrollo MOD-AUT |
| C-04 | Confirmación institucional de la equivalencia `PlanEstudio.estado = 'ACTIVO'` = "plan evaluado" (FSD §3.3) | Institucional |

Condiciones importantes (no bloqueantes para iniciar, pero a resolver antes de producción):

| ID | Condición | Tipo |
|---|---|---|
| C-05 | Regla de deduplicación de horas para múltiples cargos sobre la misma (materia, cátedra) | Institucional |
| C-06 | Comportamiento del motor cuando `Materia.cargaHorariaSemanal = null` | Técnica — Desarrollo MOD-AUT |
| C-07 | Configuración de `AutoevaluacionConfigFacultad.p01TopeH` para la facultad | Administración |

---

## 12. Estado de aprobación institucional

Ninguna de las decisiones técnicas de diferimiento registradas en este documento constituye aprobación institucional de ningún criterio de cálculo, semántica de campo ni interpretación del FSD.

Las siguientes preguntas requieren respuesta institucional antes de implementar R-03:

1. ¿El campo `PlanEstudio.estado = 'ACTIVO'` es equivalente a "plan evaluado" en el sentido del FSD §3.3?
2. Si un docente tiene dos cargos APROBADOS sobre la misma (materia, cátedra, plan), ¿ambos contribuyen horas al cálculo o solo uno?
3. ¿La vigencia del docente para MOD-AUT se determina por `Docente.fechaFinCargo` o por la existencia de vinculaciones APROBADAS activas?
4. ¿Cuál es el valor de `p01TopeH` para la Facultad de Ingeniería, y ha sido aprobado institucionalmente?
5. Cuando `cargaHorariaSemanal` es null para alguna materia, ¿el resultado de R-03 para el docente afectado debe ser `PARCIAL`, `NO_DETERMINABLE`, o debe bloquear el cálculo?

Estas preguntas no tienen respuesta en el FSD ni en el código actual.
