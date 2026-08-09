import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FiltrarVinculacionesDto {
  @IsOptional() @IsString()  buscar?: string;
  @IsOptional() @IsString()  estado?: string;
  @IsOptional() @IsUUID()    facultadId?: string;
  @IsOptional() @IsUUID()    carreraId?: string;
  @IsOptional() @IsUUID()    planEstudioId?: string;
  @IsOptional() @IsUUID()    materiaId?: string;
  @IsOptional() @IsUUID()    docenteId?: string;
}
