import type { EstadoCalculo } from '../types/estado-calculo.types';
import type { AmbitoAnalisis } from '../analisis/analisis.dto';
import type { AlertaBandeja, PrioridadAlerta } from './alertas.dto';

interface AlertaRaw {
  regla: string;
  prioridad: PrioridadAlerta;
  descripcion: string;
}

function alertasCarrera(snap: Record<string, unknown>): AlertaRaw[] {
  const alerts: AlertaRaw[] = [];

  const ip10 = snap['ip10'] as Record<string, unknown> | undefined;
  const alertasR03 = (ip10?.['alertasR03'] as number) ?? 0;
  if (alertasR03 > 0) {
    alerts.push({
      regla: 'R-03',
      prioridad: 'ALTA',
      descripcion: `${alertasR03} docente(s) superan el tope semanal de horas`,
    });
  }

  const ip13 = snap['ip13'] as Record<string, unknown> | undefined;
  const sobreasignadosIP13 = (ip13?.['totalSobreasignados'] as number) ?? 0;
  if (sobreasignadosIP13 > 0) {
    alerts.push({
      regla: 'IP-13',
      prioridad: 'ALTA',
      descripcion: `${sobreasignadosIP13} docente(s) con exceso de asignaciones`,
    });
  }

  const ip03 = snap['ip03'] as Record<string, unknown> | undefined;
  const total03 = (ip03?.['total'] as number) ?? 0;
  const cubiertas = (ip03?.['cubiertas'] as number) ?? 0;
  if (total03 > 0 && cubiertas < total03) {
    alerts.push({
      regla: 'IP-03',
      prioridad: 'MEDIA',
      descripcion: `${total03 - cubiertas} materia(s) sin asignación docente aprobada`,
    });
  }

  const r12 = snap['r12'] as Record<string, unknown> | undefined;
  const incompletos = (r12?.['totalIncompletos'] as number) ?? 0;
  if (incompletos > 0) {
    alerts.push({
      regla: 'R-12',
      prioridad: 'MEDIA',
      descripcion: `${incompletos} docente(s) con campos obligatorios faltantes en la ficha`,
    });
  }

  const r10 = snap['r10'] as Record<string, unknown> | undefined;
  const enAlertaR10 = (r10?.['totalEnAlerta'] as number) ?? 0;
  if (enAlertaR10 > 0) {
    alerts.push({
      regla: 'R-10',
      prioridad: 'INFORMATIVA',
      descripcion: `${enAlertaR10} docente(s) con baja dedicación horaria`,
    });
  }

  return alerts;
}

function alertasPlan(snap: Record<string, unknown>): AlertaRaw[] {
  const alerts: AlertaRaw[] = [];

  const ipl01 = snap['ipl01'] as Record<string, unknown> | undefined;
  if (ipl01?.['cumple'] === false) {
    const h   = ipl01['horasTotal'] ?? '?';
    const min = ipl01['horasMinimas'] ?? '?';
    alerts.push({
      regla: 'IPL-01',
      prioridad: 'ALTA',
      descripcion: `Plan con ${h} h — mínimo requerido: ${min} h`,
    });
  }

  const ipl03 = snap['ipl03'] as Record<string, unknown> | undefined;
  const sinResp = (ipl03?.['sinResponsable'] as number) ?? 0;
  if (sinResp > 0) {
    alerts.push({
      regla: 'IPL-03',
      prioridad: 'ALTA',
      descripcion: `${sinResp} materia(s) sin responsable de cátedra confirmado`,
    });
  }

  const ipl04 = snap['ipl04'] as Record<string, unknown> | undefined;
  const paresAlerta = (ipl04?.['paresConAlerta'] as number) ?? 0;
  if (paresAlerta > 0) {
    alerts.push({
      regla: 'IPL-04',
      prioridad: 'ALTA',
      descripcion: `${paresAlerta} par(es) (materia, cátedra) con más de un responsable`,
    });
  }

  const ipl02 = snap['ipl02'] as Record<string, unknown> | undefined;
  const conUmbral  = (ipl02?.['bloquesConUmbral'] as number) ?? 0;
  const cumplen    = (ipl02?.['bloquesCumplen'] as number) ?? 0;
  if (conUmbral > 0 && cumplen < conUmbral) {
    alerts.push({
      regla: 'IPL-02',
      prioridad: 'MEDIA',
      descripcion: `${conUmbral - cumplen} bloque(s) curricular(es) por debajo del umbral horario mínimo`,
    });
  }

  return alerts;
}

function alertasFacultad(snap: Record<string, unknown>): AlertaRaw[] {
  const alerts: AlertaRaw[] = [];

  const carga = snap['cargaAcademica'] as Record<string, unknown> | undefined;
  const sobreasignados = (carga?.['totalSobreasignados'] as number) ?? 0;
  if (sobreasignados > 0) {
    alerts.push({
      regla: 'R-07',
      prioridad: 'ALTA',
      descripcion: `${sobreasignados} docente(s) sobreasignados en la facultad`,
    });
  }

  const formacion = snap['formacion'] as Record<string, unknown> | undefined;
  const sinGrado = (formacion?.['sinTituloGrado'] as number) ?? 0;
  if (sinGrado > 0) {
    alerts.push({
      regla: 'R-12',
      prioridad: 'MEDIA',
      descripcion: `${sinGrado} docente(s) sin título de grado`,
    });
  }

  const ded = snap['dedicaciones'] as Record<string, unknown> | undefined;
  const bajaDed = (ded?.['totalBajaDedicacion'] as number) ?? 0;
  if (bajaDed > 0) {
    alerts.push({
      regla: 'R-10',
      prioridad: 'INFORMATIVA',
      descripcion: `${bajaDed} docente(s) con baja dedicación horaria`,
    });
  }

  return alerts;
}

/**
 * Extrae alertas vigentes de un snapshot de ejecución.
 * Sólo genera alertas cuando los valores superan los umbrales definidos.
 * No inventa alertas ni toca la base de datos.
 */
export function extraerAlertas(
  snapshot: unknown,
  ambito: AmbitoAnalisis,
  entidadId: string,
  facultadId: string,
  ejecucionId: string,
  fechaEjecucion: string,
  estadoCalculo: EstadoCalculo | null,
): AlertaBandeja[] {
  if (!snapshot || typeof snapshot !== 'object') return [];

  const snap = snapshot as Record<string, unknown>;
  let rawAlerts: AlertaRaw[] = [];

  if (ambito === 'CARRERA')  rawAlerts = alertasCarrera(snap);
  else if (ambito === 'PLAN') rawAlerts = alertasPlan(snap);
  else if (ambito === 'FACULTAD') rawAlerts = alertasFacultad(snap);

  return rawAlerts.map(a => ({
    ejecucionId,
    ambito,
    entidadId,
    facultadId,
    regla: a.regla,
    prioridad: a.prioridad,
    descripcion: a.descripcion,
    fechaEjecucion,
    estadoCalculo,
  }));
}
