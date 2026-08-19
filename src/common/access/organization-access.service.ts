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
}
