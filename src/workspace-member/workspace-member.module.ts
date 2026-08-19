import { Module } from '@nestjs/common';
import { WorkspaceMemberController } from './workspace-member.controller';
import { WorkspaceMemberService } from './workspace-member.service';

@Module({
  controllers: [WorkspaceMemberController],
  providers: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
