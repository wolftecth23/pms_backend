import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationOrThrow(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async findOrgMemberOrThrow(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        removedAt: null,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Organization member not found.');
    }

    return member;
  }
}
