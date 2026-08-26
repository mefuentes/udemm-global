import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El refresh token es obligatorio.' })
  @MaxLength(512, { message: 'El refresh token excede la longitud máxima permitida.' })
  refreshToken: string;
}
