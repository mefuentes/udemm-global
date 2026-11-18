import { MateriasService } from './materias.service';
import { NotFoundException } from '@nestjs/common';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MAT_BASE = {
  id: 'mat-1',
  codigo: 'MAT001',
  nombre: 'Materia Test',
  planEstudioId: 'plan-1',
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
  planEstudio: { id: 'plan-1', nombre: 'Plan Test', carrera: { nombre: 'Carrera Test', facultad: { nombre: 'Facultad Test' } } },
  correlativas: [],
  esCorrelativaDe: [],
};

function makeVinc(catedraId: string, catedraNombre: string, docenteId: string, nombre: string, apellido: string) {
  return { catedraId, catedra: { id: catedraId, nombre: catedraNombre }, docente: { id: docenteId, nombre, apellido } };
}

function makePrisma(vinculaciones: ReturnType<typeof makeVinc>[]) {
  return {
    materia: {
      findUnique: jest.fn().mockResolvedValue({ ...MAT_BASE, vinculaciones }),
      findMany: jest.fn(),
    },
    historialMateria: { create: jest.fn() },
  };
}

const makeService = (prisma: ReturnType<typeof makePrisma>) =>
  new MateriasService(prisma as any);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MateriasService.obtenerFicha — catedras agrupadas', () => {

  it('la query incluye docente: { activo: true } en el where de vinculaciones', async () => {
    const prisma = makePrisma([]);
    await makeService(prisma).obtenerFicha('mat-1');
    expect(prisma.materia.findUnique).toHaveBeenCalledWith(
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

  it('sin vinculaciones → catedras = []', async () => {
    const { catedras } = await makeService(makePrisma([])).obtenerFicha('mat-1');
    expect(catedras).toEqual([]);
  });

  it('una cátedra con un docente → un grupo con ese docente', async () => {
    const prisma = makePrisma([makeVinc('C1', 'Cátedra A', 'D1', 'Juan', 'Pérez')]);
    const { catedras } = await makeService(prisma).obtenerFicha('mat-1');
    expect(catedras).toHaveLength(1);
    expect(catedras[0].nombre).toBe('Cátedra A');
    expect(catedras[0].docentes).toHaveLength(1);
    expect(catedras[0].docentes[0]).toMatchObject({ id: 'D1', nombre: 'Juan', apellido: 'Pérez' });
  });

  it('dos cátedras distintas → dos grupos independientes', async () => {
    const prisma = makePrisma([
      makeVinc('C1', 'Cátedra A', 'D1', 'Ana', 'García'),
      makeVinc('C2', 'Cátedra B', 'D2', 'Luis', 'Martínez'),
    ]);
    const { catedras } = await makeService(prisma).obtenerFicha('mat-1');
    expect(catedras).toHaveLength(2);
    expect(catedras.map(c => c.nombre)).toContain('Cátedra A');
    expect(catedras.map(c => c.nombre)).toContain('Cátedra B');
  });

  it('una cátedra con dos docentes distintos → un grupo con dos docentes', async () => {
    const prisma = makePrisma([
      makeVinc('C1', 'Cátedra A', 'D1', 'Ana', 'García'),
      makeVinc('C1', 'Cátedra A', 'D2', 'Luis', 'Martínez'),
    ]);
    const { catedras } = await makeService(prisma).obtenerFicha('mat-1');
    expect(catedras).toHaveLength(1);
    expect(catedras[0].docentes).toHaveLength(2);
  });

  it('vinculación duplicada (mismo catedraId + docenteId) → docente no se repite', async () => {
    const prisma = makePrisma([
      makeVinc('C1', 'Cátedra A', 'D1', 'Ana', 'García'),
      makeVinc('C1', 'Cátedra A', 'D1', 'Ana', 'García'),
    ]);
    const { catedras } = await makeService(prisma).obtenerFicha('mat-1');
    expect(catedras).toHaveLength(1);
    expect(catedras[0].docentes).toHaveLength(1);
  });

  it('materia no encontrada → lanza NotFoundException', async () => {
    const prisma = {
      materia: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn() },
      historialMateria: { create: jest.fn() },
    };
    await expect(makeService(prisma as any).obtenerFicha('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cantidad de grupos coincide con cantidad de catedraId distintos', async () => {
    const prisma = makePrisma([
      makeVinc('C1', 'Cátedra A', 'D1', 'Ana', 'García'),
      makeVinc('C1', 'Cátedra A', 'D2', 'Luis', 'Martínez'),
      makeVinc('C2', 'Cátedra B', 'D3', 'María', 'López'),
      makeVinc('C3', 'Cátedra C', 'D4', 'Carlos', 'Rodríguez'),
    ]);
    const { catedras } = await makeService(prisma).obtenerFicha('mat-1');
    // C1, C2, C3 → 3 grupos
    expect(catedras).toHaveLength(3);
    const c1 = catedras.find(c => c.catedraId === 'C1')!;
    expect(c1.docentes).toHaveLength(2);
  });

});
