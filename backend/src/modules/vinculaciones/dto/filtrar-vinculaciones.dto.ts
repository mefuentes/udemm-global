import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FiltrarVinculacionesDto {
  @IsOptional() @IsString()  buscar?: string;
  @IsOptional() @IsString()  estado?: string;
  @IsOptional() @IsUUID()    facultadId?: string;
  @IsOptional() @IsUUID()    carreraId?: string;
  @IsOptional() @IsUUID()    planEstudioId?: string;
  @IsOptional() @IsUUID()    materiaId?: string;
  @IsOptional() @IsUUID()    docenteId?: string;

  @IsInt() @Min(1) @Type(() => Number) @IsOptional()
  page?: number;

  @IsInt() @Min(1) @Type(() => Number) @IsOptional()
  limit?: number;
}
