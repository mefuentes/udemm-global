import { Module } from '@nestjs/common';
import { FacultadesController } from './facultades.controller';
import { FacultadesService } from './facultades.service';

@Module({
  controllers: [FacultadesController],
  providers: [FacultadesService],
  exports: [FacultadesService]
})
export class FacultadesModule {}
