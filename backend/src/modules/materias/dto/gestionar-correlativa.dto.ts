import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class GestionarCorrelativaDto {
  @IsString()
  @IsNotEmpty({ message: 'El ID de la correlativa es obligatorio' })
  correlativaId: string;

  @IsOptional()
  @IsString()
  @IsIn(['CURSADO', 'EXAMEN'], { message: 'El tipo debe ser CURSADO o EXAMEN' })
  tipo?: string;
}
