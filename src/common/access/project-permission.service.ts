import { ForbiddenException, Injectable } from '@nestjs/common';
import { StatusScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrgPermissionService } from './org-permission.service';

@Injectable()
export class ProjectPermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgPermissionService: OrgPermissionService,
  ) {}

  async getProjectMember(userId: string, projectId: string) {
    if (!userId || !projectId) {
      return null;
    }

    return this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        removedAt: null,
        user: {
          isActive: true,
        },
      },
      include: {
        projectRole: {
          include: {
            permissions: {
              where: {
                isActive: true,
                deletedAt: null,
              },
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  async getProjectMemberOrThrow(userId: string, projectId: string) {
    const member = await this.getProjectMember(userId, projectId);

    if (!member) {
      throw new ForbiddenException({
        message: 'You are not a member of this project or do not have access.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    return member;
  }

  async getProjectMemberPermissions(
    userId: string,
    projectId: string,
  ): Promise<string[]> {
    const member = await this.getProjectMember(userId, projectId);
    if (!member || !member.projectRole) {
      const isOwnerOrAdmin = await this.checkOrgOwnerOrAdminForProject(
        userId,
        projectId,
      );
      if (isOwnerOrAdmin) {
        return ['*'];
      }
      return [];
    }

    const permissions =
      member.projectRole.permissions?.map((rp) => rp.permission?.code) ?? [];

    const result = permissions.filter(Boolean);
    const isOwnerOrAdmin = await this.checkOrgOwnerOrAdminForProject(
      userId,
      projectId,
    );
    if (isOwnerOrAdmin && !result.includes('*')) {
      result.push('*');
    }

    return result;
  }

  async hasProjectPermission(
    userId: string,
    projectId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const member = await this.getProjectMember(userId, projectId);
    if (!member || !member.projectRole) {
      return this.checkOrgOwnerOrAdminForProject(userId, projectId);
    }

    const permissions =
      member.projectRole.permissions?.map((rp) => rp.permission?.code) ?? [];

    if (permissions.includes('*')) {
      return true;
    }

    if (permissions.includes(permissionCode)) {
      return true;
    }

    return this.checkOrgOwnerOrAdminForProject(userId, projectId);
  }

  async hasAnyProjectPermission(
    userId: string,
    projectId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const member = await this.getProjectMember(userId, projectId);
    if (!member || !member.projectRole) {
      return this.checkOrgOwnerOrAdminForProject(userId, projectId);
    }

    const permissions =
      member.projectRole.permissions?.map((rp) => rp.permission?.code) ?? [];

    if (permissions.includes('*')) {
      return true;
    }

    if (permissionCodes.some((code) => permissions.includes(code))) {
      return true;
    }

    return this.checkOrgOwnerOrAdminForProject(userId, projectId);
  }

  private async checkOrgOwnerOrAdminForProject(
    userId: string,
    projectId: string,
  ): Promise<boolean> {
    if (!userId || !projectId) return false;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project?.organizationId) return false;
    return this.orgPermissionService.isOrgAdminOrOwner(
      userId,
      project.organizationId,
    );
  }

  async countProjectOwners(projectId: string): Promise<number> {
    return this.prisma.projectMember.count({
      where: {
        projectId,
        removedAt: null,
        projectRole: {
          name: 'Project Owner',
          scope: StatusScope.PROJECT,
        },
      },
    });
  }
}
