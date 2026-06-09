import { IsOptional, IsString, MinLength } from 'class-validator';

export class CrearRolDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
}
