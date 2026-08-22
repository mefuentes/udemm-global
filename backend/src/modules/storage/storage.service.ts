import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly basePath: string;

  constructor() {
    this.basePath = process.env.STORAGE_NORMATIVAS_PATH
      ? path.resolve(process.env.STORAGE_NORMATIVAS_PATH)
      : path.join(process.cwd(), 'storage', 'normativas');

    this.asegurarDirectorios();
  }

  private asegurarDirectorios(): void {
    for (const sub of ['originales', 'cuarentena']) {
      const dir = path.join(this.basePath, sub);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Directorio creado: ${dir}`);
      }
    }
  }

  async guardar(
    buffer: Buffer,
    nombreFisico: string,
    subcarpeta: 'originales' | 'cuarentena' = 'originales',
  ): Promise<string> {
    const rutaRelativa = `${subcarpeta}/${nombreFisico}`;
    const rutaAbsoluta = this.resolverRuta(rutaRelativa);
    await fs.promises.writeFile(rutaAbsoluta, buffer);
    return rutaRelativa;
  }

  async eliminar(rutaRelativa: string): Promise<void> {
    try {
      const rutaAbsoluta = this.resolverRuta(rutaRelativa);
      await fs.promises.unlink(rutaAbsoluta);
    } catch {
      // Archivo ya inexistente — no es error crítico
    }
  }

  async mover(rutaOrigen: string, rutaDestino: string): Promise<void> {
    const absOrigen  = this.resolverRuta(rutaOrigen);
    const absDestino = this.resolverRuta(rutaDestino);
    try {
      await fs.promises.rename(absOrigen, absDestino);
    } catch (e: any) {
      if (e.code === 'EXDEV') {
        // Cross-device link: copiar y eliminar origen
        await fs.promises.copyFile(absOrigen, absDestino);
        await fs.promises.unlink(absOrigen);
      } else {
        throw e;
      }
    }
  }

  async existeArchivo(rutaRelativa: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolverRuta(rutaRelativa), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  crearReadStream(rutaRelativa: string): fs.ReadStream {
    return fs.createReadStream(this.resolverRuta(rutaRelativa));
  }

  rutaAbsoluta(rutaRelativa: string): string {
    return this.resolverRuta(rutaRelativa);
  }

  // Previene path traversal: resuelve y verifica que el resultado esté dentro de basePath
  private resolverRuta(rutaRelativa: string): string {
    const absoluta = path.resolve(this.basePath, rutaRelativa);
    const base     = path.resolve(this.basePath);
    if (!absoluta.startsWith(base + path.sep) && absoluta !== base) {
      throw new InternalServerErrorException('Ruta de archivo inválida');
    }
    return absoluta;
  }
}
