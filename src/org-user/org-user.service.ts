import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgUserDto } from './dto/create-org-user.dto';
import { UpdateOrgUserDto } from './dto/update-org-user.dto';

@Injectable()
export class OrgUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
  ) {}

  /**
   * GET /org-users
   * List all active organization members with pagination, search, role and status filtering.
   */
  async findAll(
    request: AuthRequest,
    search?: string,
    roleId?: string,
    isActive?: string,
    page = 1,
    limit = 20,
  ) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId: ctx.organizationId,
      removedAt: null,
    };

    if (roleId && roleId.trim()) {
      where.roleId = roleId.trim();
    }

    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.user = {
        is: {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { designation: { contains: term, mode: 'insensitive' } },
          ],
        },
      };
    }

    const skip = (page - 1) * limit;

    const [members, total, activeCount, inactiveCount] =
      await this.prisma.$transaction([
        this.prisma.organizationMember.findMany({
          where,
          orderBy: [{ joinedAt: 'desc' }],
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
                isVerified: true,
                createdAt: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                isSystem: true,
              },
            },
            organization: {
              select: {
                id: true,
                ownerId: true,
              },
            },
          },
        }),
        this.prisma.organizationMember.count({ where }),
        this.prisma.organizationMember.count({
          where: {
            organizationId: ctx.organizationId,
            removedAt: null,
            isActive: true,
          },
        }),
        this.prisma.organizationMember.count({
          where: {
            organizationId: ctx.organizationId,
            removedAt: null,
            isActive: false,
          },
        }),
      ]);

    const overallTotal = activeCount + inactiveCount;

    return {
      message: 'Organization users fetched successfully.',
      data: {
        members,
        stats: {
          total: overallTotal,
          active: activeCount,
          inactive: inactiveCount,
        },
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
   * GET /org-users/roles
   * List all available roles that can be assigned within the current organization.
   */
  async findAvailableRoles(request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

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
            organizationId: ctx.organizationId,
            projectId: null,
          },
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        isSystem: true,
      },
    });

    return {
      message: 'Available roles fetched successfully.',
      data: roles,
    };
  }

  /**
   * GET /org-users/:id
   * Get single organization member details.
   */
  async findOne(memberId: string, request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: ctx.organizationId,
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
            isVerified: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            isSystem: true,
          },
        },
        organization: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Organization member not found.');
    }

    return {
      message: 'Organization member fetched successfully.',
      data: member,
    };
  }

  /**
   * POST /org-users
   * Create a new user (or assign existing) and add as an organization member with a specified role.
   */
  async create(dto: CreateOrgUserDto, request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    // 1. Verify target role exists and is accessible in this org (System or Organization role only)
    const role = await this.prisma.role.findFirst({
      where: {
        id: dto.roleId,
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
            organizationId: ctx.organizationId,
            projectId: null,
          },
        ],
      },
    });

    if (!role) {
      throw new BadRequestException(
        'Selected role is invalid or does not belong to this organization.',
      );
    }

    // 2. Check organization member limit
    const organization = await this.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, maxMembers: true, ownerId: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    const currentMemberCount = await this.prisma.organizationMember.count({
      where: { organizationId: ctx.organizationId, removedAt: null },
    });

    if (
      organization.maxMembers &&
      currentMemberCount >= organization.maxMembers
    ) {
      throw new BadRequestException(
        `Organization has reached its member limit of ${organization.maxMembers} members.`,
      );
    }

    const email = dto.email.trim().toLowerCase();

    // 3. Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Check if user is already an organization member
      const existingMembership =
        await this.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: ctx.organizationId,
              userId: existingUser.id,
            },
          },
        });

      if (existingMembership && !existingMembership.removedAt) {
        throw new ConflictException(
          `User with email "${email}" is already a member of this organization.`,
        );
      }

      // If membership was soft-deleted, restore it
      if (existingMembership && existingMembership.removedAt) {
        const restored = await this.prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              firstName: dto.firstName.trim(),
              lastName: dto.lastName?.trim() || existingUser.lastName,
              designation: dto.designation.trim() || existingUser.designation,
            },
          });

          return tx.organizationMember.update({
            where: { id: existingMembership.id },
            data: {
              roleId: dto.roleId,
              isActive: true,
              removedAt: null,
              removedById: null,
              joinedAt: new Date(),
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
                  isVerified: true,
                  createdAt: true,
                },
              },
              role: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isSystem: true,
                },
              },
            },
          });
        });

        return {
          message: 'User restored and added to organization successfully.',
          data: restored,
        };
      }

      // User exists in system but not in this organization: add membership
      const newMembership = await this.prisma.organizationMember.create({
        data: {
          organizationId: ctx.organizationId,
          userId: existingUser.id,
          roleId: dto.roleId,
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
              isVerified: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
            },
          },
        },
      });

      return {
        message: 'Existing user added to organization successfully.',
        data: newMembership,
      };
    }

    // 4. Create brand new user & organization membership
    const plainPassword = dto.password?.trim() || 'Password@123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() || null,
          email,
          password: hashedPassword,
          designation: dto.designation.trim(),
          isVerified: true,
          isActive: true,
        },
      });

      return tx.organizationMember.create({
        data: {
          organizationId: ctx.organizationId,
          userId: newUser.id,
          roleId: dto.roleId,
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
              isVerified: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
            },
          },
        },
      });
    });

    return {
      message: 'User created and added to organization successfully.',
      data: created,
    };
  }

  /**
   * PATCH /org-users/:id
   * Update user profile attributes, status, and/or reassign organization role.
   */
  async update(memberId: string, dto: UpdateOrgUserDto, request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: ctx.organizationId,
        removedAt: null,
      },
      include: {
        organization: true,
        user: true,
        role: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Organization member not found.');
    }

    // Guard organization owner
    const isOwner = member.organization.ownerId === member.userId;
    if (isOwner) {
      if (dto.isActive === false) {
        throw new BadRequestException(
          'Cannot deactivate the organization owner account.',
        );
      }
      if (dto.roleId && dto.roleId !== member.roleId) {
        throw new BadRequestException(
          'Cannot change the role of the organization owner. Transfer ownership first.',
        );
      }
    }

    const currentUserId = request.user?.id ?? request.user?.userId;
    if (currentUserId === member.userId && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    // Validate new role if specified (System or Organization role only)
    if (dto.roleId && dto.roleId !== member.roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          id: dto.roleId,
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
              organizationId: ctx.organizationId,
              projectId: null,
            },
          ],
        },
      });

      if (!role) {
        throw new BadRequestException('Invalid role specified.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update user attributes
      const userUpdateData: Prisma.UserUpdateInput = {};
      if (dto.firstName !== undefined)
        userUpdateData.firstName = dto.firstName.trim();
      if (dto.lastName !== undefined)
        userUpdateData.lastName = dto.lastName?.trim() || null;
      if (dto.designation !== undefined)
        userUpdateData.designation = dto.designation.trim();
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: member.userId },
          data: userUpdateData,
        });
      }

      // Update organization membership role and active status
      const memberUpdateData: Prisma.OrganizationMemberUncheckedUpdateInput = {
        roleId: dto.roleId || member.roleId,
      };
      if (dto.isActive !== undefined) {
        memberUpdateData.isActive = dto.isActive;
      }

      return tx.organizationMember.update({
        where: { id: memberId },
        data: memberUpdateData,
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
              isVerified: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
            },
          },
        },
      });
    });

    return {
      message: 'Organization user updated successfully.',
      data: updated,
    };
  }

  /**
   * DELETE /org-users/:id
   * Remove a user from the organization (soft delete membership).
   */
  async remove(memberId: string, request: AuthRequest) {
    const ctx = this.contextService.resolveOrganizationContext(request);

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: ctx.organizationId,
        removedAt: null,
      },
      include: {
        organization: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Organization member not found.');
    }

    if (member.organization.ownerId === member.userId) {
      throw new BadRequestException(
        'Cannot remove the organization owner. Please transfer ownership first.',
      );
    }

    if (member.userId === ctx.userId) {
      throw new BadRequestException(
        'You cannot remove yourself from the organization.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Soft-delete org membership
      await tx.organizationMember.update({
        where: { id: memberId },
        data: {
          isActive: false,
          removedAt: new Date(),
          removedById: ctx.userId,
        },
      });

      // 2. Cascade soft-delete for workspace memberships in this org
      await tx.workspaceMember.updateMany({
        where: {
          userId: member.userId,
          removedAt: null,
          workspace: { organizationId: ctx.organizationId },
        },
        data: {
          removedAt: new Date(),
          removedById: ctx.userId,
        },
      });
    });

    return {
      message: 'Organization user removed successfully.',
    };
  }
}
