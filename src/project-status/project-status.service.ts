import { Injectable } from '@nestjs/common';
import { StatusScope } from '@prisma/client';
import { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
  ) {}

  async findStatusByOrganization(request: AuthRequest) {
    const context = this.contextService.resolveOrganizationContext(request);

    return this.prisma.projectStatus.findMany({
      where: {
        OR: [
          {
            scope: StatusScope.SYSTEM,
          },
          {
            scope: StatusScope.ORGANIZATION,
            targetId: context.organizationId,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        color: true,
        // scope: true,
        // targetId: true,
        // order: true,
        // isDefault: true,
        // isClosed: true,
      },
      orderBy: [
        {
          order: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }
}
