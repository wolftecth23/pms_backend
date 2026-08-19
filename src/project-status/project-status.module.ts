import { Module } from '@nestjs/common';
import { ProjectStatusController } from './project-status.controller';
import { ProjectStatusService } from './project-status.service';

@Module({
  controllers: [ProjectStatusController],
  providers: [ProjectStatusService],
})
export class ProjectStatusModule {}
