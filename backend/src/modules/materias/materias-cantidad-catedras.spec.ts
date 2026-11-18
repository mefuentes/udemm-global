import { MateriasService } from './materias.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLAN_ID = 'plan-test-uuid';

const MAT_BASE = {
  id: 'mat-1',
  codigo: 'MAT001',
  nombre: 'Materia Test',
  planEstudioId: PLAN_ID,
  estado: 'ACTIVO',
  creditos: 3,
  anio: 1,
  cuatrimestre: 1,
  descripcion: null,
  bloqueConocimiento: null,
  modalidadDictado: null,
  cargaHorariaSemanal: 4,
  cargaHorariaTotal: 64,
  regimenCursado: null,
  tipoAsignatura: 'OBLIGATORIA',
  observaciones: null,
  fechaCreacion: new Date(),
  fechaActualizacion: new Date(),
};

function makeVinc(catedraId: string, docenteId = `doc-${catedraId}`) {
  return {
    catedraId,
    docente: { id: docenteId, nombre: 'Nombre', apellido: 'Apellido' },
  };
}

function makePrisma(vinculacionesPorMateria: ReturnType<typeof makeVinc>[][]) {
  const materias = vinculacionesPorMateria.map((vincs, i) => ({
    ...MAT_BASE,
    id: `mat-${i + 1}`,
    vinculaciones: vincs,
  }));
  return {
    materia: { findMany: jest.fn().mockResolvedValue(materias) },
    historialMateria: { create: jest.fn() },
  };
}

const makeService = (prisma: ReturnType<typeof makePrisma>) =>
  new MateriasService(prisma as any);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MateriasService.obtenerTodas — cantidadCatedras con docente activo', () => {

  it('la query incluye docente: { activo: true } en el where de vinculaciones', async () => {
    const prisma = makePrisma([[]]);
    await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(prisma.materia.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          vinculaciones: expect.objectContaining({
            where: expect.objectContaining({
              estado: 'APROBADA',
              docente: { activo: true },
            }),
          }),
        }),
      }),
    );
  });

  it('1. una cátedra con docente activo → cantidadCatedras = 1', async () => {
    // Prisma devuelve la vinculación porque el docente está activo
    const prisma = makePrisma([[makeVinc('C1')]]);
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(1);
  });

  it('2. una cátedra con docente inactivo → cantidadCatedras = 0', async () => {
    // Prisma filtra la vinculación por docente.activo=false → devuelve []
    const prisma = makePrisma([[/* vacío: Prisma filtró el docente inactivo */]]);
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(0);
  });

  it('3. una cátedra con dos docentes, uno activo y otro inactivo → cantidadCatedras = 1', async () => {
    // Prisma devuelve solo el docente activo para C1; el inactivo fue filtrado
    const prisma = makePrisma([[makeVinc('C1', 'doc-activo')]]);
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(1);
  });

  it('4. dos cátedras distintas con docentes activos → cantidadCatedras = 2', async () => {
    const prisma = makePrisma([[makeVinc('C1'), makeVinc('C2')]]);
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(2);
  });

  it('5. vinculación no aprobada con usuario activo → no cuenta (ya filtrada por estado)', async () => {
    // Prisma no la devuelve porque estado != APROBADA
    const prisma = makePrisma([[/* vacío: Prisma filtró por estado != APROBADA */]]);
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(0);
  });

  it('6. materia sin vinculaciones válidas → cantidadCatedras = 0', async () => {
    const prisma = makePrisma([[]]); // sin vinculaciones
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(0);
  });

  it('7. vinculaciones duplicadas en una misma cátedra → cuenta 1', async () => {
    // Dos docentes activos en C1 → Set elimina duplicados
    const prisma = makePrisma([[makeVinc('C1', 'doc-a'), makeVinc('C1', 'doc-b')]]);
    const [mat] = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mat.cantidadCatedras).toBe(1);
  });

  it('varias materias → cada una tiene su propio conteo independiente', async () => {
    // mat-1: C1(doc-a), C2(doc-b) → 2  |  mat-2: solo C3 → 1
    const prisma = makePrisma([
      [makeVinc('C1', 'doc-a'), makeVinc('C2', 'doc-b')],
      [makeVinc('C3', 'doc-c')],
    ]);
    const mats = await makeService(prisma).obtenerTodas(PLAN_ID);
    expect(mats[0].cantidadCatedras).toBe(2);
    expect(mats[1].cantidadCatedras).toBe(1);
  });

});
