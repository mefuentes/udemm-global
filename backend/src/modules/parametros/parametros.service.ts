import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const PARAMETROS_DEFAULTS = [
  { clave: 'nombreInstitucion',    valor: 'Universidad de la Marina Mercante', descripcion: 'Nombre completo de la institución' },
  { clave: 'siglaInstitucion',     valor: 'UDEMM',                              descripcion: 'Sigla institucional' },
  { clave: 'correoSoporte',        valor: 'soporte@udemm.edu.ar',               descripcion: 'Correo de soporte técnico' },
  { clave: 'telefonoInstitucional', valor: '+54 11 0000-0000',                  descripcion: 'Teléfono institucional' },
  { clave: 'colorPrimario',        valor: '#0f4c81',                            descripcion: 'Color primario institucional (azul UDEMM)' },
  { clave: 'colorSecundario',      valor: '#f26b22',                            descripcion: 'Color secundario institucional (naranja UDEMM)' },
];

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerParametros() {
    const existentes = await this.prisma.parametroGeneral.findMany({ orderBy: { clave: 'asc' } });
    const clavesExistentes = new Set(existentes.map(p => p.clave));

    const faltantes = PARAMETROS_DEFAULTS.filter(d => !clavesExistentes.has(d.clave));
    if (faltantes.length > 0) {
      await this.prisma.parametroGeneral.createMany({ data: faltantes, skipDuplicates: true });
      return this.prisma.parametroGeneral.findMany({ orderBy: { clave: 'asc' } });
    }
    return existentes;
  }

  async actualizarParametros(parametros: Array<{ clave: string; valor: string }>) {
    await Promise.all(
      parametros.map(p =>
        this.prisma.parametroGeneral.upsert({
          where: { clave: p.clave },
          update: { valor: p.valor },
          create: { clave: p.clave, valor: p.valor }
        })
      )
    );
    return this.obtenerParametros();
  }
}
