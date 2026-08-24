import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SourceDatabaseService } from './source-database.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
  providers: [SyncService, SourceDatabaseService],
  exports: [SyncService],
})
export class SyncModule {}
