import { IsString, IsOptional, IsNotEmpty, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearCarreraDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  facultadId: string;

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
