import { PrismaClient, StatusScope } from '@prisma/client';
import { DEFAULT_TASK_STATUSES } from '../data/taskStatus';

export async function seedTaskStatus(prisma: PrismaClient) {
  for (const status of DEFAULT_TASK_STATUSES) {
    await prisma.taskStatus.upsert({
      where: {
        scope_targetId_name: {
          scope: StatusScope.SYSTEM,
          targetId: '',
          name: status.name,
        },
      },
      update: {
        color: status.color,
        order: status.order,
        isDefault: status.isDefault,
        isClosed: status.isClosed,
      },
      create: {
        scope: StatusScope.SYSTEM,
        targetId: '',
        ...status,
      },
    });
  }

  console.log('✅ Task status seeded');
}
