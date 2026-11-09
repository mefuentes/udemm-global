import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CrearMateriaDto } from './crear-materia.dto';
import { ActualizarMateriaDto } from './actualizar-materia.dto';

const TIPOS_VALIDOS = ['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA', 'PPS', 'PI'];
const TIPOS_INVALIDOS = ['PRACTICA', 'PRACTICA_SUPERVISADA', 'PROYECTO', 'pps', 'pi', 'obligatoria', ''];

// ── CrearMateriaDto ───────────────────────────────────────────────────────────

describe('CrearMateriaDto — tipoAsignatura', () => {
  const BASE = { codigo: 'MAT001', nombre: 'Materia', planEstudioId: 'plan-1' };

  for (const tipo of TIPOS_VALIDOS) {
    it(`acepta tipoAsignatura="${tipo}"`, async () => {
      const dto = plainToInstance(CrearMateriaDto, { ...BASE, tipoAsignatura: tipo });
      const errors = await validate(dto);
      const tipoErrors = errors.filter(e => e.property === 'tipoAsignatura');
      expect(tipoErrors).toHaveLength(0);
    });
  }

  for (const tipo of TIPOS_INVALIDOS) {
    it(`rechaza tipoAsignatura="${tipo}"`, async () => {
      const dto = plainToInstance(CrearMateriaDto, { ...BASE, tipoAsignatura: tipo });
      const errors = await validate(dto);
      const tipoErrors = errors.filter(e => e.property === 'tipoAsignatura');
      expect(tipoErrors.length).toBeGreaterThan(0);
    });
  }

  it('omitir tipoAsignatura no produce error (campo opcional)', async () => {
    const dto = plainToInstance(CrearMateriaDto, { ...BASE });
    const errors = await validate(dto);
    const tipoErrors = errors.filter(e => e.property === 'tipoAsignatura');
    expect(tipoErrors).toHaveLength(0);
  });
});

// ── ActualizarMateriaDto ──────────────────────────────────────────────────────

describe('ActualizarMateriaDto — tipoAsignatura', () => {
  for (const tipo of TIPOS_VALIDOS) {
    it(`acepta tipoAsignatura="${tipo}"`, async () => {
      const dto = plainToInstance(ActualizarMateriaDto, { tipoAsignatura: tipo });
      const errors = await validate(dto);
      const tipoErrors = errors.filter(e => e.property === 'tipoAsignatura');
      expect(tipoErrors).toHaveLength(0);
    });
  }

  for (const tipo of TIPOS_INVALIDOS) {
    it(`rechaza tipoAsignatura="${tipo}"`, async () => {
      const dto = plainToInstance(ActualizarMateriaDto, { tipoAsignatura: tipo });
      const errors = await validate(dto);
      const tipoErrors = errors.filter(e => e.property === 'tipoAsignatura');
      expect(tipoErrors.length).toBeGreaterThan(0);
    });
  }

  it('objeto vacío no produce errores (todos los campos son opcionales)', async () => {
    const dto = plainToInstance(ActualizarMateriaDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
