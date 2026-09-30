import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveCRDto {
  @ApiPropertyOptional({ description: 'Approver comments or notes' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
