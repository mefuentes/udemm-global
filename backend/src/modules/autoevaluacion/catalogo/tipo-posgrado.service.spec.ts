/**
 * Tests para TipoPosgradoService (D-06 — CIERRE-03 Fase B)
 *
 * Usa mock de PrismaService — no requiere base de datos.
 * El catálogo tiene 3 niveles: DOCTORADO, MAESTRIA, ESPECIALIZACION.
 * SIN_POSGRADO no es un registro de tabla — se representa como null FK.
 */

import { NotFoundException } from '@nestjs/common';
import {
  TipoPosgradoService,
  NOMBRE_POSGRADO,
  JERARQUIA_POSGRADO,
  type TipoPosgradoDto,
} from './tipo-posgrado.service';

// ── Factories ─────────────────────────────────────────────────────────────────

const mkTipo = (overrides: Partial<TipoPosgradoDto> = {}): TipoPosgradoDto => ({
  id: 'uuid-doc-0001',
  nombre: 'DOCTORADO',
  activo: true,
  ...overrides,
});

const SEED_TIPOS: TipoPosgradoDto[] = [
  mkTipo({ id: 'uuid-doc-0001', nombre: 'DOCTORADO'       }),
  mkTipo({ id: 'uuid-mae-0002', nombre: 'MAESTRIA'        }),
  mkTipo({ id: 'uuid-esp-0003', nombre: 'ESPECIALIZACION' }),
];

// ── Mock builder ──────────────────────────────────────────────────────────────

function makeSvc(dbData: TipoPosgradoDto[] = SEED_TIPOS) {
  const findMany = jest.fn(({ where }: { where?: { activo?: boolean } } = {}) => {
    if (where?.activo === true) return dbData.filter((t) => t.activo);
    return dbData;
  });

  const findUnique = jest.fn(
    ({ where }: { where: { nombre?: string; id?: string } }) => {
      if (where.nombre) return dbData.find((t) => t.nombre === where.nombre) ?? null;
      if (where.id)     return dbData.find((t) => t.id     === where.id)     ?? null;
      return null;
    },
  );

  const prisma = {
    get tipoPosgrado() {
      return { findMany, findUnique };
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;

  const svc = new TipoPosgradoService(prisma);
  return { svc, findMany, findUnique };
}

// ── listar() ─────────────────────────────────────────────────────────────────

describe('TipoPosgradoService — listar()', () => {
  it('devuelve los tres tipos activos del catálogo', async () => {
    const { svc } = makeSvc();
    const result = await svc.listar();
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.nombre)).toEqual(
      expect.arrayContaining(['DOCTORADO', 'MAESTRIA', 'ESPECIALIZACION']),
    );
  });

  it('soloActivos=true filtra inactivos', async () => {
    const datos = [
      ...SEED_TIPOS,
      mkTipo({ id: 'uuid-obs-0099', nombre: 'OBSOLETO', activo: false }),
    ];
    const { svc } = makeSvc(datos);
    const result = await svc.listar(true);
    expect(result.every((t) => t.activo)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('soloActivos=false incluye inactivos', async () => {
    const datos = [
      ...SEED_TIPOS,
      mkTipo({ id: 'uuid-obs-0099', nombre: 'OBSOLETO', activo: false }),
    ];
    const { svc } = makeSvc(datos);
    const result = await svc.listar(false);
    expect(result).toHaveLength(4);
  });

  it('catálogo vacío devuelve array vacío', async () => {
    const { svc } = makeSvc([]);
    expect(await svc.listar()).toEqual([]);
  });
});

// ── obtenerPorNombre() ────────────────────────────────────────────────────────

describe('TipoPosgradoService — obtenerPorNombre()', () => {
  it.each(Object.values(NOMBRE_POSGRADO))(
    'encuentra el tipo canónico "%s"',
    async (nombre) => {
      const { svc } = makeSvc();
      const result = await svc.obtenerPorNombre(nombre);
      expect(result).not.toBeNull();
      expect(result!.nombre).toBe(nombre);
    },
  );

  it('devuelve null para nombre no registrado', async () => {
    const { svc } = makeSvc();
    expect(await svc.obtenerPorNombre('LICENCIATURA')).toBeNull();
  });

  it('devuelve null para nombre vacío', async () => {
    const { svc } = makeSvc();
    expect(await svc.obtenerPorNombre('')).toBeNull();
  });

  it('SIN_POSGRADO no está en el catálogo (se representa como null FK)', async () => {
    const { svc } = makeSvc();
    expect(await svc.obtenerPorNombre('SIN_POSGRADO')).toBeNull();
  });
});

// ── obtenerPorId() ────────────────────────────────────────────────────────────

describe('TipoPosgradoService — obtenerPorId()', () => {
  it('devuelve el tipo correcto por id existente', async () => {
    const { svc } = makeSvc();
    const result = await svc.obtenerPorId('uuid-doc-0001');
    expect(result.nombre).toBe('DOCTORADO');
  });

  it('lanza NotFoundException cuando el id no existe', async () => {
    const { svc } = makeSvc();
    await expect(svc.obtenerPorId('uuid-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('el mensaje de la excepción menciona el id buscado', async () => {
    const { svc } = makeSvc();
    await expect(svc.obtenerPorId('bad-id')).rejects.toThrow(/bad-id/);
  });
});

// ── resolverTipoPorId() ───────────────────────────────────────────────────────

describe('TipoPosgradoService — resolverTipoPorId()', () => {
  it('devuelve null cuando tipoPosgradoId es null (= no clasificado)', async () => {
    const { svc } = makeSvc();
    expect(await svc.resolverTipoPorId(null)).toBeNull();
  });

  it('resuelve el tipo cuando se pasa un id válido', async () => {
    const { svc } = makeSvc();
    const result = await svc.resolverTipoPorId('uuid-mae-0002');
    expect(result).not.toBeNull();
    expect(result!.nombre).toBe('MAESTRIA');
  });

  it('propaga NotFoundException cuando el id no existe en el catálogo', async () => {
    const { svc } = makeSvc();
    await expect(svc.resolverTipoPorId('uuid-fantasma')).rejects.toThrow(NotFoundException);
  });

  it('null id → no llama a la base de datos', async () => {
    const { svc, findUnique } = makeSvc();
    await svc.resolverTipoPorId(null);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

// ── NOMBRE_POSGRADO y JERARQUIA_POSGRADO ──────────────────────────────────────

describe('NOMBRE_POSGRADO — constantes canónicas', () => {
  it('contiene exactamente DOCTORADO, MAESTRIA y ESPECIALIZACION', () => {
    const nombres = Object.values(NOMBRE_POSGRADO);
    expect(nombres).toHaveLength(3);
    expect(nombres).toEqual(
      expect.arrayContaining(['DOCTORADO', 'MAESTRIA', 'ESPECIALIZACION']),
    );
  });

  it('SIN_POSGRADO no es un nombre de catálogo (null FK lo representa)', () => {
    expect(Object.values(NOMBRE_POSGRADO)).not.toContain('SIN_POSGRADO');
  });
});

describe('JERARQUIA_POSGRADO — orden jerárquico', () => {
  it('DOCTORADO precede a MAESTRIA', () => {
    expect(JERARQUIA_POSGRADO.indexOf('DOCTORADO')).toBeLessThan(
      JERARQUIA_POSGRADO.indexOf('MAESTRIA'),
    );
  });

  it('MAESTRIA precede a ESPECIALIZACION', () => {
    expect(JERARQUIA_POSGRADO.indexOf('MAESTRIA')).toBeLessThan(
      JERARQUIA_POSGRADO.indexOf('ESPECIALIZACION'),
    );
  });

  it('contiene exactamente los tres niveles del catálogo', () => {
    expect(JERARQUIA_POSGRADO).toHaveLength(3);
    expect([...JERARQUIA_POSGRADO]).toEqual(
      expect.arrayContaining(['DOCTORADO', 'MAESTRIA', 'ESPECIALIZACION']),
    );
  });
});
