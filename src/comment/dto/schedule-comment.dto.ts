import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class ScheduleCommentDto {
  @ApiProperty({ description: 'Scheduled publication date ISO string' })
  @IsDateString()
  @IsNotEmpty()
  scheduledFor: string;
}
