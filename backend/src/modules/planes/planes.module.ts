import { Module } from '@nestjs/common';
import { ParametrosModule } from '../parametros/parametros.module';
import { PlanesEstudioController } from './planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio.service';

@Module({
  imports:     [ParametrosModule],
  controllers: [PlanesEstudioController],
  providers:   [PlanesEstudioService],
})
export class PlanesModule {}
