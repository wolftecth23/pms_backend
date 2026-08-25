import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
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
import { computeTaskTimeEffort } from './helpers/task-time.helper';
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
    private readonly storageService: StorageService,
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
        data: {
          ...task,
          ...computeTaskTimeEffort(task),
        },
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

    const mappedTasks = tasks.map((task) => ({
      ...task,
      ...computeTaskTimeEffort(task),
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

        purchaseMinutes: true,
        estimatedMinutes: true,
        spentMinutes: true,

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

      /*
    await tx.taskActivity.create({
      data: {
        taskId: id,
        userId: context.userId,
        action: TaskActivityAction.TASK_UPDATED,
      },
    });
    */

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
