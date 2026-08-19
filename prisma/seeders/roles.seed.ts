import { PrismaClient, StatusScope } from '@prisma/client';
import { DEFAULT_ROLES } from '../data/roles';

export async function seedRoles(prisma: PrismaClient) {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: {
        scope_name: {
          scope: StatusScope.SYSTEM,
          name: role.name,
        },
      },
      update: {
        description: role.description,
        isSystem: true,
        deletedAt: null,
      },
      create: {
        scope: StatusScope.SYSTEM,
        organizationId: null,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
  }

  const count = await prisma.role.count();

  console.log(`Roles in DB: ${count}`);
  console.log('✅ Roles seeded');
}
