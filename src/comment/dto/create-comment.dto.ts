import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttachmentDto {
  @ApiProperty({ description: 'Original filename' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'Accessible URL to the file (S3/CDN/local)' })
  @IsUrl({ require_tld: false }) // require_tld: false allows localhost URLs in dev
  url: string;
}

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment text content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional({
    description:
      'ID of the comment being quoted (flat quote-reply like WhatsApp)',
  })
  @IsString()
  @IsOptional()
  replyToId?: string;

  @ApiPropertyOptional({
    description: 'Array of user IDs mentioned in the comment',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionUserIds?: string[];

  @ApiPropertyOptional({
    description:
      'Pre-uploaded attachments (URL already known). For direct file upload use multipart/form-data.',
    type: [AttachmentDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description:
      'ISO date string for scheduling comment publication (must be a future time)',
  })
  @IsDateString()
  @IsOptional()
  scheduledFor?: string;
}
