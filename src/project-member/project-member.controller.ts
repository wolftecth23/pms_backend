import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ProjectMemberService } from './project-member.service';

@Controller('project-member')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProjectMemberController {
  constructor(private readonly projectMemberService: ProjectMemberService) {}

  @Get(':projectId')
  @RequirePermissions('project_member.view')
  @ApiOperation({ summary: 'Get project members' })
  findMembers(
    @Param('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.projectMemberService.findMembers(projectId, request);
  }

  @Post(':projectId')
  @RequirePermissions('project_member.add')
  @ApiOperation({ summary: 'Add member to project' })
  addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @Request() request: AuthRequest,
  ) {
    return this.projectMemberService.addMember(projectId, dto, request);
  }
}
