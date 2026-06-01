'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/lib/auth-context';

interface FormData {
  nombre: string;
  apellido: string;
  sexo: string;
  fechaNacimiento: string;
  tipoDocumento: string;
  numeroDocumento: string;
  cuit: string;
  correoElectronico: string;
  telefono: string;
  calle: string;
  numero: string;
  pisoDepto: string;
  residencia: string;
  provincia: string;
  localidad: string;
  codigoPostal: string;
  tituloGrado: string;
  tituloPosgrado: string;
  otrosTitulos: string;
  cargoDeclarado: string;
  justificacionPertinencia: string;
  actividadesProfesionales: string;
  antecedentesAcademicos: string;
  unidadAcademica: string;
  categoriaDocente: string;
  dedicacion: string;
  dedicacionDeclaradaSemanal: string;
  tiempoDocencia: string;
  tiempoInvestigacion: string;
  tiempoExtension: string;
  tiempoGestionAcademica: string;
  fechaInicioCargo: string;
  fechaFinCargo: string;
  designacion: string;
  disciplinaCargo: string;
  asignaturasVinculadas: string;
  funcionGestion: string;
  unidadAcademicaGestion: string;
  carreraAsociadaGestion: string;
  tiempoDedicacionGestionSemanal: string;
  fechaInicioGestion: string;
  fechaFinGestion: string;
  normativaDesignacionGestion: string;
  tituloProyectoInvestigacion: string;
  institucionProyectoInvestigacion: string;
  institucionEvaluadoraProyectoInvestigacion: string;
  institucionFinanciadoraProyectoInvestigacion: string;
  fechaInicioProyectoInvestigacion: string;
  fechaFinProyectoInvestigacion: string;
  vinculadoCarreraProyectoInvestigacion: string;
  disciplinasVinculadasProyectoInvestigacion: string;
  sistemaPromocion: string;
  categoriaPromocion: string;
  fechaAltaPromocion: string;
  tituloActividadExtension: string;
  rolActividadExtension: string;
  institucionDestinoActividadExtension: string;
  fechaInicioActividadExtension: string;
  finEstadoActividadExtension: string;
  vinculadaActividadExtension: string;
  activo?: boolean;
}

interface TituloGradoItem {
  id: string;
  denominacion: string;
  anio: string;
  pais: string;
  institucion: string;
}

interface TituloGradoForm {
  denominacion: string;
  anio: string;
  pais: string;
  institucion: string;
}

interface TituloPosgradoItem {
  id: string;
  denominacion: string;
  tipo: string;
  anio: string;
  institucion: string;
}

interface TituloPosgradoForm {
  denominacion: string;
  tipo: string;
  anio: string;
  institucion: string;
}

interface OtroTituloItem {
  id: string;
  denominacion: string;
  tipo: string;
  anio: string;
  institucion: string;
}

interface OtroTituloForm {
  denominacion: string;
  tipo: string;
  anio: string;
  institucion: string;
}

interface AsignaturaVinculadaItem {
  id: string;
  asignatura: string;
  anioInicio: string;
  responsable: 'Si' | 'No';
  estado: 'Pendiente' | 'Aceptada' | 'Rechazada';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const TAB_TITLES = [
  { numero: '1', texto: 'Datos personales' },
  { numero: '2', texto: 'Formación académica' },
  { numero: '3', texto: 'Docencia Universitaria' },
  { numero: '4', texto: 'Gestión académica' },
  { numero: '5', texto: 'Inv., Prom. y Ext' }
];
const SOLO_CARACTERES_REGEX = /^[A-Za-z\s' -]+$/;
const SOLO_ALFANUMERICO_REGEX = /^[A-Za-z0-9\s'.,-]+$/;
const SOLO_NUMEROS_REGEX = /^\d+$/;
const ANIO_REGEX = /^\d{4}$/;

function parseTitulosGrado(rawValue: unknown): TituloGradoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `titulo-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        anio: String(item.anio ?? ''),
        pais: String(item.pais ?? ''),
        institucion: String(item.institucion ?? '')
      }));
  } catch {
    return [];
  }
}

function parseTitulosPosgrado(rawValue: unknown): TituloPosgradoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `posgrado-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        tipo: String(item.tipo ?? ''),
        anio: String(item.anio ?? ''),
        institucion: String(item.institucion ?? '')
      }));
  } catch {
    return [];
  }
}

function parseOtrosTitulos(rawValue: unknown): OtroTituloItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `otro-titulo-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        tipo: String(item.tipo ?? ''),
        anio: String(item.anio ?? ''),
        institucion: String(item.institucion ?? '')
      }));
  } catch {
    return [];
  }
}

function parseAsignaturasVinculadas(rawValue: unknown): AsignaturaVinculadaItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `asignatura-${Date.now()}-${index}`,
        asignatura: String(item.asignatura ?? ''),
        anioInicio: String(item.anioInicio ?? ''),
        responsable: item.responsable === 'Si' ? 'Si' : 'No',
        estado: item.estado === 'Aceptada' || item.estado === 'Rechazada' ? item.estado : 'Pendiente'
      }));
  } catch {
    return [];
  }
}

export default function MiFichaPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { obtenerTokenActual, usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [titulosGrado, setTitulosGrado] = useState<TituloGradoItem[]>([]);
  const [tituloForm, setTituloForm] = useState<TituloGradoForm>({ denominacion: '', anio: '', pais: '', institucion: '' });
  const [tituloErrors, setTituloErrors] = useState<Partial<Record<keyof TituloGradoForm, string>>>({});
  const [editandoTituloId, setEditandoTituloId] = useState<string | null>(null);
  const [mostrarFormGrado, setMostrarFormGrado] = useState(false);
  const [titulosPosgrado, setTitulosPosgrado] = useState<TituloPosgradoItem[]>([]);
  const [posgradoForm, setPosgradoForm] = useState<TituloPosgradoForm>({ denominacion: '', tipo: '', anio: '', institucion: '' });
  const [posgradoErrors, setPosgradoErrors] = useState<Partial<Record<keyof TituloPosgradoForm, string>>>({});
  const [editandoPosgradoId, setEditandoPosgradoId] = useState<string | null>(null);
  const [mostrarFormPosgrado, setMostrarFormPosgrado] = useState(false);
  const [otrosTitulos, setOtrosTitulos] = useState<OtroTituloItem[]>([]);
  const [otroTituloForm, setOtroTituloForm] = useState<OtroTituloForm>({ denominacion: '', tipo: '', anio: '', institucion: '' });
  const [otroTituloErrors, setOtroTituloErrors] = useState<Partial<Record<keyof OtroTituloForm, string>>>({});
  const [editandoOtroTituloId, setEditandoOtroTituloId] = useState<string | null>(null);
  const [mostrarFormOtroTitulo, setMostrarFormOtroTitulo] = useState(false);
  const [asignaturasVinculadas, setAsignaturasVinculadas] = useState<AsignaturaVinculadaItem[]>([]);
  const [editProyectoInv, setEditProyectoInv] = useState(false);
  const [editSistemaPromocion, setEditSistemaPromocion] = useState(false);
  const [editActividadExtension, setEditActividadExtension] = useState(false);
  const menuDocente = [
    { label: 'Ficha Docente', href: '/docentes/mi-ficha' },
    { label: 'Bandeja de Aprobaciones', href: '/docentes/aprobaciones' }
  ];

  function normalizarFechaSoloDia(valor: string) {
    if (!valor) return '';
    return valor.includes('T') ? valor.split('T')[0] : valor;
  }

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol?.nombre !== 'DOCENTE') {
      router.push('/docentes');
      return;
    }
    cargarFicha();
  }, [usuario, router]);

  async function cargarFicha() {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = obtenerTokenActual();
      if (!token) throw new Error('No hay sesion activa');

      const res = await fetch(`${API_URL}/docentes/mi-ficha`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Error ${res.status}`);
      }

      const data = await res.json();
      const titulos = parseTitulosGrado(data.tituloGrado);
      const posgrados = parseTitulosPosgrado(data.tituloPosgrado);
      const otros = parseOtrosTitulos(data.otrosTitulos);
      const asignaturas = parseAsignaturasVinculadas(data.asignaturasVinculadas);
      setTitulosGrado(titulos);
      setTitulosPosgrado(posgrados);
      setOtrosTitulos(otros);
      setAsignaturasVinculadas(asignaturas);
      setFormData({
        nombre: data.nombre ?? usuario?.nombre ?? '',
        apellido: data.apellido ?? usuario?.apellido ?? '',
        sexo: data.sexo ?? '',
        fechaNacimiento: data.fechaNacimiento ? normalizarFechaSoloDia(String(data.fechaNacimiento)) : '',
        tipoDocumento: data.tipoDocumento ?? 'DNI',
        numeroDocumento: data.numeroDocumento ?? '',
        cuit: data.cuit ?? '',
        correoElectronico: data.correoElectronico ?? usuario?.correoElectronico ?? '',
        telefono: data.telefono ?? '',
        calle: data.calle ?? '',
        numero: data.numero ?? '',
        pisoDepto: data.pisoDepto ?? '',
        residencia: data.residencia ?? '',
        provincia: data.provincia ?? '',
        localidad: data.localidad ?? '',
        codigoPostal: data.codigoPostal ?? '',
        tituloGrado: titulos.length ? JSON.stringify(titulos) : '',
        tituloPosgrado: posgrados.length ? JSON.stringify(posgrados) : '',
        otrosTitulos: otros.length ? JSON.stringify(otros) : '',
        cargoDeclarado: data.cargoDeclarado ?? '',
        justificacionPertinencia: data.justificacionPertinencia ?? '',
        actividadesProfesionales: data.actividadesProfesionales ?? '',
        antecedentesAcademicos: data.antecedentesAcademicos ?? '',
        unidadAcademica: data.unidadAcademica ?? '',
        categoriaDocente: data.categoriaDocente ?? '',
        dedicacion: data.dedicacion ?? '',
        dedicacionDeclaradaSemanal: data.dedicacionDeclaradaSemanal ?? '',
        tiempoDocencia: data.tiempoDocencia ?? '',
        tiempoInvestigacion: data.tiempoInvestigacion ?? '',
        tiempoExtension: data.tiempoExtension ?? '',
        tiempoGestionAcademica: data.tiempoGestionAcademica ?? '',
        fechaInicioCargo: data.fechaInicioCargo ? normalizarFechaSoloDia(String(data.fechaInicioCargo)) : '',
        fechaFinCargo: data.fechaFinCargo ? normalizarFechaSoloDia(String(data.fechaFinCargo)) : '',
        designacion: data.designacion ?? '',
        disciplinaCargo: data.disciplinaCargo ?? '',
        asignaturasVinculadas: asignaturas.length ? JSON.stringify(asignaturas) : '',
        funcionGestion: data.funcionGestion ?? '',
        unidadAcademicaGestion: data.unidadAcademicaGestion ?? '',
        carreraAsociadaGestion: data.carreraAsociadaGestion ?? '',
        tiempoDedicacionGestionSemanal: data.tiempoDedicacionGestionSemanal ?? '',
        fechaInicioGestion: data.fechaInicioGestion ? normalizarFechaSoloDia(String(data.fechaInicioGestion)) : '',
        fechaFinGestion: data.fechaFinGestion ? normalizarFechaSoloDia(String(data.fechaFinGestion)) : '',
        normativaDesignacionGestion: data.normativaDesignacionGestion ?? '',
        tituloProyectoInvestigacion: data.tituloProyectoInvestigacion ?? '',
        institucionProyectoInvestigacion: data.institucionProyectoInvestigacion ?? '',
        institucionEvaluadoraProyectoInvestigacion: data.institucionEvaluadoraProyectoInvestigacion ?? '',
        institucionFinanciadoraProyectoInvestigacion: data.institucionFinanciadoraProyectoInvestigacion ?? '',
        fechaInicioProyectoInvestigacion: data.fechaInicioProyectoInvestigacion ? normalizarFechaSoloDia(String(data.fechaInicioProyectoInvestigacion)) : '',
        fechaFinProyectoInvestigacion: data.fechaFinProyectoInvestigacion ? normalizarFechaSoloDia(String(data.fechaFinProyectoInvestigacion)) : '',
        vinculadoCarreraProyectoInvestigacion: data.vinculadoCarreraProyectoInvestigacion ?? '',
        disciplinasVinculadasProyectoInvestigacion: data.disciplinasVinculadasProyectoInvestigacion ?? '',
        sistemaPromocion: data.sistemaPromocion ?? '',
        categoriaPromocion: data.categoriaPromocion ?? '',
        fechaAltaPromocion: data.fechaAltaPromocion ? normalizarFechaSoloDia(String(data.fechaAltaPromocion)) : '',
        tituloActividadExtension: data.tituloActividadExtension ?? '',
        rolActividadExtension: data.rolActividadExtension ?? '',
        institucionDestinoActividadExtension: data.institucionDestinoActividadExtension ?? '',
        fechaInicioActividadExtension: data.fechaInicioActividadExtension ? normalizarFechaSoloDia(String(data.fechaInicioActividadExtension)) : '',
        finEstadoActividadExtension: data.finEstadoActividadExtension ?? '',
        vinculadaActividadExtension: data.vinculadaActividadExtension ?? '',
        activo: data.activo ?? false
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const indicadores = useMemo(
    () =>
      formData
        ? [
            { key: 'N1', label: 'Minimo', activo: !!formData.nombre && !!formData.apellido },
            { key: 'N2', label: 'Planta', activo: !!formData.tipoDocumento && !!formData.numeroDocumento },
            { key: 'F', label: 'Formación', activo: titulosGrado.length > 0 || titulosPosgrado.length > 0 },
            { key: 'I', label: 'Investigación', activo: !!formData.actividadesProfesionales },
            { key: 'P', label: 'Promoción', activo: !!formData.justificacionPertinencia },
            { key: 'E', label: 'Extensión', activo: !!formData.actividadesProfesionales },
            { key: 'C', label: 'CONEAU', activo: !!formData.cargoDeclarado }
          ]
        : [],
    [formData, titulosGrado, titulosPosgrado]
  );

  function handleFieldChange(field: keyof FormData, value: string) {
    setFormData((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleConstrainFieldChange(field: keyof FormData, value: string) {
    let nextValue = value;

    if (['apellido', 'nombre', 'residencia', 'provincia', 'localidad'].includes(field)) {
      nextValue = value.replace(/[^A-Za-z\s' -]/g, '');
    }

    if (field === 'numeroDocumento' || field === 'telefono' || field === 'numero') {
      nextValue = value.replace(/\D/g, '');
    }

    if (
      field === 'dedicacionDeclaradaSemanal' ||
      field === 'tiempoDocencia' ||
      field === 'tiempoInvestigacion' ||
      field === 'tiempoExtension' ||
      field === 'tiempoGestionAcademica' ||
      field === 'tiempoDedicacionGestionSemanal'
    ) {
      nextValue = value.replace(/\D/g, '');
    }

    if (field === 'cuit') {
      nextValue = value.replace(/\D/g, '').slice(0, 11);
    }

    if (field === 'calle' || field === 'pisoDepto') {
      nextValue = value.replace(/[^A-Za-z0-9\s'.,-]/g, '');
    }

    if (field === 'unidadAcademica') {
      nextValue = value.replace(/[^A-Za-z0-9\s'.,-]/g, '');
    }
    if (field === 'unidadAcademicaGestion' || field === 'carreraAsociadaGestion') {
      nextValue = value.replace(/[^A-Za-z0-9\s'.,-]/g, '');
    }

    handleFieldChange(field, nextValue);
  }

  function validarFicha() {
    if (!formData) return false;
    const requiredFields: Array<keyof FormData> = [
      'apellido', 'nombre', 'fechaNacimiento', 'tipoDocumento', 'numeroDocumento', 'cuit', 'correoElectronico',
      'calle', 'numero', 'residencia', 'provincia', 'localidad', 'codigoPostal'
    ];

    const errors: Partial<Record<keyof FormData, string>> = {};
    requiredFields.forEach((field) => {
      const value = formData[field];
      if (!value || String(value).trim() === '') errors[field] = 'Campo obligatorio';
    });

    if (formData.correoElectronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correoElectronico)) {
      errors.correoElectronico = 'Email invalido';
    }

    if (formData.apellido && !SOLO_CARACTERES_REGEX.test(formData.apellido.trim())) {
      errors.apellido = 'Solo acepta caracteres';
    }
    if (formData.nombre && !SOLO_CARACTERES_REGEX.test(formData.nombre.trim())) {
      errors.nombre = 'Solo acepta caracteres';
    }
    if (formData.numeroDocumento && !SOLO_NUMEROS_REGEX.test(formData.numeroDocumento.trim())) {
      errors.numeroDocumento = 'Solo acepta numeros';
    }
    if (formData.cuit && !/^\d{11}$/.test(formData.cuit.trim())) {
      errors.cuit = 'Debe tener 11 valores numericos';
    }
    if (formData.telefono && !SOLO_NUMEROS_REGEX.test(formData.telefono.trim())) {
      errors.telefono = 'Solo acepta numeros';
    }
    if (formData.calle && !SOLO_ALFANUMERICO_REGEX.test(formData.calle.trim())) {
      errors.calle = 'Solo acepta valores alfanumericos';
    }
    if (formData.numero && !SOLO_NUMEROS_REGEX.test(formData.numero.trim())) {
      errors.numero = 'Solo acepta numeros';
    }
    if (formData.pisoDepto && !SOLO_ALFANUMERICO_REGEX.test(formData.pisoDepto.trim())) {
      errors.pisoDepto = 'Solo acepta valores alfanumericos';
    }
    if (formData.residencia && !SOLO_CARACTERES_REGEX.test(formData.residencia.trim())) {
      errors.residencia = 'Solo acepta caracteres';
    }
    if (formData.provincia && !SOLO_CARACTERES_REGEX.test(formData.provincia.trim())) {
      errors.provincia = 'Solo acepta caracteres';
    }
    if (formData.localidad && !SOLO_CARACTERES_REGEX.test(formData.localidad.trim())) {
      errors.localidad = 'Solo acepta caracteres';
    }
    if (formData.unidadAcademica && !SOLO_ALFANUMERICO_REGEX.test(formData.unidadAcademica.trim())) {
      errors.unidadAcademica = 'Solo acepta valores alfanumericos';
    }
    if (formData.dedicacionDeclaradaSemanal && !SOLO_NUMEROS_REGEX.test(formData.dedicacionDeclaradaSemanal.trim())) {
      errors.dedicacionDeclaradaSemanal = 'Solo acepta numeros';
    }
    if (formData.tiempoDocencia && !SOLO_NUMEROS_REGEX.test(formData.tiempoDocencia.trim())) {
      errors.tiempoDocencia = 'Solo acepta numeros';
    }
    if (formData.tiempoInvestigacion && !SOLO_NUMEROS_REGEX.test(formData.tiempoInvestigacion.trim())) {
      errors.tiempoInvestigacion = 'Solo acepta numeros';
    }
    if (formData.tiempoExtension && !SOLO_NUMEROS_REGEX.test(formData.tiempoExtension.trim())) {
      errors.tiempoExtension = 'Solo acepta numeros';
    }
    if (formData.tiempoGestionAcademica && !SOLO_NUMEROS_REGEX.test(formData.tiempoGestionAcademica.trim())) {
      errors.tiempoGestionAcademica = 'Solo acepta numeros';
    }
    if (formData.tiempoDedicacionGestionSemanal && !SOLO_NUMEROS_REGEX.test(formData.tiempoDedicacionGestionSemanal.trim())) {
      errors.tiempoDedicacionGestionSemanal = 'Solo acepta numeros';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validarTitulo(form: TituloGradoForm) {
    const errors: Partial<Record<keyof TituloGradoForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta caracteres';

    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';

    if (!form.pais.trim()) errors.pais = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.pais.trim())) errors.pais = 'Solo acepta caracteres';

    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';

    setTituloErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoTitulo(field: keyof TituloGradoForm, value: string) {
    setTituloForm((prev) => ({ ...prev, [field]: value }));
    setTituloErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarTituloForm() {
    setTituloForm({ denominacion: '', anio: '', pais: '', institucion: '' });
    setTituloErrors({});
    setEditandoTituloId(null);
  }

  function validarPosgrado(form: TituloPosgradoForm) {
    const errors: Partial<Record<keyof TituloPosgradoForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta caracteres';

    if (!form.tipo.trim()) errors.tipo = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.tipo.trim())) errors.tipo = 'Solo acepta caracteres';

    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';

    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';

    setPosgradoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoPosgrado(field: keyof TituloPosgradoForm, value: string) {
    setPosgradoForm((prev) => ({ ...prev, [field]: value }));
    setPosgradoErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarPosgradoForm() {
    setPosgradoForm({ denominacion: '', tipo: '', anio: '', institucion: '' });
    setPosgradoErrors({});
    setEditandoPosgradoId(null);
  }

  function validarOtroTitulo(form: OtroTituloForm) {
    const errors: Partial<Record<keyof OtroTituloForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta caracteres';

    if (!form.tipo.trim()) errors.tipo = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.tipo.trim())) errors.tipo = 'Solo acepta caracteres';

    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';

    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';

    setOtroTituloErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoOtroTitulo(field: keyof OtroTituloForm, value: string) {
    setOtroTituloForm((prev) => ({ ...prev, [field]: value }));
    setOtroTituloErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarOtroTituloForm() {
    setOtroTituloForm({ denominacion: '', tipo: '', anio: '', institucion: '' });
    setOtroTituloErrors({});
    setEditandoOtroTituloId(null);
  }

  function guardarOtroTitulo() {
    if (!validarOtroTitulo(otroTituloForm)) return;
    const nuevo: OtroTituloItem = {
      id: editandoOtroTituloId ?? `otro-titulo-${Date.now()}`,
      denominacion: otroTituloForm.denominacion.trim(),
      tipo: otroTituloForm.tipo.trim(),
      anio: otroTituloForm.anio.trim(),
      institucion: otroTituloForm.institucion.trim()
    };

    setOtrosTitulos((prev) => {
      const next = editandoOtroTituloId ? prev.map((item) => (item.id === editandoOtroTituloId ? nuevo : item)) : [...prev, nuevo];
      setFormData((current) => (current ? { ...current, otrosTitulos: JSON.stringify(next) } : current));
      return next;
    });

    limpiarOtroTituloForm();
    setMostrarFormOtroTitulo(false);
  }

  function editarOtroTitulo(item: OtroTituloItem) {
    setOtroTituloForm({ denominacion: item.denominacion, tipo: item.tipo, anio: item.anio, institucion: item.institucion });
    setEditandoOtroTituloId(item.id);
    setOtroTituloErrors({});
    setMostrarFormOtroTitulo(true);
  }

  function guardarTituloPosgrado() {
    if (!validarPosgrado(posgradoForm)) return;
    const nuevo: TituloPosgradoItem = {
      id: editandoPosgradoId ?? `posgrado-${Date.now()}`,
      denominacion: posgradoForm.denominacion.trim(),
      tipo: posgradoForm.tipo.trim(),
      anio: posgradoForm.anio.trim(),
      institucion: posgradoForm.institucion.trim()
    };

    setTitulosPosgrado((prev) => {
      const next = editandoPosgradoId ? prev.map((item) => (item.id === editandoPosgradoId ? nuevo : item)) : [...prev, nuevo];
      setFormData((current) => (current ? { ...current, tituloPosgrado: JSON.stringify(next) } : current));
      return next;
    });

    limpiarPosgradoForm();
    setMostrarFormPosgrado(false);
  }

  function editarPosgrado(item: TituloPosgradoItem) {
    setPosgradoForm({ denominacion: item.denominacion, tipo: item.tipo, anio: item.anio, institucion: item.institucion });
    setEditandoPosgradoId(item.id);
    setPosgradoErrors({});
    setMostrarFormPosgrado(true);
  }

  function guardarTituloGrado() {
    if (!validarTitulo(tituloForm)) return;
    const nuevo: TituloGradoItem = {
      id: editandoTituloId ?? `titulo-${Date.now()}`,
      denominacion: tituloForm.denominacion.trim(),
      anio: tituloForm.anio.trim(),
      pais: tituloForm.pais.trim(),
      institucion: tituloForm.institucion.trim()
    };

    setTitulosGrado((prev) => {
      const next = editandoTituloId ? prev.map((item) => (item.id === editandoTituloId ? nuevo : item)) : [...prev, nuevo];
      setFormData((current) => (current ? { ...current, tituloGrado: JSON.stringify(next) } : current));
      return next;
    });

    limpiarTituloForm();
    setMostrarFormGrado(false);
  }

  function editarTitulo(item: TituloGradoItem) {
    setTituloForm({ denominacion: item.denominacion, anio: item.anio, pais: item.pais, institucion: item.institucion });
    setEditandoTituloId(item.id);
    setTituloErrors({});
    setMostrarFormGrado(true);
  }

  async function responderAsignatura(id: string, estado: 'Aceptada' | 'Rechazada') {
    if (!formData) return;
    const next = asignaturasVinculadas.map((item) => (item.id === id ? { ...item, estado } : item));
    setAsignaturasVinculadas(next);
    const updatedForm = { ...formData, asignaturasVinculadas: JSON.stringify(next) };
    setFormData(updatedForm);

    try {
      const token = obtenerTokenActual();
      if (!token) throw new Error('No hay sesion activa');
      const response = await fetch(`${API_URL}/docentes/mi-ficha`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedForm)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);
      setSuccessMessage(`Asignatura ${estado.toLowerCase()} correctamente.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function guardarSeccionTab5() {
    if (!formData) return;
    try {
      const token = obtenerTokenActual();
      if (!token) throw new Error('No hay sesion activa');
      const response = await fetch(`${API_URL}/docentes/mi-ficha`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);
      setSuccessMessage('Sección actualizada correctamente.');
      setEditProyectoInv(false);
      setEditSistemaPromocion(false);
      setEditActividadExtension(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function cancelarSeccionTab5(setter: (value: boolean) => void) {
    setter(false);
    cargarFicha();
  }

  function exportarFichaDocente() {
    if (!formData) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const tableWidth = pageWidth - marginX * 2;
    const labelColW = 190;
    const valueColW = tableWidth - labelColW;
    let y = 70;

    const newPageIfNeeded = (nextHeight: number) => {
      if (y + nextHeight > 800) {
        doc.addPage();
        y = 50;
      }
    };

    const drawSection = (title: string, rows: Array<[string, string]>) => {
      const rowH = 20;
      const sectionH = 28 + rows.length * rowH;
      newPageIfNeeded(sectionH + 16);

      doc.setFillColor(15, 76, 129);
      doc.rect(marginX, y, tableWidth, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, marginX + 8, y + 16);
      y += 24;

      doc.setTextColor(30, 41, 59);
      rows.forEach((row, idx) => {
        const [label, rawValue] = row;
        const value = rawValue && rawValue.trim() ? rawValue : '-';
        doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
        doc.rect(marginX, y, tableWidth, rowH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, rowH);
        doc.line(marginX + labelColW, y, marginX + labelColW, y + rowH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(label, marginX + 6, y + 14);
        doc.setFont('helvetica', 'normal');
        const valueLines = doc.splitTextToSize(value, valueColW - 10);
        doc.text(valueLines[0] ?? '-', marginX + labelColW + 6, y + 14);
        y += rowH;
      });
      y += 12;
    };

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.setFontSize(22);
    doc.text('UDEMM', pageWidth / 2, 34, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.text('Ficha Docente Completa', pageWidth / 2, 52, { align: 'center' });

    drawSection('Datos personales - Identidad', [
      ['Apellido', formData.apellido],
      ['Nombres', formData.nombre],
      ['Sexo', formData.sexo],
      ['Fecha nacimiento', formData.fechaNacimiento],
      ['Tipo documento', formData.tipoDocumento],
      ['Numero documento', formData.numeroDocumento],
      ['CUIT', formData.cuit],
      ['Email', formData.correoElectronico],
      ['Telefono', formData.telefono]
    ]);

    drawSection('Datos personales - Domicilio', [
      ['Calle', formData.calle],
      ['Numero', formData.numero],
      ['Piso/Depto', formData.pisoDepto],
      ['Residencia', formData.residencia],
      ['Provincia', formData.provincia],
      ['Localidad', formData.localidad],
      ['CP', formData.codigoPostal]
    ]);

    drawSection('Formacion academica - Titulos de Grado', [
      ['Registros', titulosGrado.length ? titulosGrado.map((t, i) => `${i + 1}) ${t.denominacion} - ${t.anio} - ${t.pais} - ${t.institucion}`).join(' | ') : '-']
    ]);
    drawSection('Formacion academica - Titulos de Posgrado', [
      ['Registros', titulosPosgrado.length ? titulosPosgrado.map((t, i) => `${i + 1}) ${t.denominacion} - ${t.tipo} - ${t.anio} - ${t.institucion}`).join(' | ') : '-']
    ]);
    drawSection('Formacion academica - Otros Titulos', [
      ['Registros', otrosTitulos.length ? otrosTitulos.map((t, i) => `${i + 1}) ${t.denominacion} - ${t.tipo} - ${t.anio} - ${t.institucion}`).join(' | ') : '-']
    ]);

    drawSection('Docencia universitaria - Cargos docentes', [
      ['Unidad academica', formData.unidadAcademica],
      ['Categoria', formData.categoriaDocente],
      ['Dedicacion', formData.dedicacion],
      ['Ded. declarada semanal (h)', formData.dedicacionDeclaradaSemanal],
      ['Tiempo docencia (h)', formData.tiempoDocencia],
      ['Tiempo investigacion (h)', formData.tiempoInvestigacion],
      ['Tiempo extension (h)', formData.tiempoExtension],
      ['Tiempo gestion academica (h)', formData.tiempoGestionAcademica],
      ['Fecha inicio', formData.fechaInicioCargo],
      ['Fecha fin', formData.fechaFinCargo || 'Vacio = Vigente'],
      ['Designacion', formData.designacion],
      ['Disciplina del cargo', formData.disciplinaCargo]
    ]);

    drawSection('Docencia universitaria - Asignaturas vinculadas', [
      ['Registros', asignaturasVinculadas.length ? asignaturasVinculadas.map((a, i) => `${i + 1}) ${a.asignatura} - ${a.anioInicio} - ${a.responsable} - ${a.estado}`).join(' | ') : '-']
    ]);

    drawSection('Gestion academica', [
      ['Funcion', formData.funcionGestion],
      ['Unidad academica', formData.unidadAcademicaGestion],
      ['Carrera asociada', formData.carreraAsociadaGestion],
      ['Tiempo dedicacion semanal (h)', formData.tiempoDedicacionGestionSemanal],
      ['Fecha inicio', formData.fechaInicioGestion],
      ['Fecha fin', formData.fechaFinGestion || 'Vacio = Vigente'],
      ['Normativa de designacion', formData.normativaDesignacionGestion]
    ]);

    drawSection('Inv., Prom. y Ext - Proyectos de investigacion', [
      ['Titulo', formData.tituloProyectoInvestigacion],
      ['Institucion', formData.institucionProyectoInvestigacion],
      ['Institucion evaluadora', formData.institucionEvaluadoraProyectoInvestigacion],
      ['Institucion financiadora', formData.institucionFinanciadoraProyectoInvestigacion],
      ['Fecha inicio', formData.fechaInicioProyectoInvestigacion],
      ['Fecha fin', formData.fechaFinProyectoInvestigacion || 'Vacio = Vigente'],
      ['Vinculado a carrera', formData.vinculadoCarreraProyectoInvestigacion],
      ['Disciplinas vinculadas', formData.disciplinasVinculadasProyectoInvestigacion]
    ]);

    drawSection('Inv., Prom. y Ext - Sistemas de promocion', [
      ['Sistema', formData.sistemaPromocion],
      ['Categoria', formData.categoriaPromocion],
      ['Fecha alta', formData.fechaAltaPromocion]
    ]);

    drawSection('Inv., Prom. y Ext - Actividades de extension', [
      ['Titulo', formData.tituloActividadExtension],
      ['Rol', formData.rolActividadExtension],
      ['Institucion destino', formData.institucionDestinoActividadExtension],
      ['Fecha inicio', formData.fechaInicioActividadExtension],
      ['Fin/Estado', formData.finEstadoActividadExtension],
      ['Vinculada', formData.vinculadaActividadExtension]
    ]);

    doc.save(`ficha-docente-${(formData.apellido || 'docente').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function guardarFicha() {
    if (!formData) return;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    if (!validarFicha()) {
      setError('Por favor completa los campos obligatorios marcados en rojo.');
      setSubmitting(false);
      return;
    }

    try {
      const token = obtenerTokenActual();
      if (!token) throw new Error('No hay sesion activa');

      const response = await fetch(`${API_URL}/docentes/mi-ficha`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);

      setSuccessMessage('Ficha actualizada correctamente.');
      setEditMode(false);
      setFieldErrors({});
      limpiarTituloForm();
      limpiarPosgradoForm();
      limpiarOtroTituloForm();
      setMostrarFormGrado(false);
      setMostrarFormPosgrado(false);
      setMostrarFormOtroTitulo(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelarEdicion() {
    setEditMode(false);
    setFieldErrors({});
    limpiarTituloForm();
    limpiarPosgradoForm();
    limpiarOtroTituloForm();
    setMostrarFormGrado(false);
    setMostrarFormPosgrado(false);
    setMostrarFormOtroTitulo(false);
    cargarFicha();
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Cargando ficha docente...</div>;
  if (!formData) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">No se pudo cargar la ficha docente.</div>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rol</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f4c81]">DOCENTE</h2>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Módulo</p>
            <nav className="mt-2 space-y-2">
              {menuDocente.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={`block rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-[#0f4c81] text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <div className="flex-1 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Mi ficha docente</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#0f4c81]">{formData.apellido} {formData.nombre}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {editMode ? (
              <>
                <button type="button" onClick={guardarFicha} disabled={submitting} className="rounded-full bg-[#0f4c81] px-6 py-3 text-sm font-semibold text-white">
                  {submitting ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={cancelarEdicion} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700">
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setEditMode(true); setActiveTab(1); }} className="rounded-full bg-[#f26b22] px-6 py-3 text-sm font-semibold text-white">
                Editar ficha
              </button>
            )}
            <button type="button" onClick={exportarFichaDocente} className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Exportar ficha
            </button>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/50">
          {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {successMessage ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{successMessage}</div> : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {TAB_TITLES.map((tab, index) => (
                <button key={tab.numero} type="button" onClick={() => setActiveTab(index + 1)} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${activeTab === index + 1 ? 'bg-[#0f4c81] text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${activeTab === index + 1 ? 'bg-white text-[#0f4c81]' : 'bg-slate-200 text-slate-700'}`}>
                    {tab.numero}
                  </span>
                  <span>{tab.texto}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-slate-700">Completitud</p>
              {indicadores.map((item) => (
                <div key={item.key} title={item.label} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${item.activo ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${item.activo ? 'bg-green-600' : 'bg-red-600'}`} />
                  <span>{item.key}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {activeTab === 1 && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">Identidad</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Apellido *</p>
                      {editMode ? <input value={formData.apellido} onChange={(e) => handleConstrainFieldChange('apellido', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.apellido}</p>}
                      {fieldErrors.apellido ? <p className="mt-1 text-xs text-red-600">{fieldErrors.apellido}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Nombres *</p>
                      {editMode ? <input value={formData.nombre} onChange={(e) => handleConstrainFieldChange('nombre', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.nombre}</p>}
                      {fieldErrors.nombre ? <p className="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Sexo</p>
                      {editMode ? (
                        <select value={formData.sexo} onChange={(e) => handleFieldChange('sexo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.sexo || '-'}</p>}
                      {fieldErrors.sexo ? <p className="mt-1 text-xs text-red-600">{fieldErrors.sexo}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Fecha nac *</p>
                      {editMode ? <input type="date" value={formData.fechaNacimiento} onChange={(e) => handleFieldChange('fechaNacimiento', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaNacimiento}</p>}
                      {fieldErrors.fechaNacimiento ? <p className="mt-1 text-xs text-red-600">{fieldErrors.fechaNacimiento}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Tipo doc *</p>
                      {editMode ? (
                        <select value={formData.tipoDocumento} onChange={(e) => handleFieldChange('tipoDocumento', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="DNI">DNI</option>
                          <option value="PASAPORTE">PASAPORTE</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.tipoDocumento}</p>}
                      {fieldErrors.tipoDocumento ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tipoDocumento}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">N° doc *</p>
                      {editMode ? <input value={formData.numeroDocumento} onChange={(e) => handleConstrainFieldChange('numeroDocumento', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.numeroDocumento}</p>}
                      {fieldErrors.numeroDocumento ? <p className="mt-1 text-xs text-red-600">{fieldErrors.numeroDocumento}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Cuit *</p>
                      {editMode ? <input value={formData.cuit} onChange={(e) => handleConstrainFieldChange('cuit', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.cuit}</p>}
                      {fieldErrors.cuit ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cuit}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Email *</p>
                      {editMode ? <input type="email" value={formData.correoElectronico} onChange={(e) => handleFieldChange('correoElectronico', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.correoElectronico}</p>}
                      {fieldErrors.correoElectronico ? <p className="mt-1 text-xs text-red-600">{fieldErrors.correoElectronico}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Telefono</p>
                      {editMode ? <input value={formData.telefono} onChange={(e) => handleConstrainFieldChange('telefono', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.telefono}</p>}
                      {fieldErrors.telefono ? <p className="mt-1 text-xs text-red-600">{fieldErrors.telefono}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">Domicilio</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Calle *</p>
                      {editMode ? <input value={formData.calle} onChange={(e) => handleConstrainFieldChange('calle', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.calle}</p>}
                      {fieldErrors.calle ? <p className="mt-1 text-xs text-red-600">{fieldErrors.calle}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Numero *</p>
                      {editMode ? <input value={formData.numero} onChange={(e) => handleConstrainFieldChange('numero', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.numero}</p>}
                      {fieldErrors.numero ? <p className="mt-1 text-xs text-red-600">{fieldErrors.numero}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Piso/Depto</p>
                      {editMode ? <input value={formData.pisoDepto} onChange={(e) => handleConstrainFieldChange('pisoDepto', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.pisoDepto}</p>}
                      {fieldErrors.pisoDepto ? <p className="mt-1 text-xs text-red-600">{fieldErrors.pisoDepto}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Residencia *</p>
                      {editMode ? <input value={formData.residencia} onChange={(e) => handleConstrainFieldChange('residencia', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.residencia}</p>}
                      {fieldErrors.residencia ? <p className="mt-1 text-xs text-red-600">{fieldErrors.residencia}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Provincia *</p>
                      {editMode ? <input value={formData.provincia} onChange={(e) => handleConstrainFieldChange('provincia', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.provincia}</p>}
                      {fieldErrors.provincia ? <p className="mt-1 text-xs text-red-600">{fieldErrors.provincia}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Localidad *</p>
                      {editMode ? <input value={formData.localidad} onChange={(e) => handleConstrainFieldChange('localidad', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.localidad}</p>}
                      {fieldErrors.localidad ? <p className="mt-1 text-xs text-red-600">{fieldErrors.localidad}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">CP *</p>
                      {editMode ? <input value={formData.codigoPostal} onChange={(e) => handleFieldChange('codigoPostal', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.codigoPostal}</p>}
                      {fieldErrors.codigoPostal ? <p className="mt-1 text-xs text-red-600">{fieldErrors.codigoPostal}</p> : null}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Los campos marcados con * son obligatorios.</p>
                </div>

              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Títulos de Grado</p>
                    {editMode ? <button type="button" onClick={() => { limpiarTituloForm(); setMostrarFormGrado(true); }} className="rounded-full bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormGrado ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Denominacion *</label><input value={tituloForm.denominacion} onChange={(e) => actualizarCampoTitulo('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{tituloErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={tituloForm.anio} onChange={(e) => actualizarCampoTitulo('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.anio ? <p className="mt-1 text-xs text-red-600">{tituloErrors.anio}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Pais *</label><input value={tituloForm.pais} onChange={(e) => actualizarCampoTitulo('pais', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.pais ? <p className="mt-1 text-xs text-red-600">{tituloErrors.pais}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Institucion *</label><input value={tituloForm.institucion} onChange={(e) => actualizarCampoTitulo('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.institucion ? <p className="mt-1 text-xs text-red-600">{tituloErrors.institucion}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarTituloGrado} className="rounded-full bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarTituloForm(); setMostrarFormGrado(false); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Denominacion</th><th className="px-3 py-2">Año</th><th className="px-3 py-2">Pais</th><th className="px-3 py-2">Institucion</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{titulosGrado.length === 0 ? <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : titulosGrado.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2">{item.pais}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2 text-right">{editMode ? <button type="button" onClick={() => editarTitulo(item)} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Editar registro" title="Editar registro"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Titulos de Posgrado</p>
                    {editMode ? <button type="button" onClick={() => { limpiarPosgradoForm(); setMostrarFormPosgrado(true); }} className="rounded-full bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormPosgrado ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Denominacion *</label><input value={posgradoForm.denominacion} onChange={(e) => actualizarCampoPosgrado('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Tipo *</label><input value={posgradoForm.tipo} onChange={(e) => actualizarCampoPosgrado('tipo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.tipo ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.tipo}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={posgradoForm.anio} onChange={(e) => actualizarCampoPosgrado('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.anio ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.anio}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Institucion *</label><input value={posgradoForm.institucion} onChange={(e) => actualizarCampoPosgrado('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.institucion ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.institucion}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarTituloPosgrado} className="rounded-full bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarPosgradoForm(); setMostrarFormPosgrado(false); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Denominacion</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Año</th><th className="px-3 py-2">Institucion</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{titulosPosgrado.length === 0 ? <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : titulosPosgrado.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.tipo}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2 text-right">{editMode ? <button type="button" onClick={() => editarPosgrado(item)} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Editar registro posgrado" title="Editar registro posgrado"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Otros Titulos</p>
                    {editMode ? <button type="button" onClick={() => { limpiarOtroTituloForm(); setMostrarFormOtroTitulo(true); }} className="rounded-full bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormOtroTitulo ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Denominacion *</label><input value={otroTituloForm.denominacion} onChange={(e) => actualizarCampoOtroTitulo('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Tipo *</label><input value={otroTituloForm.tipo} onChange={(e) => actualizarCampoOtroTitulo('tipo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.tipo ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.tipo}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={otroTituloForm.anio} onChange={(e) => actualizarCampoOtroTitulo('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.anio ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.anio}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Institucion *</label><input value={otroTituloForm.institucion} onChange={(e) => actualizarCampoOtroTitulo('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.institucion ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.institucion}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarOtroTitulo} className="rounded-full bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarOtroTituloForm(); setMostrarFormOtroTitulo(false); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Denominacion</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Año</th><th className="px-3 py-2">Institucion</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{otrosTitulos.length === 0 ? <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : otrosTitulos.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.tipo}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2 text-right">{editMode ? <button type="button" onClick={() => editarOtroTitulo(item)} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Editar otro titulo" title="Editar otro titulo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">Cargos docentes</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Unidad academica</p>
                      {editMode ? <input value={formData.unidadAcademica} onChange={(e) => handleConstrainFieldChange('unidadAcademica', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.unidadAcademica || '-'}</p>}
                      {fieldErrors.unidadAcademica ? <p className="mt-1 text-xs text-red-600">{fieldErrors.unidadAcademica}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Categoria</p>
                      {editMode ? (
                        <select value={formData.categoriaDocente} onChange={(e) => handleFieldChange('categoriaDocente', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Titular">Titular</option>
                          <option value="Asociado">Asociado</option>
                          <option value="Adjunto">Adjunto</option>
                          <option value="JTP">JTP</option>
                          <option value="Ayud. Graduado">Ayud. Graduado</option>
                          <option value="Ayud. No Graduado">Ayud. No Graduado</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.categoriaDocente || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Dedicacion</p>
                      {editMode ? (
                        <select value={formData.dedicacion} onChange={(e) => handleFieldChange('dedicacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Exclusiva">Exclusiva</option>
                          <option value="Semiexclusiva">Semiexclusiva</option>
                          <option value="Simple">Simple</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.dedicacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Ded. declarada semanal (h)</p>
                      {editMode ? <input value={formData.dedicacionDeclaradaSemanal} onChange={(e) => handleConstrainFieldChange('dedicacionDeclaradaSemanal', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.dedicacionDeclaradaSemanal || '-'}</p>}
                      {fieldErrors.dedicacionDeclaradaSemanal ? <p className="mt-1 text-xs text-red-600">{fieldErrors.dedicacionDeclaradaSemanal}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Tiempo docencia (h)</p>
                      {editMode ? <input value={formData.tiempoDocencia} onChange={(e) => handleConstrainFieldChange('tiempoDocencia', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.tiempoDocencia || '-'}</p>}
                      {fieldErrors.tiempoDocencia ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tiempoDocencia}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Tiempo investigacion (h)</p>
                      {editMode ? <input value={formData.tiempoInvestigacion} onChange={(e) => handleConstrainFieldChange('tiempoInvestigacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.tiempoInvestigacion || '-'}</p>}
                      {fieldErrors.tiempoInvestigacion ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tiempoInvestigacion}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Tiempo extension (h)</p>
                      {editMode ? <input value={formData.tiempoExtension} onChange={(e) => handleConstrainFieldChange('tiempoExtension', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.tiempoExtension || '-'}</p>}
                      {fieldErrors.tiempoExtension ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tiempoExtension}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Tiempo gestion academica (h)</p>
                      {editMode ? <input value={formData.tiempoGestionAcademica} onChange={(e) => handleConstrainFieldChange('tiempoGestionAcademica', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.tiempoGestionAcademica || '-'}</p>}
                      {fieldErrors.tiempoGestionAcademica ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tiempoGestionAcademica}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Fecha inicio</p>
                      {editMode ? <input type="date" value={formData.fechaInicioCargo} onChange={(e) => handleFieldChange('fechaInicioCargo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaInicioCargo || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Fecha fin</p>
                      {editMode ? <input type="date" value={formData.fechaFinCargo} onChange={(e) => handleFieldChange('fechaFinCargo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaFinCargo || 'Vacio = Vigente'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Designacion</p>
                      {editMode ? (
                        <select value={formData.designacion} onChange={(e) => handleFieldChange('designacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Concursado">Concursado</option>
                          <option value="Estable">Estable</option>
                          <option value="Interino">Interino</option>
                          <option value="Contratado">Contratado</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.designacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Disciplina del cargo</p>
                      {editMode ? (
                        <select value={formData.disciplinaCargo} onChange={(e) => handleFieldChange('disciplinaCargo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Ing. Industrial">Ing. Industrial</option>
                          <option value="Ing. Mecanica">Ing. Mecánica</option>
                          <option value="Ing. Electronica">Ing. Electrónica</option>
                          <option value="Ing. Sistemas">Ing. Sistemas</option>
                          <option value="Cs. Basicas y Exactas">Cs. Básicas y Exactas</option>
                          <option value="Cs. Economicas">Cs. Económicas</option>
                          <option value="Otro">Otro</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.disciplinaCargo || '-'}</p>}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">Asignaturas vinculadas</p>
                  <p className="mt-2 text-sm text-slate-600">Recibís notificaciones automáticas de otro rol. Podés aceptar o rechazar cada asignatura.</p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Asignatura</th>
                          <th className="px-3 py-2">Año inicio</th>
                          <th className="px-3 py-2">Responsable</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asignaturasVinculadas.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros recibidos.</td>
                          </tr>
                        ) : (
                          asignaturasVinculadas.map((item) => {
                            const anioValido = ANIO_REGEX.test(item.anioInicio);
                            const asignaturaValida = SOLO_ALFANUMERICO_REGEX.test(item.asignatura);
                            return (
                              <tr key={item.id} className="border-t border-slate-100">
                                <td className={`px-3 py-2 ${asignaturaValida ? '' : 'text-red-600'}`}>{item.asignatura || '-'}</td>
                                <td className={`px-3 py-2 ${anioValido ? '' : 'text-red-600'}`}>{item.anioInicio || '-'}</td>
                                <td className="px-3 py-2">{item.responsable}</td>
                                <td className="px-3 py-2">{item.estado}</td>
                                <td className="px-3 py-2 text-right">
                                  {item.estado === 'Pendiente' ? (
                                    <div className="inline-flex gap-2">
                                      <button type="button" onClick={() => responderAsignatura(item.id, 'Aceptada')} className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">Aceptar</button>
                                      <button type="button" onClick={() => responderAsignatura(item.id, 'Rechazada')} className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">Rechazar</button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">Sin acciones</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 4 && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">Cargos de gestion académica</p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Función</th>
                          <th className="px-3 py-2">Unidad</th>
                          <th className="px-3 py-2">Fecha inicio</th>
                          <th className="px-3 py-2">Horas semanales</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-100">
                          <td className="px-3 py-3 text-slate-500">-</td>
                          <td className="px-3 py-3 text-slate-500">-</td>
                          <td className="px-3 py-3 text-slate-500">-</td>
                          <td className="px-3 py-3 text-slate-500">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">Nuevo cargo de gestión</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Función *</p>
                      {editMode ? (
                        <select value={formData.funcionGestion} onChange={(e) => handleFieldChange('funcionGestion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Rector">Rector</option>
                          <option value="Vicerrector Académico">Vicerrector Académico</option>
                          <option value="Secretario General">Secretario General</option>
                          <option value="Decano">Decano</option>
                          <option value="Secretario Académico">Secretario Académico</option>
                          <option value="Secretario de Investigación">Secretario de Investigación</option>
                          <option value="Secretario de Extensión">Secretario de Extensión</option>
                          <option value="Director de Carrera">Director de Carrera</option>
                          <option value="Miembro de Comisión Curricular">Miembro de Comisión Curricular</option>
                          <option value="Otro">Otro</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.funcionGestion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Unidad academica *</p>
                      {editMode ? <input value={formData.unidadAcademicaGestion} onChange={(e) => handleConstrainFieldChange('unidadAcademicaGestion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.unidadAcademicaGestion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Carrera asociada</p>
                      {editMode ? <input value={formData.carreraAsociadaGestion} onChange={(e) => handleConstrainFieldChange('carreraAsociadaGestion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.carreraAsociadaGestion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Tiempo dedicacion semanal (h) *</p>
                      {editMode ? <input value={formData.tiempoDedicacionGestionSemanal} onChange={(e) => handleConstrainFieldChange('tiempoDedicacionGestionSemanal', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.tiempoDedicacionGestionSemanal || '-'}</p>}
                      {fieldErrors.tiempoDedicacionGestionSemanal ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tiempoDedicacionGestionSemanal}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Fecha inicio *</p>
                      {editMode ? <input type="date" value={formData.fechaInicioGestion} onChange={(e) => handleFieldChange('fechaInicioGestion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaInicioGestion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Fecha fin</p>
                      {editMode ? <input type="date" value={formData.fechaFinGestion} onChange={(e) => handleFieldChange('fechaFinGestion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaFinGestion || 'Vacio = Vigente'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-xs uppercase text-slate-500">Normativa de designacion</p>
                      {editMode ? <input value={formData.normativaDesignacionGestion} onChange={(e) => handleFieldChange('normativaDesignacionGestion', e.target.value)} placeholder="Resolución (opcional)" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.normativaDesignacionGestion || '-'}</p>}
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Los cargos de gestión no afectan la completitud de la ficha
                  </div>
                  <p className="mt-2 text-xs text-slate-500">* Campo obligatorio</p>
                </div>
              </div>
            )}
            {activeTab === 5 && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Proyectos de investigación</p>
                    <div className="flex gap-2">
                      {editMode ? <button type="button" onClick={() => setEditProyectoInv(true)} className="rounded-full bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white">+ Agregar</button> : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                      <p className="text-xs uppercase text-slate-500">Título *</p>
                      {editProyectoInv ? <input value={formData.tituloProyectoInvestigacion} onChange={(e) => handleFieldChange('tituloProyectoInvestigacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.tituloProyectoInvestigacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Institución *</p>
                      {editProyectoInv ? <input value={formData.institucionProyectoInvestigacion} onChange={(e) => handleFieldChange('institucionProyectoInvestigacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.institucionProyectoInvestigacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Institución evaluadora</p>
                      {editProyectoInv ? <input value={formData.institucionEvaluadoraProyectoInvestigacion} onChange={(e) => handleFieldChange('institucionEvaluadoraProyectoInvestigacion', e.target.value)} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.institucionEvaluadoraProyectoInvestigacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Institución financiadora</p>
                      {editProyectoInv ? <input value={formData.institucionFinanciadoraProyectoInvestigacion} onChange={(e) => handleFieldChange('institucionFinanciadoraProyectoInvestigacion', e.target.value)} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.institucionFinanciadoraProyectoInvestigacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Fecha inicio *</p>
                      {editProyectoInv ? <input type="date" value={formData.fechaInicioProyectoInvestigacion} onChange={(e) => handleFieldChange('fechaInicioProyectoInvestigacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaInicioProyectoInvestigacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Fecha fin</p>
                      {editProyectoInv ? <input type="date" value={formData.fechaFinProyectoInvestigacion} onChange={(e) => handleFieldChange('fechaFinProyectoInvestigacion', e.target.value)} placeholder="Vacio = Vigente" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaFinProyectoInvestigacion || 'Vacio = Vigente'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Vinculado a carrera *</p>
                      {editProyectoInv ? (
                        <select value={formData.vinculadoCarreraProyectoInvestigacion} onChange={(e) => handleFieldChange('vinculadoCarreraProyectoInvestigacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Si">Si</option>
                          <option value="No">No</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.vinculadoCarreraProyectoInvestigacion || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Disciplinas vinculadas</p>
                      {editProyectoInv ? <input value={formData.disciplinasVinculadasProyectoInvestigacion} onChange={(e) => handleFieldChange('disciplinasVinculadasProyectoInvestigacion', e.target.value)} placeholder="Seleccionar del Catálogo" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.disciplinasVinculadasProyectoInvestigacion || '-'}</p>}
                    </div>
                  </div>
                  {editMode && editProyectoInv ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={guardarSeccionTab5} className="rounded-full bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                      <button type="button" onClick={() => cancelarSeccionTab5(setEditProyectoInv)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Sistemas de promoción</p>
                    <div className="flex gap-2">
                      {editMode ? <button type="button" onClick={() => setEditSistemaPromocion(true)} className="rounded-full bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white">+ Agregar</button> : null}
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Sistema</th>
                          <th className="px-3 py-2">Categoria</th>
                          <th className="px-3 py-2">Fecha alta</th>
                          <th className="px-3 py-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            {editSistemaPromocion ? (
                              <input value={formData.sistemaPromocion} onChange={(e) => handleFieldChange('sistemaPromocion', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                            ) : (
                              formData.sistemaPromocion || '-'
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {editSistemaPromocion ? (
                              <input value={formData.categoriaPromocion} onChange={(e) => handleFieldChange('categoriaPromocion', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                            ) : (
                              formData.categoriaPromocion || '-'
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {editSistemaPromocion ? (
                              <input type="date" value={formData.fechaAltaPromocion} onChange={(e) => handleFieldChange('fechaAltaPromocion', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                            ) : (
                              formData.fechaAltaPromocion || '-'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {editSistemaPromocion ? (
                              <span className="text-xs text-slate-500">Editando</span>
                            ) : editMode ? (
                              <button type="button" onClick={() => setEditSistemaPromocion(true)} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Modificar sistema de promoción" title="Modificar sistema de promoción">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {editMode && editSistemaPromocion ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={guardarSeccionTab5} className="rounded-full bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                      <button type="button" onClick={() => cancelarSeccionTab5(setEditSistemaPromocion)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Actividades de extensión</p>
                    <div className="flex gap-2">
                      {editMode ? <button type="button" onClick={() => setEditActividadExtension(true)} className="rounded-full bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white">+ Agregar</button> : null}
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Titulo</th>
                          <th className="px-3 py-2">Rol</th>
                          <th className="px-3 py-2">Institución destino</th>
                          <th className="px-3 py-2">Fecha inicio</th>
                          <th className="px-3 py-2">Fin/Estado</th>
                          <th className="px-3 py-2">Vinculada</th>
                          <th className="px-3 py-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            {editActividadExtension ? <input value={formData.tituloActividadExtension} onChange={(e) => handleFieldChange('tituloActividadExtension', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : (formData.tituloActividadExtension || '-')}
                          </td>
                          <td className="px-3 py-2">
                            {editActividadExtension ? <input value={formData.rolActividadExtension} onChange={(e) => handleFieldChange('rolActividadExtension', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : (formData.rolActividadExtension || '-')}
                          </td>
                          <td className="px-3 py-2">
                            {editActividadExtension ? <input value={formData.institucionDestinoActividadExtension} onChange={(e) => handleFieldChange('institucionDestinoActividadExtension', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : (formData.institucionDestinoActividadExtension || '-')}
                          </td>
                          <td className="px-3 py-2">
                            {editActividadExtension ? <input type="date" value={formData.fechaInicioActividadExtension} onChange={(e) => handleFieldChange('fechaInicioActividadExtension', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : (formData.fechaInicioActividadExtension || '-')}
                          </td>
                          <td className="px-3 py-2">
                            {editActividadExtension ? (
                              <select value={formData.finEstadoActividadExtension} onChange={(e) => handleFieldChange('finEstadoActividadExtension', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                <option value="">Seleccionar</option>
                                <option value="Vigente">Vigente</option>
                                <option value="Finalizada">Finalizada</option>
                              </select>
                            ) : (formData.finEstadoActividadExtension || '-')}
                          </td>
                          <td className="px-3 py-2">
                            {editActividadExtension ? (
                              <select value={formData.vinculadaActividadExtension} onChange={(e) => handleFieldChange('vinculadaActividadExtension', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                <option value="">Seleccionar</option>
                                <option value="Si">Si</option>
                                <option value="No">No</option>
                              </select>
                            ) : (formData.vinculadaActividadExtension || '-')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {editActividadExtension ? (
                              <span className="text-xs text-slate-500">Editando</span>
                            ) : editMode ? (
                              <button type="button" onClick={() => setEditActividadExtension(true)} className="rounded-full border border-slate-200 p-2 text-slate-600" aria-label="Modificar actividad de extensión" title="Modificar actividad de extensión">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {editMode && editActividadExtension ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={guardarSeccionTab5} className="rounded-full bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                      <button type="button" onClick={() => cancelarSeccionTab5(setEditActividadExtension)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">Cancelar</button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {editMode ? (
            <div className="mt-8 flex justify-end">
              <button type="button" onClick={guardarFicha} disabled={submitting} className="rounded-full bg-[#0f4c81] px-6 py-3 text-sm font-semibold text-white">
                {submitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          ) : null}
        </section>
        </div>
      </div>
    </main>
  );
}
