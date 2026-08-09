import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { ActualizarDocenteDto } from './dto/actualizar-docente.dto';

@Injectable()
export class DocentesService {
  constructor(private readonly prisma: PrismaService) {}

  private parseFechaNacimiento(fechaNacimiento?: string | null) {
    if (!fechaNacimiento || !fechaNacimiento.trim()) {
      return null;
    }

    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fechaNacimiento)) {
      throw new BadRequestException('La fecha de nacimiento debe tener formato YYYY-MM-DD');
    }

    const fecha = new Date(`${fechaNacimiento}T00:00:00.000Z`);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha de nacimiento no es válida');
    }

    const fechaNormalizada = fecha.toISOString().split('T')[0];
    if (fechaNormalizada !== fechaNacimiento) {
      throw new BadRequestException('La fecha de nacimiento no es válida');
    }

    return fecha;
  }

  private validarNumeroDocumento(tipoDocumento?: string, numeroDocumento?: string) {
    if (!tipoDocumento || !numeroDocumento) {
      return;
    }

    if (tipoDocumento === 'DNI' && !/^\d+$/.test(numeroDocumento)) {
      throw new BadRequestException('El número de documento para DNI debe contener solo números');
    }

    if (tipoDocumento === 'PASAPORTE' && !/^[A-Za-z0-9-]+$/.test(numeroDocumento)) {
      throw new BadRequestException('El número de PASAPORTE solo puede contener letras, números y guiones');
    }
  }

  private formatearDocenteFecha<T extends { fechaNacimiento?: Date | string | null }>(docente: T): Omit<T, 'fechaNacimiento'> & { fechaNacimiento: string | null } {
    return {
      ...docente,
      fechaNacimiento: docente.fechaNacimiento ? new Date(docente.fechaNacimiento).toISOString().split('T')[0] : null
    };
  }

  async crearDocente(data: CrearDocenteDto) {
    this.validarNumeroDocumento(data.tipoDocumento, data.numeroDocumento);

    const existe = await this.prisma.docente.findFirst({
      where: {
        OR: [
          { correoElectronico: data.correoElectronico },
          { numeroDocumento: data.numeroDocumento }
        ]
      }
    });

    if (existe) {
      if (existe.correoElectronico === data.correoElectronico) {
        throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
      }
      if (existe.numeroDocumento === data.numeroDocumento) {
        throw new BadRequestException('El número de documento ya está registrado para otro docente');
      }
      throw new BadRequestException('El docente ya existe con el correo o número de documento proporcionado');
    }

    try {
      const docente = await this.prisma.docente.create({
        data: {
          ...data,
          fechaNacimiento: this.parseFechaNacimiento(data.fechaNacimiento)
        },
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      });

      return this.formatearDocenteFecha(docente);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        const target = (error as any).meta?.target;
        if (Array.isArray(target) && target.includes('numeroDocumento')) {
          throw new BadRequestException('El número de documento ya está registrado para otro docente');
        }
        if (Array.isArray(target) && target.includes('correoElectronico')) {
          throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
        }
      }
      throw error;
    }
  }

  async obtenerDocentes(busqueda?: string, activo?: boolean, pagina = 1, limite = 10) {
    const filtros: any = {};

    if (activo !== undefined) {
      filtros.activo = activo;
    }

    if (busqueda) {
      filtros.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' as const } },
        { apellido: { contains: busqueda, mode: 'insensitive' as const } },
        { correoElectronico: { contains: busqueda, mode: 'insensitive' as const } },
        { numeroDocumento: { contains: busqueda, mode: 'insensitive' as const } }
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.docente.count({ where: filtros }),
      this.prisma.docente.findMany({
        where: filtros,
        orderBy: { fechaCreacion: 'desc' },
        take: limite,
        skip: (pagina - 1) * limite,
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      })
    ]);

    return {
      data: data.map((docente) => {
        const formatted = this.formatearDocenteFecha(docente) as any;
        return {
          ...formatted,
          cargo: formatted.categoriaDocente ?? formatted.cargoDeclarado ?? '',
          dedicacion: formatted.dedicacion ?? ''
        };
      }),
      total,
      pagina,
      limite
    };
  }

  async obtenerDocentePorId(id: string) {
    const docente = await this.prisma.docente.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            correoElectronico: true,
            rol: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      }
    });
    if (!docente) {
      throw new NotFoundException('Docente no encontrado');
    }
    return this.formatearDocenteFecha(docente);
  }

  async obtenerDocentePorUsuarioId(usuarioId: string) {
    if (!usuarioId) {
      throw new NotFoundException('Usuario no autenticado');
    }

    const docente = await this.prisma.docente.findFirst({
      where: { usuarioId },
      include: {
        usuario: {
          select: {
            id: true,
            correoElectronico: true,
            rol: {
              select: { id: true, nombre: true }
            }
          }
        }
      }
    });

    if (docente) {
      return this.formatearDocenteFecha(docente);
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correoElectronico: true,
        rol: {
          select: { id: true, nombre: true }
        }
      }
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: null,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tipoDocumento: 'DNI',
      numeroDocumento: '',
      correoElectronico: usuario.correoElectronico,
      sexo: '',
      fechaNacimiento: null,
      cuit: '',
      telefono: '',
      calle: '',
      numero: '',
      pisoDepto: '',
      residencia: '',
      provincia: '',
      localidad: '',
      codigoPostal: '',
      domicilio: '',
      tituloGrado: '',
      tituloPosgrado: '',
      cargoDeclarado: '',
      dedicacion: '',
      unidadAcademica: '',
      categoriaDocente: '',
      dedicacionDeclaradaSemanal: '',
      tiempoDocencia: '',
      tiempoInvestigacion: '',
      tiempoExtension: '',
      tiempoGestionAcademica: '',
      fechaInicioCargo: '',
      fechaFinCargo: '',
      designacion: '',
      disciplinaCargo: '',
      justificacionPertinencia: '',
      actividadesProfesionales: '',
      antecedentesAcademicos: '',
      activo: true,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
      usuario: {
        id: usuario.id,
        correoElectronico: usuario.correoElectronico,
        rol: usuario.rol
      },
      usuarioId: usuario.id
    } as any;
  }

  private async validarTrayectoriaCargosPasados(json: string): Promise<void> {
    let items: Array<{ cargoId?: string; modalidadId?: string }>;
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return;
      items = parsed;
    } catch {
      return;
    }
    for (const item of items) {
      if (item.cargoId) {
        const cargo = await (this.prisma as any).cargo.findUnique({ where: { id: item.cargoId } });
        if (!cargo) throw new BadRequestException('El cargo seleccionado no existe');
        if (!cargo.activo) throw new BadRequestException(`El cargo "${cargo.nombre}" está inactivo y no puede utilizarse`);
      }
      if (item.modalidadId) {
        const modalidad = await (this.prisma as any).modalidad.findUnique({ where: { id: item.modalidadId } });
        if (!modalidad) throw new BadRequestException('La modalidad seleccionada no existe');
        if (!modalidad.activo) throw new BadRequestException(`La modalidad "${modalidad.nombre}" está inactiva y no puede utilizarse`);
      }
    }
  }

  async actualizarDocente(id: string, data: ActualizarDocenteDto) {
    const docenteExistente = await this.obtenerDocentePorId(id);

    if (data.correoElectronico || data.numeroDocumento) {
      const condiciones: any[] = [];
      if (data.correoElectronico) {
        condiciones.push({ correoElectronico: data.correoElectronico });
      }
      if (data.numeroDocumento) {
        condiciones.push({ numeroDocumento: data.numeroDocumento });
      }

      if (condiciones.length > 0) {
        const conflicto = await this.prisma.docente.findFirst({
          where: {
            AND: [
              { id: { not: id } },
              { OR: condiciones }
            ]
          }
        });

        if (conflicto) {
          if (data.correoElectronico && conflicto.correoElectronico === data.correoElectronico) {
            throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
          }
          if (data.numeroDocumento && conflicto.numeroDocumento === data.numeroDocumento) {
            throw new BadRequestException('El número de documento ya está registrado para otro docente');
          }
        }
      }
    }

    if (data.trayectoriaCargosPasadosJson !== undefined) {
      await this.validarTrayectoriaCargosPasados(data.trayectoriaCargosPasadosJson);
    }

    const dataToUpdate = {
      ...data,
      fechaNacimiento:
        typeof data.fechaNacimiento === 'string'
          ? this.parseFechaNacimiento(data.fechaNacimiento)
          : undefined
    };

    this.validarNumeroDocumento(
      dataToUpdate.tipoDocumento ?? docenteExistente.tipoDocumento,
      dataToUpdate.numeroDocumento ?? docenteExistente.numeroDocumento
    );

    try {
      const docenteActualizado = await this.prisma.docente.update({
        where: { id },
        data: dataToUpdate,
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      });

      return this.formatearDocenteFecha(docenteActualizado);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        const target = (error as any).meta?.target;
        if (Array.isArray(target) && target.includes('numeroDocumento')) {
          throw new BadRequestException('El número de documento ya está registrado para otro docente');
        }
        if (Array.isArray(target) && target.includes('correoElectronico')) {
          throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
        }
      }
      throw error;
    }
  }

  async actualizarDocentePorUsuarioId(usuarioId: string, data: ActualizarDocenteDto) {
    if (!usuarioId) {
      throw new NotFoundException('Usuario no autenticado');
    }

    const docente = await this.prisma.docente.findFirst({ where: { usuarioId } });
    if (docente) {
      return this.actualizarDocente(docente.id, data);
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId }
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const crearData: any = {
      usuarioId,
      nombre: data.nombre ?? usuario.nombre,
      apellido: data.apellido ?? usuario.apellido,
      correoElectronico: data.correoElectronico ?? usuario.correoElectronico,
      tipoDocumento: data.tipoDocumento ?? 'DNI',
      numeroDocumento: data.numeroDocumento ?? '',
      sexo: data.sexo ?? null,
      fechaNacimiento: data.fechaNacimiento ? this.parseFechaNacimiento(data.fechaNacimiento) : null,
      cuit: data.cuit ?? null,
      telefono: data.telefono ?? null,
      calle: data.calle ?? null,
      numero: data.numero ?? null,
      pisoDepto: data.pisoDepto ?? null,
      residencia: data.residencia ?? null,
      provincia: data.provincia ?? null,
      localidad: data.localidad ?? null,
      codigoPostal: data.codigoPostal ?? null,
      domicilio: data.domicilio ?? null,
      tituloGrado: data.tituloGrado ?? null,
      tituloPosgrado: data.tituloPosgrado ?? null,
      cargoDeclarado: data.cargoDeclarado ?? null,
      justificacionPertinencia: data.justificacionPertinencia ?? null,
      actividadesProfesionales: data.actividadesProfesionales ?? null,
      antecedentesAcademicos: data.antecedentesAcademicos ?? null,
      activo: data.activo ?? true
    };

    try {
      this.validarNumeroDocumento(crearData.tipoDocumento, crearData.numeroDocumento);

      const docenteCreado = await this.prisma.docente.create({
        data: crearData,
        include: {
          usuario: {
            select: {
              id: true,
              correoElectronico: true,
              rol: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      });

      return this.formatearDocenteFecha(docenteCreado);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        const target = (error as any).meta?.target;
        if (Array.isArray(target) && target.includes('numeroDocumento')) {
          throw new BadRequestException('El número de documento ya está registrado para otro docente');
        }
        if (Array.isArray(target) && target.includes('correoElectronico')) {
          throw new BadRequestException('El correo electrónico ya está registrado para otro docente');
        }
      }
      throw error;
    }
  }

  async eliminarDocente(id: string) {
    await this.obtenerDocentePorId(id);
    const docente = await this.prisma.docente.update({
      where: { id },
      data: { activo: false }
    });
    return this.formatearDocenteFecha(docente);
  }
}
