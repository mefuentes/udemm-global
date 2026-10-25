export type AmbitoAnalisis = 'FACULTAD' | 'CARRERA' | 'PLAN';
export type EstadoPersistencia = 'GUARDADO' | 'PENDIENTE_SCHEMA';
export type EstadoCalculo = 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA';
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
