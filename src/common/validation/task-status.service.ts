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

    const statuses = await this.prisma.taskStatus.findMany({
      where: {
        OR: scopes,
      },
      select: {
        id: true,
        scope: true,
        name: true,
        order: true,
        color: true,
        isDefault: true,
        isClosed: true,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { taskStatusOrder: true },
      });

      const taskStatusOrder = project?.taskStatusOrder ?? [];
      if (taskStatusOrder.length > 0) {
        const orderMap = new Map<string, number>();
        taskStatusOrder.forEach((id, idx) => orderMap.set(id, idx));

        statuses.sort((a, b) => {
          const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999 + a.order;
          const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999 + b.order;
          if (idxA !== idxB) {
            return idxA - idxB;
          }
          return a.name.localeCompare(b.name);
        });
      }
    }

    return statuses;
  }
}
