import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsEmail()
  correoElectronico: string;

  @IsString()
  @MinLength(8)
  contrasena: string;

  @IsString()
  @IsNotEmpty()
  rolId: string;
}
