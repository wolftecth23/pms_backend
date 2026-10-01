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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import type { AuthRequest } from '../auth/auth.controller';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ContextService } from '../common/context/context.service';
import { StorageService } from '../common/storage/storage.service';
import { ChangeRequestService } from './change-request.service';
import { CRActivityService } from './cr-activity.service';
import { AddApproverDto } from './dto/add-approver.dto';
import { ApproveCRDto } from './dto/approve-cr.dto';
import { CRQueryDto } from './dto/cr-query.dto';
import { CreateCRDto } from './dto/create-cr.dto';
import { RejectCRDto } from './dto/reject-cr.dto';
import { UpdateCRDescriptionDto } from './dto/update-cr-description.dto';
import { UpdateCREffortDto } from './dto/update-cr-effort.dto';
import { UpdateCRDto } from './dto/update-cr.dto';

@ApiTags('change-requests')
@Controller('change-requests')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ChangeRequestController {
  constructor(
    private readonly crService: ChangeRequestService,
    private readonly crActivityService: CRActivityService,
    private readonly contextService: ContextService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @RequirePermissions('cr.create')
  @ApiOperation({ summary: 'Create a new Change Request (saves as DRAFT)' })
  async create(@Req() req: AuthRequest, @Body() dto: CreateCRDto) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.create(userId, organizationId, dto);
    return {
      success: true,
      message: 'Change Request created successfully',
      data,
    };
  }

  @Get()
  @RequirePermissions('cr.view')
  @ApiOperation({ summary: 'List Change Requests for organization' })
  async findAll(@Req() req: AuthRequest, @Query() query: CRQueryDto) {
    const { organizationId, userId, roleName, permissions } =
      this.contextService.resolveOrganizationContext(req);
    const result = await this.crService.findAll(
      organizationId,
      query,
      userId,
      roleName,
      permissions,
    );
    return {
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('stats')
  @RequirePermissions('cr.view')
  @ApiOperation({ summary: 'Get aggregate stats for CRs' })
  async getStats(
    @Req() req: AuthRequest,
    @Query('projectId') projectId?: string,
  ) {
    const { organizationId, userId, roleName, permissions } =
      this.contextService.resolveOrganizationContext(req);
    const stats = await this.crService.getStats(
      organizationId,
      projectId,
      userId,
      roleName,
      permissions,
    );
    return {
      success: true,
      data: stats,
    };
  }

  @Get('approver-candidates')
  @RequirePermissions('cr.view')
  @ApiOperation({
    summary: 'Get organization members eligible to be CR approvers',
  })
  async getApproverCandidates(
    @Req() req: AuthRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const { organizationId, userId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.getApproverCandidates(
      organizationId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      search,
      userId,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('next-number')
  @RequirePermissions('cr.view')
  @ApiOperation({
    summary: 'Preview next auto-generated CR number for a project',
  })
  async getNextCRNumber(
    @Req() req: AuthRequest,
    @Query('projectId') projectId: string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }
    const { organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const result = await this.crService.getNextCRNumber(
      projectId,
      organizationId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @RequirePermissions('cr.view')
  @ApiOperation({ summary: 'Get Change Request details by ID' })
  async findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    const { organizationId, userId, roleName, permissions } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.findById(
      id,
      organizationId,
      userId,
      roleName,
      permissions,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @RequirePermissions('cr.update')
  @ApiOperation({ summary: 'Update Change Request basic details' })
  async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCRDto,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.update(id, userId, organizationId, dto);
    return {
      success: true,
      message: 'Change Request updated successfully',
      data,
    };
  }

  @Patch(':id/description')
  @RequirePermissions('cr.update')
  @ApiOperation({
    summary: 'Update Step 2 change description structured fields',
  })
  async updateDescription(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCRDescriptionDto,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.updateDescription(
      id,
      userId,
      organizationId,
      dto,
    );
    return {
      success: true,
      message: 'Change description updated successfully',
      data,
    };
  }

  @Put(':id/effort')
  @RequirePermissions('cr.update')
  @ApiOperation({
    summary: 'Replace all effort estimation rows and recompute totals',
  })
  async updateEffort(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCREffortDto,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.updateEffort(
      id,
      userId,
      organizationId,
      dto,
    );
    return {
      success: true,
      message: 'Effort estimation updated successfully',
      data,
    };
  }

  @Delete(':id')
  @RequirePermissions('cr.delete')
  @ApiOperation({ summary: 'Soft-delete a Change Request' })
  async delete(@Req() req: AuthRequest, @Param('id') id: string) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    return this.crService.delete(id, userId, organizationId);
  }

  @Post(':id/submit')
  @RequirePermissions('cr.submit')
  @ApiOperation({ summary: 'Submit Change Request for approval' })
  async submit(@Req() req: AuthRequest, @Param('id') id: string) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.submit(id, userId, organizationId);
    return {
      success: true,
      message: 'Change Request submitted for approval',
      data,
    };
  }

  @Post(':id/approve')
  @RequirePermissions('cr.approve_reject')
  @ApiOperation({ summary: 'Approve Change Request' })
  async approve(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ApproveCRDto,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.approve(id, userId, organizationId, dto);
    return {
      success: true,
      message: 'Change Request approved',
      data,
    };
  }

  @Post(':id/reject')
  @RequirePermissions('cr.approve_reject')
  @ApiOperation({ summary: 'Reject Change Request or request modifications' })
  async reject(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RejectCRDto,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.reject(id, userId, organizationId, dto);
    return {
      success: true,
      message: dto.requestModification
        ? 'Modifications requested for Change Request'
        : 'Change Request rejected',
      data,
    };
  }

  @Post(':id/cancel')
  @RequirePermissions('cr.cancel')
  @ApiOperation({ summary: 'Cancel Change Request' })
  async cancel(@Req() req: AuthRequest, @Param('id') id: string) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.cancel(id, userId, organizationId);
    return {
      success: true,
      message: 'Change Request cancelled',
      data,
    };
  }

  @Post(':id/approvers')
  @RequirePermissions('cr.manage_approvers')
  @ApiOperation({ summary: 'Add an approver from organization members' })
  async addApprover(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: AddApproverDto,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    const data = await this.crService.addApprover(
      id,
      userId,
      organizationId,
      dto,
    );
    return {
      success: true,
      message: 'Approver added successfully',
      data,
    };
  }

  @Delete(':id/approvers/:approverId')
  @RequirePermissions('cr.manage_approvers')
  @ApiOperation({ summary: 'Remove an approver' })
  async removeApprover(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('approverId') approverId: string,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    return this.crService.removeApprover(
      id,
      approverId,
      userId,
      organizationId,
    );
  }

  @Get(':id/activities')
  @RequirePermissions('cr.view')
  @ApiOperation({ summary: 'Get Change Request activity history' })
  async getActivities(@Param('id') id: string) {
    const data = await this.crActivityService.getActivities(id);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/attachments')
  @RequirePermissions('cr.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload attachment to Change Request' })
  async uploadAttachment(
    @Req() req: FastifyRequest & AuthRequest,
    @Param('id') id: string,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
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
          const res = await this.crService.addAttachment(
            id,
            userId,
            organizationId,
            saved,
          );
          uploadedAttachments.push(res);
        }
      }
    } catch (err: any) {
      if (err?.code === 'FST_FILES_LIMIT') {
        throw new BadRequestException('Too many files uploaded in request');
      }
      throw err;
    }

    if (uploadedAttachments.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      success: true,
      message: 'Attachment uploaded successfully',
      data:
        uploadedAttachments.length === 1
          ? uploadedAttachments[0]
          : uploadedAttachments,
    };
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions('cr.update')
  @ApiOperation({ summary: 'Delete a Change Request attachment' })
  async deleteAttachment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const { userId, organizationId } =
      this.contextService.resolveOrganizationContext(req);
    return this.crService.deleteAttachment(
      id,
      attachmentId,
      userId,
      organizationId,
    );
  }
}
