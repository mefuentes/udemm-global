import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CrearVinculacionDto {
  @IsUUID() facultadId: string;
  @IsUUID() carreraId: string;
  @IsUUID() planEstudioId: string;
  @IsUUID() materiaId: string;
  @IsUUID() docenteId: string;
  @IsUUID() catedraId: string;
  @IsUUID() cargoId: string;
  @IsUUID() modalidadId: string;
  @IsUUID() designacionId: string;

  @Type(() => Number)
  @IsInt({ message: 'El año de inicio debe ser un número entero' })
  @Min(1900, { message: 'El año de inicio no es válido' })
  @Max(2100, { message: 'El año de inicio no es válido' })
  anioInicio: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
