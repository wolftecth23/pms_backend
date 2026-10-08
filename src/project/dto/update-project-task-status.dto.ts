import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateProjectTaskStatusDto {
  @ApiPropertyOptional({ description: 'Task status name', example: 'In QA' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Hex color code', example: '#8B5CF6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Default status for new tasks in this project',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Marks task as closed/completed' })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
