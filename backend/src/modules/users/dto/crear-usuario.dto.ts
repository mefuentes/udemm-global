import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(100, { message: 'El nombre excede la longitud máxima de 100 caracteres.' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  @MaxLength(100, { message: 'El apellido excede la longitud máxima de 100 caracteres.' })
  apellido: string;

  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @MaxLength(320, { message: 'El correo electrónico excede la longitud máxima permitida.' })
  correoElectronico: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña excede la longitud máxima permitida.' })
  contrasena: string;

  @IsUUID('4', { message: 'El identificador de rol no es válido.' })
  @IsNotEmpty({ message: 'El rol es obligatorio.' })
  rolId: string;
}
