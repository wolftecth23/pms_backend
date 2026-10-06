import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddWorkspaceMembersDto } from './dto/add-workspace-members.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
  ) {}

  /**
   * GET /workspaces
   * List all workspaces that belong to the current organization.
   * Requires workspace.view permission (or wildcard).
   */
  async findAll(request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    const workspaces = await this.prisma.workspace.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            workspaceMember: {
              where: { removedAt: null },
            },
            projects: true,
          },
        },
      },
    });

    return {
      message: 'Workspaces fetched successfully.',
      data: workspaces,
    };
  }

  /**
   * POST /workspaces
   * Create a new workspace under the current organization.
   * Requires workspace.create permission (or wildcard).
   */
  async create(dto: CreateWorkspaceDto, request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    if (
      !ctx.hasPermission('*') &&
      !ctx.hasPermission('workspace.create')
    ) {
      throw new ForbiddenException(
        'You do not have permission to create workspaces.',
      );
    }

    // Enforce unique name within the org
    const existing = await this.prisma.workspace.findUnique({
      where: {
        organizationId_name: {
          organizationId: ctx.organizationId,
          name: dto.name.trim(),
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `A workspace named "${dto.name}" already exists in this organization.`,
      );
    }

    // Gather initial member user IDs (creator always included)
    const userIdsToAdd = new Set<string>([ctx.userId]);

    if (dto.memberUserIds && Array.isArray(dto.memberUserIds) && dto.memberUserIds.length > 0) {
      const validOrgMembers = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: ctx.organizationId,
          userId: { in: dto.memberUserIds },
          removedAt: null,
        },
        select: { userId: true },
      });
      validOrgMembers.forEach((m) => userIdsToAdd.add(m.userId));
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        organizationId: ctx.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        createdById: ctx.userId,
        workspaceMember: {
          create: Array.from(userIdsToAdd).map((userId) => ({
            userId,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            workspaceMember: {
              where: { removedAt: null },
            },
            projects: true,
          },
        },
      },
    });

    return {
      message: 'Workspace created successfully.',
      data: workspace,
    };
  }

  /**
   * GET /workspaces/:id/members
   * List all active members of a specific workspace.
   */
  async findMembers(
    workspaceId: string,
    request: AuthRequest,
    page = 1,
    limit = 50,
    search?: string,
  ) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    // Validate the workspace belongs to the org
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found.');
    }

    if (workspace.organizationId !== ctx.organizationId) {
      throw new ForbiddenException(
        'This workspace does not belong to your organization.',
      );
    }

    const where: any = {
      workspaceId,
      removedAt: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      where.user = {
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    const skip = (page - 1) * limit;

    const [members, total] = await this.prisma.$transaction([
      this.prisma.workspaceMember.findMany({
        where,
        orderBy: [{ joinedAt: 'asc' }],
        skip,
        take: limit,
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
        },
      }),
      this.prisma.workspaceMember.count({ where }),
    ]);

    return {
      message: 'Workspace members fetched successfully.',
      data: {
        members,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasNext: page < Math.ceil(total / limit),
          hasPrevious: page > 1,
        },
      },
    };
  }

  /**
   * GET /workspaces/organization-members
   * List all active members of the current organization, optionally annotated with workspace membership.
   */
  async findOrganizationMembers(
    request: AuthRequest,
    workspaceId?: string,
    search?: string,
    excludeExisting = false,
    page = 1,
    limit = 50,
  ) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    if (workspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, organizationId: true, deletedAt: true },
      });

      if (!workspace || workspace.deletedAt) {
        throw new NotFoundException('Workspace not found.');
      }

      if (workspace.organizationId !== ctx.organizationId) {
        throw new ForbiddenException(
          'This workspace does not belong to your organization.',
        );
      }
    }

    // Build query conditions
    const where: any = {
      organizationId: ctx.organizationId,
      removedAt: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      where.user = {
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    // Identify which users are already in the target workspace
    let existingWorkspaceMemberUserIds = new Set<string>();
    if (workspaceId) {
      const wsMembers = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          removedAt: null,
        },
        select: { userId: true },
      });
      existingWorkspaceMemberUserIds = new Set(wsMembers.map((m) => m.userId));

      if (excludeExisting && existingWorkspaceMemberUserIds.size > 0) {
        where.userId = {
          notIn: Array.from(existingWorkspaceMemberUserIds),
        };
      }
    }

    const skip = (page - 1) * limit;

    const [orgMembers, total] = await this.prisma.$transaction([
      this.prisma.organizationMember.findMany({
        where,
        orderBy: [{ joinedAt: 'asc' }],
        skip,
        take: limit,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
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
        },
      }),
      this.prisma.organizationMember.count({ where }),
    ]);

    const members = orgMembers.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
      isMember: existingWorkspaceMemberUserIds.has(m.userId),
    }));

    return {
      message: 'Organization members fetched successfully.',
      data: {
        members,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasNext: page < Math.ceil(total / limit),
          hasPrevious: page > 1,
        },
      },
    };
  }

  /**
   * POST /workspaces/:id/members
   * Add organization member(s) to a workspace.
   */
  async addMembers(
    workspaceId: string,
    dto: AddWorkspaceMembersDto,
    request: AuthRequest,
  ) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    // 1. Verify workspace exists and belongs to current organization
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found.');
    }

    if (workspace.organizationId !== ctx.organizationId) {
      throw new ForbiddenException(
        'This workspace does not belong to your organization.',
      );
    }

    // 2. Extract unique user IDs to add
    const rawUserIds =
      dto.userIds && dto.userIds.length > 0
        ? dto.userIds
        : dto.userId
        ? [dto.userId]
        : [];

    if (rawUserIds.length === 0) {
      throw new BadRequestException('At least one userId must be provided.');
    }

    const targetUserIds = [...new Set(rawUserIds)];

    // 3. Verify all target users are active members of the organization
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: ctx.organizationId,
        userId: { in: targetUserIds },
        removedAt: null,
      },
      select: {
        userId: true,
      },
    });

    const validOrgUserIds = new Set(orgMembers.map((m) => m.userId));
    const invalidUserIds = targetUserIds.filter((id) => !validOrgUserIds.has(id));

    if (invalidUserIds.length > 0) {
      throw new BadRequestException(
        'One or more selected users are not active members of this organization.',
      );
    }

    // 4. Check existing workspace members
    const existingMembers = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: targetUserIds },
      },
    });

    const existingMap = new Map(existingMembers.map((m) => [m.userId, m]));
    const toCreate: { workspaceId: string; userId: string }[] = [];
    const toRestoreIds: string[] = [];

    for (const uid of targetUserIds) {
      const existing = existingMap.get(uid);
      if (!existing) {
        toCreate.push({ workspaceId, userId: uid });
      } else if (existing.removedAt) {
        toRestoreIds.push(existing.id);
      }
    }

    if (
      targetUserIds.length === 1 &&
      toCreate.length === 0 &&
      toRestoreIds.length === 0
    ) {
      throw new ConflictException('User is already a member of this workspace.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (toRestoreIds.length > 0) {
        await tx.workspaceMember.updateMany({
          where: { id: { in: toRestoreIds } },
          data: {
            removedAt: null,
            removedById: null,
            joinedAt: new Date(),
          },
        });
      }

      if (toCreate.length > 0) {
        await tx.workspaceMember.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }
    });

    const addedCount = toCreate.length + toRestoreIds.length;

    return {
      message: `${addedCount} member(s) added to workspace successfully.`,
      data: {
        addedCount,
        skippedCount: targetUserIds.length - addedCount,
      },
    };
  }

  /**
   * DELETE /workspaces/:id/members/:memberId
   * Soft-delete a member from a workspace.
   */
  async removeMember(
    workspaceId: string,
    memberId: string,
    request: AuthRequest,
  ) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found.');
    }

    if (workspace.organizationId !== ctx.organizationId) {
      throw new ForbiddenException(
        'This workspace does not belong to your organization.',
      );
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        id: memberId,
        workspaceId,
        removedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException('Workspace member not found.');
    }

    // Ensure at least one member remains
    const activeCount = await this.prisma.workspaceMember.count({
      where: {
        workspaceId,
        removedAt: null,
      },
    });

    if (activeCount <= 1) {
      throw new BadRequestException('Cannot remove the last member of the workspace.');
    }

    await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        removedAt: new Date(),
        removedById: ctx.userId,
      },
    });

    return {
      message: 'Member removed from workspace successfully.',
    };
  }
}
