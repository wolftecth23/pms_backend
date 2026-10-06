import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrgRoleDto {
  @ApiProperty({
    description: 'Name of the organization role',
    example: 'Security Auditor',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the role and responsibilities',
    example: 'Audit organization activities and security settings',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'List of permission IDs to assign to this role',
    type: [String],
    example: ['perm_cuid_1', 'perm_cuid_2'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}
