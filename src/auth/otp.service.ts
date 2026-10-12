import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OtpVerification, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { OtpTypeEnum } from './dto/otp-auth.dto';

export interface SendOtpParams {
  email: string;
  type: OtpTypeEnum;
  userId?: string;
  recipientName?: string;
  purpose: string;
  metadata?: Prisma.InputJsonValue;
}

export interface VerifyOtpParams {
  email: string;
  type: OtpTypeEnum;
  otp: string;
  consume?: boolean;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generates a 6-digit cryptographically secure OTP, hashes it,
   * stores it in the database with 10-minute expiry, and emails the user.
   */
  async generateAndSendOtp(params: SendOtpParams): Promise<{
    success: boolean;
    message: string;
  }> {
    const email = params.email.toLowerCase().trim();

    // 1. Enforce 60-second cooldown between requests
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentOtp = await this.prisma.otpVerification.findFirst({
      where: {
        email,
        type: params.type,
        createdAt: { gt: oneMinuteAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      throw new BadRequestException(
        'Please wait at least 60 seconds before requesting another verification code.',
      );
    }

    // 2. Mark any existing active OTPs for this email & type as used
    await this.prisma.otpVerification.updateMany({
      where: {
        email,
        type: params.type,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // 3. Generate 6-digit numeric OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();

    // 4. Hash the OTP for secure storage
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 5. Store in DB
    await this.prisma.otpVerification.create({
      data: {
        userId: params.userId || null,
        email,
        otpHash,
        type: params.type,
        expiresAt,
        attempts: 0,
        isUsed: false,
        metadata: params.metadata ?? undefined,
      },
    });

    // 6. Send Email
    await this.emailService.sendOtpEmail({
      recipientEmail: email,
      recipientName: params.recipientName || 'User',
      otp: rawOtp,
      purpose: params.purpose,
      expiresInMinutes: 10,
    });

    this.logger.log(
      `Generated OTP for ${email} (${params.type}) with expiration at ${expiresAt.toISOString()}`,
    );

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${email}.`,
    };
  }

  /**
   * Verifies the submitted OTP against the stored hash.
   * Enforces expiration, attempt limits (max 5), and single-use invalidation.
   */
  async verifyOtp(params: VerifyOtpParams): Promise<OtpVerification> {
    const email = params.email.toLowerCase().trim();
    const cleanOtp = params.otp.trim();

    // 1. Find latest active OTP
    const record = await this.prisma.otpVerification.findFirst({
      where: {
        email,
        type: params.type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'The verification code is invalid or has expired. Please request a new code.',
      );
    }

    // 2. Check maximum attempts
    if (record.attempts >= 5) {
      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      throw new BadRequestException(
        'Too many incorrect attempts. This code has been invalidated. Please request a new code.',
      );
    }

    // 3. Compare OTP
    const isMatch = await bcrypt.compare(cleanOtp, record.otpHash);
    if (!isMatch) {
      const updatedAttempts = record.attempts + 1;
      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: {
          attempts: updatedAttempts,
          isUsed: updatedAttempts >= 5,
        },
      });

      const remaining = 5 - updatedAttempts;
      throw new BadRequestException(
        `Invalid verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Code invalidated.'}`,
      );
    }

    // 4. Mark as used if requested
    if (params.consume) {
      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
    }

    return record;
  }
}
