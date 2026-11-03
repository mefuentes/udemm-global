import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const REGEX_DOMINIO_INSTITUCIONAL = /^[^@\s]+@(udemm\.edu\.ar|docentes\.udemm\.edu\.ar)$/i;
const MSG_DOMINIO = 'Solo se permiten correos institucionales @udemm.edu.ar o @docentes.udemm.edu.ar';

export class ActualizarUsuarioDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'El nombre excede la longitud máxima de 100 caracteres.' })
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'El apellido excede la longitud máxima de 100 caracteres.' })
  apellido?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @Matches(REGEX_DOMINIO_INSTITUCIONAL, { message: MSG_DOMINIO })
  @IsOptional()
  @MaxLength(320, { message: 'El correo electrónico excede la longitud máxima permitida.' })
  correoElectronico?: string;

  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña excede la longitud máxima permitida.' })
  contrasena?: string;

  @IsUUID('4', { message: 'El identificador de rol no es válido.' })
  @IsOptional()
  rolId?: string;

  @IsUUID('4', { message: 'El identificador de carrera no es válido.' })
  @IsOptional()
  carreraId?: string;

  @IsUUID('4', { message: 'El identificador de facultad no es válido.' })
  @IsOptional()
  facultadId?: string;
}
