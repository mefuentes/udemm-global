import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { AmbitoAnalisis } from '../analisis/analisis.dto';

export type PrioridadAlerta = 'ALTA' | 'MEDIA' | 'INFORMATIVA';

export interface AlertaBandeja {
  ejecucionId: string;
  ambito: AmbitoAnalisis;
  entidadId: string;
  facultadId: string;
  regla: string;
  prioridad: PrioridadAlerta;
  descripcion: string;
  fechaEjecucion: string;
  estadoCalculo: EstadoCalculo | null;
}

export interface RespuestaBandeja {
  total: number;
  pagina: number;
  porPagina: number;
  /** true cuando existe al menos una ejecución COMPLETADO en el scope del usuario. */
  tieneAnalisis: boolean;
  items: AlertaBandeja[];
}

export interface FiltrosBandeja {
  ambito?: AmbitoAnalisis;
  prioridad?: PrioridadAlerta;
  regla?: string;
}
