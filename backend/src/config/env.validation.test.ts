/**
 * Pruebas de la validación centralizada de variables de entorno.
 * Fase S1 — Seguridad.
 *
 * Ejecutar con:
 *   cd backend
 *   npx ts-node --transpile-only src/config/env.validation.test.ts
 */

import { validateEnv } from './env.validation';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SECRETO_VALIDO = 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEF'; // 42 chars
const DB_URL_VALIDA  = 'postgresql://usuario:contrasena@localhost:5432/udemm_global';

let pasados = 0;
let fallados = 0;

function ejecutarCaso(nombre: string, input: Record<string, unknown>, deberiaAprobar: boolean): void {
  try {
    validateEnv(input);
    if (deberiaAprobar) {
      console.log(`  ✓ ${nombre}`);
      pasados++;
    } else {
      console.error(`  ✗ ${nombre}`);
      console.error('    → FALLO: se esperaba rechazo pero la validación pasó');
      fallados++;
    }
  } catch (err) {
    const mensaje = (err as Error).message;
    if (!deberiaAprobar) {
      // Mostrar solo la primera línea del error relevante, sin revelar secretos
      const primeraLinea = mensaje.split('\n').find(l => l.trim().startsWith('-')) ?? 'Rechazado.';
      console.log(`  ✓ ${nombre}`);
      console.log(`    → Rechazado correctamente: ${primeraLinea.trim()}`);
      pasados++;
    } else {
      console.error(`  ✗ ${nombre}`);
      console.error(`    → FALLO: se esperaba éxito pero fue rechazado.`);
      fallados++;
    }
  }
}

// ── Casos de prueba ───────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log('  UDEMM Global — Tests de validación de entorno (S1)');
console.log('══════════════════════════════════════════════════════\n');

console.log('▸ Grupo 1: JWT_SECRET\n');

ejecutarCaso(
  'CASO 1: JWT_SECRET válido + variables obligatorias → debe pasar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: SECRETO_VALIDO, NODE_ENV: 'development' },
  true,
);

ejecutarCaso(
  'CASO 2: JWT_SECRET inexistente → debe rechazar',
  { DATABASE_URL: DB_URL_VALIDA },
  false,
);

ejecutarCaso(
  'CASO 3: JWT_SECRET vacío → debe rechazar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: '' },
  false,
);

ejecutarCaso(
  'CASO 4: JWT_SECRET inseguro conocido ("supersecretjwtkey") → debe rechazar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: 'supersecretjwtkey' },
  false,
);

ejecutarCaso(
  'CASO 4b: JWT_SECRET inseguro conocido ("secret") → debe rechazar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: 'secret' },
  false,
);

ejecutarCaso(
  'CASO 4c: JWT_SECRET con 31 caracteres (por debajo del mínimo) → debe rechazar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: 'a'.repeat(31) },
  false,
);

ejecutarCaso(
  'CASO 4d: JWT_SECRET con exactamente 32 caracteres (mínimo) → debe pasar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: 'a'.repeat(32) },
  true,
);

console.log('\n▸ Grupo 2: DATABASE_URL\n');

ejecutarCaso(
  'CASO 5: DATABASE_URL inexistente → debe rechazar',
  { JWT_SECRET: SECRETO_VALIDO },
  false,
);

ejecutarCaso(
  'CASO 5b: DATABASE_URL vacío → debe rechazar',
  { DATABASE_URL: '', JWT_SECRET: SECRETO_VALIDO },
  false,
);

ejecutarCaso(
  'CASO 5c: DATABASE_URL con formato inválido (MySQL) → debe rechazar',
  { DATABASE_URL: 'mysql://user:pass@localhost:3306/db', JWT_SECRET: SECRETO_VALIDO },
  false,
);

ejecutarCaso(
  'CASO 5d: DATABASE_URL con prefijo postgres:// → debe pasar',
  { DATABASE_URL: 'postgres://user:pass@localhost:5432/db', JWT_SECRET: SECRETO_VALIDO },
  true,
);

console.log('\n▸ Grupo 3: NODE_ENV\n');

ejecutarCaso(
  'CASO 6: NODE_ENV inválido → debe rechazar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: SECRETO_VALIDO, NODE_ENV: 'produccion' },
  false,
);

ejecutarCaso(
  'CASO 6b: NODE_ENV="production" (válido) → debe pasar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: SECRETO_VALIDO, NODE_ENV: 'production' },
  true,
);

ejecutarCaso(
  'CASO 6c: NODE_ENV="test" (válido) → debe pasar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: SECRETO_VALIDO, NODE_ENV: 'test' },
  true,
);

ejecutarCaso(
  'CASO 6d: NODE_ENV ausente (opcional) → debe pasar',
  { DATABASE_URL: DB_URL_VALIDA, JWT_SECRET: SECRETO_VALIDO },
  true,
);

console.log('\n▸ Grupo 4: Errores múltiples\n');

ejecutarCaso(
  'CASO 7: Múltiples problemas simultáneos → debe rechazar',
  { DATABASE_URL: 'http://mal-formato', JWT_SECRET: 'secret' },
  false,
);

// ── Resultado final ───────────────────────────────────────────────────────────

const total = pasados + fallados;
console.log(`\n${'─'.repeat(54)}`);
console.log(`Resultado: ${pasados} pasaron / ${fallados} fallaron / ${total} total`);
console.log('─'.repeat(54));

if (fallados > 0) {
  console.error('\n⚠ Hay pruebas fallidas. Revisar la implementación.\n');
  process.exit(1);
} else {
  console.log('\n✓ Todas las pruebas de validación de entorno pasaron.\n');
}
