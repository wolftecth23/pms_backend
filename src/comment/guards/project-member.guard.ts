import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtUser } from '../../auth/auth.controller';
import { PrismaService } from '../../prisma/prisma.service';

interface GuardRequest extends FastifyRequest {
  user?: JwtUser;
}

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GuardRequest>();
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    const params = req.params as Record<string, string | undefined> | undefined;
    const body = req.body as Record<string, unknown> | undefined;

    let projectId: string | undefined;

    if (params?.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: params.taskId },
        select: { projectId: true },
      });
      if (!task) {
        throw new NotFoundException('Task not found.');
      }
      projectId = task.projectId;
    } else if (params?.commentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: params.commentId },
        include: { task: { select: { projectId: true } } },
      });
      if (!comment) {
        throw new NotFoundException('Comment not found.');
      }
      projectId = comment.task.projectId;
    } else if (typeof body?.taskId === 'string') {
      projectId = body.taskId;
    }

    if (!projectId) {
      throw new BadRequestException('Unable to determine project context.');
    }

    if (!userId) {
      throw new ForbiddenException({
        message: 'User authentication required.',
        error: 'Forbidden',
      });
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
