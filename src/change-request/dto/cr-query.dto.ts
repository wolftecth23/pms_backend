import { ApiPropertyOptional } from '@nestjs/swagger';
import { CRPriority, CRStatus, CRType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CRQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search title, CR ID, or project code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: CRStatus })
  @IsOptional()
  @IsEnum(CRStatus)
  status?: CRStatus;

  @ApiPropertyOptional({ enum: CRType })
  @IsOptional()
  @IsEnum(CRType)
  type?: CRType;

  @ApiPropertyOptional({ enum: CRPriority })
  @IsOptional()
  @IsEnum(CRPriority)
  priority?: CRPriority;

  @ApiPropertyOptional({ description: 'Filter by requester user ID' })
  @IsOptional()
  @IsString()
  requestedById?: string;

  @ApiPropertyOptional({ description: 'Filter start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter end date (ISO string)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
