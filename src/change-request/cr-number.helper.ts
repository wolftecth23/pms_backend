import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Generates a project-scoped sequential CR number.
 * Format: {PROJECT_CODE}-CR-{3-digit-sequential}
 * Example: DA-MKS-CR-001, NTY-614-CR-033
 */
export async function generateCRNumber(
  prisma: PrismaService,
  projectId: string,
): Promise<{ crNumber: string; projectCode: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, projectCode: true },
  });

  if (!project) {
    throw new NotFoundException('Project not found');
  }

  const prefix = `${project.projectCode}-CR-`;

  // Find all CR numbers for this project to determine the highest sequence
  const existingCRs = await prisma.changeRequest.findMany({
    where: { projectId },
    select: { crNumber: true },
  });

  let maxSeq = 0;
  for (const cr of existingCRs) {
    if (cr.crNumber && cr.crNumber.startsWith(prefix)) {
      const seqStr = cr.crNumber.slice(prefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const crNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

  return { crNumber, projectCode: project.projectCode };
}
