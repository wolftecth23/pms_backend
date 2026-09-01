import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { RequireProjectPermissions } from '../auth/decorators/project-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectPermissionGuard } from '../auth/guards/project-permission.guard';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto';
import { ProjectMemberService } from './project-member.service';

@ApiTags('project-member')
@Controller('project-member')
@UseGuards(JwtAuthGuard, ProjectPermissionGuard)
export class ProjectMemberController {
  constructor(private readonly projectMemberService: ProjectMemberService) {}

  @Get('roles/list')
  @ApiOperation({ summary: 'Get available roles for project members' })
  findAvailableRoles(@Query('projectId') projectId?: string) {
    return this.projectMemberService.findAvailableRoles(projectId);
  }

  @Get(':projectId')
  @RequireProjectPermissions('project_member.view')
  @ApiOperation({ summary: 'Get project members' })
  findMembers(
    @Param('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.projectMemberService.findMembers(projectId, request);
  }

  @Post(':projectId')
  @RequireProjectPermissions('project_member.add')
  @ApiOperation({ summary: 'Add member to project' })
  addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @Request() request: AuthRequest,
  ) {
    return this.projectMemberService.addMember(projectId, dto, request);
  }

  @Patch(':projectId/:memberId/role')
  @RequireProjectPermissions('project_member.change_role')
  @ApiOperation({ summary: 'Update project member role' })
  updateMemberRole(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateProjectMemberRoleDto,
    @Request() request: AuthRequest,
  ) {
    return this.projectMemberService.updateMemberRole(
      projectId,
      memberId,
      dto,
      request,
    );
  }

  @Delete(':projectId/:memberId')
  @RequireProjectPermissions('project_member.remove')
  @ApiOperation({ summary: 'Remove member from project' })
  removeMember(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Request() request: AuthRequest,
  ) {
    return this.projectMemberService.removeMember(
      projectId,
      memberId,
      request,
    );
  }
}
