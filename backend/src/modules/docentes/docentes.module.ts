import { Module } from '@nestjs/common';
import { DocentesController } from './docentes.controller';
import { DocentesService } from './docentes.service';
import { CargosDocenteService } from './cargos-docente.service';
import { ScopeModule } from '../scopes/scope.module';

@Module({
  imports: [ScopeModule],
  controllers: [DocentesController],
  providers: [DocentesService, CargosDocenteService],
  exports: [DocentesService, CargosDocenteService],
})
export class DocentesModule {}
