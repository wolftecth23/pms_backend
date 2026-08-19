import { OrganizationStatus, PrismaClient } from '@prisma/client';

export async function seedOrganization(prisma: PrismaClient) {
  // Find owner
  const owner = await prisma.user.findUnique({
    where: {
      email: 'kishan@shivlab.com',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (!owner) {
    throw new Error(
      'Owner user not found. Please sync users before running this seeder.',
    );
  }

  // Create or Update organization
  const organization = await prisma.organization.upsert({
    where: {
      slug: 'shivtechnolab-pvt-ltd',
    },
    update: {
      ownerId: owner.id,
      name: 'Shiv Technolabs Pvt. Ltd.',
      description: 'Shiv Technolabs Pvt. Ltd.',
    },
    create: {
      name: 'Shiv Technolabs Pvt. Ltd.',
      slug: 'shivtechnolab-pvt-ltd',
      description: 'Shiv Technolabs Pvt. Ltd.',
      ownerId: owner.id,
      website: 'https://shivlab.com',
      timezone: 'Asia/Kolkata',
      country: 'India',
      currency: 'INR',
      language: 'en',
      status: OrganizationStatus.ACTIVE,
      isActive: true,
    },
  });

  console.log('Organization created/updated successfully.');

  return organization.id;
}
