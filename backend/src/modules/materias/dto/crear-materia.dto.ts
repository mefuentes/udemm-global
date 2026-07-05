import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearMateriaDto {
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  codigo: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El plan de estudios es obligatorio' })
  planEstudioId: string;

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
