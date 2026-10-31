# R-10 — Decisiones de Implementación y Limitaciones

## 1. Propósito

Este documento registra las decisiones de diseño, las limitaciones del modelo de datos y las inconsistencias entre artefactos que condicionan la implementación del indicador R-10 ("Docente con baja dedicación"). Su objetivo es preservar el contexto técnico y funcional de las elecciones realizadas durante la fase de auditoría de viabilidad, para facilitar la reanudación ordenada de la implementación cuando se resuelvan las condiciones identificadas.

Todas las afirmaciones están respaldadas por lecturas directas de las fuentes indicadas. Las decisiones institucionales pendientes se registran como tales sin inventariar resultados que aún no fueron tomados.

**Estado del indicador:** `NO_IMPLEMENTADO` — DIFERIDO.

**Fase de origen:** 2B.3.8-B (Cierre documental R-10, 2026-10-15).

---

## 2. Jerarquía de fuentes

| Prioridad | Fuente | Uso |
|---|---|---|
| 1 | `FSD_MODAUT_v1_1.docx` — versión 1.0, octubre 2026 | Especificación funcional de referencia. Prevalece sobre el prototipo. |
| 2 | `backend/prisma/schema.prisma` | Estado real del modelo de datos persistente. |
| 3 | `frontend/app/docentes/mi-ficha/page.tsx` (interfaces TypeScript) | Única fuente del contrato de estructura de los campos JSON de secciones 7.2 y 7.3. No existe un esquema backend equivalente. |
| 4 | `docs/autoevaluacion/Modulo_Autoevaluacion_v5_1.html` | Prototipo funcional con datos de simulación. Diverge del FSD en la fórmula de dedicación total (sección 5.3 de este documento). |
| 5 | Código del motor (`indicadores.registry.ts`, `indicadores.service.ts`, `indicadores.types.ts`) | Estado de implementación. Refleja decisiones previas del proyecto. |

---

## 3. Criterios de decisión

Las decisiones de esta fase aplicaron los siguientes criterios, en orden de prioridad:

1. **Fidelidad al FSD:** Una implementación que no sea conforme al FSD no se implementa; se difiere con fundamentación.
2. **Seguridad del resultado:** Una alerta informativa incorrecta (por sobreestimación o infraestimación) para un proceso CONEAU es peor que la ausencia de resultado.
3. **Alcance mínimo de impacto:** Si la brecha es resoluble sin migración de esquema Prisma (modificación solo de formulario y contrato JSON), se considera de menor impacto.
4. **Coherencia con decisiones existentes:** Las decisiones de R-07, R-03 y otros indicadores implementados establecen precedentes de diseño que R-10 debe respetar.
5. **No invención de criterios institucionales:** Cuando el FSD dice "a confirmar con UdeMM", la decisión se diferiere a la institución.

---

## 4. Decisiones

### R10-DP-01 — Vigencia de proyectos de investigación (sección 7.2)

**Estado:** DIFERIR — brecha estructural de datos

**Requisito del FSD:**
El FSD §3.3 Tabla 4 define "Horas de investigación = Suma de las horas de las participaciones en proyectos de investigación **vigentes** (sección 7.2)." El FSD §3.1 Tabla 2 indica que la sección 7.2 incluye "participación en proyectos (horas, **fechas**)". La vigencia es un criterio funcional prescripto, no una interpretación.

**Evidencia técnica:**
La interfaz `ProyectoInvestigacionItem` (línea 221 de `frontend/app/docentes/mi-ficha/page.tsx`) define:
```typescript
interface ProyectoInvestigacionItem {
  id: string;
  codigo: string;
  titulo: string;
  rol: string;
  horasSemanales: string;
}
```
No existen campos de fecha. El campo Prisma correspondiente es `Docente.proyectosInvestigacionJson String?`.

**Brecha:**
La brecha es del formulario de captura y del contrato de estructura del JSON. No es una brecha de esquema Prisma: el campo `String?` puede almacenar JSON con cualquier estructura, incluyendo campos de fecha nuevos, sin requerir una migración de base de datos. Sin fechas almacenadas, la condición "vigentes" no puede evaluarse.

**Alternativas:**
| Alternativa | Resultado | Conformidad FSD |
|---|---|---|
| Sumar todos los proyectos (sin vigencia) | Sobreestima dedicación; proyectos finalizados se computan como vigentes | No conforme |
| Excluir todos los proyectos (horasInv = 0) | Infraestima sistemáticamente; docentes investigadores activos reciben horas = 0 | No conforme |
| Diferir hasta disponer de fechas | No genera resultado; `NO_IMPLEMENTADO` correcto | Conforme (resultado honesto) |

**Riesgos de las alternativas no conformes:**
- "Sobreestimar" puede ocultar docentes con baja dedicación real (falsas no-alertas).
- "Excluir" puede alertar a docentes con alta dedicación real (falsas alertas).
- Ambos casos distorsionan IP-15 (cantidad de docentes con baja dedicación) ante CONEAU.

**Decisión provisional:** DIFERIR. No se implementa R10-DP-01 hasta que se agreguen campos de fecha al formulario de la sección 7.2 en MOD-DOC y se defina el criterio de vigencia para esos registros.

**Condición de resolución:** Implementación de C-01 y C-03 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** Este problema no existe en R-03 ni en R-07. Es específico de R-10.

---

### R10-DP-02 — Vigencia de actividades de vinculación (sección 7.3)

**Estado:** DIFERIR — brecha estructural de datos (idéntica a R10-DP-01)

**Requisito del FSD:**
El FSD §3.3 Tabla 4 define "Horas de vinculación = Suma de las horas de las participaciones en actividades de vinculación **vigentes** (sección 7.3)." El FSD §3.1 Tabla 2 indica "participación en vinculación (horas, **fechas**)".

**Evidencia técnica:**
La interfaz `ParticipacionVinculacionItem` (línea 244 de `frontend/app/docentes/mi-ficha/page.tsx`) define:
```typescript
interface ParticipacionVinculacionItem {
  id: string;
  codigo: string;
  actividad: string;
  rol: string;
  horasSemanales: string;
}
```
No existen campos de fecha.

**Distinción con extensión:**
El sistema también contiene `Docente.actividadesExtensionJson`, cuya interfaz incluye `fechaInicio` y `fechaFin`. Este campo corresponde a la sección 7.4 (actividades de extensión). No debe utilizarse como sustituto de la sección 7.3 para R-10. El FSD distingue "vinculación" (7.3) de otras actividades de extensión (7.4), y la fórmula de R-10 utiliza exclusivamente el componente de vinculación (7.3).

**Brecha, alternativas, riesgos y decisión:** Análogos a R10-DP-01.

**Condición de resolución:** Implementación de C-02 y C-03 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** Específica de R-10.

---

### R10-DP-03 — Contratos y validación de horas semanales

**Estado:** DIFERIR — limitación sin solución actual en el modelo

**Requisito del FSD:**
Todos los componentes de la fórmula deben producir valores numéricos en horas semanales para que la suma sea calculable.

**Evidencia técnica:**
Los campos de horas en los blobs JSON son `string` sin contrato de validación backend:

| Campo | Interfaz | Validación backend |
|---|---|---|
| `dedicacionSemanal` | `CargoAcademicoItem` | Ninguna |
| `horasSemanales` | `ProyectoInvestigacionItem` | Ninguna |
| `horasSemanales` | `ParticipacionVinculacionItem` | Ninguna |
| `horasSeman` | `OtraDedicacionItem` | Ninguna (frontend aplica `.replace(/\D/g, '')` solo en UI) |

El frontend aplica `replace(/\D/g, '')` al campo `horasSeman` de `OtraDedicacionItem` en el momento de edición en la UI, pero esto no garantiza que los valores almacenados en la base de datos sean numéricos (datos importados, APIs directas, operaciones previas a la validación frontend).

**Brecha:**
Los campos `string` **no son un bloqueo estructural absoluto**: si los docentes cargan correctamente sus datos numéricos mediante la UI, los valores serán válidos para `parseFloat()`. Sin embargo, la ausencia de un contrato backend impide garantizar la integridad del cálculo para todos los registros. Un `NaN` silencioso en la suma produce un resultado de dedicación total incorrecto sin indicación de error.

**Alternativas:**
| Alternativa | Implicación |
|---|---|
| `parseFloat(valor) \|\| 0` | Trata vacíos y no-numéricos como cero; puede infraestimar la dedicación si el dato existe pero no es parseable |
| `parseFloat(valor)` con `NaN` → clasificar como `NO_DETERMINABLE` | Más honesto; genera más resultados parciales pero no silencia errores |
| Agregar validación backend en el DTO de `ActualizarDocente` | Corrección de causa raíz; requiere modificar MOD-DOC |

**Decisión provisional:** Documentar como limitación residual. En el momento de implementación, la estrategia preferida es: si `parseFloat(valor)` resulta en `NaN`, incluir el campo en `datosFaltantes` y clasificar el resultado del docente como `PARCIAL` con causa `HORAS_NO_NUMERICAS`. No tratar `NaN` como cero, ya que cero tiene significado semántico (no tiene esa dedicación).

**Condición de resolución:** Implementación de C-06 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** Esta limitación es compartida con R-03. Ver `R03_DECISIONES_Y_LIMITACIONES.md` para contexto.

---

### R10-DP-04 — Consolidación docente y RBAC

**Estado:** DIFERIR — requiere consulta docente-céntrica no implementada

**Requisito del FSD:**
R-10 debe evaluarse sobre todos los docentes vigentes de la Facultad de Ingeniería. El FSD §1.3 indica "un docente que dicta en varias carreras se evalúa una sola vez."

**Evidencia técnica:**
No existe en `ConsultasAcademicasService` una consulta que:
1. Devuelva la lista de docentes vigentes de una facultad (con sus campos JSON de dedicación).
2. Agregue los componentes de dedicación total por docente.
3. Respete el RBAC de MOD-AUT (roles autorizados: `ADMINISTRADOR_SISTEMA`, `SECRETARIA_ACADEMICA`, `RECTORADO`, `DECANO`, `DIRECTOR_CARRERA`).

La consulta existente `obtenerVinculacionesParaR07` está orientada al conteo de vinculaciones por docente; su estructura no es reutilizable directamente para R-10.

**Brecha:**
La ausencia de consulta docente-céntrica es una limitación arquitectónica que también bloquea R-03. Es compartida.

**Docentes con vinculaciones en múltiples facultades:**
Si un docente tiene vinculaciones en múltiples facultades, su dedicación de docencia puede ser incompleta si solo se consulta la facultad del solicitante. El tratamiento análogo al de R-07 DP-2 (clasificar como `NO_DETERMINABLE / CROSS_FACULTAD`) es la alternativa más coherente con el diseño existente.

**Rol `DIRECTOR_CARRERA`:**
Según el RBAC de MOD-AUT (`indicadores.service.ts` línea 22-28), `DIRECTOR_CARRERA` tiene acceso al motor. Sin embargo, R-10 evalúa el plantel completo de la facultad (alcance `DOCENTE`, no `CARRERA`). Si el `DIRECTOR_CARRERA` solo tiene scope sobre su carrera, el resultado de R-10 sería `PARCIAL` (solo incluiría docentes de su carrera), igual que en R-07 DP-3. No se amplía el scope en este diseño.

**Decisión provisional:** Diferir hasta que se implemente la consulta docente-céntrica para R-10 en `ConsultasAcademicasService`. No crear la consulta en esta fase.

**Condición de resolución:** Implementación de C-05 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** COMPARTIDA con R-03 (mismo requisito de consulta docente-céntrica).

---

### R10-DP-05 — Vigencia de cargos de gestión

**Estado:** DIFERIR — ambigüedad en criterio de corte no resuelta

**Requisito del FSD:**
Horas de gestión = suma de la dedicación semanal de los cargos de gestión **vigentes** (fecha de fin vacía o posterior a la fecha de cálculo).

**Evidencia técnica:**
`CargoAcademicoItem.periodoHasta: string` — puede ser `""` (cargo abierto) o `"mm-aaaa"` (fecha de fin). El formato no incluye día. La fecha de cálculo es `Date` (fecha y hora exacta). No está especificado si un cargo cuyo `periodoHasta = "10-2026"` se considera vigente cuando la fecha de cálculo es el 15-10-2026 (¿primer día?, ¿último día?).

**Alternativas:**
| Alternativa | Descripción |
|---|---|
| `periodoHasta >= "mm-aaaa"` del mes actual | Trata el mes completo como vigente; sobreestima un mes en casos límite |
| `periodoHasta` del mes siguiente al actual | Trata como vigente hasta el fin del mes indicado |
| Solo `periodoHasta = ""` como vigente, el resto como expirado | Subestima; un cargo que termina este mes se excluye desde el primer día |

**Decisión provisional:** Diferir a resolución de R03-DP-01 (misma ambigüedad, documentada en `R03_DECISIONES_Y_LIMITACIONES.md`). La decisión debe ser coherente entre R-03 y R-10.

**Condición de resolución:** Decisión institucional sobre el criterio de vigencia mensual para cargos de gestión. Ver C-03 y la decisión R03-DP-01 en `R03_DECISIONES_Y_LIMITACIONES.md`.

**Dependencias compartidas:** COMPARTIDA con R-03. La resolución debe ser única para ambos indicadores.

---

### R10-DP-06 — Semántica de cargos docentes vigentes

**Estado:** DIFERIR — limitación arquitectónica compartida

**Requisito del FSD:**
R-10 se aplica solo a docentes vigentes. FSD §3.3: "Docente vigente = docente con ficha activa y al menos un cargo vigente (definición de MOD-DOC)." FSD §3.3: "Cargo vigente = cargo docente cuya fecha de fin está vacía o es posterior a la fecha de cálculo."

**Evidencia técnica:**
El modelo `Docente` tiene `fechaFinCargo String?` y `fechaInicioCargo String?`, pero estos campos representan el cargo **principal** del docente (un único cargo), no un registro histórico de nombramientos. El modelo `Cargo` es un catálogo de tipos de cargo institucionales (`{ id, nombre, activo }`) sin fechas individuales de nombramiento por docente.

`Docente.activo Boolean` indica baja lógica de la ficha del docente, no vigencia del cargo. Un docente puede tener `activo = true` pero su único cargo finalizado.

**Decisión provisional:** Aproximación: un docente es vigente si `Docente.activo = true` **y** (`fechaFinCargo` está vacía **o** `fechaFinCargo` es posterior a la fecha de cálculo). Esta es la misma aproximación de R03-DP-06 documentada en `R03_DECISIONES_Y_LIMITACIONES.md`. Los resultados pueden incluir docentes cuyo cargo finalizó sin actualización del sistema.

**Condición de resolución:** Decisión institucional sobre si `fechaFinCargo` cubre todos los cargos posibles del docente o solo el principal, y si se requiere un modelo de nombramientos individuales.

**Dependencias compartidas:** COMPARTIDA con R-03 (R03-DP-06) y con R-07 (DP-1).

---

### R10-DP-07 — Discrepancia entre FSD (`ALERTA`) y registry/prototipo (`DETALLE`)

**Estado:** PENDIENTE DE VERIFICACIÓN — no corregir en esta fase

**Descripción:**

| Artefacto | Valor de `tipo` |
|---|---|
| FSD §5.2 Tabla 9 | `Alerta` |
| Prototipo línea 353 | `'Detalle'` |
| Registry `indicadores.registry.ts` línea 160 | `'DETALLE'` |

El FSD define dos tipos en §5.1 Tabla 8: "Alerta: genera una entrada en la bandeja. Indicador: solo produce un valor estadístico, sin alerta." Según esta definición, R-10 es `Alerta` porque genera una entrada en la bandeja de alertas informativas.

El prototipo usa `'Detalle'` con `sev:'Informativa'`. `'Detalle'` es un tercer valor del tipo `TipoIndicador = 'ALERTA' | 'INDICADOR' | 'DETALLE'` definido en el sistema, que no aparece en la taxonomía binaria del FSD.

**Potencial impacto funcional:**
El campo `tipo` en `DefinicionIndicador` es devuelto por `RegistroIndicadores.listar()`. El FSD §9.8 especifica que la pantalla "Reglas de validación" muestra la columna "Tipo" para cada regla. Si existe un endpoint que expone este listado y un componente frontend que filtra o presenta según `tipo`, cambiar `'DETALLE'` por `'ALERTA'` modificaría la presentación.

El motor de evaluación (`indicadores.service.ts` líneas 63-91) no usa el campo `tipo` en ninguna condición lógica de evaluación. Sin embargo, `indicadores.spec.ts` puede incluir aserciones sobre el valor de `tipo` en el registro. El impacto debe verificarse en:
1. El API contract del endpoint de listado de indicadores (si existe).
2. Las pruebas de `indicadores.spec.ts`.
3. Los componentes frontend de MOD-AUT que muestran la tabla de reglas.

**Decisión provisional:** No corregir en esta fase documental. Registrar como deuda técnica a resolver antes de la implementación de R-10 o en una corrección ortogonal al registry.

**Condición de resolución:** Verificar impacto en API, pruebas y frontend. Corrección en el registry si no hay efectos secundarios. Ver C-08 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** Esta discrepancia es específica de R-10 (otros indicadores como R-03 están marcados `'ALERTA'` en el registry, coincidiendo con el FSD).

---

### R10-DP-08 — Inclusión de otras dedicaciones en la fórmula

**Estado:** DIFERIR — componente ausente en el prototipo pero requerido por el FSD

**Requisito del FSD:**
El FSD §3.3 Tabla 4 incluye explícitamente "Horas de otras dedicaciones = Suma de las horas de la sección 5.2" en la fórmula de dedicación total. No aplica calificador de vigencia.

**Evidencia técnica:**
El prototipo (línea 328) define:
```javascript
const dedTot = d => { const f = fun(d); return f.doc + f.ges + f.inv + f.vin };
```
La función omite un componente equivalente a `otras_dedicaciones`. El prototipo incluye una nota en línea: "Dedicación calculada (MOD-DOC v8.1 no la declara): docencia de las vinculaciones + gestión + investigación + vinculación."

Esta nota confirma que el prototipo sabe que MOD-DOC v8.1 no expone formalmente un cálculo de dedicación, y que la simulación del prototipo usa valores directos. La omisión de `otras_dedicaciones` en el prototipo no es una definición institucional: es una simplificación de la simulación.

**Brecha:**
El FSD es la fuente normativa de referencia. La fórmula del FSD incluye `otras_dedicaciones`. La fórmula del prototipo no lo hace. Al implementar R-10, debe seguirse el FSD.

**Datos disponibles:**
`OtraDedicacionItem.horasSeman: string` — disponible en `Docente.otrasDedicacionesJson`. No requiere vigencia (FSD no aplica calificador). Tipo `string` con limitación de validación (ver R10-DP-03).

**Decisión provisional:** La implementación futura de R-10 debe incluir `horasOtrasDedicaciones` en la suma de dedicación total, conforme al FSD. El prototipo no es la referencia correcta para este componente.

**Condición de resolución:** Implementación de C-09 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** Específica de R-10. R-03 no utiliza este componente.

---

### R10-DP-09 — Confirmación institucional del valor de P-02

**Estado:** PENDIENTE — decisión institucional no tomada

**Requisito del FSD:**
El FSD §4.1 Tabla 5 define P-02 como "Baja dedicación: alerta si la dedicación total es menor a (h)" con valor inicial 20 h y fuente "Criterio institucional — **a confirmar con UdeMM**". El texto "a confirmar" es literal del FSD e indica una definición funcional pendiente.

**Evidencia técnica:**
`AutoevaluacionConfigFacultad.p02BajaH Int` — campo `Int` sin valor `@default`. El umbral de 20 h es un valor inicial de referencia, no un criterio institucional aprobado.

**Brecha:**
Si se implementa R-10 antes de que UdeMM confirme el valor de P-02, las alertas se emitirán con un umbral que puede no reflejar el criterio institucional real. IP-15 ("Dedicación menor a {P-02} h") mostraría un título con un valor no aprobado.

**Implicación para IP-15:** FSD §7 Tabla 24 especifica que "El título usa el valor vigente de P-02." Si P-02 es posteriormente modificado, IP-15 se actualiza automáticamente (cálculo en línea según FSD §1.3).

**Decisión provisional:** Diferir hasta recibir confirmación institucional del valor de P-02. El valor 20 h puede usarse como referencia de validación técnica durante pruebas internas, pero no debe presentarse como umbral aprobado en producción.

**Condición de resolución:** Confirmación formal de UdeMM sobre el valor de P-02. Ver C-07 de `R10_CIERRE_TECNICO_FUNCIONAL.md`.

**Dependencias compartidas:** El mecanismo de P-02 es análogo al de P-01 (R-03) y P-03 (R-07). La confirmación institucional es igualmente necesaria para P-01 (aunque R-03 tiene una fuente más formal: el Instructivo Ficha Docente CONEAU Global).

---

## 5. Riesgos residuales

Los siguientes riesgos persisten en el estado `NO_IMPLEMENTADO` actual y deben ser gestionados activamente:

| ID | Riesgo | Estado | Acción recomendada |
|---|---|---|---|
| RR-01 | Registros de investigación (7.2) y vinculación (7.3) cargados por docentes antes de que se agreguen campos de fecha serán históricamente ambiguos — sin fecha no puede determinarse vigencia retroactiva | Activo | Definir criterio de tratamiento de registros históricos antes de agregar los campos (e.g., fecha de inicio vacía = vigente, o excluir de R-10 con advertencia) |
| RR-02 | La brecha de tipo `'DETALLE'` vs `'ALERTA'` puede causar que R-10 no aparezca en el filtro "Alertas" de la pantalla §9.7 si el frontend filtra por `tipo = 'ALERTA'` | Posible | Verificar antes de implementar R-10 |
| RR-03 | Si P-02 nunca se confirma institucionalmente, R-10 permanecerá sin umbral validado indefinidamente | Activo | Escalar a UdeMM para confirmación del valor de P-02 |
| RR-04 | La fórmula de dedicación total diverge entre FSD y prototipo (prototipo omite otras_dedicaciones); si el equipo usa el prototipo como especificación, la implementación resultante será incorrecta | Activo | Asegurar que el FSD sea la fuente de referencia en el momento de implementación |
| RR-05 | La nota del prototipo ("MOD-DOC v8.1 no la declara") indica que la dedicación total calculada no está formalizada en la ficha docente; si el docente no puede ver en MOD-DOC la misma suma que calcula MOD-AUT, habrá inconsistencia visible | Bajo | Verificar en MOD-DOC si se expone una vista de dedicación calculada al docente |

---

## 6. Dependencias compartidas

Las siguientes dependencias son compartidas entre R-10 y R-03 (y en algunos casos con otros indicadores):

| Dependencia | Indicadores | Prioridad para resolución |
|---|---|---|
| Consulta docente-céntrica con agregación y RBAC | R-03, R-10 | Alta — bloqueante para ambos |
| Vigencia de cargos de gestión (criterio `"mm-aaaa"`) | R-03, R-10 | Alta |
| Tipo `string` en campos de horas JSON | R-03, R-10 | Media |
| Vigencia de cargo docente individual (`fechaFinCargo`) | R-03, R-07, R-10 | Media |
| Consolidación de docentes multi-facultad (CROSS_FACULTAD) | R-07, R-03, R-10 | Media |
| `AutoevaluacionConfigFacultad` — existencia de config | R-03 (p01TopeH), R-07 (p03MaxMat), R-10 (p02BajaH) | Alta |

**Propuesta:** Antes de iniciar la implementación de R-03 o R-10, dedicar una fase específica de análisis y resolución conjunta de las dependencias compartidas marcadas como Alta. Esta fase debe producir: (a) la consulta docente-céntrica en `ConsultasAcademicasService`, (b) el criterio de vigencia mensual institucional, y (c) la estrategia de validación de campos `string`. Implementar R-03 y R-10 en paralelo con una base común reduce el riesgo de divergencia entre sus implementaciones.

---

## 7. Condiciones de resolución

Las decisiones en estado DIFERIR o PENDIENTE se cierran con las siguientes condiciones, referenciadas al documento `R10_CIERRE_TECNICO_FUNCIONAL.md`:

| Decisión | Condición(es) que la desbloquea |
|---|---|
| R10-DP-01 (investigación sin fechas) | C-01, C-03, C-04 |
| R10-DP-02 (vinculación sin fechas) | C-02, C-03, C-04 |
| R10-DP-03 (horas en `string`) | C-06 |
| R10-DP-04 (consulta docente-céntrica) | C-05 |
| R10-DP-05 (vigencia de gestión `"mm-aaaa"`) | C-03 (decisión institucional de corte mensual) |
| R10-DP-06 (semántica de cargo docente) | Decisión institucional sobre modelo de nombramientos |
| R10-DP-07 (tipo `'DETALLE'` vs `'ALERTA'`) | C-08 (verificación de impacto y corrección del registry) |
| R10-DP-08 (otras dedicaciones ausentes en prototipo) | C-09 (incluir en el evaluador) |
| R10-DP-09 (valor de P-02 no confirmado) | C-07 (confirmación de UdeMM) |

---

## 8. Estado de aprobación institucional

| Elemento | Estado |
|---|---|
| Fórmula de dedicación total | Definida en el FSD; no se requiere decisión adicional para la fórmula base |
| Valor de P-02 (umbral de baja dedicación) | **A confirmar con UdeMM** (texto literal del FSD §4.1) |
| Criterio de vigencia mensual para cargos de gestión | No definido en el FSD; **pendiente de decisión institucional** |
| Tratamiento de registros históricos sin fecha (investigación y vinculación) | **Pendiente de decisión institucional** (no existe precedente en el sistema) |
| Tipo de indicador: `'ALERTA'` vs `'DETALLE'` | Discrepancia entre FSD y prototipo; **pendiente de verificación técnica** y, si corresponde, decisión del equipo |
| Alcance de la indicador para `DIRECTOR_CARRERA` | Comportamiento derivado del RBAC existente; no requiere decisión adicional si se aplica el mismo criterio que R-07 DP-3 |

---

## 9. Conclusión

R-10 no puede implementarse en conformidad con el FSD en el estado actual del sistema. Las dos brechas estructurales de datos (R10-DP-01 y R10-DP-02) representan ausencias de información en la capa de captura — los formularios de las secciones 7.2 y 7.3 de MOD-DOC no registran fechas de participación — que hacen imposible el filtro de vigencia que el FSD prescribe para investigación y vinculación.

A diferencia de R-03, donde la gestión tiene fechas aunque en formato ambiguo, R-10 carece de cualquier campo de fecha para dos de sus cinco componentes. Este es el motivo por el que R-10 recibe el dictamen D — DIFERIR (bloqueado por brechas estructurales de datos), más severo que el dictamen C — DIFERIR de R-03.

Las brechas son resolubles **sin migración de esquema Prisma**: los campos `proyectosInvestigacionJson` y `participacionVinculacionJson` son `String?` y pueden almacenar estructuras JSON ampliadas. El cambio requerido es del formulario de captura en MOD-DOC, del contrato de interfaz en el frontend, y del tratamiento de registros históricos. Esta característica hace que el costo de resolución sea menor al de una migración relacional, pero requiere coordinación entre MOD-DOC y MOD-AUT.

**Estado final:**
R-10 — `NO_IMPLEMENTADO` — DIFERIDO CON FUNDAMENTACIÓN TÉCNICA Y FUNCIONAL — PENDIENTE DE RESOLUCIÓN DE DEPENDENCIAS.
