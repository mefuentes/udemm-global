import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RechazarVinculacionDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(1000)
  motivo: string;
}
