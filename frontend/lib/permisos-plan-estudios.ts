export interface PermisosPrograma {
  ver: boolean;
  editar: boolean;
  aprobar: boolean;
  exportar: boolean;
}

export function getPermisosPrograma(rolNombre: string): PermisosPrograma {
  switch (rolNombre) {
    case 'ADMINISTRADOR_SISTEMA':
    case 'SECRETARIA_ACADEMICA':
    case 'DIRECTOR_CARRERA':
      return { ver: true, editar: true, aprobar: true, exportar: true };
    case 'ADMINISTRATIVO':
      return { ver: true, editar: true, aprobar: false, exportar: false };
    case 'DECANO':
    case 'RECTORADO':
      return { ver: true, editar: false, aprobar: false, exportar: true };
    case 'DOCENTE':
      return { ver: true, editar: false, aprobar: false, exportar: false };
    default:
      return { ver: false, editar: false, aprobar: false, exportar: false };
  }
}

export interface PermisosPlanEstudio {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
  exportar: boolean;
  gestionarContenido: boolean;
}

export const ROLES_CON_ACCESO_PLAN_ESTUDIOS = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
  'DECANO',
  'RECTORADO',
  'DOCENTE'
] as const;

export function getPermisosPlanEstudio(rolNombre: string): PermisosPlanEstudio {
  switch (rolNombre) {
    case 'ADMINISTRADOR_SISTEMA':
      return {
        ver: true,
        crear: true,
        editar: true,
        eliminar: true,
        exportar: true,
        gestionarContenido: true
      };
    case 'SECRETARIA_ACADEMICA':
      return {
        ver: true,
        crear: true,
        editar: true,
        eliminar: false,
        exportar: true,
        gestionarContenido: true
      };
    case 'DIRECTOR_CARRERA':
      return {
        ver: true,
        crear: true,
        editar: true,
        eliminar: false,
        exportar: true,
        gestionarContenido: true
      };
    case 'ADMINISTRATIVO':
      return {
        ver: true,
        crear: false,
        editar: true,
        eliminar: false,
        exportar: false,
        gestionarContenido: false
      };
    case 'DECANO':
    case 'RECTORADO':
      return {
        ver: true,
        crear: false,
        editar: false,
        eliminar: false,
        exportar: true,
        gestionarContenido: false
      };
    case 'DOCENTE':
      return {
        ver: true,
        crear: false,
        editar: false,
        eliminar: false,
        exportar: false,
        gestionarContenido: false
      };
    default:
      return {
        ver: false,
        crear: false,
        editar: false,
        eliminar: false,
        exportar: false,
        gestionarContenido: false
      };
  }
}
