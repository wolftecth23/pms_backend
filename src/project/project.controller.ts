import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/auth.controller';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectService } from './project.service';
// import { AuthRequest } from '../auth/auth.controller';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('workspace-projects')
  @RequirePermissions('project.view')
  @ApiOperation({ summary: 'Get projects of the selected workspace' })
  findByWorkspace(
    @Request() request: AuthRequest,
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 10,
    @Query('search') search?: string,
    @Query('statusId') statusId?: string,
  ) {
    return this.projectService.findByWorkspace(
      request,
      page,
      limit,
      search,
      statusId,
    );
  }

  @Get(':id')
  @RequirePermissions('project.view')
  @ApiOperation({ summary: 'Get a project by id' })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.projectService.findOne(id, request);
  }

  @Post()
  @RequirePermissions('project.create')
  @ApiOperation({ summary: 'Create a new project' })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Request() req: AuthRequest,
  ) {
    return this.projectService.create(createProjectDto, req);
  }

  @Patch(':id')
  @RequirePermissions('project.update')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Request() request: AuthRequest,
  ) {
    return this.projectService.update(id, dto, request);
  }

  // @Get()
  // @RequirePermissions('project.view')
  // @ApiOperation({ summary: 'Get all projects' })
  // findByOrganization(@Request() request: AuthRequest) {
  //   return this.projectService.findByOrganization(request);
  // }

  // @Delete(':id')
  // @RequirePermissions('project.delete')
  // @ApiOperation({ summary: 'Delete a project' })
  // remove(@Param('id') id: string, @Request() request: AuthRequest) {
  //   return this.projectService.remove(id, request);
  // }

  // @Patch('archive/:id')
  // @RequirePermissions('project.archive')
  // @ApiOperation({ summary: 'Archive a project' })
  // archive(@Param('id') id: string, @Request() request: AuthRequest) {
  //   return this.projectService.archive(id, request);
  // }

  // @Patch('restore/:id')
  // @RequirePermissions('project.restore')
  // @ApiOperation({ summary: 'Restore an archived project' })
  // restore(@Param('id') id: string, @Request() request: AuthRequest) {
  //   return this.projectService.restore(id, request);
  // }

  // @Patch('status/:id')
  // @RequirePermissions('project.change_status')
  // @ApiOperation({ summary: 'Change project status' })
  // changeStatus(
  //   @Param('id') id: string,
  //   @Body() dto: ChangeProjectStatusDto,
  //   @Request() request: AuthRequest,
  // ) {
  //   return this.projectService.changeStatus(id, dto, request);
  // }
}
