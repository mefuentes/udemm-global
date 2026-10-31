# R-10 — Cierre Técnico-Funcional

## 1. Identificación

| Campo | Valor |
|---|---|
| **Proyecto** | UDEMM Global |
| **Módulo** | MOD-AUT — Motor de autoevaluación CONEAU |
| **Indicador** | R-10 — Docente con baja dedicación |
| **FSD de referencia** | `docs/autoevaluacion/FSD_MODAUT_v1_1.docx` — versión 1.0, octubre 2026 |
| **Fecha de cierre** | 2026-10-15 |
| **Fase** | 2B.3.8-B — Cierre documental R-10 |
| **Estado del indicador** | `NO_IMPLEMENTADO` |
| **Dictamen** | **D — DIFERIR (bloqueado por brechas estructurales de datos)** |

Este documento registra el análisis técnico-funcional completo de R-10 basado en la lectura directa del FSD original (`FSD_MODAUT_v1_1.docx`). Toda afirmación sobre el modelo de datos está respaldada por inspección de `backend/prisma/schema.prisma`. Toda afirmación sobre la estructura de los campos JSON se basa en la lectura de `frontend/app/docentes/mi-ficha/page.tsx`. Toda afirmación sobre el motor y el registro está respaldada por lectura directa del código.

El diferimiento es una decisión técnica provisional. No constituye eliminación del indicador ni modificación de su alcance normativo.

---

## 2. Fuentes documentales

| Fuente | Rol | Confiabilidad |
|---|---|---|
| `FSD_MODAUT_v1_1.docx` (§3.1 Tabla 2, §3.3 Tabla 4, §4.1 Tabla 5, §5.2 Tabla 9, §5.3 Tabla 17, §7 Tabla 24, §9.3, §9.4, §9.8) | Especificación normativa — fuente primaria | Alta |
| `docs/autoevaluacion/Modulo_Autoevaluacion_v5_1.html` (líneas 206, 320-330, 344-367, 472-478) | Prototipo de referencia funcional | Media (datos de simulación; no refleja el modelo de datos real de MOD-DOC v8.1) |
| `backend/prisma/schema.prisma` | Estado real del modelo de datos | Alta |
| `backend/src/modules/autoevaluacion/indicadores/indicadores.registry.ts` (líneas 155-166) | Estado de implementación en MOD-AUT | Alta |
| `backend/src/modules/autoevaluacion/indicadores/indicadores.service.ts` (líneas 63-91) | Motor de evaluación | Alta |
| `backend/src/modules/autoevaluacion/indicadores/indicadores.types.ts` | Contratos del motor | Alta |
| `frontend/app/docentes/mi-ficha/page.tsx` (interfaces líneas 221-250, funciones de parseo) | Única fuente del contrato de estructura de los campos JSON de secciones 7.2 y 7.3 | Media (no hay contrato backend equivalente validado) |
| `docs/autoevaluacion/R03_CIERRE_TECNICO_FUNCIONAL.md` | Referencia de brechas compartidas | Alta (verificado en la misma fase) |
| `docs/autoevaluacion/R03_DECISIONES_Y_LIMITACIONES.md` | Referencia de decisiones compartidas | Alta |

---

## 3. Definición normativa

### 3.1 Condición de alerta (FSD §5.3, Tabla 17)

| Campo FSD | Valor |
|---|---|
| **Código** | R-10 |
| **Nombre** | Docente con baja dedicación |
| **Condición** | Docente vigente cuya dedicación total es **estrictamente menor** que P-02 |
| **Una alerta por** | Docente |
| **Prioridad / Ámbito** | Informativa / Docentes |
| **Tipo FSD** | Alerta (genera entrada en la bandeja — FSD §5.1 Tabla 8) |
| **Entidad destacada** | Docente |
| **Detalle** | «Su dedicación total calculada es {x} h semanales (menos de {P-02} h).» |
| **Acción sugerida** | Verificar que la ficha registre todas las funciones del docente. |
| **Efecto sobre indicadores de estado** | **Ninguno** — R-10 no resta Completitud ni Consistencia (FSD §6.1: «R-10 y R-12 tampoco» restan al docente). |
| **Efecto estadístico** | Cuenta en IP-15 («Dedicación menor a {P-02} h»). |
| **Botón de acción** | «Ver docente» |

### 3.2 Parámetro P-02 (FSD §4.1, Tabla 5)

| Campo | Valor |
|---|---|
| **ID** | P-02 |
| **Nombre** | Baja dedicación: alerta si la dedicación total es menor a (h) |
| **Valor inicial** | 20 h semanales |
| **Regla** | R-10 |
| **Fuente del valor** | Criterio institucional — **a confirmar con UdeMM** (texto literal del FSD) |
| **Alcance** | General para toda la Facultad de Ingeniería |
| **Campo en Prisma** | `AutoevaluacionConfigFacultad.p02BajaH Int` (sin valor `@default`) |

### 3.3 Fórmula de dedicación total (FSD §3.3, Tabla 4)

```
dedicaciónTotal = horasDocencia
               + horasGestión
               + horasInvestigación
               + horasVinculación
               + horasOtrasDedicaciones
```

**Condición de alerta:**
```
dedicaciónTotal < P-02   (comparación estricta)
```

**Componentes por sección de ficha:**

| Componente | Sección MOD-DOC | Definición exacta del FSD |
|---|---|---|
| Horas de docencia | Asignaciones a cátedra | Suma de horas semanales de las **asignaciones válidas** del docente. Cada asignación aporta las horas completas de la asignatura leídas de MOD-PDE. |
| Horas de gestión | 5.1 — Cargos de gestión | Suma de la dedicación semanal de los cargos de gestión **vigentes** (fecha de fin vacía o posterior a la fecha de cálculo). |
| Horas de investigación | 7.2 — Participación en proyectos | Suma de las horas de las participaciones en proyectos de investigación **vigentes**. |
| Horas de vinculación | 7.3 — Participación en vinculación | Suma de las horas de las participaciones en actividades de vinculación **vigentes**. |
| Horas de otras dedicaciones | 5.2 — Otras dedicaciones | Suma de las horas de la sección 5.2 (sin calificador de vigencia). |

**Componente excluido explícitamente:**
El desempeño no académico (sección 6.1) **no** integra la dedicación total. El FSD §3.3 define un término separado "Uso del tope" (docencia + gestión + desempeño no académico) para la regla R-03. La dedicación total y el uso del tope son cómputos distintos sobre conjuntos de datos distintos.

### 3.4 Docente vigente (FSD §3.3, Tabla 4)

Docente con **ficha activa** (`Docente.activo = true`) y **al menos un cargo vigente** (cargo docente cuya `fechaFinCargo` está vacía o es posterior a la fecha de cálculo). La evaluación de R-10 aplica únicamente a docentes vigentes.

### 3.5 IP-15 (FSD §7, Tabla 24)

| Campo | Valor |
|---|---|
| **ID** | IP-15 |
| **Grupo** | Acción requerida |
| **Indicador** | Dedicación menor a {P-02} h |
| **Cálculo** | Docentes vigentes con alerta R-10 |
| **Presentación** | Número y nombres. Título usa el valor vigente de P-02. |

---

## 4. Matriz FSD ↔ Prisma ↔ Servicios

### 4.1 Componente: Docencia

| Ítem | Detalle |
|---|---|
| **Fuente FSD** | Horas semanales de asignaciones válidas, leídas de MOD-PDE |
| **Tabla Prisma** | `VinculacionCatedra` + `Materia.cargaHorariaSemanal Int?` |
| **Tipo Prisma** | `Int?` / `number \| null` en `VinculacionAut.horasSemana` |
| **Disponibilidad** | DISPONIBLE |
| **Limitaciones** | Vigencia de cargo: el modelo `Cargo` es un catálogo (sin fechas individuales de nombramiento); la vigencia se aproxima por estado `APROBADA` de la vinculación. Igual limitación que R-07 DP-1. |
| **Consulta existente** | `ConsultasAcademicasService.obtenerVinculacionesParaR07` — orientada a R-07, no a R-10. No existe consulta docente-céntrica para R-10. |

### 4.2 Componente: Gestión (sección 5.1)

| Ítem | Detalle |
|---|---|
| **Fuente FSD** | Dedicación semanal de cargos de gestión vigentes (sección 5.1) |
| **Campo Prisma** | `Docente.cargosAcademicosJson String?` |
| **Interfaz frontend** | `CargoAcademicoItem { id, cargo, institucion, modalidad, periodoDesde: string, periodoHasta: string, dedicacionSemanal: string }` |
| **Tipo de horas** | `string` — sin validación backend |
| **Fechas disponibles** | Sí — `periodoDesde` y `periodoHasta` en formato `"mm-aaaa"` |
| **Vigencia posible** | PARCIALMENTE — las fechas existen pero el formato `"mm-aaaa"` no incluye día y el criterio de corte mensual no está especificado |
| **Disponibilidad** | CON LIMITACIONES |

**Fuente normativa confirmada:** FSD §3.1 Tabla 2 especifica "Cargos de gestión | Sección 5.1: función, dedicación semanal, **fechas**". Las fechas están representadas en la interfaz frontend.

### 4.3 Componente: Investigación (sección 7.2) — BRECHA ESTRUCTURAL

| Ítem | Detalle |
|---|---|
| **Fuente FSD** | Horas de participaciones en proyectos de investigación **vigentes** (sección 7.2) |
| **Campo Prisma** | `Docente.proyectosInvestigacionJson String?` |
| **Interfaz frontend** | `ProyectoInvestigacionItem { id: string, codigo: string, titulo: string, rol: string, horasSemanales: string }` |
| **Tipo de horas** | `string` — sin validación backend |
| **Campos de fecha** | **NINGUNO** — la interfaz no define `periodoDesde`, `periodoHasta`, `fechaInicio`, `fechaFin` ni equivalente |
| **Vigencia posible** | **NO** — imposible sin campos de fecha |
| **Disponibilidad** | **BRECHA ESTRUCTURAL** |

**Fuente normativa:** FSD §3.1 Tabla 2: "Investigación y vinculación | Sección 7.1 a 7.4: … participación en proyectos (**horas, fechas**)". El FSD indica que las fechas son parte del dato esperado de MOD-DOC. La interfaz frontend (`ProyectoInvestigacionItem`) no las registra.

**Naturaleza de la brecha:** La ausencia de fechas es a nivel del contrato de la interfaz frontend (que define la estructura del JSON almacenado en `proyectosInvestigacionJson`). El campo Prisma es `String?` y no requiere migración para alojar nuevos campos en el JSON. La brecha es del formulario de captura y del contrato de estructura, no del esquema relacional.

**Alternativas sin resolución de brecha:**
- Incluir todos los proyectos sin filtro de vigencia → sobreestima dedicación (proyectos finalizados mantienen horas).
- Excluir todos los proyectos → infraestima sistematicamente (`horasInvestigación = 0` para todo docente).
- Ninguna alternativa produce un cálculo conforme al FSD.

### 4.4 Componente: Vinculación (sección 7.3) — BRECHA ESTRUCTURAL

| Ítem | Detalle |
|---|---|
| **Fuente FSD** | Horas de participaciones en actividades de vinculación **vigentes** (sección 7.3) |
| **Campo Prisma** | `Docente.participacionVinculacionJson String?` |
| **Interfaz frontend** | `ParticipacionVinculacionItem { id: string, codigo: string, actividad: string, rol: string, horasSemanales: string }` |
| **Tipo de horas** | `string` — sin validación backend |
| **Campos de fecha** | **NINGUNO** |
| **Vigencia posible** | **NO** |
| **Disponibilidad** | **BRECHA ESTRUCTURAL** |

**Distinción con actividades de extensión:** Existe en el sistema el campo `Docente.actividadesExtensionJson`, cuya interfaz incluye `fechaInicio` y `fechaFin`. Este campo corresponde a la sección 7.4 (actividades de extensión) y no es equivalente a la sección 7.3. R-10 utiliza exclusivamente el componente de vinculación (sección 7.3), mapeado a `participacionVinculacionJson`. Son campos distintos con propósitos distintos.

**Naturaleza de la brecha:** Idéntica a la de investigación. El campo Prisma `String?` no requiere migración; la brecha es del formulario de captura y del contrato de estructura del JSON.

### 4.5 Componente: Otras dedicaciones (sección 5.2)

| Ítem | Detalle |
|---|---|
| **Fuente FSD** | Suma de las horas de la sección 5.2 (sin calificador "vigentes") |
| **Campo Prisma** | `Docente.otrasDedicacionesJson String?` |
| **Interfaz frontend** | `OtraDedicacionItem { id: string, concepto: string, horasSeman: string }` |
| **Tipo de horas** | `string` — validación de formato en frontend (`.replace(/\D/g, '')`) pero sin validación backend |
| **Vigencia requerida** | No — FSD §3.3 no aplica filtro de vigencia a esta sección |
| **Disponibilidad** | CON LIMITACIONES |
| **Limitaciones** | `horasSeman` puede ser vacío; no hay garantía de completitud ni de unidad semanal en el backend |

### 4.6 Parámetro P-02

| Ítem | Detalle |
|---|---|
| **Campo Prisma** | `AutoevaluacionConfigFacultad.p02BajaH Int` |
| **Tipo** | `Int` — numérico, sin `@default` |
| **Disponibilidad** | DISPONIBLE cuando existe un registro `AutoevaluacionConfigFacultad` para la facultad |
| **Limitación** | Si no existe el registro de config para la facultad, P-02 no tiene valor. La consulta debe verificar la existencia de config antes del cálculo. |

---

## 5. Comparación FSD y prototipo

### 5.1 Fórmula de dedicación total

| Artefacto | Fórmula |
|---|---|
| **FSD §3.3 Tabla 4** | `docencia + gestión + investigación + vinculación + otras_dedicaciones` |
| **Prototipo línea 328** | `f.doc + f.ges + f.inv + f.vin` (sin `otras_dedicaciones`) |

**Divergencia confirmada:** El prototipo omite el componente de otras dedicaciones (sección 5.2) de la suma de dedicación total. El FSD lo incluye explícitamente. El FSD prevalece como especificación funcional de referencia.

**Implicación:** Una implementación fiel al FSD debe sumar `OtraDedicacionItem.horasSeman` para cada entrada de `otrasDedicacionesJson`.

### 5.2 Fuente de los datos de investigación y vinculación en el prototipo

El prototipo usa datos de simulación: `inv: d.tiempos.inv` y `vin: d.tiempos.ext` (valores numéricos directos del conjunto de datos sintéticos). No existe en el prototipo ningún mecanismo de vigencia para proyectos o vinculaciones — los valores son constantes de la simulación, no calculados desde registros JSON con fechas.

El prototipo incluye la nota: "Dedicación calculada (MOD-DOC v8.1 no la declara): docencia de las vinculaciones + gestión + investigación + vinculación." Esta nota reconoce que MOD-DOC v8.1 (la ficha docente actual) no expone formalmente un campo de dedicación calculada, y que la simulación presupone valores directamente.

### 5.3 Tipo de indicador

| Artefacto | Valor de `tipo` para R-10 |
|---|---|
| **FSD §5.2 Tabla 9** | `Alerta` (genera entrada en la bandeja, según definición de FSD §5.1 Tabla 8) |
| **Prototipo línea 353** | `'Detalle'` |
| **Registry (`indicadores.registry.ts` línea 160)** | `'DETALLE'` |

**Discrepancia verificada:** El FSD clasifica R-10 como "Alerta". El prototipo y el registry usan el tipo `'Detalle'`. Ambos son valores válidos en el tipo `TipoIndicador = 'ALERTA' | 'INDICADOR' | 'DETALLE'` definido en `indicadores.types.ts` línea 15.

**Impacto funcional pendiente de verificación:** El campo `tipo` está presente en `DefinicionIndicador` y es devuelto por `RegistroIndicadores.listar()`. El FSD §9.8 especifica que la pantalla "Reglas de validación" muestra la columna "Tipo". Si existe un endpoint que expone el listado de indicadores, cambiar `tipo` modificaría la presentación. El motor de evaluación (`indicadores.service.ts`) no utiliza el campo `tipo` en ninguna condición lógica — no determina flujo de evaluación ni restricciones de acceso. El impacto exacto de la corrección requiere verificar el API contract del listado de indicadores, las pruebas del registry (`indicadores.spec.ts`), y los componentes de presentación del frontend de MOD-AUT.

### 5.4 Efecto sobre consistencia

**FSD §6.1 (verificado):** «R-10 y R-12 tampoco» restan consistencia al docente. R-10 es una alerta estrictamente informativa sin penalización. Esto es consistente con `M-01` y `M-02` (FSD §4.3 Tabla 7), que solo aplican a alertas de prioridad Alta y Media respectivamente.

---

## 6. Brechas y limitaciones

### 6.1 Brechas bloqueantes

#### R10-BLO-01 — Sin campos de fecha en `proyectosInvestigacionJson`

**Verificado:** La interfaz `ProyectoInvestigacionItem` (línea 221 de `mi-ficha/page.tsx`) define: `{ id: string, codigo: string, titulo: string, rol: string, horasSemanales: string }`. No existen campos `periodoDesde`, `periodoHasta`, `fechaInicio` ni `fechaFin`.

El FSD prescribe explícitamente "proyectos de investigación **vigentes**" (§3.3) y clasifica las fechas como dato esperado de la sección 7.2 (§3.1 Tabla 2).

Sin fechas de participación, no es posible aplicar el filtro de vigencia. Las dos únicas alternativas (incluir todos o excluir todos) producen resultados que no son conformes al FSD.

**Alcance del ajuste requerido:** No se requiere migración de esquema Prisma. El campo `proyectosInvestigacionJson` es `String?` y puede almacenar JSON con cualquier estructura. El ajuste requiere: (a) agregar `periodoDesde` y `periodoHasta` al formulario de la sección 7.2 en MOD-DOC, (b) actualizar la interfaz `ProyectoInvestigacionItem` en el frontend, y (c) definir el contrato de parseo y la semántica de vigencia en el evaluador.

#### R10-BLO-02 — Sin campos de fecha en `participacionVinculacionJson`

**Verificado:** La interfaz `ParticipacionVinculacionItem` (línea 244 de `mi-ficha/page.tsx`) define: `{ id: string, codigo: string, actividad: string, rol: string, horasSemanales: string }`. No existen campos de fecha.

La brecha es idéntica a R10-BLO-01. El ajuste tiene el mismo alcance: modificación del formulario de la sección 7.3 en MOD-DOC y actualización de la interfaz frontend. No requiere migración Prisma.

### 6.2 Limitaciones sin solución actual

#### R10-LIM-01 — Tipos `string` en todos los campos de horas de JSON

Los campos de horas de los cinco componentes de dedicación son `string` sin validación backend:
- `CargoAcademicoItem.dedicacionSemanal: string` (gestión)
- `ProyectoInvestigacionItem.horasSemanales: string` (investigación)
- `ParticipacionVinculacionItem.horasSemanales: string` (vinculación)
- `OtraDedicacionItem.horasSeman: string` (otras dedicaciones)

Cada campo puede contener: valor numérico válido, cadena vacía `""`, o valor no numérico. Un `parseFloat()` en tiempo de evaluación produce `NaN` sin que el sistema pueda distinguir si el campo fue intencionalmente dejado en blanco o contiene un dato corrupto. No se trata de un bloqueo absoluto (los valores en el sistema pueden ser en su mayoría numéricos correctos), pero la ausencia de validación backend impide garantizar la integridad del cálculo.

#### R10-LIM-02 — Sin consulta docente-céntrica para R-10

No existe en `ConsultasAcademicasService` una consulta que agregue todos los componentes de dedicación de un docente (docencia vía vinculaciones + gestión + investigación + vinculación + otras dedicaciones) con filtros de vigencia y control de acceso por facultad.

La consulta existente `obtenerVinculacionesParaR07` está orientada a R-07 y no satisface los requisitos de R-10. El evaluador de R-10 requeriría una consulta que: (a) itere sobre docentes vigentes de la facultad, (b) lea los campos JSON de cada docente, (c) aplique vigencia por componente, (d) agregue numéricamente, y (e) respete el RBAC de MOD-AUT.

Docentes con vinculaciones en múltiples facultades requerirían tratamiento análogo al de R-07 DP-2 (CROSS_FACULTAD).

#### R10-LIM-03 — Vigencia de cargos de gestión: formato `"mm-aaaa"` sin criterio de corte

Los campos `periodoDesde` y `periodoHasta` de `CargoAcademicoItem` almacenan fechas en formato `"mm-aaaa"`. Para determinar vigencia al momento de evaluación se requiere comparar con la fecha de cálculo. El formato no incluye día y el criterio de corte mensual (¿primer día del mes?, ¿último día?) no está especificado en el FSD ni en el código. `periodoHasta = ""` indica cargo abierto (vigente). Esta ambigüedad es compartida con R03-DP-01.

---

## 7. Estado actual del indicador

| Atributo | Valor | Fuente |
|---|---|---|
| `estadoImplementacion` | `'NO_IMPLEMENTADO'` | `indicadores.registry.ts` línea 163 |
| `motivoPendiente` | `'R-10: prohibido inferir equivalencias entre dedicación textual y horas numéricas sin definición institucional aprobada.'` | `indicadores.registry.ts` línea 164-165 |
| `tipo` | `'DETALLE'` | `indicadores.registry.ts` línea 160 (discrepancia con FSD — ver sección 5.3) |
| `severidad` | `'INFORMATIVA'` | `indicadores.registry.ts` línea 161 |
| `alcance` | `'DOCENTE'` | `indicadores.registry.ts` línea 162 |
| Evaluador asignado | **Ninguno** | `indicadores.service.ts` líneas 63-67 — R-10 no está en la lista de evaluadores |
| Resultado del motor | `resultadoNoImplementado()` | `indicadores.service.ts` línea 81-88 — retorno por rama `!def.evaluador` |

El motivoPendiente registrado en el registry es parcialmente correcto. La razón principal de diferimiento no es solo la inferencia de equivalencias, sino las brechas estructurales de datos: `ProyectoInvestigacionItem` y `ParticipacionVinculacionItem` carecen de campos de fecha para verificar vigencia, que el FSD prescribe explícitamente.

---

## 8. Auditoría de viabilidad

### 8.1 Evaluación por componente

| Componente | Campo Prisma | Tipo de horas | Fechas de vigencia | Vigencia aplicable | Estado |
|---|---|---|---|---|---|
| Docencia | `Materia.cargaHorariaSemanal Int?` | `Int?` (numérico) | Vía estado `APROBADA` | PARCIAL (cargo docente) | CON LIMITACIONES |
| Gestión | `cargosAcademicosJson String?` | `string` | `"mm-aaaa"` | PARCIAL (formato ambiguo) | CON LIMITACIONES |
| Investigación | `proyectosInvestigacionJson String?` | `string` | **Sin fechas** | **NO** | **BRECHA ESTRUCTURAL** |
| Vinculación | `participacionVinculacionJson String?` | `string` | **Sin fechas** | **NO** | **BRECHA ESTRUCTURAL** |
| Otras dedicaciones | `otrasDedicacionesJson String?` | `string` | No requerida por FSD | N/A | CON LIMITACIONES |

### 8.2 Alternativas de implementación degradada evaluadas

**Alternativa A — Sumar todos los registros de investigación y vinculación sin vigencia**
Resultado: sobreestimación. Proyectos y actividades finalizados mantienen horas. La alerta R-10 puede no activarse para docentes que genuinamente tienen baja dedicación actual. No conforme al FSD.

**Alternativa B — Excluir investigación y vinculación del cálculo**
Resultado: infraestimación sistemática. Todo docente activo en investigación o vinculación aparece con una dedicación calculada menor a su dedicación real. La alerta R-10 se activaría para docentes que no la merecen. No conforme al FSD.

**Alternativa C — Incluir con advertencia explícita de falta de vigencia**
Reduce el impacto comunicacional pero no corrige la infidelidad funcional. R-10 es una señal informativa sensible para el proceso CONEAU; un resultado sistematicamente sobreestimado o infraestimado desacredita el módulo.

Ninguna alternativa produce un resultado conforme al FSD. El diferimiento es la única opción técnica responsable.

---

## 9. Riesgos

| ID | Descripción | Probabilidad | Impacto |
|---|---|---|---|
| RT-01 | Implementación prematura con valores de investigación/vinculación sin vigencia produce alertas R-10 con resultados incorrectos para docentes investigadores activos | Alta (si se implementa sin resolver BLO-01/02) | Alto |
| RT-02 | El campo `horasSemanales: string` vacío o no numérico produce `NaN` en la suma de dedicación total, haciendo que el cálculo falle silenciosamente | Media | Alto |
| RT-03 | Docentes que omiten declarar investigación o vinculación son evaluados correctamente (baja dedicación real); docentes que sí declaran son infraestimados si BLO-01/02 excluye esas horas | Alta | Alto (inequidad en el resultado) |
| RT-04 | El valor de P-02 (20 h) es "a confirmar con UdeMM" según el FSD; si se implementa antes de la confirmación, el umbral puede ser incorrecto | Media | Medio |
| RT-05 | Corrección de `tipo: 'DETALLE'` → `'ALERTA'` sin verificar el contrato del API de listado de indicadores puede romper un componente frontend de MOD-AUT que filtre por este valor | Baja (el API de listado puede no existir aún) | Medio |
| RT-06 | Extensión de las interfaces `ProyectoInvestigacionItem` y `ParticipacionVinculacionItem` sin migración de datos históricos deja registros existentes sin campos de fecha, lo que produce una vigencia incorrecta para todos los registros anteriores a la actualización | Alta (si se agrega las fechas sin tratamiento de registros existentes) | Alto |
| RT-07 | La nota del prototipo ("MOD-DOC v8.1 no la declara") indica que el cálculo de dedicación no está formalizado en la ficha docente actual; implementar sin acuerdo institucional sobre la fórmula puede generar resultados que MOD-DOC no reconcilia | Media | Medio |

---

## 10. Dependencias compartidas con R-03

| Dependencia | R-03 | R-10 | Clasificación |
|---|---|---|---|
| Vigencia de cargo docente individual (`Docente.fechaFinCargo`) | Sí — R-03 requiere "docente vigente" | Sí — R-10 requiere "docente vigente" | COMPARTIDA |
| Tipo `string` en campos de horas JSON | Sí — `dedicacionSemanal`, `dedicacionSeman` | Sí — `dedicacionSemanal`, `horasSemanales` (×2), `horasSeman` | COMPARTIDA |
| Consulta docente-céntrica con agregación | Sí — requiere iterar sobre docentes por facultad | Sí — ídem, con más componentes JSON | COMPARTIDA |
| Consolidación de docentes con vinculaciones en múltiples facultades | Sí — idéntica lógica CROSS_FACULTAD | Sí — idéntica lógica | COMPARTIDA |
| Alcance por facultad y RBAC | Sí | Sí | COMPARTIDA |
| Fuente normativa MOD-PDE para horas de docencia | Sí — R-03 usa `cargaHorariaSemanal` | Sí — R-10 usa la misma fuente | COMPARTIDA |
| Vigencia de cargos de gestión (formato `"mm-aaaa"`) | Sí — R-03 requiere gestión vigente | Sí — R-10 requiere gestión vigente | COMPARTIDA |
| `AutoevaluacionConfigFacultad` (existencia de config) | Sí — `p01TopeH` | Sí — `p02BajaH` | COMPARTIDA |
| Vigencia de proyectos de investigación (sección 7.2) | No requerida por R-03 | Sí — **bloqueante** | ESPECÍFICA DE R-10 |
| Vigencia de actividades de vinculación (sección 7.3) | No requerida por R-03 | Sí — **bloqueante** | ESPECÍFICA DE R-10 |
| Horas de otras dedicaciones (sección 5.2) | No requerida por R-03 | Sí — componente de la fórmula | ESPECÍFICA DE R-10 |
| Vigencia de desempeño no académico (sección 6.1) | Sí — requerida por R-03 | No requerida por R-10 | ESPECÍFICA DE R-03 |

**Recomendación:** Las dependencias clasificadas como COMPARTIDAS deben resolverse en una fase de análisis y resolución conjunta antes de que cualquiera de los dos indicadores pueda implementarse de forma confiable. No se propone implementarlas en esta fase.

---

## 11. Condiciones de reapertura

Para que R-10 pueda pasar del estado `NO_IMPLEMENTADO` a una fase de desarrollo, deben cumplirse todas las condiciones marcadas con [OBLIGATORIA] y al menos las condiciones complementarias marcadas con [RECOMENDADA]:

| ID | Condición | Tipo | Alcance del cambio |
|---|---|---|---|
| C-01 | Agregar `periodoDesde: string` y `periodoHasta: string` (formato `"mm-aaaa"`) a `ProyectoInvestigacionItem` y al formulario de carga de la sección 7.2 en MOD-DOC | **OBLIGATORIA** | Frontend (interfaz + UI) |
| C-02 | Agregar `periodoDesde: string` y `periodoHasta: string` (formato `"mm-aaaa"`) a `ParticipacionVinculacionItem` y al formulario de carga de la sección 7.3 en MOD-DOC | **OBLIGATORIA** | Frontend (interfaz + UI) |
| C-03 | Definir el criterio institucional de vigencia para proyectos e investigación: umbral de mes de corte para el formato `"mm-aaaa"` y tratamiento de registros sin `periodoHasta` (¿abiertos = vigentes?) | **OBLIGATORIA** | Decisión institucional |
| C-04 | Definir el tratamiento de registros históricos existentes en `proyectosInvestigacionJson` y `participacionVinculacionJson` que no tienen campos de fecha (retrocompatibilidad JSON) | **OBLIGATORIA** | Backend (lógica de parseo) |
| C-05 | Implementar consulta docente-céntrica en `ConsultasAcademicasService` que agregue todos los componentes de dedicación de R-10 con control de acceso por facultad | **OBLIGATORIA** | Backend (nuevo método en servicio existente) |
| C-06 | Estandarizar los campos `horasSemanales` y `horasSeman` con validación backend (valor numérico entero ≥ 0) | RECOMENDADA | Backend (contrato JSON o validación en servicio) |
| C-07 | Confirmar institucionalmente con UdeMM el valor de P-02 (actualmente 20 h) y documentar la fuente del criterio | RECOMENDADA | Decisión institucional |
| C-08 | Resolver la discrepancia `tipo: 'DETALLE'` vs FSD `'Alerta'` en el registry, verificando previamente el impacto en el API y en el frontend de MOD-AUT | RECOMENDADA | Backend (registry) |
| C-09 | Incluir `horasOtrasDedicaciones` en el evaluador (componente omitido en el prototipo pero requerido por el FSD) | **OBLIGATORIA** | Backend (evaluador R-10) |
| C-10 | Resolver las dependencias compartidas con R-03: vigencia de cargo docente, consolidación multi-facultad, consulta docente-céntrica | RECOMENDADA | Fase conjunta con R-03 |
| C-11 | Definir pruebas de cálculo para los cinco componentes de dedicación, incluyendo casos borde (campos vacíos, proyectos sin fechas, vigencia parcial) | RECOMENDADA | Tests (nueva suite) |

---

## 12. Dictamen técnico-funcional

**Dictamen: D — DIFERIR (bloqueado por brechas estructurales de datos)**

R-10 no puede implementarse en conformidad con el FSD con el modelo de datos actual. Los bloqueantes R10-BLO-01 y R10-BLO-02 representan ausencias absolutas de datos en la capa de captura: `ProyectoInvestigacionItem` y `ParticipacionVinculacionItem` no tienen ningún campo de fecha. El FSD prescribe explícitamente que investigación y vinculación deben calcularse sobre participaciones "vigentes", y esta vigencia no puede determinarse sin fechas.

Este dictamen es más severo que el de R-03 (C — DIFERIR), donde la gestión dispone de fechas aunque en formato ambiguo. R-10 carece de cualquier información de vigencia para dos de sus cinco componentes.

**Las brechas son resoluble sin migración de esquema Prisma.** Los campos `proyectosInvestigacionJson` y `participacionVinculacionJson` son `String?` y pueden almacenar cualquier JSON. El ajuste requerido es del formulario de captura en MOD-DOC (frontend) y del contrato de estructura del JSON. Esta característica convierte R-10 en resoluble mediante cambios en la capa de presentación, sin modificaciones al esquema relacional, siempre que se defina el tratamiento de registros históricos.

**Estado final:** R-10 — `NO_IMPLEMENTADO` — DIFERIDO CON FUNDAMENTACIÓN TÉCNICA Y FUNCIONAL — PENDIENTE DE RESOLUCIÓN DE DEPENDENCIAS.
