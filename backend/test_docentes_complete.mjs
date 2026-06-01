#!/usr/bin/env node

/**
 * Script de prueba para módulo Docentes
 * Verificar endpoints POST, GET, PATCH y DELETE
 */

const API_URL = 'http://localhost:5000';

// Colores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let token = '';
let docenteId = '';

async function obtenerToken() {
  try {
    console.log(`\n${colors.blue}▶ Obteniendo token JWT...${colors.reset}`);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correoElectronico: 'admin@udemm.edu.ar',
        contrasena: 'Admin1234!'
      })
    });

    if (!response.ok) {
      throw new Error(`Login fallido: ${response.status}`);
    }

    const data = await response.json();
    token = data.accessToken;
    console.log(`${colors.green}✓ Token obtenido${colors.reset}`);
    return token;
  } catch (err) {
    console.error(`${colors.red}✗ Error al obtener token:${colors.reset}`, err.message);
    process.exit(1);
  }
}

async function crearDocente() {
  try {
    console.log(`\n${colors.blue}▶ POST /docentes - Creando docente...${colors.reset}`);
    const response = await fetch(`${API_URL}/docentes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        nombre: 'Carlos',
        apellido: 'González',
        tipoDocumento: 'DNI',
        numeroDocumento: '32445678',
        correoElectronico: 'carlos.gonzalez@test.edu.ar',
        telefono: '011123456',
        domicilio: 'Av. Principal 456',
        tituloGrado: 'Ingeniero en Sistemas',
        tituloPosgrado: 'Máster en Tecnología',
        cargoDeclarado: 'Profesor Asociado',
        justificacionPertinencia: 'Experto en bases de datos',
        actividadesProfesionales: 'Consultoría en TI',
        antecedentesAcademicos: '15 años de experiencia'
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Error ${response.status}: ${body}`);
    }

    const docente = await response.json();
    docenteId = docente.id;
    console.log(`${colors.green}✓ Docente creado con ID: ${docenteId}${colors.reset}`);
    console.log(`  Nombre: ${docente.nombre} ${docente.apellido}`);
    console.log(`  Email: ${docente.correoElectronico}`);
    return docente;
  } catch (err) {
    console.error(`${colors.red}✗ Error al crear docente:${colors.reset}`, err.message);
    throw err;
  }
}

async function listarDocentes() {
  try {
    console.log(`\n${colors.blue}▶ GET /docentes - Listando docentes...${colors.reset}`);
    const response = await fetch(`${API_URL}/docentes?page=1&limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    console.log(`${colors.green}✓ Docentes listados (total: ${data.total})${colors.reset}`);
    data.data.slice(0, 3).forEach(d => {
      console.log(`  - ${d.nombre} ${d.apellido} (${d.correoElectronico}) [${d.activo ? 'Activo' : 'Inactivo'}]`);
    });
    return data;
  } catch (err) {
    console.error(`${colors.red}✗ Error al listar docentes:${colors.reset}`, err.message);
    throw err;
  }
}

async function obtenerDocente(id) {
  try {
    console.log(`\n${colors.blue}▶ GET /docentes/:id - Obteniendo docente ${id}...${colors.reset}`);
    const response = await fetch(`${API_URL}/docentes/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const docente = await response.json();
    console.log(`${colors.green}✓ Docente obtenido${colors.reset}`);
    console.log(`  Nombre: ${docente.nombre} ${docente.apellido}`);
    console.log(`  Documento: ${docente.tipoDocumento} ${docente.numeroDocumento}`);
    console.log(`  Estado: ${docente.activo ? 'Activo' : 'Inactivo'}`);
    return docente;
  } catch (err) {
    console.error(`${colors.red}✗ Error al obtener docente:${colors.reset}`, err.message);
    throw err;
  }
}

async function actualizarDocente(id) {
  try {
    console.log(`\n${colors.blue}▶ PATCH /docentes/:id - Actualizando docente...${colors.reset}`);
    const response = await fetch(`${API_URL}/docentes/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        telefono: '011999888',
        cargoDeclarado: 'Profesor Titular - Actualizado'
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Error ${response.status}: ${body}`);
    }

    const docente = await response.json();
    console.log(`${colors.green}✓ Docente actualizado${colors.reset}`);
    console.log(`  Teléfono: ${docente.telefono}`);
    console.log(`  Cargo: ${docente.cargoDeclarado}`);
    return docente;
  } catch (err) {
    console.error(`${colors.red}✗ Error al actualizar docente:${colors.reset}`, err.message);
    throw err;
  }
}

async function buscarDocente(busqueda) {
  try {
    console.log(`\n${colors.blue}▶ GET /docentes?buscar=... - Buscando "${busqueda}"...${colors.reset}`);
    const params = new URLSearchParams({ buscar: busqueda });
    const response = await fetch(`${API_URL}/docentes?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const data = await response.json();
    console.log(`${colors.green}✓ Búsqueda completada (resultados: ${data.total})${colors.reset}`);
    data.data.forEach(d => {
      console.log(`  - ${d.nombre} ${d.apellido} (${d.numeroDocumento})`);
    });
    return data;
  } catch (err) {
    console.error(`${colors.red}✗ Error en búsqueda:${colors.reset}`, err.message);
    throw err;
  }
}

async function darDeBaja(id) {
  try {
    console.log(`\n${colors.blue}▶ DELETE /docentes/:id - Dando de baja docente...${colors.reset}`);
    const response = await fetch(`${API_URL}/docentes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    const docente = await response.json();
    console.log(`${colors.green}✓ Docente dado de baja${colors.reset}`);
    console.log(`  ${docente.nombre} ${docente.apellido} - Activo: ${docente.activo}`);
    return docente;
  } catch (err) {
    console.error(`${colors.red}✗ Error al dar de baja:${colors.reset}`, err.message);
    throw err;
  }
}

async function main() {
  console.log(`${colors.yellow}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║   Pruebas del Módulo Docentes          ║${colors.reset}`);
  console.log(`${colors.yellow}╚════════════════════════════════════════╝${colors.reset}`);

  try {
    await obtenerToken();
    const docente = await crearDocente();
    await listarDocentes();
    await obtenerDocente(docenteId);
    await buscarDocente('carlos');
    await actualizarDocente(docenteId);
    await darDeBaja(docenteId);
    
    console.log(`\n${colors.green}${colors.yellow}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}✓ Todas las pruebas completadas exitosamente${colors.reset}`);
    console.log(`${colors.yellow}════════════════════════════════════════${colors.reset}\n`);
  } catch (err) {
    console.error(`\n${colors.red}✗ Pruebas fallidas${colors.reset}\n`);
    process.exit(1);
  }
}

main();
