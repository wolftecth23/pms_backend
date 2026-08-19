import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskAssigneeServiceValidation {
  constructor(private readonly prisma: PrismaService) {}

  async validateTaskAssignees(
    projectMemberIds: string[] | undefined,
    projectId: string,
  ) {
    if (!projectMemberIds?.length) {
      return [];
    }

    // Remove duplicate ids
    const uniqueProjectMemberIds = [...new Set(projectMemberIds)];

    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        id: {
          in: uniqueProjectMemberIds,
        },
        projectId,
        removedAt: null, // Remove if your schema doesn't have this field
      },
      select: {
        id: true,
      },
    });

    const validIds = new Set(projectMembers.map((m) => m.id));

    // const invalidIds = uniqueProjectMemberIds.filter((id) => !validIds.has(id));

    // if (invalidIds.length) {
    //   throw new BadRequestException({
    //     message: 'Some assignees are not members of this project.',
    //     invalidProjectMemberIds: invalidIds,
    //   });
    // }

    // return uniqueProjectMemberIds;
    return [...validIds];
  }
}
