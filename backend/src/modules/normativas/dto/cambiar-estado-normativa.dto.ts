import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CambiarEstadoNormativaDto {
  @IsIn(['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'])
  @IsNotEmpty()
  vigencia: string;

  @IsString()
  @IsNotEmpty()
  motivo: string;

  @IsUUID('4')
  @IsOptional()
  normativaSucesoraId?: string;
}
