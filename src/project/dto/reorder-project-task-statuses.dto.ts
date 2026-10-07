import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderProjectTaskStatusesDto {
  @ApiProperty({
    description: 'Ordered array of task status IDs for this project',
    example: ['task-status-id-1', 'task-status-id-2'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  statusIds!: string[];
}
