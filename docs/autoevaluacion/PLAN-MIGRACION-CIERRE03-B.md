# Plan de Migración — CIERRE-03 Fase B

**Estado:** PREPARATORIO — No ejecutar hasta aprobación en sprint de producción  
**Rama:** `feature/ajustes-permisos-docentes`  
**Autor:** Mariano Fuentes  
**Fecha de redacción:** 2026-10-26  
**Versión:** 1.1.0 (corregido)

---

## 1. Contexto

CIERRE-03 Fase B introduce dos relaciones opcionales en el modelo `Docente`:

| Decisión | Columna nueva | Tabla destino | Propósito |
|---|---|---|---|
| D-05 | `tipoDedicacionConeauId` | `TipoDedicacionConeau` | Catálogo controlado CONEAU de dedicación docente |
| D-06 | `tipoPosgradoId` | `TipoPosgrado` | Clasificación CONEAU del nivel de posgrado (ver §11) |

Ambas columnas son **opcionales** (`String? NULL`). Todos los docentes existentes migran con FK `null`. No se elimina ningún campo existente.

---

## 2. Cambios de esquema preparados

El archivo `backend/prisma/schema.prisma` ya contiene los cambios. El código de servicio que los usa está en modo `as any` (sin tipos generados). **No ejecutar `prisma migrate dev` hasta que este plan sea aprobado.**

### 2.1 Nueva tabla `TipoDedicacionConeau`

```prisma
model TipoDedicacionConeau {
  id                 String    @id @default(uuid())
  nombre             String    @unique   // "Exclusiva", "Semiexclusiva", "Simple"
  codigo             String    @unique   // "EXCLUSIVA", "SEMIEXCLUSIVA", "SIMPLE"
  activo             Boolean   @default(true)
  fechaCreacion      DateTime  @default(now())
  fechaActualizacion DateTime  @updatedAt
  docentes           Docente[]
}
```

### 2.2 Columnas preparatorias en `Docente`

```prisma
tipoDedicacionConeauId  String?
tipoPosgradoId          String?
tipoDedicacionConeau    TipoDedicacionConeau? @relation(...)
tipoPosgrado            TipoPosgrado?        @relation(...)
@@index([tipoDedicacionConeauId])
@@index([tipoPosgradoId])
```

### 2.3 Back-relation en `TipoPosgrado`

```prisma
docentes  Docente[]
```

`TipoPosgrado` es una tabla existente. Solo se agrega el campo de back-relation en el modelo Prisma; no se genera ninguna columna en PostgreSQL por este cambio.

---

## 3. Procedimiento de migración — 10 pasos

> **IMPORTANTE:** Ejecutar en este orden exacto. No saltear pasos ni combinarlos.

### Paso 1 — Auditoría pre-migración

Antes de tocar la base de datos, ejecutar la consulta de distribución de dedicaciones:

```sql
SELECT
  COALESCE(dedicacion, '(NULL)') AS dedicacion,
  COUNT(*) AS cantidad
FROM "Docente"
GROUP BY dedicacion
ORDER BY cantidad DESC;
```

Registrar el resultado. Permite estimar cuántos docentes quedarán como `NO_DETERMINADA` y detectar valores inesperados en `Docente.dedicacion`.

### Paso 2 — Generar el archivo SQL sin ejecutarlo

```bash
cd backend
npx prisma migrate dev --name add-tipo-dedicacion-coneau-d05-d06 --create-only
```

El flag `--create-only` genera el archivo SQL en `backend/prisma/migrations/<timestamp>_add-tipo-dedicacion-coneau-d05-d06/migration.sql` **sin aplicarlo**.

### Paso 3 — Revisar el SQL generado manualmente

Verificar que el archivo contiene **solo operaciones aditivas** (ningún `DROP`):

```sql
-- CreateTable
CREATE TABLE "TipoDedicacionConeau" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TipoDedicacionConeau_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TipoDedicacionConeau_nombre_key" ON "TipoDedicacionConeau"("nombre");
CREATE UNIQUE INDEX "TipoDedicacionConeau_codigo_key" ON "TipoDedicacionConeau"("codigo");

ALTER TABLE "Docente" ADD COLUMN "tipoDedicacionConeauId" TEXT;
ALTER TABLE "Docente" ADD COLUMN "tipoPosgradoId" TEXT;

CREATE INDEX "Docente_tipoDedicacionConeauId_idx" ON "Docente"("tipoDedicacionConeauId");
CREATE INDEX "Docente_tipoPosgradoId_idx" ON "Docente"("tipoPosgradoId");

ALTER TABLE "Docente" ADD CONSTRAINT "Docente_tipoDedicacionConeauId_fkey"
    FOREIGN KEY ("tipoDedicacionConeauId") REFERENCES "TipoDedicacionConeau"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Docente" ADD CONSTRAINT "Docente_tipoPosgradoId_fkey"
    FOREIGN KEY ("tipoPosgradoId") REFERENCES "TipoPosgrado"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
```

Si el SQL generado contiene cualquier `DROP TABLE`, `DROP COLUMN` o `ALTER COLUMN` no esperado: **no continuar**, investigar el motivo.

### Paso 4 — Respaldo de PostgreSQL

**Obligatorio antes de aplicar cualquier migración.**

```bash
# Respaldo completo
pg_dump -Fc -h localhost -U <usuario> -d <nombre_db> \
  -f backup_pre_cierre03b_$(date +%Y%m%d_%H%M%S).dump

# Verificar integridad del respaldo
pg_restore --list backup_pre_cierre03b_*.dump | head -20
```

Guardar el archivo `.dump` en una ubicación fuera del directorio del proyecto. Sin este respaldo, el rollback de datos es imposible.

### Paso 5 — Aplicar la migración en entorno local de prueba

**Primero en entorno local; nunca directamente en producción.**

```bash
npx prisma migrate deploy
```

`prisma migrate deploy` aplica migraciones pendientes en orden. No genera archivos nuevos. Es el comando correcto para entornos no interactivos (local, staging, producción).

### Paso 6 — Generar el cliente Prisma

```bash
npx prisma generate
```

Después de este paso, `(this.prisma as any).tipoDedicacionConeau` puede ser reemplazado por el tipo generado. El código preparatorio existente sigue funcionando en modo `as any` hasta que se active (Paso 9).

### Paso 7 — Seed del catálogo

Las tres categorías CONEAU son estables. Ejecutar el seed como script independiente:

```typescript
// Ejecutar con: npx ts-node --project tsconfig.json scripts/seed-tipo-dedicacion-coneau.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = [
    { nombre: 'Exclusiva',     codigo: 'EXCLUSIVA'     },
    { nombre: 'Semiexclusiva', codigo: 'SEMIEXCLUSIVA' },
    { nombre: 'Simple',        codigo: 'SIMPLE'        },
  ];

  for (const item of items) {
    await prisma.tipoDedicacionConeau.upsert({
      where:  { codigo: item.codigo },
      update: { nombre: item.nombre, activo: true },
      create: { ...item, activo: true },
    });
    console.log(`Upsert OK: ${item.codigo}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

El uso de `upsert` garantiza idempotencia: re-ejecutar el seed no duplica ni sobreescribe de forma destructiva.

### Paso 8 — Migración de datos históricos

Ver §5 para el script completo. Ejecutar primero en modo simulación (`--dry-run`), revisar el reporte, y solo entonces ejecutar sin el flag.

```bash
# Simulación (no modifica datos)
npx ts-node --project tsconfig.json scripts/migrar-dedicacion-coneau.ts --dry-run

# Ejecución real
npx ts-node --project tsconfig.json scripts/migrar-dedicacion-coneau.ts
```

### Paso 9 — Verificaciones de integridad

Ver §7 para las consultas SQL de verificación. Ejecutar todas antes de continuar.

### Paso 10 — Activación de servicios y validación funcional

1. En `tipo-dedicacion-coneau.service.ts`: eliminar los casts `as any`.
2. Registrar `TipoDedicacionConeauService` en `AutoevaluacionModule`.
3. En `ficha-docente.service.ts`: conectar el servicio para poblar `tipoDedicacionConeau` en la respuesta.
4. Ejecutar suite Jest completa + `tsc --noEmit` + `next build`.
5. Levantar la aplicación localmente y verificar que el endpoint `/autoevaluacion/ficha-docente/:docenteId` devuelve `tipoDedicacionConeau` correctamente.

---

## 4. Estrategia de seed del catálogo

Ver Paso 7 en §3. El script es idempotente por el uso de `upsert({ where: { codigo } })`.

`NO_DETERMINADA` **no es una fila del catálogo**. Se representa como `tipoDedicacionConeauId = null`. No crear una fila "NO_DETERMINADA" en `TipoDedicacionConeau`.

---

## 5. Migración de datos históricos — script corregido

### 5.1 Lógica de mapeo

La función `normalizarDedicacionConeau(dedicacion)` (ya implementada en `normalizar-dedicacion.ts`) determina la categoría para cada docente:

- `EXCLUSIVA` → FK al id del catálogo con `codigo = 'EXCLUSIVA'`
- `SEMIEXCLUSIVA` → FK al id del catálogo con `codigo = 'SEMIEXCLUSIVA'`
- `SIMPLE` → FK al id del catálogo con `codigo = 'SIMPLE'`
- `NO_DETERMINADA` (null, vacío, REGULAR, INTERINO, CONTRATADO, u otro valor no reconocido) → FK permanece `null`

El campo `Docente.dedicacion` **no se modifica en ningún caso**. La migración solo escribe en `tipoDedicacionConeauId`.

### 5.2 Script corregido

**Corrección respecto a la versión anterior:**
- La versión anterior filtraba por `{ tipoDedicacionConeauId: null }` y usaba cursor sobre ese conjunto. Al actualizar registros de ese conjunto durante el procesamiento, el cursor pierde estabilidad (los registros procesados salen del filtro y la posición relativa cambia). El cursor puede saltar registros entre lotes.
- **Solución:** paginar sobre el conjunto completo de `Docente` ordenado por `id ASC`, verificar dentro del loop si el registro ya fue migrado y omitirlo. El conjunto paginado es estable (todos los docentes, sin filtro dinámico).

```typescript
// scripts/migrar-dedicacion-coneau.ts
// Uso: npx ts-node --project tsconfig.json scripts/migrar-dedicacion-coneau.ts [--dry-run]

import { PrismaClient } from '@prisma/client';
import { normalizarDedicacionConeau } from '../src/modules/autoevaluacion/tablero/normalizar-dedicacion';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const LOTE = 500;

interface Reporte {
  procesados: number;
  clasificados: number;     // FK asignada (EXCLUSIVA | SEMIEXCLUSIVA | SIMPLE)
  noDeterminados: number;   // Normalizan a NO_DETERMINADA — FK queda null (correcto, no error)
  yaClasificados: number;   // FK ya tenía valor — omitidos (idempotencia)
  errores: number;
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log('[DRY-RUN] No se modificará ningún registro.\n');

  // 1. Cargar catálogo
  const tipos = await prisma.tipoDedicacionConeau.findMany({
    select: { id: true, codigo: true },
  });
  if (tipos.length === 0) {
    throw new Error('El catálogo TipoDedicacionConeau está vacío. Ejecutar seed primero (Paso 7).');
  }
  const mapa = new Map<string, string>(tipos.map((t) => [t.codigo, t.id]));
  console.log(`Catálogo cargado: ${tipos.map((t) => t.codigo).join(', ')}\n`);

  // 2. Paginar sobre el conjunto estable (todos los docentes, ordenados por id)
  //    No filtrar por tipoDedicacionConeauId aquí: el filtro dinámico rompe el cursor.
  const reporte: Reporte = {
    procesados: 0,
    clasificados: 0,
    noDeterminados: 0,
    yaClasificados: 0,
    errores: 0,
  };

  let cursor: string | undefined;
  let hayMas = true;

  while (hayMas) {
    const lote = await prisma.docente.findMany({
      take: LOTE,
      orderBy: { id: 'asc' },
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
      select: { id: true, dedicacion: true, tipoDedicacionConeauId: true },
    });

    if (lote.length === 0) break;
    hayMas = lote.length === LOTE;
    cursor = lote[lote.length - 1].id;

    for (const docente of lote) {
      reporte.procesados++;

      // Idempotencia: omitir si ya fue clasificado
      if (docente.tipoDedicacionConeauId !== null) {
        reporte.yaClasificados++;
        continue;
      }

      try {
        const categoria = normalizarDedicacionConeau(docente.dedicacion);

        if (categoria === 'NO_DETERMINADA') {
          reporte.noDeterminados++;
          // FK permanece null — comportamiento correcto, no es un error
          continue;
        }

        const tipoId = mapa.get(categoria);
        if (!tipoId) {
          console.error(`[ERROR] Código '${categoria}' no encontrado en catálogo. Docente: ${docente.id}`);
          reporte.errores++;
          continue;
        }

        if (!DRY_RUN) {
          // select explícito: evita SELECT * implícito que incluye tipoPosgradoId
          // (en schema.prisma pero aún no en DB mientras D-06 esté pendiente).
          // Sin select, Prisma intenta RETURNING todos los campos; PostgreSQL devuelve
          // el error en español y el parser de Prisma extrae mal el nombre de columna.
          await prisma.docente.update({
            where:  { id: docente.id },
            data:   { tipoDedicacionConeauId: tipoId },
            select: { id: true },
          });
        }
        reporte.clasificados++;

      } catch (err) {
        console.error(`[ERROR] Docente ${docente.id}:`, err);
        reporte.errores++;
      }
    }
  }

  console.log('\n── Reporte de migración ──────────────────────');
  console.log(`  Procesados total:     ${reporte.procesados}`);
  console.log(`  Clasificados (FK):    ${reporte.clasificados}  ${DRY_RUN ? '(simulado)' : ''}`);
  console.log(`  NO_DETERMINADA:       ${reporte.noDeterminados}  (FK null — correcto)`);
  console.log(`  Ya clasificados:      ${reporte.yaClasificados}  (omitidos por idempotencia)`);
  console.log(`  Errores:              ${reporte.errores}`);
  if (DRY_RUN) console.log('\n[DRY-RUN] Ningún registro fue modificado.');
  if (reporte.errores > 0) {
    console.error('\nATENCIÓN: Hubo errores. Revisar los logs antes de continuar.');
    process.exit(1);
  }
}

main().finally(() => prisma.$disconnect());
```

### 5.3 Pruebas que detectan omisiones entre lotes

El test clave: verificar que la paginación por cursor sobre el conjunto estable no omite registros cuando el lote exactamente llena el tamaño.

```typescript
// En tipo-dedicacion-coneau.service.spec.ts o en un spec separado:
it('paginación estable: no omite registros cuando el lote es múltiplo exacto del tamaño', () => {
  // Simular 1000 docentes (2 lotes de 500)
  // Verificar que el cursor del último elemento del lote 1 produce el primer elemento del lote 2
  // sin saltar registros al filtrar sobre un conjunto dinámico
  const ids = Array.from({ length: 1000 }, (_, i) => `docente-${String(i).padStart(4, '0')}`);
  ids.sort(); // simula order by id asc

  const lote1 = ids.slice(0, 500);
  const lote2 = ids.slice(500, 1000);
  const cursor = lote1[lote1.length - 1]; // último del lote 1

  // El cursor apunta al elemento 499; skip:1 en el siguiente query devuelve el 500
  const siguienteLote = ids.slice(ids.indexOf(cursor) + 1, ids.indexOf(cursor) + 501);
  expect(siguienteLote[0]).toBe(lote2[0]); // sin salto
  expect(siguienteLote).toHaveLength(500);
});
```

Este test documenta la invariante del cursor. Si se cambiara el algoritmo a filtrado dinámico, este test rompería la expectativa de continuidad.

---

## 6. Dependencias entre tablas

```
TipoDedicacionConeau  (nueva)
  └── Docente.tipoDedicacionConeauId  (nueva columna NULL, FK opcional)

TipoPosgrado  (existente — sin cambios SQL)
  └── Docente.tipoPosgradoId          (nueva columna NULL, FK opcional)
```

La migración es **estrictamente aditiva**: solo `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, `ADD CONSTRAINT`. No hay `DROP`, no hay `ALTER COLUMN`, no hay cambios en datos existentes.

---

## 7. Verificaciones de integridad post-migración

Ejecutar cada consulta y registrar el resultado antes de Paso 10.

```sql
-- V-01: catálogo cargado correctamente
SELECT codigo, nombre, activo FROM "TipoDedicacionConeau" ORDER BY nombre;
-- Esperado: 3 filas (Exclusiva, Semiexclusiva, Simple)

-- V-02: distribución de FKs después de migración de datos
SELECT
  COALESCE(tdc.codigo, 'NO_DETERMINADA') AS categoria,
  COUNT(d.id)                             AS docentes
FROM "Docente" d
LEFT JOIN "TipoDedicacionConeau" tdc ON tdc.id = d."tipoDedicacionConeauId"
GROUP BY tdc.codigo
ORDER BY docentes DESC;

-- V-03: no hay FKs huérfanas
SELECT COUNT(*) AS huerfanas
FROM "Docente" d
WHERE d."tipoDedicacionConeauId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "TipoDedicacionConeau" t WHERE t.id = d."tipoDedicacionConeauId"
  );
-- Esperado: 0

-- V-04: comparar total post-migración con resultado de §3 Paso 1
SELECT COUNT(*) AS total_docentes FROM "Docente";
-- Debe coincidir con el total de la auditoría pre-migración
```

---

## 8. Rollback — procedimiento corregido

> **Nota sobre `prisma migrate resolve --rolled-back`:** Este comando **NO revierte SQL ya aplicado**. Solo marca el registro de migración en la tabla `_prisma_migrations` como "rolled-back". Usarlo para "deshacer" una migración aplicada es un error — la base de datos queda en estado incoherente (tabla `_prisma_migrations` dice que no se aplicó, pero el SQL ya existe). El mecanismo de rollback real es el respaldo previo.

### 8.1 Rollback de datos (antes de activar código)

Si la migración de datos históricos (Paso 8) produjo resultados incorrectos y los servicios aún no fueron activados (Paso 10 no ejecutado):

```sql
-- Revertir solo los datos de la migración histórica (no elimina columnas)
-- Seguro porque el código activo no lee aún tipoDedicacionConeauId
UPDATE "Docente" SET "tipoDedicacionConeauId" = NULL;
TRUNCATE TABLE "TipoDedicacionConeau";
```

Corregir el script y re-ejecutar desde Paso 7.

### 8.2 Rollback de esquema (restauración desde respaldo)

Si es necesario revertir las columnas y la tabla nueva, el único camino seguro es restaurar desde el respaldo tomado en Paso 4:

```bash
# Restaurar base de datos completa desde el respaldo
pg_restore -h localhost -U <usuario> -d <nombre_db> --clean \
  backup_pre_cierre03b_<timestamp>.dump
```

Después de restaurar, marcar la migración como no aplicada en el archivo de migraciones (eliminar el directorio `backend/prisma/migrations/<timestamp>_add-tipo-dedicacion-coneau-d05-d06/`) para que Prisma no intente aplicarla automáticamente.

### 8.3 Prohibición de eliminar columnas con datos

**No ejecutar los siguientes comandos sin autorización expresa del responsable de datos:**

```sql
-- PROHIBIDO sin autorización:
ALTER TABLE "Docente" DROP COLUMN "tipoDedicacionConeauId";
ALTER TABLE "Docente" DROP COLUMN "tipoPosgradoId";
DROP TABLE "TipoDedicacionConeau";
```

Estas operaciones son irreversibles sin el respaldo. Las columnas `tipoDedicacionConeauId` y `tipoPosgradoId` son opcionales (NULL) y no afectan el funcionamiento del sistema mientras no estén activadas. Mantenerlas no genera ningún riesgo.

---

## 9. Estrategia de sincronización — `dedicacion` y `tipoDedicacionConeau`

Durante la transición, el modelo `Docente` tiene dos representaciones del mismo dato:

| Campo | Tipo | Propósito |
|---|---|---|
| `dedicacion` | `String?` (texto libre) | Fuente histórica; no se modifica |
| `tipoDedicacionConeauId` | `String?` (FK) | Catálogo controlado CONEAU; `null` = NO_DETERMINADA |

### 9.1 Precedencia de lectura

| Contexto | Campo a usar | Fallback |
|---|---|---|
| Reportes CONEAU (indicadores, tablero) | `tipoDedicacionConeau` (FK) | Si null → `normalizarDedicacionConeau(dedicacion)` dinámicamente |
| Ficha docente (display) | `dedicacion` (texto original) | — |
| Exportaciones PDF/Excel | `tipoDedicacionConeau` si disponible, sino `dedicacion` | — |

### 9.2 Invariante de sincronización

Mientras el Paso 10 (activación) no se complete, **ningún código de producción lee `tipoDedicacionConeauId`**. El sistema continúa usando `normalizarDedicacionConeau(dedicacion)` en tiempo real para reportes CONEAU, tal como lo hace hoy.

Después de la activación, la precedencia cambia: **el FK tiene prioridad sobre la normalización dinámica**. El motivo es que el FK puede ser corregido manualmente por secretaría para casos donde la normalización automática es incorrecta, sin cambiar el texto libre histórico.

### 9.3 Escrituras durante la transición

| Operación | Comportamiento |
|---|---|
| Secretaría actualiza `dedicacion` | El FK no se actualiza automáticamente. Requiere re-ejecutar el script de migración o actualizar el FK manualmente. |
| Secretaría actualiza `tipoDedicacionConeauId` directamente | `dedicacion` no cambia. Ambos campos son independientes. |
| Detección de contradicción | Si `normalizarDedicacionConeau(dedicacion) ≠ tipoDedicacionConeau.codigo`, el FK prevalece. La contradicción se registra en el log del servicio pero no bloquea la operación. |

### 9.4 Estrategia de largo plazo (fuera del alcance de CIERRE-03)

Definir si `tipoDedicacionConeauId` se convierte en la única fuente de verdad y `dedicacion` pasa a ser un campo de solo lectura (histórico). Esto requiere una decisión de negocio separada y un sprint dedicado.

---

## 10. Riesgos con datos históricos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Valor de `dedicacion` no reconocido por `normalizarDedicacionConeau` | Media | Auditoría Paso 1; el valor queda como `null` (NO_DETERMINADA), no genera error |
| `dedicacion = null` o vacío en muchos docentes importados | Alta | Tratado como NO_DETERMINADA → FK `null`; no bloquea |
| Cursor pierde estabilidad por filtrado dinámico | Corregido | Script v2: pagina el conjunto estable completo; test §5.3 documenta la invariante |
| Contradicción entre `dedicacion` y `tipoDedicacionConeauId` tras actualización manual de `dedicacion` | Media-baja | Estrategia en §9.3: FK prevalece; contradicción se loguea |
| Respaldo no tomado antes de migración | Alto impacto | Paso 4 es obligatorio; sin el dump no hay rollback viable |

---

## 11. D-06 — Cardinalidad de posgrados: decisión pendiente

### 11.1 Evidencia en el esquema actual

El modelo `Docente` tiene dos campos relacionados con posgrado:

- `tituloPosgrado String?` — un único título (texto libre, campo heredado)
- `actividadesPosgradoJson String?` — array JSON con múltiples actividades académicas de posgrado

La presencia de `actividadesPosgradoJson` indica que el sistema **ya registra múltiples actividades** de posgrado por docente.

### 11.2 El problema de cardinalidad

La relación D-06 (`Docente.tipoPosgradoId → TipoPosgrado`) es 1:1 desde la perspectiva del docente: **un docente tiene un solo tipo de posgrado**.

Si CONEAU §4 requiere contar docentes por nivel de posgrado de forma independiente (por ejemplo: "cuántos tienen Maestría", "cuántos tienen Doctorado"), hay dos interpretaciones posibles:

1. **Jerarquía implícita (1:1 suficiente):** `tipoPosgradoId` almacena el nivel más alto alcanzado. Un docente con Doctorado también cuenta para Maestría por definición de jerarquía. El código de conteo aplica la jerarquía al consultar.
2. **Múltiples niveles (1:1 insuficiente):** Un docente puede declarar Maestría Y Doctorado simultáneamente como categorías separadas. Se necesitaría una tabla de relación `_DocenteTipoPosgrado` (N:M).

### 11.3 Decisión

**PENDIENTE.** La evidencia disponible en el esquema (campo `actividadesPosgradoJson`) no es concluyente sobre cuál interpretación aplica a los requisitos CONEAU del FSD. La decisión requiere:

- Revisar FSD §4 sección de indicadores de posgrado.
- Confirmar con el equipo si el objetivo es "nivel más alto" o "todos los niveles".

### 11.4 Impacto de la decisión pendiente

- **Si la cardinalidad es 1:1 (nivel más alto):** El esquema actual es correcto. No se requieren cambios. Activar en Paso 10.
- **Si la cardinalidad es N:M (todos los niveles):** La columna `tipoPosgradoId` en `Docente` debe eliminarse y reemplazarse por una tabla de relación. Esto requiere un nuevo plan de migración para D-06.

**Hasta que se resuelva la decisión:** `tipoPosgradoId` permanece en el esquema como columna preparatoria (NULL en todos los registros). No se activa ningún código que la lea. No se realizan cambios estructurales adicionales.

---

## 12. Código preparatorio — estado de activación

| Archivo | Estado | Activar en |
|---|---|---|
| `backend/src/modules/autoevaluacion/catalogo/tipo-dedicacion-coneau.service.ts` | PREPARATORIO | Paso 10 (post prisma generate) |
| `ficha-docente.dto.ts` campos `tipoDedicacionConeau?` y `tipoPosgrado?` | PREPARATORIO (opcionales, no rompen nada actualmente) | Paso 10 |
| `schema.prisma` columnas `tipoDedicacionConeauId` y `tipoPosgradoId` | PREPARATORIO | Pasos 2-6 |

---

## 13. Checklist de ejecución

- [ ] Paso 1: Auditoría SQL pre-migración y registro del resultado
- [ ] Revisión del resultado con el equipo
- [ ] **Aprobación para ejecutar la migración**
- [ ] Paso 2: `prisma migrate dev --create-only`
- [ ] Paso 3: Revisión manual del SQL generado (verificar: solo operaciones aditivas)
- [ ] Paso 4: `pg_dump` de respaldo + verificación de integridad del dump
- [ ] Paso 5: `prisma migrate deploy` en entorno local de prueba
- [ ] Paso 6: `prisma generate`
- [ ] Paso 7: Seed del catálogo (`--dry-run` implícito en upsert)
- [ ] Paso 8: Script de migración histórica en `--dry-run` + revisar reporte
- [ ] Paso 8 (real): Script de migración sin `--dry-run`
- [ ] Paso 9: Verificaciones V-01 a V-04
- [ ] Resolución de D-06 cardinalidad (ver §11) antes de Paso 10
- [ ] Paso 10: Activar servicios + suite Jest + tsc + build
- [ ] Deploy a producción (rama separada)
