import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectPriority, ProjectVisibility } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty()
  @IsString()
  statusId!: string;

  @ApiPropertyOptional({
    enum: ProjectPriority,
    default: ProjectPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  projectMemberIds!: string[];

  @ApiPropertyOptional({
    enum: ProjectVisibility,
    default: ProjectVisibility.WORKSPACE,
  })
  @IsOptional()
  @IsEnum(ProjectVisibility)
  visibility?: ProjectVisibility;

  @ApiPropertyOptional({
    example: '2026-07-31T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: Date;

  @ApiProperty()
  @IsString()
  createdById!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
