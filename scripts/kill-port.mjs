/**
 * Libera los puertos indicados en Windows usando netstat + taskkill.
 * Uso: node scripts/kill-port.mjs 5000 3000
 */
import { execSync } from 'child_process';

const ports = process.argv.slice(2).map(Number).filter(Boolean);

if (ports.length === 0) {
  console.log('Uso: node scripts/kill-port.mjs <puerto> [puerto...]');
  process.exit(0);
}

function getPidsOnPort(port) {
  try {
    const out = execSync('netstat -ano', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of out.split('\n')) {
      // Formato: "  TCP    0.0.0.0:5000    0.0.0.0:0    LISTENING    12345"
      const match = line.match(/^\s+(?:TCP|UDP)\s+\S+:(\d+)\s+\S+\s+\S+\s+(\d+)/i);
      if (match && parseInt(match[1]) === port) {
        const pid = parseInt(match[2]);
        if (pid > 0) pids.add(pid);
      }
    }
    return pids;
  } catch {
    return new Set();
  }
}

for (const port of ports) {
  const pids = getPidsOnPort(port);

  if (pids.size === 0) {
    console.log(`  Puerto ${port}: libre`);
    continue;
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
      console.log(`  Puerto ${port}: proceso ${pid} terminado`);
    } catch {
      // El proceso ya no existe
      console.log(`  Puerto ${port}: proceso ${pid} ya no existe`);
    }
  }
}
