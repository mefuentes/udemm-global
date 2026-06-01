const base = 'http://localhost:5000';
const credentials = {
  correoElectronico: 'admin@udemm.edu.ar',
  contrasena: 'Admin1234!'
};
const docente = {
  nombre: 'Juan',
  apellido: 'Perez',
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  correoElectronico: 'juan.perez@udemm.edu.ar',
  telefono: '1122334455',
  domicilio: 'Calle Falsa 123',
  tituloGrado: 'Licenciado en Educacion',
  tituloPosgrado: 'Maestria en Docencia',
  cargoDeclarado: 'Profesor',
  justificacionPertinencia: 'Docente con experiencia',
  actividadesProfesionales: 'Investigacion y clases',
  antecedentesAcademicos: 'Doctorado en Educacion',
  activo: true
};

async function test() {
  const loginRes = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const loginData = await loginRes.json();
  if (!loginData.accessToken) {
    throw new Error('Login falló: ' + JSON.stringify(loginData));
  }
  const headers = { Authorization: 'Bearer ' + loginData.accessToken, 'Content-Type': 'application/json' };

  const createRes = await fetch(base + '/docentes', {
    method: 'POST',
    headers,
    body: JSON.stringify(docente)
  });
  const created = await createRes.json();
  console.log('CREATE status', createRes.status);
  console.log(JSON.stringify(created, null, 2));

  const id = created.id;
  if (!id) throw new Error('No se obtuvo id del docente');

  const getRes = await fetch(base + '/docentes/' + id, { method: 'GET', headers });
  console.log('GET status', getRes.status);
  console.log(JSON.stringify(await getRes.json(), null, 2));

  const patchRes = await fetch(base + '/docentes/' + id, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ telefono: '2211223344', domicilio: 'Av. Siempreviva 742' })
  });
  console.log('PATCH status', patchRes.status);
  console.log(JSON.stringify(await patchRes.json(), null, 2));

  const deleteRes = await fetch(base + '/docentes/' + id, { method: 'DELETE', headers });
  console.log('DELETE status', deleteRes.status);
  console.log(await deleteRes.text());

  const finalRes = await fetch(base + '/docentes/' + id, { method: 'GET', headers });
  console.log('FINAL GET status', finalRes.status);
  console.log(await finalRes.text());
}

test().catch((error) => {
  console.error(error);
  process.exit(1);
});
