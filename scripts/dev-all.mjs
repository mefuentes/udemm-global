/**
 * Inicia backend y frontend simultáneamente:
 *   - Backend: nueva ventana PowerShell (puerto 5000)
 *   - Frontend: terminal actual (puerto 3000)
 */
import { spawn, execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root     = join(dirname(fileURLToPath(import.meta.url)), '..');
const killPort = join(root, 'scripts', 'kill-port.mjs');
const backDir  = join(root, 'backend');
const frontDir = join(root, 'frontend');

console.log('\n=== UDEMM Global — Entorno de desarrollo ===\n');

// 1. Liberar puertos
console.log('Liberando puertos 5000 y 3000...');
try {
  execSync(`node "${killPort}" 5000 3000`, { stdio: 'inherit' });
} catch { /* ya libres */ }

// 2. Backend en nueva ventana PowerShell
console.log('\nAbriendo backend en nueva ventana (puerto 5000)...');
spawn('powershell.exe', [
  '-NoExit', '-NoLogo', '-NoProfile',
  '-Command',
  `$host.UI.RawUI.WindowTitle = 'UDEMM Backend :5000'; cd '${backDir}'; npm run start:dev`,
], { detached: true, stdio: 'ignore' }).unref();

// 3. Frontend en el terminal actual
console.log('Iniciando frontend en este terminal (puerto 3000)...\n');

const frontend = spawn('npm', ['run', 'dev'], {
  cwd: frontDir,
  stdio: 'inherit',
  shell: true,
});

frontend.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => { frontend.kill('SIGINT'); });
