import type { AmbitoAnalisis } from '../analisis/analisis.dto';
import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { AlertaBandeja } from '../alertas/alertas.dto';

export interface SnapshotExport {
  ejecucionId: string;
  ambito: AmbitoAnalisis;
  entidadId: string;
  entidadNombre: string;
  carreraNombre?: string;
  facultadNombre?: string;
  facultadId: string;
  usuarioId: string;
  fechaEjecucion: string;
  estadoCalculo: EstadoCalculo | null;
  snapshot: Record<string, unknown>;
  alertas: AlertaBandeja[];
}
