import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProjectRoleDto {
  @ApiPropertyOptional({
    description: 'Updated name of the project role',
    example: 'Senior Frontend Lead',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description of the role',
    example: 'Updated responsibilities for frontend development',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
