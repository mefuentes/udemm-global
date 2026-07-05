const ROLES_ADMIN = ['ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA'];
const ROLES_EDITAR = [...ROLES_ADMIN, 'ADMINISTRATIVO'];
const ROLES_VER = [...ROLES_EDITAR, 'DECANO', 'RECTORADO', 'DIRECTOR_CARRERA', 'DOCENTE'];

export const ROLES_CON_ACCESO_GESTION_ACADEMICA = ROLES_VER;

export function getPermisosGestionAcademica(rol: string) {
  return {
    ver: ROLES_VER.includes(rol),
    crear: ROLES_EDITAR.includes(rol),
    editar: ROLES_EDITAR.includes(rol),
    eliminar: ROLES_ADMIN.includes(rol),
  };
}
