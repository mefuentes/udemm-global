import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const LOGO_CLAVE = 'logoInstitucion';

// Claves gestionadas por endpoints específicos o retiradas de la UI — no se exponen en el listado principal.
const CLAVES_EXCLUIDAS = [LOGO_CLAVE, 'colorPrimario', 'colorSecundario', 'telefonoInstitucional'];

const PARAMETROS_DEFAULTS = [
  { clave: 'nombreInstitucion',  valor: 'Universidad de la Marina Mercante', descripcion: 'Nombre completo de la institución' },
  { clave: 'siglaInstitucion',   valor: 'UDEMM',                              descripcion: 'Sigla institucional' },
  { clave: 'cicloLectivoActual', valor: String(new Date().getFullYear()),     descripcion: 'Ciclo lectivo en curso (4 dígitos). Se utiliza como valor inicial en formularios académicos.' },
  { clave: 'correoSoporte',      valor: 'soporte@udemm.edu.ar',               descripcion: 'Correo de soporte técnico' },
];

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerParametros() {
    const existentes = await this.prisma.parametroGeneral.findMany({
      where: { clave: { notIn: CLAVES_EXCLUIDAS } },
      orderBy: { clave: 'asc' },
    });
    const clavesExistentes = new Set(existentes.map(p => p.clave));

    const faltantes = PARAMETROS_DEFAULTS.filter(d => !clavesExistentes.has(d.clave));
    if (faltantes.length > 0) {
      await this.prisma.parametroGeneral.createMany({ data: faltantes, skipDuplicates: true });
      return this.prisma.parametroGeneral.findMany({
        where: { clave: { notIn: CLAVES_EXCLUIDAS } },
        orderBy: { clave: 'asc' },
      });
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

  async obtenerValor(clave: string, valorPorDefecto: string): Promise<string> {
    const param = await this.prisma.parametroGeneral.findUnique({ where: { clave } });
    return param?.valor ?? valorPorDefecto;
  }

  async subirLogo(buffer: Buffer, mimeType: string): Promise<{ valor: string }> {
    if (buffer.length > 200 * 1024) {
      throw new BadRequestException('El logo no puede superar los 200 KB.');
    }
    const isPng  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    if (!isPng && !isJpeg) {
      throw new BadRequestException('El archivo debe ser una imagen PNG o JPEG válida.');
    }
    const ext = isPng ? 'png' : 'jpeg';
    const dataUrl = `data:image/${ext};base64,${buffer.toString('base64')}`;
    await this.prisma.parametroGeneral.upsert({
      where:  { clave: LOGO_CLAVE },
      update: { valor: dataUrl, fechaActualizacion: new Date() },
      create: { clave: LOGO_CLAVE, valor: dataUrl, descripcion: 'Logo institucional (PNG/JPG, máx. 200 KB, almacenado como base64)' },
    });
    return { valor: dataUrl };
  }

  async obtenerLogo(): Promise<string | null> {
    const param = await this.prisma.parametroGeneral.findUnique({ where: { clave: LOGO_CLAVE } });
    return param?.valor ?? null;
  }

  async obtenerParametrosPublicos(): Promise<{ clave: string; valor: string }[]> {
    const claves = ['nombreInstitucion', 'siglaInstitucion', 'cicloLectivoActual'];
    const registros = await this.prisma.parametroGeneral.findMany({
      where: { clave: { in: claves } },
      select: { clave: true, valor: true },
    });
    // Completar con defaults si faltan
    return claves.map(c => {
      const encontrado = registros.find(r => r.clave === c);
      if (encontrado) return encontrado;
      const def = PARAMETROS_DEFAULTS.find(d => d.clave === c);
      return { clave: c, valor: def?.valor ?? '' };
    });
  }
}
