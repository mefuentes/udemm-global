/**
 * Detecta si el puerto del backend está en uso (LISTENING).
 * Si lo está, finaliza ÚNICAMENTE ese PID — nunca taskkill /IM node.exe.
 * Verifica que el puerto quede libre antes de continuar.
 *
 * Uso:
 *   - Automático: se ejecuta como prestart:dev antes de iniciar NestJS
 *   - Manual:     npm run port:free
 */

'use strict';

const { execSync } = require('child_process');
const net  = require('net');
const fs   = require('fs');
const path = require('path');

// ── Leer puerto desde .env ─────────────────────────────────────────────────

function leerPuerto() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const contenido = fs.readFileSync(envPath, 'utf8');
    const match = contenido.match(/^BACKEND_PORT\s*=\s*(\d+)/m);
    if (match) return parseInt(match[1], 10);
  } catch {}
  return 5000;
}

// ── Encontrar PID en estado LISTENING para el puerto exacto ───────────────
//
// Patrón `:PUERTO\s` evita falsos positivos como `:50001`
// porque en la salida de netstat el puerto siempre va seguido
// de espacios o fin de campo antes del estado.

function encontrarPid(puerto) {
  let salida;
  try {
    salida = execSync('netstat -ano', { encoding: 'utf8', timeout: 10000 });
  } catch (e) {
    console.error(`[port] No se pudo ejecutar netstat: ${e.message}`);
    return null;
  }

  const patron = new RegExp(`:${puerto}\\s`);
  const lineas = salida.split('\n').filter(linea => {
    const t = linea.trim();
    return t.includes('LISTENING') && patron.test(t);
  });

  if (lineas.length === 0) return null;

  const pids = [...new Set(
    lineas
      .map(linea => {
        const partes = linea.trim().split(/\s+/);
        return partes[partes.length - 1];
      })
      .filter(pid => /^\d+$/.test(pid) && pid !== '0'),
  )];

  return pids.length > 0 ? pids[0] : null;
}

// ── Verificar si el puerto está libre intentando hacer listen ─────────────

function puertoEstaLibre(puerto) {
  return new Promise(resolve => {
    const servidor = net.createServer();
    servidor.once('error', () => resolve(false));
    servidor.once('listening', () => servidor.close(() => resolve(true)));
    servidor.listen(puerto, '0.0.0.0');
  });
}

async function esperarPuertoLibre(puerto, intentos, delayMs) {
  for (let i = 0; i < intentos; i++) {
    if (await puertoEstaLibre(puerto)) return true;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const puerto = leerPuerto();
  console.log('\n[port] Comprobando puerto ' + puerto + '...');

  const pid = encontrarPid(puerto);

  if (!pid) {
    console.log('[port] Puerto ' + puerto + ' libre.\n');
    process.exit(0);
  }

  console.log('[port] Instancia anterior detectada (PID ' + pid + '). Liberando puerto ' + puerto + '...');

  try {
    // /F = forzar; stdout e stderr capturados para no ensuciar la consola
    execSync('taskkill /PID ' + pid + ' /F', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: 'pipe',
    });
    console.log('[port] PID ' + pid + ' finalizado.');
  } catch (e) {
    const msg = (e.stderr || e.message || '').toString().trim();
    console.error('[port] No se pudo finalizar PID ' + pid + ': ' + msg);
    console.error('[port] Intentá manualmente: taskkill /PID ' + pid + ' /F\n');
    process.exit(1);
  }

  console.log('[port] Verificando que el puerto ' + puerto + ' quedó libre...');

  // Hasta 10 intentos con 300 ms de espera entre ellos (3 segundos máx.)
  const libre = await esperarPuertoLibre(puerto, 10, 300);

  if (libre) {
    console.log('[port] Puerto ' + puerto + ' disponible. Iniciando backend...\n');
    process.exit(0);
  } else {
    console.error('[port] El puerto ' + puerto + ' sigue ocupado después de finalizar PID ' + pid + '.');
    console.error('[port] Verificá con: netstat -ano | findstr :' + puerto + '\n');
    process.exit(1);
  }
}

main().catch(function(e) {
  console.error('[port] Error inesperado: ' + e.message);
  process.exit(1);
});
