import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ActualizarSubareaDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsUUID()
  @IsOptional()
  areaDisciplinarId?: string;
}
