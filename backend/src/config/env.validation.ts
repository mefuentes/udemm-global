/**
 * Validación centralizada de variables de entorno.
 * Se ejecuta al inicio del proceso — antes de que arranque cualquier módulo.
 * Principio: FAIL SECURE / FAIL FAST.
 *
 * Si falta una variable crítica o tiene un valor inseguro conocido,
 * el backend lanza una excepción que impide el arranque.
 */

const SECRETOS_INSEGUROS_CONOCIDOS = new Set([
  'supersecretjwtkey',
  'secret',
  'changeme',
  'jwt_secret',
  'jwt-secret',
  'mysecret',
  'your_jwt_secret',
  'your-secret-key',
  'secretkey',
  'password',
  'reemplazar_con_secreto_minimo_32_caracteres',
  '12345678901234567890123456789012',
]);

const JWT_SECRET_MIN_LONGITUD = 32;

const NODE_ENV_PERMITIDOS = ['development', 'production', 'test'];

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errores: string[] = [];

  // ── DATABASE_URL ────────────────────────────────────────────────────────────
  const dbUrl = config['DATABASE_URL'];
  if (!dbUrl || typeof dbUrl !== 'string' || dbUrl.trim() === '') {
    errores.push('DATABASE_URL: variable obligatoria no definida.');
  } else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    errores.push('DATABASE_URL: formato inválido (debe comenzar con postgresql:// o postgres://).');
  }

  // ── JWT_SECRET ──────────────────────────────────────────────────────────────
  const jwtSecret = config['JWT_SECRET'];
  if (jwtSecret === undefined || jwtSecret === null) {
    errores.push('JWT_SECRET: variable obligatoria no definida.');
  } else if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    errores.push('JWT_SECRET: no puede estar vacío.');
  } else if (SECRETOS_INSEGUROS_CONOCIDOS.has(jwtSecret.toLowerCase().trim())) {
    errores.push(
      'JWT_SECRET: valor inseguro o conocido detectado. ' +
      'Generar con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  } else if (jwtSecret.trim().length < JWT_SECRET_MIN_LONGITUD) {
    errores.push(
      `JWT_SECRET: longitud insuficiente (${jwtSecret.trim().length} caracteres). ` +
      `Mínimo requerido: ${JWT_SECRET_MIN_LONGITUD} caracteres.`
    );
  }

  // ── NODE_ENV ────────────────────────────────────────────────────────────────
  const nodeEnv = config['NODE_ENV'];
  if (nodeEnv !== undefined && nodeEnv !== null && String(nodeEnv).trim() !== '') {
    if (!NODE_ENV_PERMITIDOS.includes(String(nodeEnv).trim())) {
      errores.push(
        `NODE_ENV: valor '${nodeEnv}' no permitido. ` +
        `Valores válidos: ${NODE_ENV_PERMITIDOS.join(', ')}.`
      );
    }
  }

  // ── FRONTEND_URL ─────────────────────────────────────────────────────────────
  // Obligatoria — usada en la configuración de CORS y en emails de recuperación.
  const frontendUrl = config['FRONTEND_URL'];
  if (!frontendUrl || typeof frontendUrl !== 'string' || frontendUrl.trim() === '') {
    errores.push('FRONTEND_URL: variable obligatoria no definida.');
  } else {
    try {
      const parsed = new URL(frontendUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errores.push('FRONTEND_URL: debe comenzar con http:// o https://.');
      }
    } catch {
      errores.push('FRONTEND_URL: formato de URL inválido (ej: http://localhost:3000).');
    }
  }

  // ── STORAGE_NORMATIVAS_PATH ──────────────────────────────────────────────────
  // Opcional — si está definida debe ser una ruta absoluta.
  const storageNormativas = config['STORAGE_NORMATIVAS_PATH'];
  if (storageNormativas !== undefined && storageNormativas !== null && String(storageNormativas).trim() !== '') {
    const p = String(storageNormativas).trim();
    const esAbsoluta = p.startsWith('/') || /^[A-Za-z]:[/\\]/.test(p);
    if (!esAbsoluta) {
      errores.push('STORAGE_NORMATIVAS_PATH: debe ser una ruta absoluta.');
    }
  }

  // ── Fallo seguro ────────────────────────────────────────────────────────────
  if (errores.length > 0) {
    const detalle = errores.map(e => `  - ${e}`).join('\n');
    throw new Error(
      '\n' +
      '╔══════════════════════════════════════════════════════════════╗\n' +
      '║  UDEMM Global — Error de configuración de seguridad         ║\n' +
      '║  El backend NO puede arrancar con la configuración actual.  ║\n' +
      '╚══════════════════════════════════════════════════════════════╝\n' +
      '\nProblemas detectados:\n' + detalle + '\n' +
      '\nRevise el archivo backend/.env y las variables de entorno del sistema.\n' +
      'Consulte docs/seguridad/FASE-S1-SEGURIDAD.md para la guía de configuración.\n'
    );
  }

  return config;
}
