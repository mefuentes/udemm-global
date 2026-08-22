import { IsNotEmpty, IsString } from 'class-validator';

export class EliminarNormativaDto {
  @IsString()
  @IsNotEmpty({ message: 'ERROR: DEBE ESPECIFICAR UN MOTIVO VÁLIDO PARA PROCEDER CON LA ELIMINACIÓN LÓGICA.' })
  motivo: string;
}
