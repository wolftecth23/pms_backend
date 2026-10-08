import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, CRPriority, CRStatus, Prisma } from '@prisma/client';
import {
  StorageService,
  UploadedFileResult,
} from '../common/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CRActivityService } from './cr-activity.service';
import { generateCRNumber } from './cr-number.helper';
import { AddApproverDto } from './dto/add-approver.dto';
import { ApproveCRDto } from './dto/approve-cr.dto';
import { CRQueryDto } from './dto/cr-query.dto';
import { CreateCRDto } from './dto/create-cr.dto';
import { RejectCRDto } from './dto/reject-cr.dto';
import { UpdateCRDescriptionDto } from './dto/update-cr-description.dto';
import { UpdateCREffortDto } from './dto/update-cr-effort.dto';
import { UpdateCRDto } from './dto/update-cr.dto';
import { CRStatsResponse } from './types/cr.types';

@Injectable()
export class ChangeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: CRActivityService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Helper to ensure the CR exists and belongs to the given organization.
   */
  private async findCRInOrg(id: string, organizationId: string) {
    const cr = await this.prisma.changeRequest.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!cr) {
      throw new NotFoundException('Change request not found');
    }

    return cr;
  }

  /**
   * Generates next CR number for preview in frontend Step 1
   */
  async getNextCRNumber(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException('Project not found in this organization');
    }

    return generateCRNumber(this.prisma, projectId);
  }

  /**
   * Get organization members eligible to be approvers
   */
  async getApproverCandidates(
    organizationId: string,
    page?: number,
    limit?: number,
    search?: string,
    excludeUserId?: string,
  ) {
    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId,
      removedAt: null,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      role: {
        deletedAt: null,
        permissions: {
          some: {
            isActive: true,
            deletedAt: null,
            permission: {
              code: {
                in: ['cr.approve_reject', '*'],
              },
              deletedAt: null,
            },
          },
        },
      },
    };

    if (search && search.trim()) {
      const term = search.trim();
      const parts = term.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        where.user = {
          OR: [
            {
              AND: [
                { firstName: { contains: parts[0], mode: 'insensitive' } },
                {
                  lastName: {
                    contains: parts.slice(1).join(' '),
                    mode: 'insensitive',
                  },
                },
              ],
            },
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        };
      } else {
        where.user = {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        };
      }
    }

    if (page && limit) {
      const p = Math.max(1, Number(page));
      const l = Math.max(1, Math.min(100, Number(limit)));
      const skip = (p - 1) * l;

      const [members, total] = await this.prisma.$transaction([
        this.prisma.organizationMember.findMany({
          where,
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
            role: {
              select: { id: true, name: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
          skip,
          take: l,
        }),
        this.prisma.organizationMember.count({ where }),
      ]);

      return {
        data: members,
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
          hasNext: p < Math.ceil(total / l),
          hasPrevious: p > 1,
        },
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
          hasNext: p < Math.ceil(total / l),
          hasPrevious: p > 1,
        },
      };
    }

    return this.prisma.organizationMember.findMany({
      where,
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
        role: {
          select: { id: true, name: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Create a new CR (Initial status is DRAFT)
   */
  async create(userId: string, organizationId: string, dto: CreateCRDto) {
    // Verify project belongs to organization
    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found in this organization');
    }

    const { crNumber } = await generateCRNumber(this.prisma, dto.projectId);

    // Calculate totals if effort rows provided
    let totalEstimatedHours = 0;
    let totalPurchaseHours = 0;

    if (dto.effortRows?.length) {
      dto.effortRows.forEach((row) => {
        totalEstimatedHours += Number(row.estimatedHours || 0);
        totalPurchaseHours += Number(row.purchaseHours || 0);
      });
    }

    if (dto.approverMemberIds?.length) {
      const eligibleCount = await this.prisma.organizationMember.count({
        where: {
          id: { in: dto.approverMemberIds },
          organizationId,
          removedAt: null,
          role: {
            deletedAt: null,
            permissions: {
              some: {
                isActive: true,
                deletedAt: null,
                permission: {
                  code: {
                    in: ['cr.approve_reject', '*'],
                  },
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      if (eligibleCount !== dto.approverMemberIds.length) {
        throw new BadRequestException(
          'One or more selected approvers do not have permission to approve change requests.',
        );
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const cr = await tx.changeRequest.create({
        data: {
          crNumber,
          organizationId,
          projectId: dto.projectId,
          title: dto.title,
          type: dto.type,
          priority: dto.priority ?? CRPriority.MEDIUM,
          status: CRStatus.DRAFT,
          requestedById: userId,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : null,
          totalEstimatedHours,
          totalPurchaseHours,
          description: dto.description
            ? {
                create: {
                  existingScope: dto.description.existingScope,
                  requestedChange: dto.description.requestedChange,
                  reasonForChange: dto.description.reasonForChange,
                  businessJustification: dto.description.businessJustification,
                  functionalImpact: dto.description.functionalImpact,
                  technicalImpact: dto.description.technicalImpact,
                  dependencies: dto.description.dependencies,
                  assumptions: dto.description.assumptions,
                  acceptanceCriteria: dto.description.acceptanceCriteria,
                },
              }
            : undefined,
          effortRows: dto.effortRows?.length
            ? {
                create: dto.effortRows.map((row, index) => ({
                  role: row.role,
                  estimatedHours: Number(row.estimatedHours || 0),
                  purchaseHours: Number(row.purchaseHours || 0),
                  notes: row.notes,
                  order: row.order ?? index,
                })),
              }
            : undefined,
          approvers: dto.approverMemberIds?.length
            ? {
                create: dto.approverMemberIds.map((orgMemberId) => ({
                  orgMemberId,
                  status: ApprovalStatus.PENDING,
                })),
              }
            : undefined,
        },
        include: {
          project: {
            select: { id: true, name: true, projectCode: true, icon: true },
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          description: true,
          effortRows: true,
          approvers: {
            include: {
              orgMember: {
                include: {
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
          },
        },
      });

      return cr;
    });

    await this.activityService.logActivity({
      changeRequestId: created.id,
      userId,
      eventType: 'CREATED',
      newValue: { crNumber: created.crNumber, title: created.title },
      message: `Change Request ${created.crNumber} created as draft`,
    });

    return created;
  }

  /**
   * Helper to check if the user is an Admin or Owner in the organization
   */
  async isUserAdminOrOwner(
    userId?: string,
    organizationId?: string,
    contextRoleName?: string,
    permissions?: string[],
  ): Promise<boolean> {
    if (!userId || !organizationId) return false;

    if (permissions && permissions.includes('*')) {
      return true;
    }

    let roleName = contextRoleName;

    if (!roleName) {
      const member = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          removedAt: null,
          isActive: true,
        },
        include: {
          role: { select: { name: true } },
        },
      });
      roleName = member?.role?.name;
    }

    if (!roleName) {
      return false;
    }

    const normalized = roleName.trim().toLowerCase();
    return (
      normalized === 'owner' ||
      normalized === 'admin' ||
      normalized === 'super admin' ||
      normalized.includes('admin') ||
      normalized.includes('owner')
    );
  }

  /**
   * List CRs for organization with filters, search, sorting, and pagination.
   * Admins and Owners see all CRs; other users only see CRs created by themselves.
   */
  async findAll(
    organizationId: string,
    query: CRQueryDto,
    userId?: string,
    userRoleName?: string,
    permissions?: string[],
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ChangeRequestWhereInput = {
      organizationId,
      deletedAt: null,
    };

    const canSeeAll = await this.isUserAdminOrOwner(
      userId,
      organizationId,
      userRoleName,
      permissions,
    );

    if (!canSeeAll && userId) {
      // Non-admin/owner can only see CRs created by themselves
      where.requestedById = userId;
    } else if (query.requestedById) {
      where.requestedById = query.requestedById;
    }

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        const fromDate = new Date(query.dateFrom);
        if (
          typeof query.dateFrom === 'string' &&
          !query.dateFrom.includes('T')
        ) {
          fromDate.setUTCHours(0, 0, 0, 0);
        }
        where.createdAt.gte = fromDate;
      }
      if (query.dateTo) {
        const toDate = new Date(query.dateTo);
        if (typeof query.dateTo === 'string' && !query.dateTo.includes('T')) {
          toDate.setUTCHours(23, 59, 59, 999);
        } else if (
          toDate.getUTCHours() === 0 &&
          toDate.getUTCMinutes() === 0 &&
          toDate.getUTCSeconds() === 0 &&
          toDate.getUTCMilliseconds() === 0
        ) {
          toDate.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = toDate;
      }
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { crNumber: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { project: { projectCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDir: Prisma.SortOrder =
      query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, data] = await Promise.all([
      this.prisma.changeRequest.count({ where }),
      this.prisma.changeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortDir },
        include: {
          project: {
            select: { id: true, name: true, projectCode: true, icon: true },
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              designation: true,
            },
          },
          effortRows: {
            orderBy: { order: 'asc' },
          },
          approvers: {
            include: {
              orgMember: {
                include: {
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
          },
          _count: {
            select: { attachments: true },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get 7 aggregate statistics for CR stats bar.
   * Admins and Owners see organization-wide stats; others only see stats for their own CRs.
   */
  async getStats(
    organizationId: string,
    projectId?: string,
    userId?: string,
    userRoleName?: string,
    permissions?: string[],
  ): Promise<CRStatsResponse> {
    const canSeeAll = await this.isUserAdminOrOwner(
      userId,
      organizationId,
      userRoleName,
      permissions,
    );

    const baseWhere: Prisma.ChangeRequestWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (!canSeeAll && userId) {
      baseWhere.requestedById = userId;
    }

    if (projectId) {
      baseWhere.projectId = projectId;
    }

    const [
      total,
      draft,
      pendingApproval,
      pendingModification,
      rejected,
      approved,
      approvedHoursSum,
    ] = await Promise.all([
      this.prisma.changeRequest.count({ where: baseWhere }),
      this.prisma.changeRequest.count({
        where: { ...baseWhere, status: CRStatus.DRAFT },
      }),
      this.prisma.changeRequest.count({
        where: { ...baseWhere, status: CRStatus.PENDING_APPROVAL },
      }),
      this.prisma.changeRequest.count({
        where: { ...baseWhere, status: CRStatus.PENDING_MODIFICATION },
      }),
      this.prisma.changeRequest.count({
        where: { ...baseWhere, status: CRStatus.REJECTED },
      }),
      this.prisma.changeRequest.count({
        where: { ...baseWhere, status: CRStatus.APPROVED },
      }),
      this.prisma.changeRequest.aggregate({
        where: { ...baseWhere, status: CRStatus.APPROVED },
        _sum: { totalPurchaseHours: true },
      }),
    ]);

    return {
      total,
      draft,
      pendingApproval,
      pendingModification,
      rejected,
      approved,
      approvedHours: approvedHoursSum._sum.totalPurchaseHours || 0,
    };
  }

  /**
   * Find single CR by ID with all relations
   */
  async findById(
    id: string,
    organizationId: string,
    userId?: string,
    userRoleName?: string,
    permissions?: string[],
  ) {
    const cr = await this.prisma.changeRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            icon: true,
            startDate: true,
            dueDate: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            designation: true,
          },
        },
        description: true,
        effortRows: {
          orderBy: { order: 'asc' },
        },
        approvers: {
          include: {
            orgMember: {
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
                role: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
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
    });

    if (!cr) {
      throw new NotFoundException('Change request not found');
    }

    if (userId) {
      const canSeeAll = await this.isUserAdminOrOwner(
        userId,
        organizationId,
        userRoleName,
        permissions,
      );

      if (!canSeeAll) {
        const isRequester = cr.requestedById === userId;
        const isApprover = cr.approvers?.some(
          (a) => a.orgMember?.user?.id === userId,
        );
        if (!isRequester && !isApprover) {
          throw new ForbiddenException(
            'You do not have permission to view this change request.',
          );
        }
      }
    }

    return cr;
  }

  /**
   * Update CR basic details (Step 1)
   * Only permitted in DRAFT or PENDING_MODIFICATION
   */
  async update(
    id: string,
    userId: string,
    organizationId: string,
    dto: UpdateCRDto,
  ) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (
      cr.status !== CRStatus.DRAFT &&
      cr.status !== CRStatus.PENDING_MODIFICATION
    ) {
      throw new BadRequestException(
        `Cannot edit change request in '${cr.status}' status. Editing is only allowed in DRAFT or PENDING_MODIFICATION.`,
      );
    }

    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        type: dto.type ?? undefined,
        priority: dto.priority ?? undefined,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : undefined,
      },
    });

    if (dto.approverMemberIds !== undefined) {
      if (dto.approverMemberIds.length > 0) {
        const eligibleCount = await this.prisma.organizationMember.count({
          where: {
            id: { in: dto.approverMemberIds },
            organizationId,
            removedAt: null,
            role: {
              deletedAt: null,
              permissions: {
                some: {
                  isActive: true,
                  deletedAt: null,
                  permission: {
                    code: {
                      in: ['cr.approve_reject', '*'],
                    },
                    deletedAt: null,
                  },
                },
              },
            },
          },
        });

        if (eligibleCount !== dto.approverMemberIds.length) {
          throw new BadRequestException(
            'One or more selected approvers do not have permission to approve change requests.',
          );
        }
      }

      await this.prisma.cRApprover.deleteMany({
        where: { changeRequestId: id },
      });
      if (dto.approverMemberIds.length > 0) {
        await this.prisma.cRApprover.createMany({
          data: dto.approverMemberIds.map((orgMemberId) => ({
            changeRequestId: id,
            orgMemberId,
            status: ApprovalStatus.PENDING,
          })),
        });
      }
    }

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'UPDATED',
      oldValue: {
        title: cr.title,
        type: cr.type,
        priority: cr.priority,
      },
      newValue: {
        title: updated.title,
        type: updated.type,
        priority: updated.priority,
      },
      message: 'CR details updated',
    });

    return updated;
  }

  /**
   * Update Step 2 Change Description
   * Only permitted in DRAFT or PENDING_MODIFICATION
   */
  async updateDescription(
    id: string,
    userId: string,
    organizationId: string,
    dto: UpdateCRDescriptionDto,
  ) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (
      cr.status !== CRStatus.DRAFT &&
      cr.status !== CRStatus.PENDING_MODIFICATION
    ) {
      throw new BadRequestException(
        `Cannot edit change description in '${cr.status}' status.`,
      );
    }

    const description = await this.prisma.cRChangeDescription.upsert({
      where: { changeRequestId: id },
      update: {
        existingScope: dto.existingScope,
        requestedChange: dto.requestedChange,
        reasonForChange: dto.reasonForChange,
        businessJustification: dto.businessJustification,
        functionalImpact: dto.functionalImpact,
        technicalImpact: dto.technicalImpact,
        dependencies: dto.dependencies,
        assumptions: dto.assumptions,
        acceptanceCriteria: dto.acceptanceCriteria,
      },
      create: {
        changeRequestId: id,
        existingScope: dto.existingScope,
        requestedChange: dto.requestedChange,
        reasonForChange: dto.reasonForChange,
        businessJustification: dto.businessJustification,
        functionalImpact: dto.functionalImpact,
        technicalImpact: dto.technicalImpact,
        dependencies: dto.dependencies,
        assumptions: dto.assumptions,
        acceptanceCriteria: dto.acceptanceCriteria,
      },
    });

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'DESCRIPTION_UPDATED',
      message: 'Change description fields updated',
    });

    return description;
  }

  /**
   * Update Step 3 Effort Estimation
   * Replaces all rows, recomputes cached totals
   * Only permitted in DRAFT or PENDING_MODIFICATION
   */
  async updateEffort(
    id: string,
    userId: string,
    organizationId: string,
    dto: UpdateCREffortDto,
  ) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (
      cr.status !== CRStatus.DRAFT &&
      cr.status !== CRStatus.PENDING_MODIFICATION
    ) {
      throw new BadRequestException(
        `Cannot edit effort estimation in '${cr.status}' status.`,
      );
    }

    let totalEstimatedHours = 0;
    let totalPurchaseHours = 0;

    dto.rows.forEach((row) => {
      totalEstimatedHours += Number(row.estimatedHours || 0);
      totalPurchaseHours += Number(row.purchaseHours || 0);
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete existing effort rows
      await tx.cREffortRow.deleteMany({
        where: { changeRequestId: id },
      });

      // Insert new rows
      if (dto.rows.length > 0) {
        await tx.cREffortRow.createMany({
          data: dto.rows.map((row, index) => ({
            changeRequestId: id,
            role: row.role,
            estimatedHours: Number(row.estimatedHours || 0),
            purchaseHours: Number(row.purchaseHours || 0),
            notes: row.notes,
            order: row.order ?? index,
          })),
        });
      }

      // Update CR cached totals
      const updatedCR = await tx.changeRequest.update({
        where: { id },
        data: {
          totalEstimatedHours,
          totalPurchaseHours,
        },
        include: {
          effortRows: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return updatedCR;
    });

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'EFFORT_UPDATED',
      newValue: {
        totalEstimatedHours,
        totalPurchaseHours,
        rowCount: dto.rows.length,
      },
      message: `Effort estimation updated: ${totalPurchaseHours} purchase hours, ${totalEstimatedHours} estimated hours`,
    });

    return result;
  }

  /**
   * Soft-delete CR
   */
  async delete(id: string, userId: string, organizationId: string) {
    const cr = await this.findCRInOrg(id, organizationId);

    await this.prisma.changeRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'DELETED',
      message: `Change Request ${cr.crNumber} deleted`,
    });

    return { success: true, message: 'Change Request deleted successfully' };
  }

  /**
   * Submit CR (DRAFT or PENDING_MODIFICATION → PENDING_APPROVAL)
   */
  async submit(id: string, userId: string, organizationId: string) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (
      cr.status !== CRStatus.DRAFT &&
      cr.status !== CRStatus.PENDING_MODIFICATION
    ) {
      throw new BadRequestException(
        `Cannot submit change request in '${cr.status}' status.`,
      );
    }

    // Check if approvers exist
    const approverCount = await this.prisma.cRApprover.count({
      where: { changeRequestId: id },
    });

    if (approverCount === 0) {
      throw new BadRequestException(
        'Please add at least one approver before submitting the change request.',
      );
    }

    // Reset all approvers to PENDING when submitting
    await this.prisma.$transaction([
      this.prisma.cRApprover.updateMany({
        where: { changeRequestId: id },
        data: {
          status: ApprovalStatus.PENDING,
          remarks: null,
          respondedAt: null,
        },
      }),
      this.prisma.changeRequest.update({
        where: { id },
        data: { status: CRStatus.PENDING_APPROVAL },
      }),
    ]);

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'STATUS_CHANGED',
      oldValue: { status: cr.status },
      newValue: { status: CRStatus.PENDING_APPROVAL },
      message: `Change Request submitted for approval`,
    });

    return this.findById(id, organizationId);
  }

  /**
   * Approve CR (Approver action)
   */
  async approve(
    id: string,
    userId: string,
    organizationId: string,
    dto: ApproveCRDto,
  ) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (cr.status !== CRStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot approve change request in '${cr.status}' status. It must be PENDING_APPROVAL.`,
      );
    }

    // Find approver record for this user in this org
    const approver = await this.prisma.cRApprover.findFirst({
      where: {
        changeRequestId: id,
        orgMember: {
          userId,
          organizationId,
        },
      },
      include: {
        orgMember: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!approver) {
      throw new ForbiddenException(
        'You are not designated as an approver for this Change Request.',
      );
    }

    // Update this approver's response
    await this.prisma.cRApprover.update({
      where: { id: approver.id },
      data: {
        status: ApprovalStatus.APPROVED,
        remarks: dto.remarks,
        respondedAt: new Date(),
      },
    });

    // Check if ALL approvers have approved
    const allApprovers = await this.prisma.cRApprover.findMany({
      where: { changeRequestId: id },
    });

    const allApproved = allApprovers.every(
      (a) => a.id === approver.id || a.status === ApprovalStatus.APPROVED,
    );

    const approverName =
      `${approver.orgMember.user.firstName} ${approver.orgMember.user.lastName || ''}`.trim();

    if (allApproved) {
      await this.prisma.$transaction(async (tx) => {
        await tx.changeRequest.update({
          where: { id },
          data: {
            status: CRStatus.APPROVED,
            resolvedAt: new Date(),
          },
        });

        if (
          (cr.totalPurchaseHours && cr.totalPurchaseHours > 0) ||
          (cr.totalEstimatedHours && cr.totalEstimatedHours > 0)
        ) {
          const project = await tx.project.findUnique({
            where: { id: cr.projectId },
            select: { purchaseHours: true, estimatedHours: true },
          });

          if (project) {
            const currentPurchase = project.purchaseHours ?? 0;
            const currentEstimated = project.estimatedHours ?? 0;
            await tx.project.update({
              where: { id: cr.projectId },
              data: {
                purchaseHours: currentPurchase + (cr.totalPurchaseHours || 0),
                estimatedHours:
                  currentEstimated + (cr.totalEstimatedHours || 0),
              },
            });
          }
        }
      });

      await this.activityService.logActivity({
        changeRequestId: id,
        userId,
        eventType: 'APPROVED',
        oldValue: { status: CRStatus.PENDING_APPROVAL },
        newValue: { status: CRStatus.APPROVED },
        message: `Change Request approved by ${approverName} and is now fully APPROVED!`,
      });
    } else {
      await this.activityService.logActivity({
        changeRequestId: id,
        userId,
        eventType: 'APPROVER_ACTION',
        message: `Approved by ${approverName}. Awaiting remaining approvers.`,
      });
    }

    return this.findById(id, organizationId);
  }

  /**
   * Reject CR or Request Modification (Approver action)
   */
  async reject(
    id: string,
    userId: string,
    organizationId: string,
    dto: RejectCRDto,
  ) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (cr.status !== CRStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot reject change request in '${cr.status}' status.`,
      );
    }

    const approver = await this.prisma.cRApprover.findFirst({
      where: {
        changeRequestId: id,
        orgMember: {
          userId,
          organizationId,
        },
      },
      include: {
        orgMember: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!approver) {
      throw new ForbiddenException(
        'You are not designated as an approver for this Change Request.',
      );
    }

    const approverName =
      `${approver.orgMember.user.firstName} ${approver.orgMember.user.lastName || ''}`.trim();

    if (dto.requestModification) {
      // Transition to PENDING_MODIFICATION
      await this.prisma.$transaction([
        this.prisma.cRApprover.update({
          where: { id: approver.id },
          data: {
            remarks: dto.remarks,
            respondedAt: new Date(),
          },
        }),
        this.prisma.changeRequest.update({
          where: { id },
          data: { status: CRStatus.PENDING_MODIFICATION },
        }),
      ]);

      await this.activityService.logActivity({
        changeRequestId: id,
        userId,
        eventType: 'MODIFICATION_REQUESTED',
        oldValue: { status: CRStatus.PENDING_APPROVAL },
        newValue: { status: CRStatus.PENDING_MODIFICATION },
        message: `Modifications requested by ${approverName}: ${dto.remarks || 'No remarks provided'}`,
      });
    } else {
      // Any single rejection rejects the CR immediately
      await this.prisma.$transaction([
        this.prisma.cRApprover.update({
          where: { id: approver.id },
          data: {
            status: ApprovalStatus.REJECTED,
            remarks: dto.remarks,
            respondedAt: new Date(),
          },
        }),
        this.prisma.changeRequest.update({
          where: { id },
          data: {
            status: CRStatus.REJECTED,
            resolvedAt: new Date(),
          },
        }),
      ]);

      await this.activityService.logActivity({
        changeRequestId: id,
        userId,
        eventType: 'REJECTED',
        oldValue: { status: CRStatus.PENDING_APPROVAL },
        newValue: { status: CRStatus.REJECTED },
        message: `Change Request rejected by ${approverName}: ${dto.remarks || 'No remarks provided'}`,
      });
    }

    return this.findById(id, organizationId);
  }

  /**
   * Cancel CR
   */
  async cancel(id: string, userId: string, organizationId: string) {
    const cr = await this.findCRInOrg(id, organizationId);

    if (cr.status === CRStatus.APPROVED || cr.status === CRStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot cancel change request in '${cr.status}' status.`,
      );
    }

    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: { status: CRStatus.CANCELLED },
    });

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'CANCELLED',
      oldValue: { status: cr.status },
      newValue: { status: CRStatus.CANCELLED },
      message: `Change Request cancelled`,
    });

    return updated;
  }

  /**
   * Add an approver to CR
   */
  async addApprover(
    id: string,
    userId: string,
    organizationId: string,
    dto: AddApproverDto,
  ) {
    await this.findCRInOrg(id, organizationId);

    // Verify member belongs to this organization and has cr.approve_reject permission
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: dto.orgMemberId,
        organizationId,
        removedAt: null,
        isActive: true,
        role: {
          deletedAt: null,
          permissions: {
            some: {
              isActive: true,
              deletedAt: null,
              permission: {
                code: {
                  in: ['cr.approve_reject', '*'],
                },
                deletedAt: null,
              },
            },
          },
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!member) {
      throw new NotFoundException(
        'Organization member not found or does not have permission to approve change requests.',
      );
    }

    const existing = await this.prisma.cRApprover.findUnique({
      where: {
        changeRequestId_orgMemberId: {
          changeRequestId: id,
          orgMemberId: dto.orgMemberId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('This member is already an approver.');
    }

    const created = await this.prisma.cRApprover.create({
      data: {
        changeRequestId: id,
        orgMemberId: dto.orgMemberId,
        status: ApprovalStatus.PENDING,
      },
      include: {
        orgMember: {
          include: {
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
    });

    const memberName =
      `${member.user.firstName} ${member.user.lastName || ''}`.trim();
    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'APPROVER_ADDED',
      message: `Added ${memberName} as an approver`,
    });

    return created;
  }

  /**
   * Remove an approver from CR
   */
  async removeApprover(
    id: string,
    approverId: string,
    userId: string,
    organizationId: string,
  ) {
    await this.findCRInOrg(id, organizationId);

    const approver = await this.prisma.cRApprover.findFirst({
      where: {
        id: approverId,
        changeRequestId: id,
      },
      include: {
        orgMember: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!approver) {
      throw new NotFoundException('Approver record not found');
    }

    await this.prisma.cRApprover.delete({
      where: { id: approverId },
    });

    const memberName =
      `${approver.orgMember.user.firstName} ${approver.orgMember.user.lastName || ''}`.trim();
    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'APPROVER_REMOVED',
      message: `Removed ${memberName} from approvers`,
    });

    return { success: true, message: 'Approver removed successfully' };
  }

  /**
   * Add attachment to CR
   */
  async addAttachment(
    id: string,
    userId: string,
    organizationId: string,
    file: UploadedFileResult,
  ) {
    await this.findCRInOrg(id, organizationId);

    const attachment = await this.prisma.cRAttachment.create({
      data: {
        changeRequestId: id,
        uploadedById: userId,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        url: file.url,
      },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'ATTACHMENT_ADDED',
      message: `Attached file: ${file.name}`,
    });

    return attachment;
  }

  /**
   * Delete attachment from CR
   */
  async deleteAttachment(
    id: string,
    attachmentId: string,
    userId: string,
    organizationId: string,
  ) {
    await this.findCRInOrg(id, organizationId);

    const attachment = await this.prisma.cRAttachment.findFirst({
      where: {
        id: attachmentId,
        changeRequestId: id,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.prisma.cRAttachment.delete({
      where: { id: attachmentId },
    });

    await this.activityService.logActivity({
      changeRequestId: id,
      userId,
      eventType: 'ATTACHMENT_DELETED',
      message: `Deleted attachment: ${attachment.name}`,
    });

    return { success: true, message: 'Attachment deleted successfully' };
  }
}
