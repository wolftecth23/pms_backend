import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    let projectId: string | undefined;

    if (req.params.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: req.params.taskId },
        select: { projectId: true },
      });
      if (!task) {
        throw new NotFoundException('Task not found.');
      }
      projectId = task.projectId;
    } else if (req.params.commentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: req.params.commentId },
        include: { task: { select: { projectId: true } } },
      });
      if (!comment) {
        throw new NotFoundException('Comment not found.');
      }
      projectId = comment.task.projectId;
    } else if (req.body?.taskId) {
      projectId = req.body.taskId;
    }

    if (!projectId) {
      throw new BadRequestException('Unable to determine project context.');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!member || member.removedAt) {
      throw new ForbiddenException(
        'You are not an active member of this project.',
      );
    }

    return true;
  }
}
