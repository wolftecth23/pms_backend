import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ProjectStatusService } from './project-status.service';

@Controller('project-status')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProjectStatusController {
  constructor(private readonly projectStatusService: ProjectStatusService) {}

  @Get()
  @ApiOperation({ summary: 'Get project statuses' })
  findStatusByOrganization(@Request() request: AuthRequest) {
    return this.projectStatusService.findStatusByOrganization(request);
  }
}
