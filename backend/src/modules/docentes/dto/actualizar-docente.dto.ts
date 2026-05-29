import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class ActualizarDocenteDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  apellido?: string;

  @IsString()
  @IsOptional()
  tipoDocumento?: string;

  @IsString()
  @IsOptional()
  numeroDocumento?: string;

  @IsEmail()
  @IsOptional()
  correoElectronico?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  domicilio?: string;

  @IsString()
  @IsOptional()
  tituloGrado?: string;

  @IsString()
  @IsOptional()
  tituloPosgrado?: string;

  @IsString()
  @IsOptional()
  cargoDeclarado?: string;

  @IsString()
  @IsOptional()
  justificacionPertinencia?: string;

  @IsString()
  @IsOptional()
  actividadesProfesionales?: string;

  @IsString()
  @IsOptional()
  antecedentesAcademicos?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsUUID()
  @IsOptional()
  usuarioId?: string;
}
