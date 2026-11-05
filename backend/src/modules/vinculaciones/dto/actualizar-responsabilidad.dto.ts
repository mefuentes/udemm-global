import { IsBoolean, IsOptional } from 'class-validator';

export class ActualizarResponsabilidadDto {
  @IsOptional()
  @IsBoolean()
  esResponsableCatedra?: boolean | null;
}
