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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagService } from './tag.service';

@ApiTags('tags')
@Controller('workspaces/tags')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags in workspace' })
  listTags(@Request() request: AuthRequest) {
    return this.tagService.listTags(request);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag in workspace' })
  createTag(@Body() dto: CreateTagDto, @Request() request: AuthRequest) {
    return this.tagService.createTag(dto, request);
  }

  @Patch(':tagId')
  @ApiOperation({ summary: 'Update a tag name/color' })
  updateTag(
    @Param('tagId') tagId: string,
    @Body() dto: UpdateTagDto,
    @Request() request: AuthRequest,
  ) {
    return this.tagService.updateTag(tagId, dto, request);
  }

  @Delete(':tagId')
  @ApiOperation({
    summary: 'Delete a tag from workspace (removes from all tasks)',
  })
  deleteTag(@Param('tagId') tagId: string, @Request() request: AuthRequest) {
    return this.tagService.deleteTag(tagId, request);
  }
}
