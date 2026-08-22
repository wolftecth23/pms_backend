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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { TimeEntryQueryDto } from './dto/time-entry-query.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeEntryService } from './time-entry.service';

@ApiTags('time-entries')
@Controller()
@UseGuards(JwtAuthGuard)
export class TimeEntryController {
  constructor(private readonly timeEntryService: TimeEntryService) {}

  @Post('time-entries')
  @ApiOperation({ summary: 'Create a new time entry' })
  create(@Body() dto: CreateTimeEntryDto, @Request() request: AuthRequest) {
    return this.timeEntryService.create(dto, request);
  }

  @Get('tasks/:taskId/time-entries')
  @ApiOperation({ summary: 'Get time entries for a task' })
  findByTask(
    @Param('taskId') taskId: string,
    @Query() query: TimeEntryQueryDto,
    @Request() request: AuthRequest,
  ) {
    return this.timeEntryService.findByTask(taskId, query, request);
  }

  @Get('time-entries/active-timer')
  @ApiOperation({ summary: 'Get current active timer for logged in user' })
  getActiveTimer(@Request() request: AuthRequest) {
    return this.timeEntryService.getActiveTimer(request);
  }

  @Patch('time-entries/:id')
  @ApiOperation({ summary: 'Update a time entry' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTimeEntryDto,
    @Request() request: AuthRequest,
  ) {
    return this.timeEntryService.update(id, dto, request);
  }

  @Delete('time-entries/:id')
  @ApiOperation({ summary: 'Delete a time entry (soft delete)' })
  remove(@Param('id') id: string, @Request() request: AuthRequest) {
    return this.timeEntryService.remove(id, request);
  }

  @Post('tasks/:taskId/timer/start')
  @ApiOperation({ summary: 'Start a timer for a task' })
  startTimer(
    @Param('taskId') taskId: string,
    @Request() request: AuthRequest,
  ) {
    return this.timeEntryService.startTimer(taskId, request);
  }

  @Post('time-entries/:id/timer/stop')
  @ApiOperation({ summary: 'Stop a running timer' })
  stopTimer(
    @Param('id') id: string,
    @Request() request: AuthRequest,
  ) {
    return this.timeEntryService.stopTimer(id, request);
  }
}
