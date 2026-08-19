import { PrismaClient, StatusScope } from '@prisma/client';
import { DEFAULT_TASK_PRIORITIES } from '../data/taskPriority';

export async function seedTaskPriority(prisma: PrismaClient) {
  for (const priority of DEFAULT_TASK_PRIORITIES) {
    await prisma.taskPriority.upsert({
      where: {
        scope_targetId_name: {
          scope: StatusScope.SYSTEM,
          targetId: '',
          name: priority.name,
        },
      },
      update: {
        color: priority.color,
        order: priority.order,
        isDefault: priority.isDefault,
      },
      create: {
        scope: StatusScope.SYSTEM,
        targetId: '',
        ...priority,
      },
    });
  }

  console.log('✅ Task Priority seeded');
}
