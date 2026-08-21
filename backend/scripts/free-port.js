/**
 * Libera el puerto del backend finalizando el proceso que lo ocupa.
 * Acción EXPLÍCITA del desarrollador — no se ejecuta automáticamente.
 * Compatible con Windows/PowerShell. Usa netstat y taskkill (herramientas nativas de Windows).
 */

'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

function leerPuerto() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const contenido = fs.readFileSync(envPath, 'utf8');
    const match = contenido.match(/^BACKEND_PORT\s*=\s*(\d+)/m);
    if (match) return parseInt(match[1], 10);
  } catch {}
  return 5000;
}

const puerto = leerPuerto();

console.log(`\nBuscando proceso en el puerto ${puerto}...`);

let salidaNetstat;
try {
  salidaNetstat = execSync('netstat -ano', { encoding: 'utf8' });
} catch (e) {
  console.error(`No se pudo ejecutar netstat: ${e.message}`);
  process.exit(1);
}

// Filtra líneas en LISTENING para el puerto exacto.
// El patrón `:PUERTO\s` evita falsos positivos como :50001 o :50002
// (en netstat el puerto siempre va seguido de espacios entre columnas).
const lineas = salidaNetstat
  .split('\n')
  .filter(linea => {
    const t = linea.trim();
    return t.includes('LISTENING') && new RegExp(`:${puerto}\\s`).test(t);
  });

if (lineas.length === 0) {
  console.log(`El puerto ${puerto} no está en uso. No hay nada que liberar.\n`);
  process.exit(0);
}

// Extrae PIDs únicos (última columna de cada línea)
const pids = [...new Set(
  lineas
    .map(linea => {
      const partes = linea.trim().split(/\s+/);
      return partes[partes.length - 1];
    })
    .filter(pid => /^\d+$/.test(pid) && pid !== '0'),
)];

if (pids.length === 0) {
  console.error(`Se encontraron líneas pero no se pudo extraer un PID válido. Intentá manualmente:\n  netstat -ano | findstr :${puerto}\n`);
  process.exit(1);
}

let liberado = false;
for (const pid of pids) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
    console.log(`Proceso PID ${pid} finalizado — puerto ${puerto} liberado.\n`);
    liberado = true;
  } catch (e) {
    console.error(`No se pudo finalizar el proceso PID ${pid}. Puede requerir permisos de administrador.`);
    console.error(`Intentá manualmente: taskkill /PID ${pid} /F\n`);
  }
}

process.exit(liberado ? 0 : 1);
