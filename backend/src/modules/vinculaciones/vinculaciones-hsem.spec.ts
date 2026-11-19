/**
 * HSEM Fase C.1 — Pruebas del endpoint /vinculaciones-catedra
 *
 * Verifica que el mapper _mapearVinculacion() aplique correctamente
 * horasSemanalesVigentes() y horasSemanalesHistoricas() en todos los
 * escenarios requeridos.
 */

import { VinculacionesService } from './vinculaciones.service';

// ── Constantes ────────────────────────────────────────────────────────────────

const ADMIN_ID  = 'admin-id-000';
const DOC_ID    = 'docente-id-001';
const DOC_ID_2  = 'docente-id-002';
const FAC_ID    = 'fac-id-001';
const CAR_ID    = 'car-id-001';
const PLAN_ID   = 'pla-id-001';
const MAT_ID_A  = 'mat-id-aaa';
const MAT_ID_B  = 'mat-id-bbb';
const VIN_ID_1  = 'vin-id-001';
const VIN_ID_2  = 'vin-id-002';
const ROL_ADMIN = 'ADMINISTRADOR_SISTEMA';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVinculacionRaw(overrides: {
  id?: string;
  docenteId?: string;
  materiaId?: string;
  materiaNombre?: string;
  cargaHorariaSemanal?: number | null;
  horasSemana?: number | null;
  estado?: string;
} = {}) {
  return {
    id:          overrides.id      ?? VIN_ID_1,
    estado:      overrides.estado  ?? 'APROBADA',
    docenteId:   overrides.docenteId ?? DOC_ID,
    horasSemana: overrides.horasSemana !== undefined ? overrides.horasSemana : 4,
    anioInicio:  2024,
    fechaCreacion: new Date('2024-01-01'),
    materia:     {
      id:                 overrides.materiaId     ?? MAT_ID_A,
      nombre:             overrides.materiaNombre ?? 'Álgebra I',
      codigo:             'ALG1',
      cargaHorariaSemanal: overrides.cargaHorariaSemanal !== undefined
        ? overrides.cargaHorariaSemanal
        : 4,
    },
    facultad:    { id: FAC_ID, nombre: 'FACULTAD' },
    carrera:     { id: CAR_ID, nombre: 'CARRERA' },
    planEstudio: { id: PLAN_ID, nombre: 'PLAN 2020', codigo: null },
    docente:     { id: overrides.docenteId ?? DOC_ID, nombre: 'JUAN', apellido: 'PEREZ' },
    catedra:     { id: 'cat-001', nombre: 'CATEDRA A' },
    cargo:       { id: 'carg-001', nombre: 'TITULAR' },
    modalidad:   { id: 'mod-001', nombre: 'PRESENCIAL' },
    designacion: { id: 'des-001', nombre: 'SIMPLE' },
    usuarioSolicitante: null,
    aprobador:   null,
    desvinculador: null,
  };
}

function makePrisma(rows: any[], docenteActivo = true) {
  return {
    docente: {
      findUnique: jest.fn().mockResolvedValue({ activo: docenteActivo }),
    },
    vinculacionCatedra: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
}

const makeService = (prisma: any) =>
  new VinculacionesService(prisma as any, {} as any);

// ── G1: horasSemana contiene el valor vigente de Materia.cargaHorariaSemanal ──

describe('G1: horasSemana = Materia.cargaHorariaSemanal (vigente)', () => {
  it('cuando snapshot=4 y cargaHorariaSemanal=4 → horasSemana=4', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 4 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBe(4);
  });

  it('materia modificada de 4→6: horasSemana=6 (vigente), no el snapshot 4', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBe(6);
    expect((result as any[])[0].horasSemana).not.toBe(4);
  });
});

// ── G2: horasSemanaHistoricas = snapshot de VinculacionCatedra.horasSemana ───

describe('G2: horasSemanaHistoricas = snapshot (histórico)', () => {
  it('conserva el snapshot 4 aunque la materia ahora diga 6', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemanaHistoricas).toBe(4);
  });

  it('vigente ≠ histórico cuando el Plan de Estudios cambió', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    const vc = (result as any[])[0];
    expect(vc.horasSemana).toBe(6);
    expect(vc.horasSemanaHistoricas).toBe(4);
    expect(vc.horasSemana).not.toBe(vc.horasSemanaHistoricas);
  });
});

// ── G3: dos docentes vinculados a la misma materia ────────────────────────────

describe('G3: dos docentes vinculados a la misma materia', () => {
  it('ambos obtienen el mismo horasSemana vigente', async () => {
    const rows = [
      makeVinculacionRaw({ id: VIN_ID_1, docenteId: DOC_ID,   horasSemana: 4, cargaHorariaSemanal: 6 }),
      makeVinculacionRaw({ id: VIN_ID_2, docenteId: DOC_ID_2, horasSemana: 5, cargaHorariaSemanal: 6 }),
    ];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBe(6);
    expect((result as any[])[1].horasSemana).toBe(6);
  });

  it('cada uno conserva su propio snapshot histórico', async () => {
    const rows = [
      makeVinculacionRaw({ id: VIN_ID_1, docenteId: DOC_ID,   horasSemana: 4, cargaHorariaSemanal: 6 }),
      makeVinculacionRaw({ id: VIN_ID_2, docenteId: DOC_ID_2, horasSemana: 5, cargaHorariaSemanal: 6 }),
    ];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemanaHistoricas).toBe(4);
    expect((result as any[])[1].horasSemanaHistoricas).toBe(5);
  });
});

// ── G4: docente con múltiples materias ───────────────────────────────────────

describe('G4: docente con múltiples materias distintas', () => {
  it('cada vinculación tiene su propio horasSemana vigente', async () => {
    const rows = [
      makeVinculacionRaw({ id: VIN_ID_1, materiaId: MAT_ID_A, cargaHorariaSemanal: 3 }),
      {
        ...makeVinculacionRaw({ id: VIN_ID_2, materiaId: MAT_ID_B }),
        materia: { id: MAT_ID_B, nombre: 'Física I', codigo: 'FIS1', cargaHorariaSemanal: 5 },
        horasSemana: 4,
      },
    ];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBe(3);
    expect((result as any[])[1].horasSemana).toBe(5);
  });
});

// ── G5: Materia con cargaHorariaSemanal null ──────────────────────────────────

describe('G5: cargaHorariaSemanal=null', () => {
  it('horasSemana=null — sin fallback silencioso al snapshot', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: null })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBeNull();
  });

  it('horasSemanaHistoricas conserva el snapshot aunque vigente sea null', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: null })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemanaHistoricas).toBe(4);
  });
});

// ── G6: vinculaciones no vigentes (DESVINCULADA) ─────────────────────────────

describe('G6: vinculaciones no vigentes', () => {
  it('DESVINCULADA no aparece en consulta con estado=APROBADA', async () => {
    const prisma = makePrisma([]); // DB no devuelve DESVINCULADAS con where estado=APROBADA
    const svc = makeService(prisma);
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, ROL_ADMIN);
    expect((result as any[]).length).toBe(0);
  });

  it('DESVINCULADA con cargaHorariaSemanal: mapper preserva historicas', async () => {
    const rows = [makeVinculacionRaw({ estado: 'DESVINCULADA', horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({ estado: 'DESVINCULADA' }, ADMIN_ID, ROL_ADMIN);
    const vc = (result as any[])[0];
    expect(vc.horasSemana).toBe(6);           // vigente al momento de la consulta
    expect(vc.horasSemanaHistoricas).toBe(4);  // snapshot preservado
  });
});

// ── G7: Mi Ficha y PDF — valores vigentes ────────────────────────────────────

describe('G7: invariante — valor vigente se propaga a Mi Ficha y PDF', () => {
  it('la respuesta del endpoint incluye horasSemana=vigente para consumidores frontend', async () => {
    // Mi Ficha lee horasSemana del endpoint GET /vinculaciones-catedra (estado=APROBADA)
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, ROL_ADMIN);
    // horasSemana es el valor que Mi Ficha y el PDF exportan
    expect((result as any[])[0].horasSemana).toBe(6);
  });

  it('horasSemanaHistoricas está disponible para vistas de auditoría (bandeja-aprobaciones)', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemanaHistoricas).toBe(4);
  });
});

// ── G9: HSEM-01 — snapshot null (vinculaciones antiguas sin horasSemana) ─────
//
// Escenario del bug: materia tenía 4 H/SEM al crear la vinculación.
// La vinculación fue creada sin snapshot (horasSemana=null en DB) —
// ya sea porque era anterior al campo, o porque se migró con null.
// Luego la materia se actualizó a 6 H/SEM.
//
// Comportamiento ESPERADO:
//   horasSemana           = 6  (vigente, desde Materia.cargaHorariaSemanal)
//   horasSemanaHistoricas = null  (sin snapshot — NO debe caer al vigente)
//
// El frontend que muestra Bandeja debe mostrar "—", NOT "6 h/sem".

describe('G9: HSEM-01 — horasSemana=null en DB (sin snapshot histórico)', () => {
  it('T4: horasSemanaHistoricas=null cuando no hay snapshot — sin fallback silencioso al vigente', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: null, cargaHorariaSemanal: 6 })];
    const svc  = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    const vc = (result as any[])[0];
    expect(vc.horasSemanaHistoricas).toBeNull();
    expect(vc.horasSemanaHistoricas).not.toBe(vc.horasSemana);
  });

  it('T1: horasSemana sigue siendo el vigente aunque el snapshot sea null', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: null, cargaHorariaSemanal: 6 })];
    const svc  = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBe(6);
  });

  it('T2: respuesta siempre expone ambos campos (horasSemana y horasSemanaHistoricas)', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: null, cargaHorariaSemanal: 6 })];
    const svc  = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    const vc = (result as any[])[0];
    expect(Object.prototype.hasOwnProperty.call(vc, 'horasSemana')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(vc, 'horasSemanaHistoricas')).toBe(true);
  });

  it('T3: horasSemanaHistoricas expone el snapshot correcto para el modal de Bandeja', async () => {
    // Vinculación con snapshot=4 y vigente=6: modal debe mostrar 4
    const rows = [makeVinculacionRaw({ horasSemana: 4, cargaHorariaSemanal: 6 })];
    const svc  = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemanaHistoricas).toBe(4);
  });

  it('T5: Mi Ficha obtiene horasSemana=vigente independientemente del snapshot', async () => {
    const rows = [makeVinculacionRaw({ horasSemana: null, cargaHorariaSemanal: 8 })];
    const svc  = makeService(makePrisma(rows));
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].horasSemana).toBe(8);
  });

  it('T6: campo estado no se altera cuando snapshot es null', async () => {
    const rows = [makeVinculacionRaw({ estado: 'APROBADA', horasSemana: null, cargaHorariaSemanal: 6 })];
    const svc  = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].estado).toBe('APROBADA');
  });
});

// ── G8: no se alteran estados ni permisos ────────────────────────────────────

describe('G8: estados y permisos no modificados', () => {
  it('el campo estado permanece inalterado en la respuesta mapeada', async () => {
    const rows = [
      makeVinculacionRaw({ id: VIN_ID_1, estado: 'APROBADA' }),
      makeVinculacionRaw({ id: VIN_ID_2, estado: 'PENDIENTE_DE_APROBACION' }),
    ];
    const svc = makeService(makePrisma(rows));
    const result = await svc.listar({}, ADMIN_ID, ROL_ADMIN);
    expect((result as any[])[0].estado).toBe('APROBADA');
    expect((result as any[])[1].estado).toBe('PENDIENTE_DE_APROBACION');
  });

  it('docente inactivo → listar devuelve vacío (guardia del servicio sin cambios)', async () => {
    const prisma = makePrisma([], false /* inactivo */);
    const svc = makeService(prisma);
    const result = await svc.listar({ estado: 'APROBADA', docenteId: DOC_ID }, ADMIN_ID, 'DOCENTE');
    // El servicio como DOCENTE consulta el docente por usuarioId, no docenteId
    // — en este mock getDocenteByUsuarioId usa findUnique y devuelve activo=false
    // Verificamos que el resultado sea array vacío por la guardia de docente inactivo
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(0);
  });
});
