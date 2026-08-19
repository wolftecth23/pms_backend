// import { Injectable } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {}

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: { message?: string; name?: string } | undefined,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      let message = 'Your session is invalid. Please sign in again.';
      let error = 'Invalid Token';

      if (info?.name === 'TokenExpiredError') {
        message = 'Your session has expired. Please sign in again.';
        error = 'Token Expired';
      }

      throw new UnauthorizedException({
        message,
        error,
        isAuthenticated: false,
      });
    }

    return user;
  }
}
