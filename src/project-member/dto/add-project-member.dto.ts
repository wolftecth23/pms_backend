import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional({
    description: 'Project role assigned to the member',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  projectRoleId?: string | null;
}
