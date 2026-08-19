import {
  Body,
  Controller,
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
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('priorities')
  @ApiOperation({ summary: 'Get available task priorities' })
  findAvailablePriorities(
    @Query('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.findAvailablePriorities(projectId, request);
  }

  @Post()
  @RequirePermissions('task.create')
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() dto: CreateTaskDto, @Request() request: AuthRequest) {
    return this.taskService.create(dto, request);
  }

  @Get()
  @RequirePermissions('task.view')
  @ApiOperation({ summary: 'Get project tasks' })
  findByProject(
    @Query('projectId') projectId: string,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.findByProject(projectId, request);
  }

  @Patch('change-status')
  @RequireAnyPermissions('task.change_status', 'task.update')
  @ApiOperation({ summary: 'Change task status' })
  changeStatus(
    @Body() dto: ChangeTaskStatusDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.changeStatus(dto, request);
  }

  @Patch(':id')
  @RequirePermissions('task.update')
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() request: AuthRequest,
  ) {
    return this.taskService.update(id, updateTaskDto, request);
  }

  @Get(':id')
  @RequirePermissions('task.view')
  @ApiOperation({ summary: 'Get a task by id' })
  findOne(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.taskService.findOne(id, request);
  }

  // @Delete(':id')
  // @ApiOperation({ summary: 'Delete a task' })
  // remove(@Param('id') id: string) {
  //   return this.taskService.remove(id);
  // }
}
