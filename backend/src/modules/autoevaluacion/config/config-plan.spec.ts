import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigPlanService } from './config-plan.service';

const PLAN_ID    = 'plan-01';
const CARRERA_ID = 'car-01';
const USUARIO_ID = 'usr-01';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PLAN_BASE = {
  id: PLAN_ID,
  carreraId: CARRERA_ID,
  horasMinTotales: null,
  horasMinCB: null,
  horasMinTB: null,
  horasMinTA: null,
  horasMinCTX: null,
  requierePPS: null,
  requierePI: null,
  porcentajeMinFormacion: null,
};

const PLAN_CON_UMBRALES = {
  ...PLAN_BASE,
  horasMinTotales: 1200,
  horasMinCB: 544,
  horasMinTB: 104,
  horasMinTA: 168,
  horasMinCTX: 320,
};

const PLAN_CON_CONFIG_FORMACION = {
  ...PLAN_BASE,
  requierePPS: true,
  requierePI: false,
  porcentajeMinFormacion: 15,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeScope(tieneScope = true) {
  return { tieneScopeCarrera: jest.fn().mockResolvedValue(tieneScope) };
}

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  return {
    planEstudio: {
      findUnique:           jest.fn().mockResolvedValue(PLAN_BASE),
      findUniqueOrThrow:    jest.fn().mockResolvedValue(PLAN_BASE),
      update:               jest.fn().mockResolvedValue(PLAN_CON_UMBRALES),
    },
    ...overrides,
  };
}

const makeService = (prisma: any, scope: any) =>
  new ConfigPlanService(prisma as any, scope as any);

// ── Tests: obtenerUmbrales ────────────────────────────────────────────────────

describe('ConfigPlanService — obtenerUmbrales', () => {

  describe('Caso 1: plan inexistente → 404', () => {
    it('lanza NotFoundException si el plan no existe', async () => {
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue(null),
          findUniqueOrThrow: jest.fn(),
          update: jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.obtenerUmbrales(PLAN_ID, USUARIO_ID, 'ADMINISTRADOR_SISTEMA'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Caso 2: usuario sin scope → 403', () => {
    it('lanza ForbiddenException si el usuario no tiene scope sobre la carrera del plan', async () => {
      const service = makeService(makePrisma(), makeScope(false));
      await expect(
        service.obtenerUmbrales(PLAN_ID, USUARIO_ID, 'DIRECTOR_CARRERA'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Caso 3: plan con todos los umbrales en null', () => {
    it('devuelve todos los campos null sin lanzar error', async () => {
      const service = makeService(makePrisma(), makeScope());
      const result = await service.obtenerUmbrales(PLAN_ID, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(result.horasMinTotales).toBeNull();
      expect(result.horasMinCB).toBeNull();
      expect(result.horasMinCTX).toBeNull();
    });
  });

  describe('Caso 4: roles autorizados obtienen umbrales', () => {
    it.each(['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'RECTORADO', 'DECANO', 'DIRECTOR_CARRERA'])(
      'devuelve la configuración cuando el rol es %s',
      async (rol) => {
        const service = makeService(makePrisma(), makeScope());
        const result = await service.obtenerUmbrales(PLAN_ID, USUARIO_ID, rol);
        expect(result.planEstudioId).toBe(PLAN_ID);
      },
    );
  });
});

// ── Tests: actualizarUmbrales ─────────────────────────────────────────────────

describe('ConfigPlanService — actualizarUmbrales', () => {

  describe('Caso 5: plan inexistente → 404', () => {
    it('lanza NotFoundException si el plan no existe', async () => {
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue(null),
          findUniqueOrThrow: jest.fn(),
          update: jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      await expect(
        service.actualizarUmbrales(PLAN_ID, { horasMinTotales: 1200 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Caso 6: actualización parcial — solo los campos enviados se modifican', () => {
    it('llama a prisma.update solo con los campos presentes en el DTO', async () => {
      const updateMock = jest.fn().mockResolvedValue(PLAN_CON_UMBRALES);
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({ id: PLAN_ID }),
          findUniqueOrThrow: jest.fn(),
          update: updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      await service.actualizarUmbrales(PLAN_ID, { horasMinCB: 544 });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ horasMinCB: 544 }),
        }),
      );
      // horasMinTotales no fue enviado → no debe estar en data
      const callData = updateMock.mock.calls[0][0].data;
      expect('horasMinTotales' in callData).toBe(false);
    });
  });

  describe('Caso 7: null en un campo limpiar umbral → escribe null en DB', () => {
    it('almacena null cuando se envía horasMinCB: null', async () => {
      const updateMock = jest.fn().mockResolvedValue({ ...PLAN_BASE, horasMinCB: null });
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({ id: PLAN_ID }),
          findUniqueOrThrow: jest.fn(),
          update: updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      await service.actualizarUmbrales(PLAN_ID, { horasMinCB: null });

      const callData = updateMock.mock.calls[0][0].data;
      expect(callData.horasMinCB).toBeNull();
    });
  });

  describe('Caso 8: DTO vacío — no llama a update', () => {
    it('retorna los umbrales actuales sin actualizar cuando el DTO no tiene campos', async () => {
      const updateMock = jest.fn();
      const findUniqueOrThrowMock = jest.fn().mockResolvedValue(PLAN_BASE);
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({ id: PLAN_ID }),
          findUniqueOrThrow: findUniqueOrThrowMock,
          update: updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      await service.actualizarUmbrales(PLAN_ID, {});

      expect(updateMock).not.toHaveBeenCalled();
      expect(findUniqueOrThrowMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Caso 9: campos R-13 (formación práctica) — nullable semantics', () => {
    it('guarda requierePPS=true, requierePI=false, porcentajeMinFormacion=15', async () => {
      const updateMock = jest.fn().mockResolvedValue(PLAN_CON_CONFIG_FORMACION);
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({ id: PLAN_ID }),
          findUniqueOrThrow: jest.fn(),
          update: updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      await service.actualizarUmbrales(PLAN_ID, {
        requierePPS: true,
        requierePI: false,
        porcentajeMinFormacion: 15,
      });
      const data = updateMock.mock.calls[0][0].data;
      expect(data.requierePPS).toBe(true);
      expect(data.requierePI).toBe(false);
      expect(data.porcentajeMinFormacion).toBe(15);
    });

    it('null en requierePPS borra el campo (escribe null en DB)', async () => {
      const updateMock = jest.fn().mockResolvedValue(PLAN_BASE);
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue({ id: PLAN_ID }),
          findUniqueOrThrow: jest.fn(),
          update: updateMock,
        },
      });
      const service = makeService(prisma, makeScope());
      await service.actualizarUmbrales(PLAN_ID, { requierePPS: null });
      const data = updateMock.mock.calls[0][0].data;
      expect(data.requierePPS).toBeNull();
      expect('requierePI' in data).toBe(false);
    });

    it('obtenerUmbrales devuelve los campos R-13', async () => {
      const prisma = makePrisma({
        planEstudio: {
          findUnique: jest.fn().mockResolvedValue(PLAN_CON_CONFIG_FORMACION),
          findUniqueOrThrow: jest.fn(),
          update: jest.fn(),
        },
      });
      const service = makeService(prisma, makeScope());
      const res = await service.obtenerUmbrales(PLAN_ID, USUARIO_ID, 'ADMINISTRADOR_SISTEMA');
      expect(res.requierePPS).toBe(true);
      expect(res.requierePI).toBe(false);
      expect(res.porcentajeMinFormacion).toBe(15);
    });
  });
});
