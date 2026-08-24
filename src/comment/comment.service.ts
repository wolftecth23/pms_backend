import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StorageService } from '../common/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { COMMENT_INCLUDE } from './comment.includes';
import { formatComment } from './comment.serializer';
import { AttachmentDto, CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

// Centralised schedule status constants — single source of truth
export const SCHEDULE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  CANCELLED: 'cancelled',
} as const;

export type ScheduleStatus =
  (typeof SCHEDULE_STATUS)[keyof typeof SCHEDULE_STATUS];

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── GET COMMENTS ─────────────────────────────────────────────────────────

  async getComments(
    taskId: string,
    currentUserId: string,
    cursor?: string,
    limit?: number,
    order: 'asc' | 'desc' = 'desc',
  ) {
    const parsedLimit =
      limit !== undefined && limit !== null && !isNaN(Number(limit))
        ? Math.min(Math.max(Number(limit), 1), 100)
        : undefined;

    const where = {
      taskId,
      // Do NOT show other users' pending scheduled comments
      OR: [
        { scheduledFor: null },
        { scheduleStatus: SCHEDULE_STATUS.SENT },
        { userId: currentUserId },
      ],
    };

    // If limit is not set, fetch all comments in ascending order
    if (!parsedLimit) {
      const comments = await this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: COMMENT_INCLUDE,
      });

      return {
        data: {
          data: comments.map((c) => formatComment(c, currentUserId)),
          hasMore: false,
          nextCursor: null,
          totalCount: comments.length,
        },
      };
    }

    const isDescMode = order === 'desc';

    const comments = await this.prisma.comment.findMany({
      where,
      take: parsedLimit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: isDescMode ? 'desc' : 'asc' },
      include: COMMENT_INCLUDE,
    });

    const hasMore = comments.length > parsedLimit;
    const rawData = hasMore ? comments.slice(0, parsedLimit) : comments;
    const totalCount = await this.prisma.comment.count({ where });

    // In desc mode, reverse rawData so the output array is chronological (asc)
    const finalData = isDescMode ? rawData.reverse() : rawData;

    // In desc mode, nextCursor for older comments is the top item (oldest of this window)
    const nextCursor = hasMore
      ? isDescMode
        ? finalData[0].id
        : finalData[finalData.length - 1].id
      : null;

    return {
      data: {
        data: finalData.map((c) => formatComment(c, currentUserId)),
        hasMore,
        nextCursor,
        totalCount,
      },
    };
  }

  // ─── GET SINGLE COMMENT ──────────────────────────────────────────────────

  async getComment(commentId: string, currentUserId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: COMMENT_INCLUDE,
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    return formatComment(comment, currentUserId);
  }

  // ─── CREATE COMMENT ───────────────────────────────────────────────────────

  async createComment(
    taskId: string,
    currentUserId: string,
    dto: CreateCommentDto,
    uploadedFiles: AttachmentDto[] = [], // files uploaded via multipart
  ) {
    // Validate task exists
    const taskExists = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!taskExists) {
      throw new NotFoundException('Task not found.');
    }

    // FIX: Validate replyToId — must exist, belong to same task, and be already published (not pending)
    if (dto.replyToId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.replyToId },
        select: { id: true, taskId: true, scheduleStatus: true },
      });
      if (!parentComment || parentComment.taskId !== taskId) {
        throw new BadRequestException(
          'Quoted comment not found for this task.',
        );
      }
      if (parentComment.scheduleStatus === SCHEDULE_STATUS.PENDING) {
        throw new BadRequestException(
          'Cannot quote a comment that has not been published yet.',
        );
      }
    }

    // FIX: Validate scheduledFor is a future date
    if (dto.scheduledFor) {
      const scheduledDate = new Date(dto.scheduledFor);
      if (scheduledDate <= new Date()) {
        throw new BadRequestException('Scheduled time must be in the future.');
      }
    }

    // Merge pre-uploaded (URL) attachments + multipart uploaded files
    const allAttachments = [...(dto.attachments ?? []), ...uploadedFiles];

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        userId: currentUserId,
        text: dto.text,
        replyToId: dto.replyToId ?? null,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        scheduleStatus: dto.scheduledFor ? SCHEDULE_STATUS.PENDING : null,
        mentions: dto.mentionUserIds?.length
          ? { create: dto.mentionUserIds.map((id) => ({ userId: id })) }
          : undefined,
        attachments: allAttachments.length
          ? { create: allAttachments }
          : undefined,
      },
      include: COMMENT_INCLUDE,
    });

    return formatComment(comment, currentUserId);
  }

  // ─── UPDATE COMMENT ───────────────────────────────────────────────────────

  async updateComment(
    commentId: string,
    currentUserId: string,
    dto: UpdateCommentDto,
  ) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        text: dto.text,
        isEdited: true,
        mentions: {
          deleteMany: {},
          create: dto.mentionUserIds?.map((id) => ({ userId: id })) ?? [],
        },
      },
      include: COMMENT_INCLUDE,
    });

    return formatComment(comment, currentUserId);
  }

  // ─── DELETE COMMENT ───────────────────────────────────────────────────────

  async deleteComment(commentId: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { attachments: { select: { url: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    // Clean up stored files from disk
    for (const attachment of existing.attachments) {
      this.storage.deleteFile(attachment.url);
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { success: true };
  }

  // ─── TOGGLE REACTION ──────────────────────────────────────────────────────

  async toggleReaction(
    commentId: string,
    currentUserId: string,
    emoji: string,
  ) {
    const existingComment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existingComment) {
      throw new NotFoundException('Comment not found.');
    }

    const existingReaction = await this.prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: { commentId, userId: currentUserId, emoji },
      },
    });

    if (existingReaction) {
      await this.prisma.commentReaction.delete({
        where: { id: existingReaction.id },
      });
    } else {
      await this.prisma.commentReaction.create({
        data: { commentId, userId: currentUserId, emoji },
      });
    }

    const comment = await this.prisma.comment.findUniqueOrThrow({
      where: { id: commentId },
      include: COMMENT_INCLUDE,
    });

    return formatComment(comment, currentUserId);
  }

  // ─── SCHEDULE COMMENT ─────────────────────────────────────────────────────

  async scheduleComment(
    commentId: string,
    currentUserId: string,
    scheduledFor: string,
  ) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    // FIX: Validate scheduled time must be in the future
    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future.');
    }

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        scheduledFor: scheduledDate,
        scheduleStatus: SCHEDULE_STATUS.PENDING,
      },
      include: COMMENT_INCLUDE,
    });

    return formatComment(comment, currentUserId);
  }

  // ─── CANCEL SCHEDULE ──────────────────────────────────────────────────────

  async cancelSchedule(commentId: string, currentUserId: string) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    // FIX: Cannot cancel a comment that was already published
    if (existing.scheduleStatus === SCHEDULE_STATUS.SENT) {
      throw new BadRequestException(
        'Cannot cancel a comment that has already been published.',
      );
    }

    // FIX: Cannot cancel if there is nothing scheduled
    if (!existing.scheduledFor) {
      throw new BadRequestException('This comment is not scheduled.');
    }

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { scheduledFor: null, scheduleStatus: null },
      include: COMMENT_INCLUDE,
    });

    return formatComment(comment, currentUserId);
  }

  // ─── ADD ATTACHMENT ───────────────────────────────────────────────────────

  async addAttachment(
    commentId: string,
    currentUserId: string,
    dto: AttachmentDto,
  ) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found.');
    }

    const attachment = await this.prisma.commentAttachment.create({
      data: {
        commentId,
        name: dto.name,
        size: dto.size,
        mimeType: dto.mimeType,
        url: dto.url,
      },
    });

    return attachment;
  }

  // ─── DELETE ATTACHMENT ────────────────────────────────────────────────────

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.commentAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    // Delete from disk
    this.storage.deleteFile(attachment.url);

    await this.prisma.commentAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
  }
}
