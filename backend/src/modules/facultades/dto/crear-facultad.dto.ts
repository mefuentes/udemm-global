import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';

export class CrearFacultadDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: string;

  @IsString()
  @IsNotEmpty()
  universidadId: string;
}
