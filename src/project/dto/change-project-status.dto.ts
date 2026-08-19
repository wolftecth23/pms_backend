import { IsNotEmpty, IsString } from 'class-validator';

export class ChangeProjectStatusDto {
  @IsString()
  @IsNotEmpty()
  statusId!: string;
}
