import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { AmbitoAnalisis } from '../analisis/analisis.dto';

export type PrioridadAlerta = 'ALTA' | 'MEDIA' | 'INFORMATIVA';

/**
 * Grupo de ámbito según FSD §12: agrupa reglas por dominio temático.
 *   DOCENTES: R-03, R-07, R-10, R-12 — alertas sobre el cuerpo docente.
 *   PLANES:   IP-03, IPL-01, IPL-02, IPL-03, IPL-04 — alertas sobre planes/materias.
 *   CRUZADAS: IP-13 — indicadores transversales (sobreasignación cross-scope).
 */
export type GrupoAmbitoAlerta = 'DOCENTES' | 'PLANES' | 'CRUZADAS';

export interface AlertaBandeja {
  ejecucionId: string;
  ambito: AmbitoAnalisis;
  entidadId: string;
  facultadId: string;
  /** Presente cuando ambito='CARRERA': entidadId es el carreraId (B-06). */
  carreraId?: string;
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
  /** Filtro por grupo temático FSD §12 (B-05). Alternativo a ambito. */
  grupoAmbito?: GrupoAmbitoAlerta;
  prioridad?: PrioridadAlerta;
  regla?: string;
}
