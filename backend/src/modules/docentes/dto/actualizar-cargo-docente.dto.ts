import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class ActualizarCargoDocenteDto {
  @IsOptional()
  @IsString()
  designacion?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  verificado?: boolean;
}
