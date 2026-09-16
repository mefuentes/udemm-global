import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScopeModule } from '../scopes/scope.module';
import { ProgramasController } from './programas.controller';
import { ProgramasService } from './programas.service';

@Module({
  imports: [PrismaModule, ScopeModule],
  controllers: [ProgramasController],
  providers: [ProgramasService],
})
export class ProgramasModule {}
