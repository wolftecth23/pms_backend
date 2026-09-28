import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequireProjectPermissions } from '../auth/decorators/project-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ProjectPermissionGuard } from '../auth/guards/project-permission.guard';
import { StorageService } from '../common/storage/storage.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectService } from './project.service';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionGuard, ProjectPermissionGuard)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly storageService: StorageService,
  ) {}

  @Get('workspace-projects')
  @RequirePermissions('project.view')
  @ApiOperation({ summary: 'Get projects of the selected workspace' })
  findByWorkspace(
    @Request() request: AuthRequest,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
    @Query('search') search?: string,
    @Query('statusId') statusId?: string,
  ) {
    return this.projectService.findByWorkspace(
      request,
      page,
      limit,
      search,
      statusId,
    );
  }

  @Get(':id')
  @RequirePermissions('project.view')
  @RequireProjectPermissions('project.view')
  @ApiOperation({ summary: 'Get a project by id' })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.projectService.findOne(id, request);
  }

  @Post()
  @RequirePermissions('project.create')
  @ApiOperation({ summary: 'Create a new project' })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req: AuthRequest,
  ) {
    return this.projectService.create(createProjectDto, req);
  }

  @Patch(':id')
  @RequirePermissions('project.update')
  @RequireProjectPermissions('project.update')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Request() request: AuthRequest,
  ) {
    return this.projectService.update(id, dto, request);
  }

  @Delete(':id')
  @RequirePermissions('project.delete')
  @RequireProjectPermissions('project.delete')
  @ApiOperation({ summary: 'Delete a project' })
  remove(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.projectService.remove(id, request);
  }

  // ─── PROJECT ATTACHMENTS ─────────────────────────────────────────────────

  @Get(':projectId/attachments')
  @RequirePermissions('project.view')
  @RequireProjectPermissions('project.view')
  @ApiOperation({ summary: 'Get all attachments for a project' })
  getProjectAttachments(
    @Param('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.projectService.getProjectAttachments(projectId, request);
  }

  @Post(':projectId/attachments')
  @RequirePermissions('project.update')
  @RequireProjectPermissions('project.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment to a project' })
  async uploadProjectAttachment(
    @Param('projectId') projectId: string,
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
          const res = await this.projectService.addProjectAttachment(
            projectId,
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

  @Delete(':projectId/attachments/:attachmentId')
  @RequirePermissions('project.update')
  @RequireProjectPermissions('project.update')
  @ApiOperation({ summary: 'Delete a project attachment' })
  deleteProjectAttachment(
    @Param('attachmentId') attachmentId: string,
    @Request() request: AuthRequest,
  ) {
    return this.projectService.deleteProjectAttachment(attachmentId, request);
  }
}
