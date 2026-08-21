import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NormativasController } from './normativas.controller';
import { NormativasService } from './normativas.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [NormativasController],
  providers: [NormativasService],
  exports: [NormativasService],
})
export class NormativasModule {}
