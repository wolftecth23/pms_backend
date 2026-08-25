import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CommentService } from './comment.service';

@Injectable()
export class CommentScheduler {
  private readonly logger = new Logger(CommentScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commentService: CommentService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledComments() {
    try {
      const dueComments = await this.prisma.comment.findMany({
        where: {
          scheduleStatus: 'pending',
          scheduledFor: { lte: new Date() },
        },
        select: { id: true },
      });

      if (dueComments.length === 0) {
        return;
      }

      for (const comment of dueComments) {
        await this.commentService.publishComment(comment.id);
      }

      this.logger.log(`Published ${dueComments.length} scheduled comment(s).`);
    } catch (error) {
      this.logger.error('Error publishing scheduled comments:', error);
    }
  }
}
