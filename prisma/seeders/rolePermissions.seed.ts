import { PrismaClient } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS } from '../data/rolePermissions';

export async function seedRolePermissions(prisma: PrismaClient) {
  const roles = await prisma.role.findMany({
    where: {
      deletedAt: null,
    },
  });

  const permissions = await prisma.permission.findMany();

  const permissionMap = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  for (const role of roles) {
    const permissionCodes =
      DEFAULT_ROLE_PERMISSIONS[
        role.name as keyof typeof DEFAULT_ROLE_PERMISSIONS
      ];

    if (!permissionCodes) continue;

    const permissionIds =
      permissionCodes[0] === '*'
        ? permissions.map((permission) => permission.id)
        : (permissionCodes
            .map((code: string) => permissionMap.get(code))
            .filter(Boolean) as string[]);

    for (const permissionId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        update: {
          isActive: true,
          deletedAt: null,
        },
        create: {
          roleId: role.id,
          permissionId,
        },
      });
    }
  }

  const count = await prisma.rolePermission.count();

  console.log(`rolePermission in DB: ${count}`);

  console.log('✅ Role permissions seeded');
}
