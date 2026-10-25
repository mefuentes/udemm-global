import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScopeModule } from '../scopes/scope.module';
import { AutoevaluacionController } from './autoevaluacion.controller';
import { ConfigFacultadService } from './config/config-facultad.service';
import { ConfigPlanService } from './config/config-plan.service';
import { ConsultasAcademicasService } from './consultas-academicas/consultas-academicas.service';
import { IndicadoresService } from './indicadores/indicadores.service';
import { RegistroIndicadores } from './indicadores/indicadores.registry';
import { R02EvaluadorService } from './indicadores/r02.evaluador';
import { R06EvaluadorService } from './indicadores/r06.evaluador';
import { R07EvaluadorService } from './indicadores/r07.evaluador';
import { R08EvaluadorService } from './indicadores/r08.evaluador';
import { R09EvaluadorService } from './indicadores/r09.evaluador';
import { R10EvaluadorService } from './indicadores/r10.evaluador';
import { R15EvaluadorService } from './indicadores/r15.evaluador';
import { IP09EvaluadorService } from './indicadores/ip09.evaluador';
import { IP10EvaluadorService } from './indicadores/ip10.evaluador';
import { R03EvaluadorService } from './indicadores/r03.evaluador';
import { R04EvaluadorService } from './indicadores/r04.evaluador';
import { R11EvaluadorService } from './indicadores/r11.evaluador';
import { R12EvaluadorService } from './indicadores/r12.evaluador';
import { R13EvaluadorService } from './indicadores/r13.evaluador';
import { R14EvaluadorService } from './indicadores/r14.evaluador';
import { ResponsablesService } from './responsables/responsables.service';
import { TablroPlanService } from './tablero/tablero-plan.service';
import { TablroCarreraService } from './tablero/tablero-carrera.service';
import { TablroFacultadService } from './tablero/tablero-facultad.service';
import { AnalisisService } from './analisis/analisis.service';
import { AlertasService } from './alertas/alertas.service';
import { ExportacionesService } from './exportaciones/exportaciones.service';
import { FichaDocenteService } from './ficha-docente/ficha-docente.service';
import { ReglasCatalogoService } from './reglas/reglas-catalogo.service';

@Module({
  imports: [PrismaModule, ScopeModule],
  controllers: [AutoevaluacionController],
  providers: [
    ConfigFacultadService,
    ConfigPlanService,
    ResponsablesService,
    ConsultasAcademicasService,
    RegistroIndicadores,
    R02EvaluadorService,
    R03EvaluadorService,
    R04EvaluadorService,
    R06EvaluadorService,
    R07EvaluadorService,
    R08EvaluadorService,
    R09EvaluadorService,
    R10EvaluadorService,
    R11EvaluadorService,
    R12EvaluadorService,
    R13EvaluadorService,
    R14EvaluadorService,
    R15EvaluadorService,
    IP09EvaluadorService,
    IP10EvaluadorService,
    IndicadoresService,
    TablroPlanService,
    TablroCarreraService,
    TablroFacultadService,
    AnalisisService,
    AlertasService,
    ExportacionesService,
    FichaDocenteService,
    ReglasCatalogoService,
  ],
  exports: [
    ConfigFacultadService,
    ConfigPlanService,
    ResponsablesService,
    ConsultasAcademicasService,
    RegistroIndicadores,
    R02EvaluadorService,
    R03EvaluadorService,
    R04EvaluadorService,
    R06EvaluadorService,
    R07EvaluadorService,
    R08EvaluadorService,
    R09EvaluadorService,
    R10EvaluadorService,
    R11EvaluadorService,
    R12EvaluadorService,
    R13EvaluadorService,
    R14EvaluadorService,
    R15EvaluadorService,
    IP09EvaluadorService,
    IP10EvaluadorService,
    IndicadoresService,
    TablroPlanService,
    TablroCarreraService,
    TablroFacultadService,
    AnalisisService,
    AlertasService,
    ExportacionesService,
    FichaDocenteService,
    ReglasCatalogoService,
  ],
})
export class AutoevaluacionModule {}
