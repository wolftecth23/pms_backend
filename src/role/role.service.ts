import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusScope } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { OrgPermissionService } from '../common/access/org-permission.service';
import { OrganizationAccessService } from '../common/access/organization-access.service';
import { ProjectAccessService } from '../common/access/project-access.service';
import { ProjectPermissionService } from '../common/access/project-permission.service';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgRoleDto } from './dto/create-org-role.dto';
import { CreateProjectRoleDto } from './dto/create-project-role.dto';
import { UpdateOrgRoleDto } from './dto/update-org-role.dto';
import { UpdateProjectRoleDto } from './dto/update-project-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

export const PROJECT_ALLOWED_MODULES = [
  'PROJECT',
  'PROJECT_MEMBER',
  'TASK',
  'TASK_STATUS',
  'COMMENT',
  'ROLE',
] as const;

export const ORG_ALLOWED_MODULES = [
  'ORGANIZATION',
  'ORGANIZATION_MEMBER',
  'USER',
  'WORKSPACE',
  'WORKSPACE_MEMBER',
  'PROJECT',
  'CHANGE_REQUEST',
  'TEAM',
  'ROLE',
] as const;

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectPermissionService: ProjectPermissionService,
    private readonly organizationAccessService: OrganizationAccessService,
    private readonly orgPermissionService: OrgPermissionService,
    private readonly contextService: ContextService,
  ) {}

  /**
   * Get all assignable permissions for project roles.
   * Excludes system/organization level permissions (organization, workspace, user).
   */
  async getAvailableProjectPermissions(
    projectId: string,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const permissions = await this.prisma.permission.findMany({
      where: {
        module: {
          in: [...PROJECT_ALLOWED_MODULES],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        module: true,
      },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    return permissions;
  }

  /**
   * List all roles applicable to a specific project.
   * Includes both default system project roles and custom roles created in this project.
   */
  async findProjectRoles(projectId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const roles = await this.prisma.role.findMany({
      where: {
        scope: StatusScope.PROJECT,
        deletedAt: null,
        OR: [
          { isSystem: true, projectId: null },
          { projectId },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
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
                description: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            projectRoles: {
              where: {
                projectId,
                removedAt: null,
              },
            },
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((role) => ({
      ...role,
      memberCount: role._count.projectRoles,
    }));
  }

  /**
   * Get single project role details with permissions and assigned member count.
   */
  async findProjectRoleById(
    projectId: string,
    roleId: string,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        scope: StatusScope.PROJECT,
        deletedAt: null,
        OR: [
          { isSystem: true, projectId: null },
          { projectId },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
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
                description: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            projectRoles: {
              where: {
                projectId,
                removedAt: null,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Project role not found.');
    }

    return {
      ...role,
      memberCount: role._count.projectRoles,
    };
  }

  /**
   * Create a new custom role scoped to a specific project.
   * Blocks creating system roles or roles outside the project scope.
   */
  async createProjectRole(
    projectId: string,
    dto: CreateProjectRoleDto,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    const project = await this.projectAccessService.findProjectOrThrow(
      projectId,
      context,
    );

    const normalizedName = dto.name.trim();

    // Check if role name already exists in this project (either system role or custom role)
    const existing = await this.prisma.role.findFirst({
      where: {
        scope: StatusScope.PROJECT,
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
        deletedAt: null,
        OR: [
          { isSystem: true, projectId: null },
          { projectId },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        `A role with the name "${normalizedName}" already exists in this project.`,
      );
    }

    // Validate permission IDs if provided
    let validPermissionIds: string[] = [];
    if (dto.permissionIds && dto.permissionIds.length > 0) {
      const uniqueRequestedIds = Array.from(new Set(dto.permissionIds));

      const foundPermissions = await this.prisma.permission.findMany({
        where: {
          id: { in: uniqueRequestedIds },
          deletedAt: null,
        },
      });

      if (foundPermissions.length !== uniqueRequestedIds.length) {
        throw new BadRequestException('One or more selected permissions were not found.');
      }

      // Ensure all permissions belong to allowed project modules
      const disallowed = foundPermissions.filter(
        (p) => !PROJECT_ALLOWED_MODULES.includes(p.module as any),
      );
      if (disallowed.length > 0) {
        throw new BadRequestException(
          `Permissions from organization/system modules cannot be assigned to project roles: ${disallowed.map((p) => p.code).join(', ')}`,
        );
      }

      // Anti-privilege escalation check:
      // Caller must hold all permissions being granted (unless caller is Super Admin with '*')
      const callerPermissions =
        await this.projectPermissionService.getProjectMemberPermissions(
          context.userId,
          projectId,
        );

      const isSuperAdmin = callerPermissions.includes('*');
      if (!isSuperAdmin) {
        const missing = foundPermissions.filter(
          (p) => !callerPermissions.includes(p.code),
        );
        if (missing.length > 0) {
          throw new ForbiddenException(
            `You cannot grant permissions that you do not possess: ${missing.map((p) => p.code).join(', ')}`,
          );
        }
      }

      validPermissionIds = foundPermissions.map((p) => p.id);
    }

    // Create custom project role
    const newRole = await this.prisma.role.create({
      data: {
        name: normalizedName,
        description: dto.description?.trim() || null,
        scope: StatusScope.PROJECT,
        isSystem: false,
        projectId,
        organizationId: project.organizationId,
        permissions: {
          create: validPermissionIds.map((permissionId) => ({
            permissionId,
            isActive: true,
          })),
        },
      },
      include: {
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
                description: true,
                module: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Project role created successfully.',
      data: {
        ...newRole,
        memberCount: 0,
      },
    };
  }

  /**
   * Update name or description of a custom project role.
   * System roles are protected and cannot be modified.
   */
  async updateProjectRole(
    projectId: string,
    roleId: string,
    dto: UpdateProjectRoleDto,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException('Role not found.');
    }

    // System role protection
    if (role.isSystem) {
      throw new ForbiddenException(
        'System roles are protected and cannot be modified.',
      );
    }

    // Project isolation check
    if (role.projectId !== projectId || role.scope !== StatusScope.PROJECT) {
      throw new ForbiddenException(
        'You can only modify custom roles that belong to this project.',
      );
    }

    // Name uniqueness check if name is being updated
    if (dto.name && dto.name.trim() !== role.name) {
      const normalizedName = dto.name.trim();

      const existing = await this.prisma.role.findFirst({
        where: {
          id: { not: roleId },
          scope: StatusScope.PROJECT,
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
          deletedAt: null,
          OR: [
            { isSystem: true, projectId: null },
            { projectId },
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          `A role with the name "${normalizedName}" already exists in this project.`,
        );
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
      },
      include: {
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
                description: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            projectRoles: {
              where: {
                projectId,
                removedAt: null,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Project role updated successfully.',
      data: {
        ...updatedRole,
        memberCount: updatedRole._count.projectRoles,
      },
    };
  }

  /**
   * Update permissions of a custom project role.
   * System roles are protected and cannot have their permissions altered.
   */
  async updateRolePermissions(
    projectId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException('Role not found.');
    }

    // System role protection
    if (role.isSystem) {
      throw new ForbiddenException(
        'System role permissions are protected and cannot be changed.',
      );
    }

    // Project isolation check
    if (role.projectId !== projectId || role.scope !== StatusScope.PROJECT) {
      throw new ForbiddenException(
        'You can only manage permissions for custom roles belonging to this project.',
      );
    }

    const uniqueRequestedIds = Array.from(new Set(dto.permissionIds));

    const foundPermissions = await this.prisma.permission.findMany({
      where: {
        id: { in: uniqueRequestedIds },
        deletedAt: null,
      },
    });

    if (foundPermissions.length !== uniqueRequestedIds.length) {
      throw new BadRequestException('One or more selected permissions were not found.');
    }

    // Ensure all permissions belong to allowed project modules
    const disallowed = foundPermissions.filter(
      (p) => !PROJECT_ALLOWED_MODULES.includes(p.module as any),
    );
    if (disallowed.length > 0) {
      throw new BadRequestException(
        `Permissions from organization/system modules cannot be assigned to project roles: ${disallowed.map((p) => p.code).join(', ')}`,
      );
    }

    // Anti-privilege escalation check
    const callerPermissions =
      await this.projectPermissionService.getProjectMemberPermissions(
        context.userId,
        projectId,
      );

    const isSuperAdmin = callerPermissions.includes('*');
    if (!isSuperAdmin) {
      const missing = foundPermissions.filter(
        (p) => !callerPermissions.includes(p.code),
      );
      if (missing.length > 0) {
        throw new ForbiddenException(
          `You cannot grant permissions that you do not possess: ${missing.map((p) => p.code).join(', ')}`,
        );
      }
    }

    const targetPermissionIdSet = new Set(foundPermissions.map((p) => p.id));

    // Get current role permissions
    const existingRolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
    });

    // Determine records to create, update, or deactivate
    const existingMap = new Map(
      existingRolePermissions.map((rp) => [rp.permissionId, rp]),
    );

    await this.prisma.$transaction(async (tx) => {
      // Deactivate permissions not in target list
      for (const rp of existingRolePermissions) {
        if (!targetPermissionIdSet.has(rp.permissionId)) {
          if (rp.isActive) {
            await tx.rolePermission.update({
              where: { id: rp.id },
              data: { isActive: false },
            });
          }
        }
      }

      // Activate or create permissions in target list
      for (const permId of targetPermissionIdSet) {
        const existing = existingMap.get(permId);
        if (existing) {
          if (!existing.isActive || existing.deletedAt) {
            await tx.rolePermission.update({
              where: { id: existing.id },
              data: { isActive: true, deletedAt: null },
            });
          }
        } else {
          await tx.rolePermission.create({
            data: {
              roleId,
              permissionId: permId,
              isActive: true,
            },
          });
        }
      }
    });

    const updatedRole = await this.findProjectRoleById(
      projectId,
      roleId,
      request,
    );

    return {
      message: 'Role permissions updated successfully.',
      data: updatedRole,
    };
  }

  /**
   * Delete a custom project role.
   * System roles cannot be deleted.
   * If any project members are assigned to this role, they are automatically reassigned to default "Team Member" role.
   */
  async deleteProjectRole(
    projectId: string,
    roleId: string,
    request: AuthRequest,
  ) {
    const context = await this.contextService.resolveContext(request);
    await this.projectAccessService.findProjectOrThrow(projectId, context);

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException('Role not found.');
    }

    // System role protection
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted.');
    }

    // Project isolation check
    if (role.projectId !== projectId || role.scope !== StatusScope.PROJECT) {
      throw new ForbiddenException(
        'You can only delete custom roles that belong to this project.',
      );
    }

    // Check if any active project members use this role
    const assignedMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId,
        projectRoleId: roleId,
        removedAt: null,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (assignedMembers.length > 0) {
        // Find default fallback "Team Member" role
        const defaultTeamMemberRole = await tx.role.findFirst({
          where: {
            scope: StatusScope.PROJECT,
            name: 'Team Member',
            isSystem: true,
          },
        });

        const fallbackRoleId = defaultTeamMemberRole?.id ?? null;

        // Reassign affected members
        await tx.projectMember.updateMany({
          where: {
            projectId,
            projectRoleId: roleId,
            removedAt: null,
          },
          data: {
            projectRoleId: fallbackRoleId,
          },
        });
      }

      // Soft-delete the role
      await tx.role.update({
        where: { id: roleId },
        data: {
          deletedAt: new Date(),
        },
      });

      // Deactivate role permissions
      await tx.rolePermission.updateMany({
        where: { roleId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });
    });

    return {
      message: `Project role deleted successfully.${
        assignedMembers.length > 0
          ? ` ${assignedMembers.length} member(s) were reassigned to the default Team Member role.`
          : ''
      }`,
    };
  }

  // ─── ORGANIZATION ROLE METHODS ──────────────────────────────────────────────

  /**
   * Get all assignable permissions for organization roles.
   * Excludes project-scoped permissions (task, task_status, comment, project_member).
   */
  async getAvailableOrgPermissions(
    orgId: string,
    request: AuthRequest,
  ) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const permissions = await this.prisma.permission.findMany({
      where: {
        module: {
          in: [...ORG_ALLOWED_MODULES],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        module: true,
      },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    return permissions;
  }

  /**
   * List all roles applicable to a specific organization.
   * Includes both system default roles and custom organization-created roles.
   */
  async findOrgRoles(orgId: string, request: AuthRequest) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const roles = await this.prisma.role.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            scope: StatusScope.SYSTEM,
            isSystem: true,
            organizationId: null,
            projectId: null,
          },
          {
            scope: StatusScope.ORGANIZATION,
            organizationId: orgId,
            projectId: null,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        organizationId: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
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
                description: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            organizationMember: {
              where: {
                organizationId: orgId,
                removedAt: null,
              },
            },
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((role) => ({
      ...role,
      memberCount: role._count.organizationMember,
    }));
  }

  /**
   * Get single organization role details with permissions and assigned member count.
   */
  async findOrgRoleById(
    orgId: string,
    roleId: string,
    request: AuthRequest,
  ) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        deletedAt: null,
        OR: [
          {
            scope: StatusScope.SYSTEM,
            isSystem: true,
            organizationId: null,
            projectId: null,
          },
          {
            scope: StatusScope.ORGANIZATION,
            organizationId: orgId,
            projectId: null,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
        organizationId: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
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
                description: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            organizationMember: {
              where: {
                organizationId: orgId,
                removedAt: null,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Organization role not found.');
    }

    return {
      ...role,
      memberCount: role._count.organizationMember,
    };
  }

  /**
   * Create a new custom role scoped to a specific organization.
   */
  async createOrgRole(
    orgId: string,
    dto: CreateOrgRoleDto,
    request: AuthRequest,
  ) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const userId = request.user?.id ?? (request.user as any)?.userId;
    const normalizedName = dto.name.trim();

    // Check if role name already exists in this organization (system or custom)
    const existing = await this.prisma.role.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
        deletedAt: null,
        OR: [
          {
            scope: StatusScope.SYSTEM,
            isSystem: true,
            organizationId: null,
            projectId: null,
          },
          {
            scope: StatusScope.ORGANIZATION,
            organizationId: orgId,
            projectId: null,
          },
        ],
      },
    });

    if (existing) {
      throw new ConflictException(
        `A role with the name "${normalizedName}" already exists in this organization.`,
      );
    }

    // Validate permission IDs if provided
    let validPermissionIds: string[] = [];
    if (dto.permissionIds && dto.permissionIds.length > 0) {
      const uniqueRequestedIds = Array.from(new Set(dto.permissionIds));

      const foundPermissions = await this.prisma.permission.findMany({
        where: {
          id: { in: uniqueRequestedIds },
          deletedAt: null,
        },
      });

      if (foundPermissions.length !== uniqueRequestedIds.length) {
        throw new BadRequestException('One or more selected permissions were not found.');
      }

      // Ensure all permissions belong to allowed org modules
      const disallowed = foundPermissions.filter(
        (p) => !ORG_ALLOWED_MODULES.includes(p.module as any),
      );
      if (disallowed.length > 0) {
        throw new BadRequestException(
          `Permissions from project-only modules cannot be assigned to organization roles: ${disallowed.map((p) => p.code).join(', ')}`,
        );
      }

      // Anti-privilege escalation check:
      // Caller must hold all permissions being granted (unless caller has '*')
      const callerPermissions =
        await this.orgPermissionService.getOrgMemberPermissions(userId, orgId);

      const isSuperAdmin = callerPermissions.includes('*');
      if (!isSuperAdmin) {
        const missing = foundPermissions.filter(
          (p) => !callerPermissions.includes(p.code),
        );
        if (missing.length > 0) {
          throw new ForbiddenException(
            `You cannot grant permissions that you do not possess: ${missing.map((p) => p.code).join(', ')}`,
          );
        }
      }

      validPermissionIds = foundPermissions.map((p) => p.id);
    }

    // Create custom organization role
    const newRole = await this.prisma.role.create({
      data: {
        name: normalizedName,
        description: dto.description?.trim() || null,
        scope: StatusScope.ORGANIZATION,
        isSystem: false,
        organizationId: orgId,
        projectId: null,
        permissions: {
          create: validPermissionIds.map((permissionId) => ({
            permissionId,
            isActive: true,
          })),
        },
      },
      include: {
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
                description: true,
                module: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Organization role created successfully.',
      data: {
        ...newRole,
        memberCount: 0,
      },
    };
  }

  /**
   * Update name or description of a custom organization role.
   * System roles are protected and cannot be modified.
   */
  async updateOrgRole(
    orgId: string,
    roleId: string,
    dto: UpdateOrgRoleDto,
    request: AuthRequest,
  ) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException('Role not found.');
    }

    // System role protection
    if (role.isSystem) {
      throw new ForbiddenException(
        'System roles are protected and cannot be modified.',
      );
    }

    // Organization isolation check
    if (role.organizationId !== orgId || role.scope !== StatusScope.ORGANIZATION) {
      throw new ForbiddenException(
        'You can only modify custom roles that belong to this organization.',
      );
    }

    // Name uniqueness check if name is being updated
    if (dto.name && dto.name.trim() !== role.name) {
      const normalizedName = dto.name.trim();

      const existing = await this.prisma.role.findFirst({
        where: {
          id: { not: roleId },
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
          deletedAt: null,
          OR: [
            {
              scope: StatusScope.SYSTEM,
              isSystem: true,
              organizationId: null,
              projectId: null,
            },
            {
              scope: StatusScope.ORGANIZATION,
              organizationId: orgId,
              projectId: null,
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          `A role with the name "${normalizedName}" already exists in this organization.`,
        );
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
      },
      include: {
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
                description: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            organizationMember: {
              where: {
                organizationId: orgId,
                removedAt: null,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Organization role updated successfully.',
      data: {
        ...updatedRole,
        memberCount: updatedRole._count.organizationMember,
      },
    };
  }

  /**
   * Update permissions of a custom organization role.
   * System roles are protected and cannot have their permissions altered.
   */
  async updateOrgRolePermissions(
    orgId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
    request: AuthRequest,
  ) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const userId = request.user?.id ?? (request.user as any)?.userId;

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException('Role not found.');
    }

    // System role protection
    if (role.isSystem) {
      throw new ForbiddenException(
        'System role permissions are protected and cannot be changed.',
      );
    }

    // Organization isolation check
    if (role.organizationId !== orgId || role.scope !== StatusScope.ORGANIZATION) {
      throw new ForbiddenException(
        'You can only manage permissions for custom roles belonging to this organization.',
      );
    }

    const uniqueRequestedIds = Array.from(new Set(dto.permissionIds));

    const foundPermissions = await this.prisma.permission.findMany({
      where: {
        id: { in: uniqueRequestedIds },
        deletedAt: null,
      },
    });

    if (foundPermissions.length !== uniqueRequestedIds.length) {
      throw new BadRequestException('One or more selected permissions were not found.');
    }

    // Ensure all permissions belong to allowed org modules
    const disallowed = foundPermissions.filter(
      (p) => !ORG_ALLOWED_MODULES.includes(p.module as any),
    );
    if (disallowed.length > 0) {
      throw new BadRequestException(
        `Permissions from project-only modules cannot be assigned to organization roles: ${disallowed.map((p) => p.code).join(', ')}`,
      );
    }

    // Anti-privilege escalation check
    const callerPermissions =
      await this.orgPermissionService.getOrgMemberPermissions(userId, orgId);

    const isSuperAdmin = callerPermissions.includes('*');
    if (!isSuperAdmin) {
      const missing = foundPermissions.filter(
        (p) => !callerPermissions.includes(p.code),
      );
      if (missing.length > 0) {
        throw new ForbiddenException(
          `You cannot grant permissions that you do not possess: ${missing.map((p) => p.code).join(', ')}`,
        );
      }
    }

    const targetPermissionIdSet = new Set(foundPermissions.map((p) => p.id));

    // Get current role permissions
    const existingRolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
    });

    const existingMap = new Map(
      existingRolePermissions.map((rp) => [rp.permissionId, rp]),
    );

    await this.prisma.$transaction(async (tx) => {
      // Deactivate permissions not in target list
      for (const rp of existingRolePermissions) {
        if (!targetPermissionIdSet.has(rp.permissionId)) {
          if (rp.isActive) {
            await tx.rolePermission.update({
              where: { id: rp.id },
              data: { isActive: false },
            });
          }
        }
      }

      // Activate or create permissions in target list
      for (const permId of targetPermissionIdSet) {
        const existing = existingMap.get(permId);
        if (existing) {
          if (!existing.isActive || existing.deletedAt) {
            await tx.rolePermission.update({
              where: { id: existing.id },
              data: { isActive: true, deletedAt: null },
            });
          }
        } else {
          await tx.rolePermission.create({
            data: {
              roleId,
              permissionId: permId,
              isActive: true,
            },
          });
        }
      }
    });

    const updatedRole = await this.findOrgRoleById(orgId, roleId, request);

    return {
      message: 'Role permissions updated successfully.',
      data: updatedRole,
    };
  }

  /**
   * Delete a custom organization role.
   * System roles cannot be deleted.
   * If any organization members are assigned to this role, they are automatically reassigned to default "Team Member" role.
   */
  async deleteOrgRole(
    orgId: string,
    roleId: string,
    request: AuthRequest,
  ) {
    await this.organizationAccessService.findOrganizationOrThrow(orgId);

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.deletedAt) {
      throw new NotFoundException('Role not found.');
    }

    // System role protection
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted.');
    }

    // Organization isolation check
    if (role.organizationId !== orgId || role.scope !== StatusScope.ORGANIZATION) {
      throw new ForbiddenException(
        'You can only delete custom roles that belong to this organization.',
      );
    }

    // Check if any active organization members use this role
    const assignedMembers = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        roleId,
        removedAt: null,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (assignedMembers.length > 0) {
        // Find default fallback "Team Member" role
        const defaultTeamMemberRole = await tx.role.findFirst({
          where: {
            scope: StatusScope.SYSTEM,
            name: 'Team Member',
            isSystem: true,
            organizationId: null,
            projectId: null,
          },
        });

        if (!defaultTeamMemberRole) {
          throw new BadRequestException(
            'Default Team Member role could not be found for fallback reassignment.',
          );
        }

        // Reassign affected members
        await tx.organizationMember.updateMany({
          where: {
            organizationId: orgId,
            roleId,
            removedAt: null,
          },
          data: {
            roleId: defaultTeamMemberRole.id,
          },
        });
      }

      // Soft-delete the role
      await tx.role.update({
        where: { id: roleId },
        data: {
          deletedAt: new Date(),
        },
      });

      // Deactivate role permissions
      await tx.rolePermission.updateMany({
        where: { roleId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });
    });

    return {
      message: `Organization role deleted successfully.${
        assignedMembers.length > 0
          ? ` ${assignedMembers.length} member(s) were reassigned to the default Team Member role.`
          : ''
      }`,
    };
  }
}
