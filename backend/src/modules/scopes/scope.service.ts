import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Servicio centralizado de scopes institucionales.
 *
 * SCOPE != PERMISO
 * El scope delimita el universo de Carreras sobre las que un usuario puede
 * operar. El RBAC (roles en controlador) determina qué operación puede ejecutar.
 * Ambas condiciones deben cumplirse: PERMISO RBAC + SCOPE INSTITUCIONAL.
 *
 * Modelo por rol:
 *   DIRECTOR_CARRERA  → alcance sobre su/sus Carrera(s) asociadas (UsuarioCarrera)
 *   DECANO            → alcance sobre todas las Carreras de su Facultad (UsuarioFacultad → Facultad → Carreras)
 *   SECRETARIA_ACADEMICA, RECTORADO, ADMINISTRADOR_SISTEMA, ADMINISTRATIVO → alcance global
 *   Cualquier otro rol (DOCENTE, etc.) → sin scope de gestión
 *
 * Regla de seguridad:
 *   La asociación residual de un usuario que YA NO tiene rol DIRECTOR_CARRERA o DECANO
 *   no le concede scope, porque este servicio SIEMPRE verifica rolNombre + asociación.
 *   Adicionalmente, usuarios.service.ts limpia las asociaciones al cambiar el rol.
 */
@Injectable()
export class ScopeService {
  // Roles con alcance global sobre Carreras (sin restricción territorial)
  private static readonly ROLES_GLOBALES = new Set([
    'ADMINISTRADOR_SISTEMA',
    'SECRETARIA_ACADEMICA',
    'RECTORADO',
    'ADMINISTRATIVO',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determina si el usuario tiene scope institucional sobre la Carrera indicada.
   *
   * @param usuarioId  - id del usuario autenticado
   * @param rolNombre  - nombre del rol activo del usuario
   * @param carreraId  - id de la Carrera a evaluar
   * @returns true si el usuario puede operar sobre esa Carrera (scope permitido)
   */
  async tieneScopeCarrera(
    usuarioId: string,
    rolNombre: string,
    carreraId: string,
  ): Promise<boolean> {
    if (ScopeService.ROLES_GLOBALES.has(rolNombre)) return true;

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const assoc = await this.prisma.usuarioCarrera.findUnique({
        where: { usuarioId_carreraId: { usuarioId, carreraId } },
      });
      return assoc !== null;
    }

    if (rolNombre === 'DECANO') {
      const assocFacultad = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId },
        select: { facultadId: true },
      });
      if (!assocFacultad) return false;

      const carrera = await this.prisma.carrera.findUnique({
        where: { id: carreraId },
        select: { facultadId: true },
      });
      return carrera?.facultadId === assocFacultad.facultadId;
    }

    // Cualquier otro rol (DOCENTE, etc.): sin scope de gestión sobre Carreras
    return false;
  }

  /**
   * Devuelve los carreraIds en scope para el usuario.
   *
   * @returns null  → alcance global (sin restricción de Carrera)
   * @returns []    → sin acceso a ninguna Carrera
   * @returns [...] → array de carreraIds accesibles
   */
  async getCarrerasEnScope(
    usuarioId: string,
    rolNombre: string,
  ): Promise<string[] | null> {
    if (ScopeService.ROLES_GLOBALES.has(rolNombre)) return null;

    if (rolNombre === 'DIRECTOR_CARRERA') {
      const assocs = await this.prisma.usuarioCarrera.findMany({
        where: { usuarioId },
        select: { carreraId: true },
      });
      return assocs.map(a => a.carreraId);
    }

    if (rolNombre === 'DECANO') {
      const assocFacultad = await this.prisma.usuarioFacultad.findFirst({
        where: { usuarioId },
        select: { facultadId: true },
      });
      if (!assocFacultad) return [];

      const carreras = await this.prisma.carrera.findMany({
        where: { facultadId: assocFacultad.facultadId },
        select: { id: true },
      });
      return carreras.map(c => c.id);
    }

    return [];
  }
}
