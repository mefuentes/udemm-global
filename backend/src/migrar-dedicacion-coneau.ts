// Migración histórica D-05: asigna tipoDedicacionConeauId a docentes existentes
// Uso:
//   npx ts-node --project tsconfig.json src/migrar-dedicacion-coneau.ts --dry-run
//   npx ts-node --project tsconfig.json src/migrar-dedicacion-coneau.ts
// Eliminar después de la migración exitosa.

import { PrismaClient } from '@prisma/client';
import { normalizarDedicacionConeau } from './modules/autoevaluacion/tablero/normalizar-dedicacion';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const LOTE = 500;

interface Reporte {
  procesados: number;
  clasificados: number;
  noDeterminados: number;
  yaClasificados: number;
  errores: number;
  detalle: { codigo: string; cantidad: number }[];
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log('[DRY-RUN] No se modificará ningún registro.\n');

  const tipos = await prisma.tipoDedicacionConeau.findMany({
    select: { id: true, codigo: true },
  });
  if (tipos.length === 0) {
    throw new Error('Catálogo TipoDedicacionConeau vacío. Ejecutar seed primero.');
  }
  const mapa = new Map<string, string>(tipos.map((t) => [t.codigo, t.id]));
  console.log(`Catálogo: ${tipos.map((t) => t.codigo).join(', ')}\n`);

  const reporte: Reporte = {
    procesados: 0, clasificados: 0, noDeterminados: 0, yaClasificados: 0, errores: 0,
    detalle: tipos.map((t) => ({ codigo: t.codigo, cantidad: 0 })),
  };

  let cursor: string | undefined;
  let hayMas = true;

  while (hayMas) {
    const lote = await prisma.docente.findMany({
      take: LOTE,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, dedicacion: true, tipoDedicacionConeauId: true },
    });

    if (lote.length === 0) break;
    hayMas = lote.length === LOTE;
    cursor = lote[lote.length - 1].id;

    for (const docente of lote) {
      reporte.procesados++;

      if (docente.tipoDedicacionConeauId !== null) {
        reporte.yaClasificados++;
        continue;
      }

      try {
        const categoria = normalizarDedicacionConeau(docente.dedicacion);

        if (categoria === 'NO_DETERMINADA') {
          reporte.noDeterminados++;
          continue;
        }

        const tipoId = mapa.get(categoria);
        if (!tipoId) {
          console.error(`[ERROR] Código '${categoria}' no encontrado en catálogo. Docente: ${docente.id}`);
          reporte.errores++;
          continue;
        }

        if (!DRY_RUN) {
          // select explícito para evitar SELECT * implícito que incluye tipoPosgradoId
          // (columna en schema.prisma pero aún no en la BD — D-06 pendiente de migración)
          await prisma.docente.update({
            where:  { id: docente.id },
            data:   { tipoDedicacionConeauId: tipoId },
            select: { id: true },
          });
        }
        reporte.clasificados++;
        const entrada = reporte.detalle.find((d) => d.codigo === categoria);
        if (entrada) entrada.cantidad++;

      } catch (err) {
        console.error(`[ERROR] Docente ${docente.id}:`, err);
        reporte.errores++;
      }
    }
  }

  console.log('\n── Reporte ──────────────────────────────────────');
  console.log(`  Procesados total:     ${reporte.procesados}`);
  console.log(`  Clasificados con FK:  ${reporte.clasificados}${DRY_RUN ? ' (simulado)' : ''}`);
  for (const d of reporte.detalle) {
    if (d.cantidad > 0) console.log(`    ${d.codigo}: ${d.cantidad}`);
  }
  console.log(`  NO_DETERMINADA:       ${reporte.noDeterminados} (FK null — correcto)`);
  console.log(`  Ya clasificados:      ${reporte.yaClasificados} (omitidos)`);
  console.log(`  Errores:              ${reporte.errores}`);
  if (DRY_RUN) console.log('\n[DRY-RUN] Ningún registro fue modificado.');
  if (reporte.errores > 0) { console.error('\nATENCIÓN: hay errores.'); process.exit(1); }
}

main().finally(() => prisma.$disconnect());
