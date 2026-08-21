import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DocentesModule } from './modules/docentes/docentes.module';
import { MateriasModule } from './modules/materias/materias.module';
import { PlanesModule } from './modules/planes/planes.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { ParametrosModule } from './modules/parametros/parametros.module';
import { FacultadesModule } from './modules/facultades/facultades.module';
import { CarrerasModule } from './modules/carreras/carreras.module';
import { ProgramasModule } from './modules/programas/programas.module';
import { TablasMaestrasModule } from './modules/tablas-maestras/tablas-maestras.module';
import { VinculacionesModule } from './modules/vinculaciones/vinculaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { AreasDisiplinaresModule } from './modules/areas-disciplinares/areas-disciplinares.module';
import { NormativasModule } from './modules/normativas/normativas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    DocentesModule,
    MateriasModule,
    PlanesModule,
    DocumentosModule,
    ParametrosModule,
    FacultadesModule,
    CarrerasModule,
    ProgramasModule,
    TablasMaestrasModule,
    VinculacionesModule,
    NotificacionesModule,
    AreasDisiplinaresModule,
    NormativasModule,
  ],
  controllers: [],
  providers: []
})
export class AppModule {}
