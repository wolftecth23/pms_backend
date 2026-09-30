import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCRDescriptionDto {
  @ApiPropertyOptional({ description: 'What is currently included in the project?' })
  @IsOptional()
  @IsString()
  existingScope?: string;

  @ApiPropertyOptional({ description: 'What does the requester want to change or add?' })
  @IsOptional()
  @IsString()
  requestedChange?: string;

  @ApiPropertyOptional({ description: 'Why is this change required?' })
  @IsOptional()
  @IsString()
  reasonForChange?: string;

  @ApiPropertyOptional({ description: 'What is the business value?' })
  @IsOptional()
  @IsString()
  businessJustification?: string;

  @ApiPropertyOptional({ description: 'How will existing functionality be affected?' })
  @IsOptional()
  @IsString()
  functionalImpact?: string;

  @ApiPropertyOptional({ description: 'What technical changes are expected?' })
  @IsOptional()
  @IsString()
  technicalImpact?: string;

  @ApiPropertyOptional({ description: 'What dependencies are required?' })
  @IsOptional()
  @IsString()
  dependencies?: string;

  @ApiPropertyOptional({ description: 'What assumptions are being made?' })
  @IsOptional()
  @IsString()
  assumptions?: string;

  @ApiPropertyOptional({ description: 'What should be considered complete?' })
  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;
}
