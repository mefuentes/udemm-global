import { IsOptional, IsString, MinLength } from 'class-validator';

export class ActualizarRolDto {
  @IsString() @IsOptional() @MinLength(2) nombre?: string;
  @IsString() @IsOptional() descripcion?: string;
}
