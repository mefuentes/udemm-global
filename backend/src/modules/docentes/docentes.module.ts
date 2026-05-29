import { Module } from '@nestjs/common';
import { DocentesController } from './docentes.controller';
import { DocentesService } from './docentes.service';

@Module({
  imports: [],
  controllers: [DocentesController],
  providers: [DocentesService]
})
export class DocentesModule {}
