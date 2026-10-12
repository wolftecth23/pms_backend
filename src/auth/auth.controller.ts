import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService, JwtOrganization } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordRequestDto,
  RequestChangePasswordOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/otp-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

export interface JwtUser {
  id?: string;
  userId?: string;
  sub?: string;
  email: string;
  // permissions?: string[];
  organizations: JwtOrganization[];
}

export interface AuthRequest extends FastifyRequest {
  user: JwtUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid email or password.',
        error: 'Authentication Failed',
      });
    }

    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('userDetails')
  async getUserDetails(@Request() req: AuthRequest) {
    // console.log('req', req.user);
    // Note: ensure your JwtStrategy puts the user's id in req.user.userId or req.user.sub
    // Based on standard JWT practices, sub is often mapped to userId.
    const userId = req.user.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'Your session is invalid. Please sign in again.',
        error: 'Invalid Token',
        isAuthenticated: false,
      });
    }

    // const userDetails = await this.authService.getUserDetails(userId);
    const userDetails = await this.authService.getUserWithPermissions(userId);

    if (!userDetails) {
      throw new UnauthorizedException({
        message: 'Your account could not be found or has been deactivated.',
        error: 'User Not Found',
        isAuthenticated: false,
      });
    }

    return userDetails;
  }

  @Post('forgot-password/send-otp')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('forgot-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyForgotPasswordOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyForgotPasswordOtp(dto);
  }

  @Post('forgot-password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password/request-otp')
  @HttpCode(HttpStatus.OK)
  async requestChangePasswordOtp(
    @Request() req: AuthRequest,
    @Body() dto: RequestChangePasswordOtpDto,
  ) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid user session.');
    }
    return this.authService.requestChangePasswordOtp(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid user session.');
    }
    return this.authService.changePassword(userId, dto);
  }
}
