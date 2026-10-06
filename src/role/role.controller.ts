import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { RequireOrgPermissions } from '../auth/decorators/org-permissions.decorator';
import { RequireProjectPermissions } from '../auth/decorators/project-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgPermissionGuard } from '../auth/guards/org-permission.guard';
import { ProjectPermissionGuard } from '../auth/guards/project-permission.guard';
import { CreateOrgRoleDto } from './dto/create-org-role.dto';
import { CreateProjectRoleDto } from './dto/create-project-role.dto';
import { UpdateOrgRoleDto } from './dto/update-org-role.dto';
import { UpdateProjectRoleDto } from './dto/update-project-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RoleService } from './role.service';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, ProjectPermissionGuard, OrgPermissionGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('project/:projectId/permissions')
  @RequireProjectPermissions('role.view')
  @ApiOperation({ summary: 'Get available permissions that can be assigned to project roles' })
  getAvailableProjectPermissions(
    @Param('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.getAvailableProjectPermissions(projectId, request);
  }

  @Get('project/:projectId')
  @RequireProjectPermissions('role.view')
  @ApiOperation({ summary: 'Get all roles (system & custom) for a project' })
  findProjectRoles(
    @Param('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.findProjectRoles(projectId, request);
  }

  @Get('project/:projectId/:roleId')
  @RequireProjectPermissions('role.view')
  @ApiOperation({ summary: 'Get single project role details' })
  findProjectRoleById(
    @Param('projectId') projectId: string,
    @Param('roleId') roleId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.findProjectRoleById(projectId, roleId, request);
  }

  @Post('project/:projectId')
  @RequireProjectPermissions('role.create')
  @ApiOperation({ summary: 'Create a custom role for a project' })
  createProjectRole(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectRoleDto,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.createProjectRole(projectId, dto, request);
  }

  @Patch('project/:projectId/:roleId')
  @RequireProjectPermissions('role.update')
  @ApiOperation({ summary: 'Update custom project role name or description' })
  updateProjectRole(
    @Param('projectId') projectId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateProjectRoleDto,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.updateProjectRole(projectId, roleId, dto, request);
  }

  @Put('project/:projectId/:roleId/permissions')
  @RequireProjectPermissions('role.manage_permissions')
  @ApiOperation({ summary: 'Update permissions of a custom project role' })
  updateRolePermissions(
    @Param('projectId') projectId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.updateRolePermissions(
      projectId,
      roleId,
      dto,
      request,
    );
  }

  @Delete('project/:projectId/:roleId')
  @RequireProjectPermissions('role.delete')
  @ApiOperation({ summary: 'Delete a custom project role' })
  deleteProjectRole(
    @Param('projectId') projectId: string,
    @Param('roleId') roleId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.deleteProjectRole(projectId, roleId, request);
  }

  // ─── ORGANIZATION ROLE ENDPOINTS ───────────────────────────────────────────

  @Get('org/:orgId/permissions')
  @RequireOrgPermissions('role.view')
  @ApiOperation({ summary: 'Get available permissions that can be assigned to organization roles' })
  getAvailableOrgPermissions(
    @Param('orgId') orgId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.getAvailableOrgPermissions(orgId, request);
  }

  @Get('org/:orgId')
  @RequireOrgPermissions('role.view')
  @ApiOperation({ summary: 'Get all roles (system & custom) for an organization' })
  findOrgRoles(
    @Param('orgId') orgId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.findOrgRoles(orgId, request);
  }

  @Get('org/:orgId/:roleId')
  @RequireOrgPermissions('role.view')
  @ApiOperation({ summary: 'Get single organization role details' })
  findOrgRoleById(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.findOrgRoleById(orgId, roleId, request);
  }

  @Post('org/:orgId')
  @RequireOrgPermissions('role.create')
  @ApiOperation({ summary: 'Create a custom role for an organization' })
  createOrgRole(
    @Param('orgId') orgId: string,
    @Body() dto: CreateOrgRoleDto,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.createOrgRole(orgId, dto, request);
  }

  @Patch('org/:orgId/:roleId')
  @RequireOrgPermissions('role.update')
  @ApiOperation({ summary: 'Update custom organization role name or description' })
  updateOrgRole(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateOrgRoleDto,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.updateOrgRole(orgId, roleId, dto, request);
  }

  @Put('org/:orgId/:roleId/permissions')
  @RequireOrgPermissions('role.manage_permissions')
  @ApiOperation({ summary: 'Update permissions of a custom organization role' })
  updateOrgRolePermissions(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.updateOrgRolePermissions(
      orgId,
      roleId,
      dto,
      request,
    );
  }

  @Delete('org/:orgId/:roleId')
  @RequireOrgPermissions('role.delete')
  @ApiOperation({ summary: 'Delete a custom organization role' })
  deleteOrgRole(
    @Param('orgId') orgId: string,
    @Param('roleId') roleId: string,
    @Request() request: AuthRequest,
  ) {
    return this.roleService.deleteOrgRole(orgId, roleId, request);
  }
}
