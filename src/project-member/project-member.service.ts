import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuthRequest } from '../auth/auth.controller';
import { ProjectAccessService } from '../common/access/project-access.service';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

@Injectable()
export class ProjectMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly contextService: ContextService,
  ) {}

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

        role: {
          select: {
            id: true,
            name: true,
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
          projectRoleId: null,
          // joinedAt: new Date(),
        },
        include: {
          user: true,
          role: true,
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
        projectRoleId: dto.projectRoleId || null,
      },
      include: {
        user: true,
        role: true,
      },
    });
  }
}
