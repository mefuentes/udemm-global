import { Module } from '@nestjs/common';
import { ParametrosModule } from '../parametros/parametros.module';
import { AutoevaluacionModule } from '../autoevaluacion/autoevaluacion.module';
import { PlanesEstudioController } from './planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio.service';
import { IndicesPlanService } from './indices-plan.service';

@Module({
  imports:     [ParametrosModule, AutoevaluacionModule],
  controllers: [PlanesEstudioController],
  providers:   [PlanesEstudioService, IndicesPlanService],
})
export class PlanesModule {}
