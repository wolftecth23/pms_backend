import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddApproverDto {
  @ApiProperty({ description: 'Organization member ID to add as approver' })
  @IsString()
  @IsNotEmpty()
  orgMemberId!: string;
}
