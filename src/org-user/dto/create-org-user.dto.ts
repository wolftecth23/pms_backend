import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOrgUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required.' })
  firstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @IsNotEmpty({ message: 'Designation is required.' })
  designation: string;

  @ApiProperty({ description: 'Role ID to assign within this organization' })
  @IsString()
  @IsNotEmpty({ message: 'Role is required.' })
  roleId: string;

  @ApiPropertyOptional({
    description: 'Initial password for user account (defaults to Password@123)',
    example: 'Password@123',
  })
  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  password?: string;
}
