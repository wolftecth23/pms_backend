import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateOrgRoleDto {
  @ApiPropertyOptional({
    description: 'Updated name of the organization role',
    example: 'Senior Security Auditor',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description of the role',
    example: 'Updated responsibilities for security audits',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
