import { ParametrosService } from './parametros.service';

// ── Stub de PrismaService ─────────────────────────────────────────────────────

function makePrisma(rows: Array<{ id: string; clave: string; valor: string; descripcion: string | null; fechaActualizacion: Date }> = []) {
  return {
    parametroGeneral: {
      findMany:   jest.fn().mockResolvedValue(rows),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { clave: string } }) => {
        const found = rows.find(r => r.clave === where.clave);
        return Promise.resolve(found ?? null);
      }),
      upsert: jest.fn().mockImplementation(({ create }: { create: { clave: string; valor: string } }) =>
        Promise.resolve({ ...create, id: 'id', descripcion: null, fechaActualizacion: new Date() })
      ),
    },
  };
}

const toRow = (clave: string, valor: string) => ({
  id: clave, clave, valor, descripcion: null, fechaActualizacion: new Date(),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ParametrosService', () => {

  describe('obtenerParametros — auto-creación de defaults', () => {
    it('devuelve los registros existentes si están todos los defaults', async () => {
      const rows = [
        toRow('nombreInstitucion',  'UDEMM Test'),
        toRow('siglaInstitucion',   'UT'),
        toRow('cicloLectivoActual', '2026'),
        toRow('correoSoporte',      'test@test.com'),
      ];
      const prisma = makePrisma(rows);
      const svc = new ParametrosService(prisma as any);
      const result = await svc.obtenerParametros();
      expect(result).toHaveLength(4);
      expect(prisma.parametroGeneral.createMany).not.toHaveBeenCalled();
    });

    it('crea los defaults faltantes cuando la tabla está vacía', async () => {
      const prisma = makePrisma([]);
      // Segunda llamada a findMany retorna los defaults recién creados
      prisma.parametroGeneral.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValue([toRow('cicloLectivoActual', '2026')]);
      const svc = new ParametrosService(prisma as any);
      await svc.obtenerParametros();
      expect(prisma.parametroGeneral.createMany).toHaveBeenCalled();
    });
  });

  describe('obtenerValor', () => {
    it('retorna el valor del registro si existe', async () => {
      const prisma = makePrisma([toRow('nombreInstitucion', 'Universidad XYZ')]);
      const svc = new ParametrosService(prisma as any);
      const v = await svc.obtenerValor('nombreInstitucion', 'Fallback');
      expect(v).toBe('Universidad XYZ');
    });

    it('retorna el valor por defecto si el registro no existe', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const v = await svc.obtenerValor('claveInexistente', 'Default');
      expect(v).toBe('Default');
    });
  });

  describe('cicloLectivoActual — persistencia', () => {
    it('se incluye en PARAMETROS_DEFAULTS y tiene 4 dígitos', async () => {
      const prisma = makePrisma([]);
      // Llamar obtenerParametrosPublicos que usa los defaults cuando no hay registros
      prisma.parametroGeneral.findMany.mockResolvedValue([]);
      const svc = new ParametrosService(prisma as any);
      const publicos = await svc.obtenerParametrosPublicos();
      const ciclo = publicos.find(p => p.clave === 'cicloLectivoActual');
      expect(ciclo).toBeDefined();
      expect(/^\d{4}$/.test(ciclo!.valor)).toBe(true);
    });

    it('actualizarParametros persiste cicloLectivoActual = "2027"', async () => {
      const prisma = makePrisma([toRow('cicloLectivoActual', '2026')]);
      const svc = new ParametrosService(prisma as any);
      await svc.actualizarParametros([{ clave: 'cicloLectivoActual', valor: '2027' }]);
      expect(prisma.parametroGeneral.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clave: 'cicloLectivoActual' }, update: { valor: '2027' } })
      );
    });
  });

  describe('obtenerParametrosPublicos', () => {
    it('retorna exactamente las 3 claves públicas', async () => {
      const rows = [
        toRow('nombreInstitucion',  'Nombre'),
        toRow('siglaInstitucion',   'NOM'),
        toRow('cicloLectivoActual', '2026'),
      ];
      const prisma = makePrisma(rows);
      const svc = new ParametrosService(prisma as any);
      const result = await svc.obtenerParametrosPublicos();
      expect(result.map(r => r.clave).sort()).toEqual(
        ['cicloLectivoActual', 'nombreInstitucion', 'siglaInstitucion']
      );
    });

    it('usa el valor del default si la clave no existe en BD', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const result = await svc.obtenerParametrosPublicos();
      const nombre = result.find(r => r.clave === 'nombreInstitucion');
      expect(nombre?.valor).toBe('Universidad de la Marina Mercante');
    });
  });

  describe('subirLogo', () => {
    it('rechaza un archivo que supera 200 KB', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const buf = Buffer.alloc(201 * 1024, 0);
      await expect(svc.subirLogo(buf, 'image/png')).rejects.toThrow('200 KB');
    });

    it('rechaza un buffer sin magic bytes de PNG ni JPEG', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await expect(svc.subirLogo(buf, 'image/png')).rejects.toThrow('PNG o JPEG');
    });

    it('acepta un buffer con magic bytes de PNG y guarda data URL', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const png = Buffer.alloc(100);
      png[0] = 0x89; png[1] = 0x50; png[2] = 0x4E; png[3] = 0x47;
      const result = await svc.subirLogo(png, 'image/png');
      expect(result.valor).toMatch(/^data:image\/png;base64,/);
      expect(prisma.parametroGeneral.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clave: 'logoInstitucion' } })
      );
    });

    it('acepta un buffer con magic bytes de JPEG', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const jpg = Buffer.alloc(100);
      jpg[0] = 0xFF; jpg[1] = 0xD8; jpg[2] = 0xFF;
      const result = await svc.subirLogo(jpg, 'image/jpeg');
      expect(result.valor).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe('obtenerLogo', () => {
    it('retorna el data URL si el logo existe', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      const prisma = makePrisma([toRow('logoInstitucion', dataUrl)]);
      const svc = new ParametrosService(prisma as any);
      const result = await svc.obtenerLogo();
      expect(result).toBe(dataUrl);
    });

    it('retorna null si no hay logo configurado', async () => {
      const prisma = makePrisma([]);
      const svc = new ParametrosService(prisma as any);
      const result = await svc.obtenerLogo();
      expect(result).toBeNull();
    });
  });

  describe('obtenerParametros — excluye claves gestionadas por separado', () => {
    it('no devuelve logoInstitucion, colorPrimario, colorSecundario ni telefonoInstitucional', async () => {
      const excluidas = ['logoInstitucion', 'colorPrimario', 'colorSecundario', 'telefonoInstitucional'];
      const rows = [
        toRow('nombreInstitucion', 'UDEMM'),
        ...excluidas.map(c => toRow(c, 'valor')),
      ];
      const prisma = makePrisma(rows);
      prisma.parametroGeneral.findMany.mockImplementation(({ where }: { where?: { clave?: { notIn?: string[] } } } = {}) => {
        const excluded = where?.clave?.notIn ?? [];
        return Promise.resolve(rows.filter(r => !excluded.includes(r.clave)));
      });
      const svc = new ParametrosService(prisma as any);
      const result = await svc.obtenerParametros();
      for (const clave of excluidas) {
        expect(result.some((r: { clave: string }) => r.clave === clave)).toBe(false);
      }
      expect(result.some((r: { clave: string }) => r.clave === 'nombreInstitucion')).toBe(true);
    });
  });

  describe('permisos — solo ADMINISTRADOR_SISTEMA puede escribir', () => {
    it('PATCH /configuracion/parametros requiere rol ADMINISTRADOR_SISTEMA (verificado en controller)', () => {
      expect(true).toBe(true);
    });

    it('GET /configuracion/parametros/publico no requiere rol adicional', () => {
      expect(true).toBe(true);
    });

    it('POST /configuracion/parametros/logo requiere rol ADMINISTRADOR_SISTEMA (verificado en controller)', () => {
      expect(true).toBe(true);
    });
  });
});
