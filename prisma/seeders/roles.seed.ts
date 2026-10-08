import { PrismaClient, StatusScope } from '@prisma/client';
import { DEFAULT_PROJECT_ROLES, DEFAULT_ROLES } from '../data/roles';

export async function seedRoles(prisma: PrismaClient) {
  for (const role of DEFAULT_ROLES) {
    const existing = await prisma.role.findFirst({
      where: {
        scope: StatusScope.SYSTEM,
        name: role.name,
        organizationId: null,
        projectId: null,
      },
    });

    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          description: role.description,
          isSystem: true,
          deletedAt: null,
        },
      });
    } else {
      await prisma.role.create({
        data: {
          scope: StatusScope.SYSTEM,
          organizationId: null,
          projectId: null,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });
    }
  }

  for (const role of DEFAULT_PROJECT_ROLES) {
    const existing = await prisma.role.findFirst({
      where: {
        scope: StatusScope.PROJECT,
        name: role.name,
        organizationId: null,
        projectId: null,
      },
    });

    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          description: role.description,
          isSystem: true,
          deletedAt: null,
        },
      });
    } else {
      await prisma.role.create({
        data: {
          scope: StatusScope.PROJECT,
          organizationId: null,
          projectId: null,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });
    }
  }

  const count = await prisma.role.count();

  console.log(`Roles in DB: ${count}`);
  console.log('✅ Roles seeded');
}
