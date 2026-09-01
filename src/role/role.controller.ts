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
import { RequireProjectPermissions } from '../auth/decorators/project-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectPermissionGuard } from '../auth/guards/project-permission.guard';
import { CreateProjectRoleDto } from './dto/create-project-role.dto';
import { UpdateProjectRoleDto } from './dto/update-project-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RoleService } from './role.service';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, ProjectPermissionGuard)
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
}
