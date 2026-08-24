import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.controller';
import { ContextService } from '../common/context/context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: ContextService,
  ) {}

  async listTags(request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const tags = await this.prisma.tag.findMany({
      where: {
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
      },
    });

    return {
      message: 'Tags fetched successfully.',
      data: tags,
    };
  }

  async createTag(dto: CreateTagDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const exists = await this.prisma.tag.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    });

    if (exists) {
      throw new ConflictException(
        `Tag with name "${dto.name}" already exists in this workspace.`,
      );
    }

    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name.trim(),
        color: dto.color ?? '#3B82F6',
        workspaceId: context.workspaceId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
      },
    });

    return {
      message: 'Tag created successfully.',
      data: tag,
    };
  }

  async updateTag(tagId: string, dto: UpdateTagDto, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, workspaceId: context.workspaceId, deletedAt: null },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    // Check name conflict (exclude self)
    if (dto.name && dto.name.toLowerCase() !== tag.name.toLowerCase()) {
      const conflict = await this.prisma.tag.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          workspaceId: context.workspaceId,
          deletedAt: null,
          id: { not: tagId },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Tag with name "${dto.name}" already exists in this workspace.`,
        );
      }
    }

    const updated = await this.prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
      },
    });

    return {
      message: 'Tag updated successfully.',
      data: updated,
    };
  }

  async deleteTag(tagId: string, request: AuthRequest) {
    const context = await this.contextService.resolveContext(request);

    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, workspaceId: context.workspaceId, deletedAt: null },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found.');
    }

    // Cascade delete handled by DB (onDelete: Cascade on TaskTag)
    await this.prisma.tag.update({
      where: { id: tagId },
      data: { deletedAt: new Date() },
    });

    return {
      message: 'Tag deleted successfully.',
      data: { id: tagId },
    };
  }
}
