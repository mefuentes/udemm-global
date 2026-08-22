import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NormativasController } from './normativas.controller';
import { NormativasService } from './normativas.service';

@Module({
  imports:     [PrismaModule, StorageModule, AuditoriaModule],
  controllers: [NormativasController],
  providers:   [NormativasService],
  exports:     [NormativasService],
})
export class NormativasModule {}
