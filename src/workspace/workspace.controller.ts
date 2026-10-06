import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AddWorkspaceMembersDto } from './dto/add-workspace-members.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspaces')
@Controller('workspaces')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * GET /workspaces
   * List all workspaces for the current organization.
   */
  @Get()
  @ApiOperation({ summary: 'List all workspaces for the current organization' })
  findAll(@Request() request: AuthRequest) {
    return this.workspaceService.findAll(request);
  }

  /**
   * GET /workspaces/organization-members
   * List all members of the organization, with optional workspace membership indicators.
   */
  @Get('organization-members')
  @RequireAnyPermissions(
    'workspace_member.add',
    'workspace.view',
    'workspace_member.view',
  )
  @ApiOperation({
    summary:
      'List members from current organization to assign to workspace',
  })
  findOrganizationMembers(
    @Request() request: AuthRequest,
    @Query('workspaceId') workspaceId?: string,
    @Query('search') search?: string,
    @Query('excludeExisting') excludeExisting?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const exclude = excludeExisting === 'true';

    return this.workspaceService.findOrganizationMembers(
      request,
      workspaceId,
      search,
      exclude,
      pageNum,
      limitNum,
    );
  }

  /**
   * POST /workspaces
   * Create a new workspace.
   */
  @Post()
  @RequirePermissions('workspace.create')
  @ApiOperation({ summary: 'Create a new workspace in the organization' })
  create(
    @Body() dto: CreateWorkspaceDto,
    @Request() request: AuthRequest,
  ) {
    return this.workspaceService.create(dto, request);
  }

  /**
   * GET /workspaces/:id/members
   * Get all members of a specific workspace.
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'List all members of a workspace' })
  findMembers(
    @Param('id') id: string,
    @Request() request: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    return this.workspaceService.findMembers(
      id,
      request,
      pageNum,
      limitNum,
      search,
    );
  }

  /**
   * POST /workspaces/:id/members
   * Add organization member(s) to a workspace.
   */
  @Post(':id/members')
  @RequirePermissions('workspace_member.add')
  @ApiOperation({
    summary: 'Add one or more organization members to a workspace',
  })
  addMembers(
    @Param('id') id: string,
    @Body() dto: AddWorkspaceMembersDto,
    @Request() request: AuthRequest,
  ) {
    return this.workspaceService.addMembers(id, dto, request);
  }

  /**
   * DELETE /workspaces/:id/members/:memberId
   * Remove a member from a workspace.
   */
  @Delete(':id/members/:memberId')
  @RequirePermissions('workspace_member.remove')
  @ApiOperation({ summary: 'Remove a member from a workspace' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() request: AuthRequest,
  ) {
    return this.workspaceService.removeMember(id, memberId, request);
  }
}
