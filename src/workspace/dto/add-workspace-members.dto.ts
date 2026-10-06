import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class AddWorkspaceMembersDto {
  @ApiPropertyOptional({
    description: 'Single user ID to add to the workspace',
    example: 'cm1abc123',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'List of user IDs to add to the workspace in batch',
    type: [String],
    example: ['cm1abc123', 'cm2xyz456'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];
}
