import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SourceDatabaseService } from './source-database.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
  providers: [SyncService, SourceDatabaseService],
  exports: [SyncService],
})
export class SyncModule {}
