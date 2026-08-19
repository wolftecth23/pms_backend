import { PrismaClient, StatusScope } from '@prisma/client';
import { DEFAULT_PROJECT_STATUSES } from '../data/projectStatus';

export async function seedProjectStatus(prisma: PrismaClient) {
  for (const status of DEFAULT_PROJECT_STATUSES) {
    await prisma.projectStatus.upsert({
      where: {
        scope_targetId_name: {
          scope: StatusScope.SYSTEM,
          targetId: '',
          name: status.name,
        },
      },
      update: {},
      create: {
        scope: StatusScope.SYSTEM,
        targetId: '',
        ...status,
      },
    });
  }

  console.log('✅ Project statuses seeded');
}
