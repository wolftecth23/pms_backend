import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { WorkspaceAccessService } from '../common/access/workspace-access.service';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async findMembers(
    request: AuthRequest,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const context = await this.contextService.resolveContext(request);

    // Ensure the workspace exists
    const workspace = await this.workspaceAccess.findWorkspaceOrThrow(
      context.workspaceId,
    );

    // Ensure it belongs to the current organization
    if (workspace.organizationId !== context.organizationId) {
      throw new ForbiddenException(
        'You do not have permission to access this workspace.',
      );
    }

    const where: Prisma.WorkspaceMemberWhereInput = {
      workspaceId: workspace.id,
      removedAt: null,
    };

    if (search) {
      where.user = {
        OR: [
          {
            firstName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      };
    }

    const skip = (page - 1) * limit;

    const [members, total] = await this.prisma.$transaction([
      this.prisma.workspaceMember.findMany({
        where,
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
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
          removedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.workspaceMember.count({
        where,
      }),
    ]);

    return {
      data: {
        data: members,

        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrevious: page > 1,
        },
      },
    };
  }
}
