import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export enum OtpTypeEnum {
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  TWO_FACTOR_AUTH = 'TWO_FACTOR_AUTH',
  LOGIN_OTP = 'LOGIN_OTP',
}

export class ForgotPasswordRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required.' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  otp!: string;

  @IsOptional()
  @IsEnum(OtpTypeEnum)
  type?: OtpTypeEnum = OtpTypeEnum.FORGOT_PASSWORD;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required.' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  otp!: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(6, { message: 'New password must be at least 6 characters long.' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,}$/, {
    message:
      'Password must contain at least 6 characters, including at least one uppercase letter, one number, and one unique character.',
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(6, { message: 'New password must be at least 6 characters long.' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,}$/, {
    message:
      'Password must contain at least 6 characters, including at least one uppercase letter, one number, and one unique character.',
  })
  newPassword!: string;
}

export class RequestChangePasswordOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  currentPassword!: string;
}

export class ChangePasswordWithOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(6, { message: 'New password must be at least 6 characters.' })
  newPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required.' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits.' })
  otp!: string;
}
