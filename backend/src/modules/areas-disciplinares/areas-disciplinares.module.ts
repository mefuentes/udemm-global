import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AreasDisiplinaresController } from './areas-disciplinares.controller';
import { AreasDisiplinaresService } from './areas-disciplinares.service';

@Module({
  imports: [PrismaModule],
  controllers: [AreasDisiplinaresController],
  providers: [AreasDisiplinaresService],
  exports: [AreasDisiplinaresService],
})
export class AreasDisiplinaresModule {}
