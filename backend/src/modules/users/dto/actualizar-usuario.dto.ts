import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class ActualizarUsuarioDto {
  @IsString() @IsOptional() nombre?: string;
  @IsString() @IsOptional() apellido?: string;
  @IsEmail() @IsOptional() correoElectronico?: string;
  @IsString() @IsOptional() @MinLength(8) contrasena?: string;
  @IsUUID() @IsOptional() rolId?: string;
}
