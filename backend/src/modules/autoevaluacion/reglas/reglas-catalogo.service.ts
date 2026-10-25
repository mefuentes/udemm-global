import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';
import { RegistroIndicadores } from '../indicadores/indicadores.registry';

const ROLES_GLOBALES = new Set([
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
]);

export interface FacultadConConfig {
  facultadId: string;
  nombre: string;
  config: {
    p01TopeH: number;
    p02BajaH: number;
    p03MaxMat: number;
    updatedAt: Date;
  } | null;
}

@Injectable()
export class ReglasCatalogoService {
  constructor(
    private readonly registro: RegistroIndicadores,
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  listarCatalogo() {
    return this.registro.listar().map((def) => ({
      codigo: def.codigo,
      nombre: def.nombre,
      descripcion: def.descripcion,
      tipo: def.tipo,
      severidad: def.severidad,
      alcance: def.alcance,
      grupo: def.grupo,
      estadoImplementacion: def.estadoImplementacion,
      ...(def.motivoPendiente !== undefined && { motivoPendiente: def.motivoPendiente }),
      parametros: def.parametros,
    }));
  }

  /**
   * Devuelve las Facultades accesibles para el usuario con su config MOD-AUT (P-01, P-02, P-03).
   * null en config indica que la Facultad aun no tiene configuracion registrada.
   */
  async obtenerFacultadesConConfig(
    usuarioId: string,
    rolNombre: string,
  ): Promise<FacultadConConfig[]> {
    let facultadIds: string[] | null = null;

    if (ROLES_GLOBALES.has(rolNombre)) {
      facultadIds = null;
    } else if (rolNombre === 'DECANO') {
      const asocs = await this.prisma.usuarioFacultad.findMany({
        where: { usuarioId },
        select: { facultadId: true },
      });
      facultadIds = asocs.map((a) => a.facultadId);
    } else if (rolNombre === 'DIRECTOR_CARRERA') {
      const carreras = await this.scope.getCarrerasEnScope(usuarioId, rolNombre);
      if (!carreras || carreras.length === 0) return [];
      const datos = await this.prisma.carrera.findMany({
        where: { id: { in: carreras } },
        select: { facultadId: true },
      });
      facultadIds = [...new Set(datos.map((c) => c.facultadId))];
    } else {
      throw new ForbiddenException();
    }

    const where = facultadIds !== null ? { id: { in: facultadIds } } : {};

    const facultades = await this.prisma.facultad.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        autoevaluacionConfig: {
          select: {
            p01TopeH: true,
            p02BajaH: true,
            p03MaxMat: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return facultades.map((f) => ({
      facultadId: f.id,
      nombre: f.nombre,
      config: f.autoevaluacionConfig ?? null,
    }));
  }
}
