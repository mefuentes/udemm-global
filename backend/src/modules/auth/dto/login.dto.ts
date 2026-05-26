import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  correoElectronico: string;

  @IsString()
  @MinLength(8)
  contrasena: string;
}
