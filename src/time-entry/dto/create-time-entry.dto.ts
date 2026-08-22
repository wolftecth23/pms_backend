import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateTimeEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectMemberId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  loggedDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taskAssigneeId?: string;
}
