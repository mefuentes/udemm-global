import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProgramasController } from './programas.controller';
import { ProgramasService } from './programas.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProgramasController],
  providers: [ProgramasService],
})
export class ProgramasModule {}
