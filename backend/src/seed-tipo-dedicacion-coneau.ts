// Seed idempotente — TipoDedicacionConeau (CIERRE-03 Fase B D-05)
// Uso: npx ts-node -e "require('./src/seed-tipo-dedicacion-coneau')" desde /backend
// Eliminar este archivo después del seed (es un script de una sola ejecución).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = [
    { nombre: 'Exclusiva',     codigo: 'EXCLUSIVA'     },
    { nombre: 'Semiexclusiva', codigo: 'SEMIEXCLUSIVA' },
    { nombre: 'Simple',        codigo: 'SIMPLE'        },
  ];

  for (const item of items) {
    const result = await prisma.tipoDedicacionConeau.upsert({
      where:  { codigo: item.codigo },
      update: { nombre: item.nombre, activo: true },
      create: { ...item, activo: true },
    });
    console.log(`OK  ${result.codigo} — id: ${result.id}`);
  }

  const count = await prisma.tipoDedicacionConeau.count();
  console.log(`\nTotal en catálogo: ${count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
