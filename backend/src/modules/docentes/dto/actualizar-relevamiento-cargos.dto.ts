import { IsBoolean } from 'class-validator';

export class ActualizarRelevamientoCargosDto {
  @IsBoolean()
  relevamientoCargosCompleto: boolean;
}
