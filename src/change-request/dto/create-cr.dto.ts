import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CRPriority, CRType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UpdateCRDescriptionDto } from './update-cr-description.dto';
import { EffortRowDto } from './update-cr-effort.dto';

export class CreateCRDto {
  @ApiProperty({ description: 'Target project ID' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty({ description: 'Change request title', example: 'WhatsApp Integration' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: CRType, example: CRType.NEW_FEATURE })
  @IsEnum(CRType)
  type!: CRType;

  @ApiPropertyOptional({ enum: CRPriority, default: CRPriority.MEDIUM })
  @IsOptional()
  @IsEnum(CRPriority)
  priority?: CRPriority;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ type: () => UpdateCRDescriptionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCRDescriptionDto)
  description?: UpdateCRDescriptionDto;

  @ApiPropertyOptional({ type: () => [EffortRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EffortRowDto)
  effortRows?: EffortRowDto[];

  @ApiPropertyOptional({ type: [String], description: 'List of OrgMember IDs assigned as approvers' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverMemberIds?: string[];
}
