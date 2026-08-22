import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { TaskAssigneeServiceValidation } from '../common/validation/task-assignee.service';
import { TaskParentServiceValidation } from '../common/validation/task-parent.service';
import { TaskPriorityServiceValidation } from '../common/validation/task-priority.service';
import { TaskStatusServiceValidation } from '../common/validation/task-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskTreeRow } from './types/task-tree.type';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
    private readonly taskStatusServiceValidation: TaskStatusServiceValidation,
    private readonly taskPriorityServiceValidation: TaskPriorityServiceValidation,
    private readonly taskParentServiceValidation: TaskParentServiceValidation,
    private readonly taskAssigneeServiceValidation: TaskAssigneeServiceValidation,
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
     * Validate Estimated Minutes
     */
    if (dto.estimatedMinutes && dto.estimatedMinutes < 0) {
      throw new BadRequestException('Estimated minutes cannot be negative.');
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

          estimatedMinutes: dto.estimatedMinutes ?? null,

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

      /**
       * Create Activity
       * Uncomment if TaskActivity is implemented
       */

      /*
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId: context.userId,
          action: TaskActivityAction.TASK_CREATED,
        },
      });
      */

      return {
        message: 'Task created successfully.',
        data: task,
      };
    });
  }

  async findByProject(projectId: string, request: AuthRequest) {
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

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (!context.hasPermission('task.view_all')) {
      where.assignees = {
        some: {
          projectMember: {
            userId: context.userId,
            removedAt: null,
          },
        },
      };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: {
        order: 'asc',
      },
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
          include: {
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
      },
    });

    return {
      message: 'Tasks fetched successfully.',
      data: tasks,
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

    /*
  await this.prisma.taskActivity.create({
    data: {
      taskId: task.id,
      userId: context.userId,
      action: TaskActivityAction.STATUS_CHANGED,
    },
  });
  */

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

        estimatedMinutes: true,

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

    if (dto.estimatedMinutes !== undefined && dto.estimatedMinutes < 0) {
      throw new BadRequestException('Estimated minutes cannot be negative.');
    }

    let projectMemberIds: string[] | undefined;

    if (dto.assigneeIds !== undefined && dto.assigneeIds?.length) {
      projectMemberIds =
        await this.taskAssigneeServiceValidation.validateTaskAssignees(
          dto.assigneeIds,
          task.projectId,
        );
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

      if (dto.estimatedMinutes !== undefined) {
        updateData.estimatedMinutes = dto.estimatedMinutes;
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

      if (projectMemberIds?.length) {
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

      /*
    await tx.taskActivity.create({
      data: {
        taskId: id,
        userId: context.userId,
        action: TaskActivityAction.TASK_UPDATED,
      },
    });
    */

      return {
        message: 'Task updated successfully.',
        data: updatedTask,
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
      subTasks: TaskNode[];
    };

    const taskMap = new Map<string, TaskNode>();

    for (const task of tasks) {
      taskMap.set(task.id, {
        ...task,
        assignees: assigneesMap.get(task.id) ?? [],
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

    return {
      message: 'Task fetched successfully.',
      data: rootTask,
    };
  }

  async getTaskTimeSummary(taskId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        estimatedMinutes: true,
        projectId: true,
        project: {
          select: {
            organizationId: true,
            deletedAt: true,
          },
        },
        assignees: {
          where: {
            removedAt: null,
          },
          select: {
            id: true,
            projectMemberId: true,
            estimatedMinutes: true,
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
                  },
                },
              },
            },
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

    const actualTimeGrouped = await this.prisma.timeEntry.groupBy({
      by: ['projectMemberId'],
      where: {
        taskId,
        deletedAt: null,
      },
      _sum: {
        durationMinutes: true,
      },
    });

    const actualMap = new Map<string, number>();
    let totalActualMinutes = 0;
    for (const group of actualTimeGrouped) {
      const sum = group._sum.durationMinutes ?? 0;
      actualMap.set(group.projectMemberId, sum);
      totalActualMinutes += sum;
    }

    let allocatedMinutes = 0;
    const assigneesSummary = task.assignees.map((assignee) => {
      const est = assignee.estimatedMinutes ?? 0;
      allocatedMinutes += est;
      const act = actualMap.get(assignee.projectMemberId) ?? 0;
      return {
        id: assignee.id,
        projectMemberId: assignee.projectMemberId,
        user: {
          id: assignee.projectMember.user.id,
          name: `${assignee.projectMember.user.firstName} ${assignee.projectMember.user.lastName || ''}`.trim(),
          avatar: assignee.projectMember.user.avatar,
        },
        estimatedMinutes: est,
        actualMinutes: act,
        remainingMinutes: est - act,
      };
    });

    const taskEstMinutes = task.estimatedMinutes ?? 0;
    const remainingMinutes = taskEstMinutes - totalActualMinutes;
    const unallocatedMinutes = taskEstMinutes - allocatedMinutes;

    return {
      task: {
        id: task.id,
        title: task.title,
      },
      estimatedMinutes: taskEstMinutes,
      actualMinutes: totalActualMinutes,
      remainingMinutes,
      allocatedMinutes,
      unallocatedMinutes,
      assignees: assigneesSummary,
    };
  }

  async updateAssigneeEstimate(
    taskId: string,
    assigneeId: string,
    estimatedMinutes: number,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);

    const taskAssignee = await this.prisma.taskAssignee.findFirst({
      where: {
        id: assigneeId,
        taskId,
        removedAt: null,
      },
      include: {
        task: {
          select: {
            projectId: true,
            project: {
              select: {
                organizationId: true,
              },
            },
          },
        },
        projectMember: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!taskAssignee) {
      throw new NotFoundException('Task assignee not found.');
    }

    if (taskAssignee.task.project.organizationId !== context.organizationId) {
      throw new ForbiddenException('Task does not belong to your organization.');
    }

    const oldEst = taskAssignee.estimatedMinutes;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.taskAssignee.update({
        where: { id: assigneeId },
        data: { estimatedMinutes },
      });

      const memberName = `${taskAssignee.projectMember.user.firstName} ${taskAssignee.projectMember.user.lastName || ''}`.trim();
      const formatMin = (m: number) => {
        const absM = Math.abs(m);
        const h = Math.floor(absM / 60);
        const remM = absM % 60;
        return h > 0 ? `${h}h ${remM}m` : `${remM}m`;
      };

      await tx.taskActivity.create({
        data: {
          taskId,
          userId: context.userId,
          eventType: 'ASSIGNEE_ESTIMATE_UPDATED',
          entityType: 'TASK_ASSIGNEE',
          entityId: assigneeId,
          oldValue: `${oldEst}m`,
          newValue: `${estimatedMinutes}m`,
          message: `Changed ${memberName}'s estimated effort from ${formatMin(oldEst)} to ${formatMin(estimatedMinutes)}.`,
        },
      });

      return res;
    });

    return {
      message: 'Assignee estimate updated successfully.',
      data: updated,
    };
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
