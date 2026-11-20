/**
 * MOD-AUT-R07-02 — T1–T10: Validación de consistencia facultad-carrera en crear().
 *
 * Verifica que VinculacionesService.crear() rechaza peticiones donde
 * dto.facultadId no coincide con carrera.facultadId, garantizando que
 * VinculacionCatedra.facultadId siempre refleje la facultad real de la carrera.
 *
 * Raíz del defecto: sin esta validación, un formulario con estado desincronizado
 * podría enviar un facultadId incorrecto. calcularCargaAcademica(facultadId)
 * filtra por ese campo y excluiría los registros afectados, ocultando alertas.
 */

import { BadRequestException } from '@nestjs/common';
import { VinculacionesService } from './vinculaciones.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAC_A_ID   = 'fac-aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const FAC_B_ID   = 'fac-bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CAR_A_ID   = 'car-aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PLAN_ID    = 'plan-0000-0000-0000-0000-000000000000';
const MAT_ID     = 'mat-0000-0000-0000-0000-000000000000';
const DOC_ID     = 'doc-0000-0000-0000-0000-000000000000';
const CAT_ID     = 'cat-0000-0000-0000-0000-000000000000';
const CARGO_ID   = 'cg-00000-0000-0000-0000-000000000000';
const MOD_ID     = 'mod-0000-0000-0000-0000-000000000000';
const DES_ID     = 'des-0000-0000-0000-0000-000000000000';
const USUARIO_ID = 'usr-0000-0000-0000-0000-000000000000';

// DTO base con facultadId = FAC_A_ID y carreraId = CAR_A_ID (que pertenece a FAC_A)
const BASE_DTO = {
  facultadId:         FAC_A_ID,
  carreraId:          CAR_A_ID,
  planEstudioId:      PLAN_ID,
  materiaId:          MAT_ID,
  docenteId:          DOC_ID,
  catedraId:          CAT_ID,
  cargoId:            CARGO_ID,
  modalidadId:        MOD_ID,
  designacionId:      DES_ID,
  anioInicio:         2026,
};

// Entidades activas — carrera pertenece a FAC_A
function makeEntidades(opts: { carreraFacultadId?: string } = {}) {
  return {
    facultad:    { id: FAC_A_ID, estado: 'ACTIVO' },
    carrera:     { id: CAR_A_ID, estado: 'ACTIVO', facultadId: opts.carreraFacultadId ?? FAC_A_ID },
    planEstudio: { id: PLAN_ID,  estado: 'ACTIVO' },
    materia:     { id: MAT_ID,   estado: 'ACTIVO', cargaHorariaSemanal: 4 },
    docente:     { id: DOC_ID,   activo: true },
    catedra:     { id: CAT_ID,   activo: true },
    cargo:       { id: CARGO_ID, activo: true },
    modalidad:   { id: MOD_ID,   activo: true },
    designacion: { id: DES_ID,   activo: true },
  };
}

function makePrisma(ent = makeEntidades(), overrides: Record<string, any> = {}) {
  return {
    facultad:           { findUnique: jest.fn().mockResolvedValue(ent.facultad) },
    carrera:            { findUnique: jest.fn().mockResolvedValue(ent.carrera) },
    planEstudio:        { findUnique: jest.fn().mockResolvedValue(ent.planEstudio) },
    materia:            { findUnique: jest.fn().mockResolvedValue(ent.materia) },
    docente:            { findUnique: jest.fn().mockResolvedValue(ent.docente) },
    catedra:            { findUnique: jest.fn().mockResolvedValue(ent.catedra) },
    cargo:              { findUnique: jest.fn().mockResolvedValue(ent.cargo) },
    modalidad:          { findUnique: jest.fn().mockResolvedValue(ent.modalidad) },
    designacion:        { findUnique: jest.fn().mockResolvedValue(ent.designacion) },
    vinculacionCatedra: {
      findFirst:  jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data })),
    },
    ...overrides,
  };
}

function makeSvc(prisma: any) {
  const scope = { tieneScopeCarrera: jest.fn().mockResolvedValue(true) };
  return new VinculacionesService(prisma as any, scope as any);
}

// ── Tests T1–T10 ─────────────────────────────────────────────────────────────

describe('VinculacionesService — validación facultad-carrera (MOD-AUT-R07-02 T1–T10)', () => {

  // T1: facultadId en DTO coincide con carrera → creación exitosa
  it('T1: dto.facultadId === carrera.facultadId → crea OK con estado PENDIENTE', async () => {
    const svc = makeSvc(makePrisma());
    const result = await svc.crear(BASE_DTO, USUARIO_ID);
    expect(result).toBeDefined();
    expect(result.estado).toBe('PENDIENTE_DE_APROBACION');
  });

  // T2: facultadId en DTO no coincide con carrera → BadRequestException
  it('T2: dto.facultadId !== carrera.facultadId → BadRequestException', async () => {
    // La carrera pertenece a FAC_A pero el DTO envía FAC_B
    const ent = makeEntidades({ carreraFacultadId: FAC_A_ID });
    const prisma = makePrisma(ent);
    const svc = makeSvc(prisma);
    await expect(
      svc.crear({ ...BASE_DTO, facultadId: FAC_B_ID }, USUARIO_ID),
    ).rejects.toThrow(BadRequestException);
  });

  // T3: mensaje de error descriptivo
  it('T3: el mensaje de error indica que la facultad no corresponde a la carrera', async () => {
    const ent = makeEntidades({ carreraFacultadId: FAC_A_ID });
    const svc = makeSvc(makePrisma(ent));
    await expect(
      svc.crear({ ...BASE_DTO, facultadId: FAC_B_ID }, USUARIO_ID),
    ).rejects.toThrow('no corresponde a la carrera');
  });

  // T4: carrera en FAC_B, DTO envía FAC_A (invertido) → BadRequest
  it('T4: carrera en FAC_B con dto.facultadId = FAC_A → BadRequestException', async () => {
    const ent = makeEntidades({ carreraFacultadId: FAC_B_ID });
    // DTO base tiene facultadId = FAC_A, carrera tiene facultadId = FAC_B
    const svc = makeSvc(makePrisma(ent));
    await expect(
      svc.crear(BASE_DTO, USUARIO_ID),
    ).rejects.toThrow(BadRequestException);
  });

  // T5: validación ocurre antes del check de duplicado
  it('T5: facultadId incorrecto lanza BadRequest antes de verificar duplicado', async () => {
    const ent = makeEntidades({ carreraFacultadId: FAC_A_ID });
    const findFirst = jest.fn().mockResolvedValue({ id: 'dup-id', estado: 'APROBADA' });
    const prisma = makePrisma(ent, {
      vinculacionCatedra: { findFirst, create: jest.fn() },
    });
    const svc = makeSvc(prisma);
    await expect(
      svc.crear({ ...BASE_DTO, facultadId: FAC_B_ID }, USUARIO_ID),
    ).rejects.toThrow(BadRequestException);
    // El check de duplicado no debería haber corrido
    expect(findFirst).not.toHaveBeenCalled();
  });

  // T6: facultadId correcto no dispara error de facultad-carrera
  it('T6: facultadId coincide → no lanza error de consistencia', async () => {
    const svc = makeSvc(makePrisma());
    await expect(svc.crear(BASE_DTO, USUARIO_ID)).resolves.not.toThrow();
  });

  // T7: carrera inactiva lanza su propio error (no de facultad-carrera)
  it('T7: carrera inactiva → BadRequest por carrera, no por facultadId', async () => {
    const ent = makeEntidades();
    ent.carrera.estado = 'INACTIVO'; // sin importar el facultadId
    const svc = makeSvc(makePrisma(ent));
    const err = await svc.crear(BASE_DTO, USUARIO_ID).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toMatch(/Carrera no válida/);
  });

  // T8: facultad inexistente lanza su propio error antes de validar carrera
  it('T8: facultad inexistente → BadRequest por facultad antes de validar carrera', async () => {
    const prisma = makePrisma(makeEntidades(), {
      facultad: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const svc = makeSvc(prisma);
    const err = await svc.crear(BASE_DTO, USUARIO_ID).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.message).toMatch(/Facultad no válida/);
  });

  // T9: validación no interfiere con el check de responsable de cátedra
  it('T9: facultadId correcto + esResponsableCatedra:true → llega al check de responsable', async () => {
    const ent = makeEntidades();
    const prisma = makePrisma(ent, {
      vinculacionCatedra: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null) // duplicado → no hay
          .mockResolvedValueOnce(null), // responsable → no hay
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
      },
    });
    const svc = makeSvc(prisma);
    const result = await svc.crear({ ...BASE_DTO, esResponsableCatedra: true }, USUARIO_ID);
    expect(result).toBeDefined();
  });

  // T10: múltiples carreras en la misma facultad — no interfiere entre sí
  it('T10: dos llamadas sucesivas con la misma facultad pero distintas carreras → ambas OK', async () => {
    const CAR_B_ID = 'car-bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const prisma = makePrisma(makeEntidades());
    // Segunda carrera también pertenece a FAC_A
    const findUnique = jest.fn()
      .mockResolvedValueOnce({ id: FAC_A_ID, estado: 'ACTIVO' })   // facultad call 1
      .mockResolvedValueOnce({ id: CAR_A_ID, estado: 'ACTIVO', facultadId: FAC_A_ID }) // carrera call 1
      .mockResolvedValueOnce({ id: PLAN_ID,  estado: 'ACTIVO' })   // plan call 1
      .mockResolvedValueOnce({ id: MAT_ID,   estado: 'ACTIVO', cargaHorariaSemanal: 4 })
      .mockResolvedValueOnce({ id: DOC_ID,   activo: true })
      .mockResolvedValueOnce({ id: CAT_ID,   activo: true })
      .mockResolvedValueOnce({ id: CARGO_ID, activo: true })
      .mockResolvedValueOnce({ id: MOD_ID,   activo: true })
      .mockResolvedValueOnce({ id: DES_ID,   activo: true })
      // Segunda creación (carrera B, misma facultad A)
      .mockResolvedValueOnce({ id: FAC_A_ID, estado: 'ACTIVO' })
      .mockResolvedValueOnce({ id: CAR_B_ID, estado: 'ACTIVO', facultadId: FAC_A_ID })
      .mockResolvedValueOnce({ id: PLAN_ID,  estado: 'ACTIVO' })
      .mockResolvedValueOnce({ id: MAT_ID,   estado: 'ACTIVO', cargaHorariaSemanal: 4 })
      .mockResolvedValueOnce({ id: DOC_ID,   activo: true })
      .mockResolvedValueOnce({ id: CAT_ID,   activo: true })
      .mockResolvedValueOnce({ id: CARGO_ID, activo: true })
      .mockResolvedValueOnce({ id: MOD_ID,   activo: true })
      .mockResolvedValueOnce({ id: DES_ID,   activo: true });

    const prisma2 = {
      facultad:           { findUnique },
      carrera:            { findUnique },
      planEstudio:        { findUnique },
      materia:            { findUnique },
      docente:            { findUnique },
      catedra:            { findUnique },
      cargo:              { findUnique },
      modalidad:          { findUnique },
      designacion:        { findUnique },
      vinculacionCatedra: {
        findFirst: jest.fn().mockResolvedValue(null),
        create:    jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
      },
    };
    const svc = makeSvc(prisma2);

    const r1 = await svc.crear({ ...BASE_DTO, carreraId: CAR_A_ID }, USUARIO_ID);
    const r2 = await svc.crear({ ...BASE_DTO, carreraId: CAR_B_ID }, USUARIO_ID);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});
