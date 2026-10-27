import type { AlertaBandeja } from '../alertas/alertas.dto';

/**
 * Referencia a un ítem de catálogo (TipoDedicacionConeau o TipoPosgrado).
 * PREPARATORIO (CIERRE-03 Fase B) — requiere migración antes de que el servicio
 * pueda popularlo desde la base de datos.
 */
export interface CatalogItemRef {
  id: string;
  nombre: string;
  codigo?: string;
}

export interface CargoParsed {
  id: string;
  cargoNombre: string;
  designacion: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  vigente: boolean;
  verificado: boolean;
  fuente: string;
}

export interface VinculacionParsed {
  id: string;
  materiaId: string;
  materiaNombre: string;
  carreraId: string;
  carreraNombre: string;
  planEstudioId: string;
  planEstudioNombre: string;
  facultadId: string;
  facultadNombre: string;
  estado: string;
  esResponsableCatedra: boolean | null;
  horasSemana: number | null;
  anioInicio: number | null;
}

export interface CompletitudFicha {
  tieneFormacionBasica: boolean;
  tienePosgrado: boolean;
  tieneActividadInvestigacion: boolean;
  tieneDedicacion: boolean;
  porcentaje: number;
}

export interface FichaDocenteDto {
  identificacion: {
    id: string;
    nombre: string;
    apellido: string;
    nombreCompleto: string;
    tipoDocumento: string;
    numeroDocumento: string;
    correoElectronico: string;
    activo: boolean;
    dedicacion: string | null;
    categoriaDocente: string | null;
    tituloGrado: string | null;
    tituloPosgrado: string | null;
    relevamientoCargosCompleto: boolean;
    /**
     * PREPARATORIO D-05: categoría CONEAU de dedicación del catálogo controlado.
     * Null cuando tipoDedicacionConeauId = null (NO_DETERMINADA) o antes de migración.
     * No reemplaza el campo de texto libre `dedicacion`.
     */
    tipoDedicacionConeau?: CatalogItemRef | null;
    /**
     * PREPARATORIO D-06: tipo de posgrado declarado para CONEAU.
     * Null cuando tipoPosgradoId = null (no clasificado) o antes de migración.
     * No reemplaza el campo de texto libre `tituloPosgrado`.
     */
    tipoPosgrado?: CatalogItemRef | null;
  };
  formacionAcademica: {
    tituloGrado: string | null;
    tituloPosgrado: string | null;
    otrosTitulos: string | null;
    actividadesPosgradoJson: string | null;
  };
  actividadesInvestigacion: {
    tituloProyectoInvestigacion: string | null;
    proyectosInvestigacionJson: string | null;
    produccionCientificaJson: string | null;
  };
  cargosInstitucionales: CargoParsed[];
  vinculaciones: VinculacionParsed[];
  alertasEnScope: AlertaBandeja[];
  completitud: CompletitudFicha;
}
