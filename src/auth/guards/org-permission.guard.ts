import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { OrgPermissionService } from '../../common/access/org-permission.service';
import { JwtUser } from '../auth.controller';
import {
  ANY_ORG_PERMISSIONS_KEY,
  ORG_PERMISSIONS_KEY,
} from '../decorators/org-permissions.decorator';

interface AuthenticatedRequest extends FastifyRequest {
  user?: JwtUser;
  orgMember?: unknown;
  orgPermissions?: string[];
}

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly orgPermissionService: OrgPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(ORG_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_ORG_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (!requiredPermissions.length && !anyPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id ?? request.user?.userId;

    if (!userId) {
      throw new ForbiddenException({
        message: 'You do not have permission to perform this action.',
        error: 'Forbidden',
        isAuthenticated: false,
      });
    }

    const orgId = this.resolveOrganizationId(request);

    if (!orgId) {
      throw new ForbiddenException({
        message: 'Organization context is required to verify permissions.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const member = await this.orgPermissionService.getOrgMember(userId, orgId);

    if (!member) {
      throw new ForbiddenException({
        message:
          'You are not a member of this organization or do not have access.',
        error: 'Forbidden',
        isAuthenticated: true,
      });
    }

    const memberPermissions =
      await this.orgPermissionService.getOrgMemberPermissions(userId, orgId);

    request.orgMember = member;
    request.orgPermissions = memberPermissions;

    const isSuperAdmin = memberPermissions.includes('*');

    if (requiredPermissions.length && !isSuperAdmin) {
      const hasAll = requiredPermissions.every((perm) =>
        memberPermissions.includes(perm),
      );

      if (!hasAll) {
        throw new ForbiddenException({
          message:
            'You do not have permission to perform this action on this organization.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    if (anyPermissions.length && !isSuperAdmin) {
      const hasAny = anyPermissions.some((perm) =>
        memberPermissions.includes(perm),
      );

      if (!hasAny) {
        throw new ForbiddenException({
          message:
            'You do not have permission to perform this action on this organization.',
          error: 'Forbidden',
          isAuthenticated: true,
        });
      }
    }

    return true;
  }

  private resolveOrganizationId(request: AuthenticatedRequest): string | null {
    const params = request.params as Record<string, unknown> | undefined;
    if (params) {
      if (typeof params['orgId'] === 'string') {
        return params['orgId'];
      }
      if (typeof params['organizationId'] === 'string') {
        return params['organizationId'];
      }
    }

    const headerOrgId =
      request.headers['x-organization-id'] ??
      request.headers['X-Organization-Id'];
    if (typeof headerOrgId === 'string') {
      return headerOrgId;
    }

    const query = request.query as Record<string, unknown> | undefined;
    if (query) {
      if (typeof query['orgId'] === 'string') return query['orgId'];
      if (typeof query['organizationId'] === 'string')
        return query['organizationId'];
    }

    const body = request.body as Record<string, unknown> | undefined;
    if (body && typeof body === 'object') {
      if (typeof body['orgId'] === 'string') return body['orgId'];
      if (typeof body['organizationId'] === 'string')
        return body['organizationId'];
    }

    return null;
  }
}
