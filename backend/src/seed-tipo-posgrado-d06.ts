// Seed idempotente — TipoPosgrado (D-06, CIERRE-03 Fase B)
// Uso: npx ts-node -e "require('./src/seed-tipo-posgrado-d06')" desde /backend
// Precondición: tabla TipoPosgrado ya existe en la base de datos.
// Idempotente: upsert por nombre — seguro ejecutar múltiples veces.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = [
    { nombre: 'DOCTORADO'       },
    { nombre: 'MAESTRIA'        },
    { nombre: 'ESPECIALIZACION' },
  ];

  for (const item of items) {
    const result = await prisma.tipoPosgrado.upsert({
      where:  { nombre: item.nombre },
      update: { activo: true },
      create: { ...item, activo: true },
    });
    console.log(`OK  ${result.nombre} — id: ${result.id}`);
  }

  const count = await prisma.tipoPosgrado.count();
  console.log(`\nTotal en catálogo: ${count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
