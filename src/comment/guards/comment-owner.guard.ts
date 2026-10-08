import {
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
export class CommentOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GuardRequest>();
    const params = req.params as Record<string, string | undefined> | undefined;
    const commentId = params?.commentId;
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!commentId) {
      return true;
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this comment.',
      );
    }

    return true;
  }
}
