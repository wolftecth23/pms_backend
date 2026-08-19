import { PrismaClient } from '@prisma/client';

export async function seedWorkspace(prisma: PrismaClient) {
  // Find organization
  const organization = await prisma.organization.findUnique({
    where: {
      slug: 'shivtechnolab-pvt-ltd',
    },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!organization) {
    throw new Error(
      'Organization not found. Please run organization seeder first.',
    );
  }

  // Create or update workspace
  const workspace = await prisma.workspace.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'Shivlab Workspace',
      },
    },
    update: {
      name: 'Shivlab Workspace',
      description: 'Shiv Technolabs workspace',
    },
    create: {
      name: 'Shivlab Workspace',
      description: 'Shiv Technolabs workspace',
      organizationId: organization.id,
      createdById: organization.ownerId,
    },
  });

  // Get all organization members
  const organizationMembers = await prisma.organizationMember.findMany({
    where: {
      organizationId: organization.id,
    },
    select: {
      userId: true,
    },
  });

  // Existing workspace members
  const existingMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: workspace.id,
    },
    select: {
      userId: true,
    },
  });

  const existingUserIds = new Set(existingMembers.map((m) => m.userId));

  const membersToCreate = organizationMembers
    .filter((member) => !existingUserIds.has(member.userId))
    .map((member) => ({
      workspaceId: workspace.id,
      userId: member.userId,
    }));

  if (membersToCreate.length > 0) {
    await prisma.workspaceMember.createMany({
      data: membersToCreate,
      skipDuplicates: true,
    });
  }

  console.log(`${membersToCreate.length} workspace members added.`);

  return workspace?.id;
}
