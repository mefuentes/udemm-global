import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class SolicitarRecuperacionDto {
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @MaxLength(320, { message: 'El correo electrónico excede la longitud máxima permitida.' })
  correoElectronico: string;
}
