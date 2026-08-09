import { IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarPlanDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(9999)
  @Type(() => Number)
  anio?: number;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVO', 'INACTIVO', 'EN_REVISION'])
  estado?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  duracionCuatrimestres?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  totalCreditos?: number;

  @IsOptional()
  @IsString()
  resolucionAprobacion?: string;
}
