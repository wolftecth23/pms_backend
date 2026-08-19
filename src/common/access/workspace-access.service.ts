import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findWorkspaceOrThrow(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }
}
