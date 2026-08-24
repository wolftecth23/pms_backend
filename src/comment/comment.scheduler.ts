import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentScheduler {
  private readonly logger = new Logger(CommentScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

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

      const ids = dueComments.map((c) => c.id);

      await this.prisma.comment.updateMany({
        where: { id: { in: ids } },
        data: { scheduleStatus: 'sent' },
      });

      this.logger.log(`Published ${ids.length} scheduled comment(s).`);
    } catch (error) {
      this.logger.error('Error publishing scheduled comments:', error);
    }
  }
}
