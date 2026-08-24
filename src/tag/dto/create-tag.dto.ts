import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ description: 'Tag name (max 30 chars)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name!: string;

  @ApiPropertyOptional({
    description: 'Hex color code e.g. #3B82F6',
    default: '#3B82F6',
  })
  @IsOptional()
  @IsString()
  @IsHexColor()
  color?: string;
}
