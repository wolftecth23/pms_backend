import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProjectMemberRoleDto {
  @ApiProperty({
    description: 'The role ID to assign to the project member',
  })
  @IsString()
  @IsNotEmpty()
  roleId!: string;
}
