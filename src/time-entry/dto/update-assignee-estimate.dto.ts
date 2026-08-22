import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateAssigneeEstimateDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  estimatedMinutes!: number;
}
