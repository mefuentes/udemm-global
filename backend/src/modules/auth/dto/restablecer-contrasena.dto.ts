import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RestablecerContrasenaDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  nuevaContrasena: string;
}
