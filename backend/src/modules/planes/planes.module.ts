import { Module } from '@nestjs/common';
import { PlanesEstudioController } from './planes-estudio.controller';
import { PlanesEstudioService } from './planes-estudio.service';

@Module({
  controllers: [PlanesEstudioController],
  providers: [PlanesEstudioService]
})
export class PlanesModule {}
