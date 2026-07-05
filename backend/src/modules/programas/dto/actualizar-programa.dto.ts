import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarProgramaDto {
  // S1
  @IsOptional() @IsString() equipoDocente?: string;
  @IsOptional() @IsString() elaboradoPor?: string;
  @IsOptional() @IsInt() @Type(() => Number) anioVigencia?: number;

  // S2
  @IsOptional() @IsString() fundamentacion?: string;
  @IsOptional() @IsString() propositos?: string;
  @IsOptional() @IsString() objetivosGenerales?: string;
  @IsOptional() @IsString() objetivosEspecificos?: string;

  // S3
  @IsOptional() @IsString() contenidosSinteticos?: string;
  @IsOptional() @IsString() contenidosTematicos?: string;
  @IsOptional() @IsString() bibliografiaBasica?: string;
  @IsOptional() @IsString() bibliografiaComplementaria?: string;
  @IsOptional() @IsString() recursosDidacticos?: string;

  // S4
  @IsOptional() @IsString() metodologiaEnsenanza?: string;
  @IsOptional() @IsString() tiposFormacionPractica?: string;
  @IsOptional() @IsString() porcentajeTiempoFormacion?: string;
  @IsOptional() @IsString() actividadesPracticas?: string;
  @IsOptional() @IsString() cronograma?: string;

  // S5
  @IsOptional() @IsString() modalidadEvaluacion?: string;
  @IsOptional() @IsString() requisitosAprobacion?: string;
  @IsOptional() @IsString() criteriosEvaluacion?: string;
  @IsOptional() @IsString() instrumentosEvaluacion?: string;
  @IsOptional() @IsString() condicionesAprobacion?: string;

  // S6
  @IsOptional() @IsInt() @Type(() => Number) fechaVigenciaPrograma?: number;
  @IsOptional() @IsString() anioAprobacionRevision?: string;
  @IsOptional() @IsString() profesorACargo?: string;
  @IsOptional() @IsString() competenciasVinculadas?: string;
  @IsOptional() @IsString() fechaUltimaActualizacion?: string;
  @IsOptional() @IsString() observacionesGestion?: string;
  @IsOptional() @IsIn(['BORRADOR', 'EN_REVISION', 'APROBADO']) estadoPrograma?: string;
  @IsOptional() @IsDateString() fechaAprobacion?: string;
  @IsOptional() @IsString() resolucionAprobacion?: string;
  @IsOptional() @IsString() observacionesGenerales?: string;
  @IsOptional() @IsInt() @Type(() => Number) vigenciaDesde?: number;
  @IsOptional() @IsInt() @Type(() => Number) vigenciaHasta?: number;

  // Estado de sección
  @IsOptional() @IsIn(['PENDIENTE', 'COMPLETO']) estadoS1?: string;
  @IsOptional() @IsIn(['PENDIENTE', 'COMPLETO']) estadoS2?: string;
  @IsOptional() @IsIn(['PENDIENTE', 'COMPLETO']) estadoS3?: string;
  @IsOptional() @IsIn(['PENDIENTE', 'COMPLETO']) estadoS4?: string;
  @IsOptional() @IsIn(['PENDIENTE', 'COMPLETO']) estadoS5?: string;
  @IsOptional() @IsIn(['PENDIENTE', 'COMPLETO']) estadoS6?: string;

  // Meta (no se persiste)
  @IsOptional() @IsString() seccionModificada?: string;
}
