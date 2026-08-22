import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectStatusModule } from './project-status/project-status.module';
import { ProjectModule } from './project/project.module';
import { SyncModule } from './sync/sync.module';
import { TaskModule } from './task/task.module';
import { TimeEntryModule } from './time-entry/time-entry.module';
import { WorkspaceMemberModule } from './workspace-member/workspace-member.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),

    PrismaModule,
    CommonModule,
    ProjectModule,
    TaskModule,
    TimeEntryModule,
    AuthModule,
    SyncModule,
    ProjectMemberModule,
    ProjectStatusModule,
    WorkspaceMemberModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
