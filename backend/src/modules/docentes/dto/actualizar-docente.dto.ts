import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const SOLO_CARACTERES_REGEX = /^[A-Za-z\s' -]+$/;
const SOLO_NUMEROS_REGEX = /^\d+$/;
const FECHA_YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DOCUMENTO_REGEX = /^\d+$|^[A-Za-z0-9-]+$/;

export class ActualizarDocenteDto {
  @IsString()
  @IsOptional()
  @Matches(SOLO_CARACTERES_REGEX, { message: 'El nombre solo puede contener letras' })
  nombre?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_CARACTERES_REGEX, { message: 'El apellido solo puede contener letras' })
  apellido?: string;

  @IsString()
  @IsOptional()
  @IsIn(['DNI', 'PASAPORTE'], { message: 'El tipo de documento debe ser DNI o PASAPORTE' })
  tipoDocumento?: 'DNI' | 'PASAPORTE';

  @IsString()
  @IsOptional()
  @Matches(DOCUMENTO_REGEX, { message: 'El número de documento tiene un formato inválido' })
  numeroDocumento?: string;

  @IsString()
  @IsOptional()
  sexo?: string;

  @IsOptional()
  @Matches(FECHA_YYYY_MM_DD_REGEX, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD' })
  fechaNacimiento?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'El CUIT debe tener exactamente 11 dígitos numéricos' })
  cuit?: string;

  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido' })
  @IsOptional()
  correoElectronico?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El teléfono solo puede contener números' })
  telefono?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_CARACTERES_REGEX, { message: 'La calle solo puede contener letras' })
  calle?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El número de calle solo puede contener números' })
  numero?: string;

  @IsString()
  @IsOptional()
  pisoDepto?: string;

  @IsString()
  @IsOptional()
  residencia?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_CARACTERES_REGEX, { message: 'La provincia solo puede contener letras' })
  provincia?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_CARACTERES_REGEX, { message: 'La localidad solo puede contener letras' })
  localidad?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El código postal solo puede contener números' })
  codigoPostal?: string;

  @IsString()
  @IsOptional()
  domicilio?: string;

  @IsString()
  @IsOptional()
  tituloGrado?: string;

  @IsString()
  @IsOptional()
  tituloPosgrado?: string;

  @IsString()
  @IsOptional()
  cargoDeclarado?: string;

  @IsString()
  @IsOptional()
  dedicacion?: string;

  @IsString()
  @IsOptional()
  unidadAcademica?: string;

  @IsString()
  @IsOptional()
  categoriaDocente?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'La dedicación declarada semanal solo puede contener números' })
  dedicacionDeclaradaSemanal?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El tiempo de docencia solo puede contener números' })
  tiempoDocencia?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El tiempo de investigación solo puede contener números' })
  tiempoInvestigacion?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El tiempo de extensión solo puede contener números' })
  tiempoExtension?: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El tiempo de gestión académica solo puede contener números' })
  tiempoGestionAcademica?: string;

  @IsOptional()
  @Matches(FECHA_YYYY_MM_DD_REGEX, { message: 'La fecha de inicio debe tener formato YYYY-MM-DD' })
  fechaInicioCargo?: string;

  @IsOptional()
  @Matches(FECHA_YYYY_MM_DD_REGEX, { message: 'La fecha de fin debe tener formato YYYY-MM-DD' })
  fechaFinCargo?: string;

  @IsString()
  @IsOptional()
  designacion?: string;

  @IsString()
  @IsOptional()
  disciplinaCargo?: string;

  @IsString()
  @IsOptional()
  justificacionPertinencia?: string;

  @IsString()
  @IsOptional()
  actividadesProfesionales?: string;

  @IsString()
  @IsOptional()
  antecedentesAcademicos?: string;

  @IsString()
  @IsOptional()
  otrosTitulos?: string;

  @IsString()
  @IsOptional()
  carreraFormacionDocenteJson?: string;

  @IsString()
  @IsOptional()
  areaDisciplinar?: string;

  @IsString()
  @IsOptional()
  subarea?: string;

  @IsUUID()
  @IsOptional()
  areaDisciplinarId?: string;

  @IsUUID()
  @IsOptional()
  subareaId?: string;

  @IsString()
  @IsOptional()
  observacionesArea?: string;

  @IsString()
  @IsOptional()
  asignaturasVinculadas?: string;

  @IsString()
  @IsOptional()
  actividadesPosgradoJson?: string;

  @IsString()
  @IsOptional()
  trayectoriaCargosPasadosJson?: string;

  @IsString()
  @IsOptional()
  direccionTesisJson?: string;

  @IsString()
  @IsOptional()
  experienciaDistancia?: string;

  // Cargos académicos (gestión)
  @IsString()
  @IsOptional()
  funcionGestion?: string;

  @IsString()
  @IsOptional()
  unidadAcademicaGestion?: string;

  @IsString()
  @IsOptional()
  tiempoDedicacionGestionSemanal?: string;

  @IsString()
  @IsOptional()
  fechaInicioGestion?: string;

  @IsString()
  @IsOptional()
  fechaFinGestion?: string;

  @IsString()
  @IsOptional()
  carreraAsociadaGestion?: string;

  @IsString()
  @IsOptional()
  normativaDesignacionGestion?: string;

  @IsString()
  @IsOptional()
  cargosAcademicosJson?: string;

  @IsString()
  @IsOptional()
  otrasDedicacionesJson?: string;

  @IsString()
  @IsOptional()
  desempenoActualJson?: string;

  @IsString()
  @IsOptional()
  desempenoPasadoJson?: string;

  // Investigación
  @IsString()
  @IsOptional()
  tituloProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  institucionProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  institucionEvaluadoraProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  institucionFinanciadoraProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  fechaInicioProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  fechaFinProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  vinculadoCarreraProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  disciplinasVinculadasProyectoInvestigacion?: string;

  @IsString()
  @IsOptional()
  proyectosInvestigacionJson?: string;

  @IsString()
  @IsOptional()
  sistemasPromocionInvestigacionJson?: string;

  @IsString()
  @IsOptional()
  participacionVinculacionJson?: string;

  @IsString()
  @IsOptional()
  produccionCientificaJson?: string;

  @IsString()
  @IsOptional()
  reunionesCientificasJson?: string;

  @IsString()
  @IsOptional()
  comitesJuradosJson?: string;

  // Otra Información (Tab 10)
  @IsString()
  @IsOptional()
  carreraDocentePosgrado?: string;

  @IsString()
  @IsOptional()
  actividadesTransferenciaExtension?: string;

  @IsString()
  @IsOptional()
  premiosDistinciones?: string;

  @IsString()
  @IsOptional()
  estanciasCursosExterior?: string;

  @IsString()
  @IsOptional()
  membresiasInstituciones?: string;

  // Extensión
  @IsString()
  @IsOptional()
  tituloActividadExtension?: string;

  @IsString()
  @IsOptional()
  rolActividadExtension?: string;

  @IsString()
  @IsOptional()
  institucionDestinoActividadExtension?: string;

  @IsString()
  @IsOptional()
  fechaInicioActividadExtension?: string;

  @IsString()
  @IsOptional()
  finEstadoActividadExtension?: string;

  @IsString()
  @IsOptional()
  vinculadaActividadExtension?: string;

  @IsString()
  @IsOptional()
  actividadesExtensionJson?: string;

  // Promoción
  @IsString()
  @IsOptional()
  sistemaPromocion?: string;

  @IsString()
  @IsOptional()
  categoriaPromocion?: string;

  @IsString()
  @IsOptional()
  fechaAltaPromocion?: string;

  @IsString()
  @IsOptional()
  registrosPromocionJson?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsUUID()
  @IsOptional()
  usuarioId?: string;
}

