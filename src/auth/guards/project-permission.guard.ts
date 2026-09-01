import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { ProjectPermissionService } from '../../common/access/project-permission.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../auth.controller';
import {
  ANY_PROJECT_PERMISSIONS_KEY,
  PROJECT_PERMISSIONS_KEY,
} from '../decorators/project-permissions.decorator';

type AuthenticatedRequest = FastifyRequest & {
  user: JwtUser;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
};

@Injectable()
export class ProjectPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly projectPermissionService: ProjectPermissionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PROJECT_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_PROJECT_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (!requiredPermissions.length && !anyPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id ?? (request.user as any)?.userId;

    if (!userId) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action.',
        error: 'Forbidden',
        isAuthenticated: false,
      });
    }

    const projectId = await this.resolveProjectId(request);

    if (!projectId) {
      throw new ForbiddenException({
        message: 'Project context is required to verify permissions.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const memberPermissions =
      await this.projectPermissionService.getProjectMemberPermissions(
        userId,
        projectId,
      );

    const isSuperAdmin = memberPermissions.includes('*');

    if (requiredPermissions.length && !isSuperAdmin) {
      const hasAll = requiredPermissions.every((perm) =>
        memberPermissions.includes(perm),
      );

      if (!hasAll) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action on this project.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    if (anyPermissions.length && !isSuperAdmin) {
      const hasAny = anyPermissions.some((perm) =>
        memberPermissions.includes(perm),
      );

      if (!hasAny) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action on this project.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    return true;
  }

  private async resolveProjectId(
    request: AuthenticatedRequest,
  ): Promise<string | null> {
    const { params = {}, query = {}, body = {}, url = '' } = request;

    if (params.projectId) {
      return params.projectId;
    }

    if (query.projectId) {
      return query.projectId;
    }

    if (body && typeof body === 'object' && body.projectId) {
      return body.projectId;
    }

    if (params.id) {
      // Check if it's a project route
      if (url.includes('/projects') || url.includes('/project-member')) {
        return params.id;
      }

      // If it's a task route (/tasks/:id)
      if (url.includes('/tasks')) {
        const task = await this.prisma.task.findUnique({
          where: { id: params.id },
          select: { projectId: true },
        });
        return task?.projectId ?? null;
      }
    }

    if (params.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: params.taskId },
        select: { projectId: true },
      });
      return task?.projectId ?? null;
    }

    if (params.commentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: params.commentId },
        select: {
          task: {
            select: { projectId: true },
          },
        },
      });
      return comment?.task?.projectId ?? null;
    }

    if (body && typeof body === 'object' && body.taskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: body.taskId },
        select: { projectId: true },
      });
      return task?.projectId ?? null;
    }

    return null;
  }
}

