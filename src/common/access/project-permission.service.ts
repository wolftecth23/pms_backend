import { ForbiddenException, Injectable } from '@nestjs/common';
import { StatusScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectPermissionService {
  constructor(private readonly prisma: PrismaService) {}

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
      return [];
    }

    const permissions =
      member.projectRole.permissions?.map((rp) => rp.permission?.code) ?? [];

    return permissions.filter(Boolean);
  }

  async hasProjectPermission(
    userId: string,
    projectId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const member = await this.getProjectMember(userId, projectId);
    if (!member) {
      return false;
    }

    if (!member.projectRole) {
      return false;
    }

    const permissions =
      member.projectRole.permissions?.map((rp) => rp.permission?.code) ?? [];

    if (permissions.includes('*')) {
      return true;
    }

    return permissions.includes(permissionCode);
  }

  async hasAnyProjectPermission(
    userId: string,
    projectId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const member = await this.getProjectMember(userId, projectId);
    if (!member) {
      return false;
    }

    if (!member.projectRole) {
      return false;
    }

    const permissions =
      member.projectRole.permissions?.map((rp) => rp.permission?.code) ?? [];

    if (permissions.includes('*')) {
      return true;
    }

    return permissionCodes.some((code) => permissions.includes(code));
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
