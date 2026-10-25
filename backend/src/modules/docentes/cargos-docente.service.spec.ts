import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CargosDocenteService } from './cargos-docente.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOCENTE_ID   = 'docente-uuid-1';
const CARGO_ID     = 'cargo-uuid-1';
const CARGO_DOC_ID = 'cargo-docente-uuid-1';
const USUARIO_ID   = 'usuario-uuid-1';
const ADMIN_ID     = 'admin-uuid';
const FACULTAD_ID  = 'facultad-uuid-1';
const CARRERA_ID   = 'carrera-uuid-1';

const docenteMock     = { id: DOCENTE_ID, activo: true, usuarioId: USUARIO_ID };
const cargoMock       = { id: CARGO_ID, nombre: 'Profesor Titular', activo: true };
const vinculacionMock = {
  id: 'vinc-1', docenteId: DOCENTE_ID,
  facultadId: FACULTAD_ID, carreraId: CARRERA_ID, estado: 'APROBADA',
};

const cargoDocenteMock = {
  id:            CARGO_DOC_ID,
  docenteId:     DOCENTE_ID,
  cargoId:       CARGO_ID,
  designacion:   'Designación A',
  fechaInicio:   new Date('2024-01-01'),
  fechaFin:      null,
  verificado:    false,
  observaciones: null,
  creadoPorId:   ADMIN_ID,
  fuente:        'SECRETARIA',
};

const cargoVerificadoMock = { ...cargoDocenteMock, verificado: true };

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeService = (prisma: any, scope?: any) =>
  new CargosDocenteService(
    prisma as any,
    (scope ?? { getCarrerasEnScope: jest.fn().mockResolvedValue([]) }) as any,
  );

/** Construye un mock de prisma con soporte para $transaction interactivo */
const withTx = (overrides: any) => ({
  ...overrides,
  $transaction: jest.fn().mockImplementation(async (fn: any) => {
    const tx: any = {
      cargoDocente: { ...(overrides.cargoDocente ?? {}), ...((overrides.txCargoDocente ?? {})) },
      docente:      { ...(overrides.docente ?? {}),      ...((overrides.txDocente ?? {})) },
    };
    return fn(tx);
  }),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('CargosDocenteService', () => {

  // ── obtenerCargos ──────────────────────────────────────────────────────────

  describe('obtenerCargos', () => {
    describe('control de alcance', () => {
      it('acceso global: ADMINISTRADOR_SISTEMA no requiere scope check', async () => {
        const findMany = jest.fn().mockResolvedValue([cargoDocenteMock]);
        const svc = makeService({
          docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          cargoDocente: { findMany },
        });
        expect(await svc.obtenerCargos(DOCENTE_ID, undefined, ADMIN_ID, 'ADMINISTRADOR_SISTEMA')).toEqual([cargoDocenteMock]);
      });

      it('DECANO con vinculacion activa en su facultad → permitido', async () => {
        const svc = makeService({
          docente:            { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          usuarioFacultad:    { findFirst: jest.fn().mockResolvedValue({ facultadId: FACULTAD_ID }) },
          vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(vinculacionMock) },
          cargoDocente:       { findMany: jest.fn().mockResolvedValue([]) },
        });
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, 'decano-uuid', 'DECANO')).resolves.toEqual([]);
      });

      it('DECANO sin asociacion de facultad → ForbiddenException', async () => {
        const svc = makeService({
          docente:         { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          usuarioFacultad: { findFirst: jest.fn().mockResolvedValue(null) },
        });
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, 'decano-uuid', 'DECANO')).rejects.toThrow(ForbiddenException);
      });

      it('DECANO con facultad pero docente sin vinculacion activa → ForbiddenException', async () => {
        const svc = makeService({
          docente:            { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          usuarioFacultad:    { findFirst: jest.fn().mockResolvedValue({ facultadId: FACULTAD_ID }) },
          vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(null) },
        });
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, 'decano-uuid', 'DECANO')).rejects.toThrow(ForbiddenException);
      });

      it('DIRECTOR_CARRERA con docente en su carrera → permitido', async () => {
        const scope = { getCarrerasEnScope: jest.fn().mockResolvedValue([CARRERA_ID]) };
        const svc = makeService({
          docente:            { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(vinculacionMock) },
          cargoDocente:       { findMany: jest.fn().mockResolvedValue([]) },
        }, scope);
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, 'director-uuid', 'DIRECTOR_CARRERA')).resolves.toEqual([]);
      });

      it('DIRECTOR_CARRERA sin carreras en scope → ForbiddenException', async () => {
        const scope = { getCarrerasEnScope: jest.fn().mockResolvedValue([]) };
        const svc = makeService({ docente: { findUnique: jest.fn().mockResolvedValue(docenteMock) } }, scope);
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, 'director-uuid', 'DIRECTOR_CARRERA')).rejects.toThrow(ForbiddenException);
      });

      it('DIRECTOR_CARRERA con carreras pero docente sin vinculacion → ForbiddenException', async () => {
        const scope = { getCarrerasEnScope: jest.fn().mockResolvedValue([CARRERA_ID]) };
        const svc = makeService({
          docente:            { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          vinculacionCatedra: { findFirst: jest.fn().mockResolvedValue(null) },
        }, scope);
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, 'director-uuid', 'DIRECTOR_CARRERA')).rejects.toThrow(ForbiddenException);
      });

      it('rol sin alcance de gestión (DOCENTE) → ForbiddenException', async () => {
        const svc = makeService({ docente: { findUnique: jest.fn().mockResolvedValue(docenteMock) } });
        await expect(svc.obtenerCargos(DOCENTE_ID, undefined, USUARIO_ID, 'DOCENTE')).rejects.toThrow(ForbiddenException);
      });

      it('lanza NotFoundException si el docente no existe', async () => {
        const svc = makeService({ docente: { findUnique: jest.fn().mockResolvedValue(null) } });
        await expect(svc.obtenerCargos('inexistente', undefined, ADMIN_ID, 'ADMINISTRADOR_SISTEMA')).rejects.toThrow(NotFoundException);
      });
    });

    describe('filtro de vigencia K-D6', () => {
      const buildSvc = () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const svc = makeService({
          docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock) },
          cargoDocente: { findMany },
        });
        return { svc, findMany };
      };

      it('sin filtro: retorna todos sin restriccion de fechas', async () => {
        const { svc, findMany } = buildSvc();
        await svc.obtenerCargos(DOCENTE_ID, undefined, ADMIN_ID, 'ADMINISTRADOR_SISTEMA');
        const where = findMany.mock.calls[0][0].where;
        expect(where).not.toHaveProperty('fechaInicio');
        expect(where).not.toHaveProperty('OR');
        expect(where).not.toHaveProperty('AND');
      });

      it('vigente: usa lte(fechaInicio) y OR con gt(fechaFin) — K-D6 estrictamente mayor', async () => {
        const { svc, findMany } = buildSvc();
        await svc.obtenerCargos(DOCENTE_ID, 'vigente', ADMIN_ID, 'ADMINISTRADOR_SISTEMA');
        const where = findMany.mock.calls[0][0].where;
        expect(where.fechaInicio).toEqual({ lte: expect.any(Date) });
        const orFin = where.OR.find((c: any) => c.fechaFin);
        // K-D6: fechaFin > fechaCalculo (gt, NO gte — fechaFin igual al instante NO es vigente)
        expect(orFin.fechaFin).toEqual({ gt: expect.any(Date) });
      });

      it('vigente: incluye cargos sin fechaFin (indefinidos)', async () => {
        const { svc, findMany } = buildSvc();
        await svc.obtenerCargos(DOCENTE_ID, 'vigente', ADMIN_ID, 'ADMINISTRADOR_SISTEMA');
        expect(findMany.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([{ fechaFin: null }]));
      });

      it('futuro: usa gt(fechaInicio)', async () => {
        const { svc, findMany } = buildSvc();
        await svc.obtenerCargos(DOCENTE_ID, 'futuro', ADMIN_ID, 'ADMINISTRADOR_SISTEMA');
        const where = findMany.mock.calls[0][0].where;
        expect(where.fechaInicio).toEqual({ gt: expect.any(Date) });
        expect(where).not.toHaveProperty('OR');
      });

      it('historico: usa AND con fechaFin not null y lte', async () => {
        const { svc, findMany } = buildSvc();
        await svc.obtenerCargos(DOCENTE_ID, 'historico', ADMIN_ID, 'ADMINISTRADOR_SISTEMA');
        expect(findMany.mock.calls[0][0].where.AND).toEqual(
          expect.arrayContaining([
            { fechaFin: { not: null } },
            { fechaFin: { lte: expect.any(Date) } },
          ]),
        );
      });

      it('vigencia inválida → BadRequestException (no retorna todos los registros)', async () => {
        const { svc } = buildSvc();
        await expect(
          svc.obtenerCargos(DOCENTE_ID, 'invalido' as any, ADMIN_ID, 'ADMINISTRADOR_SISTEMA'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ── obtenerCargosPropio ────────────────────────────────────────────────────

  describe('obtenerCargosPropio', () => {
    it('lanza NotFoundException si el usuario no tiene docente asociado', async () => {
      const svc = makeService({ docente: { findFirst: jest.fn().mockResolvedValue(null) } });
      await expect(svc.obtenerCargosPropio(USUARIO_ID, undefined)).rejects.toThrow(NotFoundException);
    });

    it('retorna los cargos del propio docente sin verificar scope', async () => {
      const lista = [cargoDocenteMock];
      const svc = makeService({
        docente:      { findFirst: jest.fn().mockResolvedValue(docenteMock) },
        cargoDocente: { findMany: jest.fn().mockResolvedValue(lista) },
      });
      expect(await svc.obtenerCargosPropio(USUARIO_ID, undefined)).toEqual(lista);
    });

    it('DOCENTE no puede usar obtenerCargos de otro docente → ForbiddenException', async () => {
      const svc = makeService({ docente: { findUnique: jest.fn().mockResolvedValue(docenteMock) } });
      await expect(svc.obtenerCargos('otro-docente-id', undefined, USUARIO_ID, 'DOCENTE')).rejects.toThrow(ForbiddenException);
    });

    it('vigencia inválida en obtenerCargosPropio → BadRequestException', async () => {
      const svc = makeService({ docente: { findFirst: jest.fn().mockResolvedValue(docenteMock) } });
      await expect(svc.obtenerCargosPropio(USUARIO_ID, 'malo' as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ── crearCargo ─────────────────────────────────────────────────────────────

  describe('crearCargo', () => {
    it('lanza NotFoundException si el docente no existe', async () => {
      const svc = makeService({ docente: { findUnique: jest.fn().mockResolvedValue(null) } });
      await expect(
        svc.crearCargo('inexistente', { cargoId: CARGO_ID, fechaInicio: '2025-01-01' }, ADMIN_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el cargo no existe', async () => {
      const svc = makeService({
        docente: { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargo:   { findUnique: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.crearCargo(DOCENTE_ID, { cargoId: CARGO_ID, fechaInicio: '2025-01-01' }, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el cargo está inactivo', async () => {
      const svc = makeService({
        docente: { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargo:   { findUnique: jest.fn().mockResolvedValue({ ...cargoMock, activo: false }) },
      });
      await expect(
        svc.crearCargo(DOCENTE_ID, { cargoId: CARGO_ID, fechaInicio: '2025-01-01' }, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si fechaFin <= fechaInicio', async () => {
      const svc = makeService({
        docente: { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargo:   { findUnique: jest.fn().mockResolvedValue(cargoMock) },
      });
      await expect(
        svc.crearCargo(DOCENTE_ID, { cargoId: CARGO_ID, fechaInicio: '2025-06-01', fechaFin: '2025-05-01' }, ADMIN_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea cargo con fechaFin null y fuente por defecto del modelo', async () => {
      const createFn = jest.fn().mockResolvedValue(cargoDocenteMock);
      const updateFn = jest.fn().mockResolvedValue(docenteMock);
      const svc = makeService(withTx({
        docente:           { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargo:             { findUnique: jest.fn().mockResolvedValue(cargoMock) },
        txCargoDocente:    { create: createFn },
        txDocente:         { update: updateFn },
      }));
      await svc.crearCargo(DOCENTE_ID, { cargoId: CARGO_ID, fechaInicio: '2024-01-01' }, ADMIN_ID);
      expect(createFn.mock.calls[0][0].data.fechaFin).toBeNull();
      expect(createFn.mock.calls[0][0].data).not.toHaveProperty('fuente');
    });

    it('D3C-A: creación resetea relevamientoCargosCompleto del docente', async () => {
      const createFn = jest.fn().mockResolvedValue(cargoDocenteMock);
      const updateDocFn = jest.fn().mockResolvedValue(docenteMock);
      const svc = makeService(withTx({
        docente:        { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargo:          { findUnique: jest.fn().mockResolvedValue(cargoMock) },
        txCargoDocente: { create: createFn },
        txDocente:      { update: updateDocFn },
      }));
      await svc.crearCargo(DOCENTE_ID, { cargoId: CARGO_ID, fechaInicio: '2025-01-01' }, ADMIN_ID);
      expect(updateDocFn).toHaveBeenCalledWith({
        where: { id: DOCENTE_ID },
        data:  { relevamientoCargosCompleto: false },
      });
    });

    it('crea el cargo con fechaFin cuando fechaFin > fechaInicio', async () => {
      const createFn = jest.fn().mockResolvedValue({ ...cargoDocenteMock, fechaFin: new Date('2027-12-31') });
      const svc = makeService(withTx({
        docente:        { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargo:          { findUnique: jest.fn().mockResolvedValue(cargoMock) },
        txCargoDocente: { create: createFn },
        txDocente:      { update: jest.fn().mockResolvedValue(docenteMock) },
      }));
      await svc.crearCargo(DOCENTE_ID, { cargoId: CARGO_ID, fechaInicio: '2025-01-01', fechaFin: '2027-12-31' }, ADMIN_ID);
      expect(createFn.mock.calls[0][0].data.fechaFin).toEqual(new Date('2027-12-31'));
    });
  });

  // ── actualizarCargo ────────────────────────────────────────────────────────

  describe('actualizarCargo', () => {
    it('lanza NotFoundException si el cargo no existe', async () => {
      const svc = makeService({ cargoDocente: { findUnique: jest.fn().mockResolvedValue(null) } });
      await expect(svc.actualizarCargo(DOCENTE_ID, 'inexistente', {})).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el cargo no pertenece al docente', async () => {
      const svc = makeService({
        cargoDocente: { findUnique: jest.fn().mockResolvedValue({ ...cargoDocenteMock, docenteId: 'otro' }) },
      });
      await expect(svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, {})).rejects.toThrow(ForbiddenException);
    });

    it('lanza BadRequestException si la fechaFin resultante queda <= fechaInicio', async () => {
      const svc = makeService({
        cargoDocente: { findUnique: jest.fn().mockResolvedValue(cargoDocenteMock) },
      });
      await expect(svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { fechaFin: '2023-12-31' })).rejects.toThrow(BadRequestException);
    });

    it('actualiza verificado a true (acto de verificación institucional)', async () => {
      const updateFn = jest.fn().mockResolvedValue({ ...cargoDocenteMock, verificado: true });
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoDocenteMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: jest.fn() },
      }));
      const res = await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { verificado: true });
      expect(res.verificado).toBe(true);
    });

    it('actualiza fechaFin a null (cargo indefinido)', async () => {
      const cargoConFin = { ...cargoDocenteMock, fechaFin: new Date('2027-01-01') };
      const updateFn   = jest.fn().mockResolvedValue({ ...cargoConFin, fechaFin: null });
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoConFin) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: jest.fn().mockResolvedValue(docenteMock) },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { fechaFin: null });
      expect(updateFn.mock.calls[0][0].data).toMatchObject({ fechaFin: null });
    });

    it('no incluye en data campos no enviados (actualización parcial)', async () => {
      const updateFn = jest.fn().mockResolvedValue(cargoDocenteMock);
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoDocenteMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: jest.fn() },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { observaciones: 'Nota' });
      const data = updateFn.mock.calls[0][0].data;
      expect(data).toHaveProperty('observaciones', 'Nota');
      expect(data).not.toHaveProperty('verificado');
      expect(data).not.toHaveProperty('fechaInicio');
      expect(data).not.toHaveProperty('cargoId');
      expect(data).not.toHaveProperty('docenteId');
      expect(data).not.toHaveProperty('fuente');
    });

    // ── D3C §3: Consistencia relevamiento ─────────────────────────────────────

    it('D3C-B: cambio de fechaInicio en cargo verificado invalida verificado y resetea relevamiento', async () => {
      const updateFn    = jest.fn().mockResolvedValue({ ...cargoVerificadoMock, verificado: false });
      const updateDocFn = jest.fn().mockResolvedValue(docenteMock);
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoVerificadoMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: updateDocFn },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { fechaInicio: '2025-06-01' });
      expect(updateFn.mock.calls[0][0].data).toMatchObject({ verificado: false });
      expect(updateDocFn).toHaveBeenCalledWith({
        where: { id: DOCENTE_ID },
        data:  { relevamientoCargosCompleto: false },
      });
    });

    it('D3C-B: cambio de fechaFin en cargo verificado invalida verificado', async () => {
      const updateFn = jest.fn().mockResolvedValue({ ...cargoVerificadoMock, verificado: false, fechaFin: new Date('2028-01-01') });
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoVerificadoMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: jest.fn().mockResolvedValue(docenteMock) },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { fechaFin: '2028-01-01' });
      expect(updateFn.mock.calls[0][0].data).toMatchObject({ verificado: false });
    });

    it('D3C-B: cambio de designacion en cargo verificado invalida verificado', async () => {
      const updateFn = jest.fn().mockResolvedValue({ ...cargoVerificadoMock, verificado: false });
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoVerificadoMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: jest.fn().mockResolvedValue(docenteMock) },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { designacion: 'Nueva designación' });
      expect(updateFn.mock.calls[0][0].data).toMatchObject({ verificado: false });
    });

    it('D3C-B: no se puede verificar y modificar datos sustantivos en el mismo acto', async () => {
      const svc = makeService({
        cargoDocente: { findUnique: jest.fn().mockResolvedValue(cargoDocenteMock) },
      });
      await expect(
        svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { fechaInicio: '2025-01-01', verificado: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('D3C-C: cambio solo de observaciones NO invalida verificado ni resetea relevamiento', async () => {
      const updateFn    = jest.fn().mockResolvedValue({ ...cargoVerificadoMock, observaciones: 'Nota nueva' });
      const updateDocFn = jest.fn();
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoVerificadoMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: updateDocFn },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { observaciones: 'Nota nueva' });
      // verificado no debe forzarse a false
      expect(updateFn.mock.calls[0][0].data).not.toHaveProperty('verificado');
      // Docente.update no debe llamarse
      expect(updateDocFn).not.toHaveBeenCalled();
    });

    it('D3C-D: verificar cargo pendiente (sin cambio sustantivo) está permitido', async () => {
      const updateFn = jest.fn().mockResolvedValue({ ...cargoDocenteMock, verificado: true });
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoDocenteMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: jest.fn() },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { verificado: true });
      expect(updateFn.mock.calls[0][0].data).toMatchObject({ verificado: true });
    });

    it('desverificar un cargo (verificado: false) resetea el relevamiento', async () => {
      const updateFn    = jest.fn().mockResolvedValue({ ...cargoVerificadoMock, verificado: false });
      const updateDocFn = jest.fn().mockResolvedValue(docenteMock);
      const svc = makeService(withTx({
        cargoDocente:  { findUnique: jest.fn().mockResolvedValue(cargoVerificadoMock) },
        txCargoDocente:{ update: updateFn },
        txDocente:     { update: updateDocFn },
      }));
      await svc.actualizarCargo(DOCENTE_ID, CARGO_DOC_ID, { verificado: false });
      expect(updateDocFn).toHaveBeenCalledWith({
        where: { id: DOCENTE_ID },
        data:  { relevamientoCargosCompleto: false },
      });
    });
  });

  // ── actualizarRelevamiento ─────────────────────────────────────────────────

  describe('actualizarRelevamiento', () => {
    it('lanza NotFoundException si el docente no existe', async () => {
      const svc = makeService({ docente: { findUnique: jest.fn().mockResolvedValue(null) } });
      await expect(svc.actualizarRelevamiento('inexistente', true)).rejects.toThrow(NotFoundException);
    });

    it('cierre denegado si existen cargos pendientes de verificación', async () => {
      const svc = makeService({
        docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock) },
        cargoDocente: { count: jest.fn().mockResolvedValue(2) },
      });
      await expect(svc.actualizarRelevamiento(DOCENTE_ID, true)).rejects.toThrow(BadRequestException);
    });

    it('cierre permitido si todos los cargos están verificados', async () => {
      const updateFn = jest.fn().mockResolvedValue({ id: DOCENTE_ID, relevamientoCargosCompleto: true });
      const svc = makeService({
        docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock), update: updateFn },
        cargoDocente: { count: jest.fn().mockResolvedValue(0) },
      });
      expect((await svc.actualizarRelevamiento(DOCENTE_ID, true)).relevamientoCargosCompleto).toBe(true);
    });

    it('D3C-E: cierre permitido si el docente no tiene cargos registrados', async () => {
      const updateFn = jest.fn().mockResolvedValue({ id: DOCENTE_ID, relevamientoCargosCompleto: true });
      const svc = makeService({
        docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock), update: updateFn },
        cargoDocente: { count: jest.fn().mockResolvedValue(0) },
      });
      await expect(svc.actualizarRelevamiento(DOCENTE_ID, true)).resolves.toMatchObject({ relevamientoCargosCompleto: true });
    });

    it('reapertura (false) siempre permitida sin validar cargos', async () => {
      const countFn  = jest.fn();
      const updateFn = jest.fn().mockResolvedValue({ id: DOCENTE_ID, relevamientoCargosCompleto: false });
      const svc = makeService({
        docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock), update: updateFn },
        cargoDocente: { count: countFn },
      });
      await svc.actualizarRelevamiento(DOCENTE_ID, false);
      expect(countFn).not.toHaveBeenCalled();
    });

    it('respuesta incluye solo id y relevamientoCargosCompleto (select)', async () => {
      const updateFn = jest.fn().mockResolvedValue({ id: DOCENTE_ID, relevamientoCargosCompleto: true });
      const svc = makeService({
        docente:      { findUnique: jest.fn().mockResolvedValue(docenteMock), update: updateFn },
        cargoDocente: { count: jest.fn().mockResolvedValue(0) },
      });
      await svc.actualizarRelevamiento(DOCENTE_ID, true);
      expect(updateFn.mock.calls[0][0].select).toEqual({ id: true, relevamientoCargosCompleto: true });
    });
  });
});
