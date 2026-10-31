import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ActualizarProgramaDto } from './dto/actualizar-programa.dto';

async function validar(dato: unknown): Promise<string[]> {
  const obj = plainToInstance(ActualizarProgramaDto, dato);
  const errs = await validate(obj);
  return errs.flatMap(e => Object.values(e.constraints ?? {}));
}

describe('ActualizarProgramaDto — fechaVigenciaPrograma (Año de vigencia del programa)', () => {
  describe('Valores válidos', () => {
    it('2026 → sin errores de validación', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 2026 });
      expect(errs).toHaveLength(0);
    });

    it('1000 (cuatro dígitos mínimo) → sin errores', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 1000 });
      expect(errs).toHaveLength(0);
    });

    it('9999 (cuatro dígitos máximo) → sin errores', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 9999 });
      expect(errs).toHaveLength(0);
    });

    it('campo omitido (opcional) → sin errores', async () => {
      const errs = await validar({});
      expect(errs).toHaveLength(0);
    });

    it('null (opcional) → sin errores', async () => {
      const errs = await validar({ fechaVigenciaPrograma: null });
      expect(errs).toHaveLength(0);
    });

    it('edición de programa con año existente: 2024 → sin errores', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 2024 });
      expect(errs).toHaveLength(0);
    });
  });

  describe('Valores inválidos — deben producir error de validación', () => {
    it('202 (tres dígitos) → error', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 202 });
      expect(errs.length).toBeGreaterThan(0);
    });

    it('20261 (cinco dígitos) → error', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 20261 });
      expect(errs.length).toBeGreaterThan(0);
    });

    it('999 (límite inferior excedido) → error', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 999 });
      expect(errs.length).toBeGreaterThan(0);
    });

    it('10000 (límite superior excedido) → error', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 10000 });
      expect(errs.length).toBeGreaterThan(0);
    });

    it('"abc" (texto no numérico) → @IsInt rechaza NaN resultante de la transformación', async () => {
      const errs = await validar({ fechaVigenciaPrograma: 'abc' });
      expect(errs.length).toBeGreaterThan(0);
    });

    it('"20a6" (mezcla letras y dígitos) → error', async () => {
      const errs = await validar({ fechaVigenciaPrograma: '20a6' });
      expect(errs.length).toBeGreaterThan(0);
    });

    it('"2026 " (año con espacio) → Number() lo convierte a 2026 (válido); el frontend previene esta entrada con soloDigitos()', async () => {
      // Number("2026 ") = 2026 — JavaScript normaliza espacios en conversión numérica.
      // El backend acepta 2026. La responsabilidad de prevenir el espacio es del input frontend.
      const obj = plainToInstance(ActualizarProgramaDto, { fechaVigenciaPrograma: '2026 ' });
      expect(obj.fechaVigenciaPrograma).toBe(2026);
      const errs = await validate(obj);
      expect(errs).toHaveLength(0);
    });
  });

  describe('Persistencia del valor al serializar / deserializar', () => {
    it('@Type(() => Number) convierte string "2026" → 2026 (número válido)', async () => {
      const obj = plainToInstance(ActualizarProgramaDto, { fechaVigenciaPrograma: '2026' });
      expect(typeof obj.fechaVigenciaPrograma).toBe('number');
      expect(obj.fechaVigenciaPrograma).toBe(2026);
    });

    it('el valor 2026 se preserva como número tras la transformación', async () => {
      const obj = plainToInstance(ActualizarProgramaDto, { fechaVigenciaPrograma: 2026 });
      const errs = await validate(obj);
      expect(errs).toHaveLength(0);
      expect(obj.fechaVigenciaPrograma).toBe(2026);
    });
  });
});
