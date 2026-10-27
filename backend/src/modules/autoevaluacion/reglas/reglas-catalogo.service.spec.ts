import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReglasCatalogoService } from './reglas-catalogo.service';
import { RegistroIndicadores } from '../indicadores/indicadores.registry';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeService } from '../../scopes/scope.service';

const F1 = 'fac-aaaaaaaa-0001';
const F2 = 'fac-bbbbbbbb-0002';
const C1 = 'car-aaaaaaaa-0001';
const U1 = 'usr-aaaaaaaa-0001';

function makeFac(id: string, nombre: string, cfg: object | null = null) {
  return { id, nombre, autoevaluacionConfig: cfg };
}

describe('ReglasCatalogoService', () => {
  let service: ReglasCatalogoService;
  let prisma: jest.Mocked<PrismaService>;
  let scopeService: jest.Mocked<ScopeService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReglasCatalogoService,
        RegistroIndicadores,
        {
          provide: PrismaService,
          useValue: {
            usuarioFacultad: { findMany: jest.fn() },
            carrera: { findMany: jest.fn() },
            facultad: { findMany: jest.fn() },
          },
        },
        {
          provide: ScopeService,
          useValue: { getCarrerasEnScope: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReglasCatalogoService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    scopeService = module.get(ScopeService) as jest.Mocked<ScopeService>;
  });

  describe('G1 - completitud del catalogo', () => {
    it('contiene las 13 reglas del FSD v2.0', () => {
      const codigos = service.listarCatalogo().map((r) => r.codigo).sort();
      expect(codigos).toEqual(['R-02','R-03','R-04','R-06','R-07','R-08','R-09','R-10','R-11','R-12','R-13','R-14','R-15']);
    });

    it('no incluye R-01 ni R-05', () => {
      const codigos = service.listarCatalogo().map((r) => r.codigo);
      expect(codigos).not.toContain('R-01');
      expect(codigos).not.toContain('R-05');
    });
  });

  describe('G2 - grupos de analisis', () => {
    it('R-02, R-04, R-08 pertenecen a CRUZADAS', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-02','R-04','R-08']) {
        expect(cat.find((r) => r.codigo === c)?.grupo).toBe('CRUZADAS');
      }
    });

    it('R-03, R-06, R-07, R-10, R-12, R-15 pertenecen a DOCENTES', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-03','R-06','R-07','R-10','R-12','R-15']) {
        expect(cat.find((r) => r.codigo === c)?.grupo).toBe('DOCENTES');
      }
    });

    it('R-09, R-11, R-13, R-14 pertenecen a PLANES', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-09','R-11','R-13','R-14']) {
        expect(cat.find((r) => r.codigo === c)?.grupo).toBe('PLANES');
      }
    });
  });

  describe('G3 - severidades', () => {
    it('R-02, R-03, R-04, R-08, R-09 son ALTA', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-02','R-03','R-04','R-08','R-09']) {
        expect(cat.find((r) => r.codigo === c)?.severidad).toBe('ALTA');
      }
    });

    it('R-07, R-11, R-12, R-13, R-14, R-15 son MEDIA', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-07','R-11','R-12','R-13','R-14','R-15']) {
        expect(cat.find((r) => r.codigo === c)?.severidad).toBe('MEDIA');
      }
    });

    it('R-10 es INFORMATIVA y R-06 es NINGUNA', () => {
      const cat = service.listarCatalogo();
      expect(cat.find((r) => r.codigo === 'R-10')?.severidad).toBe('INFORMATIVA');
      expect(cat.find((r) => r.codigo === 'R-06')?.severidad).toBe('NINGUNA');
    });
  });

  describe('G4 - alcances correctos', () => {
    it('R-03, R-04, R-07, R-10, R-12 tienen alcance DOCENTE', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-03','R-04','R-07','R-10','R-12']) {
        expect(cat.find((r) => r.codigo === c)?.alcance).toBe('DOCENTE');
      }
    });

    it('R-06 tiene alcance FACULTAD', () => {
      expect(service.listarCatalogo().find((r) => r.codigo === 'R-06')?.alcance).toBe('FACULTAD');
    });

    it('R-15 tiene alcance CARRERA', () => {
      expect(service.listarCatalogo().find((r) => r.codigo === 'R-15')?.alcance).toBe('CARRERA');
    });
  });

  describe('G5 - parametros configurables', () => {
    it('R-03 expone P-01 (p01TopeH, FACULTAD, configurable)', () => {
      const r03 = service.listarCatalogo().find((r) => r.codigo === 'R-03')!;
      expect(r03.parametros).toHaveLength(1);
      expect(r03.parametros[0]).toMatchObject({ codigo: 'P-01', campoDb: 'p01TopeH', origen: 'FACULTAD', configurable: true });
    });

    it('R-07 expone P-03 (p03MaxMat, FACULTAD, configurable)', () => {
      const r07 = service.listarCatalogo().find((r) => r.codigo === 'R-07')!;
      expect(r07.parametros[0]).toMatchObject({ codigo: 'P-03', campoDb: 'p03MaxMat', configurable: true });
    });

    it('R-15 expone P-03 (p03MaxMat, FACULTAD, configurable)', () => {
      const r15 = service.listarCatalogo().find((r) => r.codigo === 'R-15')!;
      expect(r15.parametros).toHaveLength(1);
      expect(r15.parametros[0]).toMatchObject({ codigo: 'P-03', campoDb: 'p03MaxMat', origen: 'FACULTAD', configurable: true });
    });

    it('R-10 expone P-02 (p02BajaH, FACULTAD, configurable)', () => {
      const r10 = service.listarCatalogo().find((r) => r.codigo === 'R-10')!;
      expect(r10.parametros[0]).toMatchObject({ codigo: 'P-02', campoDb: 'p02BajaH', configurable: true });
    });

    it('R-09 expone 5 parametros de PLAN P-10..P-14 todos configurables', () => {
      const r09 = service.listarCatalogo().find((r) => r.codigo === 'R-09')!;
      expect(r09.parametros).toHaveLength(5);
      expect(r09.parametros.map((p) => p.codigo)).toEqual(['P-10','P-11','P-12','P-13','P-14']);
      for (const p of r09.parametros) {
        expect(p.origen).toBe('PLAN');
        expect(p.configurable).toBe(true);
      }
    });
  });

  describe('G6 - parametros configurables de R-13', () => {
    it('R-13 tiene P-FP1 y P-FP2 configurables sin dependenciaPendiente (post-IMPL-14B)', () => {
      const r13 = service.listarCatalogo().find((r) => r.codigo === 'R-13')!;
      expect(r13.parametros).toHaveLength(2);
      for (const p of r13.parametros) {
        expect(p.configurable).toBe(true);
        expect(p.dependenciaPendiente).toBeUndefined();
      }
    });

    it('R-14 tiene P-FP3 no configurable con dependenciaPendiente', () => {
      const r14 = service.listarCatalogo().find((r) => r.codigo === 'R-14')!;
      expect(r14.parametros[0]).toMatchObject({ codigo: 'P-FP3', configurable: false });
      expect(r14.parametros[0].dependenciaPendiente).toBeTruthy();
    });

    it('R-02, R-04, R-06, R-08, R-11, R-12 no tienen parametros', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-02','R-04','R-06','R-08','R-11','R-12']) {
        expect(cat.find((r) => r.codigo === c)?.parametros).toHaveLength(0);
      }
    });
  });

  describe('G7 - roles globales obtienen todas las facultades', () => {
    const cfg = { p01TopeH: 40, p02BajaH: 10, p03MaxMat: 5, updatedAt: new Date() };

    it('ADMINISTRADOR_SISTEMA sin filtro de IDs', async () => {
      (prisma.facultad.findMany as jest.Mock).mockResolvedValue([
        makeFac(F1, 'Ingenieria', cfg),
        makeFac(F2, 'Ciencias', null),
      ]);
      const result = await service.obtenerFacultadesConConfig(U1, 'ADMINISTRADOR_SISTEMA');
      expect(prisma.facultad.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(result).toHaveLength(2);
      expect(result[0].config).not.toBeNull();
      expect(result[1].config).toBeNull();
    });

    it('SECRETARIA_ACADEMICA sin filtro de IDs', async () => {
      (prisma.facultad.findMany as jest.Mock).mockResolvedValue([]);
      await service.obtenerFacultadesConConfig(U1, 'SECRETARIA_ACADEMICA');
      expect(prisma.facultad.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('RECTORADO sin filtro de IDs', async () => {
      (prisma.facultad.findMany as jest.Mock).mockResolvedValue([]);
      await service.obtenerFacultadesConConfig(U1, 'RECTORADO');
      expect(prisma.facultad.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('G8 - DECANO scoped por UsuarioFacultad', () => {
    it('recibe solo las facultades de su scope', async () => {
      (prisma.usuarioFacultad.findMany as jest.Mock).mockResolvedValue([{ facultadId: F1 }]);
      (prisma.facultad.findMany as jest.Mock).mockResolvedValue([makeFac(F1, 'Ingenieria', null)]);
      const result = await service.obtenerFacultadesConConfig(U1, 'DECANO');
      expect(prisma.facultad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [F1] } } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('G9 - DIRECTOR_CARRERA scoped por carreras', () => {
    it('recibe las facultades de sus carreras', async () => {
      (scopeService.getCarrerasEnScope as jest.Mock).mockResolvedValue([C1]);
      (prisma.carrera.findMany as jest.Mock).mockResolvedValue([{ facultadId: F1 }]);
      (prisma.facultad.findMany as jest.Mock).mockResolvedValue([makeFac(F1, 'Ingenieria', null)]);
      const result = await service.obtenerFacultadesConConfig(U1, 'DIRECTOR_CARRERA');
      expect(result).toHaveLength(1);
    });

    it('sin carreras en scope devuelve array vacio sin consultar facultad', async () => {
      (scopeService.getCarrerasEnScope as jest.Mock).mockResolvedValue([]);
      const result = await service.obtenerFacultadesConConfig(U1, 'DIRECTOR_CARRERA');
      expect(result).toHaveLength(0);
      expect(prisma.facultad.findMany).not.toHaveBeenCalled();
    });
  });

  describe('G10 - acceso denegado', () => {
    it('DOCENTE lanza ForbiddenException', async () => {
      await expect(service.obtenerFacultadesConConfig(U1, 'DOCENTE')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ADMINISTRATIVO lanza ForbiddenException', async () => {
      await expect(service.obtenerFacultadesConConfig(U1, 'ADMINISTRATIVO')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('G11 - listarCatalogo es solo lectura', () => {
    it('no consulta la base de datos', () => {
      const spy = jest.spyOn(prisma.facultad, 'findMany');
      service.listarCatalogo();
      expect(spy).not.toHaveBeenCalled();
    });

    it('motivoPendiente solo aparece cuando esta definido', () => {
      const cat = service.listarCatalogo();
      // Post-CIERRE-01: R-10 y R-03 tienen motivoPendiente (ambos PARCIAL)
      const conMotivo = new Set(['R-10', 'R-03']);
      for (const r of cat) {
        if (conMotivo.has(r.codigo)) {
          expect(r.motivoPendiente).toBeDefined();
        } else {
          expect(r.motivoPendiente).toBeUndefined();
        }
      }
      // Verificar que R-03 efectivamente tiene motivoPendiente como PARCIAL
      const r03 = cat.find((r) => r.codigo === 'R-03')!;
      expect(r03.estadoImplementacion).toBe('PARCIAL');
      expect(r03.motivoPendiente).toBeDefined();
    });
  });

  describe('G12 - estados IMPLEMENTADO completo (post-IMPL-15B)', () => {
    it('R-13 tiene estadoImplementacion IMPLEMENTADO sin motivoPendiente (post-IMPL-14B)', () => {
      const cat = service.listarCatalogo();
      const r13 = cat.find((r) => r.codigo === 'R-13')!;
      expect(r13.estadoImplementacion).toBe('IMPLEMENTADO');
      expect(r13.motivoPendiente).toBeUndefined();
    });

    it('R-14, R-15 tienen estadoImplementacion IMPLEMENTADO sin motivoPendiente', () => {
      const cat = service.listarCatalogo();
      for (const c of ['R-14', 'R-15']) {
        const r = cat.find((r) => r.codigo === c)!;
        expect(r.estadoImplementacion).toBe('IMPLEMENTADO');
        expect(r.motivoPendiente).toBeUndefined();
      }
    });

    it('R-10 tiene estadoImplementacion PARCIAL con motivoPendiente (post-IMPL-19B.1)', () => {
      const cat = service.listarCatalogo();
      const r10 = cat.find((r) => r.codigo === 'R-10')!;
      expect(r10.estadoImplementacion).toBe('PARCIAL');
      expect(r10.motivoPendiente).toBeDefined();
    });
  });
});
