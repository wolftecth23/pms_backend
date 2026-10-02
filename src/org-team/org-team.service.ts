import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgTeamDto } from './dto/create-org-team.dto';
import { UpdateOrgTeamDto } from './dto/update-org-team.dto';

const TEAM_SELECT = {
  id: true,
  name: true,
  description: true,
  color: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class OrgTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
  ) {}

  /** GET /org-teams  — No permission required, any authenticated user */
  async findAll(request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const teams = await this.prisma.orgTeam.findMany({
      where: {
        organizationId: context.organizationId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      select: TEAM_SELECT,
    });

    return { message: 'Teams fetched successfully.', data: teams };
  }

  /** POST /org-teams  — Requires team.create */
  async create(dto: CreateOrgTeamDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    if (
      !context.hasPermission('*') &&
      !context.hasPermission('team.create')
    ) {
      throw new ForbiddenException(
        'You do not have permission to create teams.',
      );
    }

    const exists = await this.prisma.orgTeam.findFirst({
      where: {
        organizationId: context.organizationId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (exists) {
      throw new ConflictException(
        `A team named "${dto.name}" already exists in this organization.`,
      );
    }

    const team = await this.prisma.orgTeam.create({
      data: {
        organizationId: context.organizationId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        color: dto.color ?? '#3B82F6',
      },
      select: TEAM_SELECT,
    });

    return { message: 'Team created successfully.', data: team };
  }

  /** PATCH /org-teams/:id  — Requires team.update */
  async update(id: string, dto: UpdateOrgTeamDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    if (
      !context.hasPermission('*') &&
      !context.hasPermission('team.update')
    ) {
      throw new ForbiddenException(
        'You do not have permission to update teams.',
      );
    }

    const team = await this.prisma.orgTeam.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null },
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    // Check name conflict (exclude self)
    if (dto.name && dto.name.toLowerCase() !== team.name.toLowerCase()) {
      const conflict = await this.prisma.orgTeam.findFirst({
        where: {
          organizationId: context.organizationId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          deletedAt: null,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `A team named "${dto.name}" already exists.`,
        );
      }
    }

    const updated = await this.prisma.orgTeam.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
      select: TEAM_SELECT,
    });

    return { message: 'Team updated successfully.', data: updated };
  }

  /** DELETE /org-teams/:id  — Requires team.delete */
  async remove(id: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    if (
      !context.hasPermission('*') &&
      !context.hasPermission('team.delete')
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete teams.',
      );
    }

    const team = await this.prisma.orgTeam.findFirst({
      where: { id, organizationId: context.organizationId, deletedAt: null },
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    await this.prisma.orgTeam.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Team deleted successfully.', data: { id } };
  }
}
