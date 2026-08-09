import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CrearSubareaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsUUID()
  @IsNotEmpty({ message: 'El área disciplinar es obligatoria' })
  areaDisciplinarId: string;
}
