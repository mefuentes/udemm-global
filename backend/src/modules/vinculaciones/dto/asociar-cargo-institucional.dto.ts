import { isUUID, registerDecorator, ValidationOptions } from 'class-validator';

function IsNullOrUuid(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isNullOrUuid',
      target: (object as any).constructor,
      propertyName: propertyName as string,
      options: {
        message: `${String(propertyName)} debe ser null o un UUID válido`,
        ...options,
      },
      validator: {
        validate(value: unknown): boolean {
          if (value === null) return true;
          if (typeof value !== 'string') return false;
          return isUUID(value);
        },
      },
    });
  };
}

export class AsociarCargoInstitucionalDto {
  // null → desasociar; UUID → asociar/reasignar; ausente o tipo incorrecto → 400
  @IsNullOrUuid()
  cargoDocenteId: string | null;
}
