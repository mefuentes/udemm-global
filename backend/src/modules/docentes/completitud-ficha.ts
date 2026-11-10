export type VinculacionEstado = { estado: string };

export interface FichaDocenteInput {
  sexo: string | null;
  fechaNacimiento: Date | null;
  cuit: string | null;
  tipoDocumento: string;
  tituloGrado: string | null;
  areaDisciplinarId: string | null;
  subareaId: string | null;
  vinculaciones: VinculacionEstado[];
}

export interface CompletitudFichaResult {
  porcentaje: number;
  criterios: {
    datosPersonales: boolean;
    formacion: boolean;
    areaDesempeno: boolean;
    docenciaUniversitaria: boolean;
  };
}

/**
 * C1 — Datos personales.
 * pisoDepto excluido del cálculo de completitud (campo no obligatorio).
 * Excepción: tipoDocumento = PASAPORTE no requiere cuit.
 */
export function evaluarDatosPersonales(
  d: Pick<FichaDocenteInput, 'sexo' | 'fechaNacimiento' | 'cuit' | 'tipoDocumento'>,
): boolean {
  if (!d.sexo?.trim()) return false;
  if (!d.fechaNacimiento) return false;
  const esPassport = d.tipoDocumento.toUpperCase() === 'PASAPORTE';
  if (!esPassport && !d.cuit?.trim()) return false;
  return true;
}

/** C2 — Formación. tituloGrado almacena JSON [{denominacion, anio, pais, institucion}]. */
export function evaluarFormacion(tituloGradoRaw: string | null): boolean {
  if (!tituloGradoRaw?.trim()) return false;
  let arr: unknown;
  try {
    arr = JSON.parse(tituloGradoRaw);
  } catch {
    return false;
  }
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return (arr as unknown[]).some((t) => {
    if (typeof t !== 'object' || t === null) return false;
    const item = t as Record<string, unknown>;
    return (
      typeof item['denominacion'] === 'string' && item['denominacion'].trim() !== '' &&
      typeof item['anio'] === 'string' && item['anio'].trim() !== '' &&
      typeof item['pais'] === 'string' && item['pais'].trim() !== '' &&
      typeof item['institucion'] === 'string' && item['institucion'].trim() !== ''
    );
  });
}

/** C3 — Área de desempeño. C3 = verdadero cuando AMBOS areaDisciplinarId y subareaId están informados. */
export function evaluarAreaDesempeno(
  areaDisciplinarId: string | null,
  subareaId: string | null,
): boolean {
  return areaDisciplinarId !== null && subareaId !== null;
}

/** C4 — Docencia universitaria. C4 = verdadero cuando existe al menos una vinculación con estado APROBADA. */
export function evaluarDocenciaUniversitaria(vinculaciones: VinculacionEstado[]): boolean {
  return vinculaciones.some((v) => v.estado === 'APROBADA');
}

/** Calcula la completitud de la ficha docente. Cada criterio vale 25%. */
export function calcularCompletitudFicha(input: FichaDocenteInput): CompletitudFichaResult {
  const datosPersonales = evaluarDatosPersonales(input);
  const formacion = evaluarFormacion(input.tituloGrado);
  const areaDesempeno = evaluarAreaDesempeno(input.areaDisciplinarId, input.subareaId);
  const docenciaUniversitaria = evaluarDocenciaUniversitaria(input.vinculaciones);

  const cumplidos = [datosPersonales, formacion, areaDesempeno, docenciaUniversitaria]
    .filter(Boolean).length;

  return {
    porcentaje: cumplidos * 25,
    criterios: {
      datosPersonales,
      formacion,
      areaDesempeno,
      docenciaUniversitaria,
    },
  };
}
