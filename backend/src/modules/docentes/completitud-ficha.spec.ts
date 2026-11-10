import {
  calcularCompletitudFicha,
  evaluarAreaDesempeno,
  evaluarDatosPersonales,
  evaluarDocenciaUniversitaria,
  evaluarFormacion,
} from './completitud-ficha';

const TITULO_COMPLETO = JSON.stringify([
  { denominacion: 'Lic. en Administración', anio: '2010', pais: 'Argentina', institucion: 'UBA' },
]);

const TITULO_POSGRADO_JSON = JSON.stringify([
  { denominacion: 'Mg. en Gestión', anio: '2015', pais: 'Argentina', institucion: 'UBA' },
]);

const BASE_COMPLETO = {
  sexo: 'M',
  fechaNacimiento: new Date('1980-01-01'),
  cuit: '20123456789',
  tipoDocumento: 'DNI',
  tituloGrado: TITULO_COMPLETO,
  areaDisciplinarId: 'uuid-area-123',
  subareaId: 'uuid-subarea-456',
  vinculaciones: [{ estado: 'APROBADA' }],
};

describe('evaluarDatosPersonales', () => {
  it('CF-01 — sexo vacío → datosPersonales false', () => {
    expect(
      evaluarDatosPersonales({
        sexo: '',
        fechaNacimiento: new Date('1980-01-01'),
        cuit: '20123456789',
        tipoDocumento: 'DNI',
      }),
    ).toBe(false);
  });

  it('CF-02 — fechaNacimiento null → datosPersonales false', () => {
    expect(
      evaluarDatosPersonales({
        sexo: 'M',
        fechaNacimiento: null,
        cuit: '20123456789',
        tipoDocumento: 'DNI',
      }),
    ).toBe(false);
  });

  it('CF-03 — DNI sin CUIT → datosPersonales false', () => {
    expect(
      evaluarDatosPersonales({
        sexo: 'M',
        fechaNacimiento: new Date('1980-01-01'),
        cuit: '',
        tipoDocumento: 'DNI',
      }),
    ).toBe(false);
  });

  it('CF-04 — PASAPORTE sin CUIT → datosPersonales true (excepción PASAPORTE)', () => {
    expect(
      evaluarDatosPersonales({
        sexo: 'F',
        fechaNacimiento: new Date('1985-05-20'),
        cuit: null,
        tipoDocumento: 'PASAPORTE',
      }),
    ).toBe(true);
  });

  it('CF-05 — datos personales completos (DNI) → datosPersonales true', () => {
    expect(
      evaluarDatosPersonales({
        sexo: 'M',
        fechaNacimiento: new Date('1980-01-01'),
        cuit: '20123456789',
        tipoDocumento: 'DNI',
      }),
    ).toBe(true);
  });
});

describe('evaluarFormacion', () => {
  it('CF-06 — tituloGrado null → formacion false (sin títulos cargados)', () => {
    expect(evaluarFormacion(null)).toBe(false);
  });

  it('CF-07 — tituloGrado JSON array vacío → formacion false', () => {
    expect(evaluarFormacion('[]')).toBe(false);
  });

  it('CF-08 — tituloGrado con un título completo → formacion true', () => {
    expect(evaluarFormacion(TITULO_COMPLETO)).toBe(true);
  });

  it('CF-09 — tituloGrado con campo institucion vacío → formacion false', () => {
    const incompleto = JSON.stringify([
      { denominacion: 'Lic.', anio: '2010', pais: 'Argentina', institucion: '' },
    ]);
    expect(evaluarFormacion(incompleto)).toBe(false);
  });

  it('CF-19 — solo posgrado (tituloGrado null, posgrado presente en DB) → formacion false', () => {
    // La completitud de formación solo evalúa tituloGrado (campo de grado).
    // Tener únicamente posgrado no satisface C2.
    expect(evaluarFormacion(null)).toBe(false);
  });

  it('CF-20 — tituloGrado con JSON de posgrado bien formado → formacion true (campo acepta cualquier nivel)', () => {
    // El campo tituloGrado puede almacenar cualquier nivel de formación.
    // La completitud se cumple si el item tiene todos los campos requeridos.
    expect(evaluarFormacion(TITULO_POSGRADO_JSON)).toBe(true);
  });
});

describe('evaluarAreaDesempeno', () => {
  it('CF-10 — areaDisciplinarId null y subareaId null → areaDesempeno false', () => {
    expect(evaluarAreaDesempeno(null, null)).toBe(false);
  });

  it('CF-10b — areaDisciplinarId con valor pero subareaId null → areaDesempeno false', () => {
    // C3 requiere AMBOS campos. Solo área sin subárea no es suficiente.
    expect(evaluarAreaDesempeno('uuid-area-123', null)).toBe(false);
  });

  it('CF-10c — areaDisciplinarId null pero subareaId con valor → areaDesempeno false', () => {
    expect(evaluarAreaDesempeno(null, 'uuid-subarea-456')).toBe(false);
  });

  it('CF-11 — areaDisciplinarId y subareaId con valores → areaDesempeno true', () => {
    expect(evaluarAreaDesempeno('uuid-area-123', 'uuid-subarea-456')).toBe(true);
  });
});

describe('evaluarDocenciaUniversitaria', () => {
  it('CF-12 — sin vinculaciones → docenciaUniversitaria false', () => {
    expect(evaluarDocenciaUniversitaria([])).toBe(false);
  });

  it('CF-13 — vinculaciones sin estado APROBADA → docenciaUniversitaria false', () => {
    expect(
      evaluarDocenciaUniversitaria([
        { estado: 'PENDIENTE_DE_APROBACION' },
        { estado: 'RECHAZADA' },
        { estado: 'DESVINCULADA' },
      ]),
    ).toBe(false);
  });

  it('CF-14 — al menos una vinculación APROBADA → docenciaUniversitaria true', () => {
    expect(
      evaluarDocenciaUniversitaria([
        { estado: 'PENDIENTE_DE_APROBACION' },
        { estado: 'APROBADA' },
      ]),
    ).toBe(true);
  });
});

describe('calcularCompletitudFicha', () => {
  it('CF-15 — todos los criterios completos → porcentaje 100', () => {
    const result = calcularCompletitudFicha(BASE_COMPLETO);
    expect(result.porcentaje).toBe(100);
    expect(result.criterios.datosPersonales).toBe(true);
    expect(result.criterios.formacion).toBe(true);
    expect(result.criterios.areaDesempeno).toBe(true);
    expect(result.criterios.docenciaUniversitaria).toBe(true);
  });

  it('CF-16 — formacion y areaDesempeno ausentes → porcentaje 50', () => {
    const result = calcularCompletitudFicha({
      ...BASE_COMPLETO,
      tituloGrado: null,
      areaDisciplinarId: null,
      subareaId: null,
    });
    expect(result.porcentaje).toBe(50);
    expect(result.criterios.datosPersonales).toBe(true);
    expect(result.criterios.formacion).toBe(false);
    expect(result.criterios.areaDesempeno).toBe(false);
    expect(result.criterios.docenciaUniversitaria).toBe(true);
  });

  it('CF-21 — eliminación del último título de grado: porcentaje reduce 25%', () => {
    // Docente previamente con 100% elimina su único título → pasa a 75%.
    const conTitulo = calcularCompletitudFicha(BASE_COMPLETO);
    const sinTitulo = calcularCompletitudFicha({ ...BASE_COMPLETO, tituloGrado: null });
    expect(conTitulo.porcentaje).toBe(100);
    expect(sinTitulo.porcentaje).toBe(75);
    expect(sinTitulo.criterios.formacion).toBe(false);
  });

  it('CF-22 — área de desempeño incompleta (solo areaDisciplinarId, sin subárea): porcentaje reduce 25%', () => {
    // Con solo areaDisciplinarId → C3 false → 75%.
    const result = calcularCompletitudFicha({
      ...BASE_COMPLETO,
      subareaId: null,
    });
    expect(result.porcentaje).toBe(75);
    expect(result.criterios.areaDesempeno).toBe(false);
    // Los otros tres criterios se conservan.
    expect(result.criterios.datosPersonales).toBe(true);
    expect(result.criterios.formacion).toBe(true);
    expect(result.criterios.docenciaUniversitaria).toBe(true);
  });

  it('CF-23 — limpieza de ambos campos (areaDisciplinarId y subareaId → null): areaDesempeno false, otros criterios intactos', () => {
    const result = calcularCompletitudFicha({
      ...BASE_COMPLETO,
      areaDisciplinarId: null,
      subareaId: null,
    });
    expect(result.criterios.areaDesempeno).toBe(false);
    expect(result.criterios.datosPersonales).toBe(true);
    expect(result.criterios.formacion).toBe(true);
    expect(result.criterios.docenciaUniversitaria).toBe(true);
    expect(result.porcentaje).toBe(75);
  });

  it('CF-24 — recarga coherente: misma entrada produce mismo resultado (sin selecciones automáticas)', () => {
    // Si se llama dos veces con los mismos datos, el resultado debe ser idéntico.
    // Garantiza ausencia de efectos secundarios ni valores auto-completados.
    const r1 = calcularCompletitudFicha({ ...BASE_COMPLETO, areaDisciplinarId: null, subareaId: null });
    const r2 = calcularCompletitudFicha({ ...BASE_COMPLETO, areaDisciplinarId: null, subareaId: null });
    expect(r1).toEqual(r2);
  });
});
