import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectContext } from '../project/project.service';
import { CreateTaskActivityDto } from './dto/create-task-activity.dto';

@Injectable()
export class TaskActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateTaskActivityDto, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.taskActivity.create({
      data: {
        taskId: params.taskId,
        userId: params.userId,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        fieldName: params.fieldName ?? null,
        oldValue:
          params.oldValue !== undefined && params.oldValue !== null
            ? (params.oldValue as Prisma.InputJsonValue)
            : Prisma.DbNull,
        newValue:
          params.newValue !== undefined && params.newValue !== null
            ? (params.newValue as Prisma.InputJsonValue)
            : Prisma.DbNull,
        message: params.message ?? null,
      },
    });
  }

  async logMany(
    records: CreateTaskActivityDto[],
    tx?: Prisma.TransactionClient,
  ) {
    if (!records || records.length === 0) {
      return { count: 0 };
    }
    const client = tx ?? this.prisma;
    return client.taskActivity.createMany({
      data: records.map((r) => ({
        taskId: r.taskId,
        userId: r.userId,
        eventType: r.eventType,
        entityType: r.entityType,
        entityId: r.entityId ?? null,
        fieldName: r.fieldName ?? null,
        oldValue:
          r.oldValue !== undefined && r.oldValue !== null
            ? (r.oldValue as Prisma.InputJsonValue)
            : Prisma.DbNull,
        newValue:
          r.newValue !== undefined && r.newValue !== null
            ? (r.newValue as Prisma.InputJsonValue)
            : Prisma.DbNull,
        message: r.message ?? null,
      })),
    });
  }

  async getTaskActivities(
    taskId: string,
    page: number = 1,
    limit: number = 20,
    context?: ProjectContext,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        deletedAt: true,
        project: {
          select: {
            id: true,
            deletedAt: true,
            organizationId: true,
            workspaceId: true,
          },
        },
      },
    });

    if (!task || task.deletedAt || task.project?.deletedAt) {
      throw new NotFoundException('Task not found.');
    }

    if (
      context &&
      task.project &&
      (task.project.organizationId !== context.organizationId ||
        task.project.workspaceId !== context.workspaceId)
    ) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    const skip = (page - 1) * limit;

    const [total, activities] = await Promise.all([
      this.prisma.taskActivity.count({
        where: { taskId },
      }),
      this.prisma.taskActivity.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
