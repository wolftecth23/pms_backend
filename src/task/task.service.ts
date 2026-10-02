import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { ProjectPermissionService } from '../common/access/project-permission.service';
import { ContextService } from '../common/context/context.service';
import { StorageService, UploadedFileResult } from '../common/storage/storage.service';
import { TaskAssigneeServiceValidation } from '../common/validation/task-assignee.service';
import { TaskParentServiceValidation } from '../common/validation/task-parent.service';
import { TaskPriorityServiceValidation } from '../common/validation/task-priority.service';
import { TaskStatusServiceValidation } from '../common/validation/task-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  TaskActivityEntity,
  TaskActivityEvent,
} from './constants/task-activity-event.enum';
import { CreateTaskActivityDto } from './dto/create-task-activity.dto';
import { TaskActivityQueryDto } from './dto/task-activity-query.dto';
import { TaskActivityService } from './task-activity.service';
import { computeTaskTimeEffort } from './helpers/task-time.helper';
import { TaskTreeRow } from './types/task-tree.type';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
    private readonly projectPermissionService: ProjectPermissionService,
    private readonly taskStatusServiceValidation: TaskStatusServiceValidation,
    private readonly taskPriorityServiceValidation: TaskPriorityServiceValidation,
    private readonly taskParentServiceValidation: TaskParentServiceValidation,
    private readonly taskAssigneeServiceValidation: TaskAssigneeServiceValidation,
    private readonly storageService: StorageService,
    private readonly taskActivityService: TaskActivityService,
  ) {}

  async getNextOrder(projectId: string): Promise<number> {
    const lastTask = await this.prisma.task.findFirst({
      where: {
        projectId,
      },
      orderBy: {
        order: 'desc',
      },
      select: {
        order: true,
      },
    });

    return (lastTask?.order ?? -1) + 1;
  }

  async create(dto: CreateTaskDto, request: AuthRequest) {
    const projectId = dto.projectId;

    if (!projectId) {
      throw new BadRequestException('Project ID is required.');
    }

    const context = await this.contextService.resolveContext(request);

    // if (!context.hasPermission('task.create')) {
    //   throw new ForbiddenException(
    //     'You do not have permission to create tasks.',
    //   );
    // }

    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.organizationId !== context.organizationId) {
      throw new ForbiddenException(
        'Project does not belong to your organization.',
      );
    }

    await this.taskStatusServiceValidation.validateTaskStatus(
      dto.statusId,
      context.organizationId,
      context.workspaceId,
      projectId,
    );

    await this.taskPriorityServiceValidation.validateTaskPriority(
      dto.priorityId,
      context.organizationId,
      context.workspaceId,
      projectId,
    );

    /**
     * Validate Parent Task
     */
    if (dto.parentTaskId) {
      await this.taskParentServiceValidation.validateParentTask(
        dto.parentTaskId,
        projectId,
      );
    }

    /**
     * Validate Dates
     */
    if (
      dto.startDate &&
      dto.dueDate &&
      new Date(dto.startDate) > new Date(dto.dueDate)
    ) {
      throw new BadRequestException(
        'Due date must be greater than or equal to start date.',
      );
    }

    /**
     * Validate Task Time & Effort Minutes
     */
    if (dto.purchaseMinutes !== undefined && dto.purchaseMinutes < 0) {
      throw new BadRequestException('Purchase minutes cannot be negative.');
    }
    if (dto.estimatedMinutes !== undefined && dto.estimatedMinutes < 0) {
      throw new BadRequestException('Estimated minutes cannot be negative.');
    }
    if (dto.spentMinutes !== undefined && dto.spentMinutes < 0) {
      throw new BadRequestException('Spent minutes cannot be negative.');
    }

    /**
     * Validate Assignees
     */
    const projectMemberIds =
      await this.taskAssigneeServiceValidation.validateTaskAssignees(
        dto.assigneeIds,
        projectId,
      );

    const nextOrder = await this.getNextOrder(projectId);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,

          title: dto.title,
          description: dto.description ?? null,
          comment: dto.comment ?? null,

          taskStatusId: dto.statusId,
          priorityId: dto.priorityId,

          parentTaskId: dto.parentTaskId ?? null,

          createdById: context.userId,

          startDate: dto.startDate || null,

          dueDate: dto.dueDate || null,

          purchaseMinutes: dto.purchaseMinutes ?? null,

          estimatedMinutes: dto.estimatedMinutes ?? null,

          spentMinutes: dto.spentMinutes ?? null,

          team: dto.team ?? null,

          order: nextOrder,
        },

        include: {
          status: {
            select: {
              id: true,
              name: true,
              // color: true,
            },
          },
          priority: {
            select: {
              id: true,
              name: true,
              // color: true,
            },
          },
        },
      });

      if (projectMemberIds.length) {
        await tx.taskAssignee.createMany({
          data: projectMemberIds.map((projectMemberId) => ({
            taskId: task.id,
            projectMemberId,
            assignedById: context.userId,
          })),
          skipDuplicates: true,
        });
      }

      // Assign tags if provided
      if (dto.tagIds && dto.tagIds.length > 0) {
        await tx.taskTag.createMany({
          data: dto.tagIds.map((tagId) => ({
            taskId: task.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      const activitiesToCreate: CreateTaskActivityDto[] = [
        {
          taskId: task.id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_CREATED,
          entityType: TaskActivityEntity.TASK,
          entityId: task.id,
          newValue: {
            title: task.title,
            status: task.status
              ? { id: task.status.id, name: task.status.name }
              : null,
            priority: task.priority
              ? { id: task.priority.id, name: task.priority.name }
              : null,
          },
          message: 'created this task',
        },
      ];

      if (projectMemberIds.length > 0) {
        const members = await tx.projectMember.findMany({
          where: { id: { in: projectMemberIds } },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
        for (const member of members) {
          const memberName = [member.user.firstName, member.user.lastName]
            .filter(Boolean)
            .join(' ');
          activitiesToCreate.push({
            taskId: task.id,
            userId: context.userId,
            eventType: TaskActivityEvent.TASK_ASSIGNED,
            entityType: TaskActivityEntity.TASK_ASSIGNEE,
            entityId: member.id,
            newValue: {
              projectMemberId: member.id,
              userId: member.user.id,
              name: memberName,
            },
            message: `assigned ${memberName}`,
          });
        }
      }

      if (dto.tagIds && dto.tagIds.length > 0) {
        const tags = await tx.tag.findMany({
          where: { id: { in: dto.tagIds } },
          select: { id: true, name: true },
        });
        for (const tag of tags) {
          activitiesToCreate.push({
            taskId: task.id,
            userId: context.userId,
            eventType: TaskActivityEvent.TASK_TAG_ADDED,
            entityType: TaskActivityEntity.TASK_TAG,
            entityId: tag.id,
            newValue: {
              tagId: tag.id,
              name: tag.name,
            },
            message: `added tag "${tag.name}"`,
          });
        }
      }

      await this.taskActivityService.logMany(activitiesToCreate, tx);

      if (dto.spentMinutes !== undefined && dto.spentMinutes !== null) {
        const spentAgg = await tx.task.aggregate({
          where: { projectId, deletedAt: null },
          _sum: { spentMinutes: true },
        });
        const totalSpentMinutes = spentAgg._sum?.spentMinutes ?? 0;
        const spentHours = parseFloat((totalSpentMinutes / 60).toFixed(2));
        await tx.project.update({
          where: { id: projectId },
          data: { spentHours },
        });
      }

      return {
        message: 'Task created successfully.',
        data: {
          ...task,
          ...computeTaskTimeEffort(task),
        },
      };
    });
  }

  async findByProject(
    projectId: string,
    request: AuthRequest,
    assigneeIds: string[] = [],
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required.');
    }

    const context = await this.contextService.resolveContext(request);

    // if (!context.hasPermission('task.view')) {
    //   throw new ForbiddenException('You do not have permission to view tasks.');
    // }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.organizationId !== context.organizationId) {
      throw new ForbiddenException(
        'Project does not belong to your organization.',
      );
    }

    // Check the project-level role for task.view_all.
    // Use cached permissions from ProjectPermissionGuard if available to avoid redundant 4-table join.
    const cachedPerms = (request as any)?.projectPermissions as
      | string[]
      | undefined;
    const canViewAll = cachedPerms
      ? cachedPerms.includes('*') || cachedPerms.includes('task.view_all')
      : await this.projectPermissionService.hasProjectPermission(
          context.userId,
          projectId,
          'task.view_all',
        );

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
    };

    const hasUnassigned = assigneeIds.some(
      (id) => id.toLowerCase() === 'unassigned',
    );
    const memberIds = assigneeIds.filter(
      (id) => id.toLowerCase() !== 'unassigned',
    );

    if (assigneeIds.length > 0) {
      if (!canViewAll) {
        // Intersect: must be assigned to current user AND in selected filter
        const cachedMember = (request as any)?.projectMember;
        const currentMember =
          cachedMember ??
          (await this.prisma.projectMember.findFirst({
            where: { projectId, userId: context.userId, removedAt: null },
            select: { id: true },
          }));
        const allowedIds = currentMember
          ? memberIds.filter((id) => id === currentMember.id)
          : [];
        where.assignees = {
          some: { projectMemberId: { in: allowedIds }, removedAt: null },
        };
      } else {
        // Validate: only keep projectMemberIds belonging to this project
        const validMembers =
          memberIds.length > 0
            ? await this.prisma.projectMember.findMany({
                where: { id: { in: memberIds }, projectId, removedAt: null },
                select: { id: true },
              })
            : [];
        const validIds = validMembers.map((m) => m.id);

        if (hasUnassigned && validIds.length > 0) {
          where.OR = [
            { assignees: { none: { removedAt: null } } },
            {
              assignees: {
                some: { projectMemberId: { in: validIds }, removedAt: null },
              },
            },
          ];
        } else if (hasUnassigned) {
          where.assignees = {
            none: { removedAt: null },
          };
        } else {
          where.assignees = {
            some: { projectMemberId: { in: validIds }, removedAt: null },
          };
        }
      }
    } else {
      if (!canViewAll) {
        const cachedMemberId = (request as any)?.projectMember?.id;
        if (cachedMemberId) {
          where.assignees = {
            some: {
              projectMemberId: cachedMemberId,
              removedAt: null,
            },
          };
        } else {
          where.assignees = {
            some: {
              projectMember: {
                userId: context.userId,
                removedAt: null,
              },
              removedAt: null,
            },
          };
        }
      }
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: {
        order: 'desc',
      },
      select: {
        id: true,
        projectId: true,
        parentTaskId: true,
        title: true,
        taskStatusId: true,
        priorityId: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        purchaseMinutes: true,
        estimatedMinutes: true,
        spentMinutes: true,
        team: true,
        order: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        // EXCLUDE description & comment (fetched on-demand when opening task modal)
        status: {
          select: {
            id: true,
            name: true,
          },
        },
        priority: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        parentTask: {
          select: {
            id: true,
            title: true,
          },
        },
        assignees: {
          where: {
            removedAt: null,
          },
          select: {
            id: true,
            projectMember: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    const mappedTasks = tasks.map((task) => ({
      ...task,
      ...computeTaskTimeEffort(task),
      tags: task.tags?.map((tt: any) => tt.tag) || [],
    }));

    return {
      message: 'Tasks fetched successfully.',
      data: mappedTasks,
    };
  }

  async findAvailablePriorities(
    projectId: string | undefined,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);

    // if (projectId) {
    //   const project = await this.prisma.project.findFirst({
    //     where: {
    //       id: projectId,
    //       deletedAt: null,
    //     },
    //     select: {
    //       id: true,
    //       organizationId: true,
    //     },
    //   });

    //   if (!project) {
    //     throw new NotFoundException('Project not found.');
    //   }

    //   if (project.organizationId !== context.organizationId) {
    //     throw new ForbiddenException(
    //       'Project does not belong to your organization.',
    //     );
    //   }
    // }

    const priorities =
      await this.taskPriorityServiceValidation.findAvailableTaskPriority(
        context.organizationId,
        context.workspaceId,
        projectId,
      );

    return {
      message: 'Task priorities fetched successfully.',
      data: priorities,
    };
  }

  async changeStatus(dto: ChangeTaskStatusDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    // if (
    //   !context.hasPermission('task.change_status') &&
    //   !context.hasPermission('task.update')
    // ) {
    //   throw new ForbiddenException(
    //     'You do not have permission to change task status.',
    //   );
    // }

    const task = await this.prisma.task.findFirst({
      where: {
        id: dto.taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        taskStatusId: true,
        status: {
          select: {
            id: true,
            name: true,
          },
        },
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

    if (task.taskStatusId === dto.statusId) {
      return {
        message: 'Task is already in the selected status.',
      };
    }

    if (task.project.organizationId !== context.organizationId) {
      throw new ForbiddenException(
        'Task does not belong to your organization.',
      );
    }

    const status = await this.taskStatusServiceValidation.validateTaskStatus(
      dto.statusId,
      context.organizationId,
      context.workspaceId,
      task.projectId,
    );

    // await this.prisma.taskStatus.findUnique({
    //   where: {
    //     id: dto.statusId,
    //   },
    //   select: {
    //     isClosed: true,
    //   },
    // });

    const updatedTask = await this.prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        taskStatusId: dto.statusId,
        completedAt: status?.isClosed ? new Date().toISOString() : null,
      },
      include: {
        status: {
          select: {
            id: true,
            name: true,
            isClosed: true,
          },
        },
        priority: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.taskActivityService.log({
      taskId: task.id,
      userId: context.userId,
      eventType: TaskActivityEvent.TASK_STATUS_CHANGED,
      entityType: TaskActivityEntity.TASK,
      entityId: task.id,
      fieldName: 'taskStatusId',
      oldValue: task.status
        ? { id: task.status.id, name: task.status.name }
        : { id: task.taskStatusId },
      newValue: updatedTask.status
        ? { id: updatedTask.status.id, name: updatedTask.status.name }
        : { id: dto.statusId },
      message: `changed status to ${updatedTask.status?.name ?? 'updated status'}`,
    });

    return {
      message: 'Task status updated successfully.',
      data: updatedTask,
    };
  }

  async update(id: string, dto: UpdateTaskDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    // if (!context.hasPermission('task.update')) {
    //   throw new ForbiddenException(
    //     'You do not have permission to update tasks.',
    //   );
    // }

    const task = await this.prisma.task.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        parentTaskId: true,

        title: true,
        description: true,
        comment: true,

        taskStatusId: true,
        priorityId: true,

        startDate: true,
        dueDate: true,

        purchaseMinutes: true,
        estimatedMinutes: true,
        spentMinutes: true,
        status: {
          select: {
            id: true,
            name: true,
          },
        },
        priority: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          select: {
            tagId: true,
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        assignees: {
          where: {
            removedAt: null,
          },
          select: {
            projectMemberId: true,
            projectMember: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },

        project: {
          select: {
            id: true,
            organizationId: true,
            workspaceId: true,
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

    if (task.project.workspaceId !== context.workspaceId) {
      throw new ForbiddenException('Task does not belong to your workspace.');
    }

    if (dto.statusId && dto.statusId !== task.taskStatusId) {
      await this.taskStatusServiceValidation.validateTaskStatus(
        dto.statusId,
        context.organizationId,
        context.workspaceId,
        task.projectId,
      );
    }

    if (dto.priorityId && dto.priorityId !== task.priorityId) {
      await this.taskPriorityServiceValidation.validateTaskPriority(
        dto.priorityId,
        context.organizationId,
        context.workspaceId,
        task.projectId,
      );
    }

    if (
      dto.parentTaskId !== undefined &&
      dto.parentTaskId !== task.parentTaskId
    ) {
      if (dto.parentTaskId === id) {
        throw new BadRequestException('A task cannot be its own parent.');
      }

      if (dto.parentTaskId) {
        await this.taskParentServiceValidation.validateParentTask(
          dto.parentTaskId,
          task.projectId,
        );
      }
    }

    const startDate =
      dto.startDate !== undefined ? dto.startDate : task.startDate;

    const dueDate = dto.dueDate !== undefined ? dto.dueDate : task.dueDate;

    if (startDate && dueDate && startDate > dueDate) {
      throw new BadRequestException(
        'Due date must be greater than or equal to start date.',
      );
    }

    if (dto.purchaseMinutes !== undefined && dto.purchaseMinutes < 0) {
      throw new BadRequestException('Purchase minutes cannot be negative.');
    }

    if (dto.estimatedMinutes !== undefined && dto.estimatedMinutes < 0) {
      throw new BadRequestException('Estimated minutes cannot be negative.');
    }

    if (dto.spentMinutes !== undefined && dto.spentMinutes < 0) {
      throw new BadRequestException('Spent minutes cannot be negative.');
    }

    let projectMemberIds: string[] | undefined;

    if (dto.assigneeIds !== undefined) {
      if (dto.assigneeIds?.length) {
        projectMemberIds =
          await this.taskAssigneeServiceValidation.validateTaskAssignees(
            dto.assigneeIds,
            task.projectId,
          );
      } else {
        projectMemberIds = [];
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.TaskUncheckedUpdateInput = {};

      if (dto.title !== undefined) {
        updateData.title = dto.title;
      }

      if (dto.description !== undefined) {
        updateData.description = dto.description;
      }

      if (dto.comment !== undefined) {
        updateData.comment = dto.comment;
      }

      if (dto.statusId !== undefined) {
        updateData.taskStatusId = dto.statusId;
      }

      if (dto.priorityId !== undefined) {
        updateData.priorityId = dto.priorityId;
      }

      if (dto.parentTaskId !== undefined) {
        updateData.parentTaskId = dto.parentTaskId;
      }

      if (dto.startDate !== undefined) {
        updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
      }

      if (dto.dueDate !== undefined) {
        updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      }

      if (dto.purchaseMinutes !== undefined) {
        updateData.purchaseMinutes = dto.purchaseMinutes;
      }

      if (dto.estimatedMinutes !== undefined) {
        updateData.estimatedMinutes = dto.estimatedMinutes;
      }

      if (dto.spentMinutes !== undefined) {
        updateData.spentMinutes = dto.spentMinutes;
      }

      if (dto.team !== undefined) {
        updateData.team = dto.team;
      }

      const updatedTask = await tx.task.update({
        where: {
          id,
        },

        data: updateData,

        include: {
          status: {
            select: {
              id: true,
              name: true,
            },
          },

          priority: {
            select: {
              id: true,
              name: true,
            },
          },

          assignees: {
            select: {
              id: true,
              projectMemberId: true,
              assignedById: true,
              assignedAt: true,

              projectMember: {
                select: {
                  id: true,
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (dto.spentMinutes !== undefined) {
        const spentAgg = await tx.task.aggregate({
          where: { projectId: task.projectId, deletedAt: null },
          _sum: { spentMinutes: true },
        });
        const totalSpentMinutes = spentAgg._sum?.spentMinutes ?? 0;
        const spentHours = parseFloat((totalSpentMinutes / 60).toFixed(2));
        await tx.project.update({
          where: { id: task.projectId },
          data: { spentHours },
        });
      }

      // Update assignees only if provided in payload
      if (dto.assigneeIds !== undefined && projectMemberIds !== undefined) {
        // Remove members not present in the new list
        await tx.taskAssignee.updateMany({
          where: {
            taskId: id,
            projectMemberId: {
              notIn: projectMemberIds,
            },
            removedAt: null,
          },
          data: {
            removedAt: new Date().toISOString(),
            removedById: context.userId,
          },
        });

        if (projectMemberIds.length) {
          for (const projectMemberId of projectMemberIds) {
            await tx.taskAssignee.upsert({
              where: {
                taskId_projectMemberId: {
                  taskId: id,
                  projectMemberId,
                },
              },
              update: {
                removedAt: null,
                removedById: null,
                assignedById: context.userId,
              },
              create: {
                taskId: id,
                projectMemberId,
                assignedById: context.userId,
              },
            });
          }
        }
      }

      // Update tags if provided (replace all existing tags)
      if (dto.tagIds !== undefined) {
        await tx.taskTag.deleteMany({ where: { taskId: id } });
        if (dto.tagIds.length > 0) {
          await tx.taskTag.createMany({
            data: dto.tagIds.map((tagId) => ({ taskId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      const activitiesToCreate: CreateTaskActivityDto[] = [];

      // Title
      if (dto.title !== undefined && dto.title !== task.title) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_TITLE_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'title',
          oldValue: task.title,
          newValue: dto.title,
          message: `changed title from "${task.title}" to "${dto.title}"`,
        });
      }

      // Description
      if (
        dto.description !== undefined &&
        dto.description !== task.description
      ) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_DESCRIPTION_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'description',
          oldValue: task.description,
          newValue: dto.description,
          message: 'updated the description',
        });
      }

      // Status
      if (dto.statusId !== undefined && dto.statusId !== task.taskStatusId) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_STATUS_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'taskStatusId',
          oldValue: task.status
            ? { id: task.status.id, name: task.status.name }
            : { id: task.taskStatusId },
          newValue: updatedTask.status
            ? { id: updatedTask.status.id, name: updatedTask.status.name }
            : { id: dto.statusId },
          message: `changed status to ${updatedTask.status?.name ?? 'updated status'}`,
        });
      }

      // Priority
      if (dto.priorityId !== undefined && dto.priorityId !== task.priorityId) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_PRIORITY_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'priorityId',
          oldValue: task.priority
            ? { id: task.priority.id, name: task.priority.name }
            : { id: task.priorityId },
          newValue: updatedTask.priority
            ? { id: updatedTask.priority.id, name: updatedTask.priority.name }
            : { id: dto.priorityId },
          message: `changed priority to ${updatedTask.priority?.name ?? 'updated priority'}`,
        });
      }

      // Start Date
      const oldStartStr = task.startDate
        ? new Date(task.startDate).toISOString()
        : null;
      const newStartStr =
        dto.startDate !== undefined
          ? dto.startDate
            ? new Date(dto.startDate).toISOString()
            : null
          : oldStartStr;
      if (dto.startDate !== undefined && oldStartStr !== newStartStr) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_START_DATE_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'startDate',
          oldValue: oldStartStr,
          newValue: newStartStr,
          message: 'updated start date',
        });
      }

      // Due Date
      const oldDueStr = task.dueDate
        ? new Date(task.dueDate).toISOString()
        : null;
      const newDueStr =
        dto.dueDate !== undefined
          ? dto.dueDate
            ? new Date(dto.dueDate).toISOString()
            : null
          : oldDueStr;
      if (dto.dueDate !== undefined && oldDueStr !== newDueStr) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_DUE_DATE_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'dueDate',
          oldValue: oldDueStr,
          newValue: newDueStr,
          message: 'updated due date',
        });
      }

      // Estimated Minutes
      if (
        dto.estimatedMinutes !== undefined &&
        dto.estimatedMinutes !== task.estimatedMinutes
      ) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_ESTIMATED_MINUTES_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'estimatedMinutes',
          oldValue: task.estimatedMinutes,
          newValue: dto.estimatedMinutes,
          message: 'updated estimated time',
        });
      }

      // Spent Minutes
      if (
        dto.spentMinutes !== undefined &&
        dto.spentMinutes !== task.spentMinutes
      ) {
        activitiesToCreate.push({
          taskId: id,
          userId: context.userId,
          eventType: TaskActivityEvent.TASK_SPENT_MINUTES_CHANGED,
          entityType: TaskActivityEntity.TASK,
          entityId: id,
          fieldName: 'spentMinutes',
          oldValue: task.spentMinutes,
          newValue: dto.spentMinutes,
          message: 'updated spent time',
        });
      }

      // Assignees
      if (dto.assigneeIds !== undefined && projectMemberIds !== undefined) {
        const oldMemberIds = task.assignees.map((a) => a.projectMemberId);
        const addedMemberIds = projectMemberIds.filter(
          (mId) => !oldMemberIds.includes(mId),
        );
        const removedMemberIds = oldMemberIds.filter(
          (mId) => !projectMemberIds.includes(mId),
        );

        if (addedMemberIds.length > 0) {
          const addedMembers = await tx.projectMember.findMany({
            where: { id: { in: addedMemberIds } },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });
          for (const member of addedMembers) {
            const memberName = [member.user.firstName, member.user.lastName]
              .filter(Boolean)
              .join(' ');
            activitiesToCreate.push({
              taskId: id,
              userId: context.userId,
              eventType: TaskActivityEvent.TASK_ASSIGNED,
              entityType: TaskActivityEntity.TASK_ASSIGNEE,
              entityId: member.id,
              newValue: {
                projectMemberId: member.id,
                userId: member.user.id,
                name: memberName,
              },
              message: `assigned ${memberName}`,
            });
          }
        }

        for (const memberId of removedMemberIds) {
          const existingAssignee = task.assignees.find(
            (a) => a.projectMemberId === memberId,
          );
          const u = existingAssignee?.projectMember?.user;
          const memberName = u
            ? [u.firstName, u.lastName].filter(Boolean).join(' ')
            : 'assignee';
          activitiesToCreate.push({
            taskId: id,
            userId: context.userId,
            eventType: TaskActivityEvent.TASK_UNASSIGNED,
            entityType: TaskActivityEntity.TASK_ASSIGNEE,
            entityId: memberId,
            oldValue: {
              projectMemberId: memberId,
              userId: u?.id,
              name: memberName,
            },
            message: `unassigned ${memberName}`,
          });
        }
      }

      // Tags
      if (dto.tagIds !== undefined) {
        const oldTagIds = task.tags.map((t) => t.tagId);
        const addedTagIds = dto.tagIds.filter(
          (tid) => !oldTagIds.includes(tid),
        );
        const removedTagIds = oldTagIds.filter(
          (tid) => !dto.tagIds!.includes(tid),
        );

        if (addedTagIds.length > 0) {
          const addedTags = await tx.tag.findMany({
            where: { id: { in: addedTagIds } },
            select: { id: true, name: true },
          });
          for (const tag of addedTags) {
            activitiesToCreate.push({
              taskId: id,
              userId: context.userId,
              eventType: TaskActivityEvent.TASK_TAG_ADDED,
              entityType: TaskActivityEntity.TASK_TAG,
              entityId: tag.id,
              newValue: {
                tagId: tag.id,
                name: tag.name,
              },
              message: `added tag "${tag.name}"`,
            });
          }
        }

        for (const tid of removedTagIds) {
          const existingTag = task.tags.find((t) => t.tagId === tid)?.tag;
          const tagName = existingTag?.name ?? 'tag';
          activitiesToCreate.push({
            taskId: id,
            userId: context.userId,
            eventType: TaskActivityEvent.TASK_TAG_REMOVED,
            entityType: TaskActivityEntity.TASK_TAG,
            entityId: tid,
            oldValue: {
              tagId: tid,
              name: tagName,
            },
            message: `removed tag "${tagName}"`,
          });
        }
      }

      await this.taskActivityService.logMany(activitiesToCreate, tx);

      return {
        message: 'Task updated successfully.',
        data: {
          ...updatedTask,
          ...computeTaskTimeEffort(updatedTask),
        },
      };
    });
  }

  async findOne(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    // if (!context.hasPermission('task.view')) {
    //   throw new ForbiddenException('You do not have permission to view tasks.');
    // }

    const tasks = await this.prisma.$queryRaw<TaskTreeRow[]>`
    WITH RECURSIVE task_tree AS (
      SELECT
        t.*,
        p.name as "projectName",
        0 AS depth
      FROM tasks t
      INNER JOIN projects p
        ON p.id = t."projectId"
      WHERE
        t.id = ${id}
        AND t."deletedAt" IS NULL
        AND p."deletedAt" IS NULL
        AND p."organizationId" = ${context.organizationId}
        AND p."workspaceId" = ${context.workspaceId}

      UNION ALL

      SELECT
        child.*,
        parent."projectName",
        parent.depth + 1 AS depth
      FROM tasks child
      INNER JOIN task_tree parent
        ON child."parentTaskId" = parent.id
      WHERE
        child."deletedAt" IS NULL
    )

    SELECT *
    FROM task_tree
    ORDER BY depth, "order";
  `;

    if (!tasks.length) {
      throw new NotFoundException('Task not found.');
    }

    const taskIds = tasks.map((task) => task.id || '');

    // Fetch tags for all tasks in the tree
    const taskTags = await this.prisma.taskTag.findMany({
      where: { taskId: { in: taskIds } },
      select: {
        taskId: true,
        tag: { select: { id: true, name: true, color: true } },
      },
    });

    const tagsMap = new Map<
      string,
      { id: string; name: string; color: string }[]
    >();
    for (const tt of taskTags) {
      const existing = tagsMap.get(tt.taskId);
      if (existing) {
        existing.push(tt.tag);
      } else {
        tagsMap.set(tt.taskId, [tt.tag]);
      }
    }

    const taskAssignees = await this.prisma.taskAssignee.findMany({
      where: {
        taskId: {
          in: taskIds,
        },
        removedAt: null,
      },

      select: {
        id: true,
        taskId: true,
        projectMemberId: true,
        assignedById: true,
        assignedAt: true,

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

      orderBy: {
        assignedAt: 'asc',
      },
    });

    const assigneesMap = new Map<string, (typeof taskAssignees)[number][]>();

    for (const assignee of taskAssignees) {
      const existing = assigneesMap.get(assignee.taskId);

      if (existing) {
        existing.push(assignee);
      } else {
        assigneesMap.set(assignee.taskId, [assignee]);
      }
    }

    type TaskNode = TaskTreeRow & {
      assignees: (typeof taskAssignees)[number][];
      tags: { id: string; name: string; color: string }[];
      subTasks: TaskNode[];
    };

    const taskMap = new Map<string, TaskNode>();

    for (const task of tasks) {
      taskMap.set(task.id, {
        ...task,
        ...computeTaskTimeEffort(task),
        assignees: assigneesMap.get(task.id) ?? [],
        tags: tagsMap.get(task.id) ?? [],
        subTasks: [],
      });
    }

    for (const task of tasks) {
      if (!task.parentTaskId) {
        continue;
      }

      const parent = taskMap.get(task.parentTaskId);
      const currentTask = taskMap.get(task.id);

      if (parent && currentTask) {
        parent.subTasks.push(currentTask);
      }
    }

    const rootTask = taskMap.get(id);

    if (!rootTask) {
      throw new NotFoundException('Task not found.');
    }

    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId: id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Task fetched successfully.',
      data: {
        ...rootTask,
        attachments,
      },
    };
  }

  async getTaskAttachments(taskId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        project: {
          deletedAt: null,
          organizationId: context.organizationId,
          workspaceId: context.workspaceId,
        },
      },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    const attachments = await this.prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: attachments,
    };
  }

  async addTaskAttachment(
    taskId: string,
    userId: string,
    file: UploadedFileResult,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        project: {
          deletedAt: null,
          organizationId: context.organizationId,
          workspaceId: context.workspaceId,
        },
      },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedById: userId,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        url: file.url,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
      },
    });

    await this.taskActivityService.log({
      taskId,
      userId,
      eventType: TaskActivityEvent.TASK_ATTACHMENT_ADDED,
      entityType: TaskActivityEntity.TASK_ATTACHMENT,
      entityId: attachment.id,
      newValue: {
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
      },
      message: `added attachment "${attachment.name}"`,
    });

    return {
      success: true,
      message: 'Attachment uploaded successfully.',
      data: attachment,
    };
  }

  async deleteTaskAttachment(attachmentId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          include: {
            project: true,
          },
        },
      },
    });

    if (
      !attachment ||
      attachment.task.deletedAt ||
      attachment.task.project.deletedAt
    ) {
      throw new NotFoundException('Attachment not found.');
    }

    if (
      attachment.task.project.organizationId !== context.organizationId ||
      attachment.task.project.workspaceId !== context.workspaceId
    ) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    await this.taskActivityService.log({
      taskId: attachment.taskId,
      userId: context.userId,
      eventType: TaskActivityEvent.TASK_ATTACHMENT_REMOVED,
      entityType: TaskActivityEntity.TASK_ATTACHMENT,
      entityId: attachment.id,
      oldValue: {
        id: attachment.id,
        name: attachment.name,
      },
      message: `removed attachment "${attachment.name}"`,
    });

    // Delete file from disk
    this.storageService.deleteFile(attachment.url);

    // Delete from database
    await this.prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    return {
      success: true,
      message: 'Attachment deleted successfully.',
    };
  }

  async getTaskActivities(
    taskId: string,
    query: TaskActivityQueryDto,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    return this.taskActivityService.getTaskActivities(
      taskId,
      query.page,
      Number(query.limit),
      context,
    );
  }

  // findAll() {
  //   return this.prisma.task.findMany();
  // }

  // update(id: string, updateTaskDto: UpdateTaskDto) {
  //   return this.prisma.task.update({
  //     where: { id },
  //     data: updateTaskDto,
  //   });
  // }

  // remove(id: string) {
  //   return this.prisma.task.delete({
  //     where: { id },
  //   });
  // }

  // remove(id: string) {
  //   return this.prisma.task.update({
  //     where: { id },
  //     data: {
  //       deletedAt: new Date(),
  //     },
  //   });
  // }
}
