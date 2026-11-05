import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScopeModule } from '../scopes/scope.module';
import { VinculacionesController } from './vinculaciones.controller';
import { VinculacionesService } from './vinculaciones.service';

@Module({
  imports: [PrismaModule, ScopeModule],
  controllers: [VinculacionesController],
  providers: [VinculacionesService],
  exports: [VinculacionesService],
})
export class VinculacionesModule {}
