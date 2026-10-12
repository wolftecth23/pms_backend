import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChangePasswordDto,
  ChangePasswordWithOtpDto,
  ForgotPasswordRequestDto,
  OtpTypeEnum,
  RequestChangePasswordOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/otp-auth.dto';
import { OtpService } from './otp.service';

export interface JwtPayloadUser {
  id: string;
  email: string;
}

export interface JwtPermission {
  code: string;
}

export interface JwtWorkspace {
  id: string;
  name: string;
  description?: string | null;
}

export interface JwtRole {
  id: string;
  name: string;
}

export interface JwtOrganization {
  organizationId: string;
  organizationName: string;

  role: JwtRole;

  workspaces: JwtWorkspace[];

  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<JwtPayloadUser | null> {
    const user = await this.prisma.user.findFirst({ where: { email } });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        message: 'Your account has been deactivated. Please contact support.',
        error: 'Account Deactivated',
      });
    }

    const hasActiveMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        removedAt: null,
        organization: {
          isActive: true,
          deletedAt: null,
        },
      },
    });

    if (!hasActiveMembership) {
      throw new UnauthorizedException({
        message:
          'Your account has been deactivated in your organization. Please contact your organization administrator.',
        error: 'Organization Access Denied',
      });
    }

    const { password: _password, ...result } = user;
    return result;
  }

  login(user: JwtPayloadUser) {
    const payload = {
      id: user.id,
      email: user.email,
    };

    // return {
    //   token: this.jwtService.sign(payload),
    // };

    return {
      message: 'You have signed in successfully.',
      data: {
        token: this.jwtService.sign(payload),
      },
    };
  }

  // async getUserDetails(userId: string) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     include: {
  //       organizationMember: {
  //         include: {
  //           organization: true,
  //           role: {
  //             include: {
  //               permissions: {
  //                 include: {
  //                   permission: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       workspaceMember: {
  //         include: {
  //           workspace: true,
  //           role: {
  //             include: {
  //               permissions: {
  //                 include: {
  //                   permission: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!user) {
  //     return null;
  //   }

  //   const { password, ...result } = user;
  //   return result;
  // }

  async getUserWithPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        organizationMember: {
          where: {
            removedAt: null,
            isActive: true,
            organization: {
              isActive: true,
              deletedAt: null,
            },
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                workspace: {
                  where: {
                    deletedAt: null,
                  },
                  select: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
            role: {
              include: {
                permissions: {
                  where: {
                    isActive: true,
                    deletedAt: null,
                  },
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const validMemberships = user.organizationMember.filter(
      (member) => member.organization != null,
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,

      organizations: validMemberships.map((member) => ({
        organizationId: member.organization.id,
        organizationName: member.organization.name,

        role: {
          id: member.role.id,
          name: member.role.name,
        },

        workspaces: member.organization.workspace.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
        })),

        permissions: member?.role?.permissions?.map(
          (rp) => rp?.permission?.code,
        ),
      })),
    };
  }

  async forgotPassword(dto: ForgotPasswordRequestDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException(
        'No active account found with this email address.',
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    return this.otpService.generateAndSendOtp({
      email: user.email,
      type: OtpTypeEnum.FORGOT_PASSWORD,
      userId: user.id,
      recipientName: `${user.firstName} ${user.lastName || ''}`.trim(),
      purpose: 'Password Reset',
    });
  }

  async verifyForgotPasswordOtp(dto: VerifyOtpDto) {
    await this.otpService.verifyOtp({
      email: dto.email,
      type: OtpTypeEnum.FORGOT_PASSWORD,
      otp: dto.otp,
      consume: false,
    });

    return {
      success: true,
      message: 'Verification code is valid.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    // Verify and consume the OTP
    await this.otpService.verifyOtp({
      email: dto.email,
      type: OtpTypeEnum.FORGOT_PASSWORD,
      otp: dto.otp,
      consume: true,
    });

    const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: newHashedPassword },
    });

    return {
      success: true,
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  async requestChangePasswordOtp(
    userId: string,
    dto: RequestChangePasswordOtpDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Incorrect current password.');
    }

    return this.otpService.generateAndSendOtp({
      email: user.email,
      type: OtpTypeEnum.CHANGE_PASSWORD,
      userId: user.id,
      recipientName: `${user.firstName} ${user.lastName || ''}`.trim(),
      purpose: 'Change Password',
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Incorrect current password.');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as your current password.',
      );
    }

    const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: newHashedPassword },
    });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }

  async changePasswordWithOtp(userId: string, dto: ChangePasswordWithOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Incorrect current password.');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as your current password.',
      );
    }

    // Verify and consume OTP
    await this.otpService.verifyOtp({
      email: user.email,
      type: OtpTypeEnum.CHANGE_PASSWORD,
      otp: dto.otp,
      consume: true,
    });

    const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: newHashedPassword },
    });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }
}

// import { User } from '@prisma/client';

// type LoginUser = Omit<User, 'password'>;

// async login(user: LoginUser) {
//   const payload = {
//     sub: user.id,
//     email: user.email,
//   };

//   return {
//     access_token: await this.jwtService.signAsync(payload),
//   };
// }

// const permissionSet = new Set<string>();

// for (const member of user.organizationMember) {
//   for (const rolePermission of member.role.permissions) {
//     permissionSet.add(rolePermission.permission.code);
//   }
// }

// permissions: [...permissionSet],
