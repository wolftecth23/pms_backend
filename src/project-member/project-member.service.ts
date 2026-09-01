import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusScope } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { ProjectAccessService } from '../common/access/project-access.service';
import { ProjectPermissionService } from '../common/access/project-permission.service';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto';

@Injectable()
export class ProjectMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectPermissionService: ProjectPermissionService,
    private readonly contextService: ContextService,
  ) {}

  async findAvailableRoles(projectId?: string) {
    return this.prisma.role.findMany({
       where: {
         scope: StatusScope.PROJECT,
         deletedAt: null,
         ...(projectId
           ? {
               OR: [
                 { isSystem: true, projectId: null },
                 { projectId },
               ],
             }
           : {}),
       },
       select: {
         id: true,
         name: true,
         description: true,
         scope: true,
         isSystem: true,
         projectId: true,
         permissions: {
           where: {
             isActive: true,
             deletedAt: null,
           },
           include: {
             permission: {
               select: {
                 id: true,
                 code: true,
                 name: true,
                 module: true,
               },
             },
           },
         },
       },
       orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findMembers(projectId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    await this.projectAccessService.findProjectOrThrow(projectId, context);

    return this.prisma.projectMember.findMany({
      where: {
        projectId,
        removedAt: null,
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
            isActive: true,
          },
        },
        projectRole: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: {
              where: {
                isActive: true,
                deletedAt: null,
              },
              include: {
                permission: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    module: true,
                  },
                },
              },
            },
          },
        },
        removedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });
  }

  async addMember(
    projectId: string,
    dto: AddProjectMemberDto,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);

    const project = await this.projectAccessService.findProjectOrThrow(
      projectId,
      context,
    );

    //
    // Validate user belongs to organization
    //
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: project.organizationId,
        userId: dto.userId,
        removedAt: null,
      },
    });

    if (!organizationMember) {
      throw new BadRequestException(
        'User is not a member of this organization.',
      );
    }

    //
    // Validate workspace membership
    //
    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId,
        userId: dto.userId,
        removedAt: null,
      },
    });

    if (!workspaceMember) {
      throw new BadRequestException('User is not a member of this workspace.');
    }

    //
    // Determine and validate project role
    //
    let targetRoleId = dto.projectRoleId;
    if (targetRoleId) {
      const assignedRole = await this.prisma.role.findUnique({
        where: { id: targetRoleId },
      });
      if (!assignedRole || assignedRole.deletedAt) {
        throw new NotFoundException('Selected project role not found.');
      }
      if (assignedRole.scope !== StatusScope.PROJECT) {
        throw new BadRequestException(
          'Selected role must be a project-scoped role.',
        );
      }
      if (
        assignedRole.projectId !== null &&
        assignedRole.projectId !== projectId
      ) {
        throw new BadRequestException(
          'Selected role does not belong to this project.',
        );
      }
    } else {
      const teamMemberRole = await this.prisma.role.findFirst({
        where: {
          name: 'Team Member',
          scope: StatusScope.PROJECT,
          isSystem: true,
        },
      });
      targetRoleId = teamMemberRole?.id;
    }

    //
    // Already exists?
    //
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: dto.userId,
        },
      },
    });

    if (existing && !existing.removedAt) {
      throw new ConflictException('User is already a project member.');
    }

    //
    // Restore removed member
    //
    if (existing) {
      return this.prisma.projectMember.update({
        where: {
          id: existing.id,
        },
        data: {
          removedAt: null,
          removedById: null,
          projectRoleId: targetRoleId || null,
        },
        include: {
          user: true,
          projectRole: true,
        },
      });
    }

    //
    // Create
    //
    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        projectRoleId: targetRoleId || null,
      },
      include: {
        user: true,
        projectRole: true,
      },
    });
  }

  async updateMemberRole(
    projectId: string,
    memberId: string,
    dto: UpdateProjectMemberRoleDto,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId,
        removedAt: null,
      },
      include: {
        projectRole: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Project member not found.');
    }

    // Check new role exists and is project-scoped
    const newRole = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!newRole || newRole.deletedAt) {
      throw new NotFoundException('Target role not found.');
    }

    if (newRole.scope !== StatusScope.PROJECT) {
      throw new BadRequestException(
        'Selected role must be a project-scoped role.',
      );
    }

    if (newRole.projectId !== null && newRole.projectId !== projectId) {
      throw new BadRequestException(
        'Selected role does not belong to this project.',
      );
    }

    // If currently a Project Owner and demoting to a non-Project Owner role
    if (
      member.projectRole?.name === 'Project Owner' &&
      newRole.name !== 'Project Owner'
    ) {
      const ownerCount =
        await this.projectPermissionService.countProjectOwners(projectId);
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot change role of the last project Owner. Please assign another Owner first.',
        );
      }
    }

    const updated = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        projectRoleId: dto.roleId,
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
        projectRole: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    return {
      message: 'Project member role updated successfully.',
      data: updated,
    };
  }

  async removeMember(
    projectId: string,
    memberId: string,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId,
        removedAt: null,
      },
      include: {
        projectRole: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Project member not found.');
    }

    // Block removing the sole Project Owner
    if (member.projectRole?.name === 'Project Owner') {
      const ownerCount =
        await this.projectPermissionService.countProjectOwners(projectId);
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last project Owner. Please assign another Owner before removing this member.',
        );
      }
    }

    await this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        removedAt: new Date(),
        removedById: context.userId,
      },
    });

    return {
      message: 'Project member removed successfully.',
    };
  }
}

