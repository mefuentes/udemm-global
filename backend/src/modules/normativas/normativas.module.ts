import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ParametrosModule } from '../parametros/parametros.module';
import { NormativasController } from './normativas.controller';
import { NormativasService } from './normativas.service';
import { NormativasExportService } from './normativas-export.service';

@Module({
  imports:     [PrismaModule, StorageModule, AuditoriaModule, ParametrosModule],
  controllers: [NormativasController],
  providers:   [NormativasService, NormativasExportService],
  exports:     [NormativasService],
})
export class NormativasModule {}
