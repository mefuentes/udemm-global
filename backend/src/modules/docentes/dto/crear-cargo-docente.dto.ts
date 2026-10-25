import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearCargoDocenteDto {
  @IsUUID()
  cargoId: string;

  @IsOptional()
  @IsString()
  designacion?: string;

  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
