/**
 * Resultado de la selección de electiva con menor carga horaria total.
 *
 *  - 'ninguna'      : no hay electivas en el plan.
 *  - 'seleccionada' : se pudo determinar una única electiva a computar.
 *  - 'indeterminada': hay más de una electiva pero al menos una tiene
 *                     cargaHorariaTotal=null, impidiendo comparar cargas.
 */
export type ResultadoSeleccionElectiva<T> =
  | { tipo: 'ninguna' }
  | { tipo: 'seleccionada'; electiva: T }
  | { tipo: 'indeterminada'; electivas: T[] };

/**
 * Selecciona la electiva de menor carga horaria total según la regla §6:
 * el alumno cursa UNA electiva — la de menor carga del plan.
 *
 * Desempate determinista cuando varias tienen la misma carga mínima:
 *   1. código ascendente (orden Unicode).
 *   2. id ascendente (orden Unicode).
 *
 * Si alguna electiva tiene cargaHorariaTotal=null la selección es indeterminada
 * (podría tener la menor carga una vez completado el dato) y se propaga
 * incertidumbre a los indicadores que consumen este resultado.
 */
export function seleccionarElectivaMinCarga<T>(
  electivas: T[],
  opts: {
    getCarga: (e: T) => number | null;
    getCodigo: (e: T) => string;
    getId: (e: T) => string;
  },
): ResultadoSeleccionElectiva<T> {
  if (electivas.length === 0) return { tipo: 'ninguna' };
  if (electivas.length === 1) return { tipo: 'seleccionada', electiva: electivas[0] };

  if (electivas.some(e => opts.getCarga(e) === null)) {
    return { tipo: 'indeterminada', electivas };
  }

  const sorted = [...electivas].sort((a, b) => {
    const ca = opts.getCarga(a)!;
    const cb = opts.getCarga(b)!;
    if (ca !== cb) return ca - cb;
    const codA = opts.getCodigo(a);
    const codB = opts.getCodigo(b);
    if (codA !== codB) return codA < codB ? -1 : 1;
    const idA = opts.getId(a);
    const idB = opts.getId(b);
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  return { tipo: 'seleccionada', electiva: sorted[0] };
}
