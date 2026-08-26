import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RestablecerContrasenaDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio.' })
  @MaxLength(256, { message: 'El token excede la longitud máxima permitida.' })
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128, { message: 'La contraseña excede la longitud máxima permitida.' })
  nuevaContrasena: string;
}
