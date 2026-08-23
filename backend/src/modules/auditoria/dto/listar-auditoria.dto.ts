import { IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const ACCIONES_VALIDAS = [
  'CARGA', 'EDICION', 'CAMBIO_ESTADO', 'ELIMINACION_LOGICA',
  'VER_DOCUMENTO', 'DESCARGA_PDF', 'ACCESO_DENEGADO', 'EXPORTACION',
] as const;

export class ListarAuditoriaDto {
  @IsIn(ACCIONES_VALIDAS)
  @IsOptional()
  accion?: string;

  @IsString()
  @IsOptional()
  busqueda?: string;

  @Matches(FECHA_RE, { message: 'fechaDesde debe tener formato YYYY-MM-DD' })
  @IsOptional()
  fechaDesde?: string;

  @Matches(FECHA_RE, { message: 'fechaHasta debe tener formato YYYY-MM-DD' })
  @IsOptional()
  fechaHasta?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
