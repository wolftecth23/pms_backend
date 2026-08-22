import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthRequest } from '../auth/auth.controller';
import { ProjectAccessService } from '../common/access/project-access.service';
import { ContextService } from '../common/context/context.service';
import { CodeGeneratorService } from '../common/generator/code-generator.service';
import { ProjectStatusServiceValidation } from '../common/validation/project-status.service';
import { TaskStatusServiceValidation } from '../common/validation/task-status.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface ProjectContext {
  organizationId: string;
  workspaceId: string;
  userId: string;
  permissions: string[];
  hasPermission(permission: string): boolean;
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly projectAccessService: ProjectAccessService,

    private readonly contextService: ContextService,

    private readonly codeGenerator: CodeGeneratorService,

    private readonly projectStatusServiceValidation: ProjectStatusServiceValidation,

    private readonly taskStatusServiceValidation: TaskStatusServiceValidation,
  ) {}

  // create(createProjectDto: CreateProjectDto) {
  //   return this.prisma.project.create({
  //     data: createProjectDto,
  //   });
  // }

  // findAll() {
  //   return this.prisma.project.findMany();
  // }

  // findOne(id: string) {
  //   return this.prisma.project.findUnique({
  //     where: { id },
  //   });
  // }

  // update(id: string, updateProjectDto: UpdateProjectDto) {
  //   return this.prisma.project.update({
  //     where: { id },
  //     data: updateProjectDto,
  //   });
  // }

  // remove(id: string) {
  //   return this.prisma.project.update({
  //     where: { id },
  //     data: {
  //       deletedAt: new Date(),
  //     },
  //   });
  // }

  async create(dto: CreateProjectDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(
      request,
      dto.workspaceId,
      dto.organizationId,
    );

    const projectCode =
      dto.projectCode?.trim().toUpperCase() ??
      this.codeGenerator.generateProjectCode(dto.name);

    // Check duplicate key
    const existing = await this.prisma.project.findFirst({
      where: {
        organizationId: context.organizationId,
        projectCode: projectCode,
      },
    });

    if (existing) {
      throw new ConflictException('Project Code already exists');
    }

    // Validate project status
    await this.projectStatusServiceValidation.validateProjectStatus(
      dto.statusId,
      context.organizationId,
      context.workspaceId,
    );

    // return this.prisma.project.create({
    //   data: {
    //     workspaceId: context.workspaceId,
    //     organizationId: context.organizationId,
    //     createdById: context.userId,

    //     name: dto.name,
    //     key: dto.key.toUpperCase(),
    //     description: dto.description,
    //     projectCode: dto.projectCode,
    //     icon: dto.icon,

    //     statusId: dto.statusId,
    //     priority: dto.priority,
    //     visibility: dto.visibility,

    //     startDate: dto.startDate,
    //     dueDate: dto.dueDate,
    //   },
    //   include: {
    //     status: {
    //       select: {
    //         id: true,
    //         name: true,
    //         color: true,
    //       },
    //     },
    //   },
    // });

    const uniqueMemberIds = [
      ...new Set([context.userId, ...(dto.projectMemberIds ?? [])]),
    ];

    let validUserIds: Set<string> = new Set([]);

    // Validate project members (if updating members)
    if (dto.projectMemberIds?.length) {
      const workspaceMembers = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: context.workspaceId,
          userId: {
            in: uniqueMemberIds,
          },
          removedAt: null,
        },
        select: {
          userId: true,
        },
      });

      validUserIds = new Set(workspaceMembers.map((m) => m.userId));

      const invalidUserIds = uniqueMemberIds.filter(
        (userId) => !validUserIds.has(userId),
      );

      if (invalidUserIds.length) {
        throw new BadRequestException({
          message: 'Some users are not members of the workspace.',
          invalidUserIds,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          createdById: context.userId,

          name: dto.name,
          description: dto.description,
          projectCode: projectCode,
          icon: dto.icon || null,

          statusId: dto.statusId,
          priority: dto.priority,
          visibility: dto.visibility,

          startDate: dto.startDate || null,
          dueDate: dto.dueDate || null,
        },
        include: {
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      if (validUserIds.size) {
        await tx.projectMember.createMany({
          data: [...validUserIds].map((userId) => ({
            projectId: project.id,
            userId,
            // projectRoleId: dto.projectRoleId || null,
          })),
          skipDuplicates: true,
        });
      }

      return { data: project };
    });
  }

  async findByOrganization(request: AuthRequest) {
    const context = this.contextService.resolveOrganizationContext(request);

    const where: Prisma.ProjectWhereInput = {
      organizationId: context.organizationId,
      deletedAt: null,
    };

    if (!context.hasPermission('project.view_organization')) {
      where.members = {
        some: {
          userId: context.userId,
          removedAt: null,
        },
      };
    }

    return this.prisma.project.findMany({
      where,
      // where: {
      //   organizationId: context.organizationId,
      //   deletedAt: null,
      //   members: {
      //     some: {
      //       userId: context.userId,
      //       removedAt: null,
      //     },
      //   },
      // },
      include: {
        status: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByWorkspace(
    request: AuthRequest,
    page = 1,
    limit = 10,
    search?: string,
    statusId?: string,
  ) {
    const context = await this.contextService.resolveContext(request);

    const where: Prisma.ProjectWhereInput = {
      workspaceId: context.workspaceId,
      deletedAt: null,
    };

    if (!context.hasPermission('project.view_workspace')) {
      where.members = {
        some: {
          userId: context.userId,
          removedAt: null,
        },
      };
      where.isArchived = false;
    }

    if (search?.trim()) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          projectCode: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (statusId) {
      await this.projectStatusServiceValidation.validateProjectStatus(
        statusId,
        context.organizationId,
        context.workspaceId,
      );

      where.statusId = statusId;
    }

    const skip = (page - 1) * limit;

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          projectCode: true,
          description: true,
          icon: true,

          priority: true,
          visibility: true,

          startDate: true,
          dueDate: true,
          completedAt: true,

          isArchived: true,
          isFavorite: true,

          createdAt: true,

          status: {
            select: {
              id: true,
              name: true,
              color: true,
              isClosed: true,
            },
          },

          workspace: {
            select: {
              id: true,
              name: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },

          members: {
            where: {
              removedAt: null,
            },
            select: {
              // id: true,
              // joinedAt: true,
              user: {
                select: {
                  // id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      }),

      this.prisma.project.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: {
        data: projects,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      },
    };

    // return this.prisma.project.findMany({
    //   where,
    //   // where: {
    //   //   workspaceId: context.workspaceId,
    //   //   deletedAt: null,
    //   //   // members: {
    //   //   //   some: {
    //   //   //     userId: context.userId,
    //   //   //     removedAt: null,
    //   //   //   },
    //   //   // },
    //   // },
    //   include: {
    //     status: {
    //       select: {
    //         id: true,
    //         name: true,
    //         color: true,
    //       },
    //     },
    //     createdBy: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //       },
    //     },
    //     workspace: {
    //       select: {
    //         id: true,
    //         name: true,
    //       },
    //     },
    //   },
    //   orderBy: {
    //     createdAt: 'desc',
    //   },
    // });
  }

  async findOne(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const where: Prisma.ProjectWhereInput = {
      workspaceId: context.workspaceId,
      id,
      deletedAt: null,
    };

    if (
      !context.hasPermission('project.view_workspace') ||
      !context.hasPermission('project.view_organization')
    ) {
      where.members = {
        some: {
          userId: context.userId,
          removedAt: null,
        },
      };
    }

    const project = await this.prisma.project.findFirst({
      where,
      include: {
        status: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        members: {
          where: {
            removedAt: null,
          },
          orderBy: {
            joinedAt: 'asc',
          },
          select: {
            id: true,
            joinedAt: true,

            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                designation: true,
              },
            },
          },
        },
      },
    });

    console.log('project', project);

    if (!project) {
      throw new NotFoundException(
        'Project not found or you do not have access to it.',
      );
    }

    const taskStatuses =
      await this.taskStatusServiceValidation.findAvailableTaskStatuses(
        project.organizationId,
        project.workspaceId,
        project.id,
      );

    return {
      ...project,
      taskStatuses,
    };
  }

  async update(id: string, dto: UpdateProjectDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(
      request,
      dto.workspaceId,
      dto.organizationId,
    );

    // if (!context.hasPermission('project.update')) {
    //   throw new ForbiddenException(
    //     'You do not have permission to update projects.',
    //   );
    // }

    const project = await this.prisma.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        projectCode: true,
        statusId: true,
        startDate: true,
        dueDate: true,
        organizationId: true,
        workspaceId: true,
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

    const projectCode =
      dto.projectCode?.trim().toUpperCase() ?? project.projectCode;

    // Validate duplicate project code
    if (projectCode !== project.projectCode) {
      const existing = await this.prisma.project.findFirst({
        where: {
          organizationId: context.organizationId,
          projectCode,
          NOT: {
            id,
          },
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        throw new ConflictException('Project code already exists.');
      }
    }

    // Validate project status
    if (dto.statusId && dto.statusId !== project.statusId) {
      await this.projectStatusServiceValidation.validateProjectStatus(
        dto.statusId,
        context.organizationId,
        context.workspaceId,
        project.id,
      );
    }

    // Validate dates
    const startDate = dto.startDate ?? project.startDate;
    const dueDate = dto.dueDate ?? project.dueDate;

    if (startDate && dueDate && startDate > dueDate) {
      throw new BadRequestException(
        'Due date must be greater than or equal to start date.',
      );
    }

    const uniqueMemberIds = [
      ...new Set([context.userId, ...(dto.projectMemberIds ?? [])]),
    ];

    // Validate project members (if updating members)
    if (dto.projectMemberIds?.length) {
      const workspaceMembers = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: context.workspaceId,
          userId: {
            in: uniqueMemberIds,
          },
          removedAt: null,
        },
        select: {
          userId: true,
        },
      });

      const validUserIds = new Set(workspaceMembers.map((m) => m.userId));

      const invalidUserIds = uniqueMemberIds.filter(
        (userId) => !validUserIds.has(userId),
      );

      if (invalidUserIds.length) {
        throw new BadRequestException({
          message: 'Some users are not members of the workspace.',
          invalidUserIds,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: {
          id,
        },
        data: {
          name: dto.name,
          description: dto.description,
          projectCode,
          icon: dto.icon || null,

          statusId: dto.statusId,

          priority: dto.priority,
          visibility: dto.visibility,

          startDate: dto.startDate || null,
          dueDate: dto.dueDate || null,
          completedAt: dto.completedAt || null,

          isArchived: dto.isArchived || false,
          isFavorite: dto.isFavorite || false,
        },
        include: {
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      // Remove members not present in the new list
      await tx.projectMember.updateMany({
        where: {
          projectId: id,
          userId: {
            notIn: uniqueMemberIds,
          },
          removedAt: null,
        },
        data: {
          removedAt: new Date().toISOString(),
          removedById: context.userId,
        },
      });

      for (const userId of uniqueMemberIds) {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: id,
              userId,
            },
          },
          update: {
            projectRoleId: null,
            removedAt: null,
            removedById: null,
          },
          create: {
            projectId: id,
            userId,
            // projectRoleId: dto.projectRoleId || null,
          },
        });
      }

      return {
        message: 'Project updated successfully.',
        data: updatedProject,
      };
    });
  }

  async remove(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    // Verify project access
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        workspaceId: context.workspaceId,
        deletedAt: null,
        members: {
          some: {
            userId: context.userId,
            removedAt: null,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found or you do not have permission to delete it.',
      );
    }

    // Prevent deleting projects that still contain tasks
    const taskCount = await this.prisma.task.count({
      where: {
        projectId: id,
        deletedAt: null,
      },
    });

    if (taskCount > 0) {
      throw new BadRequestException(
        'Cannot delete a project that contains tasks.',
      );
    }

    await this.prisma.project.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Project deleted successfully.',
    };
  }

  async archive(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const project = await this.projectAccessService.findProjectOrThrow(
      id,
      context,
    );

    if (project.isArchived) {
      throw new BadRequestException('Project is already archived.');
    }

    return this.prisma.project.update({
      where: {
        id,
      },
      data: {
        isArchived: true,
      },
      include: {},
    });
  }

  async restore(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const project = await this.projectAccessService.findProjectOrThrow(
      id,
      context,
    );

    if (!project.isArchived) {
      throw new BadRequestException('Project is not archived.');
    }

    return this.prisma.project.update({
      where: {
        id,
      },
      data: {
        isArchived: false,
      },
      include: {},
    });
  }

  // async changeStatus(
  //   id: string,
  //   dto: ChangeProjectStatusDto,
  //   request: AuthRequest,
  // ) {
  //   const context = await this.contextService.resolveContext(request);

  //   const project = await this.projectAccessService.findProjectOrThrow(
  //     id,
  //     context,
  //   );

  //   await this.projectStatusServiceValidation.validateProjectStatus(
  //     dto.statusId,
  //     project.organizationId,
  //     project.workspaceId,
  //     project.id,
  //   );

  //   return this.prisma.project.update({
  //     where: {
  //       id,
  //     },
  //     data: {
  //       statusId: dto.statusId,
  //     },
  //     include: {},
  //   });
  // }

  async getProjectTimeSummary(projectId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: context.organizationId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const taskEstAggregate = await this.prisma.task.aggregate({
      where: {
        projectId,
        deletedAt: null,
      },
      _sum: {
        estimatedMinutes: true,
      },
    });
    const totalEstimatedMinutes = taskEstAggregate._sum.estimatedMinutes ?? 0;

    const assigneeEstGrouped = await this.prisma.taskAssignee.groupBy({
      by: ['projectMemberId'],
      where: {
        task: {
          projectId,
          deletedAt: null,
        },
        removedAt: null,
      },
      _sum: {
        estimatedMinutes: true,
      },
    });

    const assigneeEstMap = new Map<string, number>();
    let totalAllocatedMinutes = 0;
    for (const group of assigneeEstGrouped) {
      const sum = group._sum.estimatedMinutes ?? 0;
      assigneeEstMap.set(group.projectMemberId, sum);
      totalAllocatedMinutes += sum;
    }

    const actualTimeGrouped = await this.prisma.timeEntry.groupBy({
      by: ['projectMemberId'],
      where: {
        projectId,
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

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId,
      },
      include: {
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
    });

    const membersSummary = members.map((member) => {
      const est = assigneeEstMap.get(member.id) ?? 0;
      const act = actualMap.get(member.id) ?? 0;
      return {
        projectMemberId: member.id,
        user: {
          id: member.user.id,
          name: `${member.user.firstName} ${member.user.lastName || ''}`.trim(),
          avatar: member.user.avatar,
          designation: member.user.designation,
        },
        estimatedMinutes: est,
        actualMinutes: act,
        remainingMinutes: est - act,
      };
    });

    return {
      projectId,
      summary: {
        estimatedMinutes: totalEstimatedMinutes,
        allocatedMinutes: totalAllocatedMinutes,
        actualMinutes: totalActualMinutes,
        remainingMinutes: totalEstimatedMinutes - totalActualMinutes,
        unallocatedMinutes: totalEstimatedMinutes - totalAllocatedMinutes,
      },
      members: membersSummary,
    };
  }

  async getProjectTimeSummaryByDesignation(
    projectId: string,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: context.organizationId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId,
      },
      include: {
        user: {
          select: {
            designation: true,
          },
        },
      },
    });

    const memberDesignationMap = new Map<string, string>();
    for (const m of members) {
      memberDesignationMap.set(m.id, m.user.designation || 'Unspecified');
    }

    const assigneeEstGrouped = await this.prisma.taskAssignee.groupBy({
      by: ['projectMemberId'],
      where: {
        task: {
          projectId,
          deletedAt: null,
        },
        removedAt: null,
      },
      _sum: {
        estimatedMinutes: true,
      },
    });

    const actualTimeGrouped = await this.prisma.timeEntry.groupBy({
      by: ['projectMemberId'],
      where: {
        projectId,
        deletedAt: null,
      },
      _sum: {
        durationMinutes: true,
      },
    });

    const designationMap = new Map<
      string,
      { estimatedMinutes: number; actualMinutes: number }
    >();

    const getOrCreateBucket = (desig: string) => {
      if (!designationMap.has(desig)) {
        designationMap.set(desig, { estimatedMinutes: 0, actualMinutes: 0 });
      }
      return designationMap.get(desig)!;
    };

    for (const group of assigneeEstGrouped) {
      const desig =
        memberDesignationMap.get(group.projectMemberId) ?? 'Unspecified';
      const bucket = getOrCreateBucket(desig);
      bucket.estimatedMinutes += group._sum.estimatedMinutes ?? 0;
    }

    for (const group of actualTimeGrouped) {
      const desig =
        memberDesignationMap.get(group.projectMemberId) ?? 'Unspecified';
      const bucket = getOrCreateBucket(desig);
      bucket.actualMinutes += group._sum.durationMinutes ?? 0;
    }

    const designations = Array.from(designationMap.entries()).map(
      ([designation, data]) => ({
        designation,
        estimatedMinutes: data.estimatedMinutes,
        actualMinutes: data.actualMinutes,
        remainingMinutes: data.estimatedMinutes - data.actualMinutes,
      }),
    );

    return {
      projectId,
      designations,
    };
  }
}
