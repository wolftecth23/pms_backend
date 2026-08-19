import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  const hashedPassword = await bcrypt.hash('Password@123', 10);

  const users = [
    {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: hashedPassword,
      designation: 'System Administrator',
      isVerified: true,
      isActive: true,
    },
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: hashedPassword,
      designation: 'Project Manager',
      isVerified: true,
      isActive: true,
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      password: hashedPassword,
      designation: 'Software Engineer',
      isVerified: true,
      isActive: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {},
      create: user,
    });
  }

  console.log(`✅ Seeded ${users.length} users`);
}
