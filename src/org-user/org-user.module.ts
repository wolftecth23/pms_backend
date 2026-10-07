import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrgUserController } from './org-user.controller';
import { OrgUserService } from './org-user.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [OrgUserController],
  providers: [OrgUserService],
  exports: [OrgUserService],
})
export class OrgUserModule {}
