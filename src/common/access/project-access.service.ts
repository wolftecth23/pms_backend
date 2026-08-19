import { Injectable, NotFoundException } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectContext } from '../../project/project.service';

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

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

        members: {
          some: {
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

    return project;
  }
}
