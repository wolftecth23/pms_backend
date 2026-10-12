import { Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectContext } from '../../project/project.service';
import { OrgPermissionService } from './org-permission.service';

@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgPermissionService: OrgPermissionService,
  ) {}

  async findProjectOrThrow(
    projectId: string,
    context: ProjectContext,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      include: {
        members: {
          where: {
            userId: context.userId,
            removedAt: null,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found or you do not have permission to access it.',
      );
    }

    const isMember = project.members && project.members.length > 0;
    if (isMember) {
      return project;
    }

    const isOwnerOrAdmin = await this.orgPermissionService.isOrgAdminOrOwner(
      context.userId,
      context.organizationId,
    );

    if (
      isOwnerOrAdmin ||
      context.hasPermission('project.view_workspace') ||
      context.hasPermission('project.view_organization')
    ) {
      return project;
    }

    throw new NotFoundException(
      'Project not found or you do not have permission to access it.',
    );
  }
}
