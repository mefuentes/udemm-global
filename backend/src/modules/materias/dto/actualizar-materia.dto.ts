import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarMateriaDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  creditos?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  cargaHorariaSemanal?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  cargaHorariaTotal?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  anio?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  cuatrimestre?: number;

  @IsOptional()
  @IsString()
  bloqueConocimiento?: string;

  @IsOptional()
  @IsString()
  @IsIn(['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA'])
  tipoAsignatura?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENCIAL', 'VIRTUAL', 'MIXTA'])
  modalidadDictado?: string;

  @IsOptional()
  @IsString()
  regimenCursado?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
