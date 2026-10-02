import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateOrgTeamDto } from './dto/create-org-team.dto';
import { UpdateOrgTeamDto } from './dto/update-org-team.dto';
import { OrgTeamService } from './org-team.service';

@ApiTags('org-teams')
@Controller('org-teams')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrgTeamController {
  constructor(private readonly orgTeamService: OrgTeamService) {}

  /**
   * GET /org-teams
   * Open to all authenticated users — used by task create/edit dropdowns.
   */
  @Get()
  @ApiOperation({ summary: 'List all teams in the current organization' })
  findAll(@Request() request: AuthRequest) {
    return this.orgTeamService.findAll(request);
  }

  /**
   * POST /org-teams
   * Requires team.create permission.
   */
  @Post()
  @RequirePermissions('team.create')
  @ApiOperation({ summary: 'Create a new team in the organization' })
  create(@Body() dto: CreateOrgTeamDto, @Request() request: AuthRequest) {
    return this.orgTeamService.create(dto, request);
  }

  /**
   * PATCH /org-teams/:id
   * Requires team.update permission.
   */
  @Patch(':id')
  @RequirePermissions('team.update')
  @ApiOperation({ summary: 'Update a team' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgTeamDto,
    @Request() request: AuthRequest,
  ) {
    return this.orgTeamService.update(id, dto, request);
  }

  /**
   * DELETE /org-teams/:id
   * Requires team.delete permission.
   */
  @Delete(':id')
  @RequirePermissions('team.delete')
  @ApiOperation({ summary: 'Soft-delete a team' })
  remove(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.orgTeamService.remove(id, request);
  }
}
