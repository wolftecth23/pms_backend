import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Development Workspace' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Workspace for development team' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional initial member user IDs to add to the workspace',
    type: [String],
    example: ['cm1abc123'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  memberUserIds?: string[];
}

