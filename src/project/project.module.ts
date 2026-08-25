import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  imports: [StorageModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
