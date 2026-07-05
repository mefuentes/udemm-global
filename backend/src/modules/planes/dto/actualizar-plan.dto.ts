import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarPlanDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsInt()
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
}
