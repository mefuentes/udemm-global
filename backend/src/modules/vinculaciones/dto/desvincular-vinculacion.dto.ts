import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class DesvincularVinculacionDto {
  @IsString()
  @IsNotEmpty({ message: 'La fecha de desvinculación es obligatoria' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  fechaDesvinculacion: string;

  @IsString()
  @IsNotEmpty({ message: 'El motivo de desvinculación es obligatorio' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(2000, { message: 'El motivo no puede superar los 2000 caracteres' })
  motivoDesvinculacion: string;
}
