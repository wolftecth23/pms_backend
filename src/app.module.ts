import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommentModule } from './comment/comment.module';
import { CommonModule } from './common/common.module';
import { EmailModule } from './email/email.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectStatusModule } from './project-status/project-status.module';
import { ProjectModule } from './project/project.module';
import { SyncModule } from './sync/sync.module';
import { TagModule } from './tag/tag.module';
import { TaskModule } from './task/task.module';
import { WorkspaceMemberModule } from './workspace-member/workspace-member.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),

    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    EmailModule,
    ProjectModule,
    TaskModule,
    CommentModule,
    AuthModule,
    SyncModule,
    ProjectMemberModule,
    ProjectStatusModule,
    WorkspaceMemberModule,
    TagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
