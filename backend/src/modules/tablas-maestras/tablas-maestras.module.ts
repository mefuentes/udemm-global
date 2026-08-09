import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TablasMaestrasController } from './tablas-maestras.controller';
import { TablasMaestrasService } from './tablas-maestras.service';

@Module({
  imports: [PrismaModule],
  controllers: [TablasMaestrasController],
  providers: [TablasMaestrasService],
  exports: [TablasMaestrasService],
})
export class TablasMaestrasModule {}
