import { PrismaClient } from '@prisma/client';

export async function cleanAllProjects(prisma: PrismaClient) {
  console.log('🧹 Cleaning all existing projects and related records...');

  // Delete child records first to satisfy foreign keys
  await prisma.projectActivity.deleteMany({});
  await prisma.projectAttachment.deleteMany({});
  await prisma.commentAttachment.deleteMany({});
  await prisma.commentReaction.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.taskAttachment.deleteMany({});
  await prisma.taskAssignee.deleteMany({});
  await prisma.taskTag.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.taskStatus.deleteMany({
    where: {
      projectId: { not: null },
    },
  });
  await prisma.rolePermission.deleteMany({
    where: {
      projectMemberId: { not: null },
    },
  });
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});

  console.log('✅ All existing projects and related data removed.');
}
