import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AsociarCargoInstitucionalDto } from './dto/asociar-cargo-institucional.dto';
import { VinculacionesService } from './vinculaciones.service';

// ── UUIDs de prueba (formato v4 válido: variante [89ab] en grupo 4) ──────────
const DOCENTE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOCENTE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VINC_ID   = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VINC_ID_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CARGO_X   = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CARGO_Y   = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

// ── Fábricas ─────────────────────────────────────────────────────────────────

function makeVinc(
  id          = VINC_ID,
  estado      = 'APROBADA',
  docenteId   = DOCENTE_A,
  cargoDocenteId: string | null = null,
) {
  return { id, estado, docenteId, cargoDocenteId };
}

function makeCargo(id = CARGO_X, docenteId = DOCENTE_A, extra: Partial<{ verificado: boolean; fechaFin: Date | null }> = {}) {
  return {
    id,
    docenteId,
    verificado:  extra.verificado  ?? true,
    fechaInicio: new Date('2022-01-01'),
    fechaFin:    extra.fechaFin   !== undefined ? extra.fechaFin : null,
    cargo:       { id: 'cat-id', nombre: 'Profesor Titular' },
  };
}

function makeUpdated(vinc: ReturnType<typeof makeVinc>, cargoDocenteId: string | null) {
  return {
    ...vinc,
    cargoDocenteId,
    cargoDocente: cargoDocenteId
      ? makeCargo(cargoDocenteId)
      : null,
  };
}

function makePrisma({
  vinc    = null as any,
  cargo   = null as any,
  updated = null as any,
} = {}) {
  return {
    vinculacionCatedra: {
      findUnique: jest.fn().mockResolvedValue(vinc),
      update:     jest.fn().mockResolvedValue(updated ?? makeUpdated(vinc ?? makeVinc(), null)),
    },
    cargoDocente: {
      findUnique: jest.fn().mockResolvedValue(cargo),
    },
    $transaction: jest.fn(),
  };
}

const makeService = (prisma: any) => new VinculacionesService(prisma as any);

// ── DTO: validaciones ────────────────────────────────────────────────────────

describe('AsociarCargoInstitucionalDto', () => {
  async function validar(plain: object) {
    const inst = plainToInstance(AsociarCargoInstitucionalDto, plain);
    return validate(inst);
  }

  it('null → válido (desasociación)', async () => {
    const errors = await validar({ cargoDocenteId: null });
    expect(errors).toHaveLength(0);
  });

  it('UUID válido → válido', async () => {
    const errors = await validar({ cargoDocenteId: CARGO_X });
    expect(errors).toHaveLength(0);
  });

  it('campo ausente → error de validación', async () => {
    const errors = await validar({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('cargoDocenteId');
  });

  it('UUID inválido → error', async () => {
    const errors = await validar({ cargoDocenteId: 'no-es-uuid' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('número → error', async () => {
    const errors = await validar({ cargoDocenteId: 123 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('string vacío → error', async () => {
    const errors = await validar({ cargoDocenteId: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('objeto → error', async () => {
    const errors = await validar({ cargoDocenteId: {} });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Service: asociarCargoInstitucional ───────────────────────────────────────

describe('VinculacionesService — asociarCargoInstitucional', () => {

  describe('operaciones válidas', () => {

    it('asociación válida: vinculación APROBADA + cargo del mismo docente', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_A);
      const prisma = makePrisma({ vinc, cargo, updated: makeUpdated(vinc, CARGO_X) });
      const service = makeService(prisma);

      const result = await service.asociarCargoInstitucional(VINC_ID, CARGO_X);

      expect(prisma.vinculacionCatedra.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cargoDocenteId: CARGO_X } }),
      );
      expect((result as any).cargoDocenteId).toBe(CARGO_X);
    });

    it('reasignación: cargoDocenteId A → B (mismo docente)', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, CARGO_X);
      const cargo = makeCargo(CARGO_Y, DOCENTE_A);
      const prisma = makePrisma({ vinc, cargo, updated: makeUpdated(vinc, CARGO_Y) });
      const service = makeService(prisma);

      const result = await service.asociarCargoInstitucional(VINC_ID, CARGO_Y);

      expect(prisma.vinculacionCatedra.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cargoDocenteId: CARGO_Y } }),
      );
      expect((result as any).cargoDocenteId).toBe(CARGO_Y);
    });

    it('desasociación: null → vinculación sin cargo', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, CARGO_X);
      const prisma = makePrisma({ vinc, cargo: null, updated: makeUpdated(vinc, null) });
      const service = makeService(prisma);

      const result = await service.asociarCargoInstitucional(VINC_ID, null);

      expect(prisma.cargoDocente.findUnique).not.toHaveBeenCalled();
      expect(prisma.vinculacionCatedra.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cargoDocenteId: null } }),
      );
      expect((result as any).cargoDocenteId).toBeNull();
    });

    it('vinculación PENDIENTE_DE_APROBACION: asociación permitida (pre-asociación)', async () => {
      const vinc  = makeVinc(VINC_ID, 'PENDIENTE_DE_APROBACION', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_A);
      const prisma = makePrisma({ vinc, cargo, updated: makeUpdated(vinc, CARGO_X) });
      const service = makeService(prisma);

      await expect(service.asociarCargoInstitucional(VINC_ID, CARGO_X)).resolves.toBeDefined();
    });

    it('vinculación DESVINCULADA: asociación histórica permitida', async () => {
      const vinc  = makeVinc(VINC_ID, 'DESVINCULADA', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_A);
      const prisma = makePrisma({ vinc, cargo, updated: makeUpdated(vinc, CARGO_X) });
      const service = makeService(prisma);

      await expect(service.asociarCargoInstitucional(VINC_ID, CARGO_X)).resolves.toBeDefined();
    });

    it('cargo no vigente (fechaFin pasada): asociación permitida — vigencia es criterio R-04, no de asociación', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_A, { fechaFin: new Date('2020-01-01') });
      const prisma = makePrisma({ vinc, cargo, updated: makeUpdated(vinc, CARGO_X) });
      const service = makeService(prisma);

      await expect(service.asociarCargoInstitucional(VINC_ID, CARGO_X)).resolves.toBeDefined();
    });

    it('cargo no verificado: asociación permitida — verificado es criterio R-04, no de asociación', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_A, { verificado: false });
      const prisma = makePrisma({ vinc, cargo, updated: makeUpdated(vinc, CARGO_X) });
      const service = makeService(prisma);

      await expect(service.asociarCargoInstitucional(VINC_ID, CARGO_X)).resolves.toBeDefined();
    });

    it('múltiples vinculaciones del mismo cargo: cada actualización es independiente', async () => {
      const vinc1 = makeVinc(VINC_ID,   'APROBADA', DOCENTE_A, null);
      const vinc2 = makeVinc(VINC_ID_2, 'APROBADA', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_A);

      const prisma1 = makePrisma({ vinc: vinc1, cargo, updated: makeUpdated(vinc1, CARGO_X) });
      const prisma2 = makePrisma({ vinc: vinc2, cargo, updated: makeUpdated(vinc2, CARGO_X) });

      const result1 = await makeService(prisma1).asociarCargoInstitucional(VINC_ID,   CARGO_X);
      const result2 = await makeService(prisma2).asociarCargoInstitucional(VINC_ID_2, CARGO_X);

      expect((result1 as any).id).toBe(VINC_ID);
      expect((result2 as any).id).toBe(VINC_ID_2);
      expect((result1 as any).cargoDocenteId).toBe(CARGO_X);
      expect((result2 as any).cargoDocenteId).toBe(CARGO_X);
    });
  });

  describe('errores', () => {

    it('vinculación inexistente → NotFoundException', async () => {
      const prisma = makePrisma({ vinc: null });
      await expect(makeService(prisma).asociarCargoInstitucional(VINC_ID, CARGO_X))
        .rejects.toThrow(NotFoundException);
    });

    it('cargo inexistente → NotFoundException', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, null);
      const prisma = makePrisma({ vinc, cargo: null });
      await expect(makeService(prisma).asociarCargoInstitucional(VINC_ID, CARGO_X))
        .rejects.toThrow(NotFoundException);
    });

    it('cargo de otro docente → BadRequestException (INVARIANTE 2 service-level)', async () => {
      const vinc  = makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, null);
      const cargo = makeCargo(CARGO_X, DOCENTE_B);
      const prisma = makePrisma({ vinc, cargo });
      await expect(makeService(prisma).asociarCargoInstitucional(VINC_ID, CARGO_X))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('preservación de asociaciones ante cambios de estado', () => {

    it('rechazar no incluye cargoDocenteId en la actualización', async () => {
      const vcCompleta = {
        ...makeVinc(VINC_ID, 'PENDIENTE_DE_APROBACION', DOCENTE_A, CARGO_X),
        facultad:    { nombre: 'F' },
        carrera:     { nombre: 'C' },
        planEstudio: { nombre: 'P' },
        materia:     { nombre: 'M' },
        catedra:     { nombre: 'Cat' },
        cargo:       { nombre: 'Car' },
        modalidad:   { nombre: 'Mod' },
        designacion: { nombre: 'Des' },
      };
      const txVinc  = { update: jest.fn().mockResolvedValue({ ...vcCompleta, estado: 'RECHAZADA' }) };
      const txNotif = { create: jest.fn().mockResolvedValue({}) };
      const prisma = {
        vinculacionCatedra: { findUnique: jest.fn().mockResolvedValue(vcCompleta) },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({ vinculacionCatedra: txVinc, notificacion: txNotif }),
        ),
      };

      await makeService(prisma).rechazar(
        VINC_ID,
        { motivo: 'Motivo de rechazo con suficientes caracteres aquí' } as any,
        'admin-id',
        'ADMINISTRADOR_SISTEMA',
      );

      const data = txVinc.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('cargoDocenteId');
      expect(data.estado).toBe('RECHAZADA');
    });

    it('desvincular no incluye cargoDocenteId en la actualización', async () => {
      const vcCompleta = {
        ...makeVinc(VINC_ID, 'APROBADA', DOCENTE_A, CARGO_X),
        docente:     { id: DOCENTE_A },
        materia:     { nombre: 'M' },
        carrera:     { nombre: 'C' },
        planEstudio: { nombre: 'P' },
        catedra:     { nombre: 'Cat' },
        cargo:       { nombre: 'Car' },
      };
      const txVinc  = { update: jest.fn().mockResolvedValue({ ...vcCompleta, estado: 'DESVINCULADA' }) };
      const txNotif = { create: jest.fn().mockResolvedValue({}) };
      const prisma = {
        vinculacionCatedra: { findUnique: jest.fn().mockResolvedValue(vcCompleta) },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({ vinculacionCatedra: txVinc, notificacion: txNotif }),
        ),
      };

      await makeService(prisma).desvincular(
        VINC_ID,
        { fechaDesvinculacion: '2026-01-01', motivoDesvinculacion: 'Motivo suficientemente largo para validar' } as any,
        'admin-id',
      );

      const data = txVinc.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('cargoDocenteId');
      expect((data as any).estado).toBe('DESVINCULADA');
    });
  });
});
