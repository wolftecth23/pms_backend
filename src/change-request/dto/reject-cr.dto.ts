import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RejectCRDto {
  @ApiPropertyOptional({
    description: 'Rejection reason or modification remarks',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    description:
      'If true, transitions to PENDING_MODIFICATION instead of REJECTED',
  })
  @IsOptional()
  @IsBoolean()
  requestModification?: boolean;
}
