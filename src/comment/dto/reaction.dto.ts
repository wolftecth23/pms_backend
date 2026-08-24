import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReactionDto {
  @ApiProperty({ description: 'Emoji symbol' })
  @IsString()
  @IsNotEmpty()
  emoji: string;
}
