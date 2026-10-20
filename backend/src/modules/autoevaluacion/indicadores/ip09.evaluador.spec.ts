import { EstadoCalculo } from '../types/estado-calculo.types';
import { evaluarC1, evaluarC2, evaluarC3, completitudDocente, IP09EvaluadorService } from './ip09.evaluador';
import type { DocenteVigenteIP09 } from '../consultas-academicas/consultas-academicas.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDocente(overrides: Partial<DocenteVigenteIP09> = {}): DocenteVigenteIP09 {
  return {
    docenteId: 'd-1',
    nombre: 'Juan',
    apellido: 'Pérez',
    sexo: 'M',
    fechaNacimiento: new Date('1980-01-01'),
    cuit: '20-12345678-9',
    pisoDepto: 'Capital Federal',
    residencia: 'ARGENTINA',
    tipoDocumento: 'DNI',
    tituloGrado: JSON.stringify([{ denominacion: 'Ing. en Sistemas', anio: '2005', pais: 'Argentina', institucion: 'UBA' }]),
    areaDisciplinarId: 'area-1',
    ...overrides,
  };
}

// ── evaluarC1 ─────────────────────────────────────────────────────────────────

describe('evaluarC1 — datos personales', () => {
  it('true cuando todos los campos están completos (residente argentina, DNI)', () => {
    expect(evaluarC1(makeDocente())).toBe(true);
  });

  it('false cuando sexo es null', () => {
    expect(evaluarC1(makeDocente({ sexo: null }))).toBe(false);
  });

  it('false cuando sexo es string vacío', () => {
    expect(evaluarC1(makeDocente({ sexo: '   ' }))).toBe(false);
  });

  it('false cuando fechaNacimiento es null', () => {
    expect(evaluarC1(makeDocente({ fechaNacimiento: null }))).toBe(false);
  });

  it('false cuando cuit es null y tipoDocumento es DNI', () => {
    expect(evaluarC1(makeDocente({ cuit: null }))).toBe(false);
  });

  it('true cuando cuit es null pero tipoDocumento es PASAPORTE (exención)', () => {
    expect(evaluarC1(makeDocente({ cuit: null, tipoDocumento: 'PASAPORTE' }))).toBe(true);
  });

  it('exención PASAPORTE es insensible a mayúsculas/minúsculas', () => {
    expect(evaluarC1(makeDocente({ cuit: null, tipoDocumento: 'pasaporte' }))).toBe(true);
    expect(evaluarC1(makeDocente({ cuit: null, tipoDocumento: 'Pasaporte' }))).toBe(true);
  });

  it('false cuando pisoDepto es null y residencia es Argentina', () => {
    expect(evaluarC1(makeDocente({ pisoDepto: null }))).toBe(false);
  });

  it('true cuando pisoDepto es null pero residencia no es Argentina (exención)', () => {
    expect(evaluarC1(makeDocente({ pisoDepto: null, residencia: 'ESPAÑA' }))).toBe(true);
  });

  it('residencia null se trata como Argentina — pisoDepto requerido', () => {
    expect(evaluarC1(makeDocente({ pisoDepto: null, residencia: null }))).toBe(false);
  });

  it('residencia vacía no tratada como Argentina — exención aplica', () => {
    // residencia: '' → falsy → !d.residencia = true → esArgentina = true → pisoDepto requerido
    expect(evaluarC1(makeDocente({ pisoDepto: null, residencia: '' }))).toBe(false);
  });
});

// ── evaluarC2 ─────────────────────────────────────────────────────────────────

describe('evaluarC2 — título de grado', () => {
  it('true cuando el JSON tiene al menos un título completo', () => {
    const json = JSON.stringify([{ denominacion: 'Ing. en Sistemas', anio: '2005', pais: 'Argentina', institucion: 'UBA' }]);
    expect(evaluarC2(json)).toBe(true);
  });

  it('false cuando tituloGrado es null', () => {
    expect(evaluarC2(null)).toBe(false);
  });

  it('false cuando tituloGrado es string vacío', () => {
    expect(evaluarC2('')).toBe(false);
    expect(evaluarC2('   ')).toBe(false);
  });

  it('false cuando el JSON es un array vacío', () => {
    expect(evaluarC2('[]')).toBe(false);
  });

  it('false cuando el JSON tiene título con campo vacío (denominacion)', () => {
    const json = JSON.stringify([{ denominacion: '', anio: '2005', pais: 'Argentina', institucion: 'UBA' }]);
    expect(evaluarC2(json)).toBe(false);
  });

  it('false cuando el JSON tiene título con campo faltante (institucion ausente)', () => {
    const json = JSON.stringify([{ denominacion: 'Lic.', anio: '2005', pais: 'Argentina' }]);
    expect(evaluarC2(json)).toBe(false);
  });

  it('true cuando hay un título incompleto y uno completo en el array', () => {
    const json = JSON.stringify([
      { denominacion: '', anio: '2000', pais: 'Argentina', institucion: 'UBA' },
      { denominacion: 'Ing.', anio: '2005', pais: 'Argentina', institucion: 'UTN' },
    ]);
    expect(evaluarC2(json)).toBe(true);
  });

  it('false cuando tituloGrado es texto plano (legacy, no JSON)', () => {
    expect(evaluarC2('Ingeniero en Sistemas')).toBe(false);
  });

  it('false cuando tituloGrado es JSON inválido', () => {
    expect(evaluarC2('{invalid json')).toBe(false);
  });

  it('false cuando el JSON es un objeto (no array)', () => {
    expect(evaluarC2('{"denominacion":"Ing.","anio":"2005","pais":"Argentina","institucion":"UBA"}')).toBe(false);
  });
});

// ── evaluarC3 ─────────────────────────────────────────────────────────────────

describe('evaluarC3 — área disciplinar', () => {
  it('true cuando areaDisciplinarId está informado', () => {
    expect(evaluarC3('area-123')).toBe(true);
  });

  it('false cuando areaDisciplinarId es null', () => {
    expect(evaluarC3(null)).toBe(false);
  });
});

// ── completitudDocente ────────────────────────────────────────────────────────

describe('completitudDocente — fórmula 25×(C1+C2+C3+C4)', () => {
  it('100 cuando todos los ítems están completos (C4 = 1 siempre)', () => {
    expect(completitudDocente(makeDocente())).toBe(100);
  });

  it('75 cuando C1 falta (sexo null)', () => {
    expect(completitudDocente(makeDocente({ sexo: null }))).toBe(75);
  });

  it('75 cuando C2 falta (tituloGrado null)', () => {
    expect(completitudDocente(makeDocente({ tituloGrado: null }))).toBe(75);
  });

  it('75 cuando C3 falta (areaDisciplinarId null)', () => {
    expect(completitudDocente(makeDocente({ areaDisciplinarId: null }))).toBe(75);
  });

  it('50 cuando C1 y C2 faltan', () => {
    expect(completitudDocente(makeDocente({ sexo: null, tituloGrado: null }))).toBe(50);
  });

  it('25 cuando solo C4 está (C1=C2=C3=0)', () => {
    expect(completitudDocente(makeDocente({ sexo: null, tituloGrado: null, areaDisciplinarId: null }))).toBe(25);
  });
});

// ── IP09EvaluadorService ──────────────────────────────────────────────────────

describe('IP09EvaluadorService', () => {
  function makeConsultas(docentes: DocenteVigenteIP09[]) {
    return { obtenerDocentesParaIP09: jest.fn().mockResolvedValue({ docentes }) };
  }

  it('NO_APLICA cuando el universo está vacío (sin docentes)', async () => {
    const svc = new IP09EvaluadorService(makeConsultas([]) as any);
    const res = await svc.evaluarParaCarrera('car-1');
    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.totalDocentes).toBe(0);
    expect(res.completitudPromedio).toBeNull();
  });

  it('CALCULADO: completitudPromedio = round(mean([100])) para un docente completo', async () => {
    const svc = new IP09EvaluadorService(makeConsultas([makeDocente()]) as any);
    const res = await svc.evaluarParaCarrera('car-1');
    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.completitudPromedio).toBe(100);
    expect(res.totalDocentes).toBe(1);
  });

  it('CALCULADO: completitudPromedio = round(mean([100, 75])) = 88', async () => {
    const docentes = [
      makeDocente({ docenteId: 'd-1' }),
      makeDocente({ docenteId: 'd-2', sexo: null }),
    ];
    const svc = new IP09EvaluadorService(makeConsultas(docentes) as any);
    const res = await svc.evaluarParaCarrera('car-1');
    expect(res.completitudPromedio).toBe(88); // round((100+75)/2) = round(87.5) = 88
    expect(res.totalDocentes).toBe(2);
  });

  it('CALCULADO: completitudPromedio = round(mean([25,25,25])) = 25 cuando todos incompletos', async () => {
    const incompleto = makeDocente({ docenteId: 'd-x', sexo: null, tituloGrado: null, areaDisciplinarId: null });
    const svc = new IP09EvaluadorService(makeConsultas([
      { ...incompleto, docenteId: 'd-1' },
      { ...incompleto, docenteId: 'd-2' },
      { ...incompleto, docenteId: 'd-3' },
    ]) as any);
    const res = await svc.evaluarParaCarrera('car-1');
    expect(res.completitudPromedio).toBe(25);
  });

  it('redondeo correcto: mean([75,100]) = 87.5 → round = 88', async () => {
    const d1 = makeDocente({ docenteId: 'd-1' });                   // 100
    const d2 = makeDocente({ docenteId: 'd-2', sexo: null });        // 75
    const svc = new IP09EvaluadorService(makeConsultas([d1, d2]) as any);
    const res = await svc.evaluarParaCarrera('car-1');
    expect(res.completitudPromedio).toBe(Math.round((100 + 75) / 2));
  });

  it('delega en consultas.obtenerDocentesParaIP09 con el carreraId correcto', async () => {
    const consultas = makeConsultas([makeDocente()]);
    const svc = new IP09EvaluadorService(consultas as any);
    await svc.evaluarParaCarrera('car-abc');
    expect(consultas.obtenerDocentesParaIP09).toHaveBeenCalledWith('car-abc');
  });
});
