import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOrgTeamDto {
  @ApiProperty({ example: 'Frontend' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Handles all UI and frontend work' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
