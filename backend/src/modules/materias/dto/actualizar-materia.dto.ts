import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Transforma null explícito en null (sin aplicar Number(null) = 0)
const ToIntOrNull = () =>
  Transform(({ value }) => (value === null || value === undefined ? null : parseInt(value, 10)));

export class ActualizarMateriaDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsInt()
  @ToIntOrNull()
  creditos?: number | null;

  @IsOptional()
  @IsInt()
  @ToIntOrNull()
  cargaHorariaSemanal?: number | null;

  @IsOptional()
  @IsInt()
  @ToIntOrNull()
  cargaHorariaTotal?: number | null;

  @IsOptional()
  @IsInt()
  @ToIntOrNull()
  anio?: number | null;

  @IsOptional()
  @IsInt()
  @ToIntOrNull()
  cuatrimestre?: number | null;

  @IsOptional()
  @IsString()
  bloqueConocimiento?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA'])
  tipoAsignatura?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PRESENCIAL', 'VIRTUAL', 'MIXTA'])
  modalidadDictado?: string | null;

  @IsOptional()
  @IsString()
  regimenCursado?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: string;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
