import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { WorkspaceMemberService } from './workspace-member.service';

@Controller('workspace-member')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkspaceMemberController {
  constructor(
    private readonly workspaceMemberService: WorkspaceMemberService,
  ) {}

  @Get()
  @RequirePermissions('project_member.view')
  @ApiOperation({ summary: 'Get project members' })
  findMembers(
    @Request() request: AuthRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    return this.workspaceMemberService.findMembers(
      request,
      Number(page),
      Number(limit),
      search,
    );
  }

  // @Post(':projectId')
  // @RequirePermissions('project_member.add')
  // @ApiOperation({ summary: 'Add member to project' })
  // addMember(
  //   @Param('projectId') projectId: string,
  //   @Body() dto: AddProjectMemberDto,
  //   @Request() request: AuthRequest,
  // ) {
  //   return this.workspaceMemberService.addMember(projectId, dto, request);
  // }
}
