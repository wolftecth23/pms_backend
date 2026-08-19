import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayloadUser } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  // constructor(private readonly authService: AuthService) {}

  async validate(payload: JwtPayloadUser) {
    if (!payload.id) {
      throw new UnauthorizedException({
        message: 'Your account could not be found.',
        error: 'User Not Found',
        isAuthenticated: false,
      });
    }

    const user = await this.authService.getUserWithPermissions(payload.id);

    // console.log('user', user);

    if (!user) {
      throw new UnauthorizedException({
        message: 'Your account could not be found.',
        error: 'User Not Found',
        isAuthenticated: false,
      });
    }

    return {
      userId: payload.id,
      email: payload.email,
      organizations: user.organizations,
      // permissions: [],
      // permissions: user.permissions.map((permission) => permission.code),
    };
  }
}
