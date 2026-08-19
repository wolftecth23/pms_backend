import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskParentServiceValidation {
  constructor(private readonly prisma: PrismaService) {}

  async validateParentTask(
    parentTaskId: string | undefined,
    projectId: string,
  ) {
    if (!parentTaskId) {
      return null;
    }

    const parentTask = await this.prisma.task.findUnique({
      where: {
        id: parentTaskId,
      },
      select: {
        id: true,
        projectId: true,
        deletedAt: true,
      },
    });

    if (!parentTask || parentTask.deletedAt) {
      throw new NotFoundException('Parent task not found.');
    }

    if (parentTask.projectId !== projectId) {
      throw new BadRequestException(
        'Parent task must belong to the same project.',
      );
    }

    return parentTask;
  }
}
