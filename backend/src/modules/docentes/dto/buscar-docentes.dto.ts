import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BuscarDocentesDto {
  @IsString()
  @IsOptional()
  buscar?: string;

  @IsString()
  @IsOptional()
  busqueda?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  pagina?: number;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  limite?: number;

  @IsOptional()
  activo?: string;
}
