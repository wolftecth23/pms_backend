import { ApiPropertyOptional } from '@nestjs/swagger';
import { CRPriority, CRType } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCRDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: CRType })
  @IsOptional()
  @IsEnum(CRType)
  type?: CRType;

  @ApiPropertyOptional({ enum: CRPriority })
  @IsOptional()
  @IsEnum(CRPriority)
  priority?: CRPriority;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'List of OrgMember IDs assigned as approvers',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverMemberIds?: string[];
}
