import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class ActualizarCorrelativaDto {
  @IsString()
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @IsIn(['CURSADO', 'EXAMEN'], { message: 'El tipo debe ser CURSADO o EXAMEN' })
  tipo: string;
}
