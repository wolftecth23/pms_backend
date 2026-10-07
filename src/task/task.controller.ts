import {
  BadRequestException,
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
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import type { AuthRequest } from '../auth/auth.controller';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { RequireProjectPermissions } from '../auth/decorators/project-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ProjectPermissionGuard } from '../auth/guards/project-permission.guard';
import { StorageService } from '../common/storage/storage.service';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskActivityQueryDto } from './dto/task-activity-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionGuard, ProjectPermissionGuard)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly storageService: StorageService,
  ) {}

  @Get('priorities')
  @ApiOperation({ summary: 'Get available task priorities' })
  findAvailablePriorities(
    @Query('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.findAvailablePriorities(projectId, request);
  }

  @Post()
  @RequirePermissions('task.create')
  @RequireProjectPermissions('task.create')
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() dto: CreateTaskDto, @Request() request: AuthRequest) {
    return this.taskService.create(dto, request);
  }

  @Get()
  @RequirePermissions('task.view')
  @RequireProjectPermissions('task.view')
  @ApiOperation({ summary: 'Get project tasks' })
  findByProject(
    @Query('projectId') projectId: string,
    @Query('assigneeIds') rawAssigneeIds: string | undefined,
    @Query('statusFilter') statusFilter: string | undefined,
    @Request() request: AuthRequest,
  ) {
    const assigneeIds = rawAssigneeIds
      ? rawAssigneeIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return this.taskService.findByProject(
      projectId,
      request,
      assigneeIds,
      statusFilter,
    );
  }

  @Patch('change-status')
  @RequireAnyPermissions('task.change_status', 'task.update')
  @RequireProjectPermissions('task.change_status')
  @ApiOperation({ summary: 'Change task status' })
  changeStatus(
    @Body() dto: ChangeTaskStatusDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.changeStatus(dto, request);
  }

  @Patch(':id')
  @RequireAnyPermissions('task.update', 'task.view')
  @RequireProjectPermissions('task.update')
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.update(id, updateTaskDto, request);
  }

  @Get(':id')
  @RequirePermissions('task.view')
  @RequireProjectPermissions('task.view')
  @ApiOperation({ summary: 'Get a task by id' })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.taskService.findOne(id, request);
  }

  // ─── TASK ACTIVITIES ────────────────────────────────────────────────────

  @Get(':taskId/activities')
  @RequirePermissions('task.view')
  @RequireProjectPermissions('task.view')
  @ApiOperation({ summary: 'Get activity timeline for a task' })
  getTaskActivities(
    @Param('taskId') taskId: string,
    @Query() query: TaskActivityQueryDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.getTaskActivities(taskId, query, request);
  }

  // ─── TASK ATTACHMENTS ───────────────────────────────────────────────────

  @Get(':taskId/attachments')
  @RequirePermissions('task.view')
  @RequireProjectPermissions('task.view')
  @ApiOperation({ summary: 'Get all attachments for a task' })
  getTaskAttachments(
    @Param('taskId') taskId: string,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.getTaskAttachments(taskId, request);
  }

  @Post(':taskId/attachments')
  @RequirePermissions('task.update')
  @RequireProjectPermissions('task.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment to a task' })
  async uploadTaskAttachment(
    @Param('taskId') taskId: string,
    @Req() req: FastifyRequest & AuthRequest,
  ) {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub ?? '';
    const parts = req.parts();
    const uploadedAttachments: any[] = [];

    try {
      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const saved = await this.storageService.saveFile(
            buffer,
            part.filename ?? 'file',
            part.mimetype ?? 'application/octet-stream',
          );
          const res = await this.taskService.addTaskAttachment(
            taskId,
            userId,
            saved,
            req,
          );
          uploadedAttachments.push(res.data);
        }
      }
    } catch (err: any) {
      if (err?.code === 'FST_FILES_LIMIT') {
        throw new BadRequestException(
          'Too many files. You can upload a maximum of 10 files per request.',
        );
      }
      throw err;
    }

    if (uploadedAttachments.length === 0) {
      throw new BadRequestException('No file uploaded.');
    }

    return {
      success: true,
      message: 'Attachment(s) uploaded successfully.',
      data:
        uploadedAttachments.length === 1
          ? uploadedAttachments[0]
          : uploadedAttachments,
    };
  }

  @Delete(':taskId/attachments/:attachmentId')
  @RequirePermissions('task.update')
  @RequireProjectPermissions('task.update')
  @ApiOperation({ summary: 'Delete a task attachment' })
  deleteTaskAttachment(
    @Param('attachmentId') attachmentId: string,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.deleteTaskAttachment(attachmentId, request);
  }
}
