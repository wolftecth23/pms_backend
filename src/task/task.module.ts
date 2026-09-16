import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { TaskActivityService } from './task-activity.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [StorageModule],
  controllers: [TaskController],
  providers: [TaskService, TaskActivityService],
  exports: [TaskService, TaskActivityService],
})
export class TaskModule {}
