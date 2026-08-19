import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { ProjectMemberController } from './project-member.controller';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [ProjectModule],
  controllers: [ProjectMemberController],
  providers: [ProjectMemberService],
})
export class ProjectMemberModule {}
