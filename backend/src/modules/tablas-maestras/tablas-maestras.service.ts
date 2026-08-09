import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearTablaMaestraDto } from './dto/crear-tabla-maestra.dto';
import { ActualizarTablaMaestraDto } from './dto/actualizar-tabla-maestra.dto';

// Nombres de modelos Prisma válidos para las tablas maestras
const TIPOS_VALIDOS = ['catedras', 'cargos', 'designaciones', 'modalidades', 'areas-disciplinares'] as const;
type TipoTabla = typeof TIPOS_VALIDOS[number];

// Mapeo plural (ruta API) → nombre del modelo Prisma (singular, camelCase)
const MODELO: Record<TipoTabla, string> = {
  catedras:            'catedra',
  cargos:              'cargo',
  designaciones:       'designacion',
  modalidades:         'modalidad',
  'areas-disciplinares': 'areaDisciplinar',
};

@Injectable()
export class TablasMaestrasService {
  constructor(private readonly prisma: PrismaService) {}

  private validarTipo(tipo: string): TipoTabla {
    if (!TIPOS_VALIDOS.includes(tipo as TipoTabla)) {
      throw new BadRequestException(
        `Tipo "${tipo}" no válido. Use: ${TIPOS_VALIDOS.join(', ')}`,
      );
    }
    return tipo as TipoTabla;
  }

  private modelo(tipo: TipoTabla) {
    return (this.prisma as any)[MODELO[tipo]];
  }

  async listar(tipo: string, buscar?: string, activo?: string) {
    const t = this.validarTipo(tipo);
    const where: Record<string, any> = {};
    if (buscar?.trim()) {
      where.nombre = { contains: buscar.trim().toUpperCase() };
    }
    if (activo === 'true')  where.activo = true;
    if (activo === 'false') where.activo = false;
    return this.modelo(t).findMany({ where, orderBy: { nombre: 'asc' } });
  }

  async listarActivos(tipo: string) {
    const t = this.validarTipo(tipo);
    return this.modelo(t).findMany({
      where:   { activo: true },
      orderBy: { nombre: 'asc' },
      select:  { id: true, nombre: true },
    });
  }

  async crear(tipo: string, dto: CrearTablaMaestraDto) {
    const t      = this.validarTipo(tipo);
    const nombre = dto.nombre.trim().toUpperCase();
    const existe = await this.modelo(t).findFirst({ where: { nombre } });
    if (existe) {
      throw new ConflictException(`Ya existe "${nombre}" en ${tipo}`);
    }
    return this.modelo(t).create({ data: { nombre } });
  }

  async actualizar(tipo: string, id: string, dto: ActualizarTablaMaestraDto) {
    const t       = this.validarTipo(tipo);
    const registro = await this.modelo(t).findUnique({ where: { id } });
    if (!registro) throw new NotFoundException('Registro no encontrado');

    if (!dto.nombre?.trim()) return registro;

    const nombre  = dto.nombre.trim().toUpperCase();
    const duplicado = await this.modelo(t).findFirst({
      where: { nombre, NOT: { id } },
    });
    if (duplicado) {
      throw new ConflictException(`Ya existe "${nombre}" en ${tipo}`);
    }
    return this.modelo(t).update({ where: { id }, data: { nombre } });
  }

  async toggleActivo(tipo: string, id: string) {
    const t       = this.validarTipo(tipo);
    const registro = await this.modelo(t).findUnique({ where: { id } });
    if (!registro) throw new NotFoundException('Registro no encontrado');
    return this.modelo(t).update({
      where: { id },
      data:  { activo: !registro.activo },
    });
  }

  async eliminar(tipo: string, id: string) {
    const t       = this.validarTipo(tipo);
    const registro = await this.modelo(t).findUnique({ where: { id } });
    if (!registro) throw new NotFoundException('Registro no encontrado');
    try {
      await this.modelo(t).delete({ where: { id } });
      return { mensaje: 'Eliminado correctamente' };
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new ConflictException('No se puede eliminar: el valor está siendo utilizado en el sistema');
      }
      throw e;
    }
  }
}
