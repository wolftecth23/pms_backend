import { PrismaClient } from '@prisma/client';
import { DEFAULT_PERMISSIONS } from '../data/permissions';

export async function seedPermissions(prisma: PrismaClient) {
  for (const permission of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {},
      create: permission,
    });
  }
}
