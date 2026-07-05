import { IsString, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarCarreraDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  facultadId?: string;

  @IsOptional()
  @IsString()
  tituloOtorgado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duracionAnios?: number;

  @IsOptional()
  @IsString()
  @IsIn(['Presencial', 'Virtual', 'A distancia', 'Híbrida'])
  modalidad?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: string;
}
