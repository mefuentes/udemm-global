import { DocentesService } from './docentes.service';

const DOCENTE_ID  = 'docente-baja-id';
const OPERADOR_ID = 'operador-id';

const BASE_DOCENTE = {
  id: DOCENTE_ID,
  nombre: 'JUAN',
  apellido: 'PÉREZ',
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  correoElectronico: 'juan@test.com',
  activo: true,
  fechaNacimiento: null,
  fechaCreacion: new Date(),
  fechaActualizacion: new Date(),
  usuario: null,
};

// Construye el mock de prisma para los casos exitosos.
// vinculacionCount simula cuántas vinculaciones se cerrarán.
function makePrismaOk(vinculacionCount = 0) {
  const txMock = {
    docente: {
      update: jest.fn().mockResolvedValue({ ...BASE_DOCENTE, activo: false }),
    },
    vinculacionCatedra: {
      updateMany: jest.fn().mockResolvedValue({ count: vinculacionCount }),
    },
  };

  const prisma = {
    docente: {
      findUnique: jest.fn().mockResolvedValue(BASE_DOCENTE),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };

  return { prisma, txMock };
}

const makeService = (prisma: any) => new DocentesService(prisma as any);

describe('DocentesService — baja lógica con desvinculación automática', () => {

  // ── Caso 1 ──────────────────────────────────────────────────────────────────
  describe('Caso 1: docente activo con vinculaciones activas', () => {
    it('pone al docente inactivo y cierra todas las vinculaciones APROBADA y PENDIENTE', async () => {
      const { prisma, txMock } = makePrismaOk(3);
      const result = await makeService(prisma).eliminarDocente(DOCENTE_ID, OPERADOR_ID);

      // docente debe quedar inactivo
      expect(txMock.docente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DOCENTE_ID },
          data:  expect.objectContaining({ activo: false }),
        }),
      );

      // vinculaciones APROBADA y PENDIENTE deben cerrarse como DESVINCULADA
      expect(txMock.vinculacionCatedra.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            docenteId: DOCENTE_ID,
            estado: { in: ['APROBADA', 'PENDIENTE_DE_APROBACION'] },
          }),
          data: expect.objectContaining({
            estado: 'DESVINCULADA',
            desvinculadorId: OPERADOR_ID,
          }),
        }),
      );

      // el resultado refleja el docente inactivo
      expect(result.activo).toBe(false);

      // ambas operaciones ocurren dentro de la misma transacción
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── Caso 2 ──────────────────────────────────────────────────────────────────
  describe('Caso 2: docente sin vinculaciones activas', () => {
    it('da de baja al docente sin error aunque no haya vinculaciones que cerrar', async () => {
      const { prisma, txMock } = makePrismaOk(0);
      const result = await makeService(prisma).eliminarDocente(DOCENTE_ID, OPERADOR_ID);

      expect(result.activo).toBe(false);
      // updateMany sí se llama, pero no encuentra registros (count=0) — sin error
      expect(txMock.vinculacionCatedra.updateMany).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── Caso 3 ──────────────────────────────────────────────────────────────────
  describe('Caso 3: falla durante la transacción', () => {
    it('propaga el error y no deja estado inconsistente (rollback implícito de Prisma)', async () => {
      const prisma = {
        docente: {
          findUnique: jest.fn().mockResolvedValue(BASE_DOCENTE),
        },
        $transaction: jest.fn().mockRejectedValue(new Error('DB failure')),
      };

      await expect(makeService(prisma).eliminarDocente(DOCENTE_ID, OPERADOR_ID))
        .rejects.toThrow('DB failure');

      // la transacción fue iniciada pero falló
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── Caso 4 ──────────────────────────────────────────────────────────────────
  describe('Caso 4: reactivar un docente dado de baja', () => {
    it('NO restaura automáticamente las vinculaciones al reactivar (activo:true)', async () => {
      const vinculacionUpdateMany = jest.fn();
      const prisma = {
        docente: {
          findUnique: jest.fn().mockResolvedValue({ ...BASE_DOCENTE, activo: false }),
          findFirst:  jest.fn().mockResolvedValue(null),
          update:     jest.fn().mockResolvedValue({ ...BASE_DOCENTE, activo: true }),
        },
        vinculacionCatedra: { updateMany: vinculacionUpdateMany },
      };

      // Reactivar mediante actualizarDocente con activo:true
      await makeService(prisma).actualizarDocente(DOCENTE_ID, { activo: true } as any);

      // Las vinculaciones históricas NO deben restaurarse automáticamente
      expect(vinculacionUpdateMany).not.toHaveBeenCalled();
    });
  });

  // ── Caso 5 ──────────────────────────────────────────────────────────────────
  describe('Caso 5: baja lógica preserva historial — nunca borra físicamente VinculacionCatedra', () => {
    it('usa updateMany con estado=DESVINCULADA y nunca llama deleteMany', async () => {
      const deleteMany = jest.fn();
      const txMock = {
        docente: {
          update: jest.fn().mockResolvedValue({ ...BASE_DOCENTE, activo: false }),
        },
        vinculacionCatedra: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          deleteMany,
        },
      };
      const prisma = {
        docente: {
          findUnique: jest.fn().mockResolvedValue(BASE_DOCENTE),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn(txMock)),
      };

      await makeService(prisma).eliminarDocente(DOCENTE_ID, OPERADOR_ID);

      // Las vinculaciones se marcan DESVINCULADA, nunca se borran del registro histórico
      expect(txMock.vinculacionCatedra.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'DESVINCULADA' }),
        }),
      );
      expect(deleteMany).not.toHaveBeenCalled();
    });
  });

});
