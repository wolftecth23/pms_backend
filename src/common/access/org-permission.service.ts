import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrgPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgMember(userId: string, organizationId: string) {
    if (!userId || !organizationId) {
      return null;
    }

    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        removedAt: null,
        isActive: true,
        user: {
          isActive: true,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            ownerId: true,
          },
        },
        role: {
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

  async getOrgMemberOrThrow(userId: string, organizationId: string) {
    const member = await this.getOrgMember(userId, organizationId);

    if (!member) {
      throw new ForbiddenException({
        message:
          'You are not a member of this organization or do not have access.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    return member;
  }

  async getOrgMemberPermissions(
    userId: string,
    organizationId: string,
  ): Promise<string[]> {
    const member = await this.getOrgMember(userId, organizationId);
    if (!member || !member.role) {
      return [];
    }

    const permissions =
      member.role.permissions?.map((rp) => rp.permission?.code) ?? [];

    const activePermissions = permissions.filter(Boolean);

    // If user is organization owner or has wildcard, include '*'
    if (
      member.organization?.ownerId === userId &&
      !activePermissions.includes('*')
    ) {
      activePermissions.push('*');
    }

    return activePermissions;
  }

  async hasOrgPermission(
    userId: string,
    organizationId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const member = await this.getOrgMember(userId, organizationId);
    if (!member) {
      return false;
    }

    if (member.organization?.ownerId === userId) {
      return true;
    }

    if (!member.role) {
      return false;
    }

    const permissions =
      member.role.permissions?.map((rp) => rp.permission?.code) ?? [];

    if (permissions.includes('*')) {
      return true;
    }

    return permissions.includes(permissionCode);
  }

  async hasAnyOrgPermission(
    userId: string,
    organizationId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const member = await this.getOrgMember(userId, organizationId);
    if (!member) {
      return false;
    }

    if (member.organization?.ownerId === userId) {
      return true;
    }

    if (!member.role) {
      return false;
    }

    const permissions =
      member.role.permissions?.map((rp) => rp.permission?.code) ?? [];

    if (permissions.includes('*')) {
      return true;
    }

    return permissionCodes.some((code) => permissions.includes(code));
  }
}
