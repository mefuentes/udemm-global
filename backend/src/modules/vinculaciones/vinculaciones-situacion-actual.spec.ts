import { VinculacionesService } from './vinculaciones.service';

const DOCENTE_ID  = 'docente-situacion-id';
const USUARIO_ID  = 'admin-user-id';
const ROL_ADMIN   = 'SECRETARIA_ACADEMICA';

function makeVinculacion(id: string) {
  return {
    id,
    estado: 'APROBADA',
    docenteId: DOCENTE_ID,
    facultad:         { id: 'f1', nombre: 'FACULTAD' },
    carrera:          { id: 'c1', nombre: 'CARRERA' },
    planEstudio:      { id: 'p1', nombre: 'PLAN', codigo: null },
    materia:          { id: 'm1', nombre: 'MATERIA', codigo: null },
    docente:          { id: DOCENTE_ID, nombre: 'JUAN', apellido: 'PEREZ' },
    catedra:          { id: 'cat1', nombre: 'CATEDRA' },
    cargo:            { id: 'car1', nombre: 'CARGO' },
    modalidad:        { id: 'mod1', nombre: 'PRESENCIAL' },
    designacion:      { id: 'des1', nombre: 'DESIGNACION' },
    usuarioSolicitante: null,
    aprobador:        null,
    desvinculador:    null,
    fechaCreacion:    new Date(),
  };
}

function makePrisma(rows: any[], docenteActivo = true) {
  return {
    docente: {
      findUnique: jest.fn().mockResolvedValue({ activo: docenteActivo }),
    },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
}

const makeService = (prisma: any) => new VinculacionesService(prisma as any);

describe('VinculacionesService — consulta de vinculaciones para sección 4.1 SITUACIÓN ACTUAL', () => {

  // ── Caso 1 ────────────────────────────────────────────────────────────────────
  describe('Caso 1: docente activo con 2 vinculaciones APROBADAS', () => {
    it('devuelve exactamente 2 filas y aplica docenteId + estado=APROBADA en el where', async () => {
      const prisma = makePrisma([makeVinculacion('vc-1'), makeVinculacion('vc-2')]);
      const service = makeService(prisma);

      const result = await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        ROL_ADMIN,
      );

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(2);
      expect(prisma.vinculacionCatedra.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            docenteId: DOCENTE_ID,
            estado:    'APROBADA',
          }),
        }),
      );
    });
  });

  // ── Caso 2 ────────────────────────────────────────────────────────────────────
  describe('Caso 2: docente dado de baja (vinculaciones pasaron a DESVINCULADA)', () => {
    it('devuelve 0 filas cuando no hay vinculaciones APROBADAS', async () => {
      const prisma = makePrisma([]);   // DB no devuelve nada con estado=APROBADA post-baja
      const service = makeService(prisma);

      const result = await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        ROL_ADMIN,
      );

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(0);
    });
  });

  // ── Caso 3 ────────────────────────────────────────────────────────────────────
  describe('Caso 3: vinculación DESVINCULADA histórica nunca aparece en 4.1', () => {
    it('el where construido por el service incluye estado=APROBADA y excluye cualquier otro estado', async () => {
      const prisma = makePrisma([]);
      const service = makeService(prisma);

      await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        ROL_ADMIN,
      );

      const llamada = prisma.vinculacionCatedra.findMany.mock.calls[0][0];
      // El filtro de estado debe ser exactamente 'APROBADA', sin mezclar DESVINCULADA
      expect(llamada.where.estado).toBe('APROBADA');
      expect(llamada.where.estado).not.toEqual(
        expect.arrayContaining(['DESVINCULADA']),
      );
    });
  });

  // ── Caso 4 ────────────────────────────────────────────────────────────────────
  describe('Caso 4: docente reactivado sin nuevas vinculaciones APROBADAS', () => {
    it('devuelve 0 filas cuando el docente fue reactivado pero no tiene nuevas APROBADAS', async () => {
      // Las vinculaciones anteriores a la baja quedaron DESVINCULADA y no se restauran.
      const prisma = makePrisma([]);
      const service = makeService(prisma);

      const result = await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        ROL_ADMIN,
      );

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(0);
    });
  });

  // ── Caso 5 ────────────────────────────────────────────────────────────────────
  describe('Caso 5: docente reactivado con una nueva vinculación APROBADA', () => {
    it('devuelve 1 fila cuando se aprueba una nueva vinculación tras la reactivación', async () => {
      const prisma = makePrisma([makeVinculacion('vc-nueva')]);
      const service = makeService(prisma);

      const result = await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        ROL_ADMIN,
      );

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(1);
      expect((result as any[])[0].id).toBe('vc-nueva');
    });
  });

  // ── Caso 6 ────────────────────────────────────────────────────────────────────
  describe('Caso 6: guardia adicional — docente INACTIVO con VinculacionCatedra APROBADA por inconsistencia', () => {
    it('devuelve 0 materias y no consulta VinculacionCatedra cuando el docente está inactivo', async () => {
      // Simula inconsistencia de datos: docente.activo=false pero hay vinculaciones APROBADAS
      const prisma = makePrisma([makeVinculacion('vc-inconsistente')], false /* docenteActivo=false */);
      const service = makeService(prisma);

      const result = await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        ROL_ADMIN,
      );

      // Debe devolver vacío sin llegar a consultar VinculacionCatedra
      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(0);
      expect(prisma.vinculacionCatedra.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Caso 7 ────────────────────────────────────────────────────────────────────
  describe('Caso 7: distintos roles autorizados ven la misma Situación Actual vacía tras reactivación', () => {
    // DIRECTOR_CARRERA excluido: §7.1 REGLAS-DESARROLLO-SEGURO — sin acceso a vinculaciones
    it.each([
      ['ADMINISTRADOR_SISTEMA'],
      ['DECANO'],
      ['RECTORADO'],
      ['SECRETARIA_ACADEMICA'],
      ['ADMINISTRATIVO'],
    ])('rol %s obtiene 4.1 vacía cuando el docente fue reactivado sin nuevas APROBADAS', async (rol) => {
      // Docente activo (reactivado), pero DB no devuelve ninguna vinculación APROBADA
      const prisma = makePrisma([]); // docenteActivo=true (default)
      const service = makeService(prisma);

      const result = await service.listar(
        { estado: 'APROBADA', docenteId: DOCENTE_ID },
        USUARIO_ID,
        rol,
      );

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(0);
    });
  });

});
