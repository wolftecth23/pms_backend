import { PrismaClient } from '@prisma/client';
import { DEFAULT_PERMISSIONS } from '../data/permissions';

export async function seedPermissions(prisma: PrismaClient) {
  // Clean up deprecated permissions from organization_member module
  const deprecatedCodes = [
    'organization_member.activate',
    'organization_member.deactivate',
    'organization_member.invite',
    'organization_member.change_role',
  ];

  await prisma.rolePermission.deleteMany({
    where: {
      permission: {
        code: { in: deprecatedCodes },
      },
    },
  });

  await prisma.permission.deleteMany({
    where: {
      code: { in: deprecatedCodes },
    },
  });

  for (const permission of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        description: permission.description,
        module: permission.module,
        deletedAt: null,
      },
      create: permission,
    });
  }
}
