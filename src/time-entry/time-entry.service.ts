import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { TimeEntryQueryDto } from './dto/time-entry-query.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { formatMinutes } from './time-entry.utils';

@Injectable()
export class TimeEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
  ) {}

  async create(dto: CreateTimeEntryDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const task = await this.prisma.task.findFirst({
      where: {
        id: dto.taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            id: true,
            organizationId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!task || task.project.deletedAt) {
      throw new NotFoundException('Task not found.');
    }

    if (task.project.organizationId !== context.organizationId) {
      throw new ForbiddenException(
        'Task does not belong to your organization.',
      );
    }

    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        id: dto.projectMemberId,
        projectId: task.projectId,
        removedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!projectMember) {
      throw new BadRequestException(
        'Project member not found or removed from project.',
      );
    }

    // Verify requesting user is the project member or has authorization
    if (projectMember.userId !== context.userId) {
      throw new ForbiddenException(
        'You can only log time for your own project member profile.',
      );
    }

    // Find assignee record
    const taskAssignee = await this.prisma.taskAssignee.findFirst({
      where: {
        taskId: dto.taskId,
        projectMemberId: dto.projectMemberId,
        removedAt: null,
      },
    });

    if (!taskAssignee) {
      throw new ForbiddenException(
        'You must be an active assignee of this task to log time.',
      );
    }

    if (dto.taskAssigneeId && dto.taskAssigneeId !== taskAssignee.id) {
      throw new BadRequestException(
        'Provided taskAssigneeId does not match task and member.',
      );
    }

    if (dto.durationMinutes <= 0 || dto.durationMinutes > 1440) {
      throw new BadRequestException(
        'Duration must be between 1 and 1440 minutes (24 hours).',
      );
    }

    const loggedDate = new Date(dto.loggedDate);
    if (isNaN(loggedDate.getTime())) {
      throw new BadRequestException('Invalid loggedDate format.');
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.create({
        data: {
          organizationId: context.organizationId,
          projectId: task.projectId,
          taskId: dto.taskId,
          projectMemberId: dto.projectMemberId,
          taskAssigneeId: taskAssignee.id,
          durationMinutes: dto.durationMinutes,
          loggedDate,
          description: dto.description ?? null,
          createdById: context.userId,
        },
        include: {
          projectMember: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      const userName = `${projectMember.user.firstName} ${projectMember.user.lastName || ''}`.trim();
      const formattedDuration = formatMinutes(dto.durationMinutes);

      await tx.taskActivity.create({
        data: {
          taskId: dto.taskId,
          userId: context.userId,
          eventType: 'TIME_LOGGED',
          entityType: 'TIME_ENTRY',
          entityId: entry.id,
          message: `${userName} logged ${formattedDuration} on this task.`,
        },
      });

      return {
        message: 'Time entry created successfully.',
        data: {
          ...entry,
          durationFormatted: formattedDuration,
        },
      };
    });
  }

  async findByTask(taskId: string, query: TimeEntryQueryDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (task.project.organizationId !== context.organizationId) {
      throw new ForbiddenException(
        'Task does not belong to your organization.',
      );
    }

    const where: Prisma.TimeEntryWhereInput = {
      taskId,
      deletedAt: null,
    };

    if (query.projectMemberId) {
      where.projectMemberId = query.projectMemberId;
    }

    if (query.fromDate || query.toDate) {
      where.loggedDate = {};
      if (query.fromDate) {
        where.loggedDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.loggedDate.lte = new Date(query.toDate);
      }
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        orderBy: {
          loggedDate: 'desc',
        },
        skip,
        take: limit,
        include: {
          projectMember: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                  designation: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    const formattedItems = items.map((item) => ({
      ...item,
      durationFormatted: formatMinutes(item.durationMinutes),
      member: {
        id: item.projectMember.id,
        userId: item.projectMember.userId,
        name: `${item.projectMember.user.firstName} ${item.projectMember.user.lastName || ''}`.trim(),
        avatar: item.projectMember.user.avatar,
        designation: item.projectMember.user.designation,
      },
    }));

    return {
      message: 'Time entries fetched successfully.',
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdateTimeEntryDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found.');
    }

    if (entry.organizationId !== context.organizationId) {
      throw new ForbiddenException('Time entry does not belong to your organization.');
    }

    if (entry.createdById !== context.userId) {
      throw new ForbiddenException('You can only update your own time entries.');
    }

    if (dto.durationMinutes !== undefined && (dto.durationMinutes <= 0 || dto.durationMinutes > 1440)) {
      throw new BadRequestException('Duration must be between 1 and 1440 minutes.');
    }

    const oldFormatted = formatMinutes(entry.durationMinutes);
    const newMinutes = dto.durationMinutes ?? entry.durationMinutes;
    const newFormatted = formatMinutes(newMinutes);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timeEntry.update({
        where: { id },
        data: {
          durationMinutes: dto.durationMinutes !== undefined ? dto.durationMinutes : entry.durationMinutes,
          loggedDate: dto.loggedDate ? new Date(dto.loggedDate) : entry.loggedDate,
          description: dto.description !== undefined ? dto.description : entry.description,
        },
        include: {
          projectMember: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (dto.durationMinutes !== undefined && oldFormatted !== newFormatted) {
        const userName = `${entry.createdBy.firstName} ${entry.createdBy.lastName || ''}`.trim();
        await tx.taskActivity.create({
          data: {
            taskId: entry.taskId,
            userId: context.userId,
            eventType: 'TIME_UPDATED',
            entityType: 'TIME_ENTRY',
            entityId: entry.id,
            oldValue: oldFormatted,
            newValue: newFormatted,
            message: `${userName} updated logged time from ${oldFormatted} to ${newFormatted}.`,
          },
        });
      }

      return {
        message: 'Time entry updated successfully.',
        data: {
          ...updated,
          durationFormatted: newFormatted,
        },
      };
    });
  }

  async remove(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found.');
    }

    if (entry.organizationId !== context.organizationId) {
      throw new ForbiddenException('Time entry does not belong to your organization.');
    }

    if (entry.createdById !== context.userId) {
      throw new ForbiddenException('You can only delete your own time entries.');
    }

    const formattedDuration = formatMinutes(entry.durationMinutes);

    return this.prisma.$transaction(async (tx) => {
      await tx.timeEntry.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      const userName = `${entry.createdBy.firstName} ${entry.createdBy.lastName || ''}`.trim();
      await tx.taskActivity.create({
        data: {
          taskId: entry.taskId,
          userId: context.userId,
          eventType: 'TIME_DELETED',
          entityType: 'TIME_ENTRY',
          entityId: entry.id,
          message: `${userName} removed a ${formattedDuration} time entry.`,
        },
      });

      return {
        message: 'Time entry deleted successfully.',
      };
    });
  }

  async startTimer(taskId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: {
          select: {
            organizationId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!task || task.project.deletedAt) {
      throw new NotFoundException('Task not found.');
    }

    if (task.project.organizationId !== context.organizationId) {
      throw new ForbiddenException('Task does not belong to your organization.');
    }

    // Must be active project member & assignee
    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId: task.projectId,
        userId: context.userId,
        removedAt: null,
      },
    });

    if (!projectMember) {
      throw new ForbiddenException('You are not a member of this project.');
    }

    const taskAssignee = await this.prisma.taskAssignee.findFirst({
      where: {
        taskId,
        projectMemberId: projectMember.id,
        removedAt: null,
      },
    });

    if (!taskAssignee) {
      throw new ForbiddenException('You must be an active assignee of this task to start a timer.');
    }

    // Hard-block duplicate timer across all tasks
    const activeTimer = await this.prisma.timeEntry.findFirst({
      where: {
        createdById: context.userId,
        startedAt: { not: null },
        endedAt: null,
        deletedAt: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (activeTimer) {
      throw new BadRequestException({
        message: `A timer is already running on task "${activeTimer.task.title}". Stop it before starting a new one.`,
        activeTimerId: activeTimer.id,
        activeTaskId: activeTimer.taskId,
        activeTaskTitle: activeTimer.task.title,
      });
    }

    const entry = await this.prisma.timeEntry.create({
      data: {
        organizationId: context.organizationId,
        projectId: task.projectId,
        taskId,
        projectMemberId: projectMember.id,
        taskAssigneeId: taskAssignee.id,
        durationMinutes: 0,
        loggedDate: new Date(),
        startedAt: new Date(),
        createdById: context.userId,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return {
      message: 'Timer started successfully.',
      data: entry,
    };
  }

  async stopTimer(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found.');
    }

    if (entry.createdById !== context.userId) {
      throw new ForbiddenException('You can only stop your own timer.');
    }

    if (!entry.startedAt || entry.endedAt) {
      throw new BadRequestException('Timer is not currently running.');
    }

    const endedAt = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round((endedAt.getTime() - entry.startedAt.getTime()) / 60000),
    );
    const durationFormatted = formatMinutes(durationMinutes);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timeEntry.update({
        where: { id },
        data: {
          endedAt,
          durationMinutes,
        },
      });

      const userName = `${entry.createdBy.firstName} ${entry.createdBy.lastName || ''}`.trim();
      await tx.taskActivity.create({
        data: {
          taskId: entry.taskId,
          userId: context.userId,
          eventType: 'TIME_LOGGED',
          entityType: 'TIME_ENTRY',
          entityId: entry.id,
          message: `${userName} logged ${durationFormatted} via timer on this task.`,
        },
      });

      return {
        message: 'Timer stopped successfully.',
        data: {
          ...updated,
          durationFormatted,
        },
      };
    });
  }

  async getActiveTimer(request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const activeTimer = await this.prisma.timeEntry.findFirst({
      where: {
        createdById: context.userId,
        startedAt: { not: null },
        endedAt: null,
        deletedAt: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        projectMember: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    return {
      message: activeTimer ? 'Active timer found.' : 'No active timer.',
      data: activeTimer || null,
    };
  }
}
