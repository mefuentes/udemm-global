import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearDocenteDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsString()
  @IsNotEmpty()
  tipoDocumento: string;

  @IsString()
  @IsNotEmpty()
  numeroDocumento: string;

  @IsEmail()
  @IsNotEmpty()
  correoElectronico: string;

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
