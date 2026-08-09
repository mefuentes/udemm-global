import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {

  // ── Roles ─────────────────────────────────────────────────────────────────

  const rolesData = [
    { nombre: 'DOCENTE', descripcion: 'Rol de docente' },
    { nombre: 'ADMINISTRATIVO', descripcion: 'Rol administrativo' },
    { nombre: 'DIRECTOR_CARRERA', descripcion: 'Director de carrera' },
    { nombre: 'SECRETARIA_ACADEMICA', descripcion: 'Secretaría académica' },
    { nombre: 'ADMINISTRADOR_SISTEMA', descripcion: 'Administrador del sistema' },
    { nombre: 'DECANO', descripcion: 'Rol institucional de Decano' },
    { nombre: 'RECTORADO', descripcion: 'Rol institucional de Rectorado' }
  ];

  for (const rol of rolesData) {
    await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion },
      create: rol
    });
  }

  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'ADMINISTRADOR_SISTEMA' } });
  const rolDecano = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'DECANO' } });
  const rolRectorado = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'RECTORADO' } });

  // ── Usuarios ──────────────────────────────────────────────────────────────

  const adminHash = await bcrypt.hash('Admin1234!', 10);
  await prisma.usuario.upsert({
    where: { correoElectronico: 'admin@udemm.edu.ar' },
    update: { nombre: 'Administrador', apellido: 'Sistema', contrasenaHash: adminHash, activo: true, rolId: rolAdmin.id },
    create: { nombre: 'Administrador', apellido: 'Sistema', correoElectronico: 'admin@udemm.edu.ar', contrasenaHash: adminHash, activo: true, rolId: rolAdmin.id }
  });

  const decanoHash = await bcrypt.hash('Decano123!', 10);
  await prisma.usuario.upsert({
    where: { correoElectronico: 'decano@udemm.edu.ar' },
    update: { nombre: 'Decano', apellido: 'UDEMM', contrasenaHash: decanoHash, activo: true, rolId: rolDecano.id },
    create: { nombre: 'Decano', apellido: 'UDEMM', correoElectronico: 'decano@udemm.edu.ar', contrasenaHash: decanoHash, activo: true, rolId: rolDecano.id }
  });

  const rectoradoHash = await bcrypt.hash('Rectorado123!', 10);
  await prisma.usuario.upsert({
    where: { correoElectronico: 'rectorado@udemm.edu.ar' },
    update: { nombre: 'Rectorado', apellido: 'UDEMM', contrasenaHash: rectoradoHash, activo: true, rolId: rolRectorado.id },
    create: { nombre: 'Rectorado', apellido: 'UDEMM', correoElectronico: 'rectorado@udemm.edu.ar', contrasenaHash: rectoradoHash, activo: true, rolId: rolRectorado.id }
  });

  // ── Universidad ───────────────────────────────────────────────────────────

  let universidad = await prisma.universidad.findFirst({ where: { nombre: 'UDEMM' } });
  if (!universidad) {
    universidad = await prisma.universidad.create({ data: { nombre: 'UDEMM' } });
  }
  console.log('Universidad:', universidad.nombre);

  // ── Facultad ──────────────────────────────────────────────────────────────

  const facultad = await prisma.facultad.upsert({
  where: {
    codigo: 'FAC-ING',
  },
  update: {
    nombre: 'Facultad de Ingeniería',
    descripcion: 'Facultad de Ingeniería y Tecnologías',
    estado: 'ACTIVO',
    universidadId: universidad.id,
  },
  create: {
    codigo: 'FAC-ING',
    nombre: 'Facultad de Ingeniería',
    descripcion: 'Facultad de Ingeniería y Tecnologías',
    estado: 'ACTIVO',
    universidadId: universidad.id,
  },
});

console.log('Facultad:', facultad.nombre);

  // ── Carrera ───────────────────────────────────────────────────────────────

 const carrera = await prisma.carrera.upsert({
  where: {
    codigo: 'ING-IND',
  },
  update: {
    nombre: 'Ingeniería Industrial',
    facultadId: facultad.id,
    tituloOtorgado: 'Ingeniero/a Industrial',
    duracionAnios: 5,
    modalidad: 'Presencial',
    estado: 'ACTIVO',
  },
  create: {
    codigo: 'ING-IND',
    nombre: 'Ingeniería Industrial',
    facultadId: facultad.id,
    tituloOtorgado: 'Ingeniero/a Industrial',
    duracionAnios: 5,
    modalidad: 'Presencial',
    estado: 'ACTIVO',
  },
});

console.log('Carrera:', carrera.nombre);

  // ── Plan de Estudio ───────────────────────────────────────────────────────

  const plan = await prisma.planEstudio.upsert({
    where: { codigo: 'IND-2006' },
    update: {},
    create: {
      codigo: 'IND-2006',
      nombre: 'Plan 2006',
      version: '1.0',
      anio: 2006,
      carreraId: carrera.id,
      estado: 'ACTIVO',
      descripcion: 'Plan de estudios vigente aprobado en 2006'
    }
  });
  console.log('Plan:', plan.nombre);

  // ── Asignaturas ───────────────────────────────────────────────────────────

  const materiasData = [
    {
      codigo: 'MAT-101', nombre: 'Matemática I',
      anio: 1, cuatrimestre: 1, creditos: 6,
      cargaHorariaSemanal: 6, cargaHorariaTotal: 96,
      tipoAsignatura: 'OBLIGATORIA', bloqueConocimiento: 'Ciencias Básicas',
      regimenCursado: 'Cuatrimestral'
    },
    {
      codigo: 'MAT-102', nombre: 'Matemática II',
      anio: 1, cuatrimestre: 2, creditos: 6,
      cargaHorariaSemanal: 6, cargaHorariaTotal: 96,
      tipoAsignatura: 'OBLIGATORIA', bloqueConocimiento: 'Ciencias Básicas',
      regimenCursado: 'Cuatrimestral',
      observaciones: 'Continuación de Matemática I. Requiere correlativa aprobada.'
    },
    {
      codigo: 'FIS-101', nombre: 'Física I',
      anio: 1, cuatrimestre: 1, creditos: 5,
      cargaHorariaSemanal: 5, cargaHorariaTotal: 80,
      tipoAsignatura: 'OBLIGATORIA', bloqueConocimiento: 'Ciencias Básicas',
      regimenCursado: 'Cuatrimestral'
    },
    {
      codigo: 'IND-201', nombre: 'Investigación Operativa',
      anio: 2, cuatrimestre: 1, creditos: 4,
      cargaHorariaSemanal: 4, cargaHorariaTotal: 64,
      tipoAsignatura: 'OBLIGATORIA', bloqueConocimiento: 'Ingeniería Industrial',
      regimenCursado: 'Cuatrimestral'
    },
    {
      codigo: 'GES-301', nombre: 'Gestión de la Producción',
      anio: 3, cuatrimestre: 1, creditos: 4,
      cargaHorariaSemanal: 4, cargaHorariaTotal: 64,
      tipoAsignatura: 'OBLIGATORIA', bloqueConocimiento: 'Ingeniería Industrial',
      regimenCursado: 'Cuatrimestral'
    }
  ];

  const materiasCreadas: Record<string, { id: string }> = {};
  for (const m of materiasData) {
    const mat = await prisma.materia.upsert({
      where: { codigo: m.codigo },
      update: {},
      create: { ...m, planEstudioId: plan.id, estado: 'ACTIVO' }
    });
    materiasCreadas[m.codigo] = mat;
    console.log('  Materia:', mat.codigo, mat.nombre);
  }

  // ── Correlatividades ──────────────────────────────────────────────────────

  const corrPairs = [
    // MAT-102 requiere MAT-101 para cursar
    { materiaId: materiasCreadas['MAT-102'].id, correlativaId: materiasCreadas['MAT-101'].id, tipo: 'CURSADO' },
    // IND-201 requiere MAT-102 para cursar
    { materiaId: materiasCreadas['IND-201'].id, correlativaId: materiasCreadas['MAT-102'].id, tipo: 'CURSADO' },
    // GES-301 requiere IND-201 para cursar
    { materiaId: materiasCreadas['GES-301'].id, correlativaId: materiasCreadas['IND-201'].id, tipo: 'CURSADO' },
  ];

  for (const pair of corrPairs) {
    await prisma.correlatividad.upsert({
      where: { materiaId_correlativaId: { materiaId: pair.materiaId, correlativaId: pair.correlativaId } },
      update: {},
      create: pair
    });
    console.log('  Correlatividad:', pair.tipo);
  }

  // ── Tablas maestras ───────────────────────────────────────────────────────

  const catedras = ['ÚNICA', 'CÁTEDRA 1', 'CÁTEDRA 2'];
  for (const nombre of catedras) {
    await prisma.catedra.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  console.log('Cátedras:', catedras.join(', '));

  const cargos = [
    'PROFESOR TITULAR', 'PROFESOR ASOCIADO', 'PROFESOR ADJUNTO',
    'JTP', 'AYUDANTE GRADUADO', 'AYUDANTE NO GRADUADO', 'OTROS',
  ];
  for (const nombre of cargos) {
    await prisma.cargo.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  console.log('Cargos:', cargos.length, 'registros');

  const designaciones = [
    'REGULAR RENTADO', 'REGULAR AD HONOREM',
    'INTERINO RENTADO', 'INTERINO AD HONOREM', 'CONTRATADO',
  ];
  for (const nombre of designaciones) {
    await prisma.designacion.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  console.log('Designaciones:', designaciones.join(', '));

  const modalidades = ['CUATRIMESTRAL', 'SEMESTRAL', 'ANUAL'];
  for (const nombre of modalidades) {
    await prisma.modalidad.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  console.log('Modalidades:', modalidades.join(', '));

  console.log('\n✓ Seed ejecutado correctamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
