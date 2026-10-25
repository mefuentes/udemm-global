import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { TablroFacultadResponseDto } from '../tablero/tablero-facultad.dto';
import type { TablroCarreraResponseDto } from '../tablero/tablero-carrera.dto';
import type { TablroPlanResponseDto } from '../tablero/tablero-plan.dto';

export type AmbitoAnalisis = 'FACULTAD' | 'CARRERA' | 'PLAN';

export type EstadoPersistencia = 'GUARDADO' | 'PENDIENTE_SCHEMA';

export type EstadoEjecucion = 'COMPLETADO' | 'ERROR';

export interface MetadataEjecucion {
  ejecucionId: string;
  ambito: AmbitoAnalisis;
  entidadId: string;
  usuarioId: string;
  fechaEjecucion: string;
  estadoPersistencia: EstadoPersistencia;
  estadoCalculo: EstadoCalculo;
}

// ── Resultados por ámbito ─────────────────────────────────────────────────────

export interface ResultadoAnalisisFacultad {
  metadata: MetadataEjecucion;
  resultado: TablroFacultadResponseDto;
}

export interface ResultadoAnalisisCarrera {
  metadata: MetadataEjecucion;
  resultado: TablroCarreraResponseDto;
}

export interface ResultadoAnalisisPlan {
  metadata: MetadataEjecucion;
  resultado: TablroPlanResponseDto;
}

// ── Historial ─────────────────────────────────────────────────────────────────

export interface ItemHistorial {
  ejecucionId: string;
  fechaInicio: string;
  fechaFin: string | null;
  usuarioId: string;
  estadoEjecucion: EstadoEjecucion;
  estadoCalculo: EstadoCalculo | null;
  errores: string | null;
}

export interface HistorialAnalisis {
  ambito: AmbitoAnalisis;
  entidadId: string;
  total: number;
  pagina: number;
  porPagina: number;
  items: ItemHistorial[];
}

// ── Detalle de ejecución histórica ────────────────────────────────────────────

export interface DetalleEjecucion {
  ejecucionId: string;
  ambito: AmbitoAnalisis;
  entidadId: string;
  usuarioId: string;
  estadoEjecucion: EstadoEjecucion;
  estadoCalculo: EstadoCalculo | null;
  fechaInicio: string;
  fechaFin: string | null;
  errores: string | null;
  snapshot: TablroFacultadResponseDto | TablroCarreraResponseDto | TablroPlanResponseDto | null;
}
