// Clasificación histórica de docentes — D-06 (CIERRE-03 Fase B)
//
// Lee tituloPosgrado (JSON array) de cada docente y determina el nivel
// máximo de posgrado CONEAU. Por defecto opera en DRY-RUN (sin escrituras).
//
// Uso:
//   npx ts-node src/clasificar-docentes-d06.ts              → dry-run (seguro)
//   DRY_RUN=false npx ts-node src/clasificar-docentes-d06.ts → aplica cambios
//
// Precondición: migración D06_tipo_posgrado.sql ya aplicada.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== 'false';

// Jerarquía descendente: DOCTORADO > MAESTRIA > ESPECIALIZACION
const JERARQUIA = ['DOCTORADO', 'MAESTRIA', 'ESPECIALIZACION'] as const;
type NivelPosgrado = typeof JERARQUIA[number];

interface PosgradoEntry {
  tipo?: string;
  tipoId?: string;
  denominacion?: string;
}

function extraerNivelMaximo(tituloPosgradoJson: string | null): {
  nivel: NivelPosgrado | null;
  tipoId: string | null;
  ambiguo: boolean;
  razon: string;
} {
  if (!tituloPosgradoJson) {
    return { nivel: null, tipoId: null, ambiguo: false, razon: 'tituloPosgrado es null → indeterminado' };
  }

  let entries: PosgradoEntry[];
  try {
    const parsed = JSON.parse(tituloPosgradoJson);
    entries = Array.isArray(parsed) ? parsed : [];
  } catch {
    return { nivel: null, tipoId: null, ambiguo: true, razon: 'tituloPosgrado no es JSON válido' };
  }

  if (entries.length === 0) {
    return { nivel: null, tipoId: null, ambiguo: false, razon: 'array vacío → indeterminado (no confirma SIN_POSGRADO)' };
  }

  let nivelMax: NivelPosgrado | null = null;
  let tipoIdMax: string | null = null;
  let tieneAmbiguos = false;

  for (const entry of entries) {
    const tipo = (entry.tipo ?? '').trim().toUpperCase();
    const tipoId = (entry.tipoId ?? '').trim();

    if (JERARQUIA.includes(tipo as NivelPosgrado)) {
      const nivel = tipo as NivelPosgrado;
      const jerarqPos = JERARQUIA.indexOf(nivel);
      const maxPos = nivelMax ? JERARQUIA.indexOf(nivelMax) : Infinity;

      if (jerarqPos < maxPos) {
        nivelMax = nivel;
        tipoIdMax = tipoId || null;
      }
    } else if (tipo !== '') {
      tieneAmbiguos = true;
    }
  }

  if (nivelMax) {
    return {
      nivel: nivelMax,
      tipoId: tipoIdMax,
      ambiguo: tieneAmbiguos,
      razon: tieneAmbiguos ? `nivel=${nivelMax} (hay entradas con tipo no reconocido)` : `nivel=${nivelMax}`,
    };
  }

  return {
    nivel: null,
    tipoId: null,
    ambiguo: tieneAmbiguos,
    razon: tieneAmbiguos
      ? 'tipos no reconocidos, no se puede determinar nivel'
      : 'ninguna entrada coincide con catálogo → indeterminado',
  };
}

async function main() {
  console.log(`\nClasificación D-06 — TipoPosgrado`);
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sin cambios en BD)' : '⚠  REAL (escribirá en BD)'}\n`);

  // Cargar catálogo TipoPosgrado
  const catalogo = await prisma.tipoPosgrado.findMany({
    select: { id: true, nombre: true },
  });
  const catalogoPorNombre = new Map(catalogo.map(c => [c.nombre, c.id]));
  console.log(`Catálogo cargado: ${catalogo.map(c => c.nombre).join(', ')}\n`);

  // Cargar docentes con tituloPosgrado
  const docentes = await prisma.docente.findMany({
    select: { id: true, nombre: true, apellido: true, tituloPosgrado: true, tipoPosgradoId: true },
  });

  let clasificados = 0;
  let yaClasificados = 0;
  let indeterminados = 0;
  let ambiguos = 0;
  const registroAmbiguos: string[] = [];

  for (const doc of docentes) {
    const { nivel, tipoId, ambiguo, razon } = extraerNivelMaximo(doc.tituloPosgrado);

    let tipoPosgradoIdFinal: string | null = null;

    if (nivel) {
      // Resolver ID: usar tipoId si válido, sino buscar por nombre
      if (tipoId && catalogoPorNombre.has(nivel)) {
        tipoPosgradoIdFinal = catalogoPorNombre.get(nivel)!;
      } else if (catalogoPorNombre.has(nivel)) {
        tipoPosgradoIdFinal = catalogoPorNombre.get(nivel)!;
      }
    }

    if (ambiguo) {
      ambiguos++;
      registroAmbiguos.push(`  [AMBIGUO] ${doc.apellido}, ${doc.nombre} (${doc.id}): ${razon}`);
    }

    if (tipoPosgradoIdFinal) {
      if (doc.tipoPosgradoId === tipoPosgradoIdFinal) {
        yaClasificados++;
        continue;
      }
      clasificados++;
      console.log(`  CLASIFICAR: ${doc.apellido}, ${doc.nombre} → ${nivel} (id: ${tipoPosgradoIdFinal})`);
      if (!DRY_RUN) {
        await prisma.docente.update({
          where: { id: doc.id },
          data: { tipoPosgradoId: tipoPosgradoIdFinal },
        });
      }
    } else {
      indeterminados++;
      if (doc.tituloPosgrado !== null) {
        console.log(`  INDETERMINADO: ${doc.apellido}, ${doc.nombre} — ${razon}`);
      }
    }
  }

  console.log(`\n── Resumen ──`);
  console.log(`Total docentes:     ${docentes.length}`);
  console.log(`Ya clasificados:    ${yaClasificados}`);
  console.log(`A clasificar:       ${clasificados}`);
  console.log(`Indeterminados:     ${indeterminados}`);
  console.log(`Casos ambiguos:     ${ambiguos}`);
  if (registroAmbiguos.length > 0) {
    console.log(`\nCasos ambiguos (requieren revisión manual):`);
    registroAmbiguos.forEach(r => console.log(r));
  }
  if (DRY_RUN && clasificados > 0) {
    console.log(`\nEjecutar con DRY_RUN=false para aplicar los ${clasificados} cambios.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
