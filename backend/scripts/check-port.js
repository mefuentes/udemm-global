/**
 * Verifica si el puerto configurado está disponible antes de iniciar NestJS.
 * Sale con código 0 si el puerto está libre; con código 1 y mensaje claro si está ocupado.
 * No requiere dependencias externas — usa únicamente módulos nativos de Node.js.
 */

'use strict';

const net  = require('net');
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

const servidor = net.createServer();

servidor.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`ERROR: EL PUERTO ${puerto} YA ESTÁ EN USO. ES POSIBLE QUE EL BACKEND DE UDEMM GLOBAL YA ESTÉ EJECUTÁNDOSE.`);
    console.error('');
    console.error(`  → Ver proceso: netstat -ano | findstr :${puerto}`);
    console.error(`  → Liberar:     npm run port:free`);
    console.error('');
    process.exit(1);
  } else {
    console.error(`Error inesperado al verificar el puerto ${puerto}: ${err.message}`);
    process.exit(1);
  }
});

servidor.once('listening', () => {
  servidor.close(() => {
    // Puerto libre — continúa el script encadenado (start:dev)
    process.exit(0);
  });
});

servidor.listen(puerto, '0.0.0.0');
