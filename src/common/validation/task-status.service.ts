import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StatusScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskStatusServiceValidation {
  constructor(private readonly prisma: PrismaService) {}

  async validateTaskStatus(
    statusId: string,
    organizationId: string,
    workspaceId: string,
    projectId?: string,
  ) {
    const scopes: Prisma.TaskStatusWhereInput[] = [
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

    const status = await this.prisma.taskStatus.findFirst({
      where: {
        id: statusId,
        OR: scopes,
      },
    });

    if (!status) {
      throw new BadRequestException(
        'The selected task status is not available.',
      );
    }

    return status;
  }

  async findAvailableTaskStatuses(
    organizationId: string,
    workspaceId: string,
    projectId?: string,
  ) {
    const scopes: Prisma.TaskStatusWhereInput[] = [
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

    return this.prisma.taskStatus.findMany({
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
