import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { seedTaskPriority } from './seeders/taskPriority.seed';
import { seedTaskStatus } from './seeders/taskStatus.seed';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // await seedProjectStatus(prisma);
  await seedTaskPriority(prisma);
  await seedTaskStatus(prisma);
  // await seedUsers(prisma);
  // await seedRoles(prisma);
  // await seedPermissions(prisma);
  // await seedRolePermissions(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

// import { PrismaClient } from '@prisma/client';
// import { seedPermissions } from './seeders/permission.seed';
// import { seedProjectStatus } from './seeders/projectStatus.seed';

// const prisma = new PrismaClient();

// async function main() {
//   await seedPermissions(prisma);
//   await seedProjectStatus(prisma);
//   await seedTaskPriority(prisma);
//   await seedTaskStatus(prisma);
// }

// main().finally(async () => {
//   await prisma.$disconnect();
// });
