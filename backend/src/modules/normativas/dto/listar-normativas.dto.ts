import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ListarNormativasDto {
  @IsString()
  @IsOptional()
  busqueda?: string;

  @IsString()
  @IsOptional()
  areaEmisora?: string;

  @IsString()
  @IsOptional()
  tipoId?: string;

  @IsString()
  @IsOptional()
  vigencia?: string;

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
