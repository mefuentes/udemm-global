import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarTablaMaestraDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;
}
