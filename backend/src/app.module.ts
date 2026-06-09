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
    ParametrosModule
  ],
  controllers: [],
  providers: []
})
export class AppModule {}
