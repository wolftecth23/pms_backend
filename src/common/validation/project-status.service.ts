import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StatusScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectStatusServiceValidation {
  constructor(private readonly prisma: PrismaService) {}

  async validateProjectStatus(
    statusId: string,
    organizationId: string,
    workspaceId: string,
    projectId?: string,
  ) {
    const scopes: Prisma.ProjectStatusWhereInput[] = [
      {
        scope: StatusScope.SYSTEM,
      },
      {
        scope: StatusScope.ORGANIZATION,
        targetId: organizationId,
      },
      {
        scope: StatusScope.WORKSPACE,
        targetId: workspaceId,
      },
    ];

    if (projectId) {
      scopes.push({
        scope: StatusScope.PROJECT,
        targetId: projectId,
      });
    }

    const status = await this.prisma.projectStatus.findFirst({
      where: {
        id: statusId,
        OR: scopes,
      },
    });

    if (!status) {
      throw new BadRequestException(
        'The selected project status is not available.',
      );
    }

    return status;
  }
}
