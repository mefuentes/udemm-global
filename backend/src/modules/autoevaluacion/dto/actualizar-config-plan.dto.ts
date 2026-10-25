import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO para configurar los umbrales horarios y la formación práctica de un Plan de Estudio.
 * Solo ADMINISTRADOR_SISTEMA puede enviar este DTO.
 * NULL en cada campo significa "sin umbral configurado" → el evaluador correspondiente
 * no puede verificar ese aspecto.
 * Enviar null explícitamente borra la configuración. Enviar undefined la deja sin cambios.
 */
export class ActualizarConfigPlanDto {
  @IsOptional()
  @IsInt({ message: 'horasMinTotales debe ser un entero' })
  @Min(0, { message: 'horasMinTotales debe ser 0 o mayor' })
  horasMinTotales?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinCB debe ser un entero' })
  @Min(0, { message: 'horasMinCB debe ser 0 o mayor' })
  horasMinCB?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinTB debe ser un entero' })
  @Min(0, { message: 'horasMinTB debe ser 0 o mayor' })
  horasMinTB?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinTA debe ser un entero' })
  @Min(0, { message: 'horasMinTA debe ser 0 o mayor' })
  horasMinTA?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinCTX debe ser un entero' })
  @Min(0, { message: 'horasMinCTX debe ser 0 o mayor' })
  horasMinCTX?: number | null;

  // ── R-13: configuración de formación práctica (FSD §6.3) ────────────────────

  /** null = borrar (no configurado); true = PPS requerida; false = explícitamente no requerida */
  @IsOptional()
  @IsBoolean({ message: 'requierePPS debe ser booleano o null' })
  requierePPS?: boolean | null;

  /** null = borrar (no configurado); true = PI requerido; false = explícitamente no requerido */
  @IsOptional()
  @IsBoolean({ message: 'requierePI debe ser booleano o null' })
  requierePI?: boolean | null;

  /** null = borrar (no configurado); 0–100 = porcentaje mínimo de horas prácticas */
  @IsOptional()
  @IsInt({ message: 'porcentajeMinFormacion debe ser un entero' })
  @Min(0, { message: 'porcentajeMinFormacion debe ser 0 o mayor' })
  @Max(100, { message: 'porcentajeMinFormacion no puede superar 100' })
  porcentajeMinFormacion?: number | null;
}
