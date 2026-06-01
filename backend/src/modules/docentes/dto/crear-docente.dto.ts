import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches
} from 'class-validator';

const SOLO_CARACTERES_REGEX = /^[A-Za-z\s' -]+$/;
const SOLO_NUMEROS_REGEX = /^\d+$/;
const FECHA_YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DOCUMENTO_REGEX = /^\d+$|^[A-Za-z0-9-]+$/;

export class CrearDocenteDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Matches(SOLO_CARACTERES_REGEX, { message: 'El nombre solo puede contener letras' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @Matches(SOLO_CARACTERES_REGEX, { message: 'El apellido solo puede contener letras' })
  apellido: string;

  @IsString()
  @IsNotEmpty({ message: 'El tipo de documento es obligatorio' })
  @IsIn(['DNI', 'PASAPORTE'], { message: 'El tipo de documento debe ser DNI o PASAPORTE' })
  tipoDocumento: 'DNI' | 'PASAPORTE';

  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @Matches(DOCUMENTO_REGEX, { message: 'El número de documento tiene un formato inválido' })
  numeroDocumento: string;

  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correoElectronico: string;

  @IsString()
  @IsOptional()
  @Matches(SOLO_NUMEROS_REGEX, { message: 'El teléfono solo puede contener números' })
  telefono?: string;

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
  justificacionPertinencia?: string;

  @IsString()
  @IsOptional()
  actividadesProfesionales?: string;

  @IsString()
  @IsOptional()
  antecedentesAcademicos?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsUUID()
  @IsOptional()
  usuarioId?: string;
}

