import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import * as authController from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../common/storage/storage.service';
import { CommentService } from './comment.service';
import { AttachmentDto, CreateCommentDto } from './dto/create-comment.dto';
import { ReactionDto } from './dto/reaction.dto';
import { ScheduleCommentDto } from './dto/schedule-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentOwnerGuard } from './guards/comment-owner.guard';
import { ProjectMemberGuard } from './guards/project-member.guard';

function getUserId(req: authController.AuthRequest): string {
  return req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';
}

@ApiTags('comments')
@Controller()
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly storage: StorageService,
  ) {}

  // ─── GET ALL COMMENTS (FLAT LIST) ─────────────────────────────────────────

  @Get('tasks/:taskId/comments')
  @ApiOperation({
    summary: 'Get all comments for a task in flat chronological order',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  getComments(
    @Param('taskId') taskId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('order') order?: 'asc' | 'desc',
    @Request() req?: authController.AuthRequest,
  ) {
    return this.commentService.getComments(
      taskId,
      getUserId(req!),
      cursor,
      limit,
      order,
    );
  }

  // ─── GET SINGLE COMMENT ───────────────────────────────────────────────────

  @Get('comments/:commentId')
  @ApiOperation({ summary: 'Get a single comment by ID' })
  getComment(
    @Param('commentId') commentId: string,
    @Request() req: authController.AuthRequest,
  ) {
    return this.commentService.getComment(commentId, getUserId(req));
  }

  // ─── CREATE COMMENT (JSON or multipart with files) ────────────────────────

  @Post('tasks/:taskId/comments')
  @UseGuards(ProjectMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary:
      'Create a comment or quote-reply. Supports multipart/form-data for direct file upload.',
    description: `
**Two ways to call this endpoint:**

**1. JSON (no files):**
\`Content-Type: application/json\`
Send the JSON body directly.

**2. Multipart (with files):**
\`Content-Type: multipart/form-data\`
- Field \`data\` (required): JSON string of the comment payload
- Fields \`files\` (optional): one or more file parts

All uploaded files are saved and their metadata is stored as comment attachments automatically.
`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string of CreateCommentDto',
          example: '{"text":"Hello","replyToId":null,"mentionUserIds":[]}',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['data'],
    },
  })
  async createComment(
    @Param('taskId') taskId: string,
    @Req() req: FastifyRequest & authController.AuthRequest,
  ) {
    const userId = getUserId(req);

    // Detect Content-Type
    const contentType = req.headers['content-type'] ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    let dto: CreateCommentDto;
    const uploadedFiles: AttachmentDto[] = [];

    if (isMultipart) {
      // ── Multipart path: parse fields + files ──
      const parts = req.parts();
      let rawData: string | undefined;

      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'data') {
          rawData = part.value as string;
        } else if (part.type === 'file') {
          // Collect file buffer
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const originalName = part.filename ?? 'file';
          const mimeType = part.mimetype ?? 'application/octet-stream';

          // Save to disk
          const saved = await this.storage.saveFile(
            buffer,
            originalName,
            mimeType,
          );
          uploadedFiles.push(saved);
        }
      }

      if (!rawData) {
        throw new Error(
          'Multipart request must include a "data" field with the comment JSON.',
        );
      }

      dto = JSON.parse(rawData) as CreateCommentDto;
    } else {
      // ── JSON path ──
      dto = (req as any).body as CreateCommentDto;
    }

    return this.commentService.createComment(
      taskId,
      userId,
      dto,
      uploadedFiles,
    );
  }

  // ─── UPDATE COMMENT ───────────────────────────────────────────────────────

  @Patch('comments/:commentId')
  @UseGuards(CommentOwnerGuard)
  @ApiOperation({ summary: 'Update comment text and mentions (owner only)' })
  updateComment(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @Request() req: authController.AuthRequest,
  ) {
    return this.commentService.updateComment(commentId, getUserId(req), dto);
  }

  // ─── DELETE COMMENT ───────────────────────────────────────────────────────

  @Delete('comments/:commentId')
  @UseGuards(CommentOwnerGuard)
  @ApiOperation({
    summary: 'Delete a comment and its attachments (owner only)',
  })
  deleteComment(@Param('commentId') commentId: string) {
    return this.commentService.deleteComment(commentId);
  }

  // ─── TOGGLE REACTION ──────────────────────────────────────────────────────

  @Post('comments/:commentId/reactions')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'Toggle an emoji reaction on a comment' })
  toggleReaction(
    @Param('commentId') commentId: string,
    @Body() dto: ReactionDto,
    @Request() req: authController.AuthRequest,
  ) {
    return this.commentService.toggleReaction(
      commentId,
      getUserId(req),
      dto.emoji,
    );
  }

  // ─── SCHEDULE COMMENT ─────────────────────────────────────────────────────

  @Post('comments/:commentId/schedule')
  @UseGuards(CommentOwnerGuard)
  @ApiOperation({
    summary: 'Schedule a comment for future publication (owner only)',
  })
  scheduleComment(
    @Param('commentId') commentId: string,
    @Body() dto: ScheduleCommentDto,
    @Request() req: authController.AuthRequest,
  ) {
    return this.commentService.scheduleComment(
      commentId,
      getUserId(req),
      dto.scheduledFor,
    );
  }

  // ─── CANCEL SCHEDULE ──────────────────────────────────────────────────────

  @Delete('comments/:commentId/schedule')
  @UseGuards(CommentOwnerGuard)
  @ApiOperation({ summary: 'Cancel a pending scheduled comment (owner only)' })
  cancelSchedule(
    @Param('commentId') commentId: string,
    @Request() req: authController.AuthRequest,
  ) {
    return this.commentService.cancelSchedule(commentId, getUserId(req));
  }

  // ─── ADD ATTACHMENT (post-creation) ──────────────────────────────────────

  @Post('comments/:commentId/attachments')
  @UseGuards(ProjectMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a file and attach it to an existing comment',
    description: 'Send multipart/form-data with a single "file" field.',
  })
  @ApiConsumes('multipart/form-data')
  async addAttachment(
    @Param('commentId') commentId: string,
    @Req() req: FastifyRequest & authController.AuthRequest,
  ) {
    const userId = getUserId(req);
    const parts = req.parts();

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const saved = await this.storage.saveFile(
          buffer,
          part.filename ?? 'file',
          part.mimetype ?? 'application/octet-stream',
        );
        return this.commentService.addAttachment(commentId, userId, saved);
      }
    }

    throw new Error('No file part found in multipart request.');
  }

  // ─── DELETE ATTACHMENT ────────────────────────────────────────────────────

  @Delete('comments/:commentId/attachments/:attachmentId')
  @UseGuards(CommentOwnerGuard)
  @ApiOperation({ summary: 'Remove an attachment from a comment (owner only)' })
  deleteAttachment(@Param('attachmentId') attachmentId: string) {
    return this.commentService.deleteAttachment(attachmentId);
  }
}
