import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [StorageModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
