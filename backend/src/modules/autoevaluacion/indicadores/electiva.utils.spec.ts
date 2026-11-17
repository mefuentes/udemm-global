import { seleccionarElectivaMinCarga } from './electiva.utils';
import type { ResultadoSeleccionElectiva } from './electiva.utils';

// ── Tipo de prueba ────────────────────────────────────────────────────────────

interface E {
  id: string;
  codigo: string;
  carga: number | null;
}

function sel(electivas: E[]): ResultadoSeleccionElectiva<E> {
  return seleccionarElectivaMinCarga(electivas, {
    getCarga:  e => e.carga,
    getCodigo: e => e.codigo,
    getId:     e => e.id,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Casos base
// ════════════════════════════════════════════════════════════════════════════

describe('seleccionarElectivaMinCarga — casos base', () => {

  it('lista vacía → tipo ninguna', () => {
    expect(sel([])).toEqual({ tipo: 'ninguna' });
  });

  it('una sola electiva → tipo seleccionada con esa electiva', () => {
    const e: E = { id: 'e1', codigo: 'COD-E1', carga: 64 };
    const r = sel([e]);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva).toBe(e);
  });

  it('una electiva con carga null → tipo seleccionada (caso único, no indeterminate)', () => {
    const e: E = { id: 'e1', codigo: 'COD-E1', carga: null };
    const r = sel([e]);
    expect(r.tipo).toBe('seleccionada');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// 2. Selección por menor carga
// ════════════════════════════════════════════════════════════════════════════

describe('seleccionarElectivaMinCarga — selección por menor carga', () => {

  it('dos electivas, cargas distintas → selecciona la de menor carga', () => {
    const e1: E = { id: 'e1', codigo: 'COD-E1', carga: 32 };
    const e2: E = { id: 'e2', codigo: 'COD-E2', carga: 64 };
    const r = sel([e1, e2]);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.id).toBe('e1');
  });

  it('tres electivas, cargas distintas → selecciona la menor', () => {
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-E1', carga: 48 },
      { id: 'e2', codigo: 'COD-E2', carga: 16 },
      { id: 'e3', codigo: 'COD-E3', carga: 96 },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.id).toBe('e2');
  });

  it('carga cero es una carga válida y puede ser la menor', () => {
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-E1', carga: 0 },
      { id: 'e2', codigo: 'COD-E2', carga: 32 },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.id).toBe('e1');
  });

  it('el orden de entrada no afecta el resultado', () => {
    const a: E = { id: 'eA', codigo: 'COD-A', carga: 20 };
    const b: E = { id: 'eB', codigo: 'COD-B', carga: 80 };
    const r1 = sel([a, b]);
    const r2 = sel([b, a]);
    expect(r1.tipo).toBe('seleccionada');
    expect(r2.tipo).toBe('seleccionada');
    if (r1.tipo === 'seleccionada' && r2.tipo === 'seleccionada') {
      expect(r1.electiva.id).toBe('eA');
      expect(r2.electiva.id).toBe('eA');
    }
  });

});

// ════════════════════════════════════════════════════════════════════════════
// 3. Desempate determinista
// ════════════════════════════════════════════════════════════════════════════

describe('seleccionarElectivaMinCarga — desempate', () => {

  it('empate en carga → desempate por código ascendente (Unicode)', () => {
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-B', carga: 64 },
      { id: 'e2', codigo: 'COD-A', carga: 64 },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.codigo).toBe('COD-A');
  });

  it('empate en carga y código → desempate por id ascendente (Unicode)', () => {
    const electivas: E[] = [
      { id: 'id-b', codigo: 'COD-X', carga: 64 },
      { id: 'id-a', codigo: 'COD-X', carga: 64 },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.id).toBe('id-a');
  });

  it('código con mayúscula precede al código con minúscula (Unicode)', () => {
    // 'COD-E2' (E=69) < 'COD-e1' (e=101) en Unicode
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-e1', carga: 64 },
      { id: 'e2', codigo: 'COD-E2', carga: 64 },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.id).toBe('e2');
  });

  it('desempate es estable: N electivas con mismo código prefijo → menor id numérico', () => {
    const electivas: E[] = [
      { id: 'e3', codigo: 'COD-X', carga: 10 },
      { id: 'e1', codigo: 'COD-X', carga: 10 },
      { id: 'e2', codigo: 'COD-X', carga: 10 },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('seleccionada');
    if (r.tipo === 'seleccionada') expect(r.electiva.id).toBe('e1');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// 4. Caso indeterminado
// ════════════════════════════════════════════════════════════════════════════

describe('seleccionarElectivaMinCarga — caso indeterminado', () => {

  it('dos electivas, una con carga null → tipo indeterminada', () => {
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-E1', carga: 32 },
      { id: 'e2', codigo: 'COD-E2', carga: null },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('indeterminada');
    if (r.tipo === 'indeterminada') expect(r.electivas).toHaveLength(2);
  });

  it('todas con carga null → tipo indeterminada', () => {
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-E1', carga: null },
      { id: 'e2', codigo: 'COD-E2', carga: null },
      { id: 'e3', codigo: 'COD-E3', carga: null },
    ];
    const r = sel(electivas);
    expect(r.tipo).toBe('indeterminada');
  });

  it('cuando hay null carga no se hace ranking de las conocidas', () => {
    // e1 tiene la menor carga conocida pero e3=null hace el resultado indeterminado
    const electivas: E[] = [
      { id: 'e1', codigo: 'COD-E1', carga: 16 },
      { id: 'e2', codigo: 'COD-E2', carga: 32 },
      { id: 'e3', codigo: 'COD-E3', carga: null },
    ];
    expect(sel(electivas).tipo).toBe('indeterminada');
  });

  it('indeterminada preserva todas las electivas originales', () => {
    const e1: E = { id: 'e1', codigo: 'COD-E1', carga: null };
    const e2: E = { id: 'e2', codigo: 'COD-E2', carga: null };
    const r = sel([e1, e2]);
    if (r.tipo === 'indeterminada') {
      expect(r.electivas).toContain(e1);
      expect(r.electivas).toContain(e2);
    }
  });

});
