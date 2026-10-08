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
import { RequireAnyPermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateOrgUserDto } from './dto/create-org-user.dto';
import { UpdateOrgUserDto } from './dto/update-org-user.dto';
import { OrgUserService } from './org-user.service';

@ApiTags('org-users')
@Controller('org-users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrgUserController {
  constructor(private readonly orgUserService: OrgUserService) {}

  /**
   * GET /org-users
   * List all organization users with search, role filter, status filter, and pagination.
   */
  @Get()
  @RequireAnyPermissions('organization_member.view')
  @ApiOperation({
    summary: 'List all organization members/users with pagination and filters',
  })
  findAll(
    @Request() request: AuthRequest,
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    return this.orgUserService.findAll(
      request,
      search,
      roleId,
      isActive,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /org-users/roles
   * List all selectable roles for assignment within this organization.
   */
  @Get('roles')
  @RequireAnyPermissions(
    'role.view',
    'organization_member.view',
    'organization_member.add',
  )
  @ApiOperation({
    summary:
      'List all available roles that can be assigned in this organization',
  })
  findAvailableRoles(@Request() request: AuthRequest) {
    return this.orgUserService.findAvailableRoles(request);
  }

  /**
   * GET /org-users/:id
   * Get single organization user details.
   */
  @Get(':id')
  @RequireAnyPermissions('organization_member.view')
  @ApiOperation({ summary: 'Get single organization user details' })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.orgUserService.findOne(id, request);
  }

  /**
   * POST /org-users
   * Add a new or existing user to the organization with assigned role.
   */
  @Post()
  @RequireAnyPermissions('organization_member.add')
  @ApiOperation({
    summary:
      'Create and add a new user to the organization with an assigned role',
  })
  create(@Body() dto: CreateOrgUserDto, @Request() request: AuthRequest) {
    return this.orgUserService.create(dto, request);
  }

  /**
   * PATCH /org-users/:id
   * Update user profile, status, or reassign organization role.
   */
  @Patch(':id')
  @RequireAnyPermissions('organization_member.update')
  @ApiOperation({
    summary:
      'Update user profile details, status, or reassign organization role',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgUserDto,
    @Request() request: AuthRequest,
  ) {
    return this.orgUserService.update(id, dto, request);
  }

  /**
   * DELETE /org-users/:id
   * Remove user from the organization.
   */
  @Delete(':id')
  @RequireAnyPermissions('organization_member.remove')
  @ApiOperation({ summary: 'Remove a user from the organization' })
  remove(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.orgUserService.remove(id, request);
  }
}
