// dto/change-task-status.dto.ts

import { IsNotEmpty, IsString } from 'class-validator';

export class ChangeTaskStatusDto {
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @IsString()
  @IsNotEmpty()
  statusId!: string;
}
