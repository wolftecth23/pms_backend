import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommentController } from './comment.controller';
import { CommentScheduler } from './comment.scheduler';
import { CommentService } from './comment.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [CommentController],
  providers: [CommentService, CommentScheduler],
  exports: [CommentService],
})
export class CommentModule {}
