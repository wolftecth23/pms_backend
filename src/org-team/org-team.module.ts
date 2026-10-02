import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrgTeamController } from './org-team.controller';
import { OrgTeamService } from './org-team.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrgTeamController],
  providers: [OrgTeamService],
  exports: [OrgTeamService],
})
export class OrgTeamModule {}
