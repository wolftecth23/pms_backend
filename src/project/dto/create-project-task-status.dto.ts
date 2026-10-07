import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectTaskStatusDto {
  @ApiProperty({ description: 'Task status name', example: 'In QA' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Hex color code',
    example: '#8B5CF6',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Default status for new tasks in this project',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Marks task as closed/completed',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
