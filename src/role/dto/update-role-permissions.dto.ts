import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    description: 'List of permission IDs to assign to this role',
    type: [String],
    example: ['perm_cuid_1', 'perm_cuid_2'],
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
