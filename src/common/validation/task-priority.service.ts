import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StatusScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskPriorityServiceValidation {
  constructor(private readonly prisma: PrismaService) {}

  async validateTaskPriority(
    priorityId: string,
    organizationId: string,
    workspaceId: string,
    projectId?: string,
  ) {
    const scopes: Prisma.TaskPriorityWhereInput[] = [
      {
        scope: StatusScope.SYSTEM,
      },
      {
        scope: StatusScope.ORGANIZATION,
        targetId: organizationId,
      },
      {
        scope: StatusScope.WORKSPACE,
        targetId: workspaceId,
      },
    ];

    if (projectId) {
      scopes.push({
        scope: StatusScope.PROJECT,
        targetId: projectId,
      });
    }

    const priority = await this.prisma.taskPriority.findFirst({
      where: {
        id: priorityId,
        OR: scopes,
      },
    });

    if (!priority) {
      throw new BadRequestException(
        'The selected task priority is not available.',
      );
    }

    return priority;
  }

  async findAvailableTaskPriority(
    organizationId: string,
    workspaceId: string,
    projectId?: string,
  ) {
    const scopes: Prisma.TaskPriorityWhereInput[] = [
      {
        scope: StatusScope.SYSTEM,
      },
      {
        scope: StatusScope.ORGANIZATION,
        targetId: organizationId,
      },
      {
        scope: StatusScope.WORKSPACE,
        targetId: workspaceId,
      },
    ];

    if (projectId) {
      scopes.push({
        scope: StatusScope.PROJECT,
        targetId: projectId,
      });
    }

    return this.prisma.taskPriority.findMany({
      where: {
        OR: scopes,
      },
      select: {
        id: true,
        scope: true,
        name: true,
        order: true,
        color: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }
}
