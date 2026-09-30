import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StorageModule } from '../common/storage/storage.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChangeRequestController } from './change-request.controller';
import { ChangeRequestService } from './change-request.service';
import { CRActivityService } from './cr-activity.service';

@Module({
  imports: [PrismaModule, CommonModule, StorageModule, EmailModule],
  controllers: [ChangeRequestController],
  providers: [ChangeRequestService, CRActivityService],
  exports: [ChangeRequestService, CRActivityService],
})
export class ChangeRequestModule {}
