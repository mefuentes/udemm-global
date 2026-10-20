import { Injectable } from '@nestjs/common';
import { ConsultasAcademicasService } from '../consultas-academicas/consultas-academicas.service';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { DocenteVigenteIP09 } from '../consultas-academicas/consultas-academicas.types';

// ── Evaluación de ítems C1, C2, C3 (FSD §6.1) ────────────────────────────────

/**
 * C1 — Datos personales.
 *
 * Los campos NOT NULL del modelo (apellido, nombre, tipoDocumento, numeroDocumento)
 * siempre están presentes. Se evalúan los cuatro campos nullable con excepciones:
 *   sexo, fechaNacimiento → siempre requeridos.
 *   cuit                  → requerido, excepto si tipoDocumento = 'PASAPORTE'.
 *   pisoDepto             → Departamento/Partido; requerido, excepto si residencia ≠ Argentina.
 */
export function evaluarC1(
  d: Pick<DocenteVigenteIP09, 'sexo' | 'fechaNacimiento' | 'cuit' | 'pisoDepto' | 'residencia' | 'tipoDocumento'>,
): boolean {
  if (!d.sexo?.trim()) return false;
  if (!d.fechaNacimiento) return false;
  const esPassport = d.tipoDocumento.toUpperCase() === 'PASAPORTE';
  if (!esPassport && !d.cuit?.trim()) return false;
  const esArgentina = !d.residencia || d.residencia.trim().toUpperCase() === 'ARGENTINA';
  if (esArgentina && !d.pisoDepto?.trim()) return false;
  return true;
}

/**
 * C2 — Título de grado.
 *
 * tituloGrado almacena JSON [{denominacion, anio, pais, institucion}].
 * C2 = 1 cuando existe al menos un título con los cuatro campos informados.
 * Texto plano (legacy) o JSON inválido se clasifican como incompleto.
 */
export function evaluarC2(tituloGradoRaw: string | null): boolean {
  if (!tituloGradoRaw?.trim()) return false;
  let arr: unknown;
  try {
    arr = JSON.parse(tituloGradoRaw);
  } catch {
    return false;
  }
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return (arr as unknown[]).some((t) => {
    if (typeof t !== 'object' || t === null) return false;
    const item = t as Record<string, unknown>;
    return (
      typeof item['denominacion'] === 'string' && item['denominacion'].trim() !== '' &&
      typeof item['anio'] === 'string' && item['anio'].trim() !== '' &&
      typeof item['pais'] === 'string' && item['pais'].trim() !== '' &&
      typeof item['institucion'] === 'string' && item['institucion'].trim() !== ''
    );
  });
}

/** C3 — Área de desempeño. C3 = 1 cuando areaDisciplinarId está informado. */
export function evaluarC3(areaDisciplinarId: string | null): boolean {
  return areaDisciplinarId !== null;
}

/** Completitud individual: 25 × (C1 + C2 + C3 + C4). C4 = 1 por construcción del universo. */
export function completitudDocente(d: DocenteVigenteIP09): number {
  const c1 = evaluarC1(d) ? 1 : 0;
  const c2 = evaluarC2(d.tituloGrado) ? 1 : 0;
  const c3 = evaluarC3(d.areaDisciplinarId) ? 1 : 0;
  return 25 * (c1 + c2 + c3 + 1); // +1 = C4 por construcción del universo
}

// ── Tipos de resultado ────────────────────────────────────────────────────────

export interface ResultadoIP09 {
  totalDocentes: number;
  /** round(mean(completitud_i)), 0–100. null cuando estadoCalculo = NO_APLICA. */
  completitudPromedio: number | null;
  estadoCalculo: EstadoCalculo;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class IP09EvaluadorService {
  constructor(private readonly consultas: ConsultasAcademicasService) {}

  /**
   * Calcula IP-09 (Completitud promedio) para una carrera (FSD §6.3).
   * Universo: docentes activos con ≥1 VinculacionCatedra APROBADA en la carrera.
   * Fórmula: round(mean(25 × (C1 + C2 + C3 + C4))).
   */
  async evaluarParaCarrera(carreraId: string): Promise<ResultadoIP09> {
    const { docentes } = await this.consultas.obtenerDocentesParaIP09(carreraId);

    if (docentes.length === 0) {
      return { totalDocentes: 0, completitudPromedio: null, estadoCalculo: EstadoCalculo.NO_APLICA };
    }

    const suma = docentes.reduce((acc, d) => acc + completitudDocente(d), 0);
    return {
      totalDocentes: docentes.length,
      completitudPromedio: Math.round(suma / docentes.length),
      estadoCalculo: EstadoCalculo.CALCULADO,
    };
  }
}
