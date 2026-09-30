import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class EffortRowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Design' })
  @IsString()
  role!: string;

  @ApiProperty({ example: 8, default: 0 })
  @IsNumber()
  @Min(0)
  minHours!: number;

  @ApiProperty({ example: 16, default: 0 })
  @IsNumber()
  @Min(0)
  maxHours!: number;

  @ApiProperty({ example: 12, default: 0 })
  @IsNumber()
  @Min(0)
  proposedHours!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateCREffortDto {
  @ApiProperty({ type: [EffortRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EffortRowDto)
  rows!: EffortRowDto[];
}
