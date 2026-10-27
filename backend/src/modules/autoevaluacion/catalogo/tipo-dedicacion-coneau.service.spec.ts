/**
 * Tests para TipoDedicacionConeauService (PREPARATORIO — CIERRE-03 Fase B D-05)
 *
 * El servicio usa `(prisma as any).tipoDedicacionConeau` porque la tabla aún no
 * existe en la base de datos. Estos tests usan un mock completo de PrismaService
 * y prueban el comportamiento del servicio, no la base de datos.
 */

import { NotFoundException } from '@nestjs/common';
import {
  TipoDedicacionConeauService,
  CODIGO_DEDICACION_CONEAU,
  type TipoDedicacionConeauDto,
} from './tipo-dedicacion-coneau.service';

// ── Factories ─────────────────────────────────────────────────────────────────

const mkTipo = (overrides: Partial<TipoDedicacionConeauDto> = {}): TipoDedicacionConeauDto => ({
  id: 'uuid-excl-0001',
  nombre: 'Exclusiva',
  codigo: 'EXCLUSIVA',
  activo: true,
  ...overrides,
});

const SEED_TIPOS: TipoDedicacionConeauDto[] = [
  mkTipo({ id: 'uuid-excl-0001', nombre: 'Exclusiva', codigo: 'EXCLUSIVA' }),
  mkTipo({ id: 'uuid-semi-0002', nombre: 'Semiexclusiva', codigo: 'SEMIEXCLUSIVA' }),
  mkTipo({ id: 'uuid-simp-0003', nombre: 'Simple', codigo: 'SIMPLE' }),
];

// ── Mock builder ──────────────────────────────────────────────────────────────

function makeSvc(dbData: TipoDedicacionConeauDto[] = SEED_TIPOS) {
  const findMany = jest.fn(({ where }: { where?: { activo?: boolean } } = {}) => {
    if (where?.activo === true) return dbData.filter((t) => t.activo);
    return dbData; // where undefined o activo no especificado → todos
  });

  const findUnique = jest.fn(
    ({ where }: { where: { codigo?: string; id?: string } }) => {
      if (where.codigo) return dbData.find((t) => t.codigo === where.codigo) ?? null;
      if (where.id) return dbData.find((t) => t.id === where.id) ?? null;
      return null;
    },
  );

  const prisma = {
    get tipoDedicacionConeau() {
      return { findMany, findUnique };
    },
  } as unknown as import('../../../prisma/prisma.service').PrismaService;

  const svc = new TipoDedicacionConeauService(prisma);
  return { svc, findMany, findUnique };
}

// ── Tests: listar ─────────────────────────────────────────────────────────────

describe('TipoDedicacionConeauService — listar()', () => {
  it('devuelve los tres tipos activos del seed por defecto', async () => {
    const { svc } = makeSvc();
    const result = await svc.listar();
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.codigo)).toEqual(
      expect.arrayContaining(['EXCLUSIVA', 'SEMIEXCLUSIVA', 'SIMPLE']),
    );
  });

  it('con soloActivos=true filtra los inactivos', async () => {
    const datos = [
      ...SEED_TIPOS,
      mkTipo({ id: 'uuid-inac-0099', nombre: 'Obsoleto', codigo: 'OBSOLETO', activo: false }),
    ];
    const { svc } = makeSvc(datos);
    const result = await svc.listar(true);
    expect(result.every((t) => t.activo)).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('con soloActivos=false incluye inactivos', async () => {
    const datos = [
      ...SEED_TIPOS,
      mkTipo({ id: 'uuid-inac-0099', nombre: 'Obsoleto', codigo: 'OBSOLETO', activo: false }),
    ];
    const { svc } = makeSvc(datos);
    const result = await svc.listar(false);
    expect(result).toHaveLength(4);
  });

  it('catálogo vacío devuelve array vacío sin excepción', async () => {
    const { svc } = makeSvc([]);
    const result = await svc.listar();
    expect(result).toEqual([]);
  });
});

// ── Tests: obtenerPorCodigo ───────────────────────────────────────────────────

describe('TipoDedicacionConeauService — obtenerPorCodigo()', () => {
  it.each(Object.values(CODIGO_DEDICACION_CONEAU))(
    'encuentra el tipo con código canónico "%s"',
    async (codigo) => {
      const { svc } = makeSvc();
      const result = await svc.obtenerPorCodigo(codigo);
      expect(result).not.toBeNull();
      expect(result!.codigo).toBe(codigo);
    },
  );

  it('devuelve null para un código no registrado', async () => {
    const { svc } = makeSvc();
    const result = await svc.obtenerPorCodigo('NO_EXISTE');
    expect(result).toBeNull();
  });

  it('devuelve null para un código de designación histórica (REGULAR)', async () => {
    const { svc } = makeSvc();
    const result = await svc.obtenerPorCodigo('REGULAR');
    expect(result).toBeNull();
  });

  it('devuelve null para vacío', async () => {
    const { svc } = makeSvc();
    const result = await svc.obtenerPorCodigo('');
    expect(result).toBeNull();
  });
});

// ── Tests: obtenerPorId ───────────────────────────────────────────────────────

describe('TipoDedicacionConeauService — obtenerPorId()', () => {
  it('devuelve el tipo correcto por id existente', async () => {
    const { svc } = makeSvc();
    const result = await svc.obtenerPorId('uuid-excl-0001');
    expect(result.codigo).toBe('EXCLUSIVA');
    expect(result.nombre).toBe('Exclusiva');
  });

  it('lanza NotFoundException cuando el id no existe', async () => {
    const { svc } = makeSvc();
    await expect(svc.obtenerPorId('uuid-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('mensaje de excepción menciona el id buscado', async () => {
    const { svc } = makeSvc();
    await expect(svc.obtenerPorId('bad-id')).rejects.toThrow(/bad-id/);
  });
});

// ── Tests: resolverTipoPorId ──────────────────────────────────────────────────

describe('TipoDedicacionConeauService — resolverTipoPorId()', () => {
  it('devuelve null cuando tipoDedicacionConeauId es null (= NO_DETERMINADA)', async () => {
    const { svc } = makeSvc();
    const result = await svc.resolverTipoPorId(null);
    expect(result).toBeNull();
  });

  it('resuelve el tipo cuando se pasa un id válido', async () => {
    const { svc } = makeSvc();
    const result = await svc.resolverTipoPorId('uuid-semi-0002');
    expect(result).not.toBeNull();
    expect(result!.codigo).toBe('SEMIEXCLUSIVA');
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

// ── Tests: CODIGO_DEDICACION_CONEAU ───────────────────────────────────────────

describe('CODIGO_DEDICACION_CONEAU — constantes canónicas', () => {
  it('contiene exactamente EXCLUSIVA, SEMIEXCLUSIVA y SIMPLE', () => {
    const codigos = Object.values(CODIGO_DEDICACION_CONEAU);
    expect(codigos).toHaveLength(3);
    expect(codigos).toEqual(expect.arrayContaining(['EXCLUSIVA', 'SEMIEXCLUSIVA', 'SIMPLE']));
  });

  it('NO_DETERMINADA no es un código de catálogo (se representa como null FK)', () => {
    const codigos = Object.values(CODIGO_DEDICACION_CONEAU);
    expect(codigos).not.toContain('NO_DETERMINADA');
  });

  it('REGULAR, INTERINO, CONTRATADO no son códigos de catálogo', () => {
    const codigos = Object.values(CODIGO_DEDICACION_CONEAU);
    expect(codigos).not.toContain('REGULAR');
    expect(codigos).not.toContain('INTERINO');
    expect(codigos).not.toContain('CONTRATADO');
  });
});

// ── Tests: D-06 — tipoPosgrado (compatibilidad) ───────────────────────────────

describe('D-06 — tipoPosgrado: compatibilidad con campos DTO preparatorios', () => {
  it('FichaDocenteDto.identificacion acepta tipoDedicacionConeau=null sin error de tipos', () => {
    // Verificación en tiempo de compilación capturada en runtime:
    // Si el tipo fuera incorrecto, el build de TypeScript fallaría.
    // Este test documenta el contrato: null es un valor válido.
    const ficha: import('../ficha-docente/ficha-docente.dto').FichaDocenteDto = {
      identificacion: {
        id: 'test',
        nombre: 'Juan',
        apellido: 'Perez',
        nombreCompleto: 'Juan Perez',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        correoElectronico: 'juan@test.com',
        activo: true,
        dedicacion: 'Exclusiva',
        categoriaDocente: null,
        tituloGrado: null,
        tituloPosgrado: null,
        relevamientoCargosCompleto: false,
        tipoDedicacionConeau: null,   // D-05: null = NO_DETERMINADA
        tipoPosgrado: null,           // D-06: null = sin clasificar
      },
      formacionAcademica: {
        tituloGrado: null,
        tituloPosgrado: null,
        otrosTitulos: null,
        actividadesPosgradoJson: null,
      },
      actividadesInvestigacion: {
        tituloProyectoInvestigacion: null,
        proyectosInvestigacionJson: null,
        produccionCientificaJson: null,
      },
      cargosInstitucionales: [],
      vinculaciones: [],
      alertasEnScope: [],
      completitud: {
        tieneFormacionBasica: false,
        tienePosgrado: false,
        tieneActividadInvestigacion: false,
        tieneDedicacion: false,
        porcentaje: 0,
      },
    };
    expect(ficha.identificacion.tipoDedicacionConeau).toBeNull();
    expect(ficha.identificacion.tipoPosgrado).toBeNull();
  });

  it('FichaDocenteDto.identificacion acepta tipoDedicacionConeau con datos', () => {
    const ref = { id: 'uuid-excl-0001', nombre: 'Exclusiva', codigo: 'EXCLUSIVA' };
    const ficha: Partial<import('../ficha-docente/ficha-docente.dto').FichaDocenteDto['identificacion']> = {
      tipoDedicacionConeau: ref,
      tipoPosgrado: { id: 'uuid-pos-001', nombre: 'Maestría' },
    };
    expect(ficha.tipoDedicacionConeau?.codigo).toBe('EXCLUSIVA');
    expect(ficha.tipoPosgrado?.nombre).toBe('Maestría');
  });

  it('tituloPosgrado (texto libre) sigue existiendo y es independiente de tipoPosgrado (FK)', () => {
    // D-06: las dos formas de registrar posgrado coexisten durante la transición
    const ficha: Partial<import('../ficha-docente/ficha-docente.dto').FichaDocenteDto['identificacion']> = {
      tituloPosgrado: 'Magíster en Derecho',
      tipoPosgrado: null,   // texto existe pero FK aún no asignado
    };
    expect(ficha.tituloPosgrado).toBeTruthy();
    expect(ficha.tipoPosgrado).toBeNull();
  });

  it('dedicacion (texto libre) sigue existiendo y es independiente de tipoDedicacionConeau (FK)', () => {
    // D-05: las dos formas coexisten durante la transición
    const ficha: Partial<import('../ficha-docente/ficha-docente.dto').FichaDocenteDto['identificacion']> = {
      dedicacion: 'REGULAR',    // valor histórico no CONEAU
      tipoDedicacionConeau: null, // → NO_DETERMINADA
    };
    expect(ficha.dedicacion).toBe('REGULAR');
    expect(ficha.tipoDedicacionConeau).toBeNull();
  });
});
