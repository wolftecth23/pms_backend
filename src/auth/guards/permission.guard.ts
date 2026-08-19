import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { JwtUser } from '../auth.controller';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

interface OrganizationParams {
  organizationId: string;
}

type PermissionRequest = FastifyRequest<{
  Params: OrganizationParams;
}> & {
  user: JwtUser;
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (!requiredPermissions.length && !anyPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<PermissionRequest>();

    const { user } = request;

    if (!user) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const organizationId = request.headers['x-organization-id'];

    const organization =
      user.organizations?.find(
        (organization) => organization.organizationId === organizationId,
      ) ?? user.organizations?.[0];

    if (!organization) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const userPermissions = organization.permissions ?? [];

    if (requiredPermissions.length) {
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    if (anyPermissions.length) {
      const hasAnyPermission = anyPermissions.some((permission) =>
        userPermissions.includes(permission),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException({
          message: 'You do not have permission to perform this action.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    return true;
  }
}
